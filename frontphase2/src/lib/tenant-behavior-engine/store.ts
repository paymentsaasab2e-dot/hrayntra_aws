import {
  categorizePhase2Path,
  isMeaningfulPhase2Path,
  localDateKey,
} from './categories';
import { funnelIndex, isForwardFunnelStep } from './path-entities';
import type {
  TenantActionBreakdown,
  TenantActivityCategory,
  TenantActivityEvent,
  TenantActivityEventType,
  TenantActivitySession,
  TenantActivityState,
  TenantCrmSnapshot,
  TenantDayBucket,
  TenantEntityFocus,
} from './types';

export const TENANT_BEHAVIOR_STORAGE_KEY = 'saasa:tenant-behavior-v3';
export const TENANT_BEHAVIOR_SYNC_EVENT = 'saasa:tenant-behavior-sync';

const MAX_SESSIONS = 80;
const MAX_DAY_KEYS = 120;
const MAX_EVENTS = 800;
const MAX_ENTITY_FOCUS = 40;
const MAX_JOURNEYS = 30;
const SESSION_IDLE_MS = 30 * 60 * 1000;

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function storageKey(tenantDbName: string, userId: string) {
  return `${tenantDbName || 'default'}:${userId}`;
}

function emptyActionBreakdown(): TenantActionBreakdown {
  return {};
}

function emptyTotals(): TenantActivityState['totals'] {
  return {
    logins: 0,
    visits: 0,
    entityClicks: 0,
    entityViews: 0,
    searches: 0,
    actions: 0,
    apiMutations: 0,
    activeMs: 0,
    sessions: 0,
    pageVisitsByCategory: {},
    activeMsByCategory: {},
    actionsByCategory: {},
    actionBreakdown: emptyActionBreakdown(),
  };
}

function emptyDay(date: string): TenantDayBucket {
  return {
    date,
    logins: 0,
    visits: 0,
    entityClicks: 0,
    entityViews: 0,
    searches: 0,
    actions: 0,
    apiMutations: 0,
    pageVisitsByCategory: {},
    activeMsByCategory: {},
    actionsByCategory: {},
    activeMs: 0,
    sessionIds: [],
  };
}

function loadAll(): Record<string, TenantActivityState> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(TENANT_BEHAVIOR_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, TenantActivityState>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveAll(map: Record<string, TenantActivityState>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TENANT_BEHAVIOR_STORAGE_KEY, JSON.stringify(map));
}

function migrateState(state: TenantActivityState) {
  if (!state.totals.actionBreakdown) state.totals.actionBreakdown = emptyActionBreakdown();
  if (!state.totals.actionsByCategory) state.totals.actionsByCategory = {};
  if (state.totals.entityViews == null) state.totals.entityViews = 0;
  if (state.totals.searches == null) state.totals.searches = 0;
  if (state.totals.apiMutations == null) state.totals.apiMutations = 0;
  if (!state.entityFocus) state.entityFocus = [];
  if (!state.recentJourneys) state.recentJourneys = [];
  if (!state.events) state.events = [];
  if (!state.firstOpens) state.firstOpens = [];
  for (const day of Object.values(state.days || {})) {
    if (day.entityViews == null) day.entityViews = 0;
    if (day.searches == null) day.searches = 0;
    if (day.apiMutations == null) day.apiMutations = 0;
    if (!day.actionsByCategory) day.actionsByCategory = {};
  }
}

function bumpCategory(
  map: Partial<Record<TenantActivityCategory, number>>,
  cat: TenantActivityCategory,
  n = 1,
) {
  map[cat] = (map[cat] || 0) + n;
}

function bumpActionBreakdown(map: TenantActionBreakdown, actionType: string) {
  const key = (actionType || 'other') as keyof TenantActionBreakdown;
  map[key] = (map[key] || 0) + 1;
}

function ensureDay(state: TenantActivityState, date = localDateKey()): TenantDayBucket {
  if (!state.days[date]) state.days[date] = emptyDay(date);
  return state.days[date];
}

function currentSession(state: TenantActivityState): TenantActivitySession | null {
  if (!state.currentSessionId) return null;
  return state.sessions.find((s) => s.id === state.currentSessionId) || null;
}

function pushEvent(
  state: TenantActivityState,
  type: TenantActivityEventType,
  category: TenantActivityCategory,
  opts?: { path?: string; meta?: Record<string, unknown> },
) {
  const session = currentSession(state);
  const event: TenantActivityEvent = {
    id: uid('ev'),
    at: new Date().toISOString(),
    type,
    category,
    path: opts?.path,
    sessionId: session?.id,
    meta: opts?.meta,
  };
  state.events.push(event);
  if (state.events.length > MAX_EVENTS) state.events = state.events.slice(-MAX_EVENTS);
}

