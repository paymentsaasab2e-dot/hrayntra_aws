'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getCachedTableColumnModule,
  loadTenantTableColumns,
  persistTenantTableColumnModule,
  TABLE_COLUMNS_CACHE_EVENT,
} from '../lib/tableColumnVisibilitySync';

export type TableColumnDef = {
  id: string;
  label: string;
  /** Locked columns are always visible and cannot be toggled off. */
  locked?: boolean;
  /**
   * When false, the column is available in the Columns menu but hidden by default
   * (until the user enables it or it was previously saved as visible).
   * Defaults to true.
   */
  defaultVisible?: boolean;
};

/** Active workspace DB name — column prefs must not leak across tenants. */
export function readTenantColumnScope(): string {
  if (typeof window === 'undefined') return 'none';
  try {
    return String(localStorage.getItem('tenantDbName') || 'none').trim() || 'none';
  } catch {
    return 'none';
  }
}

/**
 * localStorage key scoped to the current tenant (legacy / offline mirror).
 * Server source of truth: ORG Setting `tableColumnVisibility`.
 */
export function tenantScopedStorageKey(moduleKey: string, tenantScope?: string): string {
  const scope = tenantScope ?? readTenantColumnScope();
  return `tenantColumns:${scope}:${moduleKey}`;
}

function readStoredIds(storageKey: string): string[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.map((item) => String(item)).filter(Boolean);
  } catch {
    return null;
  }
}

function writeStoredIds(storageKey: string, ids: string[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(ids));
  } catch {
    // Ignore quota / private mode failures.
  }
}

function defaultVisibleIds(columns: TableColumnDef[]): string[] {
  return columns
    .filter((col) => col.locked || col.defaultVisible !== false)
    .map((col) => col.id);
}

function normalizeVisibleIds(columns: TableColumnDef[], preferred: string[] | null): string[] {
  const allIds = columns.map((col) => col.id);
  const known = new Set(allIds);
  const lockedIds = columns.filter((col) => col.locked).map((col) => col.id);
  const base = preferred?.filter((id) => known.has(id)) ?? defaultVisibleIds(columns);
  const merged = new Set([...base, ...lockedIds]);
  // Preserve registry order for stable table layout.
  return allIds.filter((id) => merged.has(id));
}

function columnRegistryKey(columns: TableColumnDef[]) {
  return columns
    .map((c) => `${c.id}:${c.locked ? 1 : 0}:${c.defaultVisible === false ? 0 : 1}`)
    .join('|');
}

function useTenantColumnScope(): string {
  const [tenantScope, setTenantScope] = useState(readTenantColumnScope);

  useEffect(() => {
    const syncTenant = () => {
      const next = readTenantColumnScope();
      setTenantScope((prev) => (prev === next ? prev : next));
    };
    syncTenant();
    window.addEventListener('focus', syncTenant);
    window.addEventListener('storage', syncTenant);
    const intervalId = window.setInterval(syncTenant, 1500);
    return () => {
      window.removeEventListener('focus', syncTenant);
      window.removeEventListener('storage', syncTenant);
      window.clearInterval(intervalId);
    };
  }, []);

  return tenantScope;
}

function resolveModuleIds(
  moduleKey: string,
  tenantScope: string,
): string[] | null {
  const fromServerCache = getCachedTableColumnModule(moduleKey, tenantScope);
  if (fromServerCache) return fromServerCache;
  return readStoredIds(tenantScopedStorageKey(moduleKey, tenantScope));
}

/**
 * Persist a string[] per tenant module (e.g. Leads/Clients custom columns).
 * Synced to ORG settings so the same browser or another browser gets the same choice.
 */
export function useTenantScopedStringArray(moduleKey: string) {
  const tenantScope = useTenantColumnScope();
  const resolvedKey = useMemo(
    () => tenantScopedStorageKey(moduleKey, tenantScope),
    [moduleKey, tenantScope],
  );
  const skipNextPersistRef = useRef(true);

  const [values, setValues] = useState<string[]>(() => {
    return resolveModuleIds(moduleKey, readTenantColumnScope()) ?? [];
  });

  // Load from tenant server (and refresh when tenant changes).
  useEffect(() => {
    let cancelled = false;
    skipNextPersistRef.current = true;
    const local = resolveModuleIds(moduleKey, tenantScope) ?? [];
    setValues(local);

    void loadTenantTableColumns().then((map) => {
      if (cancelled) return;
      skipNextPersistRef.current = true;
      if (Object.prototype.hasOwnProperty.call(map, moduleKey)) {
        const next = Array.isArray(map[moduleKey]) ? map[moduleKey] : [];
        setValues(next);
        writeStoredIds(resolvedKey, next);
        return;
      }
      // Migrate browser-only prefs to tenant server on first sync.
      const legacy = readStoredIds(resolvedKey) ?? [];
      setValues(legacy);
      if (legacy.length > 0) {
        skipNextPersistRef.current = false;
        persistTenantTableColumnModule(moduleKey, legacy);
      }
    });

    const onCache = (event: Event) => {
      const detail = (event as CustomEvent).detail as
        | { tenantScope?: string; columns?: Record<string, string[]> }
        | undefined;
      if (detail?.tenantScope && detail.tenantScope !== tenantScope) return;
      const next = detail?.columns?.[moduleKey];
      if (!Array.isArray(next)) return;
      skipNextPersistRef.current = true;
      setValues(next);
      writeStoredIds(resolvedKey, next);
    };
    window.addEventListener(TABLE_COLUMNS_CACHE_EVENT, onCache);
    return () => {
      cancelled = true;
      window.removeEventListener(TABLE_COLUMNS_CACHE_EVENT, onCache);
    };
  }, [moduleKey, tenantScope, resolvedKey]);

  useEffect(() => {
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    writeStoredIds(resolvedKey, values);
    persistTenantTableColumnModule(moduleKey, values);
  }, [moduleKey, resolvedKey, values]);

  return [values, setValues] as const;
}

