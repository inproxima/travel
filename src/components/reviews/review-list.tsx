import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Stars } from "@/components/ui/misc";
import type { Review } from "@/lib/models";

export function ReviewList({ reviews, highlight }: { reviews: Review[]; highlight?: string | null }) {
  const mark = highlight?.trim().toLowerCase();
  return (
    <ul className="flex flex-col divide-y">
      {reviews.map((r) => (
        <li key={r.id} className="flex flex-col gap-1.5 py-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Stars value={r.rating} max={r.maxRating} className="text-xs" />
            {r.author && <span className="font-medium text-foreground">{r.author}</span>}
            {r.date && <span>{r.date}</span>}
            {r.tripType && <Badge variant="outline">{r.tripType}</Badge>}
            {r.origin && r.origin !== "Google" && r.origin !== "Tripadvisor" && r.origin !== "Google Maps" && <Badge variant="secondary">via {r.origin}</Badge>}
            {r.link && (
              <a href={r.link} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 hover:text-foreground">
                Source <ExternalLink className="size-3" />
              </a>
            )}
          </div>
          {r.title && <p className="text-sm font-medium">{r.title}</p>}
          <p className="text-sm leading-relaxed">
            {mark && r.text.toLowerCase().includes(mark) ? <Highlighted text={r.text} term={mark} /> : r.text}
          </p>
          {Object.keys(r.subratings).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(r.subratings).map(([k, v]) => (
                <span key={k} className="rounded bg-muted px-1.5 py-0.5 text-[11px] capitalize text-muted-foreground">
                  {k} {v}
                </span>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function Highlighted({ text, term }: { text: string; term: string }) {
  const parts: React.ReactNode[] = [];
  const lower = text.toLowerCase();
  let i = 0;
  while (i < text.length) {
    const at = lower.indexOf(term, i);
    if (at === -1) {
      parts.push(text.slice(i));
      break;
    }
    parts.push(text.slice(i, at));
    parts.push(
      <mark key={at} className="rounded bg-warning/30 px-0.5 text-inherit">
        {text.slice(at, at + term.length)}
      </mark>,
    );
    i = at + term.length;
  }
  return <>{parts}</>;
}
