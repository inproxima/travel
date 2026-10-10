import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hotelParams, normalizeHotelDetails, normalizeHotelSearch, tripadvisorIdFromUrl } from "@/lib/serpapi/engines/google-hotels";
import { normalizeHotelReviews } from "@/lib/serpapi/engines/google-hotels-reviews";
import { normalizeDirections, weekdayMorningUnix } from "@/lib/serpapi/engines/google-maps-directions";
import { normalizeMapsReviews } from "@/lib/serpapi/engines/google-maps-reviews";
import { normalizeForums } from "@/lib/serpapi/engines/google-forums";
import { matchTripadvisor, nameSimilarity, normalizeTripadvisorPlace, normalizeTripadvisorReviews, normalizeTripadvisorSearch } from "@/lib/serpapi/engines/tripadvisor";

const fixture = (engine: string, name = "default") =>
  JSON.parse(fs.readFileSync(path.join(process.cwd(), "fixtures", "serpapi", engine, `${name}.json`), "utf8"));

describe("google_hotels", () => {
  it("builds params and drops filters that don't apply to vacation rentals", () => {
    const p = hotelParams({ q: "Lisbon", checkIn: "2026-11-01", checkOut: "2026-11-05", hotelClass: [4, 5], freeCancellation: true, vacationRentals: true, sort: "price" });
    expect(p).toMatchObject({ q: "Lisbon", sort_by: 3, vacation_rentals: true, adults: 2 });
    expect(p.hotel_class).toBeUndefined();
    expect(p.free_cancellation).toBeUndefined();
  });

  it("rejects check-out before check-in", () => {
    expect(() => hotelParams({ q: "Lisbon", checkIn: "2026-11-05", checkOut: "2026-11-01" })).toThrow(/Check-out/);
  });

  it("normalizes search results", () => {
    const { hotels, nextPageToken } = normalizeHotelSearch(fixture("google_hotels"));
    expect(hotels.length).toBe(12);
    expect(nextPageToken).toBe("sample_page_2");
    const h = hotels[0]!;
    expect(h).toMatchObject({ name: "Avenida Palace", hotelClass: 5, nightly: 312, coords: { lat: 38.7139, lng: -9.1405 }, checkInTime: "3:00 PM" });
    expect(h.categories[0]?.categoryToken).toBeTruthy();
  });

  it("gives properties without a token a stable id", () => {
    const raw = { properties: [{ name: "No Token Inn", gps_coordinates: { latitude: 1, longitude: 2 } }] };
    expect(normalizeHotelSearch(raw).hotels[0]!.id).toBe(normalizeHotelSearch(raw).hotels[0]!.id);
    expect(normalizeHotelSearch(raw).hotels[0]!.id).toMatch(/^h_/);
  });

  it("merges featured and regular prices, cheapest first, and finds the Tripadvisor id", () => {
    const d = normalizeHotelDetails({
      featured_prices: [{ source: "Hotel site", official: true, total_rate: { extracted_lowest: 900 } }],
      prices: [
        { source: "Booking.com", total_rate: { extracted_lowest: 850 } },
        { source: "Hotel site", total_rate: { extracted_lowest: 999 } },
      ],
      other_reviews: [{ source: "Tripadvisor", user_review: { link: "https://www.tripadvisor.com/Hotel_Review-g189158-d195263-Reviews-Avenida.html" } }],
    });
    expect(d.offers.map((o) => o.source)).toEqual(["Booking.com", "Hotel site"]);
    expect(d.offers[1]!.official).toBe(true);
    expect(d.tripadvisorPlaceId).toBe("195263");
  });

  it("only reads place ids from Tripadvisor links", () => {
    expect(tripadvisorIdFromUrl("https://example.com/x-d123-y")).toBeNull();
    expect(tripadvisorIdFromUrl("https://www.tripadvisor.co.uk/Hotel_Review-g1-d42")).toBe("42");
  });
});

