"use client";

import * as React from "react";
import { api, notifyCreditsChanged } from "@/lib/client";

/** A credit-spending call started by a button: tracks loading, result and error. */
export function useAction<T extends { credits?: number }>() {
  const [state, setState] = React.useState<{ data?: T; error?: string; loading: boolean }>({ loading: false });
  const controller = React.useRef<AbortController | null>(null);

  const run = React.useCallback(async (url: string, json: unknown): Promise<T | undefined> => {
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    try {
      const data = await api<T>(url, { method: "POST", json, signal: ctrl.signal });
      if (ctrl.signal.aborted) return undefined;
      setState({ data, loading: false });
      if (data.credits) notifyCreditsChanged();
      return data;
    } catch (e) {
      if (ctrl.signal.aborted) return undefined;
      setState((s) => ({ ...s, loading: false, error: (e as Error).message }));
      return undefined;
    }
  }, []);

  React.useEffect(() => () => controller.current?.abort(), []);

  const reset = React.useCallback(() => setState({ loading: false }), []);
  return { ...state, run, reset, setData: (data: T) => setState({ data, loading: false }) };
}
