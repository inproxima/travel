import crypto from "node:crypto";
import { env } from "@/lib/env";
import { addDays, haversineKm, nightsBetween } from "@/lib/geo";
import type { ForumPost, SavedPlace } from "@/lib/models";
import { Budget, BudgetExceededError } from "@/lib/serpapi/budget";
import type { CallContext } from "@/lib/serpapi/client";
import { searchForums } from "@/lib/serpapi/engines/google-forums";
import { searchHotels, type HotelQuery } from "@/lib/serpapi/engines/google-hotels";
import { hotelReviews } from "@/lib/serpapi/engines/google-hotels-reviews";
import { geocode } from "@/lib/serpapi/engines/google-maps";
import { directions, weekdayMorningUnix } from "@/lib/serpapi/engines/google-maps-directions";
import { mapsReviews } from "@/lib/serpapi/engines/google-maps-reviews";
import { findTripadvisorHotel, tripadvisorReviews } from "@/lib/serpapi/engines/tripadvisor";
import { getSettings } from "@/lib/settings";
import { compactCandidate, compactCommute, compactForums, compactReviews, compactSpec } from "./compact";
import { saveResult } from "./history";
import { askFinalists, askRanking, askShortlist, finalizeRanking, validPicks } from "./rank";
import type { TripSpec } from "./schemas";
import type { Candidate, HotelEvidence, PlannerEvent, PlannerResult, ResearchPlan, ResolvedPlace, StayWindow } from "./types";

type Emit = (e: PlannerEvent) => void;

const isAbort = (e: unknown) => e instanceof Error && (e.name === "AbortError" || (e as { code?: string }).code === "ABORT_ERR");

/**
 * Runs an optional research call. Ordinary failures (no result, a SerpApi
 * error, the credit cap) leave a gap in the evidence instead of failing the
 * whole question; cancelling still stops everything.
 */
async function soft<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    if (isAbort(e)) throw e;
    if (!(e instanceof BudgetExceededError)) console.warn("[planner]", (e as Error).message);
    return null;
  }
}

const CATEGORY_WORDS: [RegExp, RegExp][] = [
  [/quiet|noise|sleep/i, /noise|sleep|quiet/i],
  [/wi-?fi|internet|work/i, /wi-?fi|internet/i],
  [/breakfast/i, /breakfast/i],
  [/clean/i, /clean/i],
  [/location|walk|central/i, /location/i],
  [/service|staff/i, /service|staff/i],
  [/value|price|cheap|budget/i, /value/i],
  [/room|bed/i, /room/i],
];

/** The hotel's review category that matches the traveller's top priority, if Google has one. */
function priorityCategory(spec: TripSpec, c: Candidate): string | null {
  const wants = [spec.reviewKeyword, ...spec.priorities].filter(Boolean).join(" ");
  for (const [want, category] of CATEGORY_WORDS) {
    if (!want.test(wants)) continue;
    const hit = c.hotel.categories.find((cat) => category.test(cat.name) && cat.categoryToken);
    if (hit) return hit.categoryToken;
  }
  return null;
}

function heuristicOrder(cands: Candidate[], budget: number | null): string[] {
  const prices = cands.map((c) => c.best?.nightly).filter((n): n is number => n != null).sort((a, b) => a - b);
  const med = prices[Math.floor(prices.length / 2)] ?? 150;
  const score = (c: Candidate) => {
    const price = c.best?.nightly ?? med;
    return (c.hotel.rating ?? 4) * 2 + (c.hotel.locationRating ?? 4) - (c.distancesKm[0] ?? 2) * 0.5 - (price / med) * 1.5 - (budget && price > budget ? 3 : 0);
  };
  return [...cands].sort((a, b) => score(b) - score(a)).map((c) => c.hotel.id);
}

