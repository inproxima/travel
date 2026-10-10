import { z } from "zod";
import { readJson, withCredits } from "@/lib/api";
import type { Cabin } from "@/lib/models";
import { BudgetExceededError } from "@/lib/serpapi/budget";
import { searchFlights, type FlightQuery, type FlightSearchResult } from "@/lib/serpapi/engines/google-flights";
import { getSettings } from "@/lib/settings";

const input = z.object({
  query: z.record(z.string(), z.unknown()),
  cabins: z.array(z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])).min(1).max(4),
});

type CabinResult = (FlightSearchResult & { error?: undefined }) | { error: string; itineraries: []; insights: null };

/** One Google Flights search per cabin, in parallel. A cabin that fails doesn't sink the others. */
export async function POST(req: Request) {
  const raw = await readJson(req);
  return withCredits(req, async (ctx) => {
    const { query, cabins } = input.parse(raw);
    const s = getSettings();
    const q = { currency: s.currency, gl: s.country, hl: s.language, ...(query as FlightQuery) };
    const results = await Promise.all(
      [...new Set(cabins)].map(async (cabin): Promise<[Cabin, CabinResult]> => {
        try {
          return [cabin, await searchFlights(q, cabin, ctx)];
        } catch (err) {
          if (err instanceof Error && (err.name === "AbortError" || err instanceof BudgetExceededError || err.name === "ZodError")) throw err;
          return [cabin, { error: (err as Error).message, itineraries: [], insights: null }];
        }
      }),
    );
    return { cabins: Object.fromEntries(results), currency: q.currency };
  });
}
