"use client";

import * as React from "react";
import { api } from "@/lib/client";

/** Loads JSON from one of the app's API routes. Pass null to skip. */
export function useApiData<T>(url: string | null) {
  const [state, setState] = React.useState<{ url: string | null; data?: T; error?: string }>({ url: null });
  const [nonce, setNonce] = React.useState(0);

  React.useEffect(() => {
    if (!url) return;
    let alive = true;
    api<T>(url)
      .then((data) => alive && setState({ url, data }))
      .catch((e: Error) => alive && setState({ url, error: e.message }));
    return () => {
      alive = false;
    };
  }, [url, nonce]);

  const current = state.url === url;
  return {
    data: current ? state.data : undefined,
    error: current ? state.error : undefined,
    loading: url !== null && (!current || (state.data === undefined && state.error === undefined)),
    reload: React.useCallback(() => setNonce((n) => n + 1), []),
  };
}
