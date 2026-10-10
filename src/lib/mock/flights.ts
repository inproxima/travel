import { airportCity, airportCoords } from "@/lib/airports";
import { haversineKm } from "@/lib/geo";
import { seeded } from "./random";

// Sample Google Flights responses for mock mode, generated from the requested
// route so any pair of airports looks plausible. Shapes follow SerpApi's docs.

type Json = Record<string, unknown>;
type Params = Record<string, string>;

const AIRLINES = [
  ["TAP Air Portugal", "TP"],
  ["Delta", "DL"],
  ["United", "UA"],
  ["American", "AA"],
  ["British Airways", "BA"],
  ["Lufthansa", "LH"],
  ["Air France", "AF"],
  ["KLM", "KL"],
  ["Iberia", "IB"],
  ["Turkish Airlines", "TK"],
  ["Emirates", "EK"],
  ["Qatar Airways", "QR"],
] as const;
const HUBS = ["LHR", "CDG", "FRA", "AMS", "MAD", "IST", "DXB", "JFK", "ORD", "ATL", "DOH", "ZRH"];
const CABIN_MULT: Record<string, number> = { "1": 1, "2": 1.75, "3": 4.3, "4": 7.2 };
const CABIN_NAME: Record<string, string> = { "1": "Economy", "2": "Premium economy", "3": "Business", "4": "First" };
const PLANES = ["Airbus A321neo", "Boeing 787-9", "Airbus A330-900", "Boeing 777-300ER", "Airbus A350-900"];

const first = (codes: string | undefined, fallback: string) => (codes ?? fallback).split(",")[0]!.trim().toUpperCase();

function fmtTime(date: string, minutesFromMidnight: number): { iso: string; date: string } {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMinutes(minutesFromMidnight);
  const iso = d.toISOString();
  return { iso: `${iso.slice(0, 10)} ${iso.slice(11, 16)}`, date: iso.slice(0, 10) };
}

function legMinutes(a: string, b: string): number {
  const pa = airportCoords(a);
  const pb = airportCoords(b);
  const km = pa && pb ? haversineKm(pa, pb) : 2500;
  return Math.round(40 + (km / 820) * 60);
}

function itinerary(from: string, to: string, date: string, cls: string, rand: () => number, i: number, addOn = 0) {
  const direct = legMinutes(from, to);
  const pa = airportCoords(from);
  const pb = airportCoords(to);
  const km = pa && pb ? haversineKm(pa, pb) : 2500;
  const nonstop = i % 3 === 0 || km < 1200;
  const hub = HUBS.filter((h) => h !== from && h !== to)[Math.floor(rand() * 8)]!;
  const [airline, codePrefix] = AIRLINES[Math.floor(rand() * AIRLINES.length)]!;
  const legs = nonstop ? [[from, to]] : [[from, hub], [hub, to]];
  let clock = 6 * 60 + Math.floor(rand() * 15) * 60 + (i % 4) * 15;
  const flights = [];
  const layovers = [];
  for (const [k, [a, b]] of legs.entries()) {
    const dur = legMinutes(a!, b!);
    const dep = fmtTime(date, clock);
    const arr = fmtTime(date, clock + dur);
    flights.push({
      departure_airport: { name: `${airportCity(a!) ?? a} Airport`, id: a, time: dep.iso },
      arrival_airport: { name: `${airportCity(b!) ?? b} Airport`, id: b, time: arr.iso },
      duration: dur,
      airplane: PLANES[(i + k) % PLANES.length],
      airline,
      airline_logo: null,
      travel_class: CABIN_NAME[cls],
      flight_number: `${codePrefix} ${100 + Math.floor(rand() * 899)}`,
      legroom: cls === "1" ? "30 in" : cls === "2" ? "38 in" : "Lie-flat seat",
      extensions: cls === "3" || cls === "4" ? ["Lie-flat seat", "Wi-Fi for a fee", "On-demand video"] : ["Average legroom (30 in)", "In-seat power & USB outlets"],
      overnight: arr.date !== date,
    });
    clock += dur;
    if (k < legs.length - 1) {
      const wait = 55 + Math.floor(rand() * 150);
      layovers.push({ duration: wait, name: `${airportCity(b!) ?? b} Airport`, id: b, overnight: false });
      clock += wait;
    }
  }
  const total = flights.reduce((s, f) => s + f.duration, 0) + layovers.reduce((s, l) => s + l.duration, 0);
  const base = 70 + km * 0.085;
  // Return options are priced as the round-trip total, like Google shows them.
  const price = Math.round(base * CABIN_MULT[cls]! * (nonstop ? 1.12 : 0.92) * (0.85 + rand() * 0.4) * (addOn ? 0.45 : 1) + addOn);
  const typicalCo2 = Math.round(km * 95 * (cls === "1" ? 1 : cls === "2" ? 1.5 : 3));
  const co2 = Math.round(typicalCo2 * (0.85 + rand() * 0.35));
  return {
    flights,
    layovers: layovers.length ? layovers : undefined,
    total_duration: total + (direct % 7),
    price,
    type: "One way",
    airline_logo: null,
    carbon_emissions: { this_flight: co2, typical_for_this_route: typicalCo2, difference_percent: Math.round((co2 / typicalCo2 - 1) * 100) },
    departure_token: `sample_dep_${from}_${to}_${cls}_${i}_${price}`,
    booking_token: `sample_book_${from}_${to}_${cls}_${i}_${price}`,
  };
}

