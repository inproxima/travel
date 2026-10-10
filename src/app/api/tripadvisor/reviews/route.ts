import { z } from "zod";
import { readJson, withCredits } from "@/lib/api";
import { TRIP_TYPES, tripadvisorReviews } from "@/lib/serpapi/engines/tripadvisor";

const input = z.object({
  placeId: z.string().regex(/^\d+$/),
  tripTypes: z.array(z.enum(TRIP_TYPES)).default([]),
  offset: z.number().int().min(0).default(0),
});

export async function POST(req: Request) {
  const raw = await readJson(req);
  return withCredits(req, async (ctx) => ({ reviews: await tripadvisorReviews(input.parse(raw), ctx) }));
}
