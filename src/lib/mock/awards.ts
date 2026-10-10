import { airportCoords } from "@/lib/airports";
import { addDays, haversineKm } from "@/lib/geo";
import { seeded } from "./random";

// Sample seats.aero responses for mock mode: plausible award prices by
// distance, program and cabin, stable for a given route and date.

type Json = Record<string, unknown>;

const PROGRAMS: { source: string; carriers: string; factor: number; dynamic: boolean; first: boolean; taxes: number }[] = [
  { source: "aeroplan", carriers: "AC, TP, LH", factor: 1, dynamic: false, first: false, taxes: 110 },
  { source: "united", carriers: "UA, TP, LH", factor: 1.15, dynamic: true, first: false, taxes: 6 },
  { source: "american", carriers: "AA, BA, IB", factor: 0.95, dynamic: true, first: true, taxes: 90 },
  { source: "alaska", carriers: "AA, BA", factor: 0.9, dynamic: false, first: true, taxes: 60 },
  { source: "flyingblue", carriers: "AF, KL, DL", factor: 1, dynamic: true, first: false, taxes: 190 },
  { source: "virginatlantic", carriers: "VS, DL, AF", factor: 0.85, dynamic: false, first: false, taxes: 520 },
  { source: "delta", carriers: "DL, AF, KL", factor: 2.1, dynamic: true, first: false, taxes: 6 },
  { source: "turkish", carriers: "TK, UA", factor: 0.75, dynamic: false, first: false, taxes: 140 },
  { source: "emirates", carriers: "EK", factor: 1.4, dynamic: true, first: true, taxes: 420 },
  { source: "qatar", carriers: "QR, BA, AA", factor: 1.2, dynamic: false, first: true, taxes: 230 },
];

const BASE: Record<string, [number, number, number]> = {
  // [short, medium, long] one-way saver prices
  Y: [12_500, 30_000, 45_000],
  W: [20_000, 45_000, 65_000],
  J: [25_000, 60_000, 85_000],
  F: [35_000, 90_000, 120_000],
};
const ODDS: Record<string, number> = { Y: 0.85, W: 0.4, J: 0.5, F: 0.25 };
const CABIN_KEY: Record<string, string> = { economy: "Y", premium: "W", business: "J", first: "F" };

function band(km: number) {
  return km < 3000 ? 0 : km < 7500 ? 1 : 2;
}

export function mockAwardSearch(p: Record<string, string>): Json {
  const origin = (p.origin_airport ?? "JFK").split(",")[0]!;
  const destination = (p.destination_airport ?? "LHR").split(",")[0]!;
  const a = airportCoords(origin);
  const b = airportCoords(destination);
  const km = a && b ? haversineKm(a, b) : 5000;
  const wanted = new Set((p.cabins ?? "economy,premium,business,first").split(",").map((c) => CABIN_KEY[c]).filter(Boolean));
  const sources = p.sources ? new Set(p.sources.split(",")) : null;
  const start = p.start_date ?? addDays(new Date().toISOString().slice(0, 10), 30);
  const end = p.end_date ?? start;
  const data: Json[] = [];

  for (let d = start, i = 0; d <= end && i < 15; d = addDays(d, 1), i++) {
    for (const prog of PROGRAMS) {
      if (sources && !sources.has(prog.source)) continue;
      const rand = seeded(`${prog.source}-${origin}-${destination}-${d}`);
      const row: Json = {
        ID: `sample-${prog.source}-${d}-${origin}-${destination}`,
        Date: d,
        Source: prog.source,
        ComputedLastSeen: new Date(Date.now() - Math.floor(rand() * 20) * 3_600_000).toISOString(),
        Route: { OriginAirport: origin, DestinationAirport: destination },
      };
      let any = false;
      for (const c of ["Y", "W", "J", "F"]) {
        // Draw every random number up front so a cabin filter doesn't change the other cabins.
        const [roll, dyn1, dyn2, seatsR, carrierR, directR, filterR] = Array.from({ length: 7 }, rand);
        const ok = wanted.has(c) && (c !== "F" || prog.first) && roll! < ODDS[c]! && !(p.only_direct_flights === "true" && filterR! < 0.5);
        const base = BASE[c]![band(km)]! * prog.factor;
        const price = Math.round((base * (prog.dynamic ? 1 + dyn1! * dyn2! * 1.6 : 1)) / 500) * 500;
        const carriers = prog.carriers.split(", ");
        row[`${c}Available`] = ok;
        row[`${c}MileageCost`] = ok ? String(price) : "0";
        row[`${c}RemainingSeats`] = ok ? 1 + Math.floor(seatsR! * 6) : 0;
        row[`${c}Airlines`] = ok ? carriers[Math.floor(carrierR! * carriers.length)] : "";
        row[`${c}Direct`] = ok && (directR! < 0.55 || p.only_direct_flights === "true");
        any ||= ok;
      }
      if (any) data.push(row);
    }
  }
  return { data, count: data.length, hasMore: false, cursor: 0 };
}

export function mockAwardTrips(id: string): Json {
  const [, source, date, origin, destination] = id.match(/^sample-(\w+)-(\d{4}-\d{2}-\d{2})-([A-Z]{3})-([A-Z]{3})$/) ?? [];
  if (!source) return { data: [], booking_links: [] };
  const search = mockAwardSearch({ origin_airport: origin!, destination_airport: destination!, start_date: date!, end_date: date!, sources: source });
  const row = ((search.data as Json[])[0] ?? {}) as Record<string, unknown>;
  const prog = PROGRAMS.find((x) => x.source === source)!;
  const rand = seeded(id);
  const trips = ["Y", "W", "J", "F"]
    .filter((c) => row[`${c}Available`])
    .map((c) => {
      const direct = Boolean(row[`${c}Direct`]);
      const carrier = String(row[`${c}Airlines`] ?? "XX");
      const dep = `${date}T${String(8 + Math.floor(rand() * 12)).padStart(2, "0")}:${rand() < 0.5 ? "05" : "40"}:00Z`;
      const legs = direct ? [[origin, destination]] : [[origin, "LHR"], ["LHR", destination]];
      return {
        ID: `${id}-${c}`,
        Cabin: { Y: "economy", W: "premium", J: "business", F: "first" }[c],
        MileageCost: Number(row[`${c}MileageCost`]),
        TotalTaxes: Math.round(prog.taxes * (c === "Y" ? 0.5 : 1) * 100),
        TaxesCurrency: "USD",
        Stops: legs.length - 1,
        TotalDuration: 400 + Math.floor(rand() * 300),
        DepartsAt: dep,
        ArrivesAt: dep,
        RemainingSeats: row[`${c}RemainingSeats`],
        Carriers: carrier,
        AvailabilitySegments: legs.map(([from, to], k) => ({ FlightNumber: `${carrier}${100 + Math.floor(rand() * 800)}`, OriginAirport: from, DestinationAirport: to, DepartsAt: dep, ArrivesAt: dep, AircraftName: k ? "Airbus A321neo" : "Boeing 787-9" })),
      };
    });
  return { data: trips, booking_links: [{ label: `Book on ${source}`, link: `https://example.com/award/${source}`, primary: true }] };
}
