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
  /** Nested toggles shown under this column (e.g. Pipeline → Applied / Screening). */
  children?: TableColumnDef[];
  /** Omit from the Columns(N) badge (nested stage chips). */
  excludeFromBadgeCount?: boolean;
};

/** Flatten nested column defs for persistence / visibility lookups. */
export function flattenTableColumns(
  columns: TableColumnDef[],
  options?: { includeChildren?: boolean },
): TableColumnDef[] {
  const includeChildren = options?.includeChildren !== false;
  const out: TableColumnDef[] = [];
  for (const col of columns) {
    const { children, ...rest } = col;
    out.push(rest);
    if (includeChildren && Array.isArray(children) && children.length > 0) {
      for (const child of children) {
        out.push({
          ...child,
          excludeFromBadgeCount: child.excludeFromBadgeCount ?? true,
        });
      }
    }
  }
  return out;
}

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

function sameIdList(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((id, index) => id === b[index]);
}

function columnRegistryKey(columns: TableColumnDef[]) {
  return columns
    .map((column) => {
      const lockedFlag = column.locked ? '1' : '0';
      const visibleFlag = column.defaultVisible === false ? '0' : '1';
      return `${column.id}:${lockedFlag}:${visibleFlag}`;
    })
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
 * Writes only when the caller changes the value — hydration never saves defaults.
 */
export function useTenantScopedStringArray(moduleKey: string) {
  const tenantScope = useTenantColumnScope();
  const resolvedKey = useMemo(
    () => tenantScopedStorageKey(moduleKey, tenantScope),
    [moduleKey, tenantScope],
  );
  const userTouchedRef = useRef(false);
  const valuesRef = useRef<string[]>([]);

  const [values, setValuesState] = useState<string[]>(() => {
    const initial = resolveModuleIds(moduleKey, readTenantColumnScope()) ?? [];
    valuesRef.current = initial;
    return initial;
  });
  valuesRef.current = values;

  useEffect(() => {
    let cancelled = false;
    userTouchedRef.current = false;
    const local = resolveModuleIds(moduleKey, tenantScope) ?? [];
    valuesRef.current = local;
    setValuesState(local);

    void loadTenantTableColumns().then((map) => {
      if (cancelled || userTouchedRef.current) return;
      const serverIds = Object.prototype.hasOwnProperty.call(map, moduleKey)
        ? (Array.isArray(map[moduleKey]) ? map[moduleKey] : [])
        : null;
      const legacy = readStoredIds(resolvedKey);
      // Prefer non-empty local mirror so saved dynamic choices are not replaced by a stale server [].
      const next =
        legacy !== null
          ? legacy
          : serverIds ?? [];
      if (!sameIdList(next, valuesRef.current)) {
        valuesRef.current = next;
        setValuesState(next);
      }
      if (legacy === null && next.length > 0) {
        writeStoredIds(resolvedKey, next);
      } else if (legacy !== null && !sameIdList(legacy, next)) {
        writeStoredIds(resolvedKey, next);
      }
      if (legacy !== null && legacy.length > 0 && (!serverIds || !sameIdList(legacy, serverIds))) {
        persistTenantTableColumnModule(moduleKey, legacy);
      }
    });

    const onCache = (event: Event) => {
      const detail = (event as CustomEvent).detail as
        | { tenantScope?: string; columns?: Record<string, string[]> }
        | undefined;
      if (detail?.tenantScope && detail.tenantScope !== tenantScope) return;
      if (userTouchedRef.current) return;
      const next = detail?.columns?.[moduleKey];
      if (!Array.isArray(next)) return;
      const legacy = readStoredIds(resolvedKey);
      if (legacy !== null && !sameIdList(legacy, next)) {
        // Keep local saved choice when cache differs.
        if (!sameIdList(legacy, valuesRef.current)) {
          valuesRef.current = legacy;
          setValuesState(legacy);
        }
        return;
      }
      if (sameIdList(next, valuesRef.current)) return;
      valuesRef.current = next;
      setValuesState(next);
      writeStoredIds(resolvedKey, next);
    };
    window.addEventListener(TABLE_COLUMNS_CACHE_EVENT, onCache);
    return () => {
      cancelled = true;
      window.removeEventListener(TABLE_COLUMNS_CACHE_EVENT, onCache);
    };
  }, [moduleKey, tenantScope, resolvedKey]);

  const setValues = useCallback(
    (next: string[] | ((prev: string[]) => string[])) => {
      setValuesState((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        const ids = Array.isArray(resolved) ? resolved.map((item) => String(item)).filter(Boolean) : [];
        if (sameIdList(ids, prev)) return prev;
        userTouchedRef.current = true;
        valuesRef.current = ids;
        writeStoredIds(resolvedKey, ids);
        persistTenantTableColumnModule(moduleKey, ids);
        return ids;
      });
    },
    [moduleKey, resolvedKey],
  );

  return [values, setValues] as const;
}

/**
 * Persist show/hide column prefs per module **and per tenant**.
 * Source of truth: tenant ORG Setting (works across browsers).
 * localStorage is a fast local mirror / offline fallback.
 * Hydration never writes. Only toggle / Reset / setVisibleIds save.
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
  const userTouchedRef = useRef(false);
  const visibleIdsRef = useRef<string[]>([]);

  const defaultIds = useMemo(
    () => defaultVisibleIds(columns),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [registryKey],
  );

  const [visibleIds, setVisibleIdsState] = useState<string[]>(() => {
    const initial = normalizeVisibleIds(
      columns,
      resolveModuleIds(storageKey, readTenantColumnScope()),
    );
    visibleIdsRef.current = initial;
    return initial;
  });
  visibleIdsRef.current = visibleIds;

  useEffect(() => {
    let cancelled = false;
    userTouchedRef.current = false;
    const local = normalizeVisibleIds(columns, resolveModuleIds(storageKey, tenantScope));
    visibleIdsRef.current = local;
    setVisibleIdsState(local);

    void loadTenantTableColumns().then((map) => {
      if (cancelled || userTouchedRef.current) return;
      const serverIds = Object.prototype.hasOwnProperty.call(map, storageKey)
        ? (Array.isArray(map[storageKey]) ? map[storageKey] : null)
        : null;
      const legacy = readStoredIds(resolvedStorageKey);
      const legacyNormalized = legacy ? normalizeVisibleIds(columns, legacy) : null;
      const serverNormalized = serverIds ? normalizeVisibleIds(columns, serverIds) : null;
      const legacyIsCustom = Boolean(
        legacyNormalized && !sameIdList(legacyNormalized, defaultIds),
      );
      // Prefer local custom prefs over server so a reload / cache event cannot silently
      // replace the recruiter's saved Columns menu choices.
      const next = legacyIsCustom
        ? legacyNormalized!
        : serverNormalized ?? legacyNormalized ?? defaultIds;
      if (!sameIdList(next, visibleIdsRef.current)) {
        visibleIdsRef.current = next;
        setVisibleIdsState(next);
      }
      const existingMirror = readStoredIds(resolvedStorageKey);
      if (!existingMirror || !sameIdList(existingMirror, next)) {
        writeStoredIds(resolvedStorageKey, next);
      }
      if (legacyIsCustom && (!serverNormalized || !sameIdList(legacyNormalized!, serverNormalized))) {
        persistTenantTableColumnModule(storageKey, next);
      } else if (!serverIds && legacy && legacy.length > 0) {
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
      // Never let a background cache refresh overwrite in-session user toggles.
      if (userTouchedRef.current) return;
      const next = normalizeVisibleIds(columns, detail.columns[storageKey] ?? null);
      if (sameIdList(next, visibleIdsRef.current)) return;
      // If local mirror is custom vs defaults, keep local — cache may be stale.
      const legacy = readStoredIds(resolvedStorageKey);
      const legacyNormalized = legacy ? normalizeVisibleIds(columns, legacy) : null;
      if (legacyNormalized && !sameIdList(legacyNormalized, defaultIds)) {
        if (!sameIdList(legacyNormalized, visibleIdsRef.current)) {
          visibleIdsRef.current = legacyNormalized;
          setVisibleIdsState(legacyNormalized);
        }
        return;
      }
      visibleIdsRef.current = next;
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

  const commitVisibleIds = useCallback(
    (ids: string[]) => {
      const next = normalizeVisibleIds(columns, ids);
      userTouchedRef.current = true;
      visibleIdsRef.current = next;
      setVisibleIdsState(next);
      writeStoredIds(resolvedStorageKey, next);
      persistTenantTableColumnModule(storageKey, next);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [registryKey, resolvedStorageKey, storageKey],
  );

  const setVisibleIds = useCallback(
    (next: string[] | ((prev: string[]) => string[])) => {
      const resolved = typeof next === 'function' ? next(visibleIdsRef.current) : next;
      commitVisibleIds(resolved);
    },
    [commitVisibleIds],
  );

  const isVisible = useCallback(
    (id: string) => visibleIds.includes(id),
    [visibleIds],
  );

  const toggle = useCallback(
    (id: string) => {
      const col = columns.find((item) => item.id === id);
      if (!col || col.locked) return;
      const prev = visibleIdsRef.current;
      commitVisibleIds(prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [registryKey, commitVisibleIds],
  );

  const resetToDefault = useCallback(() => {
    commitVisibleIds(defaultIds);
  }, [defaultIds, commitVisibleIds]);

  const unlockedVisibleCount = useMemo(
    () =>
      visibleIds.filter((id) => {
        const col = columns.find((item) => item.id === id);
        return col && !col.locked && !col.excludeFromBadgeCount;
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
