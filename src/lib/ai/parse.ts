import { addDays, nightsBetween } from "@/lib/geo";
import type { SavedPlace } from "@/lib/models";
import { ask, AiError, type Task } from "./llm";
import { mockTripSpec } from "./mock";
import { tripSpecSchema, type TripSpec } from "./schemas";

export type ParsePayload = {
  today: string;
  currency: string;
  savedPlaces: { id: string; label: string; address: string }[];
  request: string;
};

export const parseTask: Task<typeof tripSpecSchema> = {
  name: "trip_spec",
  schema: tripSpecSchema,
  instructions: `
You turn a traveller's request for a place to stay into a precise search plan.
- Dates: use absolute YYYY-MM-DD dates on or after "today". "30 days" or "a month" means 30 nights.
  If the dates are flexible ("sometime in March", "next month"), give up to 3 check-in windows spread
  across that period, each with the requested length, and set flexibleDates to true.
  If no dates are given at all, pick one window starting about 4 weeks from today and say so in assumptions.
- Guests: default to 2 adults unless the request implies otherwise (e.g. "for work", "solo" means 1).
- Budget: only if stated, in the user's currency.
- placesOfInterest: places the stay should be near (an office, a venue, "the old town").
  When the request refers to one of the user's saved places (e.g. "my office" and a saved place "Work"),
  set savedPlaceId to its id and copy its address.
- priorities: what matters to the traveller, most important first, as short keywords.
- Write every assumption you make in assumptions.`,
  mock: mockTripSpec,
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Checks and tidies what the model produced, so the rest of the pipeline can trust it. */
export function normalizeSpec(spec: TripSpec, today: string, saved: SavedPlace[]): TripSpec {
  const windows = spec.dateWindows
    .filter((w) => ISO.test(w.checkIn) && ISO.test(w.checkOut) && w.checkOut > w.checkIn && w.checkIn >= today)
    .map((w) => (nightsBetween(w.checkIn, w.checkOut) > 60 ? { checkIn: w.checkIn, checkOut: addDays(w.checkIn, 60) } : w))
    .slice(0, 3);
  if (windows.length === 0) {
    throw new AiError("I couldn't work out future dates from your request. Add them, e.g. “from March 3 for 30 nights”.");
  }
  const savedIds = new Set(saved.map((p) => p.id));
  const destination = spec.destination.trim();
  if (!destination) throw new AiError("I couldn't tell where you want to stay. Name a city or area.");
  return {
    ...spec,
    destination,
    searchQuery: spec.searchQuery.trim() || destination,
    dateWindows: windows,
    flexibleDates: windows.length > 1 || spec.flexibleDates,
    adults: Math.min(12, Math.max(1, Math.round(spec.adults || 2))),
    childrenAges: spec.childrenAges.map(Math.round).filter((a) => a >= 1 && a <= 17).slice(0, 8),
    budgetPerNight: spec.budgetPerNight && spec.budgetPerNight > 0 ? spec.budgetPerNight : null,
    budgetTotal: spec.budgetTotal && spec.budgetTotal > 0 ? spec.budgetTotal : null,
    minHotelClass: spec.minHotelClass && spec.minHotelClass >= 2 && spec.minHotelClass <= 5 ? Math.round(spec.minHotelClass) : null,
    priorities: spec.priorities.map((p) => p.trim()).filter(Boolean).slice(0, 5),
    reviewKeyword: spec.reviewKeyword?.trim() || null,
    placesOfInterest: spec.placesOfInterest
      .map((p) => ({ ...p, savedPlaceId: p.savedPlaceId && savedIds.has(p.savedPlaceId) ? p.savedPlaceId : null }))
      .filter((p) => p.label.trim() && (p.address.trim() || p.savedPlaceId))
      .slice(0, 3),
    assumptions: spec.assumptions.slice(0, 6),
  };
}

export async function parseRequest(request: string, ctx: { today: string; currency: string; saved: SavedPlace[]; signal?: AbortSignal }): Promise<TripSpec> {
  const payload: ParsePayload = {
    today: ctx.today,
    currency: ctx.currency,
    savedPlaces: ctx.saved.map((p) => ({ id: p.id, label: p.label, address: p.address })),
    request,
  };
  const spec = await ask(parseTask, payload, ctx.signal);
  return normalizeSpec(spec, ctx.today, ctx.saved);
}
