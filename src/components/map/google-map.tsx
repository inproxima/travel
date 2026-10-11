"use client";

import * as React from "react";
import { AdvancedMarker, APILoadingStatus, APIProvider, ColorScheme, Map, useApiLoadingStatus, useMap } from "@vis.gl/react-google-maps";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import LeafletMap from "./places-map";
import { DEFAULT_CENTER, type MapPin, type PlacesMapProps } from "./types";

type Config = { apiKey: string; mapId: string };

// Google reports a rejected key (invalid, billing off, referrer not allowed) only by
// calling window.gm_authFailure, so the app listens for it itself.
let authFailed = false;
const authListeners = new Set<() => void>();

type AuthHook = (() => void) & { waypoint?: true };

function watchAuthFailure() {
  const w = window as Window & { gm_authFailure?: AuthHook };
  if (w.gm_authFailure?.waypoint) return;
  const previous = w.gm_authFailure;
  const hook: AuthHook = () => {
    authFailed = true;
    for (const notify of authListeners) notify();
    previous?.();
  };
  hook.waypoint = true;
  w.gm_authFailure = hook;
}

// This module only loads in the browser, before Google's script does.
if (typeof window !== "undefined") watchAuthFailure();

function useAuthFailed() {
  return React.useSyncExternalStore(
    (notify) => {
      authListeners.add(notify);
      return () => authListeners.delete(notify);
    },
    () => authFailed,
    () => false,
  );
}

/** Same pill as the OpenStreetMap version: a price or rank badge, "★ label" for saved places. */
function Pill({ pin, active }: { pin: MapPin; active: boolean }) {
  return (
    <div
      className={cn(
        "whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold shadow-md",
        pin.kind === "place"
          ? "border-white bg-slate-900 text-white"
          : active
            ? "scale-110 border-primary bg-primary text-primary-foreground"
            : "border-border bg-card text-foreground",
      )}
    >
      {pin.kind === "place" ? `★ ${pin.label}` : (pin.badge ?? "•")}
    </div>
  );
}

function FitBounds({ pins }: { pins: MapPin[] }) {
  const map = useMap();
  const key = pins.map((p) => p.id).join("|");
  React.useEffect(() => {
    if (!map || pins.length === 0) return;
    if (pins.length === 1) {
      map.setCenter(pins[0]!.coords);
      map.setZoom(15);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    for (const p of pins) bounds.extend(p.coords);
    map.fitBounds(bounds, 48);
    // Only refit when the set of pins changes, not on hover.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

function GoogleMapInner({ pins, activeId, onSelect, className, mapId }: PlacesMapProps & { mapId: string }) {
  const status = useApiLoadingStatus();
  const rejected = useAuthFailed();
  const { resolvedTheme } = useTheme();
  const scheme = resolvedTheme === "dark" ? ColorScheme.DARK : ColorScheme.LIGHT;

  // A rejected key, billing turned off, a referrer that isn't allowed, or no internet.
  if (rejected || status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return (
      <div className="relative h-full w-full">
        <LeafletMap pins={pins} activeId={activeId} onSelect={onSelect} className={className} />
        <p role="status" className="absolute bottom-2 left-2 z-[500] max-w-[85%] rounded-md bg-card/95 px-2 py-1 text-[11px] text-muted-foreground shadow">
          Google Maps couldn&apos;t load (check GOOGLE_MAPS_API_KEY). Showing OpenStreetMap.
        </p>
      </div>
    );
  }

  const center = pins[0]?.coords ?? DEFAULT_CENTER;
  return (
    <Map
      // The color scheme is fixed when a Google map is created, so a theme change makes a new one.
      key={scheme}
      mapId={mapId}
      colorScheme={scheme}
      defaultCenter={center}
      defaultZoom={13}
      gestureHandling="greedy"
      disableDefaultUI
      zoomControl
      clickableIcons={false}
      className={className}
      style={{ width: "100%", height: "100%" }}
    >
      <FitBounds pins={pins} />
      {pins.map((pin) => {
        const active = pin.id === activeId;
        return (
          <AdvancedMarker
            key={pin.id}
            position={pin.coords}
            title={pin.label}
            zIndex={active ? 1000 : pin.kind === "place" ? 500 : undefined}
            clickable={Boolean(onSelect) && pin.kind !== "place"}
            onClick={onSelect && pin.kind !== "place" ? () => onSelect(pin.id) : undefined}
          >
            <Pill pin={pin} active={active} />
          </AdvancedMarker>
        );
      })}
    </Map>
  );
}

/** Google's map, drawn with the Maps JavaScript API. Falls back to OpenStreetMap if Google can't load. */
export default function GoogleMap({ config, ...props }: PlacesMapProps & { config: Config }) {
  return (
    <APIProvider apiKey={config.apiKey}>
      <GoogleMapInner {...props} mapId={config.mapId} />
    </APIProvider>
  );
}
