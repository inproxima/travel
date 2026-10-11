"use client";

import * as React from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import { useTheme } from "next-themes";
import "leaflet/dist/leaflet.css";
import { DEFAULT_CENTER, type MapPin, type PlacesMapProps } from "./types";

function pinIcon(pin: MapPin, active: boolean) {
  const base =
    pin.kind === "place"
      ? "background:#0f172a;color:#fff;border-color:#fff"
      : active
        ? "background:var(--primary);color:var(--primary-foreground);border-color:var(--primary)"
        : "background:var(--card);color:var(--foreground);border-color:var(--border)";
  const text = pin.kind === "place" ? "★ " + pin.label : (pin.badge ?? "•");
  return L.divIcon({
    className: "",
    html: `<div style="${base};transform:translate(-50%,-100%);display:inline-block;white-space:nowrap;border:1px solid;border-radius:9999px;padding:2px 8px;font:600 12px/1.4 var(--font-geist-sans),system-ui;box-shadow:0 1px 4px rgb(0 0 0/.25)${active ? ";z-index:1000;scale:1.1" : ""}">${text.replace(/</g, "&lt;")}</div>`,
    iconSize: [0, 0],
  });
}

function FitBounds({ pins }: { pins: MapPin[] }) {
  const map = useMap();
  const key = pins.map((p) => p.id).join("|");
  React.useEffect(() => {
    if (pins.length === 0) return;
    const bounds = L.latLngBounds(pins.map((p) => [p.coords.lat, p.coords.lng]));
    map.fitBounds(bounds.pad(0.15), { maxZoom: 15 });
    // Only refit when the set of pins changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

/** OpenStreetMap tiles via CARTO. Used when no Google Maps key is set, or when Google fails to load. */
export default function LeafletMap({ pins, activeId, onSelect, className }: PlacesMapProps) {
  const { resolvedTheme } = useTheme();
  const style = resolvedTheme === "dark" ? "dark_all" : "light_all";
  const center = pins[0]?.coords ?? DEFAULT_CENTER;

  return (
    <MapContainer center={[center.lat, center.lng]} zoom={13} scrollWheelZoom className={className} style={{ height: "100%", width: "100%" }}>
      <TileLayer
        key={style}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url={`https://{s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}{r}.png`}
      />
      <FitBounds pins={pins} />
      {pins.map((pin) => (
        <Marker
          key={pin.id}
          position={[pin.coords.lat, pin.coords.lng]}
          icon={pinIcon(pin, pin.id === activeId)}
          zIndexOffset={pin.id === activeId ? 1000 : pin.kind === "place" ? 500 : 0}
          eventHandlers={onSelect && pin.kind !== "place" ? { click: () => onSelect(pin.id) } : undefined}
        >
          <Tooltip direction="top" offset={[0, -24]}>
            {pin.label}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