function recordWorkflowStep(
  state: TenantActivityState,
  category: TenantActivityCategory,
  path?: string,
) {
  const session = currentSession(state);
  const prev = state.lastWorkflowCategory;
  if (prev === category) return;

  let forward = false;
  if (prev && isForwardFunnelStep(prev, category)) forward = true;

  pushEvent(state, 'workflow_step', category, {
    path,
    meta: { from: prev, forward },
  });

  if (session) {
    let journey = state.recentJourneys.find((j) => j.sessionId === session.id);
    if (!journey) {
      journey = { sessionId: session.id, steps: [], forwardSteps: 0, completedFunnel: false };
      state.recentJourneys.push(journey);
    }
    journey.steps.push({ category, at: new Date().toISOString(), path });
    if (forward) journey.forwardSteps += 1;
    const touched = new Set(journey.steps.map((s) => s.category));
    journey.completedFunnel =
      funnelIndex('leads') >= 0 &&
      ['leads', 'jobs', 'candidates', 'interviews'].every((c) => touched.has(c as TenantActivityCategory));
    if (state.recentJourneys.length > MAX_JOURNEYS) {
      state.recentJourneys = state.recentJourneys.slice(-MAX_JOURNEYS);
    }
  }

  state.lastWorkflowCategory = category;
}

function upsertEntityFocus(
  state: TenantActivityState,
  input: {
    entityType: string;
    entityId?: string;
    label?: string;
    category: TenantActivityCategory;
    kind: 'view' | 'click' | 'action';
  },
) {
  const key = `${input.entityType}:${input.entityId || input.label || 'unknown'}`;
  let row = state.entityFocus.find((e) => e.key === key);
  const now = new Date().toISOString();
  if (!row) {
    row = {
      key,
      entityType: input.entityType,
      entityId: input.entityId,
      label: input.label,
      category: input.category,
      views: 0,
      clicks: 0,
      actions: 0,
      lastAt: now,
    };
    state.entityFocus.push(row);
  }
  if (input.kind === 'view') row.views += 1;
  if (input.kind === 'click') row.clicks += 1;
  if (input.kind === 'action') row.actions += 1;
  row.lastAt = now;
  if (input.label) row.label = input.label;
  state.entityFocus.sort(
    (a, b) => b.views + b.clicks * 2 + b.actions * 3 - (a.views + a.clicks * 2 + a.actions * 3),
  );
  if (state.entityFocus.length > MAX_ENTITY_FOCUS) {
    state.entityFocus = state.entityFocus.slice(0, MAX_ENTITY_FOCUS);
  }
}

function pruneState(state: TenantActivityState) {
  const dayKeys = Object.keys(state.days).sort();
  if (dayKeys.length > MAX_DAY_KEYS) {
    for (const k of dayKeys.slice(0, dayKeys.length - MAX_DAY_KEYS)) delete state.days[k];
  }
  if (state.sessions.length > MAX_SESSIONS) {
    state.sessions = state.sessions.slice(-MAX_SESSIONS);
  }
}

export function getTenantActivityState(tenantDbName: string, userId: string): TenantActivityState {
  const key = storageKey(tenantDbName, userId);
  const map = loadAll();
  if (!map[key]) {
    const now = new Date().toISOString();
    map[key] = {
      userId,
      tenantDbName,
      createdAt: now,
      updatedAt: now,
      totals: emptyTotals(),
      days: {},
      sessions: [],
      firstOpens: [],
      events: [],
      entityFocus: [],
      recentJourneys: [],
    };
    saveAll(map);
  }
  migrateState(map[key]);
  return map[key];
}

export function persistTenantActivityState(state: TenantActivityState) {
  state.updatedAt = new Date().toISOString();
  migrateState(state);
  pruneState(state);
  const map = loadAll();
  map[storageKey(state.tenantDbName, state.userId)] = state;
  saveAll(map);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(TENANT_BEHAVIOR_SYNC_EVENT, {
        detail: { tenantDbName: state.tenantDbName, userId: state.userId },
      }),
    );
  }
}

function parseClientDevice() {
  if (typeof navigator === 'undefined') {
    return { deviceType: 'desktop', browser: 'Unknown', operatingSystem: 'Unknown' };
  }
  const ua = navigator.userAgent || '';
  let browser = 'Unknown';
  let operatingSystem = 'Unknown';
  let deviceType = 'desktop';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua)) browser = 'Safari';
  if (/Windows/i.test(ua)) operatingSystem = 'Windows';
  else if (/Mac OS/i.test(ua)) operatingSystem = 'macOS';
  else if (/Android/i.test(ua)) operatingSystem = 'Android';
  else if (/iPhone|iPad/i.test(ua)) operatingSystem = 'iOS';
  if (/Mobile|Android|iPhone/i.test(ua)) deviceType = 'mobile';
  return { deviceType, browser, operatingSystem };
}

