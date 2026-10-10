import { z } from "zod";
import { readJson, withCredits } from "@/lib/api";
import { airportCoords } from "@/lib/airports";
import { searchDeals, type DealQuery } from "@/lib/serpapi/engines/google-flights-deals";
import { getSettings } from "@/lib/settings";

const input = z.object({ query: z.record(z.string(), z.unknown()), cabin: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).default(1) });

export async function POST(req: Request) {
  const raw = await readJson(req);
  return withCredits(req, async (ctx) => {
    const { query, cabin } = input.parse(raw);
    const s = getSettings();
    const q = { currency: s.currency, gl: s.country, hl: s.language, ...(query as DealQuery) };
    const origin = typeof q.from === "string" ? airportCoords(q.from.split(",")[0]!) : null;
    return { deals: await searchDeals(q, cabin, ctx), currency: s.currency, origin };
  });
}
