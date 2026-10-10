import { z } from "zod";
import { readJson, withCredits } from "@/lib/api";
import { findTripadvisorHotel } from "@/lib/serpapi/engines/tripadvisor";

const input = z.object({ name: z.string().min(1).max(160), city: z.string().max(120).default("") });

export async function POST(req: Request) {
  const raw = await readJson(req);
  return withCredits(req, async (ctx) => {
    const { name, city } = input.parse(raw);
    return { place: await findTripadvisorHotel(name, city, ctx) };
  });
}
