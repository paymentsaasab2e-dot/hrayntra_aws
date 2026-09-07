'use client';

import {
  apiGetTableColumnVisibility,
  apiSetTableColumnVisibility,
} from './api';

export const TABLE_COLUMNS_CACHE_EVENT = 'hrayntra:table-columns-cache';

type ColumnsMap = Record<string, string[]>;

let memoryCache: ColumnsMap | null = null;
let memoryTenant: string | null = null;
/** Tenant for which memoryCache was hydrated from the API (not only localStorage). */
let serverHydratedTenant: string | null = null;
let loadPromise: Promise<ColumnsMap> | null = null;
/** Bumped on every local persist so in-flight GETs cannot wipe user choices. */
let cacheRevision = 0;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let saveChain: Promise<void> = Promise.resolve();

function readTenantScope(): string {
  if (typeof window === 'undefined') return 'none';
  try {
    return String(localStorage.getItem('tenantDbName') || 'none').trim() || 'none';
  } catch {
    return 'none';
  }
}

function localCacheKey(tenantScope: string): string {
  return `tenantColumnsServerCache:${tenantScope}`;
}

function cloneMap(columns: ColumnsMap): ColumnsMap {
  const out: ColumnsMap = {};
  for (const [key, value] of Object.entries(columns)) {
    if (!Array.isArray(value)) continue;
    out[key] = value.map((item) => String(item)).filter(Boolean);
  }
  return out;
}

function readLocalCache(tenantScope: string): ColumnsMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(localCacheKey(tenantScope));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return cloneMap(parsed as Record<string, unknown> as ColumnsMap);
  } catch {
    return {};
  }
}

function writeLocalCache(tenantScope: string, columns: ColumnsMap) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(localCacheKey(tenantScope), JSON.stringify(columns));
  } catch {
    // Ignore quota / private mode failures.
  }
}

function ensureCacheForTenant(tenantScope: string): ColumnsMap {
  if (memoryCache && memoryTenant === tenantScope) return memoryCache;
  memoryTenant = tenantScope;
  memoryCache = readLocalCache(tenantScope);
  return memoryCache;
}

function publishCache(tenantScope: string, columns: ColumnsMap, fromServer = false) {
  memoryTenant = tenantScope;
  memoryCache = cloneMap(columns);
  if (fromServer) serverHydratedTenant = tenantScope;
  writeLocalCache(tenantScope, memoryCache);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(TABLE_COLUMNS_CACHE_EVENT, {
        detail: { tenantScope, columns: memoryCache, revision: cacheRevision },
      }),
    );
  }
}

/** Server wins for known modules; keep local-only modules that are not on the server yet. */
function mergeServerWithLocalOnlyKeys(server: ColumnsMap, local: ColumnsMap): ColumnsMap {
  const merged = cloneMap(server);
  for (const [key, ids] of Object.entries(local)) {
    if (!Object.prototype.hasOwnProperty.call(merged, key)) {
      merged[key] = [...ids];
    }
  }
  return merged;
}

export function getCachedTableColumnModule(
  moduleKey: string,
  tenantScope = readTenantScope(),
): string[] | null {
  const map = ensureCacheForTenant(tenantScope);
  if (!Object.prototype.hasOwnProperty.call(map, moduleKey)) return null;
  return [...map[moduleKey]];
}

/**
 * Load full tenant map from API (shared promise across hooks).
 * Falls back to local cache when offline.
 * In-flight responses are ignored after the user changes columns locally.
 */
export async function loadTenantTableColumns(
  force = false,
): Promise<ColumnsMap> {
  const tenantScope = readTenantScope();
  if (memoryTenant !== tenantScope) {
    memoryCache = readLocalCache(tenantScope);
    memoryTenant = tenantScope;
    loadPromise = null;
  }

  if (!force && serverHydratedTenant === tenantScope && memoryCache) {
    return memoryCache;
  }
  if (loadPromise) return loadPromise;

  const local = ensureCacheForTenant(tenantScope);
  const revisionAtStart = cacheRevision;

  loadPromise = (async () => {
    try {
      const res = await apiGetTableColumnVisibility();
      const columns =
        res.data?.columns && typeof res.data.columns === 'object'
          ? (res.data.columns as ColumnsMap)
          : {};
      const normalized = cloneMap(columns);

      // User changed columns while this GET was in flight — keep local choices.
      if (revisionAtStart !== cacheRevision) {
        return memoryCache ?? local;
      }

      const merged = mergeServerWithLocalOnlyKeys(normalized, memoryCache ?? local);
      publishCache(tenantScope, merged, true);
      return merged;
    } catch {
      return memoryCache ?? local;
    } finally {
      loadPromise = null;
    }
  })();

  return loadPromise;
}

function flushTenantTableColumns(tenantScope: string, snapshot: ColumnsMap, revision: number) {
  saveChain = saveChain
    .then(async () => {
      if (revision !== cacheRevision || readTenantScope() !== tenantScope) return;
      const latest = cloneMap(memoryCache && memoryTenant === tenantScope ? memoryCache : snapshot);
      try {
        await apiSetTableColumnVisibility(latest);
        if (revision !== cacheRevision || readTenantScope() !== tenantScope) return;
        serverHydratedTenant = tenantScope;
      } catch {
        // Keep local cache; next change or reload can retry.
      }
    })
    .catch(() => undefined);
}

/**
 * Update one module in memory + local cache immediately, then debounce a
 * full-map API save so concurrent page hooks cannot overwrite each other.
 */
export function persistTenantTableColumnModule(
  moduleKey: string,
  visibleIds: string[],
  options?: { debounceMs?: number },
) {
  const tenantScope = readTenantScope();
  cacheRevision += 1;
  const revision = cacheRevision;
  const map = { ...ensureCacheForTenant(tenantScope), [moduleKey]: [...visibleIds] };
  publishCache(tenantScope, map, serverHydratedTenant === tenantScope);

  const debounceMs = options?.debounceMs ?? 400;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    flushTenantTableColumns(tenantScope, map, revision);
  }, debounceMs);
}

export function clearTenantTableColumnsMemory() {
  memoryCache = null;
  memoryTenant = null;
  serverHydratedTenant = null;
  loadPromise = null;
  cacheRevision += 1;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
}
