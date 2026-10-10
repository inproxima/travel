"use client";

import * as React from "react";
import { ArrowRight, Percent, Search, TicketsPlane } from "lucide-react";
import { PlacesMap, type MapPin } from "@/components/map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Cost, EmptyState, Notice, Skeleton, Spinner } from "@/components/ui/misc";
import { isoToday, minutes, money, shortDate } from "@/lib/format";
import { useAction } from "@/lib/use-action";
import { CABIN_NAMES, type Cabin, type Deal } from "@/lib/models";
import { AirportInput, type AirportValue } from "./airport-input";

type DealsResponse = { deals: Deal[]; currency: string; credits: number; origin: { lat: number; lng: number } | null };

export function DealsView({ onPick }: { onPick: (d: Deal, from: AirportValue) => void }) {
  const [from, setFrom] = React.useState<AirportValue | null>(null);
  const [start, setStart] = React.useState(isoToday(21));
  const [end, setEnd] = React.useState(isoToday(90));
  const [minDays, setMinDays] = React.useState(3);
  const [maxDays, setMaxDays] = React.useState(7);
  const [oneWay, setOneWay] = React.useState(false);
  const [cabin, setCabin] = React.useState<Cabin>(1);
  const [stops, setStops] = React.useState<0 | 1 | 2>(0);
  const [maxPrice, setMaxPrice] = React.useState<number | null>(null);
  const [hovered, setHovered] = React.useState<string | null>(null);
  const action = useAction<DealsResponse>();

  function search(e: React.FormEvent) {
    e.preventDefault();
    if (!from) return;
    void action.run("/api/flights/deals", {
      cabin,
      query: { from: from.codes, window: { start, end }, tripLength: { min: Math.min(minDays, maxDays), max: Math.max(minDays, maxDays) }, oneWay, stops, maxPrice: maxPrice ?? undefined },
    });
  }

  const deals = action.data?.deals ?? [];
  const pins: MapPin[] = [
    ...deals.filter((d) => d.coords).map((d) => ({ id: `${d.to}-${d.destination}`, coords: d.coords!, label: d.destination, badge: money(d.price, action.data?.currency), kind: "deal" as const })),
    ...(action.data?.origin && from ? [{ id: "origin", coords: action.data.origin, label: from.label, kind: "place" as const }] : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-4">
        <form onSubmit={search} className="flex flex-wrap items-end gap-3">
          <Field label="From" htmlFor="d-from" className="min-w-56 flex-1">
            <AirportInput id="d-from" value={from} onChange={setFrom} placeholder="Your home airport or city" />
          </Field>
          <Field label="Leaving between" htmlFor="d-start" className="w-40">
            <Input id="d-start" type="date" min={isoToday()} value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="and" htmlFor="d-end" className="w-40">
            <Input id="d-end" type="date" min={start} value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
          {!oneWay && (
            <Field label="Trip length (days)" htmlFor="d-min" className="w-36">
              <div className="flex items-center gap-1">
                <Input id="d-min" type="number" min={1} max={30} value={minDays} onChange={(e) => setMinDays(Number(e.target.value) || 1)} aria-label="Minimum days" />
                <span className="text-muted-foreground">–</span>
                <Input type="number" min={1} max={30} value={maxDays} onChange={(e) => setMaxDays(Number(e.target.value) || 1)} aria-label="Maximum days" />
              </div>
            </Field>
          )}
          <Field label="Trip" htmlFor="d-type" className="w-32">
            <NativeSelect id="d-type" value={oneWay ? "1" : "0"} onChange={(e) => setOneWay(e.target.value === "1")}>
              <option value="0">Round trip</option>
              <option value="1">One way</option>
            </NativeSelect>
          </Field>
          <Field label="Cabin" htmlFor="d-cabin" className="w-40">
            <NativeSelect id="d-cabin" value={cabin} onChange={(e) => setCabin(Number(e.target.value) as Cabin)}>
              {([1, 2, 3, 4] as Cabin[]).map((c) => (
                <option key={c} value={c}>
                  {CABIN_NAMES[c]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Stops" htmlFor="d-stops" className="w-32">
            <NativeSelect id="d-stops" value={stops} onChange={(e) => setStops(Number(e.target.value) as 0 | 1 | 2)}>
              <option value={0}>Any</option>
              <option value={1}>Nonstop</option>
              <option value={2}>≤ 1 stop</option>
            </NativeSelect>
          </Field>
          <Field label="Max price" htmlFor="d-max" className="w-28">
            <Input id="d-max" type="number" min={1} placeholder="Any" value={maxPrice ?? ""} onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : null)} />
          </Field>
          <Button type="submit" size="lg" disabled={!from || action.loading} className="ml-auto">
            {action.loading ? <Spinner /> : <Search />}
            Find deals <Cost credits={1} />
          </Button>
        </form>
      </Card>

      {action.error && <Notice tone="error" title="Couldn't load deals">{action.error}</Notice>}
      {!action.data && !action.loading && (
        <EmptyState icon={<TicketsPlane />} title="Where can you go cheaply?">
          Pick your airport and a time window. Google Flights suggests destinations with unusually low fares; open one to search that route in every cabin.
        </EmptyState>
      )}
      {action.loading && !action.data && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      )}
      {action.data && deals.length === 0 && <Notice>No deals came back for these settings. Try a wider date window.</Notice>}
      {deals.length > 0 && from && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
          <div className="grid content-start gap-3 sm:grid-cols-2">
            {deals.map((d) => {
              const id = `${d.to}-${d.destination}`;
              return (
                <article
                  key={id}
                  onMouseEnter={() => setHovered(id)}
                  onMouseLeave={() => setHovered(null)}
                  className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">{d.destination}</h3>
                      <p className="text-xs text-muted-foreground">
                        {[d.country, d.to].filter(Boolean).join(" · ")}
                        {d.airline && ` · ${d.airline}`}
                      </p>
                    </div>
                    {d.discountPercent != null && d.discountPercent > 0 && (
                      <Badge variant="success">
                        <Percent /> {d.discountPercent}% below usual
                      </Badge>
                    )}
                  </div>
                  <p className="text-2xl font-semibold tabular-nums">
                    {money(d.price, action.data!.currency)}
                    {d.usualPrice != null && <span className="ml-2 text-sm font-normal text-muted-foreground line-through">{money(d.usualPrice, action.data!.currency)}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {d.outboundDate && shortDate(d.outboundDate)}
                    {d.returnDate && ` – ${shortDate(d.returnDate)}`}
                    {d.stops != null && ` · ${d.stops === 0 ? "Nonstop" : `${d.stops} stop${d.stops > 1 ? "s" : ""}`}`}
                    {d.durationMin != null && ` · ${minutes(d.durationMin)}`}
                  </p>
                  <Button variant="outline" size="sm" className="mt-1 self-start" disabled={!d.to} onClick={() => onPick(d, from)}>
                    Search this route <ArrowRight />
                  </Button>
                </article>
              );
            })}
          </div>
          <div className="h-[60vh] overflow-hidden rounded-xl border lg:sticky lg:top-20">
            <PlacesMap pins={pins} activeId={hovered} />
          </div>
        </div>
      )}
    </div>
  );
}
