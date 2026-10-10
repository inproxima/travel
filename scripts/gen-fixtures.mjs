// Writes the hand-built sample data used by `./run.sh mock` into fixtures/serpapi/.
// Shapes follow SerpApi's published engine schemas. Real responses recorded with
// `./run.sh check --full` (fixtures/recorded/) are the source of truth when they differ.
//
//   node scripts/gen-fixtures.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = (engine, name, body) => {
  const dir = path.join(root, "fixtures", "serpapi", engine);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(body, null, 2) + "\n");
};
const meta = (engine) => ({ search_metadata: { status: "Success", sample: true }, search_parameters: { engine } });

// --- Lisbon hotels ------------------------------------------------------------------

// name, class, lat, lng, nightly USD, rating, reviews, location rating, neighborhood, tripadvisor id
const HOTELS = [
  ["Avenida Palace", 5, 38.7139, -9.1405, 312, 4.6, 3120, 4.9, "Baixa", "195263"],
  ["Memmo Alfama", 4, 38.7108, -9.1307, 268, 4.7, 1890, 4.6, "Alfama", "2398765"],
  ["Hotel Lisboa Plaza", 4, 38.7196, -9.1449, 189, 4.5, 2210, 4.8, "Avenida da Liberdade", "189207"],
  ["The Lumiares Hotel & Spa", 5, 38.7130, -9.1446, 295, 4.7, 1340, 4.7, "Bairro Alto", "4377125"],
  ["Hotel Britania", 4, 38.7225, -9.1462, 205, 4.6, 1120, 4.5, "Avenida da Liberdade", "195312"],
  ["Pestana Palace Lisboa", 5, 38.7067, -9.1857, 238, 4.5, 4410, 3.7, "Alcântara", "195250"],
  ["Sheraton Lisboa Hotel & Spa", 5, 38.7317, -9.1477, 221, 4.4, 5230, 4.2, "Marquês de Pombal", "190205"],
  ["Hotel Mundial", 4, 38.7158, -9.1366, 159, 4.3, 6120, 4.8, "Mouraria", "190158"],
  ["Martinhal Lisbon Chiado", 5, 38.7113, -9.1418, 345, 4.7, 980, 4.9, "Chiado", "7262810"],
  ["NH Collection Lisboa Liberdade", 5, 38.7203, -9.1459, 247, 4.5, 2050, 4.7, "Avenida da Liberdade", "232850"],
  ["Hotel Alif Avenidas", 3, 38.7393, -9.1450, 98, 4.2, 2980, 3.9, "Avenidas Novas", "236123"],
  ["My Story Hotel Tejo", 3, 38.7128, -9.1376, 131, 4.3, 3390, 4.8, "Baixa", "195284"],
  ["Hotel Convento do Salvador", 3, 38.7135, -9.1300, 119, 4.5, 890, 4.4, "Alfama", "6436451"],
  ["Corinthia Lisbon", 5, 38.7363, -9.1680, 199, 4.5, 6840, 3.6, "Sete Rios", "195252"],
  ["Lisboa Pessoa Hotel", 4, 38.7112, -9.1430, 214, 4.6, 1560, 4.9, "Chiado", "12139380"],
  ["Hotel Real Palácio", 4, 38.7322, -9.1555, 152, 4.4, 2470, 4.0, "Amoreiras", "195271"],
  ["Lumen Hotel & The Urban Gardens", 4, 38.7240, -9.1467, 176, 4.5, 1430, 4.4, "Avenida da Liberdade", "13154270"],
  ["Hotel do Chiado", 4, 38.7108, -9.1414, 233, 4.4, 1010, 4.9, "Chiado", "195281"],
];

const RENTALS = [
  ["Alfama loft with river view", 38.7114, -9.1291, 128, 4.8, 96, "Alfama"],
  ["Príncipe Real 2-bedroom apartment with balcony", 38.7170, -9.1495, 164, 4.9, 141, "Príncipe Real"],
  ["Quiet studio near Campo de Ourique market", 38.7176, -9.1658, 79, 4.7, 212, "Campo de Ourique"],
  ["Bright flat by Avenida da Liberdade, work desk + fast Wi‑Fi", 38.7214, -9.1453, 112, 4.8, 167, "Avenida da Liberdade"],
  ["Graça terrace apartment", 38.7166, -9.1312, 95, 4.6, 88, "Graça"],
  ["Cais do Sodré riverside 1-bedroom", 38.7062, -9.1447, 121, 4.5, 133, "Cais do Sodré"],
];

const AMENITIES = ["Free Wi-Fi", "Breakfast ($)", "Air conditioning", "Fitness centre", "Restaurant", "Bar", "Room service", "Accessible", "Spa", "Pool", "Kid-friendly", "Airport shuttle", "Business centre", "Pet-friendly"];
const CATEGORIES = ["Location", "Service", "Breakfast", "Room", "Cleanliness", "Noise", "Wi-Fi", "Value"];

