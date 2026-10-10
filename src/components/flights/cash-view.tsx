"use client";

import * as React from "react";
import { Plane } from "lucide-react";
import { EmptyState, Notice, Skeleton } from "@/components/ui/misc";
import { NativeSelect } from "@/components/ui/input";
import { CABIN_NAMES, type Cabin, type Itinerary } from "@/lib/models";
import { cn } from "@/lib/utils";
import { CabinCards } from "./cabin-cards";
import { ItineraryRow } from "./itinerary-row";
import { PriceChart } from "./price-chart";
import type { FlightSearchResponse } from "./types";

type Sort = "price" | "duration" | "departure";

const sorters: Record<Sort, (a: Itinerary, b: Itinerary) => number> = {
  price: (a, b) => (a.price ?? Infinity) - (b.price ?? Infinity),
  duration: (a, b) => (a.totalDurationMin ?? Infinity) - (b.totalDurationMin ?? Infinity),
  departure: (a, b) => (a.segments[0]?.from.time ?? "").localeCompare(b.segments[0]?.from.time ?? ""),
};

export function CashResults({
  data,
  loading,
  error,
  cabins,
  query,
  roundTrip,
  priceExtra,
}: {
  data?: FlightSearchResponse;
  loading: boolean;
  error?: string;
  cabins: Cabin[];
  query: Record<string, unknown>;
  roundTrip: boolean;
  priceExtra?: (cabin: Cabin, price: number | null) => React.ReactNode;
}) {
  const [cabin, setCabin] = React.useState<Cabin>(cabins[0] ?? 1);
  const [sort, setSort] = React.useState<Sort>("price");
  const [maxStops, setMaxStops] = React.useState<number | null>(null);
  const active = cabins.includes(cabin) ? cabin : (cabins[0] ?? 1);

  if (error) return <Notice tone="error" title="Search failed">{error}</Notice>;
  if (!data && !loading) {
    return (
      <EmptyState icon={<Plane />} title="Find the cheapest way to fly">
        Searches Google Flights in every cabin you pick, cheapest first, including the extra results behind “View more flights”. Round trips let you pick an outbound, then a return.
      </EmptyState>
    );
  }
  if (!data) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cabins.map((c) => (
          <Skeleton key={c} className="h-36" />
        ))}
      </div>
    );
  }

  const result = data.cabins[active];
  const list = (result?.itineraries ?? []).filter((it) => maxStops === null || it.stops <= maxStops).sort(sorters[sort]);

  return (
    <div className="flex flex-col gap-5">
      <p role="status" className="text-sm text-muted-foreground">{data.credits > 0 ? `Used ${data.credits} credit${data.credits === 1 ? "" : "s"}.` : "From cache (free)."} Prices are per person{roundTrip ? ", round trip" : ""}, in {data.currency}.</p>
      <CabinCards cabins={cabins} results={data.cabins} currency={data.currency} selected={active} onSelect={setCabin} loading={loading} extra={priceExtra} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="flex flex-col gap-3" aria-label={`${CABIN_NAMES[active]} flights`}>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-auto font-semibold">
              {CABIN_NAMES[active]} · {list.length} option{list.length === 1 ? "" : "s"}
            </h2>
            <div className="flex gap-1" role="group" aria-label="Stops">
              {[
                [null, "Any stops"],
                [0, "Nonstop"],
                [1, "≤ 1 stop"],
              ].map(([v, label]) => (
                <button
                  key={String(label)}
                  type="button"
                  aria-pressed={maxStops === v}
                  onClick={() => setMaxStops(v as number | null)}
                  className={cn("rounded-full border px-2.5 py-1 text-xs cursor-pointer", maxStops === v ? "border-primary bg-primary/10 text-primary" : "bg-card hover:bg-accent")}
                >
                  {label}
                </button>
              ))}
            </div>
            <NativeSelect aria-label="Sort flights" className="w-36" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="price">Cheapest</option>
              <option value="duration">Shortest</option>
              <option value="departure">Departure time</option>
            </NativeSelect>
          </div>
          {result?.error && <Notice tone="error">{result.error}</Notice>}
          {list.length === 0 && !result?.error && <Notice>No flights match these filters.</Notice>}
          {list.map((it) => (
            <ItineraryRow key={it.id} it={it} ctx={{ query, cabin: active, currency: data.currency, roundTrip }} extra={priceExtra?.(active, it.price)} />
          ))}
        </section>
        <aside className="lg:sticky lg:top-20 lg:self-start">
          {result?.insights ? (
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <PriceChart insights={result.insights} currency={data.currency} cabinName={CABIN_NAMES[active]} />
            </div>
          ) : (
            <Notice>No price history for this cabin.</Notice>
          )}
        </aside>
      </div>
    </div>
  );
}
