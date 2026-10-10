import fs from "node:fs/promises";
import path from "node:path";
import { haversineKm, nightsBetween } from "@/lib/geo";
import { loadFixture, requestHash } from "@/lib/fixtures";
import { seeded, shuffle } from "./random";

// Sample responses for `./run.sh mock`. Static fixtures are adapted to the
// request (nights, the property asked about, review filters, the route) so the
// app behaves realistically without spending credits.

type Json = Record<string, unknown>;
type Params = Record<string, string>;

type PoolReview = { rating: number; title: string; text: string; trip: string; topic: string; author: string; date: string; iso: string };

const FIXTURES = () => path.join(process.cwd(), "fixtures", "serpapi");

async function readFixture(engine: string, name: string): Promise<Json> {
  return JSON.parse(await fs.readFile(path.join(FIXTURES(), engine, `${name}.json`), "utf8")) as Json;
}

async function recorded(engine: string, params: Params): Promise<Json | undefined> {
  try {
    const file = path.join(process.cwd(), "fixtures", "recorded", "serpapi", engine, `${requestHash(params)}.json`);
    return JSON.parse(await fs.readFile(file, "utf8")) as Json;
  } catch {
    return undefined;
  }
}

async function pool(): Promise<PoolReview[]> {
  return JSON.parse(await fs.readFile(path.join(FIXTURES(), "_pools", "reviews.json"), "utf8")) as PoolReview[];
}

/** Picks reviews for one place: stable per seed, nudged towards a keyword/topic/trip type. */
function chooseReviews(all: PoolReview[], seed: string, opts: { prefer?: (r: PoolReview) => boolean; sort?: "high" | "low"; n?: number }) {
  const rand = seeded(seed);
  let picked = shuffle(all, rand);
  if (opts.prefer) picked = [...picked.filter(opts.prefer), ...picked.filter((r) => !opts.prefer!(r))];
  picked = picked.slice(0, opts.n ?? 8);
  if (opts.sort === "high") picked.sort((a, b) => b.rating - a.rating);
  if (opts.sort === "low") picked.sort((a, b) => a.rating - b.rating);
  return picked;
}

// --- Google Hotels ------------------------------------------------------------------

type Property = Json & { property_token?: string; name?: string; rate_per_night?: { extracted_lowest?: number }; address?: string; tripadvisor_id?: string | null };

async function allProperties(): Promise<Property[]> {
  const files = await Promise.all(["default", "page2", "rentals"].map((n) => readFixture("google_hotels", n)));
  return files.flatMap((f) => (f.properties as Property[]) ?? []);
}

function withNights(body: Json, p: Params): Json {
  const nights = p.check_in_date && p.check_out_date ? Math.max(1, nightsBetween(p.check_in_date, p.check_out_date)) : 3;
  const properties = ((body.properties as Property[]) ?? []).map((prop) => {
    const nightly = prop.rate_per_night?.extracted_lowest ?? 0;
    return { ...prop, total_rate: { lowest: `$${nightly * nights}`, extracted_lowest: nightly * nights } };
  });
  return { ...body, properties };
}