const pick = (arr, seed, n) => arr.filter((_, i) => (i * 7 + seed) % 3 !== 0).slice(0, n);

function property([name, cls, lat, lng, nightly, rating, reviews, loc, hood, ta], i) {
  const token = `sample_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
  return {
    type: "hotel",
    name,
    description: `${cls}-star hotel in ${hood}, Lisbon.`,
    link: `https://example.com/${token}`,
    property_token: token,
    serpapi_property_details_link: `https://serpapi.com/search.json?engine=google_hotels&property_token=${token}`,
    gps_coordinates: { latitude: lat, longitude: lng },
    check_in_time: "3:00 PM",
    check_out_time: "12:00 PM",
    rate_per_night: { lowest: `$${nightly}`, extracted_lowest: nightly, before_taxes_fees: `$${Math.round(nightly * 0.94)}`, extracted_before_taxes_fees: Math.round(nightly * 0.94) },
    total_rate: { lowest: `$${nightly * 3}`, extracted_lowest: nightly * 3 },
    prices: [
      { source: "Booking.com", rate_per_night: { extracted_lowest: Math.round(nightly * 1.03) } },
      { source: "Expedia", rate_per_night: { extracted_lowest: Math.round(nightly * 1.06) } },
    ],
    hotel_class: `${cls}-star hotel`,
    extracted_hotel_class: cls,
    overall_rating: rating,
    reviews,
    location_rating: loc,
    reviews_breakdown: CATEGORIES.slice(0, 5 + (i % 3)).map((c, k) => {
      const total = Math.round(reviews * (0.08 + 0.03 * ((k + i) % 4)));
      const neg = c === "Noise" ? 0.35 : c === "Value" ? 0.2 : 0.08 + 0.03 * ((k * 3 + i) % 4);
      return { name: c, description: c, total_mentioned: total, positive: Math.round(total * (1 - neg)), negative: Math.round(total * neg), neutral: 0, category_token: `cat_${k}_${token}` };
    }),
    amenities: pick(AMENITIES, i, 7 + (cls - 3) * 2),
    images: [],
    nearby_places: [
      { name: "Humberto Delgado Airport", transportations: [{ type: "Taxi", duration: `${15 + (i % 4) * 3} min` }, { type: "Public transport", duration: `${30 + (i % 5) * 4} min` }] },
      { name: "Praça do Comércio", transportations: [{ type: "Walking", duration: `${4 + (i % 7) * 4} min` }] },
    ],
    free_cancellation: i % 3 !== 1,
    address: `${hood}, Lisbon, Portugal`,
    tripadvisor_id: ta,
  };
}

const hotels = HOTELS.map(property);
const rentals = RENTALS.map(([name, lat, lng, nightly, rating, reviews, hood], i) => ({
  ...property([name, 0, lat, lng, nightly, rating, reviews, 4.5, hood, null], i + 3),
  type: "vacation rental",
  description: `Entire apartment in ${hood}. Kitchen, washer, self check-in.`,
  hotel_class: null,
  extracted_hotel_class: null,
  amenities: ["Kitchen", "Washer", "Free Wi-Fi", "Air conditioning", "Self check-in", "Dedicated workspace"].slice(0, 4 + (i % 3)),
  free_cancellation: i % 2 === 0,
}));

out("google_hotels", "default", {
  ...meta("google_hotels"),
  search_information: { total_results: 214 },
  properties: hotels.slice(0, 12),
  serpapi_pagination: { current_from: 1, current_to: 12, next_page_token: "sample_page_2" },
});
out("google_hotels", "page2", {
  ...meta("google_hotels"),
  properties: hotels.slice(12),
  serpapi_pagination: { current_from: 13, current_to: 18 },
});
out("google_hotels", "rentals", { ...meta("google_hotels"), properties: rentals, serpapi_pagination: {} });
out("google_hotels", "details", {
  ...meta("google_hotels"),
  name: "Sample property",
  address: "Lisbon, Portugal",
  phone: "+351 21 000 0000",
  typical_price_range: { extracted_lowest: 150, extracted_highest: 260 },
  featured_prices: [],
  prices: [],
  other_reviews: [],
});

// --- reviews pool (shared by Google Hotels, Google Maps and Tripadvisor samples) ---

