import { nightsBetween } from "@/lib/geo";
import type { SavedPlace } from "@/lib/models";
import type { TripSpec } from "./schemas";
import type { PlanStep, ResearchPlan } from "./types";

type Knobs = Omit<ResearchPlan, "steps" | "typical" | "worstCase" | "cap">;

function cost(k: Knobs) {
  const search = k.windows + (k.pageTwo ? 1 : 0) + (k.rentals ? 1 : 0);
  const steps: PlanStep[] = [];
  if (k.geocodes) steps.push({ key: "places", label: `Locate ${k.geocodes} place${k.geocodes > 1 ? "s" : ""} from your request`, credits: k.geocodes });
  steps.push({
    key: "search",
    label: `Search hotels${k.windows > 1 ? ` for ${k.windows} date options` : ""}${k.pageTwo ? " (2 pages)" : ""}${k.rentals ? " + vacation rentals" : ""}`,
    credits: search,
  });
  if (k.forums) steps.push({ key: "forums", label: "Read forum advice on neighbourhoods", credits: k.forums });
  steps.push({ key: "shortlist", label: `AI picks a shortlist of ${k.shortlist}`, credits: 0 });
  steps.push({ key: "reviews", label: `Google reviews for the ${k.shortlist}`, credits: k.shortlist });
  if (k.directions) steps.push({ key: "commute", label: `Travel times from the ${k.shortlist} to your main place`, credits: k.shortlist });
  steps.push({ key: "finalists", label: `AI narrows to ${k.finalists} finalists`, credits: 0 });
  if (k.tripadvisor) steps.push({ key: "tripadvisor", label: `Tripadvisor reviews for the ${k.finalists}`, credits: k.finalists * 2 });
  // Without directions there is no Google Maps id yet, so each hotel needs a lookup first.
  if (k.mapsReviews) steps.push({ key: "maps", label: `Google Maps reviews for the ${k.finalists}`, credits: k.finalists * (k.directions ? 1 : 2) });
  steps.push({ key: "rank", label: "AI ranks the finalists", credits: 0 });
  const total = steps.reduce((s, x) => s + x.credits, 0);
  // Typical runs skip the extra page and cached calls; the worst case is what the cap must cover.
  return { steps, worstCase: total, typical: total - (k.pageTwo ? 1 : 0) };
}

/** Decides how much research a question gets, shrinking it until the worst case fits the cap. */
export function planResearch(spec: TripSpec, saved: SavedPlace[], cap: number): ResearchPlan {
  const savedWithCoords = new Set(saved.filter((p) => p.coords).map((p) => p.id));
  const nights = nightsBetween(spec.dateWindows[0]!.checkIn, spec.dateWindows[0]!.checkOut);
  const k: Knobs = {
    windows: spec.dateWindows.length,
    pageTwo: spec.dateWindows.length === 1,
    rentals: spec.preferVacationRentals || nights >= 14,
    geocodes: Math.min(2, spec.placesOfInterest.filter((p) => !p.savedPlaceId || !savedWithCoords.has(p.savedPlaceId)).length),
    forums: 2,
    shortlist: 8,
    finalists: 4,
    directions: spec.placesOfInterest.length > 0,
    tripadvisor: true,
    mapsReviews: true,
  };

  const shrink: ((k: Knobs) => void)[] = [
    (k) => (k.pageTwo = false),
    (k) => (k.shortlist = 6),
    (k) => (k.mapsReviews = false),
    (k) => (k.finalists = 3),
    (k) => (k.forums = 1),
    (k) => (k.tripadvisor = false),
    (k) => (k.shortlist = 4),
    (k) => (k.rentals = false),
    (k) => (k.forums = 0),
  ];
  let c = cost(k);
  for (const step of shrink) {
    if (c.worstCase <= cap) break;
    step(k);
    c = cost(k);
  }
  if (c.worstCase > cap) {
    throw new Error(`AI_MAX_SERPAPI_CALLS is ${cap}, but even a minimal plan needs ${c.worstCase} credits. Raise it in .env.`);
  }
  return { ...k, ...c, cap };
}
