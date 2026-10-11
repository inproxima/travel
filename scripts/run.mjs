// Launcher behind ./run.sh and run.cmd.
//
//   ./run.sh          start the app (http://localhost:3000)
//   ./run.sh mock     start with sample data: no keys, no credits
//   ./run.sh prod     production build + start (faster pages)
//   ./run.sh check    test your keys: 1 SerpApi credit, 1 seats.aero call, 1 small OpenAI call
//   ./run.sh check --full   also save one real response per SerpApi engine (about 12 credits)
//   ./run.sh test     typecheck, lint and unit tests

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

const [cmd = "dev", ...args] = process.argv.slice(2);
const COMMANDS = ["dev", "mock", "prod", "check", "test"];

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

function fail(msg) {
  console.error(c.red(msg));
  process.exit(1);
}

if (!COMMANDS.includes(cmd)) fail(`Unknown command "${cmd}". Use one of: ${COMMANDS.join(", ")}`);

// --- .env --------------------------------------------------------------------

function parseEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, "");
    out[m[1]] = v.trim();
  }
  return out;
}

const needsEnvFile = cmd === "dev" || cmd === "prod" || cmd === "check";
if (needsEnvFile && !fs.existsSync(".env")) {
  fs.copyFileSync(".env.example", ".env");
  console.log(c.bold("Created .env from .env.example."));
  console.log(`Open ${c.bold(path.join(root, ".env"))} in a text editor, paste your SerpApi key after`);
  console.log(`${c.bold("SERPAPI_API_KEY=")} (and your OpenAI key after ${c.bold("OPENAI_API_KEY=")}), save, then run this again.`);
  console.log(c.dim("Want to look around first? Run ./run.sh mock to use sample data with no keys."));
  process.exit(1);
}

const fileEnv = parseEnv(".env");
const conf = { ...fileEnv, ...process.env };
const port = conf.PORT || "3000";

// --- dependencies ------------------------------------------------------------

function mtime(p) {
  try {
    return fs.statSync(p).mtimeMs;
  } catch {
    return 0;
  }
}

function ensureDeps() {
  const installed = mtime("node_modules/.package-lock.json");
  if (installed && installed >= mtime("package-lock.json") && installed >= mtime("package.json")) return;
  console.log(c.bold("Installing dependencies (first run takes a minute)..."));
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const r = spawnSync(npm, ["install", "--no-audit", "--no-fund"], { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) fail("npm install failed. Check your internet connection and try again.");
}

// --- helpers -----------------------------------------------------------------

const childEnv = (extra = {}) => ({
  ...process.env,
  NEXT_TELEMETRY_DISABLED: "1",
  // Node's built-in SQLite prints an "experimental" warning on every start.
  NODE_OPTIONS: [process.env.NODE_OPTIONS, "--disable-warning=ExperimentalWarning"].filter(Boolean).join(" "),
  ...extra,
});

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");

function runNext(nextArgs, extraEnv) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [nextBin, ...nextArgs], { stdio: "inherit", env: childEnv(extraEnv) });
    const stop = () => child.kill("SIGINT");
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
    child.on("exit", (code) => resolve(code ?? 0));
  });
}

function warnMissingKeys() {
  const missing = [];
  if (!conf.SERPAPI_API_KEY) missing.push(`${c.yellow("SERPAPI_API_KEY")} is empty: searches are off.`);
  if (!conf.OPENAI_API_KEY) missing.push(`${c.yellow("OPENAI_API_KEY")} is empty: the AI Planner is off.`);
  if (!conf.SEATS_AERO_API_KEY) missing.push(`${c.dim("SEATS_AERO_API_KEY is empty: points show estimates (that's fine).")}`);
  if (!conf.GOOGLE_MAPS_API_KEY) missing.push(`${c.dim("GOOGLE_MAPS_API_KEY is empty: maps use OpenStreetMap (that's fine).")}`);
  for (const m of missing) console.log(`  • ${m}`);
  if (missing.length) console.log(c.dim(`  Edit ${path.join(root, ".env")} and restart to change this.\n`));
}

