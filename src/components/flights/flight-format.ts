import type { Itinerary } from "@/lib/models";

/** "2026-12-05 08:30" -> "08:30" */
export function clock(t: string | null | undefined): string {
  return t?.split(" ")[1] ?? "—";
}

/** Days between departure and arrival dates, for the "+1" marker. */
export function dayShift(dep: string | null | undefined, arr: string | null | undefined): number {
  if (!dep || !arr) return 0;
  return Math.round((Date.parse(arr.split(" ")[0]!) - Date.parse(dep.split(" ")[0]!)) / 86_400_000);
}

export function stopsLabel(it: Itinerary): string {
  if (it.stops === 0) return "Nonstop";
  const via = it.layovers.map((l) => l.code).filter(Boolean).join(", ");
  return `${it.stops} stop${it.stops > 1 ? "s" : ""}${via ? ` · ${via}` : ""}`;
}
