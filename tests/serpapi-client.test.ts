import { describe, expect, it } from "vitest";
import { Budget } from "@/lib/serpapi/budget";
import { cacheKey } from "@/lib/serpapi/cache";
import { serpapi, SerpApiError } from "@/lib/serpapi/client";
import { normalizeMaps } from "@/lib/serpapi/engines/google-maps";
import { useTempEnv } from "./setup";

describe("cacheKey", () => {
  it("ignores param order and the API key", () => {
    expect(cacheKey({ engine: "x", b: "2", a: "1", api_key: "secret" })).toBe(cacheKey({ a: "1", engine: "x", b: "2" }));
  });
});

describe("serpapi client (mock mode)", () => {
  it("spends one credit, then serves the same search from cache for free", async () => {
    useTempEnv({ MOCK_MODE: "1" });
    const budget = new Budget(1);
    const first = await serpapi("google_maps", { q: "Lisbon office" }, { budget });
    expect(first.cached).toBe(false);
    expect(budget.used).toBe(1);
    const again = await serpapi("google_maps", { q: "Lisbon office" }, { budget });
    expect(again.cached).toBe(true);
    expect(budget.used).toBe(1);
    expect(normalizeMaps(again.data)[0]?.coords).toEqual({ lat: 38.7181, lng: -9.1446 });
  });

  it("refuses to search without a key outside mock mode", async () => {
    useTempEnv();
    await expect(serpapi("google_maps", { q: "x" })).rejects.toBeInstanceOf(SerpApiError);
  });

  it("does not charge the budget when a call fails", async () => {
    useTempEnv({ MOCK_MODE: "1" });
    const budget = new Budget(2);
    const aborted = AbortSignal.abort();
    await expect(serpapi("google_forums", { q: "nothing here" }, { budget, signal: aborted })).rejects.toThrow();
    expect(budget.used).toBe(0);
  });
});
