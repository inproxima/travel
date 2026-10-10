import crypto from "node:crypto";
import { z } from "zod";
import type { Hotel, HotelDetails, HotelOffer, OtherReviewSource } from "@/lib/models";
import { serpapi, type CallContext } from "../client";
import { list, toLatLng, zArr, zBool, zCoords, zNum, zObj, zStr } from "../z";

// --- request -------------------------------------------------------------------

export const HOTEL_SORT = { relevance: undefined, price: 3, rating: 8, reviews: 13 } as const;

export const hotelQuerySchema = z.object({
  q: z.string().trim().min(2).max(120),
  checkIn: z.iso.date(),
  checkOut: z.iso.date(),
  adults: z.number().int().min(1).max(12).default(2),
  childrenAges: z.array(z.number().int().min(1).max(17)).max(8).default([]),
  sort: z.enum(["relevance", "price", "rating", "reviews"]).default("relevance"),
  minPrice: z.number().int().positive().nullish(),
  maxPrice: z.number().int().positive().nullish(),
  /** 7 = 3.5+, 8 = 4.0+, 9 = 4.5+ */
  minRating: z.union([z.literal(7), z.literal(8), z.literal(9)]).nullish(),
  hotelClass: z.array(z.number().int().min(2).max(5)).default([]),
  freeCancellation: z.boolean().default(false),
  vacationRentals: z.boolean().default(false),
  currency: z.string().length(3).default("USD"),
  gl: z.string().length(2).default("us"),
  hl: z.string().min(2).max(8).default("en"),
  nextPageToken: z.string().nullish(),
});
export type HotelQuery = z.input<typeof hotelQuerySchema>;

export function hotelParams(input: HotelQuery) {
  const q = hotelQuerySchema.parse(input);
  if (q.checkOut <= q.checkIn) throw new Error("Check-out must be after check-in.");
  return {
    q: q.q,
    check_in_date: q.checkIn,
    check_out_date: q.checkOut,
    adults: q.adults,
    children: q.childrenAges.length || undefined,
    children_ages: q.childrenAges.length ? q.childrenAges.join(",") : undefined,
    sort_by: HOTEL_SORT[q.sort],
    min_price: q.minPrice,
    max_price: q.maxPrice,
    rating: q.minRating,
    // These filters don't apply to vacation rentals.
    hotel_class: !q.vacationRentals && q.hotelClass.length ? q.hotelClass.join(",") : undefined,
    free_cancellation: !q.vacationRentals && q.freeCancellation ? true : undefined,
    vacation_rentals: q.vacationRentals || undefined,
    currency: q.currency,
    gl: q.gl,
    hl: q.hl,
    next_page_token: q.nextPageToken,
  };
}

// --- response ------------------------------------------------------------------

const zRate = zObj({ extracted_lowest: zNum, extracted_before_taxes_fees: zNum, lowest: zStr });

const zProperty = z.looseObject({
  type: zStr,
  name: zStr,
  description: zStr,
  link: zStr,
  property_token: zStr,
  gps_coordinates: zCoords,
  check_in_time: zStr,
  check_out_time: zStr,
  rate_per_night: zRate,
  total_rate: zRate,
  prices: zArr(z.looseObject({ source: zStr, rate_per_night: zRate })),
  extracted_hotel_class: zNum,
  overall_rating: zNum,
  reviews: zNum,
  location_rating: zNum,
  reviews_breakdown: zArr(
    z.looseObject({ name: zStr, total_mentioned: zNum, positive: zNum, negative: zNum, category_token: zStr }),
  ),
  amenities: zArr(z.string()),
  images: zArr(z.looseObject({ thumbnail: zStr, original_image: zStr })),
  nearby_places: zArr(
    z.looseObject({ name: zStr, transportations: zArr(z.looseObject({ type: zStr, duration: zStr })) }),
  ),
  deal: zStr,
  deal_description: zStr,
  free_cancellation: zBool,
});

const zSearch = z.looseObject({
  properties: zArr(zProperty),
  serpapi_pagination: zObj({ next_page_token: zStr }),
});

/** Google renders "8:00 AM" with a narrow no-break space. */
const cleanTime = (t: string | null | undefined) => (t ? t.replace(/ /g, " ") : null);

function hotelId(p: z.infer<typeof zProperty>): string {
  if (p.property_token) return p.property_token;
  const basis = `${p.name}|${p.gps_coordinates?.latitude}|${p.gps_coordinates?.longitude}`;
  return `h_${crypto.createHash("sha1").update(basis).digest("hex").slice(0, 12)}`;
}

