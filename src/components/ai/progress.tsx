"use client";

import { CheckCircle2, Circle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/misc";
import type { ResearchPlan } from "@/lib/ai/types";
import type { StepState } from "./use-planner";

export function Progress({ steps, credits, plan, onCancel }: { steps: StepState[]; credits: number; plan: ResearchPlan; onCancel: () => void }) {
  const pct = Math.min(100, (credits / plan.cap) * 100);
  const started = new Set(steps.map((s) => s.key));
  const pending = plan.steps.filter((s) => !started.has(s.key));
  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Researching your stay…</CardTitle>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X /> Cancel
          </Button>
        </div>
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full bg-ai transition-all" style={{ width: `${pct}%` }} />
          </span>
          <span className="tabular-nums">
            {credits} / {plan.cap} credits
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col gap-2.5" aria-live="polite">
          {steps.map((s) => (
            <li key={s.key} className="flex gap-3 text-sm">
              {s.status === "running" ? <Spinner className="mt-0.5 shrink-0 text-ai" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />}
              <div className="min-w-0">
                <p className={s.status === "running" ? "font-medium" : ""}>{s.label}</p>
                {s.detail && <p className="truncate text-xs text-muted-foreground">{s.detail}</p>}
              </div>
            </li>
          ))}
          {pending.map((s) => (
            <li key={s.key} className="flex gap-3 text-sm text-muted-foreground">
              <Circle className="mt-0.5 size-4 shrink-0" />
              {s.label}
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-muted-foreground">Closing this page or pressing Cancel stops the research, so no more credits are used.</p>
      </CardContent>
    </Card>
  );
}
