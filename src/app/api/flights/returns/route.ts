import { z } from "zod";
import { readJson, withCredits } from "@/lib/api";
import { returnFlights, type FlightQuery } from "@/lib/serpapi/engines/google-flights";
import { getSettings } from "@/lib/settings";

const input = z.object({
  query: z.record(z.string(), z.unknown()),
  cabin: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  departureToken: z.string().min(1),
});

export async function POST(req: Request) {
  const raw = await readJson(req);
  return withCredits(req, async (ctx) => {
    const { query, cabin, departureToken } = input.parse(raw);
    const s = getSettings();
    return returnFlights({ currency: s.currency, gl: s.country, hl: s.language, ...(query as FlightQuery) }, cabin, departureToken, ctx);
  });
}
