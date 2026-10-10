import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/geo";
import type { SavedPlace } from "@/lib/models";
import { mockTripSpec } from "@/lib/ai/mock";
import { normalizeSpec } from "@/lib/ai/parse";
import { planResearch } from "@/lib/ai/plan";
import { finalizeRanking, overallScore, validPicks, verifyQuote } from "@/lib/ai/rank";
import type { TripSpec } from "@/lib/ai/schemas";
import type { HotelEvidence } from "@/lib/ai/types";
import { normalizeHotelSearch } from "@/lib/serpapi/engines/google-hotels";
import { useTempEnv } from "./setup";
import fs from "node:fs";
import path from "node:path";

const today = "2026-10-10";
const work: SavedPlace = { id: "w1", label: "Work", address: "Av. da Liberdade 110, Lisbon", coords: { lat: 38.7181, lng: -9.1446 } };

function spec(over: Partial<TripSpec> = {}): TripSpec {
  return {
    destination: "Lisbon",
    searchQuery: "Lisbon",
    dateWindows: [{ checkIn: "2027-03-03", checkOut: "2027-04-02" }],
    flexibleDates: false,
    adults: 2,
    childrenAges: [],
    budgetPerNight: null,
    budgetTotal: null,
    minHotelClass: null,
    priorities: ["quiet"],
    reviewKeyword: "noise",
    travelerType: "Business",
    preferVacationRentals: false,
    placesOfInterest: [{ label: "Work", address: work.address, savedPlaceId: "w1" }],
    assumptions: [],
    ...over,
  };
}

describe("planResearch", () => {
  const windows3 = [0, 10, 20].map((d) => ({ checkIn: addDays("2027-03-01", d), checkOut: addDays("2027-03-01", d + 7) }));
  const cases: [string, TripSpec][] = [
    ["one window, saved place", spec()],
    ["three windows, two unsaved places", spec({ dateWindows: windows3, placesOfInterest: [{ label: "A", address: "a", savedPlaceId: null }, { label: "B", address: "b", savedPlaceId: null }, { label: "C", address: "c", savedPlaceId: null }] })],
    ["no places at all", spec({ placesOfInterest: [] })],
    ["long stay with rentals and 3 windows", spec({ dateWindows: windows3.map((w) => ({ checkIn: w.checkIn, checkOut: addDays(w.checkIn, 30) })), preferVacationRentals: true })],
  ];

  it.each(cases)("keeps the worst case within 40 credits: %s", (_, s) => {
    const plan = planResearch(s, [work], 40);
    expect(plan.worstCase).toBeLessThanOrEqual(40);
    expect(plan.steps.reduce((n, x) => n + x.credits, 0)).toBe(plan.worstCase);
  });

  it("matches the 33-credit plan for a 30-night stay near a saved place", () => {
    const plan = planResearch(spec(), [work], 40);
    expect(plan).toMatchObject({ shortlist: 8, finalists: 4, rentals: true, pageTwo: true, geocodes: 0, worstCase: 33 });
  });

  it("shrinks the research to fit a lower cap", () => {
    const plan = planResearch(spec(), [work], 20);
    expect(plan.worstCase).toBeLessThanOrEqual(20);
    expect(plan.shortlist).toBeLessThan(8);
  });

  it("refuses a cap too small for any useful plan", () => {
    expect(() => planResearch(spec(), [work], 3)).toThrow(/AI_MAX_SERPAPI_CALLS/);
  });
});

describe("normalizeSpec", () => {
  it("drops past or broken date windows and unknown saved places", () => {
    const s = normalizeSpec(
      spec({
        dateWindows: [
          { checkIn: "2020-01-01", checkOut: "2020-01-05" },
          { checkIn: "2027-01-10", checkOut: "2027-01-09" },
          { checkIn: "2027-02-01", checkOut: "2027-02-08" },
        ],
        placesOfInterest: [{ label: "Office", address: "x", savedPlaceId: "made-up" }],
        adults: 0,
      }),
      today,
      [work],
    );
    expect(s.dateWindows).toEqual([{ checkIn: "2027-02-01", checkOut: "2027-02-08" }]);
    expect(s.placesOfInterest[0]!.savedPlaceId).toBeNull();
    expect(s.adults).toBe(2);
  });

  it("asks for dates when none are usable", () => {
    expect(() => normalizeSpec(spec({ dateWindows: [{ checkIn: "2019-01-01", checkOut: "2019-01-02" }] }), today, [])).toThrow(/dates/);
  });
});

describe("mock request parser", () => {
  it("understands a typical request", () => {
    const s = mockTripSpec({
      today,
      currency: "USD",
      savedPlaces: [{ id: "w1", label: "Work", address: work.address }],
      request: "Hotel in Lisbon for 30 nights from March 3, quiet with fast wifi, near my office, under $250 a night",
    });
    expect(s).toMatchObject({ destination: "Lisbon", budgetPerNight: 250, travelerType: "Business", reviewKeyword: "noise" });
    expect(s.dateWindows).toEqual([{ checkIn: "2027-03-03", checkOut: "2027-04-02" }]);
    expect(s.placesOfInterest[0]?.savedPlaceId).toBe("w1");
  });

  it("spreads flexible month requests over three windows", () => {
    const s = mockTripSpec({ today, currency: "USD", savedPlaces: [], request: "A family hotel in Rome for 5 nights sometime in June" });
    expect(s.dateWindows).toHaveLength(3);
    expect(s.travelerType).toBe("Family");
  });
});

