"use client";

import * as React from "react";
import Link from "next/link";
import { Bike, Car, Footprints, Navigation, Search, TrainFront } from "lucide-react";
import { PlacesMap, type MapPin } from "@/components/map";
import { ReviewList } from "@/components/reviews/review-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Cost, Notice, Spinner, Stars } from "@/components/ui/misc";
import { formatKm, haversineKm } from "@/lib/geo";
import { minutes } from "@/lib/format";
import { useAction } from "@/lib/use-action";
import type { Directions, Hotel, Review, ReviewTopic, SavedPlace } from "@/lib/models";
import { cn } from "@/lib/utils";
import { LoadButton } from "./load-button";

const MODE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  walking: Footprints,
  transit: TrainFront,
  driving: Car,
  cycling: Bike,
};

function ModeChips({ d }: { d: Directions }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {d.modes.slice(0, 4).map((m) => {
        const Icon = MODE_ICON[m.mode] ?? Navigation;
        return (
          <span key={m.mode} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">
            <Icon className="size-3.5" />
            <span className="font-medium tabular-nums">{m.durationText ?? minutes(m.durationMin)}</span>
          </span>
        );
      })}
    </div>
  );
}

function PlaceRow({ hotel, city, place, onDataId }: { hotel: Hotel; city: string; place: SavedPlace; onDataId: (id: string) => void }) {
  const action = useAction<{ directions: Directions; credits: number }>();
  const km = hotel.coords && place.coords ? haversineKm(hotel.coords, place.coords) : null;
  async function load() {
    const res = await action.run("/api/maps/directions", {
      from: { address: `${hotel.name}, ${city}`, label: hotel.name },
      to: place.coords ? { coords: place.coords, label: place.label } : { address: place.address, label: place.label },
    });
    if (res?.directions.startDataId) onDataId(res.directions.startDataId);
  }
  return (
    <li className="flex flex-wrap items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{place.label}</p>
        <p className="truncate text-xs text-muted-foreground">
          {km != null && `${formatKm(km)} straight line · `}
          {place.address}
        </p>
      </div>
      {action.data ? (
        <ModeChips d={action.data.directions} />
      ) : (
        <LoadButton size="sm" credits={1} loading={action.loading} onClick={load}>
          Travel times
        </LoadButton>
      )}
      {action.error && <p className="w-full text-xs text-destructive">{action.error}</p>}
    </li>
  );
}

type MapsReviews = {
  placeTitle: string | null;
  rating: number | null;
  reviewCount: number | null;
  topics: ReviewTopic[];
  reviews: Review[];
  dataId: string | null;
  credits: number;
};

function MapsReviewsBlock({ hotel, city, dataId }: { hotel: Hotel; city: string; dataId: string | null }) {
  const [query, setQuery] = React.useState("");
  const [topic, setTopic] = React.useState<string | null>(null);
  const action = useAction<MapsReviews>();
  const knownId = action.data?.dataId ?? dataId;

  function load(opts: { topicId?: string | null } = {}) {
    void action.run("/api/maps/reviews", {
      dataId: knownId,
      lookup: knownId ? null : `${hotel.name}, ${city}`,
      query: opts.topicId ? null : query || null,
      topicId: opts.topicId ?? null,
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">Google Maps reviews</h4>
        {action.data?.rating != null && (
          <span className="text-sm text-muted-foreground">
            <Stars value={action.data.rating} /> {action.data.reviewCount?.toLocaleString()} reviews
          </span>
        )}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setTopic(null);
          load();
        }}
      >
        <Input placeholder="Search reviews: noise, wifi, breakfast…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search Google Maps reviews" />
        <Button type="submit" variant="outline" disabled={action.loading}>
          {action.loading ? <Spinner /> : <Search />}
          Search <Cost credits={knownId ? 1 : 2} />
        </Button>
      </form>
      {action.data && action.data.topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {action.data.topics.map((t) => (
            <button
              key={t.label}
              type="button"
              disabled={!t.id || action.loading}
              onClick={() => {
                setTopic(t.id);
                setQuery("");
                load({ topicId: t.id });
              }}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs cursor-pointer",
                topic === t.id ? "border-primary bg-primary/10 text-primary" : "bg-card hover:bg-accent",
              )}
            >
              {t.label} {t.mentions != null && <span className="text-muted-foreground">{t.mentions}</span>}
            </button>
          ))}
        </div>
      )}
      {action.error && <Notice tone="error">{action.error}</Notice>}
      {action.data && (action.data.reviews.length ? <ReviewList reviews={action.data.reviews} highlight={query} /> : <Notice>No reviews match.</Notice>)}
    </div>
  );
}

export function LocationSection({ hotel, city, places }: { hotel: Hotel; city: string; places: SavedPlace[] }) {
  const [dataId, setDataId] = React.useState<string | null>(null);
  const pins: MapPin[] = [
    ...(hotel.coords ? [{ id: hotel.id, coords: hotel.coords, label: hotel.name, badge: hotel.name.split(" ").slice(0, 3).join(" "), kind: "hotel" as const }] : []),
    ...places.filter((p) => p.coords).map((p) => ({ id: p.id, coords: p.coords!, label: p.label, kind: "place" as const })),
  ];

  return (
    <div className="flex flex-col gap-5">
      {pins.length > 0 && (
        <div className="h-56 overflow-hidden rounded-lg border">
          <PlacesMap pins={pins} activeId={hotel.id} />
        </div>
      )}
      <div>
        <h4 className="text-sm font-semibold">Getting to your places</h4>
        {places.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Add your office or other places in{" "}
            <Link href="/settings" className="text-primary underline-offset-2 hover:underline">
              Settings
            </Link>{" "}
            to see travel times from here.
          </p>
        ) : (
          <ul className="divide-y">
            {places.map((p) => (
              <PlaceRow key={p.id} hotel={hotel} city={city} place={p} onDataId={setDataId} />
            ))}
          </ul>
        )}
      </div>
      {hotel.nearby.length > 0 && (
        <div>
          <h4 className="mb-1.5 text-sm font-semibold">Nearby</h4>
          <ul className="flex flex-col gap-1 text-sm">
            {hotel.nearby.map((n) => (
              <li key={n.name} className="flex justify-between gap-3">
                <span>{n.name}</span>
                <span className="text-muted-foreground">{n.transport.map((t) => `${t.type} ${t.duration}`).join(" · ")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <MapsReviewsBlock hotel={hotel} city={city} dataId={dataId} />
    </div>
  );
}
