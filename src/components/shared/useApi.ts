"use client";

import { useEffect, useState } from "react";
import { apiFetch, errorMessage } from "@/lib/api-client";

type State<T> = { key: string; data: T | null; error: string | null } | null;

/**
 * Loads a GET endpoint. `reload()` fetches again; the old data stays on screen meanwhile.
 * data is null until the first answer arrives (or after an error).
 */
export function useApi<T>(url: string) {
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<State<T>>(null);
  const key = `${url}#${tick}`;

  useEffect(() => {
    let cancelled = false;
    apiFetch<T>(url)
      .then((data) => !cancelled && setState({ key, data, error: null }))
      .catch((e) => !cancelled && setState({ key, data: null, error: errorMessage(e) }));
    return () => {
      cancelled = true;
    };
  }, [url, key]);

  return {
    data: state?.data ?? null,
    error: state?.error ?? null,
    loading: state === null || state.key !== key,
    reload: () => setTick((n) => n + 1),
  };
}
