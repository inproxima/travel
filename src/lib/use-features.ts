"use client";

import * as React from "react";
import { api } from "@/lib/client";
import type { Features } from "@/lib/env";

// One request for /api/status per page load, shared by every component that needs it.
let cached: Features | null = null;
let pending: Promise<Features> | null = null;

export function useFeatures(): Features | null {
  const [features, setFeatures] = React.useState<Features | null>(cached);
  React.useEffect(() => {
    if (cached) return;
    let alive = true;
    pending ??= api<Features>("/api/status").then(
      (f) => (cached = f),
      (e) => {
        pending = null;
        throw e;
      },
    );
    pending.then((f) => alive && setFeatures(f)).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return features;
}
