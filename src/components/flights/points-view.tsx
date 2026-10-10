"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Check, Coins, ExternalLink, Search, X } from "lucide-react";
import { LoadButton } from "@/components/hotels/drawer/load-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { EmptyState, Notice, Skeleton, Spinner } from "@/components/ui/misc";
import { Switch } from "@/components/ui/switch";
import { isoToday, minutes, money, shortDate } from "@/lib/format";
import { centsPerPoint, compactPoints, estimatePoints, programName, usablePrograms, waysToPay, type Holdings } from "@/lib/points";
import { useAction } from "@/lib/use-action";
import { CABIN_NAMES, CABIN_TO_AWARD, type AwardDay, type AwardTrip, type Cabin } from "@/lib/models";
import { cn } from "@/lib/utils";
import { AirportInput } from "./airport-input";
import { cheapest } from "./cabin-cards";
import type { FlightForm, FlightSearchResponse } from "./types";

type AwardsResponse = { days: AwardDay[]; start: string; end: string; credits?: number };
type TripsResponse = { trips: AwardTrip[]; bookingLinks: { label: string; link: string; primary: boolean }[]; credits?: number };

/** A cash fare to compare awards against: same route, same date, one way, same cabin. */
export type CashCompare = { from: string; to: string; date: string; oneWay: boolean; data: FlightSearchResponse } | null;

function cashFor(compare: CashCompare, from: string, to: string, date: string, cabin: Cabin): number | null {
  if (!compare || !compare.oneWay || compare.from !== from || compare.to !== to || compare.date !== date) return null;
  const r = compare.data.cabins[cabin];
  return r ? (cheapest(r.itineraries)?.price ?? null) : null;
}

// --- estimates (no seats.aero) -------------------------------------------------------------

