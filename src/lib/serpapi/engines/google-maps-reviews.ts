import { z } from "zod";
import type { Review, ReviewTopic } from "@/lib/models";
import { serpapi, type CallContext } from "../client";
import { cleanReviews, reviewId } from "../reviews-util";
import { list, zArr, zNum, zObj, zStr } from "../z";

export const MAPS_REVIEW_SORT = ["qualityScore", "newestFirst", "ratingHigh", "ratingLow"] as const;

const zResponse = z.looseObject({
  place_info: zObj({ title: zStr, address: zStr, rating: zNum, reviews: zNum }),
  topics: zArr(z.looseObject({ keyword: zStr, mentions: zNum, id: zStr })),
  reviews: zArr(
    z.looseObject({
      rating: zNum,
      date: zStr,
      iso_date: zStr,
      snippet: zStr,
      extracted_snippet: zObj({ original: zStr, translated: zStr }),
      link: zStr,
      user: zObj({ name: zStr }),
      details: z.record(z.string(), z.unknown()).nullish().catch(null),
    }),
  ),
  serpapi_pagination: zObj({ next_page_token: zStr }),
});

export type MapsReviewPage = {
  placeTitle: string | null;
  rating: number | null;
  reviewCount: number | null;
  topics: ReviewTopic[];
  reviews: Review[];
  nextPageToken: string | null;
};

/** Per-aspect scores like { rooms: 5, service: 4 }; non-numeric details are skipped. */
function numericDetails(d: Record<string, unknown> | null | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(d ?? {})) {
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    if (Number.isFinite(n) && n >= 1 && n <= 5) out[k] = n;
  }
  return out;
}

export function normalizeMapsReviews(raw: unknown): MapsReviewPage {
  const r = zResponse.parse(raw);
  return {
    placeTitle: r.place_info?.title ?? null,
    rating: r.place_info?.rating ?? null,
    reviewCount: r.place_info?.reviews ?? null,
    topics: list(r.topics).map((t) => ({ id: t.id ?? null, label: t.keyword ?? "", mentions: t.mentions ?? null })),
    reviews: cleanReviews(
      list(r.reviews).map((x) => ({
        id: reviewId("google_maps", x.user?.name, x.iso_date ?? x.date, x.snippet?.slice(0, 60)),
        source: "google_maps" as const,
        origin: "Google Maps",
        rating: x.rating ?? null,
        maxRating: 5,
        title: null,
        text: x.extracted_snippet?.translated ?? x.snippet ?? x.extracted_snippet?.original ?? "",
        date: x.date ?? null,
        author: x.user?.name ?? null,
        tripType: null,
        subratings: numericDetails(x.details),
        link: x.link ?? null,
      })),
    ),
    nextPageToken: r.serpapi_pagination?.next_page_token ?? null,
  };
}

export async function mapsReviews(
  opts: {
    dataId?: string | null;
    placeId?: string | null;
    query?: string | null;
    topicId?: string | null;
    sort?: (typeof MAPS_REVIEW_SORT)[number];
    nextPageToken?: string | null;
    hl?: string;
  },
  ctx?: CallContext,
): Promise<MapsReviewPage> {
  if (!opts.dataId && !opts.placeId) throw new Error("A Google Maps data_id or place_id is needed for reviews.");
  const { data } = await serpapi(
    "google_maps_reviews",
    {
      data_id: opts.dataId,
      place_id: opts.dataId ? undefined : opts.placeId,
      // The API takes either a keyword query or a topic, not both.
      query: opts.topicId ? undefined : opts.query,
      topic_id: opts.topicId,
      sort_by: opts.sort,
      next_page_token: opts.nextPageToken,
      hl: opts.hl,
    },
    ctx,
  );
  return normalizeMapsReviews(data);
}