const POOL = [
  [5, "Perfect location", "Five minutes on foot to the metro and the river. We walked everywhere, even up to the castle.", "Couples", "Location"],
  [5, "Great for a long stay", "Stayed a month for work. Desk in the room was big enough, Wi-Fi was fast and stable for video calls, and housekeeping was flexible.", "Business", "Wi-Fi"],
  [4, "Lovely but noisy on weekends", "Beautiful room and friendly staff. Street noise from the bars on Friday and Saturday nights; ask for a room at the back.", "Friends", "Noise"],
  [5, "Breakfast was the highlight", "Fresh pastéis de nata every morning and great coffee. Breakfast terrace has a view.", "Family", "Breakfast"],
  [3, "Small rooms", "Clean and central, but the standard double is tiny. Fine for a couple of nights, not for longer.", "Solo", "Room"],
  [5, "Quiet and comfortable", "Very quiet at night, blackout curtains and a great mattress. Slept better than at home.", "Business", "Noise"],
  [4, "Good value for Lisbon", "Price was fair for the area. Nothing fancy, but spotless and the staff gave excellent restaurant tips.", "Couples", "Value"],
  [2, "Air conditioning struggled", "In August the AC couldn't keep up and the room was warm all night. Staff tried to help.", "Family", "Room"],
  [5, "Staff went above and beyond", "Reception organised a late check-out and called a taxi at 5am for our flight. Super kind.", "Couples", "Service"],
  [4, "Hilly but worth it", "Lisbon is steep — be ready for hills. The hotel is close to the tram 28 stop, which helps.", "Solo", "Location"],
  [3, "Wi-Fi drops in the evening", "The connection was slow after 8pm. Not great if you need to work; the lobby was better.", "Business", "Wi-Fi"],
  [5, "Spotless", "Housekeeping was excellent every day. Bathroom was modern and very clean.", "Couples", "Cleanliness"],
  [4, "Rooftop bar is busy", "The rooftop is lovely at sunset but it's popular with non-guests, so it gets crowded.", "Friends", "Service"],
  [5, "Ideal for families", "Connecting rooms, cots provided, and the staff loved our kids. Pool was a hit.", "Family", "Service"],
  [4, "Easy airport transfer", "20 minutes by taxi from the airport, or the metro red/green line with one change.", "Business", "Location"],
  [2, "Construction next door", "Building work started at 8am on weekdays. Hotel didn't mention it when booking.", "Couples", "Noise"],
  [5, "Monthly rate was excellent", "Asked for a long-stay rate by email and got a big discount for 30 nights, with weekly cleaning.", "Solo", "Value"],
  [4, "Kitchenette is handy", "Having a small kitchenette made a three-week stay much easier. Supermarket around the corner.", "Business", "Room"],
  [5, "Gorgeous historic building", "Beautiful tiles and high ceilings. It feels like old Lisbon but the rooms are renovated.", "Couples", "Room"],
  [3, "Breakfast overpriced", "€25 for an average buffet. Plenty of cafés nearby do a better breakfast for a third of the price.", "Friends", "Breakfast"],
  [4, "Good gym", "Gym was small but well equipped and open 24 hours, which suited my schedule.", "Business", "Service"],
  [5, "Very safe area", "Walked back late at night and always felt safe. Well-lit streets and lots of people around.", "Solo", "Location"],
  [4, "Elevator is tiny", "Lovely hotel but the lift fits two people and a suitcase. Expect to wait at check-out time.", "Family", "Room"],
  [5, "River views", "Asked for a high floor and got a view of the Tagus. Sunsets from the room were unforgettable.", "Couples", "Room"],
  [3, "Thin walls", "Could hear the neighbours' TV. Earplugs provided, which says it all.", "Business", "Noise"],
  [5, "Laundry service saved us", "On a long trip the same-day laundry was a lifesaver and reasonably priced.", "Family", "Service"],
];

const AUTHORS = ["Marta S.", "James K.", "Ana P.", "Lukas W.", "Priya R.", "Tom H.", "Sofia M.", "Daniel O.", "Chen L.", "Emma B.", "Rui C.", "Hannah F.", "Mateo G.", "Olivia T."];
const DATES = ["2 weeks ago", "a month ago", "2 months ago", "3 months ago", "5 months ago", "6 months ago", "8 months ago", "a year ago"];
const ISO = ["2026-09-24", "2026-09-08", "2026-08-12", "2026-07-15", "2026-05-20", "2026-04-11", "2026-02-02", "2025-10-01"];

fs.mkdirSync(path.join(root, "fixtures", "serpapi", "_pools"), { recursive: true });
fs.writeFileSync(
  path.join(root, "fixtures", "serpapi", "_pools", "reviews.json"),
  JSON.stringify(
    POOL.map(([rating, title, text, trip, topic], i) => ({ rating, title, text, trip, topic, author: AUTHORS[i % AUTHORS.length], date: DATES[i % DATES.length], iso: ISO[i % ISO.length] })),
    null,
    2,
  ) + "\n",
);

