import { z } from "zod";
import { readJson, withCredits } from "@/lib/api";
import { searchForums } from "@/lib/serpapi/engines/google-forums";
import { getSettings } from "@/lib/settings";

const input = z.object({ q: z.string().trim().min(2).max(160), recency: z.enum(["w", "m", "y"]).optional() });

export async function POST(req: Request) {
  const raw = await readJson(req);
  return withCredits(req, async (ctx) => {
    const { q, recency } = input.parse(raw);
    const s = getSettings();
    return { posts: await searchForums(q, { recency, hl: s.language, gl: s.country }, ctx) };
  });
}