export async function runPlanner(
  input: { request: string; spec: TripSpec; plan: ResearchPlan; saved: SavedPlace[] },
  emit: Emit,
  signal: AbortSignal,
): Promise<PlannerResult> {
  const { request, spec, plan, saved } = input;
  const settings = getSettings();
  const budget = new Budget(plan.cap);
  budget.onChange((s) => emit({ type: "credits", used: s.spent, cap: s.cap }));
  const ctx: CallContext = { budget, signal };
  const step = (key: string, label: string, status: "running" | "done" | "skipped", detail?: string) => emit({ type: "step", key, label, status, detail });

  // 1. Places of interest -------------------------------------------------------------
  const places: ResolvedPlace[] = [];
  if (spec.placesOfInterest.length) {
    step("places", "Locating your places", "running");
    let geocodesLeft = plan.geocodes;
    for (const p of spec.placesOfInterest) {
      const savedPlace = p.savedPlaceId ? saved.find((s) => s.id === p.savedPlaceId) : undefined;
      if (savedPlace?.coords) {
        places.push({ label: savedPlace.label, address: savedPlace.address, coords: savedPlace.coords });
        continue;
      }
      let coords = null;
      if (geocodesLeft > 0) {
        geocodesLeft--;
        coords = (await soft(() => geocode(p.address, ctx, settings.language)))?.coords ?? null;
      }
      places.push({ label: p.label, address: p.address, coords });
    }
    step("places", "Locating your places", "done", places.map((p) => p.label).join(", "));
  }
  const primary = places.find((p) => p.coords) ?? places[0] ?? null;

  // 2. Hotels + forums, in parallel ------------------------------------------------------
  step("search", "Searching hotels", "running");
  if (plan.forums) step("forums", "Reading forum advice", "running");
  const base: Omit<HotelQuery, "checkIn" | "checkOut"> = {
    q: spec.searchQuery,
    adults: spec.adults,
    childrenAges: spec.childrenAges,
    currency: settings.currency,
    gl: settings.country,
    hl: settings.language,
    minRating: null,
  };

  const forumQueries = [
    `where to stay in ${spec.destination}${spec.priorities[0] ? ` ${spec.priorities[0]}` : ""}`,
    nightsBetween(spec.dateWindows[0]!.checkIn, spec.dateWindows[0]!.checkOut) >= 14 ? `${spec.destination} long stay neighborhood` : `${spec.destination} best area ${spec.travelerType ?? ""}`.trim(),
  ].slice(0, plan.forums);

  const [searches, forumLists] = await Promise.all([
    Promise.all(
      spec.dateWindows.map(async (w) => {
        const first = await soft(() => searchHotels({ ...base, checkIn: w.checkIn, checkOut: w.checkOut }, ctx));
        const results = first ? [...first.hotels] : [];
        if (plan.pageTwo && first?.nextPageToken) {
          const more = await soft(() => searchHotels({ ...base, checkIn: w.checkIn, checkOut: w.checkOut, nextPageToken: first.nextPageToken }, ctx));
          if (more) results.push(...more.hotels);
        }
        return { window: w, hotels: results };
      }),
    ),
    Promise.all(forumQueries.map((q) => soft(() => searchForums(q, { recency: "y", hl: settings.language, gl: settings.country }, ctx)))),
  ]);
  if (plan.rentals) {
    const w = spec.dateWindows[0]!;
    const rentals = await soft(() => searchHotels({ ...base, checkIn: w.checkIn, checkOut: w.checkOut, vacationRentals: true }, ctx));
    if (rentals) searches[0]!.hotels.push(...rentals.hotels);
  }

  const forums: ForumPost[] = [];
  for (const list of forumLists) for (const p of list ?? []) if (!forums.some((f) => f.link === p.link)) forums.push(p);
  if (plan.forums) step("forums", "Reading forum advice", "done", `${forums.length} posts`);

  // Merge the same hotel across date windows, keeping each window's price.
  const byId = new Map<string, Candidate>();
  for (const { window, hotels } of searches) {
    const nights = nightsBetween(window.checkIn, window.checkOut);
    for (const h of hotels) {
      if (h.nightly == null && h.total == null) continue;
      const stay: StayWindow = { checkIn: window.checkIn, checkOut: window.checkOut, nights, nightly: h.nightly, total: h.total ?? (h.nightly != null ? h.nightly * nights : null) };
      const existing = byId.get(h.id);
      if (existing) {
        existing.windows.push(stay);
        continue;
      }
      byId.set(h.id, {
        hotel: h,
        windows: [stay],
        best: null,
        distancesKm: places.map((p) => (p.coords && h.coords ? haversineKm(h.coords, p.coords) : null)),
      });
    }
  }
  const candidates = [...byId.values()].map((c) => ({ ...c, best: [...c.windows].sort((a, b) => (a.total ?? Infinity) - (b.total ?? Infinity))[0] ?? null }));
  const candById = new Map(candidates.map((c) => [c.hotel.id, c]));
  step("search", "Searching hotels", "done", `${candidates.length} options with prices`);
  if (candidates.length === 0) throw new Error(`No hotels with prices came back for ${spec.destination} on those dates. Try other dates or a broader area.`);

  // 3. Shortlist -------------------------------------------------------------------------
  step("shortlist", `AI is picking a shortlist of ${plan.shortlist}`, "running");
  const order = heuristicOrder(candidates, spec.budgetPerNight);
  const pool = order.slice(0, 40).map((id) => candById.get(id)!);
  const shortPicks = validPicks(
    await askShortlist(
      {
        request,
        today: new Date().toISOString().slice(0, 10),
        spec: compactSpec(spec),
        currency: settings.currency,
        places: places.map((p) => p.label),
        pick: plan.shortlist,
        candidates: pool.map((c) => compactCandidate(c, places)),
        forumPosts: compactForums(forums),
      },
      signal,
    ),
    pool.map((c) => c.hotel.id),
    plan.shortlist,
    order,
  );
  step("shortlist", `AI is picking a shortlist of ${plan.shortlist}`, "done", shortPicks.map((p) => candById.get(p.id)!.hotel.name).join(", "));

  // 4. Reviews + commute for the shortlist ------------------------------------------------
  step("reviews", "Reading Google reviews", "running");
  if (plan.directions && primary) step("commute", `Checking travel times to ${primary.label}`, "running");
  // Commute on the first weekday morning of the stay; the UTC offset is estimated from longitude.
  const departAt = primary?.coords ? weekdayMorningUnix(addDays(spec.dateWindows[0]!.checkIn, 1), Math.round(primary.coords.lng / 15)) : undefined;

  const evidence: HotelEvidence[] = await Promise.all(
    shortPicks.map(async (pick) => {
      const c = candById.get(pick.id)!;
      const [reviews, commute] = await Promise.all([
        c.hotel.propertyToken
          ? soft(() => hotelReviews({ propertyToken: c.hotel.propertyToken!, categoryToken: priorityCategory(spec, c), hl: settings.language }, ctx))
          : Promise.resolve(null),
        plan.directions && primary
          ? soft(() =>
              directions(
                { address: `${c.hotel.name}, ${spec.destination}`, label: c.hotel.name },
                primary.coords ? { coords: primary.coords, label: primary.label } : { address: primary.address, label: primary.label },
                { departAt, hl: settings.language },
                ctx,
              ),
            )
          : Promise.resolve(null),
      ]);
      return {
        candidate: c,
        shortlistReason: pick.reason,
        googleReviews: reviews?.reviews ?? [],
        commute,
        tripadvisor: null,
        mapsReviews: null,
        finalist: false,
        finalistReason: null,
      };
    }),
  );
  step("reviews", "Reading Google reviews", "done", `${evidence.reduce((n, e) => n + e.googleReviews.length, 0)} reviews`);
  if (plan.directions && primary) step("commute", `Checking travel times to ${primary.label}`, "done");

  // 5. Finalists ---------------------------------------------------------------------------
  step("finalists", `AI is narrowing to ${plan.finalists} finalists`, "running");
  const evById = new Map(evidence.map((e) => [e.candidate.hotel.id, e]));
  const finalPicks = validPicks(
    await askFinalists(
      {
        request,
        spec: compactSpec(spec),
        currency: settings.currency,
        places: places.map((p) => p.label),
        pick: plan.finalists,
        hotels: evidence.map((e) => ({
          ...compactCandidate(e.candidate, places),
          shortlistReason: e.shortlistReason,
          commute: compactCommute(e.commute),
          reviews: compactReviews(e.googleReviews, 8),
        })),
      },
      signal,
    ),
    evidence.map((e) => e.candidate.hotel.id),
    plan.finalists,
    shortPicks.map((p) => p.id),
  );
  for (const p of finalPicks) Object.assign(evById.get(p.id)!, { finalist: true, finalistReason: p.reason });
  const finalists = finalPicks.map((p) => evById.get(p.id)!);
  step("finalists", `AI is narrowing to ${plan.finalists} finalists`, "done", finalists.map((e) => e.candidate.hotel.name).join(", "));

  // 6. Tripadvisor + Google Maps reviews for the finalists ------------------------------------
  if (plan.tripadvisor) step("tripadvisor", "Reading Tripadvisor reviews", "running");
  if (plan.mapsReviews) step("maps", "Searching Google Maps reviews", "running");
  await Promise.all(
    finalists.map(async (e) => {
      const h = e.candidate.hotel;
      await Promise.all([
        plan.tripadvisor
          ? (async () => {
              const place = await soft(() => findTripadvisorHotel(h.name, spec.destination, ctx));
              const reviews = place ? await soft(() => tripadvisorReviews({ placeId: place.placeId, tripTypes: spec.travelerType ? [spec.travelerType] : [] }, ctx)) : null;
              e.tripadvisor = { place, reviews: reviews ?? [] };
            })()
          : Promise.resolve(),
        plan.mapsReviews
          ? (async () => {
              let dataId = e.commute?.startDataId ?? null;
              // Looking the hotel up costs an extra credit, so only when the cap still allows it.
              if (!dataId && budget.canAfford(2)) dataId = (await soft(() => geocode(`${h.name}, ${spec.destination}`, ctx, settings.language)))?.dataId ?? null;
              if (!dataId) return;
              const page = await soft(() => mapsReviews({ dataId, query: spec.reviewKeyword, hl: settings.language }, ctx));
              e.mapsReviews = page?.reviews ?? null;
            })()
          : Promise.resolve(),
      ]);
    }),
  );
  if (plan.tripadvisor) step("tripadvisor", "Reading Tripadvisor reviews", "done", `${finalists.filter((e) => e.tripadvisor?.place).length} of ${finalists.length} found`);
  if (plan.mapsReviews) step("maps", "Searching Google Maps reviews", "done", spec.reviewKeyword ? `about “${spec.reviewKeyword}”` : undefined);

  // 7. Rank ---------------------------------------------------------------------------------
  step("rank", "AI is ranking the finalists", "running");
  const ranking = await askRanking(
    {
      request,
      spec: compactSpec(spec),
      currency: settings.currency,
      places: places.map((p) => p.label),
      hotels: finalists.map((e) => ({
        ...compactCandidate(e.candidate, places),
        commute: compactCommute(e.commute),
        googleReviews: compactReviews(e.googleReviews, 8),
        tripadvisor: e.tripadvisor ? { rating: e.tripadvisor.place?.rating ?? null, reviews: compactReviews(e.tripadvisor.reviews, 8) } : null,
        mapsReviews: e.mapsReviews ? compactReviews(e.mapsReviews, 8) : null,
      })),
      forumPosts: compactForums(forums, 8),
    },
    signal,
  );
  const forumText = forums.map((f) => `${f.title} ${f.snippet ?? ""}`).join("\n");
  const ranked = finalizeRanking(ranking, finalists, forumText);
  step("rank", "AI is ranking the finalists", "done");

  const result: PlannerResult = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    request,
    spec,
    currency: settings.currency,
    places,
    summary: ranking.summary,
    ranked,
    alsoConsidered: evidence
      .filter((e) => !e.finalist)
      .map((e) => ({ id: e.candidate.hotel.id, name: e.candidate.hotel.name, reason: e.shortlistReason, nightly: e.candidate.best?.nightly ?? null, total: e.candidate.best?.total ?? null })),
    forums: forums.slice(0, 8),
    candidatesFound: candidates.length,
    credits: { used: budget.snapshot().spent, cap: plan.cap },
    model: env().MOCK_MODE ? "sample (mock mode)" : env().OPENAI_MODEL,
    mock: env().MOCK_MODE,
  };
  saveResult(result);
  return result;
}
