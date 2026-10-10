import type { Directions, ForumPost, Hotel, LatLng, Review, RouteSummary, TripadvisorPlace } from "@/lib/models";
import type { TripSpec } from "./schemas";

export type StayWindow = { checkIn: string; checkOut: string; nights: number; nightly: number | null; total: number | null };

export type Candidate = {
  hotel: Hotel;
  /** Price for every searched date window this hotel appeared in. */
  windows: StayWindow[];
  best: StayWindow | null;
  /** Straight-line km to each place of interest, in spec order. */
  distancesKm: (number | null)[];
};

export type ResolvedPlace = { label: string; address: string; coords: LatLng | null };

export type HotelEvidence = {
  candidate: Candidate;
  shortlistReason: string;
  googleReviews: Review[];
  commute: Directions | null;
  tripadvisor: { place: TripadvisorPlace | null; reviews: Review[] } | null;
  mapsReviews: Review[] | null;
  finalist: boolean;
  finalistReason: string | null;
};

export type PlanStep = { key: string; label: string; credits: number };

export type ResearchPlan = {
  windows: number;
  pageTwo: boolean;
  rentals: boolean;
  geocodes: number;
  forums: number;
  shortlist: number;
  finalists: number;
  directions: boolean;
  tripadvisor: boolean;
  mapsReviews: boolean;
  steps: PlanStep[];
  typical: number;
  worstCase: number;
  cap: number;
};

export type Point = { text: string; quote: string | null; source: "google" | "google_maps" | "tripadvisor" | "forum" | null };

export type RankedHotel = {
  rank: number;
  id: string;
  hotel: Hotel;
  stay: StayWindow | null;
  headline: string;
  scores: { value: number; location: number; reviews: number; fit: number };
  overall: number;
  pros: Point[];
  cons: Point[];
  bestFor: string[];
  caveats: string[];
  commute: RouteSummary[] | null;
  distanceKm: number | null;
  evidence: { google: Review[]; tripadvisor: Review[]; maps: Review[] };
  tripadvisorRating: number | null;
};

export type PlannerResult = {
  id: string;
  createdAt: number;
  request: string;
  spec: TripSpec;
  currency: string;
  places: ResolvedPlace[];
  summary: string;
  ranked: RankedHotel[];
  alsoConsidered: { id: string; name: string; reason: string; nightly: number | null; total: number | null }[];
  forums: ForumPost[];
  candidatesFound: number;
  credits: { used: number; cap: number };
  model: string;
  mock: boolean;
};

export type PlannerEvent =
  | { type: "step"; key: string; label: string; status: "running" | "done" | "skipped"; detail?: string }
  | { type: "credits"; used: number; cap: number }
  | { type: "result"; result: PlannerResult }
  | { type: "error"; message: string };