async function hotelDetails(p: Params): Promise<Json> {
  const prop = (await allProperties()).find((x) => x.property_token === p.property_token);
  const base = await readFixture("google_hotels", "details");
  if (!prop) return base;
  const nightly = prop.rate_per_night?.extracted_lowest ?? 150;
  const nights = p.check_in_date && p.check_out_date ? Math.max(1, nightsBetween(p.check_in_date, p.check_out_date)) : 3;
  const offer = (source: string, factor: number, extra: Json = {}) => {
    const rate = Math.round(nightly * factor);
    return {
      source,
      link: `https://example.com/book/${encodeURIComponent(source)}/${prop.property_token}`,
      rate_per_night: { lowest: `$${rate}`, extracted_lowest: rate },
      total_rate: { lowest: `$${rate * nights}`, extracted_lowest: rate * nights },
      ...extra,
    };
  };
  const tripadvisorLink = prop.tripadvisor_id ? `https://www.tripadvisor.com/Hotel_Review-g189158-d${prop.tripadvisor_id}-Reviews.html` : null;
  return {
    ...base,
    name: prop.name,
    address: prop.address ?? base.address,
    typical_price_range: { extracted_lowest: Math.round(nightly * 0.8), extracted_highest: Math.round(nightly * 1.35) },
    featured_prices: [offer(`${prop.name} (official site)`, 1, { official: true, free_cancellation: true }), offer("Booking.com", 1.03, { free_cancellation: true })],
    prices: [offer("Expedia", 1.06), offer("Hotels.com", 1.07), offer("Agoda", 0.99, { free_cancellation: false }), offer("Trip.com", 1.02)],
    other_reviews: tripadvisorLink
      ? [{ source: "Tripadvisor", source_rating: { score: 4.5, max_score: 5 }, reviews: 1840, user_review: { link: tripadvisorLink }, source_number: 2 }]
      : [],
  };
}

const CATEGORY_NAMES = ["Location", "Service", "Breakfast", "Room", "Cleanliness", "Noise", "Wi-Fi", "Value"];

async function hotelReviews(p: Params): Promise<Json> {
  const base = await readFixture("google_hotels_reviews", "default");
  const category = p.category_token?.match(/^cat_(\d+)_/)?.[1];
  const topic = category ? CATEGORY_NAMES[Number(category)] : undefined;
  const sources = ["Google", "Google", "Tripadvisor", "Booking.com", "Expedia"];
  const reviews = chooseReviews(await pool(), `${p.property_token}|${p.next_page_token ?? ""}`, {
    prefer: topic ? (r) => r.topic === topic : undefined,
    sort: p.sort_by === "3" ? "high" : p.sort_by === "4" ? "low" : undefined,
  }).map((r, i) => ({
    user: { name: r.author },
    source: sources[i % sources.length],
    rating: r.rating,
    best_rating: 5,
    date: r.date,
    snippet: r.text,
    subratings: { rooms: Math.max(1, r.rating - (i % 2)), service: r.rating, location: Math.min(5, r.rating + 1) },
  }));
  return { ...base, reviews, serpapi_pagination: p.next_page_token ? {} : { next_page_token: "sample_next" } };
}

// --- Google Maps reviews ---------------------------------------------------------------

async function mapsReviews(p: Params): Promise<Json> {
  const base = await readFixture("google_maps_reviews", "default");
  const topics = (base.topics as { keyword: string; id: string }[]) ?? [];
  const keyword = (p.query ?? topics.find((t) => t.id === p.topic_id)?.keyword ?? "").toLowerCase();
  const reviews = chooseReviews(await pool(), `${p.data_id ?? p.place_id}|maps|${p.next_page_token ?? ""}`, {
    prefer: keyword ? (r) => `${r.text} ${r.topic}`.toLowerCase().includes(keyword.replace("wifi", "wi-fi")) : undefined,
    sort: p.sort_by === "ratingHigh" ? "high" : p.sort_by === "ratingLow" ? "low" : undefined,
  }).map((r) => ({
    rating: r.rating,
    date: r.date,
    iso_date: `${r.iso}T10:00:00Z`,
    snippet: r.text,
    user: { name: r.author },
    details: { rooms: r.rating, service: Math.min(5, r.rating + 1), location: 5 },
  }));
  return { ...base, reviews };
}

// --- Tripadvisor reviews ---------------------------------------------------------------

async function tripadvisorReviews(p: Params): Promise<Json> {
  const base = await readFixture("tripadvisor_reviews", "default");
  const types = (p.type_of_visit ?? "").split(",").filter(Boolean);
  const reviews = chooseReviews(await pool(), `${p.place_id}|ta|${p.offset ?? ""}`, {
    prefer: types.length ? (r) => types.includes(r.trip) : undefined,
    n: 10,
  }).map((r, i) => ({
    review_id: `${p.place_id}${i}`,
    title: r.title,
    snippet: r.text,
    rating: r.rating,
    date: r.date,
    trip_info: { date: r.iso.slice(0, 7), type: r.trip },
    author: { display_name: r.author },
  }));
  return { ...base, reviews };
}

