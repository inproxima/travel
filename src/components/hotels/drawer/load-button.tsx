import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Cost, Spinner } from "@/components/ui/misc";

/** A button that spends credits, showing the cost and a spinner while it runs. */
export function LoadButton({ credits, loading, children, ...props }: ButtonProps & { credits: number | string; loading?: boolean }) {
  return (
    <Button variant="outline" disabled={loading || props.disabled} {...props}>
      {loading && <Spinner />}
      {children}
      {typeof credits === "number" ? (
        <Cost credits={credits} />
      ) : (
        <span className="rounded bg-black/10 px-1.5 py-px text-[10px] font-semibold dark:bg-white/15">{credits}</span>
      )}
    </Button>
  );
}
