import { z } from "zod";
import { readJson, withCredits } from "@/lib/api";
import { tripadvisorPlace } from "@/lib/serpapi/engines/tripadvisor";

const input = z.object({ placeId: z.string().regex(/^\d+$/) });

export async function POST(req: Request) {
  const raw = await readJson(req);
  return withCredits(req, async (ctx) => ({ details: await tripadvisorPlace(input.parse(raw).placeId, ctx) }));
}
