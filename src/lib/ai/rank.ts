import { ask, type Task } from "./llm";
import { mockFinalists, mockRanking, mockShortlist } from "./mock";
import { pickSchema, rankingSchema, type Picks, type Ranking } from "./schemas";
import type { HotelEvidence, Point, RankedHotel } from "./types";
import { SCORE_WEIGHTS } from "./weights";

export { SCORE_WEIGHTS };

export const shortlistTask: Task<typeof pickSchema> = {
  name: "shortlist",
  schema: pickSchema,
  instructions: `
You are an expert travel planner shortlisting hotels for a traveller.
From "candidates", pick exactly "pick" hotels (or all of them if there are fewer) that best fit the
request: budget, dates, priorities, traveller type and distance to the places of interest.
Prefer a mix of options (e.g. best value, best location, most comfortable) over near-duplicates.
Use forum posts for neighbourhood advice. Return the candidate ids and one-sentence reasons.`,
  mock: mockShortlist,
};

export const finalistsTask: Task<typeof pickSchema> = {
  name: "finalists",
  schema: pickSchema,
  instructions: `
You are an expert travel planner. Each hotel now has guest reviews and, when available, commute times.
Pick exactly "pick" finalists that best fit the request, giving weight to what reviews say about the
traveller's priorities. Return their ids and one-sentence reasons.`,
  mock: mockFinalists,
};

export const rankingTask: Task<typeof rankingSchema> = {
  name: "ranking",
  schema: rankingSchema,
  instructions: `
You are an expert travel planner writing the final recommendation for a traveller.
Rank every hotel in "hotels", best first, for this specific request.
- Scores are 0-10. value: price against budget and what you get. location: commute times and
  neighbourhood. reviews: what guests say, weighted to the traveller's priorities. fit: everything else
  the request asked for.
- Pros and cons: 2-4 each, specific to this traveller. Where you can, support a point with a short
  quote copied exactly, word for word, from that hotel's reviews or from a forum post, and name the source.
  Never invent quotes, prices, distances or facts; use only the data given. If evidence is thin, say so in caveats.
- bestFor: short tags like "Remote work", "Light sleepers", "Families".
- summary: the recommendation and the main trade-off, in 2-3 sentences.`,
  mock: mockRanking,
};

export const askShortlist = (payload: object, signal?: AbortSignal): Promise<Picks> => ask(shortlistTask, payload, signal);
export const askFinalists = (payload: object, signal?: AbortSignal): Promise<Picks> => ask(finalistsTask, payload, signal);
export const askRanking = (payload: object, signal?: AbortSignal): Promise<Ranking> => ask(rankingTask, payload, signal);

/** Keeps the model's picks that are real ids, without repeats, topped up from `fallbackOrder`. */
export function validPicks(picks: Picks, known: string[], n: number, fallbackOrder: string[]): { id: string; reason: string }[] {
  const allowed = new Set(known);
  const out: { id: string; reason: string }[] = [];
  for (const p of picks.picks) {
    if (allowed.has(p.id) && !out.some((o) => o.id === p.id)) out.push(p);
    if (out.length === n) return out;
  }
  for (const id of fallbackOrder) {
    if (out.length === n) break;
    if (allowed.has(id) && !out.some((o) => o.id === id)) out.push({ id, reason: "Strong rating and price for your dates." });
  }
  return out;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** A quote survives only if it appears word for word in the evidence. */
export function verifyQuote(quote: string | null, corpus: string): string | null {
  if (!quote) return null;
  const q = norm(quote).replace(/^["']|["']$/g, "");
  if (q.length < 8) return null;
  return norm(corpus).includes(q) ? quote.trim().replace(/^["“]|["”]$/g, "") : null;
}


const clamp = (n: number) => Math.min(10, Math.max(0, Number.isFinite(n) ? n : 0));

export function overallScore(s: { value: number; location: number; reviews: number; fit: number }): number {
  const o = s.value * SCORE_WEIGHTS.value + s.location * SCORE_WEIGHTS.location + s.reviews * SCORE_WEIGHTS.reviews + s.fit * SCORE_WEIGHTS.fit;
  return Math.round(o * 10) / 10;
}

function corpusFor(e: HotelEvidence, forumText: string): string {
  return [
    ...e.googleReviews.map((r) => `${r.title ?? ""} ${r.text}`),
    ...(e.tripadvisor?.reviews ?? []).map((r) => `${r.title ?? ""} ${r.text}`),
    ...(e.mapsReviews ?? []).map((r) => r.text),
    forumText,
  ].join("\n");
}

/**
 * Turns the model's ranking into what the app shows. Code, not the model, decides
 * which hotels exist, the prices and distances, the overall score and the order,
 * and drops any quote that isn't in the evidence.
 */
export function finalizeRanking(ranking: Ranking, finalists: HotelEvidence[], forumText: string): RankedHotel[] {
  const byId = new Map(finalists.map((e) => [e.candidate.hotel.id, e]));
  const seen = new Set<string>();
  const out: RankedHotel[] = [];

  for (const r of ranking.ranking) {
    const e = byId.get(r.id);
    if (!e || seen.has(r.id)) continue;
    seen.add(r.id);
    const corpus = corpusFor(e, forumText);
    const points = (list: Point[]) =>
      list.slice(0, 4).map((p) => {
        const quote = verifyQuote(p.quote, corpus);
        return { text: p.text, quote, source: quote ? p.source : null };
      });
    const scores = { value: clamp(r.scores.value), location: clamp(r.scores.location), reviews: clamp(r.scores.reviews), fit: clamp(r.scores.fit) };
    out.push(toRanked(e, { headline: r.headline, scores, pros: points(r.pros), cons: points(r.cons), bestFor: r.bestFor.slice(0, 4), caveats: r.caveats.slice(0, 3) }));
  }

  // Finalists the model left out still appear, after the ones it ranked.
  for (const e of finalists) {
    if (seen.has(e.candidate.hotel.id)) continue;
    out.push(toRanked(e, { headline: "Not ranked by the AI", scores: { value: 5, location: 5, reviews: 5, fit: 5 }, pros: [], cons: [], bestFor: [], caveats: ["The AI didn't rank this option."] }));
  }

  return out
    .map((h, i) => ({ h, i }))
    .sort((a, b) => b.h.overall - a.h.overall || a.i - b.i)
    .map(({ h }, i) => ({ ...h, rank: i + 1 }));
}

function toRanked(
  e: HotelEvidence,
  r: { headline: string; scores: RankedHotel["scores"]; pros: Point[]; cons: Point[]; bestFor: string[]; caveats: string[] },
): RankedHotel {
  const c = e.candidate;
  return {
    rank: 0,
    id: c.hotel.id,
    hotel: c.hotel,
    stay: c.best,
    headline: r.headline,
    scores: r.scores,
    overall: overallScore(r.scores),
    pros: r.pros,
    cons: r.cons,
    bestFor: r.bestFor,
    caveats: r.caveats,
    commute: e.commute?.modes ?? null,
    distanceKm: c.distancesKm[0] ?? null,
    evidence: { google: e.googleReviews, tripadvisor: e.tripadvisor?.reviews ?? [], maps: e.mapsReviews ?? [] },
    tripadvisorRating: e.tripadvisor?.place?.rating ?? null,
  };
}
