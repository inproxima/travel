import airportsData from "@/data/airports.json";
import metrosData from "@/data/metros.json";
import type { LatLng } from "@/lib/models";

type Row = [iata: string, name: string, city: string, country: string, lat: number, lng: number, size: number];

export type AirportOption = {
  /** What goes into departure_id / arrival_id: one IATA code, or several joined by commas. */
  value: string;
  label: string;
  detail: string;
  kind: "metro" | "airport";
};

const AIRPORTS = airportsData as Row[];
const BY_CODE = new Map(AIRPORTS.map((r) => [r[0], r]));
const METROS = metrosData.metros;

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export function airportCoords(code: string): LatLng | null {
  const r = BY_CODE.get(code.trim().toUpperCase());
  return r ? { lat: r[4], lng: r[5] } : null;
}

export function airportCity(code: string): string | null {
  return BY_CODE.get(code.trim().toUpperCase())?.[2] ?? null;
}

/** Airports and multi-airport cities matching what the user typed. */
export function searchAirports(query: string, limit = 8): AirportOption[] {
  const q = fold(query.trim());
  if (q.length < 2) return [];
  const out: AirportOption[] = [];

  for (const m of METROS) {
    if (m.airports.length < 2) continue;
    if (fold(m.city).startsWith(q) || m.code.toLowerCase() === q) {
      out.push({ value: m.airports.join(","), label: `${m.city} (all airports)`, detail: m.airports.join(", "), kind: "metro" });
    }
  }

  const scored: { r: Row; score: number }[] = [];
  for (const r of AIRPORTS) {
    const code = r[0].toLowerCase();
    const city = fold(r[2]);
    const name = fold(r[1]);
    let score = 0;
    if (code === q) score = 100;
    else if (city.startsWith(q)) score = 60;
    else if (name.startsWith(q)) score = 50;
    else if (city.includes(q) || name.includes(q)) score = 30;
    if (score) scored.push({ r, score: score + r[6] * 5 });
  }
  scored.sort((a, b) => b.score - a.score);
  for (const { r } of scored) {
    if (out.length >= limit) break;
    out.push({ value: r[0], label: `${r[2] || r[1]} (${r[0]})`, detail: `${r[1]}, ${r[3]}`, kind: "airport" });
  }
  return out.slice(0, limit);
}
