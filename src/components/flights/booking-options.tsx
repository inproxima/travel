"use client";

import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/misc";
import { money } from "@/lib/format";
import type { BookingOption } from "@/lib/models";

/** Google's booking links are form posts, so each Book button submits a small form in a new tab. */
function BookButton({ o }: { o: BookingOption }) {
  if (!o.url) return null;
  const fields = o.postData ? [...new URLSearchParams(o.postData).entries()] : [];
  return (
    <form action={o.url} method={fields.length ? "post" : "get"} target="_blank" rel="noreferrer">
      {fields.map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button type="submit" className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 cursor-pointer">
        Book <ExternalLink className="size-3" />
      </button>
    </form>
  );
}

export function BookingOptions({ options, currency }: { options: BookingOption[]; currency: string }) {
  if (options.length === 0) return <Notice>No booking options came back for this flight.</Notice>;
  return (
    <ul className="divide-y rounded-lg border bg-card">
      {options.map((o, i) => (
        <li key={`${o.seller}-${i}`} className="flex flex-wrap items-center gap-3 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
              {o.seller}
              {o.isAirline && <Badge variant="secondary">Airline</Badge>}
              {o.separateTickets && <Badge variant="warning">Separate tickets</Badge>}
              {i === 0 && <Badge>Cheapest</Badge>}
            </p>
            {(o.title || o.extensions.length > 0) && <p className="text-xs text-muted-foreground">{[o.title, ...o.extensions].filter(Boolean).join(" · ")}</p>}
          </div>
          <p className="font-semibold tabular-nums">{money(o.price, currency)}</p>
          <BookButton o={o} />
        </li>
      ))}
    </ul>
  );
}
