"use client";

import * as React from "react";
import { RotateCcw, Sparkles } from "lucide-react";
import { ForumList } from "@/components/forums/forum-list";
import { PlacesMap, type MapPin } from "@/components/map";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Notice } from "@/components/ui/misc";
import { money } from "@/lib/format";
import { SCORE_WEIGHTS } from "@/lib/ai/weights";
import type { PlannerResult } from "@/lib/ai/types";
import { RankedCard } from "./ranked-card";

export function ResultView({ result, onNew }: { result: PlannerResult; onNew: () => void }) {
  const [hovered, setHovered] = React.useState<string | null>(null);
  const primary = result.places.find((p) => p.coords) ?? null;
  const pins: MapPin[] = [
    ...result.ranked.filter((h) => h.hotel.coords).map((h) => ({ id: h.id, coords: h.hotel.coords!, label: h.hotel.name, badge: `#${h.rank} ${money(h.stay?.nightly, result.currency)}`, kind: "hotel" as const })),
    ...result.places.filter((p) => p.coords).map((p) => ({ id: `place-${p.label}`, coords: p.coords!, label: p.label, kind: "place" as const })),
  ];

  return (
    <div className="flex flex-col gap-5">
      <Card className="border-ai/30 bg-ai/5">
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-1 size-5 shrink-0 text-ai" />
              <div>
                <p className="text-sm text-muted-foreground">“{result.request}”</p>
                <p className="mt-2 text-base leading-relaxed">{result.summary}</p>
              </div>
            </div>
            <Button variant="outline" onClick={onNew}>
              <RotateCcw /> New question
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {result.candidatesFound} options checked · {result.ranked.length} finalists · {result.credits.used} of {result.credits.cap} credits · {result.model} · match = {SCORE_WEIGHTS.value * 100}% value +{" "}
            {SCORE_WEIGHTS.location * 100}% location + {SCORE_WEIGHTS.reviews * 100}% reviews + {SCORE_WEIGHTS.fit * 100}% fit
          </p>
        </CardContent>
      </Card>

      {result.mock && <Notice tone="warning">Sample-data mode: hotels and reviews are samples, and the ranking comes from simple rules instead of the AI model.</Notice>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-4">
          {result.ranked.map((h) => (
            <RankedCard key={h.id} h={h} currency={result.currency} placeLabel={primary?.label ?? result.places[0]?.label ?? null} active={hovered === h.id} onHover={(on) => setHovered(on ? h.id : null)} />
          ))}
        </div>
        <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
          {pins.length > 0 && (
            <div className="h-72 overflow-hidden rounded-xl border">
              <PlacesMap pins={pins} activeId={hovered} />
            </div>
          )}
          {result.alsoConsidered.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Also considered</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2.5 text-sm">
                  {result.alsoConsidered.map((a) => (
                    <li key={a.id}>
                      <div className="flex justify-between gap-2">
                        <span className="font-medium">{a.name}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{money(a.total, result.currency)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{a.reason}</p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {result.forums.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">What travellers say</CardTitle>
              </CardHeader>
              <CardContent>
                <ForumList posts={result.forums.slice(0, 5)} />
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
