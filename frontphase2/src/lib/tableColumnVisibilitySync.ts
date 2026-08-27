'use client';

import {
  apiGetTableColumnVisibility,
  apiSetTableColumnModuleVisibility,
} from './api';

export const TABLE_COLUMNS_CACHE_EVENT = 'hrayntra:table-columns-cache';

type ColumnsMap = Record<string, string[]>;

let memoryCache: ColumnsMap | null = null;
let memoryTenant: string | null = null;
/** Tenant for which memoryCache was hydrated from the API (not only localStorage). */
let serverHydratedTenant: string | null = null;
let loadPromise: Promise<ColumnsMap> | null = null;
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

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

function readLocalCache(tenantScope: string): ColumnsMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(localCacheKey(tenantScope));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: ColumnsMap = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(value)) continue;
      out[key] = value.map((item) => String(item)).filter(Boolean);
    }
    return out;
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
  memoryCache = columns;
  if (fromServer) serverHydratedTenant = tenantScope;
  writeLocalCache(tenantScope, columns);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(TABLE_COLUMNS_CACHE_EVENT, {
        detail: { tenantScope, columns },
      }),
    );
  }
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

  loadPromise = (async () => {
    try {
      const res = await apiGetTableColumnVisibility();
      const columns =
        res.data?.columns && typeof res.data.columns === 'object'
          ? (res.data.columns as ColumnsMap)
          : {};
      const normalized: ColumnsMap = {};
      for (const [key, value] of Object.entries(columns)) {
        if (!Array.isArray(value)) continue;
        normalized[key] = value.map((item) => String(item)).filter(Boolean);
      }
      publishCache(tenantScope, normalized, true);
      return normalized;
    } catch {
      return memoryCache ?? local;
    } finally {
      loadPromise = null;
    }
  })();

  return loadPromise;
}

/**
 * Update one module in memory + local cache immediately, then debounce API save.
 */
export function persistTenantTableColumnModule(
  moduleKey: string,
  visibleIds: string[],
  options?: { debounceMs?: number },
) {
  const tenantScope = readTenantScope();
  const map = { ...ensureCacheForTenant(tenantScope), [moduleKey]: [...visibleIds] };
  publishCache(tenantScope, map, serverHydratedTenant === tenantScope);

  const debounceMs = options?.debounceMs ?? 400;
  const existing = saveTimers.get(moduleKey);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    saveTimers.delete(moduleKey);
    void apiSetTableColumnModuleVisibility(moduleKey, visibleIds)
      .then((res) => {
        const columns = res.data?.columns;
        if (columns && typeof columns === 'object') {
          publishCache(tenantScope, columns as ColumnsMap, true);
        }
      })
      .catch(() => {
        // Keep local cache; next login can retry.
      });
  }, debounceMs);
  saveTimers.set(moduleKey, timer);
}

export function clearTenantTableColumnsMemory() {
  memoryCache = null;
  memoryTenant = null;
  serverHydratedTenant = null;
  loadPromise = null;
}
