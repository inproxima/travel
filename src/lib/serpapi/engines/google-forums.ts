import { z } from "zod";
import type { ForumPost } from "@/lib/models";
import { serpapi, type CallContext } from "../client";
import { list, zArr, zStr } from "../z";

const zResponse = z.looseObject({
  organic_results: zArr(
    z.looseObject({ title: zStr, link: zStr, source: zStr, snippet: zStr, date: zStr, displayed_meta: zStr }),
  ),
});

export function normalizeForums(raw: unknown): ForumPost[] {
  return list(zResponse.parse(raw).organic_results)
    .filter((r) => r.title && r.link)
    .map((r) => ({
      title: r.title!,
      link: r.link!,
      source: r.source ?? null,
      snippet: r.snippet ?? null,
      date: r.date ?? null,
      meta: r.displayed_meta ?? null,
    }));
}

/** Posts from Reddit, Tripadvisor forums and other communities. Recency: "y" past year, "m" past month. */
export async function searchForums(q: string, opts: { recency?: "w" | "m" | "y"; hl?: string; gl?: string } = {}, ctx?: CallContext) {
  const { data } = await serpapi(
    "google_forums",
    {
      q,
      period_unit: opts.recency,
      period_value: opts.recency ? 1 : undefined,
      hl: opts.hl,
      gl: opts.gl,
    },
    ctx,
  );
  return normalizeForums(data);
}
