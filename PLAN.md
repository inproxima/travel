# Flight Pathfinder: Plan

A local web dashboard that uses the SerpApi Google Flights API to find the cheapest
way from a departure city to a destination city, compared across **Economy, Premium
Economy, Business and First**, with optional **points** values.

---

## 1. What the SerpApi Google Flights API gives us

| Need | How the API does it |
|---|---|
| Route | `departure_id` / `arrival_id`: IATA codes, comma-separated for multi-airport cities (`JFK,LGA,EWR`), or a city kgmid (`/m/02_286`) |
| Cabin | `travel_class`: `1` Economy, `2` Premium economy, `3` Business, `4` First |
| Cheapest first | `sort_by=2` (price) |
| Trip type | `type`: `1` round trip, `2` one way, `3` multi-city (`multi_city_json`) |
| Filters | `stops`, `max_price`, `include_airlines`/`exclude_airlines`, `exclude_conns`, `layover_duration`, `max_duration`, `bags`, `outbound_times` |
| More results | `show_hidden=true` (the "View more flights" results), `deep_search=true` (results closer to the browser, but slower) |
| Price context | `price_insights`: lowest price, price level, typical range, price history |
| Round-trip returns | Repeat the search with the chosen outbound's `departure_token` |
| Where to book | Repeat with the itinerary's `booking_token` to get `booking_options` (airline and OTA links) |
| Credits left | Account API (`/account.json`), which does not use search credits |

Each itinerary has `flights[]` (segments with airline, flight number, aircraft, legroom),
`layovers[]` (airport, minutes, overnight flag), `total_duration`, `price`,
`carbon_emissions` and tokens.

**Limits that affect the design**
- Every search costs one SerpApi credit, so one search per cabin costs 4 credits.
  Features that fan out (flexible dates, hub splitting) multiply that.
  Everything goes through a cache and a per-search budget guard.
- Google Flights shows **cash fares only**. No award/points pricing comes back (see section 4).
- `multi_city_json` is documented as `gl=us` + Economy only.

---

## 2. Stack (recommended)

- **Next.js (App Router) + TypeScript**: one app; API routes keep the key on the server.
- **Tailwind + shadcn/ui** for the dashboard UI, **Recharts** for price charts.
- **SQLite cache** (better-sqlite3) keyed by the normalized search parameters. It also
  keeps search history.
- **zod** to validate search input and parse SerpApi responses.
- Bundled **airport/city dataset** (OurAirports, public domain) for offline autocomplete:
  typing "New York" expands to `JFK,LGA,EWR` at no API cost.
- **Fixture mode** (`SERPAPI_MOCK=1`): replays saved responses so the UI can be built
  and tested without spending credits.

Run locally with `npm install && npm run dev` → http://localhost:3000

```
travel/
  .env.example
  app/
    page.tsx                  # dashboard
    api/search/route.ts       # fan-out: one call per cabin, in parallel
    api/returns/route.ts      # departure_token → return flights
    api/booking/route.ts      # booking_token → booking options
    api/pathfinder/route.ts   # hub split-ticket search
    api/flex/route.ts         # ±N day date grid
    api/account/route.ts      # credits remaining
  lib/
    serpapi.ts                # typed client, param builder, errors, retries
    cache.ts                  # SQLite TTL cache + budget guard
    normalize.ts              # SerpApi JSON → Itinerary model
    pathfinder.ts             # leg-combination logic
    points.ts                 # cash → points valuations
  data/airports.json
  components/                 # SearchForm, CabinStrip, ItineraryCard, PriceInsights, DateGrid, PathfinderTable
  fixtures/                   # recorded SerpApi responses for mock mode / tests
```

---

## 3. The dashboard

**Header:** SerpApi credits remaining · currency · points program selector

**Search panel:** From / To (city or airport autocomplete) · one-way / round-trip · dates ·
passengers · max stops · max price · airlines include/exclude · toggles for
*Flexible dates (±N)*, *Hub pathfinder*, *Show points*, *Deep search*

**Cabin comparison strip (main view):** four cards (Economy · Premium Economy ·
Business · First), each showing:
- the cheapest price and its points equivalent
- duration, number of stops, airlines
- a "low / typical / high" badge from `price_insights`
- the cheapest **and** the fastest option, so the trade-off is visible

