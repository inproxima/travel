import { addDays } from "@/lib/geo";
import type { Picks, Ranking, TripSpec } from "./schemas";

// Stand-in answers for `./run.sh mock`. They follow simple rules over the same
// payload the real model receives, so the whole pipeline (validation, quote
// checks, scoring) runs exactly as it would live. They are not meant to be clever.

type ParsePayload = { today: string; currency: string; savedPlaces: { id: string; label: string; address: string }[]; request: string };

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const CITIES = ["Lisbon", "Porto", "Paris", "Rome", "London", "Tokyo", "Barcelona", "Madrid", "Berlin", "Amsterdam", "New York", "Prague", "Vienna"];

function nextDate(today: string, month: number, day: number): string {
  const year = Number(today.slice(0, 4));
  for (const y of [year, year + 1]) {
    const iso = `${y}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (iso >= today) return iso;
  }
  return today;
}

export function mockTripSpec(p: ParsePayload): TripSpec {
  const text = p.request;
  const lower = text.toLowerCase();
  const assumptions: string[] = [];

  const city = CITIES.find((c) => lower.includes(c.toLowerCase())) ?? text.match(/\bin ([A-Z][\w\s]+?)(?:[,.]| for| from| near|$)/)?.[1]?.trim() ?? "Lisbon";

  let nights = Number(lower.match(/(\d+)\s*(?:nights?|days?)/)?.[1] ?? NaN);
  if (!Number.isFinite(nights)) nights = /a month|one month/.test(lower) ? 30 : /a week|one week/.test(lower) ? 7 : /weekend/.test(lower) ? 2 : NaN;
  if (!Number.isFinite(nights)) {
    nights = 4;
    assumptions.push("Assumed a 4-night stay.");
  }

  let start: string | null = lower.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1] ?? null;
  let flexibleMonth: number | null = null;
  const dated = lower.match(new RegExp(`(${MONTHS.join("|")})\\s+(\\d{1,2})(?:st|nd|rd|th)?`));
  if (!start && dated) start = nextDate(p.today, MONTHS.indexOf(dated[1]!), Number(dated[2]));
  if (!start) {
    const month = MONTHS.findIndex((m) => lower.includes(m));
    if (month >= 0) flexibleMonth = month;
    else if (/next month/.test(lower)) flexibleMonth = (Number(p.today.slice(5, 7)) % 12) as number;
  }

  let windows: { checkIn: string; checkOut: string }[];
  if (flexibleMonth !== null) {
    const first = nextDate(p.today, flexibleMonth, 1);
    windows = [0, 10, 20].map((d) => ({ checkIn: addDays(first, d), checkOut: addDays(first, d + nights) }));
  } else {
    if (!start) {
      start = addDays(p.today, 28);
      assumptions.push(`No dates given, so I looked at ${start}.`);
    }
    windows = [{ checkIn: start, checkOut: addDays(start, nights) }];
  }

  const solo = /\b(solo|alone|by myself|for work|business trip)\b/.test(lower);
  const family = /\b(family|kids|children)\b/.test(lower);
  const adults = Number(lower.match(/(\d+)\s*adults?/)?.[1] ?? (solo ? 1 : 2));
  if (!/adults?|solo|alone|for work|couple|family/.test(lower)) assumptions.push(`Assumed ${adults} adults.`);

  const budget = Number(lower.match(/(?:under|below|max|budget of|up to)\s*[$€£]?\s?(\d{2,5})/)?.[1] ?? lower.match(/[$€£]\s?(\d{2,5})\s*(?:\/|per|a)\s*night/)?.[1] ?? NaN);

  const PRIORITIES: [RegExp, string, string | null][] = [
    [/quiet|noise|sleep/, "quiet", "noise"],
    [/wi-?fi|internet|remote work|work from/, "fast wifi", "wifi"],
    [/walk/, "walkable", null],
    [/breakfast/, "breakfast", "breakfast"],
    [/pool/, "pool", "pool"],
    [/gym|fitness/, "gym", "gym"],
    [/view/, "view", "view"],
    [/kitchen|cook/, "kitchen", "kitchen"],
    [/clean/, "clean", "clean"],
    [/cheap|value|budget/, "good value", null],
  ];
  const matched = PRIORITIES.filter(([re]) => re.test(lower));
  const priorities = matched.map(([, label]) => label);

  const travelerType = /\b(work|business|office|conference)\b/.test(lower)
    ? "Business"
    : family
      ? "Family"
      : /\b(couple|partner|wife|husband|honeymoon|anniversary)\b/.test(lower)
        ? "Couples"
        : /\bfriends\b/.test(lower)
          ? "Friends"
          : solo
            ? "Solo"
            : null;

  const places: TripSpec["placesOfInterest"] = [];
  if (/\b(my )?(office|work)\b/.test(lower)) {
    const saved = p.savedPlaces.find((s) => /work|office/i.test(s.label)) ?? p.savedPlaces[0];
    if (saved) places.push({ label: saved.label, address: saved.address, savedPlaceId: saved.id });
  }
  const near = text.match(/\bnear (?!my )(?:the )?([A-Z][\w\s']+?)(?:[,.]|$| and| for)/)?.[1];
  if (near) places.push({ label: near.trim(), address: `${near.trim()}, ${city}`, savedPlaceId: null });

  return {
    destination: city,
    searchQuery: city,
    dateWindows: windows,
    flexibleDates: windows.length > 1,
    adults,
    childrenAges: family ? [7] : [],
    budgetPerNight: Number.isFinite(budget) ? budget : null,
    budgetTotal: null,
    minHotelClass: Number(lower.match(/(\d)\s*(?:-?\s*star|★)/)?.[1] ?? NaN) || null,
    priorities,
    reviewKeyword: matched.find(([, , kw]) => kw)?.[2] ?? null,
    travelerType,
    preferVacationRentals: /apartment|rental|airbnb|kitchen/.test(lower),
    placesOfInterest: places,
    assumptions,
  };
}

// --- picks --------------------------------------------------------------------------

type Cand = {
  id: string;
  name: string;
  rating: number | null;
  reviewCount: number | null;
  locationRating: number | null;
  nightly: number | null;
  distanceKm: Record<string, number | null>;
  guestMentions?: string[];
};

type ShortlistPayload = { pick: number; spec: { budgetPerNight: number | null; priorities: string[] }; candidates: Cand[] };

function heuristic(c: Cand, budget: number | null, medianPrice: number): number {
  const price = c.nightly ?? medianPrice;
  const dist = Object.values(c.distanceKm).find((d) => d != null) ?? 2;
  const overBudget = budget && price > budget ? (price - budget) / budget : 0;
  return (c.rating ?? 4) * 2 + (c.locationRating ?? 4) - dist * 0.6 - (price / medianPrice) * 1.5 - overBudget * 6 + Math.log10((c.reviewCount ?? 10) + 1) * 0.3;
}

function median(nums: number[]): number {
  const s = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)]! : 150;
}

function reasonFor(c: Cand): string {
  const dist = Object.entries(c.distanceKm).find(([, d]) => d != null);
  const parts = [c.rating ? `${c.rating}★ from ${c.reviewCount?.toLocaleString("en-US") ?? "many"} reviews` : null, dist ? `${dist[1]} km from ${dist[0]}` : null, c.nightly ? `about ${Math.round(c.nightly)} a night` : null].filter(Boolean);
  return `${parts.join(", ")}.`;
}

export function mockShortlist(p: ShortlistPayload): Picks {
  const med = median(p.candidates.map((c) => c.nightly ?? NaN));
  const sorted = [...p.candidates].sort((a, b) => heuristic(b, p.spec.budgetPerNight, med) - heuristic(a, p.spec.budgetPerNight, med));
  return { picks: sorted.slice(0, p.pick).map((c) => ({ id: c.id, reason: reasonFor(c) })) };
}

type Rev = { rating: string | null; text: string; tripType?: string };
type FinalistPayload = ShortlistPayload & { hotels: (Cand & { reviews: Rev[]; commute: { times: string[] } | null })[] };

const avgRating = (rs: Rev[]) => {
  const n = rs.map((r) => Number(r.rating?.split("/")[0])).filter(Number.isFinite);
  return n.length ? n.reduce((a, b) => a + b, 0) / n.length : 4;
};

const commuteMin = (c: { times: string[] } | null) => {
  if (!c) return null;
  const mins = c.times.map((t) => {
    const h = Number(t.match(/(\d+)\s*hr/)?.[1] ?? 0);
    const m = Number(t.match(/(\d+)\s*min/)?.[1] ?? 0);
    return h * 60 + m;
  });
  return Math.min(...mins);
};

export function mockFinalists(p: FinalistPayload): Picks {
  const med = median(p.hotels.map((c) => c.nightly ?? NaN));
  const score = (h: FinalistPayload["hotels"][number]) => heuristic(h, p.spec.budgetPerNight, med) + avgRating(h.reviews) - (commuteMin(h.commute) ?? 20) / 15;
  const sorted = [...p.hotels].sort((a, b) => score(b) - score(a));
  return { picks: sorted.slice(0, p.pick).map((h) => ({ id: h.id, reason: `Reviews average ${avgRating(h.reviews).toFixed(1)}/5${h.commute ? `, ${h.commute.times[0]} to ${Object.keys(h.distanceKm)[0] ?? "your place"}` : ""}.` })) };
}

// --- ranking -------------------------------------------------------------------------

type RankPayload = {
  spec: { budgetPerNight: number | null; priorities: string[]; travelerType: string | null };
  hotels: (Cand & {
    total: number | null;
    commute: { to: string; times: string[] } | null;
    googleReviews: Rev[];
    tripadvisor: { rating: number | null; reviews: Rev[] } | null;
    mapsReviews: Rev[] | null;
  })[];
};

/** The longest sentence of a review, which is a verbatim quote from it. */
function quoteFrom(r: Rev): string {
  const sentences = r.text.replace(/…$/, "").split(/(?<=[.!?])\s+/);
  const longest = sentences.sort((a, b) => b.length - a.length)[0] ?? r.text;
  return longest.replace(/[.!?]+$/, "");
}

export function mockRanking(p: RankPayload): Ranking {
  const med = median(p.hotels.map((h) => h.nightly ?? NaN));
  const ranking = p.hotels.map((h) => {
    const all: (Rev & { source: "google" | "tripadvisor" | "google_maps" })[] = [
      ...h.googleReviews.map((r) => ({ ...r, source: "google" as const })),
      ...(h.tripadvisor?.reviews ?? []).map((r) => ({ ...r, source: "tripadvisor" as const })),
      ...(h.mapsReviews ?? []).map((r) => ({ ...r, source: "google_maps" as const })),
    ];
    const rated = (r: Rev) => Number(r.rating?.split("/")[0]);
    const good = all.filter((r) => rated(r) >= 4).slice(0, 2);
    const bad = all.filter((r) => rated(r) > 0 && rated(r) <= 3).slice(0, 1);
    const mins = commuteMin(h.commute);
    const price = h.nightly ?? med;
    const value = Math.max(2, Math.min(9.5, 7 + (med - price) / med * 6 - (p.spec.budgetPerNight && price > p.spec.budgetPerNight ? 2 : 0)));
    const location = Math.max(2, Math.min(9.6, mins != null ? 10 - mins / 5 : (h.locationRating ?? 4) * 2));
    const reviews = Math.max(2, Math.min(9.7, ((h.rating ?? 4) + avgRating(all)) - 0.5));
    const fit = Math.max(3, Math.min(9.2, (reviews + location) / 2));
    return {
      id: h.id,
      headline: mins != null ? `${h.rating ?? "–"}★, ${h.commute!.times[0]} to ${h.commute!.to}` : `${h.rating ?? "–"}★ at about ${Math.round(price)} a night`,
      scores: { value: Math.round(value * 10) / 10, location: Math.round(location * 10) / 10, reviews: Math.round(reviews * 10) / 10, fit: Math.round(fit * 10) / 10 },
      pros: good.map((r) => ({ text: r.source === "tripadvisor" ? "Tripadvisor reviewers are positive." : "Guests are positive about their stay.", quote: quoteFrom(r), source: r.source })),
      cons: bad.length
        ? bad.map((r) => ({ text: "Not every guest was happy.", quote: quoteFrom(r), source: r.source }))
        : [{ text: price > med ? "Pricier than most options here." : "Few complaints, but check the room type.", quote: null, source: null }],
      bestFor: [p.spec.travelerType ?? "Most travellers", ...p.spec.priorities.slice(0, 1).map((x) => `Wants ${x}`)],
      caveats: ["Sample AI answer (mock mode): rule-based, not a real model."],
    };
  });
  const top = [...ranking].sort((a, b) => b.scores.value + b.scores.location + b.scores.reviews - (a.scores.value + a.scores.location + a.scores.reviews))[0];
  const topName = p.hotels.find((h) => h.id === top?.id)?.name ?? "the first option";
  return { summary: `${topName} is the strongest all-round choice for this request. This is a rule-based sample ranking; with an OpenAI key the planner writes a real one.`, ranking };
}