function Estimates({ holdings, compare, onGoCash }: { holdings: Holdings; compare: CashCompare; onGoCash: () => void }) {
  const held = Object.values(holdings).some((h) => h.held);
  return (
    <div className="flex flex-col gap-4">
      <Notice title="Showing estimates">
        Real award seats need a seats.aero key (<code className="font-mono">SEATS_AERO_API_KEY</code> in <code className="font-mono">.env</code>, Pro plan, personal use). Until then, this shows what the
        cash fares would cost in your points at the value per point you set in Settings, as when paying with points through a card&apos;s travel portal.
      </Notice>
      {!held ? (
        <EmptyState icon={<Coins />} title="Pick your programs first">
          Turn on the cards and airline programs you hold in{" "}
          <Link href="/settings" className="text-primary hover:underline">
            Settings
          </Link>
          , with your balances and what a point is worth to you.
        </EmptyState>
      ) : !compare ? (
        <EmptyState icon={<Coins />} title="Search cash fares first">
          <p>Estimates are based on the cash fares for your route.</p>
          <Button className="mt-3" variant="outline" onClick={onGoCash}>
            Go to cash fares <ArrowRight />
          </Button>
        </EmptyState>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {(Object.keys(compare.data.cabins).map(Number) as Cabin[]).map((c) => {
            const price = cheapest(compare.data.cabins[c]?.itineraries ?? [])?.price ?? null;
            const rows = estimatePoints(price, holdings);
            return (
              <Card key={c}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-base">
                    {CABIN_NAMES[c]} <span className="tabular-nums">{money(price, compare.data.currency)}</span>
                  </CardTitle>
                  <CardDescription>Cheapest cash fare{compare.oneWay ? "" : " (round trip)"}</CardDescription>
                </CardHeader>
                <CardContent>
                  {rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No fare to estimate.</p>
                  ) : (
                    <ul className="divide-y text-sm">
                      {rows.map((r) => (
                        <li key={r.program} className="flex items-center gap-2 py-1.5">
                          <span className="min-w-0 flex-1 truncate">{programName(r.program)}</span>
                          <span className="text-xs text-muted-foreground">at {r.cpp}¢</span>
                          <span className="w-16 text-right font-semibold tabular-nums">{compactPoints(r.points)}</span>
                          {r.enough === true && <Check className="size-4 text-success" aria-label="Your balance covers it" />}
                          {r.enough === false && <X className="size-4 text-muted-foreground" aria-label="Not enough points" />}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- award results ------------------------------------------------------------------------

function PayRoutes({ program, miles, holdings }: { program: string; miles: number; holdings: Holdings }) {
  const routes = waysToPay(program, miles, holdings);
  if (routes.length === 0) return <p className="text-xs text-muted-foreground">Not reachable from the programs in your Settings.</p>;
  return (
    <ul className="flex flex-col gap-0.5 text-xs">
      {routes.slice(0, 3).map((r) => (
        <li key={r.from} className="flex items-center gap-1.5">
          {r.enough === true ? <Check className="size-3.5 text-success" /> : r.enough === false ? <X className="size-3.5 text-muted-foreground" /> : <span className="size-3.5" />}
          {r.from === program ? (
            <span>
              Your {programName(program)} miles: <strong>{compactPoints(r.pointsNeeded)}</strong>
            </span>
          ) : (
            <span>
              {programName(r.from)} → {programName(program)}
              {r.ratio !== 1 && ` (1:${r.ratio})`}: <strong>{compactPoints(r.pointsNeeded)}</strong> points
            </span>
          )}
          {r.balance != null && <span className="text-muted-foreground">· you have {compactPoints(r.balance)}</span>}
        </li>
      ))}
    </ul>
  );
}

function TripDetails({ day, cabin, cash, currency }: { day: AwardDay; cabin: Cabin; cash: number | null; currency: string }) {
  const action = useAction<TripsResponse>();
  const key = CABIN_TO_AWARD[cabin];
  const trips = action.data?.trips.filter((t) => !t.cabin || t.cabin.toLowerCase().startsWith({ Y: "economy", W: "premium", J: "business", F: "first" }[key])) ?? [];
  if (!action.data) {
    return (
      <div className="flex flex-col items-start gap-2">
        <Button variant="outline" size="sm" onClick={() => void action.run("/api/awards/trips", { id: day.id })} disabled={action.loading}>
          {action.loading && <Spinner />} Flights, taxes and booking link
        </Button>
        {action.error && <Notice tone="error">{action.error}</Notice>}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {trips.length === 0 && <p className="text-sm text-muted-foreground">No flight details in this cabin.</p>}
      {trips.map((t) => {
        const cpp = centsPerPoint(cash, t.taxesCurrency === currency ? t.taxes : null, t.miles);
        return (
          <div key={t.id} className="rounded-lg border p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">
                {t.segments.map((s) => s.flightNumber).join(" + ")} · {t.stops === 0 ? "Nonstop" : `${t.stops} stop${(t.stops ?? 0) > 1 ? "s" : ""}`}
                {t.durationMin != null && ` · ${minutes(t.durationMin)}`}
              </p>
              <p className="tabular-nums">
                <strong>{t.miles?.toLocaleString()}</strong> miles + {money(t.taxes, t.taxesCurrency ?? "USD", { cents: true })}
              </p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t.segments.map((s) => `${s.from}→${s.to}${s.aircraft ? ` (${s.aircraft})` : ""}`).join(", ")}
              {t.seats != null && ` · ${t.seats} seat${t.seats === 1 ? "" : "s"} left`}
            </p>
            {cpp != null && (
              <p className="mt-1 text-xs">
                Worth <strong className={cn(cpp >= 1.5 ? "text-success" : cpp < 1 ? "text-destructive" : "")}>{cpp}¢ per mile</strong> against the {money(cash, currency)} cash fare
              </p>
            )}
          </div>
        );
      })}
      {action.data.bookingLinks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {action.data.bookingLinks.map((l) => (
            <a key={l.link} href={l.link} target="_blank" rel="noreferrer" className={cn("inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium", l.primary ? "bg-primary text-primary-foreground" : "border bg-card")}>
              {l.label} <ExternalLink className="size-3" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function AwardResults({
  data,
  cabins,
  holdings,
  compare,
  currency,
  onCompare,
  comparing,
  from,
  to,
}: {
  data: AwardsResponse;
  cabins: Cabin[];
  holdings: Holdings;
  compare: CashCompare;
  currency: string;
  onCompare: (date: string, cabin: Cabin) => void;
  comparing: boolean;
  from: string;
  to: string;
}) {
  const [cabin, setCabin] = React.useState<Cabin>(cabins.includes(3) ? 3 : cabins[0]!);
  const [selected, setSelected] = React.useState<string | null>(null);
  const key = CABIN_TO_AWARD[cabin];
  const usable = new Set(usablePrograms(holdings));
  const open = data.days.filter((d) => d.cabins[key].available && d.cabins[key].miles != null);
  const best = [...open].sort((a, b) => a.cabins[key].miles! - b.cabins[key].miles!);
  const dates: string[] = [];
  for (let d = data.start; d <= data.end; d = new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)) dates.push(d);
  const programs = [...new Set(data.days.map((d) => d.source))].sort((a, b) => Number(usable.has(b)) - Number(usable.has(a)) || programName(a).localeCompare(programName(b)));
  const lowestByDate = new Map<string, number>();
  for (const d of open) lowestByDate.set(d.date, Math.min(lowestByDate.get(d.date) ?? Infinity, d.cabins[key].miles!));
  const sel = data.days.find((d) => d.id === selected) ?? best[0] ?? null;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" role="tablist" aria-label="Cabins">
        {cabins.map((c) => {
          const k = CABIN_TO_AWARD[c];
          const avail = data.days.filter((d) => d.cabins[k].available && d.cabins[k].miles != null);
          const low = avail.reduce<AwardDay | null>((m, d) => (!m || d.cabins[k].miles! < m.cabins[k].miles! ? d : m), null);
          return (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={cabin === c}
              onClick={() => {
                setCabin(c);
                setSelected(null);
              }}
              className={cn("flex flex-col gap-1 rounded-xl border bg-card p-4 text-left shadow-sm cursor-pointer", cabin === c && "border-flights ring-1 ring-flights")}
            >
              <span className="text-sm font-semibold">{CABIN_NAMES[c]}</span>
              {low ? (
                <>
                  <span className="text-2xl font-semibold tabular-nums">{compactPoints(low.cabins[k].miles!)}</span>
                  <span className="text-xs text-muted-foreground">
                    {programName(low.source)} · {shortDate(low.date)}
                  </span>
                  <span className="text-xs text-muted-foreground">{avail.length} award option{avail.length === 1 ? "" : "s"} across programs</span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">No award seats found</span>
              )}
            </button>
          );
        })}
      </div>

      {open.length === 0 ? (
        <Notice>No {CABIN_NAMES[cabin]} award seats in this window. Try more flexible dates, other programs, or nearby airports.</Notice>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{CABIN_NAMES[cabin]} award calendar</CardTitle>
              <CardDescription>Miles per person, one way. Lowest each day is highlighted; programs you can use are listed first. Select a cell for details.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-max border-separate border-spacing-1 text-sm">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-card text-left text-xs font-medium text-muted-foreground">Program</th>
                    {dates.map((d) => (
                      <th key={d} className="px-1 text-center text-xs font-medium text-muted-foreground">
                        {shortDate(d)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {programs.map((p) => (
                    <tr key={p}>
                      <th scope="row" className="sticky left-0 whitespace-nowrap bg-card pr-2 text-left font-normal">
                        <span className={cn(usable.has(p) ? "font-medium" : "text-muted-foreground")}>{programName(p)}</span>
                        {usable.has(p) && <Badge className="ml-1.5 align-middle">yours</Badge>}
                      </th>
                      {dates.map((d) => {
                        const day = data.days.find((x) => x.source === p && x.date === d);
                        const c = day?.cabins[key];
                        if (!day || !c?.available || c.miles == null) return <td key={d} className="h-9 min-w-14 rounded-md bg-muted/40 text-center text-xs text-muted-foreground" aria-label="No seats" />;
                        const lowest = lowestByDate.get(d) === c.miles;
                        return (
                          <td key={d} className="p-0">
                            <button
                              type="button"
                              onClick={() => setSelected(day.id)}
                              aria-pressed={sel?.id === day.id}
                              title={`${programName(p)} · ${shortDate(d)} · ${c.miles.toLocaleString()} miles${c.seats ? ` · ${c.seats} seats` : ""}${c.direct ? " · nonstop" : ""}`}
                              className={cn(
                                "h-9 w-full min-w-14 rounded-md border px-1.5 text-xs font-semibold tabular-nums cursor-pointer",
                                lowest ? "border-success/50 bg-success/12 text-foreground" : "bg-card hover:bg-accent",
                                sel?.id === day.id && "ring-2 ring-flights",
                              )}
                            >
                              {compactPoints(c.miles)}
                              {c.direct && <span className="ml-0.5 text-[9px] text-muted-foreground">●</span>}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-muted-foreground">● nonstop available · Award availability is cached by seats.aero and can be hours old; confirm on the airline site.</p>
            </CardContent>
          </Card>

          {sel && sel.cabins[key].miles != null && (
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                  <span>
                    {programName(sel.source)} · {CABIN_NAMES[cabin]} · {shortDate(sel.date)}
                  </span>
                  <span className="tabular-nums">{sel.cabins[key].miles!.toLocaleString()} miles</span>
                </CardTitle>
                <CardDescription>
                  {[sel.cabins[key].airlines && `On ${sel.cabins[key].airlines}`, sel.cabins[key].seats && `${sel.cabins[key].seats} seats`, sel.cabins[key].direct ? "nonstop available" : "with connections", sel.lastSeen && `seen ${new Date(sel.lastSeen).toLocaleString()}`]
                    .filter(Boolean)
                    .join(" · ")}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">How you could pay</p>
                  <PayRoutes program={sel.source} miles={sel.cabins[key].miles!} holdings={holdings} />
                </div>
                {(() => {
                  const cash = cashFor(compare, from, to, sel.date, cabin);
                  const cpp = centsPerPoint(cash, null, sel.cabins[key].miles);
                  return cash != null ? (
                    <p className="text-sm">
                      Cash fare that day: <strong>{money(cash, currency)}</strong> · about <strong>{cpp}¢ per mile</strong> before taxes
                    </p>
                  ) : (
                    <LoadButton credits={1} loading={comparing} className="self-start" onClick={() => onCompare(sel.date, cabin)}>
                      Compare with the cash fare
                    </LoadButton>
                  );
                })()}
                <TripDetails key={`${sel.id}-${cabin}`} day={sel} cabin={cabin} cash={cashFor(compare, from, to, sel.date, cabin)} currency={currency} />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// --- main -----------------------------------------------------------------------------------

export function PointsView({
  form,
  setForm,
  holdings,
  seatsAero,
  compare,
  currency,
  onCompare,
  comparing,
  onGoCash,
}: {
  form: FlightForm;
  setForm: (f: FlightForm) => void;
  holdings: Holdings | null;
  seatsAero: boolean | null;
  compare: CashCompare;
  currency: string;
  onCompare: (date: string, cabin: Cabin) => void;
  comparing: boolean;
  onGoCash: () => void;
}) {
  const [flex, setFlex] = React.useState(3);
  const [cabins, setCabins] = React.useState<Cabin[]>([1, 2, 3, 4]);
  const [onlyMine, setOnlyMine] = React.useState(false);
  const [direct, setDirect] = React.useState(false);
  const [searched, setSearched] = React.useState<{ from: string; to: string; cabins: Cabin[] } | null>(null);
  const awards = useAction<AwardsResponse>();

  if (seatsAero === null || holdings === null) return <Skeleton className="h-64" />;
  if (!seatsAero) return <Estimates holdings={holdings} compare={compare} onGoCash={onGoCash} />;

  const ready = form.from && form.to && form.date;

  function search(e: React.FormEvent) {
    e.preventDefault();
    if (!form.from || !form.to) return;
    setSearched({ from: form.from.codes, to: form.to.codes, cabins });
    void awards.run("/api/awards/search", { from: form.from.codes, to: form.to.codes, date: form.date, flexDays: flex, cabins, onlyMine, directOnly: direct });
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-4">
        <form onSubmit={search} className="flex flex-col gap-4">
          <div className="grid items-end gap-3 md:grid-cols-[1fr_1fr_10rem_9rem]">
            <Field label="From" htmlFor="p-from">
              <AirportInput id="p-from" value={form.from} onChange={(v) => setForm({ ...form, from: v })} placeholder="City or airport" />
            </Field>
            <Field label="To" htmlFor="p-to">
              <AirportInput id="p-to" value={form.to} onChange={(v) => setForm({ ...form, to: v })} placeholder="City or airport" />
            </Field>
            <Field label="Date" htmlFor="p-date">
              <Input id="p-date" type="date" min={isoToday()} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label="Flexibility" htmlFor="p-flex">
              <NativeSelect id="p-flex" value={flex} onChange={(e) => setFlex(Number(e.target.value))}>
                <option value={0}>Exact date</option>
                <option value={1}>± 1 day</option>
                <option value={3}>± 3 days</option>
                <option value={7}>± 7 days</option>
              </NativeSelect>
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <div className="flex flex-wrap gap-1" role="group" aria-label="Cabins">
              {([1, 2, 3, 4] as Cabin[]).map((c) => {
                const on = cabins.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setCabins(on ? cabins.filter((x) => x !== c) : [...cabins, c].sort())}
                    className={cn("h-9 rounded-md border px-2.5 text-sm font-medium cursor-pointer", on ? "border-primary bg-primary/10 text-primary" : "bg-card hover:bg-accent")}
                  >
                    {CABIN_NAMES[c]}
                  </button>
                );
              })}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={onlyMine} onCheckedChange={setOnlyMine} /> Only programs I can use
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={direct} onCheckedChange={setDirect} /> Nonstop only
            </label>
            <Button type="submit" size="lg" className="ml-auto" disabled={!ready || cabins.length === 0 || awards.loading}>
              {awards.loading ? <Spinner /> : <Search />} Search award seats
              <span className="rounded bg-black/10 px-1.5 py-px text-[10px] font-semibold dark:bg-white/15">seats.aero · 0 credits</span>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Awards are one way and priced per person. For a round trip, search each direction.</p>
        </form>
      </Card>
      {awards.error && <Notice tone="error" title="Award search failed">{awards.error}</Notice>}
      {!awards.data && !awards.loading && (
        <EmptyState icon={<Coins />} title="Find award seats you can book with points">
          Shows saver and dynamic award space by program around your date. Programs you hold, or can transfer to from your card points, are marked “yours”.
        </EmptyState>
      )}
      {awards.loading && !awards.data && <Skeleton className="h-64" />}
      {awards.data && searched && (
        <AwardResults
          key={`${searched.from}-${searched.to}-${awards.data.start}-${searched.cabins.join("")}`}
          data={awards.data}
          cabins={searched.cabins}
          holdings={holdings}
          compare={compare}
          currency={currency}
          onCompare={onCompare}
          comparing={comparing}
          from={searched.from}
          to={searched.to}
        />
      )}
    </div>
  );
}