export function ensureTenantActivitySession(
  tenantDbName: string,
  userId: string,
  opts?: { path?: string; userName?: string },
): TenantActivitySession | null {
  if (!tenantDbName || !userId) return null;
  const state = getTenantActivityState(tenantDbName, userId);
  if (opts?.userName) state.userName = opts.userName;
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  let session = currentSession(state);
  const cat = opts?.path ? categorizePhase2Path(opts.path) : 'other';
  const idle =
    session && session.lastActiveAt ? now - Date.parse(session.lastActiveAt) : Number.POSITIVE_INFINITY;

  if (!session || idle > SESSION_IDLE_MS) {
    if (session && !session.endedAt) {
      session.endedAt = nowIso;
      session.durationMs = Math.max(session.durationMs, now - Date.parse(session.startedAt));
      pushEvent(state, 'session_end', session.lastCategory || 'other', {
        path: session.lastPath,
        meta: { durationMs: session.durationMs },
      });
    }
    const device = parseClientDevice();
    session = {
      id: uid('sess'),
      startedAt: nowIso,
      lastActiveAt: nowIso,
      durationMs: 0,
      pageCount: 0,
      firstPath: opts?.path,
      lastPath: opts?.path,
      lastCategory: opts?.path ? cat : undefined,
      paths: opts?.path ? [opts.path] : [],
      ...device,
    };
    state.sessions.push(session);
    state.currentSessionId = session.id;
    state.lastWorkflowCategory = undefined;
    state.totals.logins += 1;
    state.totals.sessions += 1;
    const day = ensureDay(state);
    day.logins += 1;
    if (!day.sessionIds.includes(session.id)) day.sessionIds.push(session.id);
    pushEvent(state, 'login', cat, { path: opts?.path, meta: device });
  } else {
    session.lastActiveAt = nowIso;
  }

  persistTenantActivityState(state);
  return session;
}

export function recordTenantPageVisit(
  tenantDbName: string,
  userId: string,
  pathname: string,
  search = '',
) {
  if (!tenantDbName || !userId || !pathname) return;
  ensureTenantActivitySession(tenantDbName, userId, { path: pathname });
  const state = getTenantActivityState(tenantDbName, userId);
  const session = currentSession(state);
  const day = ensureDay(state);
  const cat = categorizePhase2Path(pathname);
  const nowIso = new Date().toISOString();

  state.totals.visits += 1;
  day.visits += 1;
  bumpCategory(state.totals.pageVisitsByCategory, cat);
  bumpCategory(day.pageVisitsByCategory, cat);
  state.lastPath = pathname;
  state.lastCategory = cat;
  recordWorkflowStep(state, cat, pathname);

  if (session) {
    session.lastActiveAt = nowIso;
    session.lastPath = pathname;
    session.lastCategory = cat;
    session.pageCount += 1;
    if (!session.firstPath) session.firstPath = pathname;
    if (!session.paths.includes(pathname)) session.paths.push(pathname);
  }

  pushEvent(state, 'page_visit', cat, { path: pathname, meta: { search: search || undefined } });

  if (search && (search.includes('search=') || search.includes('q=') || search.includes('tab='))) {
    state.totals.searches += 1;
    day.searches += 1;
    pushEvent(state, 'search', cat, { path: pathname, meta: { search } });
  }

  if (isMeaningfulPhase2Path(pathname) && !day.firstOpenCategory) {
    day.firstOpenCategory = cat;
    day.firstOpenPath = pathname;
    day.firstOpenAt = nowIso;
    state.firstOpens.push({ date: day.date, category: cat, path: pathname, at: nowIso });
  }

  persistTenantActivityState(state);
}

export function recordTenantEntityView(
  tenantDbName: string,
  userId: string,
  input: {
    pathname: string;
    entityType: string;
    entityId?: string;
    entityLabel?: string;
    category: TenantActivityCategory;
  },
) {
  if (!tenantDbName || !userId) return;
  ensureTenantActivitySession(tenantDbName, userId, { path: input.pathname });
  const state = getTenantActivityState(tenantDbName, userId);
  const day = ensureDay(state);
  state.totals.entityViews += 1;
  day.entityViews += 1;
  upsertEntityFocus(state, { ...input, kind: 'view' });
  pushEvent(state, 'entity_view', input.category, {
    path: input.pathname,
    meta: {
      entityType: input.entityType,
      entityId: input.entityId,
      entityLabel: input.entityLabel,
    },
  });
  persistTenantActivityState(state);
}

