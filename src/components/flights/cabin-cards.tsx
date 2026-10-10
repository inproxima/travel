"use client";

import { Clock, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/misc";
import { minutes, money } from "@/lib/format";
import { CABIN_NAMES, type Cabin, type Itinerary } from "@/lib/models";
import { cn } from "@/lib/utils";
import { stopsLabel } from "./flight-format";
import type { CabinResult } from "./types";

export function cheapest(its: Itinerary[]) {
  return its.reduce<Itinerary | null>((best, it) => (it.price != null && (best?.price == null || it.price < best.price) ? it : best), null);
}

export function fastest(its: Itinerary[]) {
  return its.reduce<Itinerary | null>((best, it) => (it.totalDurationMin != null && (best?.totalDurationMin == null || it.totalDurationMin < best.totalDurationMin) ? it : best), null);
}

const LEVEL_VARIANT: Record<string, "success" | "secondary" | "destructive"> = { low: "success", typical: "secondary", high: "destructive" };

/** The headline comparison: the cheapest way to fly in each cabin. */
export function CabinCards({
  cabins,
  results,
  currency,
  selected,
  onSelect,
  loading,
  extra,
}: {
  cabins: Cabin[];
  results: Partial<Record<Cabin, CabinResult>>;
  currency: string;
  selected: Cabin;
  onSelect: (c: Cabin) => void;
  loading: boolean;
  /** Extra line under the price, e.g. a points estimate. */
  extra?: (cabin: Cabin, price: number | null) => React.ReactNode;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" role="tablist" aria-label="Cabins">
      {cabins.map((c) => {
        const r = results[c];
        const low = r ? cheapest(r.itineraries) : null;
        const fast = r ? fastest(r.itineraries) : null;
        const level = r?.insights?.level?.toLowerCase();
        return (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={selected === c}
            onClick={() => onSelect(c)}
            className={cn(
              "flex flex-col gap-2 rounded-xl border bg-card p-4 text-left shadow-sm transition hover:shadow-md cursor-pointer",
              selected === c && "border-flights ring-1 ring-flights",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{CABIN_NAMES[c]}</span>
              {level && <Badge variant={LEVEL_VARIANT[level] ?? "secondary"}>{level}</Badge>}
            </div>
            {!r ? (
              loading ? (
                <Spinner className="my-3" />
              ) : (
                <span className="text-sm text-muted-foreground">Not searched</span>
              )
            ) : r.error ? (
              <span className="text-sm text-destructive">{r.error}</span>
            ) : !low ? (
              <span className="text-sm text-muted-foreground">No fares found</span>
            ) : (
              <>
                <div>
                  <p className="text-xs text-muted-foreground">from</p>
                  <p className="text-2xl font-semibold tabular-nums">{money(low.price, currency)}</p>
                  {extra?.(c, low.price)}
                </div>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="size-3.5" /> {minutes(low.totalDurationMin)} · {stopsLabel(low)} · {low.airlines[0]}
                </p>
                {fast && fast.id !== low.id && (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Zap className="size-3.5" /> Fastest {minutes(fast.totalDurationMin)} for {money(fast.price, currency)}
                  </p>
                )}
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
