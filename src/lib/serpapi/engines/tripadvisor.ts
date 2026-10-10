import { z } from "zod";
import type { LatLng, Review, TripadvisorDetails, TripadvisorPlace } from "@/lib/models";
import { serpapi, type CallContext } from "../client";
import { cleanReviews, reviewId } from "../reviews-util";
import { list, zArr, zCoords, zNum, zObj, zStr } from "../z";

// --- search ------------------------------------------------------------------------

const zSearch = z.looseObject({
  places: zArr(
    z.looseObject({
      place_id: z.union([z.string(), z.number()]).nullish().catch(null),
      title: zStr,
      place_type: zStr,
      rating: zNum,
      reviews: zNum,
      location: zStr,
      link: zStr,
      thumbnail: zStr,
      highlighted_review: zObj({ text: zStr }),
    }),
  ),
});

export function normalizeTripadvisorSearch(raw: unknown): TripadvisorPlace[] {
  return list(zSearch.parse(raw).places)
    .filter((p) => p.place_id != null && p.title)
    .map((p) => ({
      placeId: String(p.place_id),
      title: p.title!,
      type: p.place_type ?? null,
      rating: p.rating ?? null,
      reviewCount: p.reviews ?? null,
      location: p.location ?? null,
      link: p.link ?? null,
      thumbnail: p.thumbnail ?? null,
      highlight: p.highlighted_review?.text ?? null,
    }));
}

/** "h" hotels, "r" restaurants, "A" things to do, "g" destinations, "f" forums, "a" all */
export async function searchTripadvisor(q: string, ssrc: "h" | "r" | "A" | "g" | "f" | "a" = "h", ctx?: CallContext) {
  const { data } = await serpapi("tripadvisor", { q, ssrc }, ctx);
  return normalizeTripadvisorSearch(data);
}

const STOP_WORDS = new Set(["hotel", "hotels", "the", "and", "by", "spa", "resort", "suites", "de", "do", "da", "la", "le", "el"]);

function words(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

function tokens(s: string, ignore: Set<string>): Set<string> {
  return new Set(words(s).filter((t) => !STOP_WORDS.has(t) && !ignore.has(t)));
}

/** Share of the hotel's distinctive name words found in the Tripadvisor title (0..1). City words don't count. */
export function nameSimilarity(hotelName: string, title: string, city = ""): number {
  const ignore = new Set(words(city));
  const a = tokens(hotelName, ignore);
  const b = tokens(title, ignore);
  if (a.size === 0) return 0;
  let hit = 0;
  for (const t of a) if (b.has(t)) hit++;
  return hit / a.size;
}

/** Picks the Tripadvisor listing that is this hotel, or null if none is convincing. */
export function matchTripadvisor(hotelName: string, places: TripadvisorPlace[], city = ""): TripadvisorPlace | null {
  let best: { p: TripadvisorPlace; score: number } | null = null;
  for (const p of places) {
    if (p.type && !/accommodation|hotel|lodging|rental/i.test(p.type)) continue;
    const score = nameSimilarity(hotelName, p.title, city);
    if (!best || score > best.score) best = { p, score };
  }
  return best && best.score >= 0.6 ? best.p : null;
}

export async function findTripadvisorHotel(name: string, city: string, ctx?: CallContext): Promise<TripadvisorPlace | null> {
  return matchTripadvisor(name, await searchTripadvisor(`${name} ${city}`.trim(), "h", ctx), city);
}

// --- place ------------------------------------------------------------------------

const zPlace = z.looseObject({
  place_result: zObj({
    rating: zNum,
    reviews: zNum,
    ranking: zStr,
    award: z.union([z.string(), z.looseObject({ type: zStr, name: zStr })]).nullish().catch(null),
    price_range: zStr,
    price: zStr,
    gps_coordinates: zCoords,
    amenities: zArr(z.union([z.string(), z.looseObject({ name: zStr })])),
    subratings: zArr(z.looseObject({ name: zStr, label: zStr, rating: zNum, value: zNum })),
    ratings: zArr(z.looseObject({ name: zStr, label: zStr, rating: zNum, value: zNum })),
  }),
});

export function normalizeTripadvisorPlace(raw: unknown): TripadvisorDetails & { coords: LatLng | null } {
  const p = zPlace.parse(raw).place_result;
  const award = p?.award;
  return {
    ranking: p?.ranking ?? null,
    rating: p?.rating ?? null,
    reviewCount: p?.reviews ?? null,
    award: typeof award === "string" ? award : (award?.name ?? award?.type ?? null),
    priceRange: p?.price_range ?? p?.price ?? null,
    amenities: list(p?.amenities)
      .map((a) => (typeof a === "string" ? a : (a.name ?? "")))
      .filter(Boolean)
      .slice(0, 24),
    subratings: [...list(p?.subratings), ...list(p?.ratings)]
      .map((s) => ({ label: s.label ?? s.name ?? "", rating: s.rating ?? s.value ?? NaN }))
      .filter((s) => s.label && Number.isFinite(s.rating)),
    coords: p?.gps_coordinates?.latitude != null ? { lat: p.gps_coordinates.latitude, lng: p.gps_coordinates.longitude! } : null,
  };
}

export async function tripadvisorPlace(placeId: string, ctx?: CallContext) {
  const { data } = await serpapi("tripadvisor_place", { place_id: placeId }, ctx);
  return normalizeTripadvisorPlace(data);
}

// --- reviews ----------------------------------------------------------------------

export const TRIP_TYPES = ["Business", "Couples", "Family", "Friends", "Solo"] as const;

const zReviews = z.looseObject({
  reviews: zArr(
    z.looseObject({
      review_id: z.union([z.string(), z.number()]).nullish().catch(null),
      title: zStr,
      snippet: zStr,
      text: zStr,
      rating: zNum,
      date: zStr,
      link: zStr,
      trip_info: zObj({ date: zStr, type: zStr }),
      author: zObj({ username: zStr, display_name: zStr, name: zStr }),
      additional_ratings: zArr(z.looseObject({ label: zStr, rating: zNum })),
    }),
  ),
});

export function normalizeTripadvisorReviews(raw: unknown): Review[] {
  return cleanReviews(
    list(zReviews.parse(raw).reviews).map((x) => ({
      id: x.review_id != null ? `tripadvisor_${x.review_id}` : reviewId("tripadvisor", x.title, x.date, x.snippet?.slice(0, 60)),
      source: "tripadvisor" as const,
      origin: "Tripadvisor",
      rating: x.rating ?? null,
      maxRating: 5,
      title: x.title ?? null,
      text: x.snippet ?? x.text ?? "",
      date: x.date ?? x.trip_info?.date ?? null,
      author: x.author?.display_name ?? x.author?.name ?? x.author?.username ?? null,
      tripType: x.trip_info?.type ?? null,
      subratings: Object.fromEntries(
        list(x.additional_ratings)
          .filter((a) => a.label && a.rating != null)
          .map((a) => [a.label!, a.rating!]),
      ),
      link: x.link ?? null,
    })),
  );
}

export async function tripadvisorReviews(
  opts: { placeId: string; tripTypes?: (typeof TRIP_TYPES)[number][]; offset?: number },
  ctx?: CallContext,
): Promise<Review[]> {
  const { data } = await serpapi(
    "tripadvisor_reviews",
    {
      place_id: opts.placeId,
      type_of_visit: opts.tripTypes?.length ? opts.tripTypes.join(",") : undefined,
      offset: opts.offset || undefined,
    },
    ctx,
  );
  return normalizeTripadvisorReviews(data);
}
