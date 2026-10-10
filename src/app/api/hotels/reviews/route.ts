import { z } from "zod";
import { readJson, withCredits } from "@/lib/api";
import { HOTEL_REVIEW_SORT, hotelReviews, type HotelReviewSort } from "@/lib/serpapi/engines/google-hotels-reviews";
import { getSettings } from "@/lib/settings";

const input = z.object({
  propertyToken: z.string().min(1),
  sort: z.enum(Object.keys(HOTEL_REVIEW_SORT) as [HotelReviewSort, ...HotelReviewSort[]]).optional(),
  categoryToken: z.string().nullish(),
  nextPageToken: z.string().nullish(),
});

export async function POST(req: Request) {
  const raw = await readJson(req);
  return withCredits(req, async (ctx) => hotelReviews({ ...input.parse(raw), hl: getSettings().language }, ctx));
}
