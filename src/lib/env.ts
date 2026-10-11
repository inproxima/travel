import { z } from "zod";

// Empty strings in .env ("KEY=") mean "not set", so defaults apply.
const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const str = (fallback: string) => z.preprocess(blankToUndefined, z.string().trim().default(fallback));
const int = (fallback: number) => z.preprocess(blankToUndefined, z.coerce.number().int().positive().default(fallback));
const flag = z.preprocess(blankToUndefined, z.enum(["0", "1", "true", "false"]).default("0")).transform((v) => v === "1" || v === "true");

export const REASONING_EFFORTS = ["none", "minimal", "low", "medium", "high", "xhigh", "max"] as const;

const schema = z.object({
  SERPAPI_API_KEY: str(""),
  OPENAI_API_KEY: str(""),
  OPENAI_MODEL: str("gpt-6.1-sol"),
  OPENAI_REASONING_EFFORT: z.preprocess(blankToUndefined, z.enum(REASONING_EFFORTS).default("medium")),
  SEATS_AERO_API_KEY: str(""),
  /** Browser key for the Maps JavaScript API. Optional: without it, maps use OpenStreetMap. */
  GOOGLE_MAPS_API_KEY: str(""),
  /** Map ID from Google Cloud (Map management). DEMO_MAP_ID is Google's testing ID. */
  GOOGLE_MAPS_MAP_ID: str("DEMO_MAP_ID"),
  DEFAULT_COUNTRY: str("us"),
  DEFAULT_LANGUAGE: str("en"),
  DEFAULT_CURRENCY: str("USD"),
  MAX_CALLS_PER_SEARCH: int(20),
  AI_MAX_SERPAPI_CALLS: int(40),
  CACHE_TTL_MINUTES: int(60),
  /** Replays saved sample data for every service. No keys or credits needed. */
  MOCK_MODE: flag,
  /** In mock mode, behave as if no seats.aero key is set (to see the estimates-only points view). */
  MOCK_NO_SEATSAERO: flag,
  /** Saves live responses under fixtures/recorded/ with keys and saved addresses scrubbed. */
  RECORD_FIXTURES: flag,
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid .env settings: ${problems}`);
  }
  cached = parsed.data;
  return cached;
}

/** Test hook: forget the parsed env so changes to process.env are picked up. */
export function resetEnvCache() {
  cached = undefined;
}

export type Features = {
  mock: boolean;
  serpapi: boolean;
  openai: boolean;
  seatsAero: boolean;
  model: string;
  reasoningEffort: string;
  /**
   * Google Maps loads in the browser, so its key has to reach the browser. That key is
   * meant to be public and is protected by its HTTP-referrer restriction in Google Cloud.
   */
  googleMaps: { apiKey: string; mapId: string } | null;
};

/**
 * What the app can do with the keys that are configured. Safe to send to the browser:
 * server keys appear only as on/off flags; the Google Maps browser key is the one exception.
 */
export function features(): Features {
  const e = env();
  return {
    mock: e.MOCK_MODE,
    serpapi: e.MOCK_MODE || e.SERPAPI_API_KEY !== "",
    openai: e.MOCK_MODE || e.OPENAI_API_KEY !== "",
    seatsAero: e.MOCK_MODE ? !e.MOCK_NO_SEATSAERO : e.SEATS_AERO_API_KEY !== "",
    model: e.OPENAI_MODEL,
    reasoningEffort: e.OPENAI_REASONING_EFFORT,
    googleMaps: e.GOOGLE_MAPS_API_KEY ? { apiKey: e.GOOGLE_MAPS_API_KEY, mapId: e.GOOGLE_MAPS_MAP_ID } : null,
  };
}