/**
 * Persist show/hide column prefs per module **and per tenant**.
 * Source of truth: tenant ORG Setting (works across browsers).
 * localStorage is a fast local mirror / offline fallback.
 */
export function usePersistedColumnVisibility(
  storageKey: string,
  columns: TableColumnDef[],
) {
  const registryKey = columnRegistryKey(columns);
  const tenantScope = useTenantColumnScope();
  const resolvedStorageKey = useMemo(
    () => tenantScopedStorageKey(storageKey, tenantScope),
    [tenantScope, storageKey],
  );
  const skipNextPersistRef = useRef(true);

  const defaultIds = useMemo(
    () => defaultVisibleIds(columns),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [registryKey],
  );

  const [visibleIds, setVisibleIdsState] = useState<string[]>(() =>
    normalizeVisibleIds(
      columns,
      resolveModuleIds(storageKey, readTenantColumnScope()),
    ),
  );

  useEffect(() => {
    let cancelled = false;
    skipNextPersistRef.current = true;
    setVisibleIdsState(
      normalizeVisibleIds(columns, resolveModuleIds(storageKey, tenantScope)),
    );

    void loadTenantTableColumns().then((map) => {
      if (cancelled) return;
      skipNextPersistRef.current = true;
      if (Object.prototype.hasOwnProperty.call(map, storageKey)) {
        const preferred = Array.isArray(map[storageKey]) ? map[storageKey] : null;
        const next = normalizeVisibleIds(columns, preferred);
        setVisibleIdsState(next);
        writeStoredIds(resolvedStorageKey, next);
        return;
      }
      // Migrate browser-only prefs to tenant server on first sync.
      const legacy = readStoredIds(resolvedStorageKey);
      const next = normalizeVisibleIds(columns, legacy);
      setVisibleIdsState(next);
      writeStoredIds(resolvedStorageKey, next);
      if (legacy && legacy.length > 0) {
        skipNextPersistRef.current = false;
        persistTenantTableColumnModule(storageKey, next);
      }
    });

    const onCache = (event: Event) => {
      const detail = (event as CustomEvent).detail as
        | { tenantScope?: string; columns?: Record<string, string[]> }
        | undefined;
      if (detail?.tenantScope && detail.tenantScope !== tenantScope) return;
      if (!detail?.columns || !Object.prototype.hasOwnProperty.call(detail.columns, storageKey)) {
        return;
      }
      skipNextPersistRef.current = true;
      const next = normalizeVisibleIds(columns, detail.columns[storageKey] ?? null);
      setVisibleIdsState(next);
      writeStoredIds(resolvedStorageKey, next);
    };
    window.addEventListener(TABLE_COLUMNS_CACHE_EVENT, onCache);
    return () => {
      cancelled = true;
      window.removeEventListener(TABLE_COLUMNS_CACHE_EVENT, onCache);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedStorageKey, registryKey, storageKey, tenantScope]);

  useEffect(() => {
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    writeStoredIds(resolvedStorageKey, visibleIds);
    persistTenantTableColumnModule(storageKey, visibleIds);
  }, [resolvedStorageKey, storageKey, visibleIds]);

  const setVisibleIds = useCallback(
    (next: string[] | ((prev: string[]) => string[])) => {
      setVisibleIdsState((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        return normalizeVisibleIds(columns, resolved);
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [registryKey],
  );

  const isVisible = useCallback(
    (id: string) => visibleIds.includes(id),
    [visibleIds],
  );

  const toggle = useCallback(
    (id: string) => {
      const col = columns.find((item) => item.id === id);
      if (!col || col.locked) return;
      setVisibleIds((prev) =>
        prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [registryKey, setVisibleIds],
  );

  const resetToDefault = useCallback(() => {
    setVisibleIds(defaultIds);
  }, [defaultIds, setVisibleIds]);

  const unlockedVisibleCount = useMemo(
    () =>
      visibleIds.filter((id) => {
        const col = columns.find((item) => item.id === id);
        return col && !col.locked;
      }).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [registryKey, visibleIds],
  );

  return {
    visibleIds,
    isVisible,
    toggle,
    setVisibleIds,
    resetToDefault,
    visibleCount: visibleIds.length,
    unlockedVisibleCount,
  };
}