**Results, one tab per cabin:** itinerary cards sorted by price / duration / stops.
Each card shows a segment timeline (airports, times, layovers, overnight warnings),
aircraft, legroom and CO₂.
- Expand → round-trip return options (1 credit, on demand)
- "Book" → booking options with airline/OTA links (1 credit, on demand)

**Price insights panel:** where today's price sits in the typical range, plus the price-history chart.

**Date grid (if flexible dates is on):** heatmap of the cheapest fare per day per cabin.

**Pathfinder table (if hub pathfinder is on):** split-ticket routes vs the through-ticket
price, with savings and a risk badge.

---

## 4. Points

The API has no award pricing, so there are two levels:

**Level A, points estimates (no extra cost; v1).** Convert each cash fare into points
using editable cents-per-point values for the programs you hold (Chase UR, Amex MR,
Capital One, Citi TY, Bilt, airline miles…). Example: $1,200 ÷ 1.5¢ = 80,000 pts.
This shows **what the cash fare costs in points**, for example through a card's travel
portal or a "pay with points" option. It does **not** show saver award space, and the
UI will say so.

**Level B, real award availability (optional, phase 4).** Use the **seats.aero Partner
API** (needs your own seats.aero Pro subscription and key, `SEATS_AERO_API_KEY`).
It returns cached award seats by program, cabin and date. Results appear in a Points
column next to the cash fare, with an estimated value per point
(cash price ÷ miles required).

---

## 5. Finding the cheapest path

Ordered from cheapest to most expensive in credits:

1. **Through-ticket search per cabin:** `sort_by=2`, `show_hidden=true`. Google already
   includes connecting itineraries here. *(4 credits)*
2. **Multi-airport expansion:** city → every nearby airport in one `departure_id`/`arrival_id`
   (e.g. `LON` = `LHR,LGW,STN,LTN,LCY,SEN`). *(no extra cost)*
3. **Flexible dates:** search ±N days around the chosen date for selected cabins.
   *(2N+1 credits per cabin)*
4. **Hub pathfinder (split tickets):** search `origin → hub` and `hub → destination` as
   separate one-way tickets for a set of hubs, then combine pairs that leave a safe
   connection buffer (default ≥ 3 h; next-day option). Hubs come from the layover
   airports seen in step 1 plus a curated list of major hubs. This often beats the
   through-fare, especially in premium cabins. It is flagged **separate tickets**:
   no protection if you miss the connection, and bags may need to be rechecked.
   *(2 × hubs credits per cabin)*

The final ranking shows the cheapest option per cabin across all enabled strategies,
labeled with the strategy that found it.

**Credit cost cheat-sheet**

| Action | Credits |
|---|---|
| Basic search, all 4 cabins | 4 |
| Expand round-trip returns | +1 per outbound |
| Booking options | +1 per itinerary |
| Flexible dates ±3, one cabin | +7 |
| Pathfinder, 5 hubs, one cabin | +10 |
| Repeating a search within the cache TTL | 0 |

---

## 6. Build phases

| Phase | Scope | Done when |
|---|---|---|
| **1. Foundation** | Scaffold, `.env`, SerpApi client, cache, budget guard, fixture mode, airport autocomplete, `/api/search` across the 4 cabins, cabin strip + itinerary lists | A JFK→LHR search shows the cheapest fare per cabin with full segment details |
| **2. Depth** | Price insights panel + chart, round-trip returns, booking options, credits meter, error states | You can click from a result to a booking link |
| **3. Points (Level A)** | Program valuations (editable, saved locally), points on every price | Each cabin card shows cash + points |
| **4. Pathfinder** | Flexible-date grid, hub split-ticket search, combined ranking; optional seats.aero Level B | Pathfinder shows split routes with savings vs through-fare |
| **5. Polish** | Route map, saved searches / history, price-drop watch (optional), responsive + dark mode, tests | — |

Tests: unit tests for `normalize`, `pathfinder` (connection-buffer logic) and `points`,
run against recorded fixtures.

---

## 7. Open decisions

1. **Stack:** Next.js (recommended) or Python (FastAPI/Streamlit)?
2. **Points:** estimates only (Level A), or also seats.aero award availability (Level B)?
3. **SerpApi plan size:** sets the default budget guard and whether flexible
   dates / pathfinder are on by default.
4. **Default trip type:** one-way or round-trip?
