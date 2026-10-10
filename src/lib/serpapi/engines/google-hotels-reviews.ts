import { z } from "zod";
import type { Review } from "@/lib/models";
import { serpapi, type CallContext } from "../client";
import { cleanReviews, reviewId } from "../reviews-util";
import { list, zArr, zNum, zObj, zStr } from "../z";

/** 1 most helpful, 2 most recent, 3 highest score, 4 lowest score */
export const HOTEL_REVIEW_SORT = { helpful: 1, recent: 2, highest: 3, lowest: 4 } as const;
export type HotelReviewSort = keyof typeof HOTEL_REVIEW_SORT;

const zResponse = z.looseObject({
  reviews: zArr(
    z.looseObject({
      user: zObj({ name: zStr, link: zStr }),
      source: zStr,
      rating: zNum,
      best_rating: zNum,
      date: zStr,
      snippet: zStr,
      link: zStr,
      subratings: z.record(z.string(), z.number()).nullish().catch(null),
      hotel_highlights: zArr(z.string()),
    }),
  ),
  serpapi_pagination: zObj({ next_page_token: zStr }),
});

export type ReviewPage = { reviews: Review[]; nextPageToken: string | null };

export function normalizeHotelReviews(raw: unknown): ReviewPage {
  const r = zResponse.parse(raw);
  return {
    reviews: cleanReviews(
      list(r.reviews).map((x) => ({
        id: reviewId("google", x.user?.name, x.date, x.snippet?.slice(0, 60)),
        source: "google" as const,
        origin: x.source ?? "Google",
        rating: x.rating ?? null,
        maxRating: x.best_rating ?? 5,
        title: null,
        text: x.snippet ?? "",
        date: x.date ?? null,
        author: x.user?.name ?? null,
        tripType: null,
        subratings: x.subratings ?? {},
        link: x.link ?? null,
      })),
    ),
    nextPageToken: r.serpapi_pagination?.next_page_token ?? null,
  };
}

export async function hotelReviews(
  opts: { propertyToken: string; sort?: HotelReviewSort; categoryToken?: string | null; nextPageToken?: string | null; hl?: string },
  ctx?: CallContext,
): Promise<ReviewPage> {
  const { data } = await serpapi(
    "google_hotels_reviews",
    {
      property_token: opts.propertyToken,
      sort_by: opts.sort ? HOTEL_REVIEW_SORT[opts.sort] : undefined,
      category_token: opts.categoryToken,
      next_page_token: opts.nextPageToken,
      hl: opts.hl,
    },
    ctx,
  );
  return normalizeHotelReviews(data);
}
