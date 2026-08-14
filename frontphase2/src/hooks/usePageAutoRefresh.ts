'use client';

import { useEffect, useRef } from 'react';

interface AutoRefreshOptions {
  /** Polling interval while the tab is visible. Default 45s. */
  intervalMs?: number;
  /** Custom DOM events that should also trigger a silent refresh. */
  events?: string[];
  /** Disable the entire effect (e.g. before the page is allowed to load). */
  disabled?: boolean;
  /** Skip interval / focus refresh when session cache is still fresh. Mutations still refresh. */
  shouldSkip?: () => boolean;
}

const DEFAULT_INTERVAL_MS = 45_000;
const DEFAULT_EVENTS: string[] = ['jobportal:jobs-changed'];

/**
 * Generic auto-refresh wiring used by list pages (jobs, candidates, leads,
 * clients, interviews, dashboard, etc.):
 *
 *  - Polls the supplied loader every `intervalMs` while the tab is visible.
 *  - Refreshes immediately when the tab regains focus.
 *  - Refreshes when any of the listed window events fire (e.g. when other
 *    pages dispatch `jobportal:jobs-changed`).
 *
 * The loader is always called with `silent === true` so the caller can skip
 * its blocking spinner and only show data update.
 */
export function usePageAutoRefresh(
  load: (opts: { silent: boolean }) => void | Promise<unknown>,
  options: AutoRefreshOptions = {}
) {
  const { intervalMs = DEFAULT_INTERVAL_MS, events = DEFAULT_EVENTS, disabled = false, shouldSkip } = options;
  const loadRef = useRef(load);
  loadRef.current = load;
  const skipRef = useRef(shouldSkip);
  skipRef.current = shouldSkip;

  useEffect(() => {
    if (disabled) return;
    if (typeof window === 'undefined') return;

    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (skipRef.current?.()) return;
      void loadRef.current({ silent: true });
    };
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (skipRef.current?.()) return;
      void loadRef.current({ silent: true });
    };
    const onCustomEvent = () => {
      void loadRef.current({ silent: true });
    };

    const intervalId = window.setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', onVisibility);
    const safeEvents = Array.from(new Set(events.filter(Boolean)));
    safeEvents.forEach((evt) => window.addEventListener(evt, onCustomEvent));

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
      safeEvents.forEach((evt) => window.removeEventListener(evt, onCustomEvent));
    };
    // `events` is treated as stable (default array) — callers passing custom
    // arrays should memoize them. Joining here avoids re-running on each
    // render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, intervalMs, events.join('|')]);
}