describe("picks and ranking guards", () => {
  it("keeps only known ids, without repeats, topped up from the fallback order", () => {
    const picks = validPicks({ picks: [{ id: "x", reason: "a" }, { id: "nope", reason: "b" }, { id: "x", reason: "c" }] }, ["x", "y", "z"], 3, ["z", "y", "x"]);
    expect(picks.map((p) => p.id)).toEqual(["x", "z", "y"]);
  });

  it("accepts real quotes (ignoring case, quotes and spacing) and rejects invented ones", () => {
    const corpus = "Stayed a month for work. Desk in the room was big enough, Wi-Fi was fast and stable.";
    expect(verifyQuote("“wi-fi was  fast and stable”", corpus)).toBe("wi-fi was  fast and stable");
    expect(verifyQuote("The pool is heated all year", corpus)).toBeNull();
    expect(verifyQuote("fast", corpus)).toBeNull();
  });

  it("orders by the computed score, drops unknown hotels and fake quotes, and keeps omitted finalists", () => {
    const raw = JSON.parse(fs.readFileSync(path.join(process.cwd(), "fixtures/serpapi/google_hotels/default.json"), "utf8"));
    const hotels = normalizeHotelSearch(raw).hotels.slice(0, 3);
    const evidence: HotelEvidence[] = hotels.map((h, i) => ({
      candidate: { hotel: h, windows: [], best: { checkIn: "2027-03-03", checkOut: "2027-03-06", nights: 3, nightly: h.nightly, total: (h.nightly ?? 0) * 3 }, distancesKm: [i + 0.5] },
      shortlistReason: "",
      googleReviews: [{ id: `r${i}`, source: "google", origin: "Google", rating: 5, maxRating: 5, title: null, text: "Very quiet at night, blackout curtains and a great mattress.", date: null, author: null, tripType: null, subratings: {}, link: null }],
      commute: null,
      tripadvisor: null,
      mapsReviews: null,
      finalist: true,
      finalistReason: null,
    }));
    const ranked = finalizeRanking(
      {
        summary: "s",
        ranking: [
          { id: hotels[0]!.id, headline: "A", scores: { value: 5, location: 5, reviews: 5, fit: 5 }, pros: [{ text: "Quiet", quote: "blackout curtains and a great mattress", source: "google" }], cons: [], bestFor: [], caveats: [] },
          { id: "invented-hotel", headline: "X", scores: { value: 10, location: 10, reviews: 10, fit: 10 }, pros: [], cons: [], bestFor: [], caveats: [] },
          { id: hotels[1]!.id, headline: "B", scores: { value: 9, location: 12, reviews: 9, fit: -3 }, pros: [{ text: "Pool", quote: "Amazing rooftop pool", source: "google" }], cons: [], bestFor: [], caveats: [] },
        ],
      },
      evidence,
      "",
    );
    expect(ranked.map((r) => r.id)).toEqual([hotels[1]!.id, hotels[0]!.id, hotels[2]!.id]);
    expect(ranked[0]!.scores).toEqual({ value: 9, location: 10, reviews: 9, fit: 0 });
    expect(ranked[0]!.overall).toBe(overallScore({ value: 9, location: 10, reviews: 9, fit: 0 }));
    expect(ranked[0]!.pros[0]!.quote).toBeNull();
    expect(ranked[1]!.pros[0]!.quote).toBe("blackout curtains and a great mattress");
    expect(ranked[2]!.headline).toBe("Not ranked by the AI");
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
  });
});

describe("planner pipeline (mock mode)", () => {
  it("runs end to end within the credit cap", async () => {
    useTempEnv({ MOCK_MODE: "1" });
    const { runPlanner } = await import("@/lib/ai/pipeline");
    const s = spec();
    const plan = planResearch(s, [work], 40);
    const events: string[] = [];
    let credits = 0;
    const result = await runPlanner(
      { request: "30 nights in Lisbon near my office, quiet", spec: s, plan, saved: [work] },
      (e) => {
        if (e.type === "step" && e.status === "done") events.push(e.key);
        if (e.type === "credits") credits = e.used;
      },
      new AbortController().signal,
    );
    expect(result.ranked).toHaveLength(4);
    expect(result.credits.used).toBeLessThanOrEqual(plan.worstCase);
    expect(credits).toBe(result.credits.used);
    expect(events).toEqual(expect.arrayContaining(["search", "forums", "shortlist", "reviews", "commute", "finalists", "tripadvisor", "maps", "rank"]));
    for (const h of result.ranked) for (const p of [...h.pros, ...h.cons]) if (p.quote) expect(p.source).not.toBeNull();
  }, 30_000);

  it("stops when cancelled", async () => {
    useTempEnv({ MOCK_MODE: "1" });
    const { runPlanner } = await import("@/lib/ai/pipeline");
    const ctrl = new AbortController();
    const s = spec();
    const run = runPlanner({ request: "x", spec: s, plan: planResearch(s, [work], 40), saved: [work] }, () => ctrl.abort(), ctrl.signal);
    await expect(run).rejects.toThrow();
  }, 30_000);
});
