"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/ui/misc";

const EXAMPLES = [
  "Hotel in Lisbon for 30 nights from March 3, quiet with fast wifi, near my office, under $250 a night",
  "A family-friendly hotel in Rome for 5 nights sometime in June, with a pool, 2 adults and 2 kids",
  "Best value 4-star hotel in Tokyo for a week next month, close to Shibuya station",
];

export function RequestBox({ initial, busy, onSubmit }: { initial?: string; busy: boolean; onSubmit: (request: string) => void }) {
  const [text, setText] = React.useState(initial ?? "");
  return (
    <Card className="p-4">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim().length >= 8) onSubmit(text.trim());
        }}
      >
        <label htmlFor="ai-request" className="text-sm font-medium">
          Describe your stay
        </label>
        <Textarea
          id="ai-request"
          rows={3}
          className="min-h-24 text-base"
          placeholder="Where, when, for how long, and what matters to you: budget, quiet, near the office, a kitchen…"
          value={text}
          maxLength={1500}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) (e.currentTarget.form as HTMLFormElement).requestSubmit();
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => setText(ex)} className="max-w-full truncate rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer">
              {ex}
            </button>
          ))}
          <Button type="submit" size="lg" className="ml-auto bg-ai text-white hover:bg-ai/90" disabled={busy || text.trim().length < 8}>
            {busy ? <Spinner /> : <Sparkles />}
            Plan my stay
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">First I&apos;ll show you what I understood and what the research will cost. Nothing is spent until you press Run.</p>
      </form>
    </Card>
  );
}
