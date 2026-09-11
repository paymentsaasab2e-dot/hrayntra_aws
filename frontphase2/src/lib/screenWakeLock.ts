/**
 * Keep the screen awake while Bulk CV (or similar long jobs) run.
 * Uses the Screen Wake Lock API — supported in Chromium/Edge when the tab is visible.
 * Does not override Windows sleep on lid close / hibernate / admin power policy.
 */

type WakeLockSentinelLike = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: 'release', listener: () => void) => void;
};

export async function requestScreenWakeLock(): Promise<WakeLockSentinelLike | null> {
  if (typeof navigator === 'undefined') return null;
  const wakeLock = (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> } })
    .wakeLock;
  if (!wakeLock?.request) return null;
  try {
    return await wakeLock.request('screen');
  } catch {
    return null;
  }
}

export async function releaseScreenWakeLock(
  sentinel: WakeLockSentinelLike | null | undefined,
): Promise<void> {
  if (!sentinel || sentinel.released) return;
  try {
    await sentinel.release();
  } catch {
    /* ignore */
  }
}
