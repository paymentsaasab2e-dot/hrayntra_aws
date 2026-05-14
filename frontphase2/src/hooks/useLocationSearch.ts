'use client';

import { useEffect, useRef, useState } from 'react';
import { searchLocations, type NominatimSuggestion } from '../lib/nominatim';

export interface UseLocationSearchOptions {
  /** Debounce delay in milliseconds. Defaults to 500ms. */
  debounceMs?: number;
  /** Minimum query length before hitting the network. Defaults to 2. */
  minQueryLength?: number;
  /** Max suggestions to request from Nominatim. Defaults to 6. */
  limit?: number;
}

export interface UseLocationSearchResult {
  suggestions: NominatimSuggestion[];
  loading: boolean;
  error: string | null;
  /** True once we've issued at least one search for the current query. */
  hasSearched: boolean;
  /** Clear suggestions/error state immediately (e.g. on selection). */
  clear: () => void;
}

/**
 * Debounced, abortable Nominatim search hook.
 *
 * - Waits `debounceMs` after the latest `query` change before firing a request.
 * - Cancels any in-flight request as soon as the query changes again.
 * - Skips queries shorter than `minQueryLength` to avoid spam.
 * - Tolerates aborted fetches without surfacing an error to the UI.
 */
export function useLocationSearch(
  query: string,
  options: UseLocationSearchOptions = {},
): UseLocationSearchResult {
  const { debounceMs = 500, minQueryLength = 2, limit = 6 } = options;

  const [suggestions, setSuggestions] = useState<NominatimSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = query.trim();

    // Cancel any pending request when the query changes.
    abortRef.current?.abort();

    if (trimmed.length < minQueryLength) {
      setSuggestions([]);
      setLoading(false);
      setError(null);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    const handle = window.setTimeout(async () => {
      try {
        const results = await searchLocations(trimmed, {
          limit,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setSuggestions(results);
        setHasSearched(true);
      } catch (err) {
        if ((err as { name?: string } | null)?.name === 'AbortError') return;
        setSuggestions([]);
        setError((err as Error)?.message || 'Failed to load locations');
        setHasSearched(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, debounceMs);

    return () => {
      window.clearTimeout(handle);
      controller.abort();
    };
  }, [query, debounceMs, minQueryLength, limit]);

  return {
    suggestions,
    loading,
    error,
    hasSearched,
    clear: () => {
      abortRef.current?.abort();
      setSuggestions([]);
      setError(null);
      setLoading(false);
      setHasSearched(false);
    },
  };
}