function history(lowest: number, rand: () => number) {
  const now = Math.floor(Date.now() / 1000);
  return Array.from({ length: 60 }, (_, d) => [now - (60 - d) * 86400, Math.round(lowest * (1.05 + Math.sin(d / 6) * 0.08 + rand() * 0.06))]);
}

export function mockFlights(p: Params): Json {
  const cls = p.travel_class ?? "1";
  const returning = Boolean(p.departure_token);
  const from = returning ? first(p.arrival_id, "LHR") : first(p.departure_id, "JFK");
  const to = returning ? first(p.departure_id, "JFK") : first(p.arrival_id, "LHR");
  const date = returning ? (p.return_date ?? p.outbound_date ?? "2026-12-01") : (p.outbound_date ?? "2026-12-01");
  const rand = seeded(`${from}-${to}-${date}-${cls}-${returning}`);

  if (p.booking_token) {
    // The sample booking token ends with the itinerary's price.
    const base = Number(p.booking_token.split("_").pop()) || 400;
    const sellers = [
      ["TAP Air Portugal", true],
      ["Expedia", false],
      ["Kiwi.com", false],
      ["Trip.com", false],
    ] as const;
    return {
      search_metadata: { status: "Success", sample: true },
      booking_options: sellers.map(([seller, airline], k) => ({
        together: {
          book_with: seller,
          airline,
          price: Math.round(base * (1 + k * 0.025)),
          option_title: k === 0 ? CABIN_NAME[cls] : null,
          extensions: k === 0 ? ["1 free carry-on", "Seat selection for a fee"] : [],
          booking_request: { url: "https://www.google.com/travel/clk/f", post_data: `u=sample_${seller.replace(/\W/g, "")}` },
        },
      })),
    };
  }

  const outboundPrice = returning ? Number(p.departure_token!.split("_").pop()) || 0 : 0;
  const items = Array.from({ length: 9 }, (_, i) => itinerary(from, to, date, cls, rand, i, outboundPrice)).sort((a, b) => a.price - b.price);
  if (p.stops === "1") items.splice(0, items.length, ...items.filter((x) => x.flights.length === 1));
  const lowest = items[0]?.price ?? 500;
  return {
    search_metadata: { status: "Success", sample: true },
    best_flights: items.slice(0, 3),
    other_flights: items.slice(3),
    price_insights: returning
      ? undefined
      : {
          lowest_price: lowest,
          price_level: rand() > 0.5 ? "low" : "typical",
          typical_price_range: [Math.round(lowest * 0.95), Math.round(lowest * 1.35)],
          price_history: history(lowest, rand),
        },
  };
}

const DEAL_DESTINATIONS = ["LIS", "BCN", "FCO", "CDG", "LHR", "DUB", "AMS", "ATH", "KEF", "MEX", "CUN", "SJU", "NRT", "BOG", "LIM", "MAD", "OPO", "IST"];

export function mockDeals(p: Params): Json {
  const from = first(p.departure_id, "JFK");
  const rand = seeded(`deals-${from}-${p.outbound_date ?? ""}-${p.travel_class ?? "1"}`);
  const start = p.outbound_date?.split(",")[0] ?? new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const deals = DEAL_DESTINATIONS.filter((d) => d !== from).map((to, i) => {
    const a = airportCoords(from);
    const b = airportCoords(to);
    const km = a && b ? haversineKm(a, b) : 4000;
    const usual = Math.round((90 + km * 0.09) * CABIN_MULT[p.travel_class ?? "1"]!);
    const price = Math.round(usual * (0.55 + rand() * 0.4));
    const out = new Date(`${start}T00:00:00Z`);
    out.setUTCDate(out.getUTCDate() + Math.floor(rand() * 25));
    const back = new Date(out);
    back.setUTCDate(back.getUTCDate() + 5 + (i % 4));
    return {
      name: airportCity(to) ?? to,
      country: null,
      price,
      average_price: usual,
      outbound_date: out.toISOString().slice(0, 10),
      return_date: p.type === "2" ? undefined : back.toISOString().slice(0, 10),
      departure_airport_code: from,
      arrival_airport_code: to,
      airline: AIRLINES[i % AIRLINES.length]![0],
      stops: km > 6000 ? 1 : i % 3 === 0 ? 1 : 0,
      flight_duration: legMinutes(from, to),
    };
  });
  return { search_metadata: { status: "Success", sample: true }, deals };
}
