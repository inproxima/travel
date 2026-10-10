import { describe, expect, it } from "vitest";
import { mockAwardSearch, mockAwardTrips } from "@/lib/mock/awards";
import { centsPerPoint, compactPoints, estimatePoints, usablePrograms, waysToPay, type Holdings } from "@/lib/points";
import { normalizeAwards, normalizeTrips } from "@/lib/seatsaero";

const holdings: Holdings = {
  chase_ur: { held: true, balance: 70_000, cpp: 1.5 },
  amex_mr: { held: true, balance: null, cpp: 1.2 },
  capital_one: { held: false, balance: 500_000, cpp: 1 },
  united: { held: true, balance: 20_000, cpp: 1.3 },
};

describe("waysToPay", () => {
  it("lists own miles and bank transfers, preferring routes the balance covers", () => {
    const routes = waysToPay("united", 60_000, holdings);
    expect(routes.map((r) => [r.from, r.pointsNeeded, r.enough])).toEqual([
      ["chase_ur", 60_000, true],
      ["united", 60_000, false],
    ]);
  });

  it("applies transfer ratios and ignores programs the traveller doesn't hold", () => {
    const routes = waysToPay("jetblue", 20_000, holdings);
    // Amex → JetBlue is 250:200 (0.8 miles per point); Capital One isn't held.
    expect(routes.find((r) => r.from === "amex_mr")?.pointsNeeded).toBe(25_000);
    expect(routes.some((r) => r.from === "capital_one")).toBe(false);
  });

  it("knows which programs are usable directly or by transfer", () => {
    const usable = usablePrograms(holdings);
    expect(usable).toEqual(expect.arrayContaining(["united", "aeroplan", "flyingblue", "delta", "emirates"]));
    expect(usable).not.toContain("turkish");
  });
});

describe("value", () => {
  it("computes cents per point after taxes", () => {
    expect(centsPerPoint(1_800, 100, 60_000)).toBe(2.83);
    expect(centsPerPoint(null, 0, 60_000)).toBeNull();
    expect(centsPerPoint(50, 100, 10_000)).toBeNull();
  });

  it("estimates points for a cash fare at the traveller's values", () => {
    const est = estimatePoints(600, holdings);
    expect(est.map((e) => [e.program, e.points])).toEqual([
      ["chase_ur", 40_000],
      ["united", 46_200],
      ["amex_mr", 50_000],
    ]);
    expect(compactPoints(46_200)).toBe("46.2k");
    expect(compactPoints(145_000)).toBe("145k");
  });
});

describe("seats.aero parsing", () => {
  it("reads string mileage costs and treats 0 as unavailable", () => {
    const [day] = normalizeAwards({
      data: [
        {
          ID: "a1",
          Date: "2026-12-01T00:00:00Z",
          Source: "aeroplan",
          Route: { OriginAirport: "JFK", DestinationAirport: "LIS" },
          JAvailable: true,
          JMileageCost: "60000",
          JRemainingSeats: 2,
          JAirlines: "TP",
          JDirect: true,
          YAvailable: true,
          YMileageCost: "0",
          FAvailable: false,
        },
      ],
    });
    expect(day).toMatchObject({ id: "a1", date: "2026-12-01", source: "aeroplan", origin: "JFK" });
    expect(day!.cabins.J).toEqual({ available: true, miles: 60_000, seats: 2, airlines: "TP", direct: true });
    expect(day!.cabins.Y.available).toBe(false);
    expect(day!.cabins.W).toEqual({ available: false, miles: null, seats: null, airlines: null, direct: false });
  });

  it("converts trip taxes from cents", () => {
    const { trips, bookingLinks } = normalizeTrips({ data: [{ ID: "t", MileageCost: 60000, TotalTaxes: 5600, TaxesCurrency: "USD", AvailabilitySegments: [{ FlightNumber: "TP210" }] }], booking_links: [{ label: "Book", link: "https://x", primary: true }] });
    expect(trips[0]).toMatchObject({ miles: 60_000, taxes: 56, segments: [{ flightNumber: "TP210" }] });
    expect(bookingLinks).toHaveLength(1);
  });

  it("produces consistent sample data for mock mode", () => {
    const days = normalizeAwards(mockAwardSearch({ origin_airport: "JFK", destination_airport: "LIS", start_date: "2026-12-01", end_date: "2026-12-03", cabins: "business", sources: "aeroplan,united" }));
    expect(days.every((d) => ["aeroplan", "united"].includes(d.source) && !d.cabins.Y.available)).toBe(true);
    const withJ = days.find((d) => d.cabins.J.available)!;
    const { trips } = normalizeTrips(mockAwardTrips(withJ.id));
    expect(trips.find((t) => t.cabin === "business")?.miles).toBe(withJ.cabins.J.miles);
  });
});
