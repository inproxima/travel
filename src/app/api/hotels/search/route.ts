import { readJson, withCredits } from "@/lib/api";
import { nightsBetween } from "@/lib/geo";
import { searchHotels, type HotelQuery } from "@/lib/serpapi/engines/google-hotels";
import { getSettings } from "@/lib/settings";

export async function POST(req: Request) {
  const body = (await readJson(req)) as HotelQuery;
  return withCredits(req, async (ctx) => {
    const s = getSettings();
    const query = { currency: s.currency, gl: s.country, hl: s.language, ...body };
    const result = await searchHotels(query, ctx);
    return { ...result, nights: nightsBetween(query.checkIn, query.checkOut), currency: query.currency };
  });
}
