// Builds src/data/airports.json from the OurAirports CSV (public domain):
//   curl -L -o airports.csv https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv
//   node scripts/build-airports.mjs airports.csv
// Keeps airports with an IATA code and scheduled service: [iata, name, city, country, lat, lng, size].

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [, , csvPath] = process.argv;
if (!csvPath) {
  console.error("Usage: node scripts/build-airports.mjs path/to/airports.csv");
  process.exit(1);
}

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

const lines = fs.readFileSync(csvPath, "utf8").split(/\r?\n/);
const header = parseCsvLine(lines[0]);
const col = (name) => header.indexOf(name);
const [TYPE, NAME, LAT, LNG, COUNTRY, CITY, SCHED, IATA] = ["type", "name", "latitude_deg", "longitude_deg", "iso_country", "municipality", "scheduled_service", "iata_code"].map(col);

const rows = [];
for (const line of lines.slice(1)) {
  if (!line) continue;
  const f = parseCsvLine(line);
  const iata = f[IATA];
  if (!/^[A-Z]{3}$/.test(iata) || f[SCHED] !== "yes") continue;
  if (f[TYPE] !== "large_airport" && f[TYPE] !== "medium_airport") continue;
  rows.push([iata, f[NAME], f[CITY] || "", f[COUNTRY], Math.round(Number(f[LAT]) * 1e4) / 1e4, Math.round(Number(f[LNG]) * 1e4) / 1e4, f[TYPE] === "large_airport" ? 2 : 1]);
}
rows.sort((a, b) => b[6] - a[6] || a[0].localeCompare(b[0]));

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "data", "airports.json");
fs.writeFileSync(out, JSON.stringify(rows));
console.log(`Wrote ${rows.length} airports to ${out}`);
