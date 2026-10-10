import { z } from "zod";
import type { Directions, LatLng, RouteSummary } from "@/lib/models";
import { serpapi, type CallContext } from "../client";
import { list, zArr, zNum, zStr } from "../z";

/** SerpApi travel_mode codes. */
export const TRAVEL_MODE = { best: 6, driving: 0, twoWheeler: 9, transit: 3, walking: 2, cycling: 1, flight: 4 } as const;

export type Endpoint = { coords?: LatLng | null; address?: string | null; dataId?: string | null; label?: string };

const zRoute = z.looseObject({
  travel_mode: zStr,
  duration: zNum,
  distance: zNum,
  formatted_duration: zStr,
  formatted_distance: zStr,
});

const zResponse = z.looseObject({
  places_info: zArr(z.looseObject({ address: zStr, data_id: zStr })),
  durations: zArr(z.looseObject({ travel_mode: zStr, duration: zNum, formatted_duration: zStr })),
  directions: zArr(zRoute),
});

function endpointParams(prefix: "start" | "end", e: Endpoint) {
  if (e.dataId) return { [`${prefix}_data_id`]: e.dataId };
  if (e.coords) return { [`${prefix}_coords`]: `${e.coords.lat},${e.coords.lng}` };
  if (e.address) return { [`${prefix}_addr`]: e.address };
  throw new Error(`Directions need a ${prefix} address or coordinates.`);
}

const MODE_LABELS: Record<string, string> = {
  driving: "Drive",
  transit: "Transit",
  walking: "Walk",
  cycling: "Bike",
  "two-wheeler": "Motorbike",
  flight: "Flight",
};

export function modeLabel(mode: string): string {
  return MODE_LABELS[mode.toLowerCase()] ?? mode.charAt(0).toUpperCase() + mode.slice(1);
}

export function normalizeDirections(raw: unknown, fromLabel: string, toLabel: string): Directions {
  const r = zResponse.parse(raw);
  const routes = list(r.directions);
  const byMode = new Map<string, RouteSummary>();
  // Routes carry distances; durations[] covers modes Google didn't draw a route for.
  for (const d of routes) {
    const mode = (d.travel_mode ?? "best").toLowerCase();
    if (byMode.has(mode)) continue;
    byMode.set(mode, {
      mode,
      durationMin: d.duration != null ? Math.round(d.duration / 60) : null,
      durationText: d.formatted_duration ?? null,
      distanceKm: d.distance != null ? Math.round(d.distance / 100) / 10 : null,
    });
  }
  for (const d of list(r.durations)) {
    const mode = (d.travel_mode ?? "").toLowerCase();
    if (!mode || byMode.has(mode)) continue;
    byMode.set(mode, {
      mode,
      durationMin: d.duration != null ? Math.round(d.duration / 60) : null,
      durationText: d.formatted_duration ?? null,
      distanceKm: null,
    });
  }
  const modes = [...byMode.values()].sort((a, b) => (a.durationMin ?? Infinity) - (b.durationMin ?? Infinity));
  const places = list(r.places_info);
  return {
    from: fromLabel,
    to: toLabel,
    modes,
    best: routes[0] ? (byMode.get((routes[0].travel_mode ?? "").toLowerCase()) ?? modes[0] ?? null) : (modes[0] ?? null),
    startDataId: places[0]?.data_id ?? null,
    endDataId: places[places.length - 1]?.data_id ?? null,
  };
}

/** Next weekday at 08:30 in the traveller's own clock, as a rough commute time. */
export function weekdayMorningUnix(fromIsoDate: string, utcOffsetHours: number): number {
  const d = new Date(`${fromIsoDate}T08:30:00Z`);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return Math.floor(d.getTime() / 1000) - utcOffsetHours * 3600;
}

export async function directions(
  from: Endpoint,
  to: Endpoint,
  opts: { mode?: keyof typeof TRAVEL_MODE; departAt?: number; hl?: string } = {},
  ctx?: CallContext,
): Promise<Directions> {
  const { data } = await serpapi(
    "google_maps_directions",
    {
      ...endpointParams("start", from),
      ...endpointParams("end", to),
      travel_mode: opts.mode ? TRAVEL_MODE[opts.mode] : undefined,
      time: opts.departAt ? `depart_at:${opts.departAt}` : undefined,
      hl: opts.hl,
    },
    ctx,
  );
  return normalizeDirections(data, from.label ?? from.address ?? "Start", to.label ?? to.address ?? "Destination");
}
