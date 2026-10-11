# Waypoint: travel planner

A local web app with three modes:

- **Flights**: the cheapest fares in Economy, Premium Economy, Business and First (Google Flights via SerpApi). Award seats you can book with points (seats.aero), or points estimates. Cheap destinations from your airport.
- **Hotels**: hotels for your dates, with prices from every booking site, Google and Tripadvisor reviews, travel times to your own places, and forum posts.
- **AI Planner**: describe your stay in plain words ("30 nights in Lisbon from March 3, quiet, near my office, under $250"). It searches, reads the reviews and returns a ranked shortlist with reasons and quotes you can check.

Everything runs on your computer. Your API keys stay in a local `.env` file and are never sent to the browser. The one exception is the optional Google Maps key, which Google designs to be used in the browser (see [Google Maps](#google-maps-optional)).

## Quick start

1. **Install Node.js 22.13 or newer** (the LTS version) from <https://nodejs.org>.
2. **Get the code:**
   ```
   git clone https://github.com/inproxima/travel.git
   cd travel
   ```
3. **Start it once.** It creates `.env` for you and stops:
   - Mac/Linux: `./run.sh`
   - Windows: `run.cmd`
4. **Add your keys.** Open `.env` in any text editor and paste each key after the `=`, then save:
   ```
   SERPAPI_API_KEY=your_serpapi_key
   OPENAI_API_KEY=your_openai_key
   ```
5. **Check the keys** (uses about 1 SerpApi credit): `./run.sh check`
6. **Start the app:** `./run.sh`, then open <http://localhost:3000>.

Want to look around before adding keys? Run `./run.sh mock`. Every result is sample data and nothing is spent.

## Keys and settings (`.env`)

| Setting | What it's for |
|---|---|
| `SERPAPI_API_KEY` | **Required.** Flights, hotels, reviews, maps, directions, forums. <https://serpapi.com/manage-api-key> |
| `OPENAI_API_KEY` | The AI Planner. <https://platform.openai.com/api-keys> |
| `OPENAI_MODEL` | Model for the AI Planner. Default `gpt-6.1-sol`. |
| `OPENAI_REASONING_EFFORT` | `low`, `medium` (default), `high`, `xhigh` or `max`. Which values work depends on the model. |
| `SEATS_AERO_API_KEY` | Optional. Real award seats for points flights. Needs a seats.aero Pro subscription; personal use only. Without it, points show estimates. |
| `GOOGLE_MAPS_API_KEY` | Optional. Shows Google's map instead of OpenStreetMap. See [Google Maps](#google-maps-optional). |
| `GOOGLE_MAPS_MAP_ID` | Optional. Your own map ID; empty uses Google's demo ID. |
| `DEFAULT_CURRENCY`, `DEFAULT_COUNTRY`, `DEFAULT_LANGUAGE` | Defaults, also editable in Settings. |
| `MAX_CALLS_PER_SEARCH` | Most SerpApi credits one Flights or Hotels action may use (default 20). |
| `AI_MAX_SERPAPI_CALLS` | Most SerpApi credits one AI Planner question may use (default 40). |
| `CACHE_TTL_MINUTES` | Identical searches within this time are answered from the local cache for free (default 60). |
| `PORT` | Default 3000. |

Restart the app after editing `.env`.

## Commands

| Mac/Linux | Windows | Does |
|---|---|---|
| `./run.sh` | `run.cmd` | Start the app |
| `./run.sh mock` | `run.cmd mock` | Start with sample data, with no keys and no credits used |
| `./run.sh prod` | `run.cmd prod` | Faster production build |
| `./run.sh check` | `run.cmd check` | Test your keys (about 1 SerpApi credit) |
| `./run.sh check --full` | `run.cmd check --full` | Also save one real response per SerpApi engine to `fixtures/recorded/check/`, with keys removed (about 12 credits) |
| `./run.sh test` | `run.cmd test` | Typecheck, lint and unit tests |

The first run installs dependencies automatically. Run only one copy of the app at a time.

## What things cost

Every button that spends SerpApi credits shows the cost before you click it. Repeat searches within the cache time are free, both in this app and on SerpApi's side.

| Action | SerpApi credits |
|---|---|
| Flight search | 1 per cabin (4 for all cabins) |
| Return flights, or where to book | 1 each |
| Flight deals | 1 |
| Hotel search, or one more page | 1 |
| Hotel booking prices, Google reviews, travel times, forum search | 1 each |
| Tripadvisor for a hotel | up to 3 |
| Google Maps review search | 1–2 |
| Saving a place in Settings | 1 (to find it on the map) |
| AI Planner question | about 30–40; the exact maximum is shown before you run it |
| Award seats (seats.aero) | 0 SerpApi credits (seats.aero allows 1,000 calls a day) |

OpenAI usage for the AI Planner is billed by OpenAI: four model calls per question.

## Points

- **Settings → My programs:** turn on the card points and airline programs you hold. Add your balances and what a point is worth to you, in cents.
- **With a seats.aero key**, the Points tab shows real award space by program and date. It shows which of your programs or card transfers can pay for each award, and the value per mile against the cash fare.
- **Without one**, it shows estimates: the cash fare divided by your value per point. Think of that as paying with points through a card's travel portal. It is not award availability.
- **Transfer partners** are in `src/data/transfer-partners.json` and loyalty programs in `src/data/programs.json`. Partners and ratios change; check your card issuer's site before transferring.

## Google Maps (optional)

Without a Google key the app draws its maps with OpenStreetMap, at no cost. To get Google's map instead:

1. Go to the [Google Cloud console](https://console.cloud.google.com/) and create a project, e.g. "Waypoint".
2. **Link a billing account.** Google requires one even for free use. Maps loaded in the app count as "Dynamic Maps". The free monthly allowance is about 10,000 map loads; after that Google charges per 1,000. Check [Google's pricing page](https://developers.google.com/maps/billing/overview/) for current numbers. Under **Billing → Budgets & alerts**, add an alert so there are no surprises.
3. **APIs & Services → Library**, search for **Maps JavaScript API**, and press **Enable**.
4. **APIs & Services → Credentials → Create credentials → API key.** Copy the key.
5. **Restrict the key** by opening it in Credentials:
   - Application restrictions: **Websites**, with `http://localhost:3000/*` and `http://127.0.0.1:3000/*`. Use your `PORT` if you changed it.
   - API restrictions: **Restrict key** and choose **Maps JavaScript API**.
6. *(Optional)* **Google Maps Platform → Map management → Create map ID**, with type JavaScript and Vector. Put it in `GOOGLE_MAPS_MAP_ID`. Without one the app uses Google's `DEMO_MAP_ID`, which is meant for testing.
7. Add `GOOGLE_MAPS_API_KEY=your_key` to `.env` and restart `./run.sh`. Settings → Connections shows "Google map view is on".

This key is sent to your browser, because Google Maps runs there; the website restriction in step 5 is what stops anyone else from using it. If the key is rejected, billing is off, or you're offline, the app shows OpenStreetMap with a short note instead of a broken map. Place details, reviews and travel times still come from SerpApi either way.

## Your data

Searches, settings, saved places and AI Planner history live in `.data/travel.db` on your computer. The only outside calls go to SerpApi, OpenAI (AI Planner) and seats.aero (if set up). Maps load from Google Maps if you added a key, otherwise from OpenStreetMap/CARTO.

## Troubleshooting

- **"Node.js … is too old":** install the current LTS from nodejs.org.
- **"Another next dev server is already running":** the app is already open in another terminal. Use that one, or stop it with Ctrl+C.
- **Port 3000 is busy:** set `PORT=3001` in `.env`.
- **SerpApi errors** (invalid key, out of searches): run `./run.sh check`. The credits badge in the header shows how many searches are left.
- **OpenAI 404 or "model not found":** change `OPENAI_MODEL`. **400 about reasoning:** try `OPENAI_REASONING_EFFORT=medium`.
- **seats.aero 401/403:** API access needs a Pro subscription and isn't enabled for every account.
- **"Google Maps couldn't load":** check that the Maps JavaScript API is enabled, billing is linked, and the key allows `http://localhost:3000/*`. Restriction changes can take a few minutes to apply. The browser console shows Google's exact error, e.g. `RefererNotAllowedMapError`.

## For developers

- Next.js 16 (App Router) + TypeScript, Tailwind CSS 4, Radix primitives, Recharts, and maps from Google (`@vis.gl/react-google-maps`) or Leaflet/OpenStreetMap. Storage uses Node's built-in `node:sqlite`.
- `src/lib/serpapi/`: one client with a cache, credit budget and mock/record modes, plus one module per engine. Each module turns the raw response into the app's models (`src/lib/models.ts`) with lenient zod parsing.
- `src/lib/ai/`: the AI Planner. The model only parses the request, shortlists and ranks. Code gathers the data within the credit cap, computes prices, distances and the match score, and drops any quote that isn't in the evidence.
- `src/lib/seatsaero.ts` and `src/lib/points/`: award search, transfer routes and value math.
- Tests: `./run.sh test` (unit). `npm run e2e` runs browser tests against a production build in sample-data mode (run `npx playwright install chromium` once first).
- Sample data: `node scripts/gen-fixtures.mjs` writes `fixtures/serpapi/`. Real responses saved with `./run.sh check --full` are more trustworthy than the hand-built samples.
- `PLAN.md` has the design and the research notes on each API.
