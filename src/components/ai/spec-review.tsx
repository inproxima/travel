"use client";

import { CalendarDays, Coins, MapPin, Play, Users, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Cost } from "@/components/ui/misc";
import { nightsBetween } from "@/lib/geo";
import { shortDate } from "@/lib/format";
import type { TripSpec } from "@/lib/ai/schemas";
import type { ResearchPlan } from "@/lib/ai/types";

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2">
      <span className="mt-0.5 text-muted-foreground [&_svg]:size-4">{icon}</span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div>{children}</div>
      </div>
    </div>
  );
}

export function SpecReview({ spec, plan, onRun, onEdit }: { spec: TripSpec; plan: ResearchPlan; onRun: () => void; onEdit: () => void }) {
  const nights = nightsBetween(spec.dateWindows[0]!.checkIn, spec.dateWindows[0]!.checkOut);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Here&apos;s what I understood</CardTitle>
          <CardDescription>If something is off, edit your request and try again.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <Row icon={<MapPin />} label="Where">
            <span className="font-medium">{spec.destination}</span>
            {spec.placesOfInterest.length > 0 && <span className="text-muted-foreground"> · near {spec.placesOfInterest.map((p) => p.label).join(", ")}</span>}
          </Row>
          <Row icon={<CalendarDays />} label={spec.dateWindows.length > 1 ? "Date options" : "Dates"}>
            {spec.dateWindows.map((w) => `${shortDate(w.checkIn)} – ${shortDate(w.checkOut)}`).join("  ·  ")} <span className="text-muted-foreground">({nights} nights)</span>
          </Row>
          <Row icon={<Users />} label="Guests">
            {spec.adults} adult{spec.adults === 1 ? "" : "s"}
            {spec.childrenAges.length > 0 && `, ${spec.childrenAges.length} child${spec.childrenAges.length === 1 ? "" : "ren"}`}
            {spec.travelerType && <span className="text-muted-foreground"> · {spec.travelerType} trip</span>}
          </Row>
          {(spec.budgetPerNight || spec.budgetTotal || spec.minHotelClass) && (
            <Row icon={<Wallet />} label="Budget">
              {spec.budgetPerNight && `Up to ${spec.budgetPerNight} per night`}
              {spec.budgetTotal && `${spec.budgetPerNight ? " · " : ""}Up to ${spec.budgetTotal} total`}
              {spec.minHotelClass && ` · ${spec.minHotelClass}★ or better`}
            </Row>
          )}
          {spec.priorities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 py-3">
              {spec.priorities.map((p) => (
                <Badge key={p}>{p}</Badge>
              ))}
              {spec.preferVacationRentals && <Badge variant="secondary">apartments welcome</Badge>}
            </div>
          )}
          {spec.assumptions.length > 0 && (
            <ul className="list-disc py-3 pl-5 text-xs text-muted-foreground">
              {spec.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="size-4" /> Research plan
          </CardTitle>
          <CardDescription>
            Up to <strong className="text-foreground">{plan.worstCase}</strong> of your {plan.cap}-credit limit (usually {plan.typical}). Searches repeated within the hour are free.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ol className="flex flex-col gap-1.5 text-sm">
            {plan.steps.map((s, i) => (
              <li key={s.key} className="flex items-center gap-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">{i + 1}</span>
                <span className="flex-1">{s.label}</span>
                {s.credits > 0 ? <Cost credits={s.credits} /> : <span className="text-xs text-ai">AI</span>}
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button size="lg" className="bg-ai text-white hover:bg-ai/90" onClick={onRun}>
              <Play /> Run research
            </Button>
            <Button size="lg" variant="outline" onClick={onEdit}>
              Edit request
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
