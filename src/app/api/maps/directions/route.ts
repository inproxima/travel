import { z } from "zod";
import { readJson, withCredits } from "@/lib/api";
import { directions } from "@/lib/serpapi/engines/google-maps-directions";
import { getSettings } from "@/lib/settings";

const endpoint = z.object({
  label: z.string().max(120).optional(),
  address: z.string().max(200).nullish(),
  dataId: z.string().max(120).nullish(),
  coords: z.object({ lat: z.number(), lng: z.number() }).nullish(),
});
const input = z.object({ from: endpoint, to: endpoint, departAt: z.number().int().positive().optional() });

export async function POST(req: Request) {
  const raw = await readJson(req);
  return withCredits(req, async (ctx) => {
    const { from, to, departAt } = input.parse(raw);
    return { directions: await directions(from, to, { departAt, hl: getSettings().language }, ctx) };
  });
}
