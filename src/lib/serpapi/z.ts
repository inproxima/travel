import { z } from "zod";

// Lenient building blocks for parsing SerpApi responses. Google changes what it
// shows from query to query, so every field is optional and a field with an
// unexpected shape becomes null (or []) instead of failing the whole parse.

export const zNum = z.number().nullish().catch(null);
export const zStr = z.string().nullish().catch(null);
export const zBool = z.boolean().nullish().catch(null);
export const zArr = <T extends z.ZodType>(item: T) => z.array(item.catch(null as never)).nullish().catch(null);
export const zObj = <S extends z.ZodRawShape>(shape: S) => z.looseObject(shape).nullish().catch(null);

export const zCoords = zObj({ latitude: zNum, longitude: zNum });

/** Drops nulls that zArr leaves behind for items it could not parse. */
export function list<T>(items: (T | null | undefined)[] | null | undefined): T[] {
  return (items ?? []).filter((x): x is T => x !== null && x !== undefined);
}

export function toLatLng(c: { latitude?: number | null; longitude?: number | null } | null | undefined) {
  if (c?.latitude == null || c?.longitude == null) return null;
  return { lat: c.latitude, lng: c.longitude };
}