describe("reviews", () => {
  it("normalizes Google Hotels reviews and drops empty ones", () => {
    const page = normalizeHotelReviews({
      reviews: [
        { user: { name: "A" }, rating: 4, snippet: "Great  location", source: "Booking.com", subratings: { rooms: 4 } },
        { user: { name: "B" }, rating: 2, snippet: "   " },
      ],
      serpapi_pagination: { next_page_token: "n" },
    });
    expect(page.reviews).toHaveLength(1);
    expect(page.reviews[0]).toMatchObject({ text: "Great location", origin: "Booking.com", subratings: { rooms: 4 }, maxRating: 5 });
    expect(page.nextPageToken).toBe("n");
  });

  it("normalizes Google Maps reviews with topics and keeps numeric details only", () => {
    const page = normalizeMapsReviews({
      ...fixture("google_maps_reviews"),
      reviews: [{ rating: 5, snippet: "Quiet", user: { name: "C" }, details: { rooms: 5, price_per_night: "€150", service: "4" } }],
    });
    expect(page.topics.find((t) => t.label === "noise")?.id).toBe("/m/noise");
    expect(page.reviews[0]!.subratings).toEqual({ rooms: 5, service: 4 });
  });

  it("normalizes Tripadvisor reviews", () => {
    const r = normalizeTripadvisorReviews({ reviews: [{ review_id: 9, title: "T", snippet: "S", rating: 5, trip_info: { type: "Business" }, author: { username: "u" } }] });
    expect(r[0]).toMatchObject({ id: "tripadvisor_9", tripType: "Business", author: "u", source: "tripadvisor" });
  });
});

describe("tripadvisor matching", () => {
  const places = normalizeTripadvisorSearch(fixture("tripadvisor"));

  it("matches the right hotel and ignores city words", () => {
    expect(matchTripadvisor("Memmo Alfama", places, "Lisbon")?.placeId).toBe("2398765");
    expect(matchTripadvisor("Hotel Lisboa Plaza", places, "Lisboa")?.title).toBe("Hotel Lisboa Plaza");
    expect(nameSimilarity("Hotel Lisbon Star", "Lisbon Grand Hotel", "Lisbon")).toBe(0);
  });

  it("returns null rather than a wrong hotel", () => {
    expect(matchTripadvisor("Four Seasons Ritz", places, "Lisbon")).toBeNull();
  });

  it("reads place details", () => {
    const d = normalizeTripadvisorPlace(fixture("tripadvisor_place"));
    expect(d.ranking).toMatch(/#14/);
    expect(d.award).toBe("Travellers' Choice 2026");
    expect(d.subratings.find((s) => s.label === "Location")?.rating).toBe(4.8);
  });
});

describe("directions", () => {
  it("merges routes and durations per mode, fastest first", () => {
    const d = normalizeDirections(
      {
        places_info: [{ data_id: "start" }, { data_id: "end" }],
        directions: [{ travel_mode: "Transit", duration: 1080, distance: 5400, formatted_duration: "18 min" }],
        durations: [
          { travel_mode: "Transit", duration: 1200 },
          { travel_mode: "Walking", duration: 3600, formatted_duration: "1 hr" },
          { travel_mode: "Driving", duration: 720, formatted_duration: "12 min" },
        ],
      },
      "Hotel",
      "Work",
    );
    expect(d.modes.map((m) => m.mode)).toEqual(["driving", "transit", "walking"]);
    expect(d.modes.find((m) => m.mode === "transit")).toMatchObject({ durationMin: 18, distanceKm: 5.4 });
    expect(d.best?.mode).toBe("transit");
    expect([d.startDataId, d.endDataId]).toEqual(["start", "end"]);
  });

  it("picks a weekday morning for commute times", () => {
    // 2026-11-07 is a Saturday, so the next weekday is Monday 9th.
    const t = weekdayMorningUnix("2026-11-07", 0);
    expect(new Date(t * 1000).toISOString()).toBe("2026-11-09T08:30:00.000Z");
  });
});

describe("forums", () => {
  it("keeps posts with a title and link", () => {
    const posts = normalizeForums({ organic_results: [{ title: "Q", link: "https://r/x", displayed_meta: "5 comments" }, { title: "No link" }] });
    expect(posts).toEqual([{ title: "Q", link: "https://r/x", source: null, snippet: null, date: null, meta: "5 comments" }]);
    expect(normalizeForums(fixture("google_forums")).length).toBe(7);
  });
});
