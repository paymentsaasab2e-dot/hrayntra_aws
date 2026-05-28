/**
 * Tracks open app tabs in localStorage so we only end the server session when the
 * last tab / browser window closes — not when the user opens a second tab.
 */

const TAB_REGISTRY_KEY = 'jobportal.openTabs';
const TAB_STALE_MS = 10_000;
const TAB_HEARTBEAT_MS = 2_000;

let tabId: string | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

function readRegistry(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(TAB_REGISTRY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, number>;
  } catch {
    return {};
  }
}

function writeRegistry(registry: Record<string, number>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TAB_REGISTRY_KEY, JSON.stringify(registry));
}

function pruneStale(registry: Record<string, number>) {
  const now = Date.now();
  const next: Record<string, number> = {};
  for (const [id, ts] of Object.entries(registry)) {
    if (typeof ts === 'number' && now - ts < TAB_STALE_MS) {
      next[id] = ts;
    }
  }
  return next;
}

function touchThisTab() {
  if (!tabId) return;
  const registry = pruneStale(readRegistry());
  registry[tabId] = Date.now();
  writeRegistry(registry);
}

/** Call once when an authenticated app shell mounts. */
export function registerAppTab() {
  if (typeof window === 'undefined') return;
  if (!tabId) {
    tabId = crypto.randomUUID();
  }
  touchThisTab();
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(touchThisTab, TAB_HEARTBEAT_MS);
}

/**
 * Call on tab/window close. Returns true when this was the last active tab.
 */
export function unregisterAppTab(): boolean {
  if (typeof window === 'undefined') return true;
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (!tabId) return true;

  const closingId = tabId;
  tabId = null;

  const registry = pruneStale(readRegistry());
  delete registry[closingId];
  writeRegistry(registry);

  const remaining = Object.keys(pruneStale(readRegistry())).length;
  return remaining === 0;
}

export function countActiveAppTabs(): number {
  return Object.keys(pruneStale(readRegistry())).length;
}