// Templates; the mock layer fills `reviews` from the pool per property.
out("google_hotels_reviews", "default", { ...meta("google_hotels_reviews"), reviews: [], serpapi_pagination: {} });
out("google_maps_reviews", "default", {
  ...meta("google_maps_reviews"),
  place_info: { title: "Sample hotel", rating: 4.5, reviews: 2140, type: "Hotel" },
  topics: [
    { keyword: "location", mentions: 412, id: "/m/location" },
    { keyword: "breakfast", mentions: 268, id: "/m/breakfast" },
    { keyword: "noise", mentions: 97, id: "/m/noise" },
    { keyword: "staff", mentions: 355, id: "/m/staff" },
    { keyword: "wifi", mentions: 61, id: "/m/wifi" },
    { keyword: "rooftop", mentions: 88, id: "/m/rooftop" },
  ],
  reviews: [],
  serpapi_pagination: { next_page_token: "sample_next" },
});
out("tripadvisor_reviews", "default", { ...meta("tripadvisor_reviews"), reviews: [] });

// --- Tripadvisor ------------------------------------------------------------------

out("tripadvisor", "default", {
  ...meta("tripadvisor"),
  places: HOTELS.map(([name, , , , , rating, reviews, , hood, ta], i) => ({
    position: i + 1,
    title: name,
    place_id: ta,
    place_type: "ACCOMMODATION",
    link: `https://www.tripadvisor.com/Hotel_Review-g189158-d${ta}-Reviews.html`,
    description: `Hotel in ${hood}`,
    rating: Math.round(Math.min(5, rating + 0.1) * 2) / 2,
    reviews: Math.round(reviews * 0.8),
    location: "Lisbon, Portugal",
    highlighted_review: { text: POOL[(i * 5) % POOL.length][2] },
  })),
});
out("tripadvisor_place", "default", {
  ...meta("tripadvisor_place"),
  place_result: {
    type: "hotel",
    rating: 4.5,
    reviews: 1840,
    ranking: "#14 of 286 hotels in Lisbon",
    award: { type: "Travellers' Choice", name: "Travellers' Choice 2026" },
    price_range: "$180 - $320",
    amenities: ["Free High Speed Internet (WiFi)", "Fitness Center", "Bar / lounge", "Breakfast available", "Airport transportation", "Non-smoking rooms"].map((name) => ({ name })),
    subratings: [
      { name: "Location", rating: 4.8 },
      { name: "Rooms", rating: 4.4 },
      { name: "Value", rating: 4.1 },
      { name: "Cleanliness", rating: 4.6 },
      { name: "Service", rating: 4.7 },
      { name: "Sleep Quality", rating: 4.3 },
    ],
  },
});

// --- forums -----------------------------------------------------------------------

out("google_forums", "default", {
  ...meta("google_forums"),
  organic_results: [
    ["Where to stay in Lisbon for a month (remote work)?", "Reddit · r/digitalnomad", "Avenidas Novas and Campo de Ourique are quieter and flatter than Alfama or Bairro Alto, with good cafés and the metro nearby.", "3 months ago", "86 comments"],
    ["Bairro Alto vs Chiado for first time visitors", "Reddit · r/lisbon", "Bairro Alto is fun but loud until 2am on weekends. Chiado is right next to it and much quieter at night.", "5 months ago", "142 comments"],
    ["Is Alfama too hilly with luggage?", "Tripadvisor · Lisbon Forum", "Yes, cobbled and steep. Take a taxi to the door and pack light. Beautiful at night though.", "8 months ago", "23 replies"],
    ["Long stay hotel discounts in Lisbon", "Reddit · r/solotravel", "Email hotels directly for a 3–4 week rate; several of us got 20–30% off plus weekly cleaning.", "2 months ago", "41 comments"],
    ["Avenida da Liberdade area — safe at night?", "Tripadvisor · Lisbon Forum", "Very safe and well lit. Good base: metro, airport bus, and walking distance to Baixa.", "a year ago", "17 replies"],
    ["Best neighbourhood near the Marquês de Pombal offices", "Reddit · r/expats", "Avenidas Novas or Saldanha; 10–15 minutes walk or two metro stops to most offices around Marquês.", "4 months ago", "58 comments"],
    ["Noise complaints: Cais do Sodré hotels", "Reddit · r/lisbon", "Pink Street nightlife is right there. Great for going out, bad if you want to sleep before 3am.", "6 months ago", "73 comments"],
  ].map(([title, source, snippet, date, meta], i) => ({
    position: i + 1,
    title,
    link: `https://www.reddit.com/r/sample/comments/${(i + 11).toString(36)}`,
    source,
    snippet,
    date,
    displayed_meta: `${meta} · ${date}`,
  })),
});

console.log("Sample fixtures written to fixtures/serpapi/");
