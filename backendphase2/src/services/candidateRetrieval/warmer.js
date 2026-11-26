/**
 * Refresh-ahead warmer.
 *
 * After an invalidation (a candidate/job/stage changed) the next list load would be a
 * cold MongoDB fetch (seconds on Atlas). To hide that, we remember the few list views
 * people were actually using ("hot views") and quietly rebuild them in the background
 * right after the change. If the user comes back before the rebuild finishes, the
 * request simply joins the in-flight load (single-flight coalescing).
 *
 * Bounded: ≤ MAX_VIEWS_PER_TENANT views per org, ≤ MAX_TENANTS orgs, views older than
 * VIEW_TTL_MS are forgotten, and at most WARM_TOP views are rebuilt per invalidation.
 * Warm-ups are debounced so a burst of edits triggers ONE rebuild.
 *
 * Remembered requests are sanitized copies (no auth header / cookies / sockets).
 */

import { isCandidateOrgWarmEnabled } from './cacheKeys.js';

const MAX_VIEWS_PER_TENANT = 6;
const MAX_TENANTS = 200;
const VIEW_TTL_MS = 30 * 60 * 1000;
const DEBOUNCE_MS = 1200;
const REFRESH_REMEMBER_MS = 15_000;
const WARM_TOP = Math.min(6, Math.max(1, Number(process.env.CANDIDATE_ORG_CACHE_WARM_TOP || 3) || 3));

/** @type {Map<string, Map<string, { req: any, at: number, hits: number }>>} */
const hotByTenant = new Map();
/** @type {Map<string, NodeJS.Timeout>} */
const timers = new Map();
let fetcher = null;
let stats = { scheduled: 0, runs: 0, warmed: 0, failures: 0, skippedDisabled: 0 };

function tid(tenantId) {
  return String(tenantId || '').trim() || 'default';
}

const DROP_HEADERS = new Set(['authorization', 'cookie', 'set-cookie', 'x-api-key']);

/** Copy only what the list service reads; never keep tokens or live sockets. */
export function sanitizeRequestForReplay(req) {
  const headers = {};
  for (const [k, v] of Object.entries(req?.headers || {})) {
    if (!DROP_HEADERS.has(String(k).toLowerCase())) headers[k] = v;
  }
  return {
    method: 'GET',
    user: req?.user ? { ...req.user } : undefined,
    userWithPermissions: req?.userWithPermissions ? { ...req.userWithPermissions } : undefined,
    query: { ...(req?.query || {}) },
    headers,
    params: {},
    body: {},
    originalUrl: req?.originalUrl,
    url: req?.url,
    path: req?.path,
  };
}

/** The engine registers how to (re)load a list in a tenant context. */
export function setWarmFetcher(fn) {
  fetcher = typeof fn === 'function' ? fn : null;
}

export function rememberHotView(tenantId, keyBase, req) {
  if (!isCandidateOrgWarmEnabled()) return;
  const t = tid(tenantId);
  let views = hotByTenant.get(t);
  if (!views) {
    if (hotByTenant.size >= MAX_TENANTS) {
      const oldest = hotByTenant.keys().next().value;
      hotByTenant.delete(oldest);
    }
    views = new Map();
    hotByTenant.set(t, views);
  }
  const now = Date.now();
  const existing = views.get(keyBase);
  if (existing) {
    existing.hits += 1;
    // Re-snapshot occasionally so replays keep the user's current permissions.
    if (now - existing.at > REFRESH_REMEMBER_MS) existing.req = sanitizeRequestForReplay(req);
    existing.at = now;
    views.delete(keyBase);
    views.set(keyBase, existing);
    return;
  }
  views.set(keyBase, { req: sanitizeRequestForReplay(req), at: now, hits: 1 });
  while (views.size > MAX_VIEWS_PER_TENANT) {
    views.delete(views.keys().next().value);
  }
}

function pickViews(t) {
  const views = hotByTenant.get(t);
  if (!views) return [];
  const now = Date.now();
  const alive = [];
  for (const [key, view] of views.entries()) {
    if (now - view.at > VIEW_TTL_MS) views.delete(key);
    else alive.push([key, view]);
  }
  // Most recently used first.
  return alive.sort((a, b) => b[1].at - a[1].at).slice(0, WARM_TOP);
}

async function runWarm(t) {
  if (!fetcher) return;
  stats.runs += 1;
  for (const [, view] of pickViews(t)) {
    try {
      await fetcher(t, view.req);
      stats.warmed += 1;
    } catch {
      stats.failures += 1;
    }
  }
}

/** Debounced: many edits in a row trigger one rebuild after things settle. */
export function scheduleWarm(tenantId) {
  if (!isCandidateOrgWarmEnabled()) {
    stats.skippedDisabled += 1;
    return;
  }
  const t = tid(tenantId);
  if (!hotByTenant.get(t)?.size) return;
  stats.scheduled += 1;
  const existing = timers.get(t);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    timers.delete(t);
    void runWarm(t);
  }, DEBOUNCE_MS);
  // Never keep the process alive just for a warm-up.
  if (typeof timer.unref === 'function') timer.unref();
  timers.set(t, timer);
}

export function warmerStats(tenantId) {
  const t = tid(tenantId);
  return {
    enabled: isCandidateOrgWarmEnabled(),
    hotViews: hotByTenant.get(t)?.size || 0,
    pending: timers.has(t),
    ...stats,
  };
}

export function forgetHotViews(tenantId) {
  hotByTenant.delete(tid(tenantId));
  const timer = timers.get(tid(tenantId));
  if (timer) clearTimeout(timer);
  timers.delete(tid(tenantId));
}
