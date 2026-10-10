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

export type ReviewCategory = {
  name: string;
  mentions: number | null;
  positive: number | null;
  negative: number | null;
  categoryToken: string | null;
};

export type Hotel = {
  /** property_token when Google gives one; otherwise a stable hash. */
  id: string;
  propertyToken: string | null;
  name: string;
  kind: "hotel" | "vacation rental";
  description: string | null;
  link: string | null;
  coords: LatLng | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  nightly: number | null;
  nightlyBeforeTaxes: number | null;
  total: number | null;
  hotelClass: number | null;
  rating: number | null;
  reviewCount: number | null;
  locationRating: number | null;
  categories: ReviewCategory[];
  amenities: string[];
  images: string[];
  nearby: { name: string; transport: { type: string; duration: string }[] }[];
  deal: string | null;
  freeCancellation: boolean | null;
  sourcePrices: { source: string; nightly: number | null }[];
};

export type HotelOffer = {
  source: string;
  link: string | null;
  logo: string | null;
  nightly: number | null;
  total: number | null;
  freeCancellation: boolean | null;
  official: boolean;
};

export type OtherReviewSource = {
  source: string;
  rating: number | null;
  maxRating: number | null;
  count: number | null;
  link: string | null;
  sourceNumber: number | null;
};

export type HotelDetails = {
  address: string | null;
  phone: string | null;
  typicalRange: { low: number | null; high: number | null } | null;
  offers: HotelOffer[];
  otherReviews: OtherReviewSource[];
  /** Taken from the Tripadvisor review link, when Google lists one. */
  tripadvisorPlaceId: string | null;
};

export type TripadvisorPlace = {
  placeId: string;
  title: string;
  type: string | null;
  rating: number | null;
  reviewCount: number | null;
  location: string | null;
  link: string | null;
  thumbnail: string | null;
  highlight: string | null;
};

export type TripadvisorDetails = {
  ranking: string | null;
  rating: number | null;
  reviewCount: number | null;
  award: string | null;
  priceRange: string | null;
  amenities: string[];
  subratings: { label: string; rating: number }[];
};
