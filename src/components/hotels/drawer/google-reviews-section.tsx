"use client";

import * as React from "react";
import { ReviewList } from "@/components/reviews/review-list";
import { NativeSelect } from "@/components/ui/input";
import { Notice } from "@/components/ui/misc";
import { useAction } from "@/lib/use-action";
import type { Hotel, Review } from "@/lib/models";
import { cn } from "@/lib/utils";
import { LoadButton } from "./load-button";

type Page = { reviews: Review[]; nextPageToken: string | null; credits: number };
type Sort = "helpful" | "recent" | "highest" | "lowest";

export function GoogleReviewsSection({ hotel }: { hotel: Hotel }) {
  const [sort, setSort] = React.useState<Sort>("helpful");
  const [category, setCategory] = React.useState<string | null>(null);
  const [reviews, setReviews] = React.useState<Review[]>([]);
  const action = useAction<Page>();
  const next = action.data?.nextPageToken;

  async function load(opts: { sort?: Sort; category?: string | null; more?: boolean } = {}) {
    if (!hotel.propertyToken) return;
    const s = opts.sort ?? sort;
    const c = opts.category === undefined ? category : opts.category;
    const page = await action.run("/api/hotels/reviews", {
      propertyToken: hotel.propertyToken,
      sort: s,
      categoryToken: c,
      nextPageToken: opts.more ? next : null,
    });
    if (page) setReviews((prev) => (opts.more ? [...prev, ...page.reviews] : page.reviews));
  }

  if (!hotel.propertyToken) return <Notice>Google doesn&apos;t list reviews for this property.</Notice>;
  const loaded = action.data !== undefined;

  return (
    <div className="flex flex-col gap-4">
      {hotel.categories.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">What guests mention{loaded ? " · tap to filter (1 credit)" : ""}</p>
          <div className="flex flex-wrap gap-1.5">
            {hotel.categories.map((c) => {
              const total = (c.positive ?? 0) + (c.negative ?? 0);
              const pct = total ? Math.round(((c.positive ?? 0) / total) * 100) : null;
              const on = category === c.categoryToken;
              return (
                <button
                  key={c.name}
                  type="button"
                  disabled={!c.categoryToken || action.loading}
                  onClick={() => {
                    const nextCat = on ? null : c.categoryToken;
                    setCategory(nextCat);
                    void load({ category: nextCat });
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs transition-colors cursor-pointer disabled:cursor-default",
                    on ? "border-primary bg-primary/10 text-primary" : "bg-card hover:bg-accent",
                  )}
                >
                  {c.name}
                  {pct != null && (
                    <span className={cn("font-semibold tabular-nums", pct >= 80 ? "text-success" : pct >= 60 ? "text-foreground" : "text-destructive")}>
                      {pct}% 👍
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          aria-label="Sort reviews"
          className="w-40"
          value={sort}
          onChange={(e) => {
            const s = e.target.value as Sort;
            setSort(s);
            if (loaded) void load({ sort: s });
          }}
        >
          <option value="helpful">Most helpful</option>
          <option value="recent">Most recent</option>
          <option value="highest">Highest score</option>
          <option value="lowest">Lowest score</option>
        </NativeSelect>
        {!loaded && (
          <LoadButton credits={1} loading={action.loading} onClick={() => load()}>
            Load Google reviews
          </LoadButton>
        )}
      </div>
      {action.error && <Notice tone="error">{action.error}</Notice>}
      {loaded && reviews.length === 0 && <Notice>No reviews match.</Notice>}
      {reviews.length > 0 && <ReviewList reviews={reviews} />}
      {loaded && next && (
        <LoadButton credits={1} loading={action.loading} onClick={() => load({ more: true })} className="self-start">
          More reviews
        </LoadButton>
      )}
    </div>
  );
}
