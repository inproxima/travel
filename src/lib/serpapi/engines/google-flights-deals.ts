import { z } from "zod";
import { airportCoords } from "@/lib/airports";
import type { Cabin, Deal } from "@/lib/models";
import { serpapi, type CallContext } from "../client";
import { list, toLatLng, zArr, zCoords, zNum, zStr } from "../z";

export const dealQuerySchema = z.object({
  from: z.string().trim().toUpperCase().regex(/^[A-Z]{3}(,[A-Z]{3})*$/),
  /** A single date or a "start,end" window; omit for any time. */
  window: z.object({ start: z.iso.date(), end: z.iso.date() }).nullish(),
  tripLength: z.object({ min: z.number().int().min(1).max(30), max: z.number().int().min(1).max(30) }).nullish(),
  oneWay: z.boolean().default(false),
  stops: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).default(0),
  maxPrice: z.number().int().positive().nullish(),
  currency: z.string().length(3).default("USD"),
  gl: z.string().length(2).default("us"),
  hl: z.string().min(2).max(8).default("en"),
});
export type DealQuery = z.input<typeof dealQuerySchema>;

// The deals response keys are not fully documented, so several spellings are accepted.
const zDeal = z.looseObject({
  name: zStr,
  destination: zStr,
  city: zStr,
  country: zStr,
  price: zNum,
  extracted_price: zNum,
  average_price: zNum,
  usual_price: zNum,
  discount_percentage: zNum,
  outbound_date: zStr,
  start_date: zStr,
  return_date: zStr,
  end_date: zStr,
  departure_airport_code: zStr,
  arrival_airport_code: zStr,
  airline: zStr,
  stops: zNum,
  flight_duration: zNum,
  thumbnail: zStr,
  image: zStr,
  flight_link: zStr,
  gps_coordinates: zCoords,
});

const zResponse = z.looseObject({ deals: zArr(zDeal), destinations: zArr(zDeal) });

export function normalizeDeals(raw: unknown): Deal[] {
  const r = zResponse.parse(raw);
  return [...list(r.deals), ...list(r.destinations)]
    .map((d) => {
      const price = d.extracted_price ?? d.price ?? null;
      const usual = d.average_price ?? d.usual_price ?? null;
      const to = d.arrival_airport_code ?? null;
      return {
        destination: d.name ?? d.destination ?? d.city ?? to ?? "Unknown",
        country: d.country ?? null,
        from: d.departure_airport_code ?? null,
        to,
        price,
        usualPrice: usual,
        discountPercent: d.discount_percentage ?? (price != null && usual ? Math.round((1 - price / usual) * 100) : null),
        outboundDate: d.outbound_date ?? d.start_date ?? null,
        returnDate: d.return_date ?? d.end_date ?? null,
        airline: d.airline ?? null,
        stops: d.stops ?? null,
        durationMin: d.flight_duration ?? null,
        image: d.thumbnail ?? d.image ?? null,
        link: d.flight_link ?? null,
        coords: toLatLng(d.gps_coordinates) ?? (to ? airportCoords(to) : null),
      };
    })
    .filter((d) => d.price != null)
    .sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
}

export async function searchDeals(input: DealQuery, cabin: Cabin, ctx?: CallContext): Promise<Deal[]> {
  const q = dealQuerySchema.parse(input);
  const { data } = await serpapi(
    "google_flights_deals",
    {
      departure_id: q.from,
      type: q.oneWay ? 2 : 1,
      outbound_date: q.window ? `${q.window.start},${q.window.end}` : undefined,
      trip_length: !q.oneWay && q.tripLength ? (q.tripLength.min === q.tripLength.max ? q.tripLength.min : `${q.tripLength.min},${q.tripLength.max}`) : undefined,
      travel_class: cabin,
      stops: q.stops || undefined,
      max_price: q.maxPrice,
      currency: q.currency,
      gl: q.gl,
      hl: q.hl,
    },
    ctx,
  );
  return normalizeDeals(data);
}
