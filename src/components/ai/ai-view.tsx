"use client";

import * as React from "react";
import Link from "next/link";
import { History, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Notice } from "@/components/ui/misc";
import { api } from "@/lib/client";
import { useApiData } from "@/lib/use-api";
import type { HistoryItem } from "@/lib/ai/history";
import type { PlannerResult } from "@/lib/ai/types";
import type { Features } from "@/lib/env";
import { cn } from "@/lib/utils";
import { Progress } from "./progress";
import { RequestBox } from "./request-box";
import { ResultView } from "./result-view";
import { SpecReview } from "./spec-review";
import { usePlanner } from "./use-planner";

function HistoryList({ items, onOpen, activeId }: { items: HistoryItem[]; onOpen: (id: string) => void; activeId: string | null }) {
  if (items.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <History className="size-4" /> Past questions
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 pt-0">
        <ul className="flex flex-col">
          {items.map((it) => (
            <li key={it.id}>
              <button
                type="button"
                onClick={() => onOpen(it.id)}
                className={cn("w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent cursor-pointer", activeId === it.id && "bg-accent")}
              >
                <p className="line-clamp-2">{it.request}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {new Date(it.createdAt).toLocaleDateString()} {it.topPick && `· Top pick: ${it.topPick}`}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function AiView() {
  const features = useApiData<Features>("/api/status").data;
  const history = useApiData<{ items: HistoryItem[] }>("/api/ai/history");
  const { state, estimate, run, cancel, show, reset } = usePlanner(history.reload);
  const [lastRequest, setLastRequest] = React.useState("");

  async function openHistory(id: string) {
    const { result } = await api<{ result: PlannerResult }>(`/api/ai/history/${id}`);
    show(result);
  }

  const disabled = features && !features.openai;
  const request = "request" in state ? state.request : lastRequest;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="flex min-w-0 flex-col gap-5">
        {disabled && (
          <Notice tone="warning" title="Add your OpenAI key to use the AI Planner">
            Put it after <code className="font-mono">OPENAI_API_KEY=</code> in <code className="font-mono">.env</code> and restart. You can see the planner with sample data by running{" "}
            <code className="font-mono">./run.sh mock</code>.
          </Notice>
        )}

        {(state.phase === "idle" || state.phase === "estimating" || state.phase === "error" || state.phase === "review") && (
          <RequestBox
            key={request}
            initial={request}
            busy={state.phase === "estimating"}
            onSubmit={(r) => {
              setLastRequest(r);
              void estimate(r);
            }}
          />
        )}

        {state.phase === "error" && (
          <Notice tone="error" title="The planner stopped">
            {state.message}
          </Notice>
        )}

        {state.phase === "review" && <SpecReview spec={state.spec} plan={state.plan} onRun={() => void run(state.request, state.spec, state.plan)} onEdit={reset} />}

        {state.phase === "running" && <Progress steps={state.steps} credits={state.credits} plan={state.plan} onCancel={cancel} />}

        {state.phase === "done" && <ResultView result={state.result} onNew={reset} />}

        {state.phase === "idle" && (
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["1. Understand", "I turn your words into dates, budget, priorities and the places you need to be near."],
              ["2. Research", "Hotels for your dates, then Google and Tripadvisor reviews, travel times and forum advice for the best candidates."],
              ["3. Rank", "A ranked shortlist with scores, pros and cons, and quotes from real reviews you can check."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-xl border bg-card p-4">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <Sparkles className="size-4 text-ai" /> {t}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        )}
        {state.phase === "idle" && (
          <p className="text-xs text-muted-foreground">
            Tip: save your office or venue in{" "}
            <Link href="/settings" className="text-primary hover:underline">
              Settings
            </Link>{" "}
            and say “near my office” to get real travel times.
          </p>
        )}
      </div>
      <aside className="xl:sticky xl:top-20 xl:self-start">
        <HistoryList items={history.data?.items ?? []} onOpen={openHistory} activeId={state.phase === "done" ? state.result.id : null} />
      </aside>
    </div>
  );
}
