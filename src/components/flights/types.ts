import type { Cabin, Itinerary, PriceInsights } from "@/lib/models";
import type { AirportValue } from "./airport-input";

export type FlightForm = {
  from: AirportValue | null;
  to: AirportValue | null;
  roundTrip: boolean;
  date: string;
  returnDate: string;
  adults: number;
  children: number;
  stops: 0 | 1 | 2 | 3;
  maxPrice: number | null;
  cabins: Cabin[];
};

export type CabinResult = { itineraries: Itinerary[]; insights: PriceInsights | null; error?: string };

export type FlightSearchResponse = { cabins: Partial<Record<Cabin, CabinResult>>; currency: string; credits: number };

export function toQuery(f: FlightForm) {
  return {
    from: f.from?.codes ?? "",
    to: f.to?.codes ?? "",
    date: f.date,
    returnDate: f.roundTrip ? f.returnDate : null,
    adults: f.adults,
    children: f.children,
    stops: f.stops,
    maxPrice: f.maxPrice ?? undefined,
  };
}
