"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { ForumList } from "@/components/forums/forum-list";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Cost, Notice, Spinner } from "@/components/ui/misc";
import { useAction } from "@/lib/use-action";
import type { ForumPost } from "@/lib/models";

export function ForumsSection({ hotelName, city }: { hotelName: string; city: string }) {
  const [q, setQ] = React.useState(`${hotelName} ${city}`.trim());
  const [recency, setRecency] = React.useState<"" | "m" | "y">("y");
  const action = useAction<{ posts: ForumPost[]; credits: number }>();
  const suggestions = [`${hotelName} ${city}`.trim(), `where to stay in ${city}`, `${city} long stay neighborhood`];

  function search(query = q) {
    setQ(query);
    void action.run("/api/forums", { q: query, recency: recency || undefined });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">What people say on Reddit, Tripadvisor forums and other communities.</p>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <Input className="min-w-56 flex-1" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Forum search" />
        <NativeSelect className="w-32" value={recency} onChange={(e) => setRecency(e.target.value as "" | "m" | "y")} aria-label="Recency">
          <option value="y">Past year</option>
          <option value="m">Past month</option>
          <option value="">Any time</option>
        </NativeSelect>
        <Button type="submit" variant="outline" disabled={action.loading || q.trim().length < 2}>
          {action.loading ? <Spinner /> : <Search />}
          Search <Cost credits={1} />
        </Button>
      </form>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((s) => (
          <button key={s} type="button" onClick={() => search(s)} className="rounded-full border bg-card px-2.5 py-1 text-xs hover:bg-accent cursor-pointer">
            {s}
          </button>
        ))}
      </div>
      {action.error && <Notice tone="error">{action.error}</Notice>}
      {action.data && (action.data.posts.length ? <ForumList posts={action.data.posts} /> : <Notice>No forum posts found.</Notice>)}
    </div>
  );
}
