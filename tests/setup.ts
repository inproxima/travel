import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resetEnvCache } from "@/lib/env";

/** Fresh database folder and env for one test file. */
export function useTempEnv(vars: Record<string, string> = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "travel-test-"));
  const keys = ["MOCK_MODE", "SERPAPI_API_KEY", "OPENAI_API_KEY", "SEATS_AERO_API_KEY", "DATA_DIR", "RECORD_FIXTURES", "MOCK_NO_SEATSAERO", "GOOGLE_MAPS_API_KEY", "GOOGLE_MAPS_MAP_ID", "OPENAI_MODEL", "OPENAI_REASONING_EFFORT", "AI_MAX_SERPAPI_CALLS"];
  for (const k of keys) delete process.env[k];
  Object.assign(process.env, { DATA_DIR: dir, ...vars });
  resetEnvCache();
  return dir;
}
