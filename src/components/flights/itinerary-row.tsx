"use client";

import * as React from "react";
import { ChevronDown, Leaf, Moon } from "lucide-react";
import { LoadButton } from "@/components/hotels/drawer/load-button";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/misc";
import { minutes, money } from "@/lib/format";
import { useAction } from "@/lib/use-action";
import type { BookingOption, Cabin, Itinerary } from "@/lib/models";
import { cn } from "@/lib/utils";
import { BookingOptions } from "./booking-options";
import { clock, dayShift, stopsLabel } from "./flight-format";

export type FlightContext = { query: Record<string, unknown>; cabin: Cabin; currency: string; roundTrip: boolean };

function AirlineMark({ it }: { it: Itinerary }) {
  if (it.airlineLogo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={it.airlineLogo} alt="" className="size-8 rounded object-contain" />;
  }
  return (
    <span className="flex size-8 items-center justify-center rounded bg-muted text-[11px] font-semibold text-muted-foreground" aria-hidden>
      {(it.segments[0]?.flightNumber ?? it.airlines[0] ?? "✈").slice(0, 2)}
    </span>
  );
}

function Segments({ it }: { it: Itinerary }) {
  return (
    <ol className="flex flex-col gap-3 border-l-2 border-dashed pl-4">
      {it.segments.map((s, i) => (
        <li key={i} className="flex flex-col gap-2">
          <div className="text-sm">
            <p>
              <span className="font-semibold tabular-nums">{clock(s.from.time)}</span> · {s.from.name ?? s.from.code} ({s.from.code})
            </p>
            <p className="my-1 text-xs text-muted-foreground">
              {minutes(s.durationMin)} · {[s.airline, s.flightNumber, s.airplane, s.travelClass].filter(Boolean).join(" · ")}
              {s.legroom && ` · ${s.legroom}`}
            </p>
            <p>
              <span className="font-semibold tabular-nums">{clock(s.to.time)}</span> · {s.to.name ?? s.to.code} ({s.to.code})
              {s.overnight && <Moon className="ml-1 inline size-3.5 text-muted-foreground" aria-label="Overnight" />}
            </p>
            {s.extensions.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{s.extensions.join(" · ")}</p>}
          </div>
          {it.layovers[i] && (
            <p className={cn("rounded-md bg-muted px-2 py-1 text-xs", it.layovers[i]!.overnight && "bg-warning/15")}>
              {minutes(it.layovers[i]!.durationMin)} layover · {it.layovers[i]!.name ?? it.layovers[i]!.code}
              {it.layovers[i]!.overnight && " · overnight"}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

function BookingBlock({ ctx, token }: { ctx: FlightContext; token: string }) {
  const booking = useAction<{ options: BookingOption[]; credits: number }>();
  if (booking.data) return <BookingOptions options={booking.data.options} currency={ctx.currency} />;
  return (
    <div className="flex flex-col items-start gap-2">
      <LoadButton credits={1} loading={booking.loading} onClick={() => void booking.run("/api/flights/booking", { query: ctx.query, cabin: ctx.cabin, bookingToken: token })}>
        Where to book
      </LoadButton>
      {booking.error && <Notice tone="error">{booking.error}</Notice>}
    </div>
  );
}

function ReturnsBlock({ ctx, token }: { ctx: FlightContext; token: string }) {
  const returns = useAction<{ itineraries: Itinerary[]; credits: number }>();
  if (returns.data) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold">Return flights (price shown is the round-trip total)</p>
        {returns.data.itineraries.length === 0 ? (
          <Notice>No return flights found.</Notice>
        ) : (
          <div className="flex flex-col gap-2">
            {returns.data.itineraries.map((r) => (
              <ItineraryRow key={r.id} it={r} ctx={{ ...ctx, roundTrip: false }} compact />
            ))}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-start gap-2">
      <LoadButton credits={1} loading={returns.loading} onClick={() => void returns.run("/api/flights/returns", { query: ctx.query, cabin: ctx.cabin, departureToken: token })}>
        Choose this outbound · see returns
      </LoadButton>
      {returns.error && <Notice tone="error">{returns.error}</Notice>}
    </div>
  );
}

export function ItineraryRow({ it, ctx, compact, extra }: { it: Itinerary; ctx: FlightContext; compact?: boolean; extra?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const first = it.segments[0];
  const last = it.segments[it.segments.length - 1];
  const shift = dayShift(first?.from.time, last?.to.time);
  const greener = it.co2?.diffPercent != null && it.co2.diffPercent <= -10;

  return (
    <div className={cn("rounded-xl border bg-card", compact ? "shadow-none" : "shadow-sm")}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 p-3 text-left sm:grid-cols-[auto_1.3fr_1fr_auto_auto] cursor-pointer">
        <AirlineMark it={it} />
        <div className="min-w-0">
          <p className="font-semibold tabular-nums">
            {clock(first?.from.time)} – {clock(last?.to.time)}
            {shift > 0 && <sup className="ml-0.5 text-xs text-muted-foreground">+{shift}</sup>}
          </p>
          <p className="truncate text-xs text-muted-foreground">{it.airlines.join(", ")}</p>
        </div>
        <div className="hidden text-sm sm:block">
          <p>{minutes(it.totalDurationMin)}</p>
          <p className="text-xs text-muted-foreground">
            {first?.from.code}–{last?.to.code} · {stopsLabel(it)}
          </p>
        </div>
        <div className="hidden flex-col items-end gap-1 sm:flex">
          {it.best && <Badge>Best</Badge>}
          {greener && (
            <Badge variant="success">
              <Leaf /> {it.co2!.diffPercent}% CO₂
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="text-lg font-semibold tabular-nums">{money(it.price, ctx.currency)}</p>
            {extra}
          </div>
          <ChevronDown className={cn("size-4 text-muted-foreground transition", open && "rotate-180")} />
        </div>
      </button>
      {open && (
        <div className="flex flex-col gap-4 border-t p-4">
          <p className="text-xs text-muted-foreground sm:hidden">
            {minutes(it.totalDurationMin)} · {stopsLabel(it)}
          </p>
          <Segments it={it} />
          {it.co2?.thisFlightKg != null && (
            <p className="text-xs text-muted-foreground">
              Emissions about {it.co2.thisFlightKg} kg CO₂{it.co2.typicalKg != null && ` (typical for this route: ${it.co2.typicalKg} kg)`}
            </p>
          )}
          {ctx.roundTrip && it.departureToken ? (
            <ReturnsBlock ctx={ctx} token={it.departureToken} />
          ) : it.bookingToken ? (
            <BookingBlock ctx={ctx} token={it.bookingToken} />
          ) : (
            <p className="text-xs text-muted-foreground">Google didn&apos;t provide booking details for this option.</p>
          )}
        </div>
      )}
    </div>
  );
}
