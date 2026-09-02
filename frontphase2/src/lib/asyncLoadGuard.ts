/**
 * Shared loading-session helper for tabs, drawers, and pages.
 *
 * A cancelled React effect must still turn the spinner off. If cleanup only
 * sets `cancelled = true` and skips `setLoading(false)`, a parent re-render
 * (or an inline `= []` prop) can restart the fetch forever and leave
 * "Loading..." on screen.
 */

export const EMPTY_ARRAY: readonly never[] = Object.freeze([]);

export function orEmpty<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : (EMPTY_ARRAY as T[]);
}

export function startAsyncLoad(setLoading: (loading: boolean) => void) {
  let active = true;
  setLoading(true);

  const finish = () => {
    if (!active) return;
    active = false;
    setLoading(false);
  };

  return {
    isActive: () => active,
    finish,
    /** Pass to the useEffect cleanup so a restarted/unmounted load cannot stick. */
    abort: finish,
  };
}
