import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, readJson } from "@/lib/api";
import { parseRequest } from "@/lib/ai/parse";
import { planResearch } from "@/lib/ai/plan";
import { env } from "@/lib/env";
import { getSettings, listPlaces } from "@/lib/settings";

const input = z.object({ request: z.string().trim().min(8, "Describe your stay in a few more words.").max(1500) });

/** Step 1: understand the request and show what the research will cost. Uses no SerpApi credits. */
export async function POST(req: Request) {
  try {
    const { request } = input.parse(await readJson(req));
    const saved = listPlaces();
    const today = new Date().toISOString().slice(0, 10);
    const spec = await parseRequest(request, { today, currency: getSettings().currency, saved, signal: req.signal });
    const plan = planResearch(spec, saved, env().AI_MAX_SERPAPI_CALLS);
    return NextResponse.json({ spec, plan });
  } catch (err) {
    return errorResponse(err);
  }
}
