// App-level shapes that the UI and the AI planner work with. Each SerpApi
// engine module normalizes its raw response into these.

export type LatLng = { lat: number; lng: number };

export type SavedPlace = {
  id: string;
  label: string;
  address: string;
  coords: LatLng | null;
};

export type MapPlace = {
  title: string;
  placeId: string | null;
  dataId: string | null;
  coords: LatLng | null;
  address: string | null;
  rating: number | null;
  reviewCount: number | null;
  type: string | null;
  website: string | null;
  phone: string | null;
  thumbnail: string | null;
};

export type ReviewSource = "google" | "google_maps" | "tripadvisor";

export type Review = {
  id: string;
  source: ReviewSource;
  /** Where Google Hotels got the review (e.g. "Google", "Tripadvisor", "Booking.com"). */
  origin: string | null;
  rating: number | null;
  maxRating: number;
  title: string | null;
  text: string;
  date: string | null;
  author: string | null;
  tripType: string | null;
  subratings: Record<string, number>;
  link: string | null;
};

export type ReviewTopic = { id: string | null; label: string; mentions: number | null };

export type RouteSummary = {
  mode: string;
  durationMin: number | null;
  durationText: string | null;
  distanceKm: number | null;
};

export type Directions = {
  from: string;
  to: string;
  /** One entry per travel mode Google offered (drive, transit, walk, bike...). */
  modes: RouteSummary[];
  best: RouteSummary | null;
  startDataId: string | null;
  endDataId: string | null;
};

export type ForumPost = {
  title: string;
  link: string;
  source: string | null;
  snippet: string | null;
  date: string | null;
  meta: string | null;
};