function toHotel(p: z.infer<typeof zProperty>): Hotel {
  const text = [p.deal, p.deal_description, ...(p.amenities ?? [])].join(" ").toLowerCase();
  return {
    id: hotelId(p),
    propertyToken: p.property_token ?? null,
    name: p.name ?? "Unnamed property",
    kind: p.type === "vacation rental" ? "vacation rental" : "hotel",
    description: p.description ?? null,
    link: p.link ?? null,
    coords: toLatLng(p.gps_coordinates),
    checkInTime: cleanTime(p.check_in_time),
    checkOutTime: cleanTime(p.check_out_time),
    nightly: p.rate_per_night?.extracted_lowest ?? null,
    nightlyBeforeTaxes: p.rate_per_night?.extracted_before_taxes_fees ?? null,
    total: p.total_rate?.extracted_lowest ?? null,
    hotelClass: p.extracted_hotel_class ?? null,
    rating: p.overall_rating ?? null,
    reviewCount: p.reviews ?? null,
    locationRating: p.location_rating ?? null,
    categories: list(p.reviews_breakdown).map((c) => ({
      name: c.name ?? "Other",
      mentions: c.total_mentioned ?? null,
      positive: c.positive ?? null,
      negative: c.negative ?? null,
      categoryToken: c.category_token ?? null,
    })),
    amenities: list(p.amenities),
    images: list(p.images)
      .map((i) => i.thumbnail ?? i.original_image)
      .filter((u): u is string => !!u)
      .slice(0, 6),
    nearby: list(p.nearby_places).map((n) => ({
      name: n.name ?? "",
      transport: list(n.transportations).map((t) => ({ type: t.type ?? "", duration: t.duration ?? "" })),
    })),
    deal: p.deal_description ?? p.deal ?? null,
    freeCancellation: p.free_cancellation ?? (text.includes("free cancellation") ? true : null),
    sourcePrices: list(p.prices).map((x) => ({ source: x.source ?? "", nightly: x.rate_per_night?.extracted_lowest ?? null })),
  };
}

export type HotelSearchResult = { hotels: Hotel[]; nextPageToken: string | null };

export function normalizeHotelSearch(raw: unknown): HotelSearchResult {
  const r = zSearch.parse(raw);
  return {
    hotels: list(r.properties).map(toHotel),
    nextPageToken: r.serpapi_pagination?.next_page_token ?? null,
  };
}

const zOffer = z.looseObject({
  source: zStr,
  link: zStr,
  logo: zStr,
  official: zBool,
  free_cancellation: zBool,
  rate_per_night: zRate,
  total_rate: zRate,
});

const zDetails = z.looseObject({
  address: zStr,
  phone: zStr,
  typical_price_range: zObj({ extracted_lowest: zNum, extracted_highest: zNum }),
  featured_prices: zArr(zOffer),
  prices: zArr(zOffer),
  other_reviews: zArr(
    z.looseObject({
      source: zStr,
      source_rating: zObj({ score: zNum, max_score: zNum }),
      reviews: zNum,
      user_review: zObj({ link: zStr }),
      source_number: zNum,
      link: zStr,
    }),
  ),
});

/** Tripadvisor URLs contain "-d<place id>-", e.g. ...Hotel_Review-g189158-d195263-Reviews-... */
export function tripadvisorIdFromUrl(url: string | null | undefined): string | null {
  if (!url || !/tripadvisor\./i.test(url)) return null;
  return url.match(/-d(\d+)(?:-|$)/)?.[1] ?? null;
}

export function normalizeHotelDetails(raw: unknown): HotelDetails {
  const r = zDetails.parse(raw);
  const offers = new Map<string, HotelOffer>();
  for (const o of [...list(r.featured_prices), ...list(r.prices)]) {
    const source = o.source ?? "Unknown";
    if (offers.has(source)) continue;
    offers.set(source, {
      source,
      link: o.link ?? null,
      logo: o.logo ?? null,
      nightly: o.rate_per_night?.extracted_lowest ?? null,
      total: o.total_rate?.extracted_lowest ?? null,
      freeCancellation: o.free_cancellation ?? null,
      official: o.official ?? false,
    });
  }
  const otherReviews: OtherReviewSource[] = list(r.other_reviews).map((o) => ({
    source: o.source ?? "Unknown",
    rating: o.source_rating?.score ?? null,
    maxRating: o.source_rating?.max_score ?? null,
    count: o.reviews ?? null,
    link: o.user_review?.link ?? o.link ?? null,
    sourceNumber: o.source_number ?? null,
  }));
  return {
    address: r.address ?? null,
    phone: r.phone ?? null,
    typicalRange: r.typical_price_range
      ? { low: r.typical_price_range.extracted_lowest ?? null, high: r.typical_price_range.extracted_highest ?? null }
      : null,
    offers: [...offers.values()].sort((a, b) => (a.total ?? a.nightly ?? Infinity) - (b.total ?? b.nightly ?? Infinity)),
    otherReviews,
    tripadvisorPlaceId: otherReviews.map((o) => tripadvisorIdFromUrl(o.link)).find(Boolean) ?? null,
  };
}

// --- calls ----------------------------------------------------------------------

export async function searchHotels(query: HotelQuery, ctx?: CallContext): Promise<HotelSearchResult> {
  const { data } = await serpapi("google_hotels", hotelParams(query), ctx);
  return normalizeHotelSearch(data);
}

/** Booking options for one property. Same query as the search, plus its property_token. */
export async function hotelDetails(query: HotelQuery, propertyToken: string, ctx?: CallContext): Promise<HotelDetails> {
  const { data } = await serpapi(
    "google_hotels",
    { ...hotelParams({ ...query, nextPageToken: null }), property_token: propertyToken },
    ctx,
  );
  return normalizeHotelDetails(data);
}
