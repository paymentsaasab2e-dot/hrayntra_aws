/**
 * Shared Phase-2 list fetch helpers: debounce values + AbortController stale protection.
 */
import { useEffect, useRef, useState } from 'react';

export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/** Increments a request id and returns a fresh AbortController; aborts the previous one. */
export function useListRequestGate() {
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  function beginRequest(): { requestId: number; signal: AbortSignal } {
    abortRef.current?.abort();
    const abortController = new AbortController();
    abortRef.current = abortController;
    const requestId = ++requestIdRef.current;
    return { requestId, signal: abortController.signal };
  }

  function isCurrent(requestId: number): boolean {
    return requestId === requestIdRef.current;
  }

  function isAbortError(err: unknown): boolean {
    const e = err as { name?: string; kind?: string };
    return (
      abortRef.current?.signal.aborted === true ||
      e?.name === 'AbortError' ||
      e?.kind === 'abort'
    );
  }

  return { beginRequest, isCurrent, isAbortError, requestIdRef };
}
