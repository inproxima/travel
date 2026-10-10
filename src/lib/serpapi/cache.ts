import { getDb } from "@/lib/db";
import { env } from "@/lib/env";

/** Stable key: engine + params sorted by name. The API key never takes part. */
export function cacheKey(params: Record<string, string>): string {
  const entries = Object.entries(params)
    .filter(([k]) => k !== "api_key" && k !== "no_cache")
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

export function cacheGet<T>(key: string): T | undefined {
  const ttlMs = env().CACHE_TTL_MINUTES * 60_000;
  const row = getDb().prepare("SELECT body, created_at FROM cache WHERE key = ?").get(key) as
    | { body: string; created_at: number }
    | undefined;
  if (!row) return undefined;
  if (Date.now() - row.created_at > ttlMs) {
    getDb().prepare("DELETE FROM cache WHERE key = ?").run(key);
    return undefined;
  }
  return JSON.parse(row.body) as T;
}

export function cacheSet(key: string, engine: string, body: unknown) {
  getDb()
    .prepare(
      `INSERT INTO cache (key, engine, body, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET body = excluded.body, created_at = excluded.created_at`,
    )
    .run(key, engine, JSON.stringify(body), Date.now());
}
