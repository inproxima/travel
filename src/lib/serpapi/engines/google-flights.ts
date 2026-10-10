import crypto from "node:crypto";
import { z } from "zod";
import type { BookingOption, Cabin, FlightSegment, Itinerary, PriceInsights } from "@/lib/models";
import { serpapi, type CallContext } from "../client";
import { list, zArr, zBool, zNum, zObj, zStr } from "../z";

// --- request ---------------------------------------------------------------------

const code = z.string().trim().toUpperCase().regex(/^[A-Z]{3}(,[A-Z]{3})*$/, "Use 3-letter airport codes");

export const flightQuerySchema = z.object({
  from: code,
  to: code,
  date: z.iso.date(),
  returnDate: z.iso.date().nullish(),
  adults: z.number().int().min(1).max(9).default(1),
  children: z.number().int().min(0).max(8).default(0),
  /** 0 any, 1 nonstop, 2 up to 1 stop, 3 up to 2 stops */
  stops: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).default(0),
  maxPrice: z.number().int().positive().nullish(),
  currency: z.string().length(3).default("USD"),
  gl: z.string().length(2).default("us"),
  hl: z.string().min(2).max(8).default("en"),
});
export type FlightQuery = z.input<typeof flightQuerySchema>;

export function flightParams(input: FlightQuery, cabin: Cabin) {
  const q = flightQuerySchema.parse(input);
  if (q.from === q.to) throw new Error("Pick different departure and arrival airports.");
  if (q.returnDate && q.returnDate < q.date) throw new Error("The return date must be after the departure date.");
  return {
    departure_id: q.from,
    arrival_id: q.to,
    outbound_date: q.date,
    return_date: q.returnDate ?? undefined,
    type: q.returnDate ? 1 : 2,
    travel_class: cabin,
    adults: q.adults,
    children: q.children || undefined,
    stops: q.stops || undefined,
    max_price: q.maxPrice,
    // Cheapest first, including the results behind "View more flights".
    sort_by: 2,
    show_hidden: true,
    currency: q.currency,
    gl: q.gl,
    hl: q.hl,
  };
}

// --- response --------------------------------------------------------------------

const zAirport = zObj({ id: zStr, name: zStr, time: zStr });

const zFlight = z.looseObject({
  departure_airport: zAirport,
  arrival_airport: zAirport,
  duration: zNum,
  airplane: zStr,
  airline: zStr,
  airline_logo: zStr,
  travel_class: zStr,
  flight_number: zStr,
  legroom: zStr,
  overnight: zBool,
  extensions: zArr(z.string()),
});

const zItinerary = z.looseObject({
  flights: zArr(zFlight),
  layovers: zArr(z.looseObject({ id: zStr, name: zStr, duration: zNum, overnight: zBool })),
  total_duration: zNum,
  price: zNum,
  airline_logo: zStr,
  carbon_emissions: zObj({ this_flight: zNum, typical_for_this_route: zNum, difference_percent: zNum }),
  departure_token: zStr,
  booking_token: zStr,
});

const zResponse = z.looseObject({
  best_flights: zArr(zItinerary),
  other_flights: zArr(zItinerary),
  price_insights: zObj({
    lowest_price: zNum,
    price_level: zStr,
    typical_price_range: zArr(z.number()),
    price_history: zArr(z.array(z.number())),
  }),
});

