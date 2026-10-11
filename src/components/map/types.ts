import type { LatLng } from "@/lib/models";

export type MapPin = {
  id: string;
  coords: LatLng;
  label: string;
  /** Short text on the pin, e.g. a price or a rank. */
  badge?: string;
  kind: "hotel" | "place" | "deal";
};

export type PlacesMapProps = {
  pins: MapPin[];
  activeId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
};

/** Where an empty map looks before any pins arrive. */
export const DEFAULT_CENTER: LatLng = { lat: 38.7223, lng: -9.1393 };