function banner(mode) {
  console.log(`\n${c.bold("Waypoint travel planner")} ${c.dim(`(${mode})`)}`);
  console.log(`Open ${c.green(`http://localhost:${port}`)} in your browser. Press Ctrl+C to stop.\n`);
}

// --- check ---------------------------------------------------------------------

function scrub(text) {
  let out = text;
  for (const k of [conf.SERPAPI_API_KEY, conf.OPENAI_API_KEY, conf.SEATS_AERO_API_KEY]) {
    if (k && k.length >= 8) out = out.split(k).join("[scrubbed]");
  }
  return out;
}

function save(name, body) {
  const dir = path.join(root, "fixtures", "recorded", "check");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.json`), scrub(JSON.stringify(body, null, 2)));
}

function isoDate(daysAhead) {
  const d = new Date(Date.now() + daysAhead * 86_400_000);
  return d.toISOString().slice(0, 10);
}

async function serp(params) {
  const qs = new URLSearchParams({ ...params, api_key: conf.SERPAPI_API_KEY });
  const res = await fetch(`https://serpapi.com/search.json?${qs}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || (body.error && !/hasn't returned any results/i.test(body.error))) {
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  save(params.engine, body);
  return body;
}

async function step(name, fn) {
  process.stdout.write(`  ${name.padEnd(34)} `);
  try {
    const detail = await fn();
    console.log(`${c.green("OK")}  ${c.dim(detail ?? "")}`);
    return true;
  } catch (e) {
    const offline = e.cause?.code === "ENOTFOUND" || e.cause?.code === "ECONNREFUSED" || e.message === "fetch failed";
    console.log(`${c.red("FAILED")}  ${offline ? "Couldn't reach the service. Check your internet connection." : e.message}`);
    return false;
  }
}

async function check() {
  const full = args.includes("--full");
  console.log(c.bold(`\nChecking your keys${full ? " and saving one response per SerpApi engine" : ""}...\n`));
  const results = [];

  if (!conf.SERPAPI_API_KEY) console.log(`  ${"SerpApi".padEnd(34)} ${c.yellow("SKIPPED")}  SERPAPI_API_KEY is empty`);
  else {
    results.push(
      await step("SerpApi account (free)", async () => {
        const res = await fetch(`https://serpapi.com/account.json?api_key=${encodeURIComponent(conf.SERPAPI_API_KEY)}`);
        const a = await res.json();
        if (!res.ok || a.error) throw new Error(a.error || `HTTP ${res.status}`);
        return `${a.plan_name ?? "plan"}: ${a.total_searches_left ?? a.plan_searches_left ?? "?"} searches left`;
      }),
    );
    let hotels;
    results.push(
      await step("Google Hotels search (1 credit)", async () => {
        hotels = await serp({ engine: "google_hotels", q: "Lisbon", check_in_date: isoDate(30), check_out_date: isoDate(33), adults: "2", currency: "USD" });
        return `${hotels.properties?.length ?? 0} hotels`;
      }),
    );

    if (full) {
      const token = hotels?.properties?.find((p) => p.property_token)?.property_token;
      const steps = [
        ["google_hotels details", () => serp({ engine: "google_hotels", q: "Lisbon", check_in_date: isoDate(30), check_out_date: isoDate(33), adults: "2", property_token: token }).then((r) => `${r.featured_prices?.length ?? 0} featured prices`)],
        ["google_hotels_reviews", () => serp({ engine: "google_hotels_reviews", property_token: token }).then((r) => `${r.reviews?.length ?? 0} reviews`)],
        ["tripadvisor", async () => {
          const r = await serp({ engine: "tripadvisor", q: "Lisbon hotels", ssrc: "h" });
          globalThis.__taId = r.places?.[0]?.place_id;
          return `${r.places?.length ?? 0} places`;
        }],
        ["tripadvisor_place", () => serp({ engine: "tripadvisor_place", place_id: globalThis.__taId }).then(() => "saved")],
        ["tripadvisor_reviews", () => serp({ engine: "tripadvisor_reviews", place_id: globalThis.__taId }).then((r) => `${r.reviews?.length ?? 0} reviews`)],
        ["google_maps", async () => {
          const r = await serp({ engine: "google_maps", type: "search", q: "Hotel Avenida Palace Lisbon" });
          const p = r.place_results ?? r.local_results?.[0];
          globalThis.__dataId = p?.data_id;
          return p?.title ?? "no match";
        }],
        ["google_maps_reviews", () => serp({ engine: "google_maps_reviews", data_id: globalThis.__dataId }).then((r) => `${r.reviews?.length ?? 0} reviews`)],
        ["google_maps_directions", () => serp({ engine: "google_maps_directions", start_addr: "Rossio, Lisbon", end_addr: "Belém Tower, Lisbon" }).then((r) => `${r.directions?.length ?? 0} routes`)],
        ["google_forums", () => serp({ engine: "google_forums", q: "where to stay in Lisbon" }).then((r) => `${r.organic_results?.length ?? 0} posts`)],
        ["google_flights", () => serp({ engine: "google_flights", departure_id: "JFK", arrival_id: "LHR", type: "2", outbound_date: isoDate(45), travel_class: "3" }).then((r) => `${(r.best_flights?.length ?? 0) + (r.other_flights?.length ?? 0)} itineraries`)],
        ["google_flights_deals", () => serp({ engine: "google_flights_deals", departure_id: "JFK" }).then((r) => `${Object.keys(r).filter((k) => Array.isArray(r[k])).join(", ")}`)],
      ];
      for (const [name, fn] of steps) results.push(await step(`${name} (1 credit)`, fn));
    }
  }

  if (!conf.SEATS_AERO_API_KEY) console.log(`  ${"seats.aero".padEnd(34)} ${c.dim("SKIPPED")}  optional, SEATS_AERO_API_KEY is empty`);
  else {
    results.push(
      await step("seats.aero award search", async () => {
        const qs = new URLSearchParams({ origin_airport: "JFK", destination_airport: "LHR", start_date: isoDate(30), end_date: isoDate(60), cabins: "business", take: "20" });
        const res = await fetch(`https://seats.aero/partnerapi/search?${qs}`, { headers: { "Partner-Authorization": conf.SEATS_AERO_API_KEY, accept: "application/json" } });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.message || body.error || `HTTP ${res.status}`);
        save("seatsaero_search", body);
        return `${body.data?.length ?? 0} award days found`;
      }),
    );
  }

  if (!conf.OPENAI_API_KEY) console.log(`  ${"OpenAI".padEnd(34)} ${c.yellow("SKIPPED")}  OPENAI_API_KEY is empty`);
  else {
    const model = conf.OPENAI_MODEL || "gpt-6.1-sol";
    const effort = conf.OPENAI_REASONING_EFFORT || "medium";
    results.push(
      await step(`OpenAI ${model} (${effort})`, async () => {
        const res = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: { authorization: `Bearer ${conf.OPENAI_API_KEY}`, "content-type": "application/json" },
          body: JSON.stringify({ model, reasoning: { effort }, input: "Reply with the single word OK." }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error?.message || `HTTP ${res.status}`);
        const text = body.output?.flatMap((o) => o.content ?? []).find((p) => p.type === "output_text")?.text;
        return `replied "${(text ?? "").trim().slice(0, 40)}"`;
      }),
    );
  }

  const failed = results.filter((r) => !r).length;
  console.log();
  if (results.length === 0) fail(`No keys to check yet. Add them to ${path.join(root, ".env")} and run ./run.sh check again.`);
  if (failed) fail(`${failed} check(s) failed. Fix the key or setting shown above, then run ./run.sh check again.`);
  console.log(c.green("All configured services work."));
  if (full) console.log(c.dim("Saved responses are in fixtures/recorded/check/ (keys removed)."));
}

