import crypto from "node:crypto";
import { z } from "zod";
import programs from "@/data/programs.json";
import { getDb, kvGet, kvSet } from "@/lib/db";
import { env } from "@/lib/env";
import type { SavedPlace } from "@/lib/models";
import { Budget } from "@/lib/serpapi/budget";
import { geocode } from "@/lib/serpapi/engines/google-maps";

export type ProgramDef = { id: string; name: string; cpp: number };
export const AIRLINE_PROGRAMS: ProgramDef[] = programs.airlines;
export const BANK_PROGRAMS: ProgramDef[] = programs.banks;
export const ALL_PROGRAMS = [...AIRLINE_PROGRAMS, ...BANK_PROGRAMS];

export const holdingSchema = z.object({
  held: z.boolean(),
  balance: z.number().int().nonnegative().nullable(),
  cpp: z.number().positive().max(20),
});
export type Holding = z.infer<typeof holdingSchema>;

export const settingsSchema = z.object({
  programs: z.record(z.string(), holdingSchema),
  currency: z.string().trim().min(3).max(3).toUpperCase(),
  country: z.string().trim().min(2).max(2).toLowerCase(),
  language: z.string().trim().min(2).max(8),
});
export type Settings = z.infer<typeof settingsSchema>;

function defaults(): Settings {
  const e = env();
  return {
    programs: Object.fromEntries(ALL_PROGRAMS.map((p) => [p.id, { held: false, balance: null, cpp: p.cpp }])),
    currency: e.DEFAULT_CURRENCY.toUpperCase(),
    country: e.DEFAULT_COUNTRY.toLowerCase(),
    language: e.DEFAULT_LANGUAGE,
  };
}

export function getSettings(): Settings {
  const base = defaults();
  const saved = kvGet<Partial<Settings>>("settings");
  if (!saved) return base;
  return {
    ...base,
    ...saved,
    // Programs added to programs.json after the user saved still show up.
    programs: { ...base.programs, ...(saved.programs ?? {}) },
  };
}

export function saveSettings(next: Settings): Settings {
  const parsed = settingsSchema.parse(next);
  kvSet("settings", parsed);
  return getSettings();
}

type PlaceRow = { id: string; label: string; address: string; lat: number | null; lng: number | null };

function toPlace(r: PlaceRow): SavedPlace {
  return {
    id: r.id,
    label: r.label,
    address: r.address,
    coords: r.lat != null && r.lng != null ? { lat: r.lat, lng: r.lng } : null,
  };
}

export function listPlaces(): SavedPlace[] {
  const rows = getDb().prepare("SELECT id, label, address, lat, lng FROM places ORDER BY created_at").all() as PlaceRow[];
  return rows.map(toPlace);
}

/** Saves a place and looks up its coordinates once (1 SerpApi credit, then cached). */
export async function addPlace(label: string, address: string): Promise<SavedPlace> {
  const found = await geocode(address, { budget: new Budget(1) }, getSettings().language);
  if (!found?.coords) throw new Error(`Couldn't find "${address}" on Google Maps. Try a fuller address.`);
  const row: PlaceRow = {
    id: crypto.randomUUID(),
    label: label.trim(),
    address: found.address ?? address.trim(),
    lat: found.coords.lat,
    lng: found.coords.lng,
  };
  getDb()
    .prepare("INSERT INTO places (id, label, address, lat, lng, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(row.id, row.label, row.address, row.lat, row.lng, Date.now());
  return toPlace(row);
}

export function deletePlace(id: string) {
  getDb().prepare("DELETE FROM places WHERE id = ?").run(id);
}
