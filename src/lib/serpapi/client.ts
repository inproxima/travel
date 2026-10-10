import { env } from "@/lib/env";
import { loadFixture, mockLatency, recordFixture, requestHash } from "@/lib/fixtures";
import { Budget } from "./budget";
import { cacheGet, cacheKey, cacheSet } from "./cache";

export const ENGINES = [
  "google_flights",
  "google_flights_deals",
  "google_hotels",
  "google_hotels_reviews",
  "tripadvisor",
  "tripadvisor_place",
  "tripadvisor_reviews",
  "google_maps",
  "google_maps_reviews",
  "google_maps_directions",
  "google_forums",
] as const;

export type Engine = (typeof ENGINES)[number];

export type SerpParams = Record<string, string | number | boolean | null | undefined>;

export type CallContext = {
  /** Credit budget for the user action this call belongs to. */
  budget?: Budget;
  signal?: AbortSignal;
};

export type SerpResult<T> = { data: T; cached: boolean };

export class SerpApiError extends Error {
  constructor(
    message: string,
    public readonly engine: Engine,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "SerpApiError";
  }
}

const ENDPOINT = "https://serpapi.com/search.json";

/** Google answers "no results" as an error; for the app that is just an empty list. */
const EMPTY_RESULT = /hasn't returned any results|no results/i;

function cleanParams(engine: Engine, params: SerpParams): Record<string, string> {
  const out: Record<string, string> = { engine };
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = String(v);
  }
  return out;
}

/** Which hand-built sample answers a request in mock mode. */
function mockVariant(engine: Engine, p: Record<string, string>): string | undefined {
  switch (engine) {
    case "google_flights":
      if (p.booking_token) return "booking";
      if (p.departure_token) return "returns";
      return `class-${p.travel_class ?? "1"}`;
    case "google_hotels":
      if (p.property_token) return "details";
      if (p.vacation_rentals === "true") return "rentals";
      if (p.next_page_token) return "page2";
      return undefined;
    default:
      return undefined;
  }
}

async function fetchLive(params: Record<string, string>, signal?: AbortSignal): Promise<Record<string, unknown>> {
  const url = `${ENDPOINT}?${new URLSearchParams({ ...params, api_key: env().SERPAPI_API_KEY })}`;
  const res = await fetch(url, { signal, headers: { accept: "application/json" }, cache: "no-store" });
  let body: Record<string, unknown>;
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    throw new SerpApiError(`SerpApi returned an unreadable response (HTTP ${res.status}).`, params.engine as Engine, res.status);
  }
  if (!res.ok && !(typeof body.error === "string" && EMPTY_RESULT.test(body.error))) {
    const msg = typeof body.error === "string" ? body.error : `HTTP ${res.status}`;
    throw new SerpApiError(`SerpApi: ${msg}`, params.engine as Engine, res.status);
  }
  return body;
}

/**
 * One SerpApi search. Results are cached locally; only uncached calls spend
 * a credit from `ctx.budget`. In mock mode, saved sample data is returned.
 */
export async function serpapi<T = Record<string, unknown>>(
  engine: Engine,
  params: SerpParams,
  ctx: CallContext = {},
): Promise<SerpResult<T>> {
  const e = env();
  const clean = cleanParams(engine, params);
  const key = cacheKey(clean);

  const hit = cacheGet<T>(key);
  if (hit !== undefined) return { data: hit, cached: true };

  if (!e.MOCK_MODE && !e.SERPAPI_API_KEY) {
    throw new SerpApiError("Add SERPAPI_API_KEY to .env to search (or start with ./run.sh mock).", engine);
  }

  ctx.budget?.reserve(1);
  try {
    ctx.signal?.throwIfAborted();
    let data: Record<string, unknown>;
    if (e.MOCK_MODE) {
      await mockLatency();
      data = (await loadFixture("serpapi", engine, requestHash(clean), mockVariant(engine, clean))) as Record<string, unknown>;
    } else {
      data = await fetchLive(clean, ctx.signal);
      await recordFixture("serpapi", engine, requestHash(clean), data);
    }

    if (typeof data.error === "string" && !EMPTY_RESULT.test(data.error)) {
      throw new SerpApiError(`SerpApi: ${data.error}`, engine);
    }
    cacheSet(key, engine, data);
    ctx.budget?.commit(1);
    return { data: data as T, cached: false };
  } catch (err) {
    ctx.budget?.release(1);
    throw err;
  }
}

export type AccountInfo = {
  plan: string | null;
  searchesPerMonth: number | null;
  searchesLeft: number | null;
  thisMonthUsage: number | null;
};

/** SerpApi Account API. It does not use search credits. */
export async function serpapiAccount(): Promise<AccountInfo> {
  const e = env();
  if (e.MOCK_MODE) return { plan: "Sample data", searchesPerMonth: 250, searchesLeft: 212, thisMonthUsage: 38 };
  if (!e.SERPAPI_API_KEY) throw new SerpApiError("SERPAPI_API_KEY is not set.", "google_flights");
  const res = await fetch(`https://serpapi.com/account.json?api_key=${encodeURIComponent(e.SERPAPI_API_KEY)}`, {
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || typeof body.error === "string") {
    throw new SerpApiError(`SerpApi account: ${String(body.error ?? `HTTP ${res.status}`)}`, "google_flights", res.status);
  }
  const num = (v: unknown) => (typeof v === "number" ? v : null);
  return {
    plan: typeof body.plan_name === "string" ? body.plan_name : null,
    searchesPerMonth: num(body.searches_per_month),
    searchesLeft: num(body.total_searches_left) ?? num(body.plan_searches_left),
    thisMonthUsage: num(body.this_month_usage),
  };
}
