"use client";

import * as React from "react";
import { Award, ExternalLink } from "lucide-react";
import { ReviewList } from "@/components/reviews/review-list";
import { Badge } from "@/components/ui/badge";
import { Notice, Stars } from "@/components/ui/misc";
import { api, notifyCreditsChanged } from "@/lib/client";
import type { Review, TripadvisorDetails, TripadvisorPlace } from "@/lib/models";
import { cn } from "@/lib/utils";
import { LoadButton } from "./load-button";

const TRIP_TYPES = ["Business", "Couples", "Family", "Friends", "Solo"] as const;
type TripType = (typeof TRIP_TYPES)[number];

type State = {
  place: TripadvisorPlace | null;
  details: TripadvisorDetails | null;
  reviews: Review[];
};

export function TripadvisorSection({ hotelName, city, knownPlaceId }: { hotelName: string; city: string; knownPlaceId: string | null }) {
  const [state, setState] = React.useState<State | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [tripTypes, setTripTypes] = React.useState<TripType[]>([]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      let place: TripadvisorPlace | null = null;
      let placeId = knownPlaceId;
      if (!placeId) {
        place = (await api<{ place: TripadvisorPlace | null }>("/api/tripadvisor/find", { method: "POST", json: { name: hotelName, city } })).place;
        placeId = place?.placeId ?? null;
      }
      if (!placeId) {
        setNotFound(true);
        return;
      }
      const [d, r] = await Promise.all([
        api<{ details: TripadvisorDetails }>("/api/tripadvisor/place", { method: "POST", json: { placeId } }),
        api<{ reviews: Review[] }>("/api/tripadvisor/reviews", { method: "POST", json: { placeId, tripTypes } }),
      ]);
      setState({ place: place ?? { placeId, title: hotelName, type: null, rating: null, reviewCount: null, location: null, link: null, thumbnail: null, highlight: null }, details: d.details, reviews: r.reviews });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      notifyCreditsChanged();
    }
  }

  async function filter(types: TripType[]) {
    setTripTypes(types);
    if (!state?.place) return;
    setLoading(true);
    try {
      const r = await api<{ reviews: Review[] }>("/api/tripadvisor/reviews", { method: "POST", json: { placeId: state.place.placeId, tripTypes: types } });
      setState({ ...state, reviews: r.reviews });
      notifyCreditsChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (notFound) return <Notice>Couldn&apos;t find this hotel on Tripadvisor.</Notice>;

  if (!state) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-muted-foreground">Tripadvisor ranking, traveller ratings and reviews you can filter by trip type.</p>
        <LoadButton credits={knownPlaceId ? 2 : "up to 3 credits"} loading={loading} onClick={load}>
          Load Tripadvisor
        </LoadButton>
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    );
  }

  const d = state.details;
  const rating = d?.rating ?? state.place?.rating ?? null;
  const count = d?.reviewCount ?? state.place?.reviewCount ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {rating != null && <Stars value={rating} className="text-base" />}
        {count != null && <span className="text-sm text-muted-foreground">{count.toLocaleString()} reviews</span>}
        {d?.ranking && <Badge variant="secondary">{d.ranking}</Badge>}
        {d?.award && (
          <Badge variant="success">
            <Award /> {d.award}
          </Badge>
        )}
        {state.place?.link && (
          <a href={state.place.link} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            Open on Tripadvisor <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>
      {d && d.subratings.length > 0 && (
        <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
          {d.subratings.map((s) => (
            <div key={s.label} className="flex items-center gap-2 text-sm">
              <span className="w-28 shrink-0 text-muted-foreground">{s.label}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full bg-success" style={{ width: `${(s.rating / 5) * 100}%` }} />
              </span>
              <span className="w-7 text-right tabular-nums">{s.rating.toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">Trip type (1 credit to refilter)</p>
        <div className="flex flex-wrap gap-1.5">
          {TRIP_TYPES.map((t) => {
            const on = tripTypes.includes(t);
            return (
              <button
                key={t}
                type="button"
                disabled={loading}
                aria-pressed={on}
                onClick={() => filter(on ? tripTypes.filter((x) => x !== t) : [...tripTypes, t])}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors cursor-pointer",
                  on ? "border-primary bg-primary/10 text-primary" : "bg-card hover:bg-accent",
                )}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {state.reviews.length ? <ReviewList reviews={state.reviews} /> : <Notice>No Tripadvisor reviews match.</Notice>}
    </div>
  );
}