// --- Google Maps directions ----------------------------------------------------------

const LISBON = { lat: 38.7223, lng: -9.1393 };

function endpoint(p: Params, prefix: "start" | "end", known: Property[]) {
  const coords = p[`${prefix}_coords`];
  if (coords) {
    const [lat, lng] = coords.split(",").map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat: lat!, lng: lng!, label: coords };
  }
  const label = p[`${prefix}_addr`] ?? p[`${prefix}_data_id`] ?? prefix;
  const hotel = known.find((h) => h.name && label.toLowerCase().startsWith(h.name.toLowerCase()));
  const gps = hotel?.gps_coordinates as { latitude?: number; longitude?: number } | undefined;
  if (gps?.latitude != null && gps.longitude != null) return { lat: gps.latitude, lng: gps.longitude, label };
  const r = seeded(label);
  return { lat: LISBON.lat + (r() - 0.5) * 0.05, lng: LISBON.lng + (r() - 0.5) * 0.06, label };
}

const fmt = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} hr ${Math.round(min % 60)} min` : `${Math.max(1, Math.round(min))} min`);

async function directions(p: Params): Promise<Json> {
  const known = await allProperties();
  const a = endpoint(p, "start", known);
  const b = endpoint(p, "end", known);
  const km = haversineKm(a, b) * 1.3;
  const modes = [
    ["Walking", (km / 4.8) * 60],
    ["Transit", 7 + (km / 16) * 60],
    ["Driving", 5 + (km / 24) * 60],
    ["Cycling", (km / 13) * 60],
  ] as const;
  const sorted = [...modes].sort((x, y) => x[1] - y[1]);
  const id = (s: string) => `0xsample:${requestHash([s]).slice(0, 10)}`;
  return {
    search_metadata: { status: "Success", sample: true },
    places_info: [
      { address: a.label, data_id: id(a.label), gps_coordinates: { latitude: a.lat, longitude: a.lng } },
      { address: b.label, data_id: id(b.label), gps_coordinates: { latitude: b.lat, longitude: b.lng } },
    ],
    durations: modes.map(([mode, min]) => ({ travel_mode: mode, duration: Math.round(min * 60), formatted_duration: fmt(min) })),
    directions: sorted.slice(0, 3).map(([mode, min]) => ({
      travel_mode: mode,
      duration: Math.round(min * 60),
      distance: Math.round(km * 1000),
      formatted_duration: fmt(min),
      formatted_distance: `${km.toFixed(1)} km`,
    })),
  };
}

// --- entry ------------------------------------------------------------------------

export async function mockSerpapi(engine: string, params: Params): Promise<Json> {
  const exact = await recorded(engine, params);
  if (exact) return exact;

  switch (engine) {
    case "google_hotels":
      if (params.property_token) return hotelDetails(params);
      return withNights(await readFixture("google_hotels", params.vacation_rentals === "true" ? "rentals" : params.next_page_token ? "page2" : "default"), params);
    case "google_hotels_reviews":
      return hotelReviews(params);
    case "google_maps_reviews":
      return mapsReviews(params);
    case "tripadvisor_reviews":
      return tripadvisorReviews(params);
    case "google_maps_directions":
      return directions(params);
    case "google_flights":
      if (params.booking_token) return (await loadFixture("serpapi", engine, "", "booking")) as Json;
      if (params.departure_token) return (await loadFixture("serpapi", engine, "", "returns")) as Json;
      return (await loadFixture("serpapi", engine, "", `class-${params.travel_class ?? "1"}`)) as Json;
    default:
      return (await loadFixture("serpapi", engine, "")) as Json;
  }
}
