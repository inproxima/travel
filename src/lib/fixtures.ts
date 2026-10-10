import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { env } from "@/lib/env";
import { getDb } from "@/lib/db";

// Sample data for mock mode, and recording of live responses into fixtures.
//
// Lookup order in mock mode:
//   fixtures/recorded/<service>/<name>/<hash>.json   exact request recorded live
//   fixtures/<service>/<name>/<variant>.json         hand-built sample for this kind of request
//   fixtures/<service>/<name>/default.json

const ROOT = () => path.join(process.cwd(), "fixtures");

export function requestHash(parts: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 16);
}

async function readJson(file: string): Promise<unknown | undefined> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw e;
  }
}

export async function loadFixture(
  service: string,
  name: string,
  hash: string,
  variant?: string,
): Promise<unknown> {
  const candidates = [
    path.join(ROOT(), "recorded", service, name, `${hash}.json`),
    ...(variant ? [path.join(ROOT(), service, name, `${variant}.json`)] : []),
    path.join(ROOT(), service, name, "default.json"),
  ];
  for (const file of candidates) {
    const data = await readJson(file);
    if (data !== undefined) return data;
  }
  throw new Error(`No sample data for ${service}/${name} (mock mode).`);
}

/** Feels like a network call so loading states can be seen in mock mode. */
export function mockLatency(min = 120, max = 450) {
  return new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));
}

/** Strings that must never be written to a fixture: API keys and the user's saved addresses. */
function secrets(): string[] {
  const e = env();
  const keys = [e.SERPAPI_API_KEY, e.OPENAI_API_KEY, e.SEATS_AERO_API_KEY].filter((k) => k.length >= 8);
  let addresses: string[] = [];
  try {
    addresses = (getDb().prepare("SELECT address FROM places").all() as { address: string }[])
      .map((r) => r.address)
      .filter((a) => a.length >= 6);
  } catch {
    // No database yet: nothing saved to scrub.
  }
  return [...keys, ...addresses];
}

export function scrub(text: string): string {
  let out = text;
  for (const s of secrets()) out = out.split(s).join("[scrubbed]");
  return out;
}

export async function recordFixture(service: string, name: string, hash: string, body: unknown) {
  if (!env().RECORD_FIXTURES) return;
  const dir = path.join(ROOT(), "recorded", service, name);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${hash}.json`), scrub(JSON.stringify(body, null, 2)));
}
