import { z } from "zod";
import { readJson, withCredits } from "@/lib/api";
import { geocode } from "@/lib/serpapi/engines/google-maps";
import { MAPS_REVIEW_SORT, mapsReviews } from "@/lib/serpapi/engines/google-maps-reviews";
import { getSettings } from "@/lib/settings";

const input = z.object({
  dataId: z.string().nullish(),
  placeId: z.string().nullish(),
  /** "Hotel name, city": looked up on Google Maps first when no id is known (1 extra credit). */
  lookup: z.string().max(200).nullish(),
  query: z.string().max(60).nullish(),
  topicId: z.string().nullish(),
  sort: z.enum(MAPS_REVIEW_SORT).optional(),
  nextPageToken: z.string().nullish(),
});

export async function POST(req: Request) {
  const raw = await readJson(req);
  return withCredits(req, async (ctx) => {
    const opts = input.parse(raw);
    const hl = getSettings().language;
    let { dataId, placeId } = opts;
    if (!dataId && !placeId) {
      if (!opts.lookup) throw new Error("Nothing to look up reviews for.");
      const place = await geocode(opts.lookup, ctx, hl);
      dataId = place?.dataId ?? null;
      placeId = place?.placeId ?? null;
      if (!dataId && !placeId) throw new Error(`Couldn't find "${opts.lookup}" on Google Maps.`);
    }
    const page = await mapsReviews({ ...opts, dataId, placeId, hl }, ctx);
    return { ...page, dataId, placeId };
  });
}
