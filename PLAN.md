# Travel Planner: Flights · Hotels · AI (SerpApi + seats.aero + OpenAI)

## Context
The repo (`inproxima/travel`, branch `claude/google-flights-dashboard-v3433t`) has only
`PLAN.md`, `.env.example` and `.gitignore`. That first plan covered a Google Flights dashboard;
**no app code exists yet**.

The user now wants a professional trip-planning app with **three modes**:

1. **Flights**: cash fares (Google Flights, 4 cabins) **and** points fares, using the loyalty
   programs the user says they hold.
2. **Hotels**: search hotels by destination and dates, with prices, reviews, location and
   neighborhood context.
3. **AI Planner**: the user types a free-form request ("hotel in Lisbon for 30 days from
   March 3, quiet, near my office"). The app gathers the relevant SerpApi data, then an OpenAI
   reasoning model reads it and returns a ranked shortlist with reasons and quoted evidence.

Decisions confirmed with the user:
- **Stack:** Next.js + TypeScript, started with `./run.sh`
- **Points:** real award seats from seats.aero when its key is set, plus estimates
- **AI scope:** hotels + area
- **AI budget:** about 40 SerpApi credits per question
- **Model:** set in `.env`; defaults `OPENAI_MODEL=gpt-6.1-sol` (in the official `openai` SDK
  model list) and `OPENAI_REASONING_EFFORT=medium`

**SerpApi engines:**
- Flights: `google_flights`, `google_flights_deals`
- Hotels: `google_hotels` (added: it provides the `property_token` that `google_hotels_reviews`
  needs), `google_hotels_reviews`
- TripAdvisor: `tripadvisor`, `tripadvisor_place`, `tripadvisor_reviews`
- Maps: `google_maps`, `google_maps_reviews`, `google_maps_directions`
- Forums: `google_forums`

**Sandbox constraint:** serpapi.com, seats.aero and api.openai.com are all blocked from the
cloud sandbox. So:
- All three get mock modes.
- The user runs a short live check (`run check`) right after Phase 1, not at the end.

---

## App shell (all modes)
- **Navigation:** Flights · Hotels · AI Planner · Settings
- **Header:** SerpApi credits left (Account API, free) and configured / not-configured badges
  for seats.aero and OpenAI
- **Settings page** (saved in local SQLite):
  - **My programs:** airline programs (seats.aero's 26 sources) and bank currencies (Amex MR,
    Chase UR, Capital One, Citi TY, Bilt), with an optional balance and a cents-per-point value
  - **My places:** named addresses ("Work", "Conference venue"). Each is **geocoded once when
    saved** with `google_maps` (1 credit, cached) so straight-line distances cost nothing later.
  - **Defaults:** currency, country, language
- **Credits shown up front:** every button that spends credits shows its cost, e.g.
  "Reviews · 1 credit"
- **UI:** Tailwind + shadcn/ui, dark/light mode, responsive. Maps use react-leaflet with
  OpenStreetMap tiles (no Google Maps key needed; SerpApi returns `gps_coordinates`).

## Mode 2: Hotels (built first; AI mode reuses its modules)
- **Search form:** destination, check-in/out, adults/children (+ages), price range, minimum
  rating (`7|8|9`), class (2–5), free cancellation, vacation rentals (suggested for stays of
  14+ nights), and sort (`3` price, `8` rating, `13` most reviewed).
- **Results:** list on the left, map on the right. Each card shows:
  - photo, class, rating and review count, location rating
  - nightly and total price (always use the `extracted_*` numbers)
  - free cancellation, and `nearby_places` transit times (free)
  - straight-line distance to My places
  - "Load more" uses `next_page_token`
- **Detail drawer** (each section loads only when opened):
  - **Prices:** `google_hotels` with `property_token` → `featured_prices` / `prices` with
    booking links, plus `typical_price_range`.
  - **Google reviews:** `google_hotels_reviews` (`sort_by` 1–4, category chips from
    `reviews_breakdown[].category_token`).
  - **TripAdvisor:**
    - Get the `place_id` from the `-d<id>` part of the TripAdvisor link in `other_reviews`
      (in the Prices response). If that's missing, run a `tripadvisor` search for
      `"<name> <city>"` with `ssrc=h` and match by name + GPS.
    - Then `tripadvisor_place` (ranking, award) and `tripadvisor_reviews` (one page,
      `type_of_visit` filter).
  - **Location:**
    - `google_maps_directions` from the hotel to each My place. `durations[]` gives drive,
      transit, walk and bike times in one call.
    - `google_maps_reviews` for the hotel with a keyword `query` box ("noise", "wifi") and
      `topics[]` chips. The `data_id` comes from the directions response's `places_info`;
      otherwise a `google_maps` lookup (1 credit).
  - **Forums:** `google_forums` with `q="<hotel> <city>"` and a recency window.

## Mode 3: AI Planner (hotels + area, ≤ 40 credits)
The model never calls APIs. My code gathers the data within a fixed budget, and the model only
parses the request, shortlists and ranks. This keeps cost predictable, and review or forum
text (untrusted input) can't trigger any actions.

1. **Parse** (LLM). Free text plus My places → `TripSpec`. It holds:
   - destination and dates or flexibility ("this month" → up to 3 check-in windows,
     "30 days" → 30 nights)
   - guests, budget, priorities, traveler type
   - places named in the request, geocoded at 1 credit each, max 2
2. **Estimate.** Build the research plan and show the **worst-case** cost:
   "Up to 38 of 40 credits · Run". If the worst case is over the cap, the planner first
   shrinks the shortlist (8 → 6), then drops optional steps.
3. **Gather.**
   - `google_hotels` for each window (page 2 only for a single window), plus a
     `vacation_rentals=true` search for stays of 14+ nights.
   - Dedupe by `property_token`.
   - **`google_forums` ×2** (neighborhoods / "where to stay <city>", and "long stay <city>")
     runs now, so it can shape the shortlist.
4. **Shortlist** (LLM). About 40 compact candidates, distances and forum snippets → 8 IDs
   with reasons.
5. **Research the 8.** `google_hotels_reviews` ×8 (with a `category_token` for the top
   priority) and `google_maps_directions` hotel → primary place ×8. Directions are skipped
   when there's no place, and use a weekday-morning departure in destination-local time.
6. **Narrow** (LLM, free) → 4 finalists.
7. **Research the 4.** `tripadvisor` search for `"<name> <city>"`, then `tripadvisor_reviews`
   filtered by traveler type. `google_maps_reviews` with `query` set to the top priority.
8. **Rank** (LLM). The output has:
   - the ranking, with a score breakdown (value, location/commute, reviews, fit to request)
   - pros and cons quoting review snippets, with their source
   - "best for" tags and caveats

   Code, not the model, computes totals and distances. The code drops unknown hotel IDs and
   any quote not found in the evidence.

| Step | Typical | Worst case |
|---|---|---|
| Geocode places in the request | 0 | 2 |
| Hotel search (+ page 2 / windows / vacation rentals) | 3 | 4 |
| Forums | 2 | 2 |
| Hotel reviews ×8 | 8 | 8 |
| Directions ×8 | 8 | 8 |
| TripAdvisor search + reviews ×4 | 8 | 8 |
| Maps reviews ×4 (`data_id` from directions; else +1 lookup each, only within the cap) | 4 | 4–8 |
| **Total** | **33** | **≤ 40 (enforced)** |

**Progress:** streamed from a `POST` with `fetch` (EventSource can't POST), e.g.
"Searching hotels Mar 3–Apr 2… 6/40". Closing the tab aborts the run (`request.signal`), so
credits stop being spent. Results show as ranked cards, a map and evidence drawers, and are
saved to history.

## Mode 1: Flights (tabs: Cash · Points · Deals)
- **Cash**
  - One `google_flights` call per cabin (`travel_class` 1–4, `sort_by=2`, `show_hidden=true`),
    run in parallel. Results show as 4 cabin cards plus a list per cabin and a price-insights
    chart.
  - Returns via `departure_token` and booking options via `booking_token`, loaded when clicked.
  - City → airports comes from a hand-curated `data/metros.json` (NYC = `JFK,LGA,EWR`);
    OurAirports has no city groups.
- **Points**
  - seats.aero `GET /partnerapi/search` (header `Partner-Authorization`) with
    `origin_airport`, `destination_airport`, `start_date`/`end_date` (±N days), `cabins`,
    `sources`.
  - Shows a date × program grid per cabin. `{Y,W,J,F}MileageCost` arrives as a string, so it
    is parsed. Also shown: seats left, the Direct flag and last-seen age.
  - `GET /trips/{id}` gives taxes (in cents), segments and booking links.
  - **"Programs I can use"** filter: programs held directly, or reachable by transfer from a
    held bank currency (`data/transfer-partners.json`, editable, labeled
    "verify before transferring").
  - **Value per point** = (one-way cash fare − taxes) ÷ miles, compared on the same date and
    cabin only (awards are one-way).
  - **No seats.aero key:** estimates = cash fare ÷ the cents-per-point value of each held
    program, clearly labeled as estimates.
- **Deals**
  - `google_flights_deals` with `departure_id`, an `outbound_date` window, `trip_length`,
    `travel_class`, `stops`, `max_price`.
  - It answers "where can I go cheaply" (it has no destination parameter). Results show as
    cards and a map; "Open" runs a cash search for that route.
  - Its normalizer is lenient because the response keys are unconfirmed until the first
    live run.

## Shared infrastructure
- **`src/lib/serpapi/client.ts`:** one `serpapi(engine, params, ctx)` function.
  - Sends `GET https://serpapi.com/search.json` with the key added on the server only.
  - Turns the `error` field into a typed error.
  - Uses an SQLite cache keyed by engine + sorted params.
  - **Budget ledger:** credits are reserved *before* parallel calls go out.
  - Passes the abort signal through.
- **Mock and record modes:**
  - `SERPAPI_MOCK=1` replays `fixtures/serpapi/<engine>/…`; seats.aero and OpenAI have
    matching mocks.
  - `RECORD_FIXTURES=1` saves live responses with keys and My-places addresses scrubbed.
- **`src/lib/serpapi/engines/<engine>.ts`:** one per engine, each with:
  - a param builder
  - a lenient zod schema
  - a normalizer into the app's models: `Itinerary`, `Hotel`, `Review` (one shape for Google
    Hotels, Maps and TripAdvisor), `Route`, `ForumPost`, `Deal`, `Award`
- **`src/lib/ai/`:**
  - OpenAI Responses API calls with `reasoning: { effort }` and
    `text.format = zodTextFormat(...)`. Strict mode means schemas use `.nullable()`, not
    `.optional()`.
  - Modules: `parse`, `plan` (cost estimate), `research`, `shortlist`, `rank`.
- **`src/lib/seatsaero.ts`** and **`src/lib/points/`** (programs, transfer reachability,
  value math).
- **`src/lib/db.ts`:** Node's built-in **`node:sqlite`** (no native build). Phase 1 confirms
  `next build` can import it; if not, fall back to JSON files in `.data/`.
- **`src/lib/env.ts`:** zod-validated env. A feature whose key is missing is disabled with a
  clear message rather than crashing.
- **API routes:** thin wrappers in `src/app/api/{hotels,tripadvisor,maps,forums,ai,flights,awards,account,settings}/…`.

## `.env.example` (replaces the current one)
```
SERPAPI_API_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-6.1-sol
OPENAI_REASONING_EFFORT=medium     # low | medium | high | xhigh | max (model-dependent)
SEATS_AERO_API_KEY=                # optional: real award seats (seats.aero Pro, personal use)
DEFAULT_COUNTRY=us
DEFAULT_LANGUAGE=en
DEFAULT_CURRENCY=USD
MAX_CALLS_PER_SEARCH=20            # Flights/Hotels guard
AI_MAX_SERPAPI_CALLS=40            # AI Planner budget per question
CACHE_TTL_MINUTES=60
PORT=3000
```

## Launcher: `run.sh` + `run.cmd` → `scripts/run.mjs`
`run.sh` (bash-3.2-safe, committed as executable) and `run.cmd` (Windows) only check that
**Node ≥ 22.13** is installed, then hand off to `scripts/run.mjs`. That script:
- Creates `.env` from `.env.example` when it's missing, says which key to add, and exits.
  Mock mode doesn't need a `.env`.
- Warns when keys are missing: no SerpApi key → live search off; no OpenAI key → AI Planner
  off; no seats.aero key → points shows estimates.
- Runs `npm install` when `node_modules` is missing or the lockfile changed.
- Subcommands:
  - `run` → dev server (`next dev -p $PORT`)
  - `run prod` → build + start
  - `run mock` → every service mocked, no keys needed
  - `run check` → free SerpApi Account call, 1 `google_hotels` call, 1 seats.aero call,
    1 tiny OpenAI call with the configured model and effort; prints pass/fail and records
    scrubbed fixtures
  - `run test` → typecheck, lint, Vitest
- Prints the URL.

## Build phases (each committed and pushed)
1. **Foundation:**
   - Next.js scaffold, launcher, `.env.example`, env validation
   - SerpApi client, cache, budget ledger, mock/record modes, `node:sqlite` check
   - app shell, Settings (programs, My places with geocoding), credits badge
   - `PLAN.md` updated to this scope
   - **→ the user runs `./run.sh check`** (and, optionally, pushes the recorded fixtures)
2. **Hotels:** search, map, detail drawer (prices, Google and TripAdvisor reviews,
   directions, maps reviews, forums).
3. **AI Planner:** parse → estimate → gather → shortlist → research → narrow → rank,
   streamed progress, results UI, history.
4. **Flights · Cash + Deals.**
5. **Flights · Points:** seats.aero, transfer partners, estimates, value per point.
6. **Polish:** empty and error states, accessibility pass, README with setup steps and
   screenshots.

## Verification
- **`run test`:** `tsc --noEmit`, ESLint, and Vitest covering:
  - normalizers
  - cache keys
  - the budget ledger (reservation under parallel calls; never over the cap)
  - the AI planner's worst-case estimate staying ≤ 40 for 1- and 3-window requests and with
    named places
  - rank post-processing (drops unknown IDs and quotes not found in the evidence)
  - transfer reachability and value math

  These tests prove little until real fixtures replace the hand-built ones; Phase 1's
  `run check` closes that gap.
- **In the sandbox:** `run mock`, then Playwright (pre-installed Chromium) clicks through
  Settings, Hotels, AI Planner, Flights cash and points (with and without the seats.aero
  mock). Screenshots go to the user.
- **Live (on the user's machine):**
  - `./run.sh check` after Phase 1
  - after each phase, one real search in that mode (e.g. a Lisbon hotel search with every
    drawer section, one AI question, JFK→LHR cash, a points search)
- **Faster alternative:** if the user adds the keys as environment variables and allows
  `serpapi.com`, `api.openai.com` and `seats.aero` in this cloud environment's network
  settings, I can run the live checks myself.

## API reference (from research)
- **`google_maps_directions`:**
  - `travel_mode` codes: `6` best (default), `0` drive, `9` two-wheeler, `3` transit,
    `2` walk, `1` cycle, `4` flight
  - Start and end take `*_addr`, `*_coords` (`lat,lng`) or `*_data_id`.
  - `time=depart_at:<unix>`.
  - `durations[]` lists every mode; `distance` is in meters and `duration` in seconds.
  - `places_info[].data_id` identifies the endpoints.
- **`google_maps`:**
  - Takes `place_id` or `data_cid`; it has **no** `data_id` parameter.
  - `google_maps_reviews` takes `data_id` or `place_id`, plus `query` / `topic_id` /
    `sort_by` (`qualityScore`, `newestFirst`, `ratingHigh`, `ratingLow`).
  - `num` is not allowed on page 1, and paging uses `next_page_token`.
- **`google_hotels`:**
  - Details come from re-calling with `property_token` (same `q`, dates and guests).
  - Its `other_reviews[].source_number` selects a source in `google_hotels_reviews`
    (`sort_by` 1 helpful, 2 recent, 3 high, 4 low).
- **TripAdvisor:**
  - `tripadvisor` takes `ssrc` (`h` hotels, `r` restaurants, `A` attractions, `f` forums) and
    pages with `offset`/`limit`.
  - `tripadvisor_reviews` takes `place_id`, `type_of_visit`, `rating`, `month`, and
    `offset`/`limit` (max 20).
- **`google_forums`:** `q` is required; recency via `period_unit`+`period_value` or
  `start_date`/`end_date` (`YYYYMMDD`).
- **`google_flights_deals`:** `departure_id`; `outbound_date` is a date or `start,end`; only
  one of `return_date`, `travel_duration` or `trip_length`; no `arrival_id`.
- **seats.aero:**
  - Base URL `https://seats.aero/partnerapi`.
  - `/search` uses plural `cabins`; `/availability` uses singular `cabin`.
  - Responses are `{data, count, hasMore, cursor}`.
  - `include_filtered=true` shows dynamic awards.
  - Limits: 1,000 calls a day, Pro plan only, personal use only.
