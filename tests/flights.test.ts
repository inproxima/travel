import { describe, expect, it } from "vitest";
import { searchAirports } from "@/lib/airports";
import { flightParams, normalizeBooking, normalizeFlights } from "@/lib/serpapi/engines/google-flights";
import { normalizeDeals } from "@/lib/serpapi/engines/google-flights-deals";
import { mockFlights } from "@/lib/mock/flights";

describe("flightParams", () => {
  it("asks for the cheapest fares in the chosen cabin, including hidden results", () => {
    const p = flightParams({ from: "jfk,ewr", to: "lis", date: "2026-12-01" }, 3);
    expect(p).toMatchObject({ departure_id: "JFK,EWR", arrival_id: "LIS", type: 2, travel_class: 3, sort_by: 2, show_hidden: true, adults: 1 });
    expect(p.return_date).toBeUndefined();
  });

  it("switches to round trip with a return date and validates it", () => {
    expect(flightParams({ from: "JFK", to: "LIS", date: "2026-12-01", returnDate: "2026-12-08" }, 1).type).toBe(1);
    expect(() => flightParams({ from: "JFK", to: "LIS", date: "2026-12-08", returnDate: "2026-12-01" }, 1)).toThrow(/return date/);
    expect(() => flightParams({ from: "JFK", to: "JFK", date: "2026-12-01" }, 1)).toThrow(/different/);
    expect(() => flightParams({ from: "New York", to: "LIS", date: "2026-12-01" }, 1)).toThrow();
  });
});

describe("normalizeFlights", () => {
  const raw = {
    best_flights: [
      {
        flights: [
          { departure_airport: { id: "JFK", time: "2026-12-01 18:00" }, arrival_airport: { id: "LHR", time: "2026-12-02 06:00" }, duration: 420, airline: "BA", flight_number: "BA 178" },
          { departure_airport: { id: "LHR", time: "2026-12-02 08:00" }, arrival_airport: { id: "LIS", time: "2026-12-02 10:45" }, duration: 165, airline: "TAP", flight_number: "TP 1351" },
        ],
        layovers: [{ id: "LHR", duration: 120 }],
        total_duration: 705,
        price: 512,
        carbon_emissions: { this_flight: 552000, typical_for_this_route: 600000, difference_percent: -8 },
        booking_token: "b1",
      },
    ],
    other_flights: [{ flights: [{ departure_airport: { id: "JFK", time: "2026-12-01 18:00" }, flight_number: "BA 178" }, { departure_airport: { time: "2026-12-02 08:00" }, flight_number: "TP 1351" }], price: 9 }],
    price_insights: { lowest_price: 480, price_level: "low", typical_price_range: [500, 700], price_history: [[1764547200, 530], [1764633600]] },
  };

  it("merges best and other flights without duplicates", () => {
    const { itineraries } = normalizeFlights(raw);
    expect(itineraries).toHaveLength(1);
    expect(itineraries[0]).toMatchObject({ stops: 1, price: 512, best: true, airlines: ["BA", "TAP"], bookingToken: "b1", co2: { thisFlightKg: 552, typicalKg: 600, diffPercent: -8 } });
    expect(itineraries[0]!.layovers[0]).toMatchObject({ code: "LHR", durationMin: 120 });
  });

  it("reads price insights and skips malformed history points", () => {
    expect(normalizeFlights(raw).insights).toEqual({ lowestPrice: 480, level: "low", typicalLow: 500, typicalHigh: 700, history: [{ date: "2025-12-01", price: 530 }] });
  });

  it("copes with an empty response", () => {
    expect(normalizeFlights({ error: "Google Flights hasn't returned any results for this query." })).toEqual({ itineraries: [], insights: null });
  });
});

describe("booking options", () => {
  it("normalizes sellers and adds both legs of separate tickets", () => {
    const options = normalizeBooking({
      booking_options: [
        { together: { book_with: "Expedia", price: 530, booking_request: { url: "https://g/clk", post_data: "u=abc" } } },
        { separate_tickets: true, departing: { book_with: "Kiwi.com", price: 200 }, returning: { book_with: "Kiwi.com", price: 250 } },
        { together: { book_with: "TAP Air Portugal", airline: true, price: 512 } },
      ],
    });
    expect(options.map((o) => [o.seller, o.price, o.separateTickets])).toEqual([
      ["Kiwi.com", 450, true],
      ["TAP Air Portugal", 512, false],
      ["Expedia", 530, false],
    ]);
    expect(options[2]).toMatchObject({ url: "https://g/clk", postData: "u=abc" });
  });
});

describe("deals", () => {
  it("accepts alternative field names and computes the discount", () => {
    const deals = normalizeDeals({ destinations: [{ city: "Lisbon", extracted_price: 300, usual_price: 400, arrival_airport_code: "LIS", start_date: "2026-11-01" }, { name: "No price" }] });
    expect(deals).toHaveLength(1);
    expect(deals[0]).toMatchObject({ destination: "Lisbon", price: 300, usualPrice: 400, discountPercent: 25, outboundDate: "2026-11-01" });
    expect(deals[0]!.coords?.lat).toBeCloseTo(38.78, 1);
  });
});

describe("airports", () => {
  it("offers every airport of a multi-airport city first", () => {
    const opts = searchAirports("new york");
    expect(opts[0]).toMatchObject({ kind: "metro", value: "JFK,EWR,LGA" });
    expect(opts.some((o) => o.value === "JFK")).toBe(true);
  });

  it("puts an exact code match first", () => {
    expect(searchAirports("LIS")[0]?.value).toBe("LIS");
    expect(searchAirports("x")).toEqual([]);
  });
});

describe("mock flights", () => {
  it("prices return options as round-trip totals above the chosen outbound", () => {
    const out = normalizeFlights(mockFlights({ departure_id: "JFK", arrival_id: "LIS", outbound_date: "2026-12-01", return_date: "2026-12-08", travel_class: "1" }));
    const chosen = out.itineraries[0]!;
    const back = normalizeFlights(mockFlights({ departure_id: "JFK", arrival_id: "LIS", outbound_date: "2026-12-01", return_date: "2026-12-08", travel_class: "1", departure_token: chosen.departureToken! }));
    expect(back.itineraries[0]!.segments[0]!.from.code).toBe("LIS");
    expect(Math.min(...back.itineraries.map((i) => i.price!))).toBeGreaterThan(chosen.price!);
  });
});
