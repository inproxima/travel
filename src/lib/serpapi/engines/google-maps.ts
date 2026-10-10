import { z } from "zod";
import type { LatLng, MapPlace } from "@/lib/models";
import { serpapi, type CallContext } from "../client";
import { list, toLatLng, zArr, zCoords, zNum, zObj, zStr } from "../z";

const zPlace = z.looseObject({
  title: zStr,
  place_id: zStr,
  data_id: zStr,
  gps_coordinates: zCoords,
  address: zStr,
  rating: zNum,
  reviews: zNum,
  type: z.union([z.string(), z.array(z.string())]).nullish().catch(null),
  website: zStr,
  phone: zStr,
  thumbnail: zStr,
});

const zResponse = z.looseObject({
  local_results: zArr(zPlace),
  place_results: zObj(zPlace.shape),
});

function toMapPlace(p: z.infer<typeof zPlace>): MapPlace {
  return {
    title: p.title ?? "Unnamed place",
    placeId: p.place_id ?? null,
    dataId: p.data_id ?? null,
    coords: toLatLng(p.gps_coordinates),
    address: p.address ?? null,
    rating: p.rating ?? null,
    reviewCount: p.reviews ?? null,
    type: Array.isArray(p.type) ? (p.type[0] ?? null) : (p.type ?? null),
    website: p.website ?? null,
    phone: p.phone ?? null,
    thumbnail: p.thumbnail ?? null,
  };
}

export function normalizeMaps(raw: unknown): MapPlace[] {
  const r = zResponse.parse(raw);
  if (r.place_results) return [toMapPlace(r.place_results as z.infer<typeof zPlace>)];
  return list(r.local_results).map(toMapPlace);
}

export type MapsSearch = { q: string; near?: LatLng; zoom?: number; hl?: string; gl?: string };

export async function searchMaps(s: MapsSearch, ctx?: CallContext): Promise<MapPlace[]> {
  const { data } = await serpapi(
    "google_maps",
    {
      q: s.q,
      type: "search",
      ll: s.near ? `@${s.near.lat},${s.near.lng},${s.zoom ?? 15}z` : undefined,
      hl: s.hl,
      gl: s.gl,
    },
    ctx,
  );
  return normalizeMaps(data);
}

/** Best match for an address or a named place: 1 credit. */
export async function geocode(q: string, ctx?: CallContext, hl?: string): Promise<MapPlace | null> {
  const places = await searchMaps({ q, hl }, ctx);
  return places.find((p) => p.coords) ?? null;
}
