"use client";

import * as React from "react";
import { api, notifyCreditsChanged } from "@/lib/client";
import type { TripSpec } from "@/lib/ai/schemas";
import type { PlannerEvent, PlannerResult, ResearchPlan } from "@/lib/ai/types";

export type StepState = { key: string; label: string; status: "running" | "done" | "skipped"; detail?: string };

export type PlannerState =
  | { phase: "idle" }
  | { phase: "estimating"; request: string }
  | { phase: "review"; request: string; spec: TripSpec; plan: ResearchPlan }
  | { phase: "running"; request: string; spec: TripSpec; plan: ResearchPlan; steps: StepState[]; credits: number }
  | { phase: "done"; result: PlannerResult }
  | { phase: "error"; request: string; message: string; spec?: TripSpec; plan?: ResearchPlan };

export function usePlanner(onFinished?: () => void) {
  const [state, setState] = React.useState<PlannerState>({ phase: "idle" });
  const abort = React.useRef<AbortController | null>(null);

  const estimate = React.useCallback(async (request: string) => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setState({ phase: "estimating", request });
    try {
      const { spec, plan } = await api<{ spec: TripSpec; plan: ResearchPlan }>("/api/ai/estimate", { method: "POST", json: { request }, signal: ctrl.signal });
      setState({ phase: "review", request, spec, plan });
    } catch (e) {
      if (!ctrl.signal.aborted) setState({ phase: "error", request, message: (e as Error).message });
    }
  }, []);

  const run = React.useCallback(
    async (request: string, spec: TripSpec, plan: ResearchPlan) => {
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      setState({ phase: "running", request, spec, plan, steps: [], credits: 0 });
      try {
        const res = await fetch("/api/ai/run", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ request, spec }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `The planner failed (${res.status}).`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finished = false;
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!line) continue;
            const e = JSON.parse(line) as PlannerEvent;
            if (e.type === "result") {
              finished = true;
              setState({ phase: "done", result: e.result });
            } else if (e.type === "error") {
              finished = true;
              setState({ phase: "error", request, message: e.message, spec, plan });
            } else {
              setState((s) => {
                if (s.phase !== "running") return s;
                if (e.type === "credits") return { ...s, credits: e.used };
                const steps = s.steps.some((x) => x.key === e.key) ? s.steps.map((x) => (x.key === e.key ? { ...e } : x)) : [...s.steps, { ...e }];
                return { ...s, steps };
              });
            }
          }
        }
        if (!finished) throw new Error("The connection closed before the planner finished.");
      } catch (e) {
        if (!ctrl.signal.aborted) setState({ phase: "error", request, message: (e as Error).message, spec, plan });
      } finally {
        notifyCreditsChanged();
        onFinished?.();
      }
    },
    [onFinished],
  );

  const cancel = React.useCallback(() => {
    abort.current?.abort();
    setState((s) => (s.phase === "running" || s.phase === "estimating" ? { phase: "idle" } : s));
  }, []);

  const show = React.useCallback((result: PlannerResult) => setState({ phase: "done", result }), []);
  const reset = React.useCallback(() => setState({ phase: "idle" }), []);

  React.useEffect(() => () => abort.current?.abort(), []);

  return { state, estimate, run, cancel, show, reset };
}
