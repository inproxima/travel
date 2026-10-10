"use client";

import { Bike, Car, ChevronDown, CircleAlert, CircleCheck, ExternalLink, Footprints, Navigation, Quote, TrainFront } from "lucide-react";
import { HotelImage } from "@/components/hotels/hotel-image";
import { ReviewList } from "@/components/reviews/review-list";
import { Badge } from "@/components/ui/badge";
import { Stars } from "@/components/ui/misc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatKm } from "@/lib/geo";
import { money, shortDate } from "@/lib/format";
import type { Point, RankedHotel } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

const SOURCE_LABEL = { google: "Google", google_maps: "Google Maps", tripadvisor: "Tripadvisor", forum: "Forum" } as const;
const MODE_ICON: Record<string, React.ComponentType<{ className?: string }>> = { walking: Footprints, transit: TrainFront, driving: Car, cycling: Bike };

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <span className={cn("block h-full rounded-full", value >= 8 ? "bg-success" : value >= 6 ? "bg-primary" : "bg-warning")} style={{ width: `${value * 10}%` }} />
      </span>
      <span className="w-6 text-right tabular-nums">{value.toFixed(1)}</span>
    </div>
  );
}

function PointItem({ p, tone }: { p: Point; tone: "pro" | "con" }) {
  const Icon = tone === "pro" ? CircleCheck : CircleAlert;
  return (
    <li className="flex gap-2 text-sm">
      <Icon className={cn("mt-0.5 size-4 shrink-0", tone === "pro" ? "text-success" : "text-warning")} />
      <div className="flex flex-col gap-1">
        <span>{p.text}</span>
        {p.quote && (
          <span className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Quote className="mt-0.5 size-3 shrink-0" />
            <span>
              <em>“{p.quote}”</em>
              {p.source && <span className="ml-1.5 not-italic">— {SOURCE_LABEL[p.source]}</span>}
            </span>
          </span>
        )}
      </div>
    </li>
  );
}

export function RankedCard({ h, currency, placeLabel, active, onHover }: { h: RankedHotel; currency: string; placeLabel: string | null; active: boolean; onHover: (on: boolean) => void }) {
  const evidenceCount = h.evidence.google.length + h.evidence.tripadvisor.length + h.evidence.maps.length;
  return (
    <article
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className={cn("flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm transition", active && "border-ai ring-1 ring-ai", h.rank === 1 && "border-ai/60")}
    >
      <header className="flex gap-4">
        <div className="relative shrink-0">
          <HotelImage src={h.hotel.images[0]} name={h.hotel.name} className="size-20 rounded-xl" />
          <span className={cn("absolute -top-2 -left-2 flex size-7 items-center justify-center rounded-full border-2 border-card text-sm font-bold", h.rank === 1 ? "bg-ai text-white" : "bg-secondary")}>
            {h.rank}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-lg font-semibold leading-tight">{h.hotel.name}</h3>
            {h.hotel.hotelClass && <span className="text-xs text-amber-500">{"★".repeat(h.hotel.hotelClass)}</span>}
            {h.hotel.kind === "vacation rental" && <Badge variant="secondary">Rental</Badge>}
          </div>
          <p className="mt-0.5 text-sm font-medium text-ai">{h.headline}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {h.hotel.rating != null && (
              <span>
                <Stars value={h.hotel.rating} className="text-xs text-foreground" /> Google ({h.hotel.reviewCount?.toLocaleString()})
              </span>
            )}
            {h.tripadvisorRating != null && <span>Tripadvisor {h.tripadvisorRating}/5</span>}
            {h.distanceKm != null && placeLabel && (
              <span>
                {formatKm(h.distanceKm)} to {placeLabel}
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-2xl font-semibold tabular-nums">{h.overall.toFixed(1)}</p>
          <p className="text-[11px] text-muted-foreground">match / 10</p>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-[1fr_13rem]">
        <div className="flex flex-col gap-3">
          {h.pros.length > 0 && <ul className="flex flex-col gap-2">{h.pros.map((p, i) => <PointItem key={i} p={p} tone="pro" />)}</ul>}
          {h.cons.length > 0 && <ul className="flex flex-col gap-2">{h.cons.map((p, i) => <PointItem key={i} p={p} tone="con" />)}</ul>}
        </div>
        <div className="flex flex-col gap-3 rounded-xl bg-muted/50 p-3">
          {h.stay && (
            <div>
              <p className="text-lg font-semibold tabular-nums">{money(h.stay.total, currency)}</p>
              <p className="text-xs text-muted-foreground">
                {h.stay.nights} nights · {money(h.stay.nightly, currency)}/night
                <br />
                {shortDate(h.stay.checkIn)} – {shortDate(h.stay.checkOut)}
              </p>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <ScoreBar label="Value" value={h.scores.value} />
            <ScoreBar label="Location" value={h.scores.location} />
            <ScoreBar label="Reviews" value={h.scores.reviews} />
            <ScoreBar label="Fit" value={h.scores.fit} />
          </div>
          {h.commute && h.commute.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] text-muted-foreground">To {placeLabel ?? "your place"}</p>
              <div className="flex flex-wrap gap-1">
                {h.commute.slice(0, 4).map((m) => {
                  const Icon = MODE_ICON[m.mode] ?? Navigation;
                  return (
                    <span key={m.mode} className="inline-flex items-center gap-1 rounded bg-card px-1.5 py-0.5 text-[11px]">
                      <Icon className="size-3" /> {m.durationText ?? `${m.durationMin} min`}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {(h.bestFor.length > 0 || h.caveats.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {h.bestFor.map((b) => (
            <Badge key={b} className="bg-ai/10 text-ai">
              {b}
            </Badge>
          ))}
          {h.caveats.map((c) => (
            <span key={c} className="text-xs text-muted-foreground">
              · {c}
            </span>
          ))}
        </div>
      )}

      <details className="group rounded-lg border">
        <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm font-medium">
          Evidence the AI read ({evidenceCount} reviews)
          <ChevronDown className="size-4 transition group-open:rotate-180" />
        </summary>
        <div className="border-t px-3 pb-2">
          <Tabs defaultValue={h.evidence.google.length ? "google" : h.evidence.tripadvisor.length ? "tripadvisor" : "maps"}>
            <TabsList className="mt-3">
              <TabsTrigger value="google">Google ({h.evidence.google.length})</TabsTrigger>
              <TabsTrigger value="tripadvisor">Tripadvisor ({h.evidence.tripadvisor.length})</TabsTrigger>
              <TabsTrigger value="maps">Google Maps ({h.evidence.maps.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="google">{h.evidence.google.length ? <ReviewList reviews={h.evidence.google} /> : <p className="py-3 text-sm text-muted-foreground">None.</p>}</TabsContent>
            <TabsContent value="tripadvisor">{h.evidence.tripadvisor.length ? <ReviewList reviews={h.evidence.tripadvisor} /> : <p className="py-3 text-sm text-muted-foreground">Not found on Tripadvisor.</p>}</TabsContent>
            <TabsContent value="maps">{h.evidence.maps.length ? <ReviewList reviews={h.evidence.maps} /> : <p className="py-3 text-sm text-muted-foreground">None.</p>}</TabsContent>
          </Tabs>
        </div>
      </details>

      {h.hotel.link && (
        <a href={h.hotel.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground">
          Hotel website <ExternalLink className="size-3.5" />
        </a>
      )}
    </article>
  );
}
