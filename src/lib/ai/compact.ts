import type { Directions, ForumPost, Review } from "@/lib/models";
import type { TripSpec } from "./schemas";
import type { Candidate, ResolvedPlace } from "./types";

// Compact, token-friendly views of the data that go to the model.

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function compactSpec(spec: TripSpec) {
  return {
    destination: spec.destination,
    dates: spec.dateWindows.map((w) => `${w.checkIn} to ${w.checkOut}`),
    guests: { adults: spec.adults, children: spec.childrenAges.length },
    budgetPerNight: spec.budgetPerNight,
    budgetTotal: spec.budgetTotal,
    minHotelClass: spec.minHotelClass,
    priorities: spec.priorities,
    travelerType: spec.travelerType,
    preferVacationRentals: spec.preferVacationRentals,
  };
}

export function compactCandidate(c: Candidate, places: ResolvedPlace[]) {
  const h = c.hotel;
  return {
    id: h.id,
    name: h.name,
    kind: h.kind,
    hotelClass: h.hotelClass,
    rating: h.rating,
    reviewCount: h.reviewCount,
    locationRating: h.locationRating,
    nightly: c.best?.nightly ?? h.nightly,
    total: c.best?.total ?? h.total,
    dates: c.best ? `${c.best.checkIn} to ${c.best.checkOut}` : null,
    otherDateOptions: c.windows.length > 1 ? c.windows.map((w) => ({ dates: `${w.checkIn} to ${w.checkOut}`, total: w.total })) : undefined,
    freeCancellation: h.freeCancellation,
    distanceKm: Object.fromEntries(places.map((p, i) => [p.label, c.distancesKm[i] != null ? Math.round(c.distancesKm[i]! * 10) / 10 : null])),
    guestMentions: h.categories.slice(0, 8).map((cat) => {
      const total = (cat.positive ?? 0) + (cat.negative ?? 0);
      return `${cat.name}: ${total ? Math.round(((cat.positive ?? 0) / total) * 100) : "?"}% positive (${cat.mentions ?? total} mentions)`;
    }),
    amenities: h.amenities.slice(0, 12),
    nearby: h.nearby.slice(0, 3).map((n) => `${n.name}: ${n.transport.map((t) => `${t.type} ${t.duration}`).join(", ")}`),
  };
}

export function compactReviews(reviews: Review[], n: number, len = 320) {
  return reviews.slice(0, n).map((r) => ({
    rating: r.rating != null ? `${r.rating}/${r.maxRating}` : null,
    tripType: r.tripType ?? undefined,
    date: r.date ?? undefined,
    text: clip(`${r.title ? `${r.title}. ` : ""}${r.text}`, len),
  }));
}

export function compactCommute(d: Directions | null) {
  if (!d) return null;
  return { to: d.to, times: d.modes.slice(0, 4).map((m) => `${m.mode} ${m.durationText ?? `${m.durationMin} min`}`) };
}

export function compactForums(posts: ForumPost[], n = 10) {
  return posts.slice(0, n).map((p) => ({ title: p.title, source: p.source, snippet: p.snippet ? clip(p.snippet, 280) : null }));
}
