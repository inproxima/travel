import { describe, expect, it } from "vitest";
import { env, features, resetEnvCache } from "@/lib/env";
import { useTempEnv } from "./setup";

describe("env", () => {
  it("treats empty values as unset and applies defaults", () => {
    useTempEnv({ OPENAI_MODEL: "", AI_MAX_SERPAPI_CALLS: "", OPENAI_REASONING_EFFORT: "" });
    const e = env();
    expect(e.OPENAI_MODEL).toBe("gpt-6.1-sol");
    expect(e.AI_MAX_SERPAPI_CALLS).toBe(40);
    expect(e.OPENAI_REASONING_EFFORT).toBe("medium");
    expect(features()).toMatchObject({ serpapi: false, openai: false, seatsAero: false, mock: false });
  });

  it("turns everything on in mock mode, with an opt-out for seats.aero", () => {
    useTempEnv({ MOCK_MODE: "1" });
    expect(features()).toMatchObject({ serpapi: true, openai: true, seatsAero: true, mock: true });
    process.env.MOCK_NO_SEATSAERO = "1";
    resetEnvCache();
    expect(features().seatsAero).toBe(false);
  });

  it("rejects an unknown reasoning effort", () => {
    useTempEnv({ OPENAI_REASONING_EFFORT: "turbo" });
    expect(() => env()).toThrow(/OPENAI_REASONING_EFFORT/);
  });

  it("exposes the Google Maps browser key only when set, with Google's demo map ID by default", () => {
    useTempEnv();
    expect(features().googleMaps).toBeNull();
    useTempEnv({ GOOGLE_MAPS_API_KEY: "AIza-test" });
    expect(features().googleMaps).toEqual({ apiKey: "AIza-test", mapId: "DEMO_MAP_ID" });
    useTempEnv({ GOOGLE_MAPS_API_KEY: "AIza-test", GOOGLE_MAPS_MAP_ID: "abc123" });
    expect(features().googleMaps?.mapId).toBe("abc123");
  });
});