// --- test --------------------------------------------------------------------

function runTests() {
  const steps = [
    ["Typecheck", [path.join(root, "node_modules", "typescript", "bin", "tsc"), "--noEmit"]],
    ["Lint", [path.join(root, "node_modules", "eslint", "bin", "eslint.js"), "."]],
    ["Unit tests", [path.join(root, "node_modules", "vitest", "vitest.mjs"), "run"]],
  ];
  for (const [name, argv] of steps) {
    console.log(c.bold(`\n▸ ${name}`));
    const r = spawnSync(process.execPath, argv, { stdio: "inherit", env: childEnv() });
    if (r.status !== 0) fail(`${name} failed.`);
  }
  console.log(c.green("\nAll checks passed."));
}

// --- main --------------------------------------------------------------------

ensureDeps();

switch (cmd) {
  case "dev":
    banner("development");
    warnMissingKeys();
    process.exit(await runNext(["dev", "-p", port]));
    break;
  case "mock":
    banner("sample data, no credits used");
    // Separate data folder so sample results never mix with your real cache.
    process.exit(await runNext(["dev", "-p", port], { MOCK_MODE: "1", DATA_DIR: path.join(root, ".data", "mock") }));
    break;
  case "prod": {
    warnMissingKeys();
    const built = await runNext(["build"]);
    if (built !== 0) fail("Build failed.");
    banner("production");
    process.exit(await runNext(["start", "-p", port]));
    break;
  }
  case "check":
    await check();
    break;
  case "test":
    runTests();
    break;
}
