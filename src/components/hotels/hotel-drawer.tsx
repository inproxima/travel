"use client";

import * as React from "react";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Stars } from "@/components/ui/misc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { compact, money } from "@/lib/format";
import { useAction } from "@/lib/use-action";
import type { Hotel, HotelDetails, SavedPlace } from "@/lib/models";
import { ForumsSection } from "./drawer/forums-section";
import { GoogleReviewsSection } from "./drawer/google-reviews-section";
import { LocationSection } from "./drawer/location-section";
import { PricesSection } from "./drawer/prices-section";
import { TripadvisorSection } from "./drawer/tripadvisor-section";
import { HotelImage } from "./hotel-image";
import type { HotelSearchInput } from "./types";

export function HotelDrawer({
  hotel,
  query,
  currency,
  nights,
  places,
  onClose,
}: {
  hotel: Hotel | null;
  query: HotelSearchInput;
  currency: string;
  nights: number;
  places: SavedPlace[];
  onClose: () => void;
}) {
  return (
    <Sheet open={hotel !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent aria-describedby={undefined}>{hotel && <DrawerBody key={hotel.id} hotel={hotel} query={query} currency={currency} nights={nights} places={places} />}</SheetContent>
    </Sheet>
  );
}

function DrawerBody({ hotel, query, currency, nights, places }: { hotel: Hotel; query: HotelSearchInput; currency: string; nights: number; places: SavedPlace[] }) {
  const details = useAction<{ details: HotelDetails; credits: number }>();
  const city = query.q;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex gap-4 border-b p-5 pr-12">
        <HotelImage src={hotel.images[0]} name={hotel.name} className="size-20 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <SheetTitle>{hotel.name}</SheetTitle>
          <SheetDescription asChild>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              {hotel.hotelClass && <span className="text-amber-500">{"★".repeat(hotel.hotelClass)}</span>}
              {hotel.rating != null && (
                <span>
                  <Stars value={hotel.rating} className="text-foreground" /> ({compact(hotel.reviewCount)} reviews)
                </span>
              )}
              {hotel.kind === "vacation rental" && <Badge variant="secondary">Vacation rental</Badge>}
              {hotel.checkInTime && <span>Check-in {hotel.checkInTime}</span>}
            </div>
          </SheetDescription>
          <p className="mt-2 text-lg font-semibold tabular-nums">
            {money(hotel.nightly, currency)} <span className="text-sm font-normal text-muted-foreground">/ night</span>
            {hotel.total != null && <span className="ml-2 text-sm font-normal text-muted-foreground">· {money(hotel.total, currency)} total for {nights} nights</span>}
          </p>
        </div>
      </div>
      {hotel.description && <p className="border-b px-5 py-3 text-sm text-muted-foreground">{hotel.description}</p>}

      <Tabs defaultValue="prices" className="flex-1 p-5">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="prices">Prices</TabsTrigger>
          <TabsTrigger value="google">Google reviews</TabsTrigger>
          <TabsTrigger value="tripadvisor">Tripadvisor</TabsTrigger>
          <TabsTrigger value="location">Location</TabsTrigger>
          <TabsTrigger value="forums">Forums</TabsTrigger>
        </TabsList>
        <TabsContent value="prices" forceMount className="data-[state=inactive]:hidden">
          <PricesSection
            details={details.data?.details}
            loading={details.loading}
            error={details.error}
            currency={currency}
            nightly={hotel.nightly}
            onLoad={() => void details.run("/api/hotels/details", { query, propertyToken: hotel.propertyToken })}
          />
        </TabsContent>
        <TabsContent value="google" forceMount className="data-[state=inactive]:hidden">
          <GoogleReviewsSection hotel={hotel} />
        </TabsContent>
        <TabsContent value="tripadvisor" forceMount className="data-[state=inactive]:hidden">
          <TripadvisorSection hotelName={hotel.name} city={city} knownPlaceId={details.data?.details.tripadvisorPlaceId ?? null} />
        </TabsContent>
        <TabsContent value="location" className="data-[state=inactive]:hidden">
          <LocationSection hotel={hotel} city={city} places={places} />
        </TabsContent>
        <TabsContent value="forums" forceMount className="data-[state=inactive]:hidden">
          <ForumsSection hotelName={hotel.name} city={city} />
        </TabsContent>
      </Tabs>

      {hotel.link && (
        <div className="border-t p-4">
          <a href={hotel.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            Hotel website <ExternalLink className="size-3.5" />
          </a>
        </div>
      )}
    </div>
  );
}
