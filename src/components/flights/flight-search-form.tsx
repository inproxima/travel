"use client";

import * as React from "react";
import { ArrowLeftRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Cost, Spinner } from "@/components/ui/misc";
import { isoToday } from "@/lib/format";
import { CABIN_NAMES, type Cabin } from "@/lib/models";
import { cn } from "@/lib/utils";
import { AirportInput } from "./airport-input";
import type { FlightForm } from "./types";

export function defaultFlightForm(): FlightForm {
  return { from: null, to: null, roundTrip: false, date: isoToday(45), returnDate: isoToday(52), adults: 1, children: 0, stops: 0, maxPrice: null, cabins: [1, 2, 3, 4] };
}

export function FlightSearchForm({
  form,
  setForm,
  loading,
  onSearch,
  submitLabel = "Search fares",
  showCabins = true,
}: {
  form: FlightForm;
  setForm: (f: FlightForm) => void;
  loading: boolean;
  onSearch: () => void;
  submitLabel?: string;
  showCabins?: boolean;
}) {
  const set = <K extends keyof FlightForm>(k: K, v: FlightForm[K]) => setForm({ ...form, [k]: v });
  // Remounts the airport inputs so their text follows a swap.
  const [swaps, setSwaps] = React.useState(0);
  const ready = form.from && form.to && form.date && (!form.roundTrip || form.returnDate >= form.date) && form.cabins.length > 0;

  return (
    <Card className="p-4">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) onSearch();
        }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="Trip type" className="inline-flex rounded-lg bg-muted p-1">
            {[
              [false, "One way"],
              [true, "Round trip"],
            ].map(([rt, label]) => (
              <button
                key={String(label)}
                type="button"
                role="radio"
                aria-checked={form.roundTrip === rt}
                onClick={() => set("roundTrip", rt as boolean)}
                className={cn("rounded-md px-3 py-1 text-sm font-medium cursor-pointer", form.roundTrip === rt ? "bg-card shadow-sm" : "text-muted-foreground")}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">Tip: type a city like “New York” to search all its airports at once.</span>
        </div>
        <div className="grid items-end gap-3 md:grid-cols-[1fr_auto_1fr_10rem_10rem]">
          <Field label="From" htmlFor="f-from">
            <AirportInput key={`from-${swaps}`} id="f-from" value={form.from} onChange={(v) => set("from", v)} placeholder="City or airport" />
          </Field>
          <Button type="button" variant="ghost" size="icon" aria-label="Swap from and to" onClick={() => {
              setForm({ ...form, from: form.to, to: form.from });
              setSwaps((n) => n + 1);
            }} className="hidden md:inline-flex">
            <ArrowLeftRight />
          </Button>
          <Field label="To" htmlFor="f-to">
            <AirportInput key={`to-${swaps}`} id="f-to" value={form.to} onChange={(v) => set("to", v)} placeholder="City or airport" />
          </Field>
          <Field label="Depart" htmlFor="f-date">
            <Input id="f-date" type="date" min={isoToday()} value={form.date} onChange={(e) => set("date", e.target.value)} required />
          </Field>
          <Field label="Return" htmlFor="f-return">
            <Input id="f-return" type="date" min={form.date} value={form.returnDate} disabled={!form.roundTrip} onChange={(e) => set("returnDate", e.target.value)} />
          </Field>
        </div>
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          <Field label="Adults" htmlFor="f-adults" className="w-20">
            <Input id="f-adults" type="number" min={1} max={9} value={form.adults} onChange={(e) => set("adults", Math.max(1, Number(e.target.value) || 1))} />
          </Field>
          <Field label="Children" htmlFor="f-children" className="w-20">
            <Input id="f-children" type="number" min={0} max={8} value={form.children} onChange={(e) => set("children", Math.max(0, Number(e.target.value) || 0))} />
          </Field>
          <Field label="Stops" htmlFor="f-stops" className="w-36">
            <NativeSelect id="f-stops" value={form.stops} onChange={(e) => set("stops", Number(e.target.value) as FlightForm["stops"])}>
              <option value={0}>Any</option>
              <option value={1}>Nonstop only</option>
              <option value={2}>1 stop or fewer</option>
              <option value={3}>2 stops or fewer</option>
            </NativeSelect>
          </Field>
          <Field label="Max price" htmlFor="f-max" className="w-28">
            <Input id="f-max" type="number" min={1} placeholder="Any" value={form.maxPrice ?? ""} onChange={(e) => set("maxPrice", e.target.value ? Number(e.target.value) : null)} />
          </Field>
          {showCabins && (
            <fieldset>
              <legend className="mb-1.5 text-xs font-medium text-muted-foreground">Cabins (1 credit each)</legend>
              <div className="flex flex-wrap gap-1">
                {([1, 2, 3, 4] as Cabin[]).map((c) => {
                  const on = form.cabins.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set("cabins", on ? form.cabins.filter((x) => x !== c) : [...form.cabins, c].sort())}
                      className={cn("h-9 rounded-md border px-2.5 text-sm font-medium cursor-pointer", on ? "border-primary bg-primary/10 text-primary" : "bg-card hover:bg-accent")}
                    >
                      {CABIN_NAMES[c]}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
          <Button type="submit" size="lg" className="ml-auto" disabled={!ready || loading}>
            {loading ? <Spinner /> : <Search />}
            {submitLabel} {showCabins && <Cost credits={form.cabins.length} />}
          </Button>
        </div>
      </form>
    </Card>
  );
}
