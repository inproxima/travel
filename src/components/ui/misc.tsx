import * as React from "react";
import { AlertCircle, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-4 animate-spin", className)} aria-hidden />;
}

export function Notice({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: "info" | "error" | "warning";
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const Icon = tone === "info" ? Info : AlertCircle;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex gap-3 rounded-lg border p-3 text-sm",
        tone === "error" && "border-destructive/30 bg-destructive/5 text-destructive",
        tone === "warning" && "border-warning/40 bg-warning/10",
        tone === "info" && "bg-muted/60",
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="flex flex-col gap-0.5">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(tone !== "error" && "text-muted-foreground")}>{children}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon?: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-10 text-center">
      {icon && <div className="text-muted-foreground [&_svg]:size-8">{icon}</div>}
      <p className="font-medium">{title}</p>
      {children && <div className="max-w-md text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

/** Small "· 1 credit" marker for buttons that spend SerpApi credits. */
export function Cost({ credits }: { credits: number }) {
  return (
    <span className="rounded bg-black/10 px-1.5 py-px text-[10px] font-semibold tabular-nums dark:bg-white/15">
      {credits} {credits === 1 ? "credit" : "credits"}
    </span>
  );
}

export function Stars({ value, max = 5, className }: { value: number | null; max?: number; className?: string }) {
  if (value == null) return null;
  const scaled = max === 5 ? value : (value / max) * 5;
  return (
    <span className={cn("inline-flex items-center gap-1 text-sm font-medium tabular-nums", className)} aria-label={`${value} out of ${max}`}>
      <span className="text-amber-500" aria-hidden>
        ★
      </span>
      {max === 5 ? scaled.toFixed(1) : `${value}/${max}`}
    </span>
  );
}
