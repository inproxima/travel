"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/misc";

/** Leaflet needs the browser, so the map loads on the client only. */
export const PlacesMap = dynamic(() => import("./places-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

export type { MapPin } from "./places-map";
