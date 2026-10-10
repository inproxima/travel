"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Cost, Spinner } from "@/components/ui/misc";
import { Switch } from "@/components/ui/switch";
import { nightsBetween } from "@/lib/geo";
import { isoToday } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { HotelSearchInput } from "./types";

export function defaultHotelSearch(): HotelSearchInput {
  return {
    q: "",
    checkIn: isoToday(30),
    checkOut: isoToday(33),
    adults: 2,
    childrenAges: [],
    sort: "relevance",
    maxPrice: null,
    minRating: null,
    hotelClass: [],
    freeCancellation: false,
    vacationRentals: false,
  };
}

function parseAges(text: string): number[] {
  return text
    .split(/[,\s]+/)
    .map((t) => Number(t))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 17)
    .slice(0, 8);
}

export function HotelSearchForm({
  initial,
  loading,
  onSearch,
}: {
  initial: HotelSearchInput;
  loading: boolean;
  onSearch: (q: HotelSearchInput) => void;
}) {
  const [f, setF] = React.useState(initial);
  const [ages, setAges] = React.useState(initial.childrenAges.join(", "));
  const nights = nightsBetween(f.checkIn, f.checkOut);
  const set = <K extends keyof HotelSearchInput>(k: K, v: HotelSearchInput[K]) => setF((s) => ({ ...s, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSearch({ ...f, q: f.q.trim(), childrenAges: parseAges(ages) });
  }

  return (
    <Card className="p-4">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid gap-3 md:grid-cols-[minmax(12rem,2fr)_repeat(2,minmax(9rem,1fr))_6rem_8rem]">
          <Field label="Destination" htmlFor="h-q">
            <Input id="h-q" placeholder="Lisbon, Portugal" value={f.q} onChange={(e) => set("q", e.target.value)} required minLength={2} />
          </Field>
          <Field label="Check-in" htmlFor="h-in">
            <Input id="h-in" type="date" value={f.checkIn} min={isoToday()} onChange={(e) => set("checkIn", e.target.value)} required />
          </Field>
          <Field label={`Check-out${nights > 0 ? ` · ${nights} night${nights === 1 ? "" : "s"}` : ""}`} htmlFor="h-out">
            <Input id="h-out" type="date" value={f.checkOut} min={f.checkIn} onChange={(e) => set("checkOut", e.target.value)} required />
          </Field>
          <Field label="Adults" htmlFor="h-adults">
            <Input id="h-adults" type="number" min={1} max={12} value={f.adults} onChange={(e) => set("adults", Math.max(1, Number(e.target.value) || 1))} />
          </Field>
          <Field label="Children's ages" htmlFor="h-kids">
            <Input id="h-kids" placeholder="e.g. 4, 9" value={ages} onChange={(e) => setAges(e.target.value)} />
          </Field>
        </div>

        <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
          <Field label="Sort by" htmlFor="h-sort" className="w-40">
            <NativeSelect id="h-sort" value={f.sort} onChange={(e) => set("sort", e.target.value as HotelSearchInput["sort"])}>
              <option value="relevance">Best match</option>
              <option value="price">Lowest price</option>
              <option value="rating">Highest rating</option>
              <option value="reviews">Most reviewed</option>
            </NativeSelect>
          </Field>
          <Field label="Max per night" htmlFor="h-max" className="w-32">
            <Input
              id="h-max"
              type="number"
              min={1}
              placeholder="Any"
              value={f.maxPrice ?? ""}
              onChange={(e) => set("maxPrice", e.target.value ? Math.max(1, Number(e.target.value)) : null)}
            />
          </Field>
          <Field label="Guest rating" htmlFor="h-rating" className="w-32">
            <NativeSelect
              id="h-rating"
              value={f.minRating ?? ""}
              onChange={(e) => set("minRating", e.target.value ? (Number(e.target.value) as 7 | 8 | 9) : null)}
            >
              <option value="">Any</option>
              <option value="7">3.5+</option>
              <option value="8">4.0+</option>
              <option value="9">4.5+</option>
            </NativeSelect>
          </Field>
          <fieldset className="flex flex-col gap-1.5" disabled={f.vacationRentals}>
            <legend className="mb-1.5 text-xs font-medium text-muted-foreground">Hotel class</legend>
            <div className="flex gap-1">
              {[2, 3, 4, 5].map((c) => {
                const on = f.hotelClass.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set("hotelClass", on ? f.hotelClass.filter((x) => x !== c) : [...f.hotelClass, c])}
                    className={cn(
                      "h-9 rounded-md border px-2.5 text-sm font-medium transition-colors cursor-pointer disabled:opacity-50",
                      on ? "border-primary bg-primary/10 text-primary" : "bg-card hover:bg-accent",
                    )}
                  >
                    {c}★
                  </button>
                );
              })}
            </div>
          </fieldset>
          <label className="flex h-9 items-center gap-2 text-sm">
            <Switch checked={f.freeCancellation} disabled={f.vacationRentals} onCheckedChange={(v) => set("freeCancellation", v)} />
            Free cancellation
          </label>
          <label className="flex h-9 items-center gap-2 text-sm">
            <Switch checked={f.vacationRentals} onCheckedChange={(v) => set("vacationRentals", v)} />
            Vacation rentals
            {nights >= 14 && !f.vacationRentals && <span className="text-xs text-muted-foreground">(often cheaper for {nights} nights)</span>}
          </label>
          <Button type="submit" size="lg" className="ml-auto" disabled={loading || nights < 1}>
            {loading ? <Spinner /> : <Search />}
            Search stays <Cost credits={1} />
          </Button>
        </div>
      </form>
    </Card>
  );
}
