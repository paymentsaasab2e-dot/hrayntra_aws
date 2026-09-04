/** True when the browser loaded an outdated Next/Turbopack chunk (common after HMR or deploy). */
export function isStaleClientBundleError(error: unknown): boolean {
  const err = error as { name?: string; message?: string; digest?: string } | null;
  const blob = `${err?.name || ''} ${err?.message || ''} ${err?.digest || ''}`;
  return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|error loading dynamically imported module|Cannot find module in the React Client Manifest|Unable to preload CSS|Hydration failed|Minified React error/i.test(
    blob,
  );
}

/**
 * Reload once so the user gets a fresh bundle instead of the generic crash screen.
 * Returns true when a reload was triggered.
 */
export function reloadOnceForStaleBundle(): boolean {
  if (typeof window === 'undefined') return false;
  const key = 'hrayntra:stale-bundle-reload';
  const last = Number(window.sessionStorage.getItem(key) || '0');
  if (Date.now() - last < 12_000) return false;
  window.sessionStorage.setItem(key, String(Date.now()));
  window.location.reload();
  return true;
}