function toItinerary(raw: z.infer<typeof zItinerary>, best: boolean): Itinerary {
  const segments: FlightSegment[] = list(raw.flights).map((f) => ({
    from: { code: f.departure_airport?.id ?? "", name: f.departure_airport?.name ?? null, time: f.departure_airport?.time ?? null },
    to: { code: f.arrival_airport?.id ?? "", name: f.arrival_airport?.name ?? null, time: f.arrival_airport?.time ?? null },
    durationMin: f.duration ?? null,
    airline: f.airline ?? null,
    airlineLogo: f.airline_logo ?? null,
    flightNumber: f.flight_number ?? null,
    airplane: f.airplane ?? null,
    legroom: f.legroom ?? null,
    travelClass: f.travel_class ?? null,
    overnight: f.overnight ?? false,
    extensions: list(f.extensions),
  }));
  const key = segments.map((s) => `${s.flightNumber}@${s.from.time}`).join("|") || JSON.stringify(raw).slice(0, 200);
  return {
    id: crypto.createHash("sha1").update(key).digest("hex").slice(0, 12),
    segments,
    layovers: list(raw.layovers).map((l) => ({ code: l.id ?? "", name: l.name ?? null, durationMin: l.duration ?? null, overnight: l.overnight ?? false })),
    totalDurationMin: raw.total_duration ?? null,
    price: raw.price ?? null,
    stops: Math.max(0, segments.length - 1),
    airlines: [...new Set(segments.map((s) => s.airline).filter((a): a is string => !!a))],
    airlineLogo: raw.airline_logo ?? segments[0]?.airlineLogo ?? null,
    co2: raw.carbon_emissions
      ? {
          // SerpApi reports grams.
          thisFlightKg: raw.carbon_emissions.this_flight != null ? Math.round(raw.carbon_emissions.this_flight / 1000) : null,
          typicalKg: raw.carbon_emissions.typical_for_this_route != null ? Math.round(raw.carbon_emissions.typical_for_this_route / 1000) : null,
          diffPercent: raw.carbon_emissions.difference_percent ?? null,
        }
      : null,
    departureToken: raw.departure_token ?? null,
    bookingToken: raw.booking_token ?? null,
    best,
  };
}

export type FlightSearchResult = { itineraries: Itinerary[]; insights: PriceInsights | null };

export function normalizeFlights(raw: unknown): FlightSearchResult {
  const r = zResponse.parse(raw);
  const seen = new Set<string>();
  const itineraries = [...list(r.best_flights).map((i) => toItinerary(i, true)), ...list(r.other_flights).map((i) => toItinerary(i, false))].filter((i) => {
    if (seen.has(i.id)) return false;
    seen.add(i.id);
    return true;
  });
  const pi = r.price_insights;
  const range = list(pi?.typical_price_range);
  return {
    itineraries,
    insights: pi
      ? {
          lowestPrice: pi.lowest_price ?? null,
          level: pi.price_level ?? null,
          typicalLow: range[0] ?? null,
          typicalHigh: range[1] ?? null,
          history: list(pi.price_history)
            .filter((p) => p.length >= 2)
            .map(([ts, price]) => ({ date: new Date(ts! * 1000).toISOString().slice(0, 10), price: price! })),
        }
      : null,
  };
}

const zBookingPart = z.looseObject({
  book_with: zStr,
  airline: zBool,
  price: zNum,
  option_title: zStr,
  extensions: zArr(z.string()),
  booking_request: zObj({ url: zStr, post_data: zStr }),
});

const zBooking = z.looseObject({
  booking_options: zArr(
    z.looseObject({
      separate_tickets: zBool,
      together: zObj(zBookingPart.shape),
      departing: zObj(zBookingPart.shape),
      returning: zObj(zBookingPart.shape),
    }),
  ),
});

export function normalizeBooking(raw: unknown): BookingOption[] {
  return list(zBooking.parse(raw).booking_options)
    .map((o) => {
      const part = o.together ?? o.departing;
      if (!part) return null;
      const returnPrice = o.separate_tickets ? (o.returning?.price ?? 0) : 0;
      return {
        seller: part.book_with ?? "Unknown seller",
        isAirline: part.airline ?? false,
        price: part.price != null ? part.price + returnPrice : null,
        title: part.option_title ?? null,
        extensions: list(part.extensions),
        url: part.booking_request?.url ?? null,
        postData: part.booking_request?.post_data ?? null,
        separateTickets: o.separate_tickets ?? false,
      } satisfies BookingOption;
    })
    .filter((o): o is BookingOption => o !== null)
    .sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
}

// --- calls ------------------------------------------------------------------------

export async function searchFlights(query: FlightQuery, cabin: Cabin, ctx?: CallContext): Promise<FlightSearchResult> {
  const { data } = await serpapi("google_flights", flightParams(query, cabin), ctx);
  return normalizeFlights(data);
}

/** Return flights for a chosen outbound (round trips). Same search, plus its departure_token. */
export async function returnFlights(query: FlightQuery, cabin: Cabin, departureToken: string, ctx?: CallContext) {
  const { data } = await serpapi("google_flights", { ...flightParams(query, cabin), departure_token: departureToken }, ctx);
  return normalizeFlights(data);
}

export async function bookingOptions(query: FlightQuery, cabin: Cabin, bookingToken: string, ctx?: CallContext) {
  const { data } = await serpapi("google_flights", { ...flightParams(query, cabin), booking_token: bookingToken }, ctx);
  return normalizeBooking(data);
}