export function recordTenantEntityClick(
  tenantDbName: string,
  userId: string,
  input: {
    pathname?: string;
    entityType: string;
    entityId?: string;
    entityLabel?: string;
    category: TenantActivityCategory;
  },
) {
  if (!tenantDbName || !userId) return;
  const path = input.pathname || statePathFallback();
  ensureTenantActivitySession(tenantDbName, userId, { path });
  const state = getTenantActivityState(tenantDbName, userId);
  const day = ensureDay(state);
  state.totals.entityClicks += 1;
  day.entityClicks += 1;
  upsertEntityFocus(state, { ...input, kind: 'click' });
  pushEvent(state, 'entity_click', input.category, {
    path,
    meta: {
      entityType: input.entityType,
      entityId: input.entityId,
      entityLabel: input.entityLabel,
    },
  });
  persistTenantActivityState(state);
}

function statePathFallback() {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname || '/';
}

export function recordTenantAction(
  tenantDbName: string,
  userId: string,
  input: {
    actionType: string;
    category: TenantActivityCategory;
    path?: string;
    entityType?: string;
    entityId?: string;
    entityLabel?: string;
    source?: 'ui' | 'api';
    meta?: Record<string, unknown>;
  },
) {
  if (!tenantDbName || !userId) return;
  const path = input.path || statePathFallback();
  ensureTenantActivitySession(tenantDbName, userId, { path });
  const state = getTenantActivityState(tenantDbName, userId);
  const day = ensureDay(state);

  state.totals.actions += 1;
  day.actions += 1;
  bumpCategory(state.totals.actionsByCategory, input.category);
  bumpCategory(day.actionsByCategory, input.category);
  bumpActionBreakdown(state.totals.actionBreakdown, input.actionType);

  if (input.source === 'api') {
    state.totals.apiMutations += 1;
    day.apiMutations += 1;
  }

  if (input.entityType) {
    upsertEntityFocus(state, {
      entityType: input.entityType,
      entityId: input.entityId,
      label: input.entityLabel,
      category: input.category,
      kind: 'action',
    });
  }

  recordWorkflowStep(state, input.category, path);

  pushEvent(state, input.source === 'api' ? 'api_mutation' : 'action', input.category, {
    path,
    meta: {
      actionType: input.actionType,
      entityType: input.entityType,
      entityId: input.entityId,
      entityLabel: input.entityLabel,
      ...input.meta,
    },
  });

  persistTenantActivityState(state);
}

export function recordTenantActiveTime(
  tenantDbName: string,
  userId: string,
  ms: number,
  pathname?: string,
) {
  if (!tenantDbName || !userId || ms <= 0) return;
  const state = getTenantActivityState(tenantDbName, userId);
  const cat = pathname ? categorizePhase2Path(pathname) : state.lastCategory || 'other';
  const day = ensureDay(state);
  state.totals.activeMs += ms;
  day.activeMs += ms;
  bumpCategory(state.totals.activeMsByCategory, cat);
  bumpCategory(day.activeMsByCategory, cat);
  const session = currentSession(state);
  if (session) {
    session.durationMs += ms;
    session.lastActiveAt = new Date().toISOString();
  }
  pushEvent(state, 'time_slice', cat, { path: pathname, meta: { durationMs: ms } });
  persistTenantActivityState(state);
}

export function syncTenantCrmSnapshot(
  tenantDbName: string,
  userId: string,
  snapshot: Omit<TenantCrmSnapshot, 'updatedAt'>,
) {
  const state = getTenantActivityState(tenantDbName, userId);
  state.crmSnapshot = { ...snapshot, updatedAt: new Date().toISOString() };
  persistTenantActivityState(state);
}

export function endTenantActivitySession(tenantDbName: string, userId: string) {
  const state = getTenantActivityState(tenantDbName, userId);
  const session = currentSession(state);
  if (!session || session.endedAt) return;
  session.endedAt = new Date().toISOString();
  session.durationMs = Math.max(
    session.durationMs,
    Date.parse(session.endedAt) - Date.parse(session.startedAt),
  );
  pushEvent(state, 'session_end', session.lastCategory || 'other', {
    path: session.lastPath,
    meta: { durationMs: session.durationMs, pageCount: session.pageCount },
  });
  state.currentSessionId = undefined;
  state.lastWorkflowCategory = undefined;
  persistTenantActivityState(state);
}

export function getTopEntityFocus(state: TenantActivityState, limit = 8): TenantEntityFocus[] {
  return [...(state.entityFocus || [])].slice(0, limit);
}
