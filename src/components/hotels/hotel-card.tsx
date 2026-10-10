"use client";

import { Check, MapPin, TrainFront } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Stars } from "@/components/ui/misc";
import { formatKm, haversineKm } from "@/lib/geo";
import { compact, money } from "@/lib/format";
import type { Hotel, SavedPlace } from "@/lib/models";
import { cn } from "@/lib/utils";
import { HotelImage } from "./hotel-image";

export function HotelCard({
  hotel,
  currency,
  nights,
  places,
  active,
  onOpen,
  onHover,
}: {
  hotel: Hotel;
  currency: string;
  nights: number;
  places: SavedPlace[];
  active: boolean;
  onOpen: () => void;
  onHover: (on: boolean) => void;
}) {
  const transit = hotel.nearby.flatMap((n) => n.transport.map((t) => ({ ...t, place: n.name }))).find((t) => /walk|public|transit/i.test(t.type));
  const distances = hotel.coords
    ? places.filter((p) => p.coords).map((p) => ({ label: p.label, km: haversineKm(hotel.coords!, p.coords!) }))
    : [];

  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      className={cn(
        "group grid w-full grid-cols-[6.5rem_1fr] gap-4 rounded-xl border bg-card p-3 text-left shadow-sm transition hover:shadow-md sm:grid-cols-[8.5rem_1fr_auto] cursor-pointer",
        active && "border-primary ring-1 ring-primary",
      )}
    >
      <HotelImage src={hotel.images[0]} name={hotel.name} className="h-full min-h-24 w-full rounded-lg" />
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold leading-tight group-hover:text-primary">{hotel.name}</span>
          {hotel.hotelClass && <span className="text-xs text-amber-500">{"★".repeat(hotel.hotelClass)}</span>}
          {hotel.kind === "vacation rental" && <Badge variant="secondary">Rental</Badge>}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {hotel.rating != null && (
            <span className="inline-flex items-center gap-1">
              <Stars value={hotel.rating} className="text-foreground" />({compact(hotel.reviewCount)})
            </span>
          )}
          {hotel.locationRating != null && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" /> Location {hotel.locationRating.toFixed(1)}
            </span>
          )}
          {transit && (
            <span className="inline-flex items-center gap-1">
              <TrainFront className="size-3.5" /> {transit.duration} to {transit.place}
            </span>
          )}
        </div>
        {distances.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {distances.map((d) => (
              <Badge key={d.label} variant="outline" title="Straight-line distance">
                {formatKm(d.km)} to {d.label}
              </Badge>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {hotel.amenities.slice(0, 4).map((a) => (
            <span key={a} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
              {a}
            </span>
          ))}
        </div>
      </div>
      <div className="col-span-2 flex items-end justify-between gap-2 border-t pt-2 sm:col-span-1 sm:flex-col sm:items-end sm:justify-start sm:border-0 sm:pt-0 sm:text-right">
        <div>
          <p className="text-xl font-semibold tabular-nums">{money(hotel.nightly, currency)}</p>
          <p className="text-xs text-muted-foreground">per night</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {hotel.total != null && (
            <p className="text-sm tabular-nums text-muted-foreground">
              {money(hotel.total, currency)} for {nights} night{nights === 1 ? "" : "s"}
            </p>
          )}
          {hotel.freeCancellation && (
            <Badge variant="success">
              <Check /> Free cancellation
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}
