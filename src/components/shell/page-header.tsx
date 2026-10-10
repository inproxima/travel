import * as React from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  icon,
  title,
  description,
  accent,
  actions,
}: {
  icon: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  accent: "flights" | "hotels" | "ai" | "neutral";
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-10 items-center justify-center rounded-xl [&_svg]:size-5",
            accent === "flights" && "bg-flights/12 text-flights",
            accent === "hotels" && "bg-hotels/15 text-hotels",
            accent === "ai" && "bg-ai/12 text-ai",
            accent === "neutral" && "bg-muted text-foreground",
          )}
        >
          {icon}
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions}
    </div>
  );
}
