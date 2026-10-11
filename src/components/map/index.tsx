"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/misc";
import { useFeatures } from "@/lib/use-features";
import type { PlacesMapProps } from "./types";

const loading = () => <Skeleton className="h-full w-full rounded-none" />;

// Both map libraries need the browser, so they load on the client only.
const LeafletMap = dynamic(() => import("./places-map"), { ssr: false, loading });
const GoogleMap = dynamic(() => import("./google-map"), { ssr: false, loading });

/** Google Maps when GOOGLE_MAPS_API_KEY is set, otherwise OpenStreetMap. */
export function PlacesMap(props: PlacesMapProps) {
  const features = useFeatures();
  if (!features) return loading();
  return features.googleMaps ? <GoogleMap {...props} config={features.googleMaps} /> : <LeafletMap {...props} />;
}

export type { MapPin } from "./types";
