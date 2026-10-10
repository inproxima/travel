"use client";

import * as React from "react";
import { BedDouble, List, Map as MapIcon } from "lucide-react";
import { PlacesMap, type MapPin } from "@/components/map";
import { Button } from "@/components/ui/button";
import { EmptyState, Notice, Skeleton } from "@/components/ui/misc";
import { LoadButton } from "./drawer/load-button";
import { money } from "@/lib/format";
import { useAction } from "@/lib/use-action";
import { useApiData } from "@/lib/use-api";
import type { Hotel, SavedPlace } from "@/lib/models";
import { cn } from "@/lib/utils";
import { HotelCard } from "./hotel-card";
import { HotelDrawer } from "./hotel-drawer";
import { defaultHotelSearch, HotelSearchForm } from "./hotel-search-form";
import type { HotelSearchInput, HotelSearchResponse } from "./types";

export function HotelsView() {
  const [query, setQuery] = React.useState<HotelSearchInput>(defaultHotelSearch);
  const [hotels, setHotels] = React.useState<Hotel[]>([]);
  const [hovered, setHovered] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState<Hotel | null>(null);
  const [mobileMap, setMobileMap] = React.useState(false);
  const search = useAction<HotelSearchResponse>();
  const more = useAction<HotelSearchResponse>();
  const places = useApiData<{ places: SavedPlace[] }>("/api/places").data?.places ?? [];
  const result = search.data;
  const nextToken = more.data?.nextPageToken !== undefined ? more.data.nextPageToken : result?.nextPageToken;

  async function run(q: HotelSearchInput) {
    setQuery(q);
    more.reset();
    const res = await search.run("/api/hotels/search", { ...q, maxPrice: q.maxPrice ?? undefined, minRating: q.minRating ?? undefined });
    if (res) setHotels(res.hotels);
  }

  async function loadMore() {
    const res = await more.run("/api/hotels/search", { ...query, maxPrice: query.maxPrice ?? undefined, minRating: query.minRating ?? undefined, nextPageToken: nextToken });
    if (res) setHotels((prev) => [...prev, ...res.hotels.filter((h) => !prev.some((p) => p.id === h.id))]);
  }

  const pins: MapPin[] = [
    ...hotels.filter((h) => h.coords).map((h) => ({ id: h.id, coords: h.coords!, label: h.name, badge: money(h.nightly, result?.currency), kind: "hotel" as const })),
    ...places.filter((p) => p.coords).map((p) => ({ id: p.id, coords: p.coords!, label: p.label, kind: "place" as const })),
  ];

  return (
    <div className="flex flex-col gap-5">
      <HotelSearchForm initial={query} loading={search.loading} onSearch={run} />

      {search.error && <Notice tone="error" title="Search failed">{search.error}</Notice>}

      {!result && !search.loading && (
        <EmptyState icon={<BedDouble />} title="Search for a place to stay">
          Prices, ratings and location for every hotel Google knows about. Open any hotel for booking prices, Google and Tripadvisor reviews, travel times to your places, and forum
          chatter.
        </EmptyState>
      )}

      {search.loading && !result && (
        <div className="grid gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      )}

      {result && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">{hotels.length}</strong> stays · {result.nights} night{result.nights === 1 ? "" : "s"} · prices in {result.currency}
              {result.credits > 0 ? ` · used ${result.credits} credit` : " · from cache (free)"}
            </p>
            <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setMobileMap((m) => !m)}>
              {mobileMap ? <List /> : <MapIcon />}
              {mobileMap ? "List" : "Map"}
            </Button>
          </div>

          {hotels.length === 0 ? (
            <EmptyState icon={<BedDouble />} title="No stays match">
              Try different dates or fewer filters.
            </EmptyState>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
              <div className={cn("flex flex-col gap-3", mobileMap && "hidden lg:flex")}>
                {hotels.map((h) => (
                  <HotelCard
                    key={h.id}
                    hotel={h}
                    currency={result.currency}
                    nights={result.nights}
                    places={places}
                    active={hovered === h.id}
                    onOpen={() => setOpen(h)}
                    onHover={(on) => setHovered(on ? h.id : null)}
                  />
                ))}
                {nextToken && (
                  <LoadButton credits={1} loading={more.loading} onClick={loadMore} className="self-center">
                    Load more stays
                  </LoadButton>
                )}
                {more.error && <Notice tone="error">{more.error}</Notice>}
              </div>
              <div className={cn("h-[70vh] overflow-hidden rounded-xl border lg:sticky lg:top-20", !mobileMap && "hidden lg:block")}>
                <PlacesMap pins={pins} activeId={hovered} onSelect={(id) => setOpen(hotels.find((h) => h.id === id) ?? null)} />
              </div>
            </div>
          )}
        </>
      )}

      <HotelDrawer hotel={open} query={query} currency={result?.currency ?? "USD"} nights={result?.nights ?? 1} places={places} onClose={() => setOpen(null)} />
    </div>
  );
}
