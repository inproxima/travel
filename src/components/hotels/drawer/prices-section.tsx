"use client";

import { Check, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/misc";
import { money } from "@/lib/format";
import type { HotelDetails } from "@/lib/models";
import { LoadButton } from "./load-button";

export function PricesSection({
  details,
  loading,
  error,
  onLoad,
  currency,
  nightly,
}: {
  details?: HotelDetails;
  loading: boolean;
  error?: string;
  onLoad: () => void;
  currency: string;
  nightly: number | null;
}) {
  if (!details) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-muted-foreground">Compare the price on every booking site, with links to book.</p>
        <LoadButton credits={1} loading={loading} onClick={onLoad}>
          Show booking prices
        </LoadButton>
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    );
  }
  const range = details.typicalRange;
  return (
    <div className="flex flex-col gap-5">
      {range?.low != null && range.high != null && nightly != null && (
        <div className="rounded-lg border p-3">
          <p className="text-sm">
            Typical price here: <strong>{money(range.low, currency)}–{money(range.high, currency)}</strong> per night.{" "}
            {nightly < range.low ? (
              <span className="text-success">Your dates are cheaper than usual.</span>
            ) : nightly > range.high ? (
              <span className="text-destructive">Your dates are pricier than usual.</span>
            ) : (
              <span className="text-muted-foreground">Your dates are in the usual range.</span>
            )}
          </p>
          <div className="relative mt-3 h-2 rounded-full bg-gradient-to-r from-success/40 via-warning/40 to-destructive/40">
            <span
              className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground"
              style={{ left: `${Math.min(100, Math.max(0, ((nightly - range.low * 0.8) / (range.high * 1.2 - range.low * 0.8)) * 100))}%` }}
              aria-hidden
            />
          </div>
        </div>
      )}
      {details.offers.length === 0 ? (
        <Notice>No booking sites listed prices for these dates.</Notice>
      ) : (
        <ul className="divide-y rounded-lg border">
          {details.offers.map((o, i) => (
            <li key={o.source} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                  {o.source}
                  {o.official && <Badge variant="secondary">Official</Badge>}
                  {i === 0 && <Badge>Lowest</Badge>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {money(o.nightly, currency)} / night
                  {o.freeCancellation && (
                    <span className="ml-2 inline-flex items-center gap-0.5 text-success">
                      <Check className="size-3" /> Free cancellation
                    </span>
                  )}
                </p>
              </div>
              <p className="font-semibold tabular-nums">{money(o.total ?? o.nightly, currency)}</p>
              {o.link && (
                <a
                  href={o.link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Book <ExternalLink className="size-3" />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
      {details.otherReviews.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Ratings on other sites</p>
          <div className="flex flex-wrap gap-2">
            {details.otherReviews.map((r) => (
              <Badge key={r.source} variant="outline" className="py-1">
                {r.source} {r.rating != null && r.maxRating ? `${r.rating}/${r.maxRating}` : ""} {r.count ? `· ${r.count.toLocaleString()}` : ""}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {(details.address || details.phone) && (
        <p className="text-sm text-muted-foreground">
          {details.address}
          {details.phone && <> · {details.phone}</>}
        </p>
      )}
    </div>
  );
}
