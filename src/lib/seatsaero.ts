import { z } from "zod";
import { env } from "@/lib/env";
import { mockLatency } from "@/lib/fixtures";
import type { AwardCabin, AwardCabinKey, AwardDay, AwardTrip } from "@/lib/models";
import { mockAwardSearch, mockAwardTrips } from "@/lib/mock/awards";
import { cacheGet, cacheKey, cacheSet } from "@/lib/serpapi/cache";
import { list, zArr, zBool, zNum, zStr } from "@/lib/serpapi/z";

// seats.aero Partner API: cached award availability by mileage program.
// Personal use only; needs a seats.aero Pro subscription. 1,000 calls a day.

const BASE = "https://seats.aero/partnerapi";

export class SeatsAeroError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "SeatsAeroError";
  }
}

async function get(path: string, params: Record<string, string>, signal?: AbortSignal): Promise<unknown> {
  const e = env();
  const key = cacheKey({ engine: `seatsaero:${path}`, ...params });
  const hit = cacheGet<unknown>(key);
  if (hit !== undefined) return hit;

  let body: unknown;
  if (e.MOCK_MODE) {
    await mockLatency();
    body = path === "/search" ? mockAwardSearch(params) : mockAwardTrips(path.split("/").pop()!);
  } else {
    if (!e.SEATS_AERO_API_KEY) throw new SeatsAeroError("Add SEATS_AERO_API_KEY to .env for real award seats.");
    const res = await fetch(`${BASE}${path}?${new URLSearchParams(params)}`, {
      headers: { "Partner-Authorization": e.SEATS_AERO_API_KEY, accept: "application/json" },
      signal,
      cache: "no-store",
    });
    body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (body as { message?: string; error?: string }).message ?? (body as { error?: string }).error ?? `HTTP ${res.status}`;
      const hint = res.status === 401 || res.status === 403 ? " Check SEATS_AERO_API_KEY (API access needs a Pro subscription)." : res.status === 429 ? " Daily limit reached (1,000 calls); try again tomorrow." : "";
      throw new SeatsAeroError(`seats.aero: ${msg}.${hint}`, res.status);
    }
  }
  cacheSet(key, "seatsaero", body);
  return body;
}

// --- search ---------------------------------------------------------------------------

const CABIN_NAMES: Record<AwardCabinKey, string> = { Y: "economy", W: "premium", J: "business", F: "first" };

// Per-cabin fields ({Y,W,J,F}Available, ...MileageCost, ...) are read from the loose record below.
const zAvailability = z.looseObject({
  ID: zStr,
  Date: zStr,
  Source: zStr,
  ComputedLastSeen: zStr,
  Route: z.looseObject({ OriginAirport: zStr, DestinationAirport: zStr }).nullish().catch(null),
});

const zSearch = z.looseObject({ data: zArr(zAvailability), hasMore: zBool, cursor: zNum });

/** Mileage costs arrive as strings like "60000"; 0 means not available. */
function miles(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[^\d.]/g, "")) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function normalizeAwards(raw: unknown): AwardDay[] {
  return list(zSearch.parse(raw).data).map((a) => {
    const r = a as Record<string, unknown>;
    const cabins = Object.fromEntries(
      (["Y", "W", "J", "F"] as const).map((c): [AwardCabinKey, AwardCabin] => {
        const m = miles(r[`${c}MileageCost`]);
        const seats = r[`${c}RemainingSeats`];
        const airlines = r[`${c}Airlines`];
        return [
          c,
          {
            available: r[`${c}Available`] === true && m !== null,
            miles: m,
            seats: typeof seats === "number" ? seats : null,
            airlines: typeof airlines === "string" && airlines ? airlines : null,
            direct: r[`${c}Direct`] === true,
          },
        ];
      }),
    ) as Record<AwardCabinKey, AwardCabin>;
    return {
      id: a.ID ?? `${a.Source}-${a.Date}`,
      date: (a.Date ?? "").slice(0, 10),
      source: a.Source ?? "unknown",
      origin: a.Route?.OriginAirport ?? "",
      destination: a.Route?.DestinationAirport ?? "",
      lastSeen: a.ComputedLastSeen ?? null,
      cabins,
    };
  });
}

export type AwardQuery = {
  origin: string;
  destination: string;
  startDate: string;
  endDate: string;
  cabins: AwardCabinKey[];
  sources?: string[];
  directOnly?: boolean;
};

export async function searchAwards(q: AwardQuery, signal?: AbortSignal): Promise<AwardDay[]> {
  const params: Record<string, string> = {
    origin_airport: q.origin,
    destination_airport: q.destination,
    start_date: q.startDate,
    end_date: q.endDate,
    cabins: q.cabins.map((c) => CABIN_NAMES[c]).join(","),
    order_by: "lowest_mileage",
    take: "500",
  };
  if (q.sources?.length) params.sources = q.sources.join(",");
  if (q.directOnly) params.only_direct_flights = "true";
  return normalizeAwards(await get("/search", params, signal));
}

// --- trips -------------------------------------------------------------------------------

const zTrips = z.looseObject({
  data: zArr(
    z.looseObject({
      ID: zStr,
      Cabin: zStr,
      MileageCost: z.union([z.string(), z.number()]).nullish().catch(null),
      TotalTaxes: zNum,
      TaxesCurrency: zStr,
      Stops: zNum,
      TotalDuration: zNum,
      DepartsAt: zStr,
      ArrivesAt: zStr,
      RemainingSeats: zNum,
      Carriers: zStr,
      AvailabilitySegments: zArr(
        z.looseObject({ FlightNumber: zStr, OriginAirport: zStr, DestinationAirport: zStr, DepartsAt: zStr, ArrivesAt: zStr, AircraftName: zStr }),
      ),
    }),
  ),
  booking_links: zArr(z.looseObject({ label: zStr, link: zStr, primary: zBool })),
});

export type AwardTripsResult = { trips: AwardTrip[]; bookingLinks: { label: string; link: string; primary: boolean }[] };

export function normalizeTrips(raw: unknown): AwardTripsResult {
  const r = zTrips.parse(raw);
  return {
    trips: list(r.data).map((t) => ({
      id: t.ID ?? "",
      cabin: t.Cabin ?? null,
      miles: miles(t.MileageCost),
      // seats.aero reports taxes in cents.
      taxes: t.TotalTaxes != null ? t.TotalTaxes / 100 : null,
      taxesCurrency: t.TaxesCurrency ?? null,
      stops: t.Stops ?? null,
      durationMin: t.TotalDuration ?? null,
      departsAt: t.DepartsAt ?? null,
      arrivesAt: t.ArrivesAt ?? null,
      seats: t.RemainingSeats ?? null,
      carriers: t.Carriers ?? null,
      segments: list(t.AvailabilitySegments).map((s) => ({
        flightNumber: s.FlightNumber ?? null,
        from: s.OriginAirport ?? null,
        to: s.DestinationAirport ?? null,
        departsAt: s.DepartsAt ?? null,
        arrivesAt: s.ArrivesAt ?? null,
        aircraft: s.AircraftName ?? null,
      })),
    })),
    bookingLinks: list(r.booking_links)
      .filter((l) => l.link)
      .map((l) => ({ label: l.label ?? "Book", link: l.link!, primary: l.primary ?? false })),
  };
}

export async function awardTrips(id: string, signal?: AbortSignal): Promise<AwardTripsResult> {
  if (!/^[\w-]+$/.test(id)) throw new SeatsAeroError("Invalid award id.");
  return normalizeTrips(await get(`/trips/${id}`, {}, signal));
}
