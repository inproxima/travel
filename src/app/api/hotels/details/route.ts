import { z } from "zod";
import { readJson, withCredits } from "@/lib/api";
import { hotelDetails, type HotelQuery } from "@/lib/serpapi/engines/google-hotels";
import { getSettings } from "@/lib/settings";

const input = z.object({ query: z.record(z.string(), z.unknown()), propertyToken: z.string().min(1) });

export async function POST(req: Request) {
  const raw = await readJson(req);
  return withCredits(req, async (ctx) => {
    const { query, propertyToken } = input.parse(raw);
    const s = getSettings();
    const details = await hotelDetails({ currency: s.currency, gl: s.country, hl: s.language, ...(query as HotelQuery) }, propertyToken, ctx);
    return { details };
  });
}
