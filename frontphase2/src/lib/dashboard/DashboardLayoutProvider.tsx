'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/usePermissions';
import { MODULE_ACCESS_MAP } from '@/lib/rbac/moduleAccess';
import { apiDashboardCatalog, apiDashboardGetLayout, apiDashboardSaveLayout } from './api';
import {
  allowedDatasetIdsFromCatalog,
  permittedTabKeysFromCatalog,
} from './dashboardCatalog';
import {
  createEmptyLayout,
  filterLayoutByAllowedDatasets,
  parseDashboardLayout,
  serializeLayout,
  type DashboardLayoutV2,
} from './layoutV2';
import type { ModuleTabKey } from './moduleCommandConfig';
import type { DashboardCatalog } from './types';

type DashboardLayoutContextValue = {
  layout: DashboardLayoutV2;
  catalog: DashboardCatalog | null;
  allowedDatasetIds: Set<string>;
  permittedTabKeys: Set<ModuleTabKey>;
  loading: boolean;
  saving: boolean;
  reloadLayout: () => Promise<void>;
  saveLayout: (next: DashboardLayoutV2) => Promise<boolean>;
  setLayout: React.Dispatch<React.SetStateAction<DashboardLayoutV2>>;
};

const DashboardLayoutContext = createContext<DashboardLayoutContextValue | null>(null);

export function DashboardLayoutProvider({ children }: { children: React.ReactNode }) {
  const { hasAnyPermission } = usePermissions();
  const [rawLayout, setRawLayout] = useState<DashboardLayoutV2>(createEmptyLayout);
  const [catalog, setCatalog] = useState<DashboardCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const allowedDatasetIds = useMemo(
    () => (catalog ? allowedDatasetIdsFromCatalog(catalog) : new Set<string>()),
    [catalog],
  );

  const permittedTabKeys = useMemo(
    () =>
      catalog
        ? permittedTabKeysFromCatalog(catalog, {
            includeMatches: hasAnyPermission(MODULE_ACCESS_MAP.Matches),
            includePipeline: hasAnyPermission(MODULE_ACCESS_MAP.Pipeline),
          })
        : new Set<ModuleTabKey>(),
    [catalog, hasAnyPermission],
  );

  const layout = useMemo(
    () => filterLayoutByAllowedDatasets(rawLayout, allowedDatasetIds, permittedTabKeys),
    [rawLayout, allowedDatasetIds, permittedTabKeys],
  );

  const reloadLayout = useCallback(async () => {
    setLoading(true);
    try {
      const [raw, nextCatalog] = await Promise.all([apiDashboardGetLayout(), apiDashboardCatalog()]);
      setCatalog(nextCatalog);
      setRawLayout(parseDashboardLayout(raw));
    } catch {
      setRawLayout(createEmptyLayout());
      setCatalog(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadLayout();
  }, [reloadLayout]);

  const saveLayout = useCallback(
    async (next: DashboardLayoutV2) => {
      setSaving(true);
      try {
        const filtered = filterLayoutByAllowedDatasets(next, allowedDatasetIds, permittedTabKeys);
        await apiDashboardSaveLayout(serializeLayout(filtered));
        setRawLayout(filtered);
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not save dashboard.');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [allowedDatasetIds, permittedTabKeys],
  );

  const setLayout: React.Dispatch<React.SetStateAction<DashboardLayoutV2>> = useCallback(
    (action) => {
      setRawLayout((prev) => {
        const base = filterLayoutByAllowedDatasets(prev, allowedDatasetIds, permittedTabKeys);
        return typeof action === 'function' ? action(base) : action;
      });
    },
    [allowedDatasetIds, permittedTabKeys],
  );

  const value = useMemo(
    () => ({
      layout,
      catalog,
      allowedDatasetIds,
      permittedTabKeys,
      loading,
      saving,
      reloadLayout,
      saveLayout,
      setLayout,
    }),
    [layout, catalog, allowedDatasetIds, permittedTabKeys, loading, saving, reloadLayout, saveLayout, setLayout],
  );

  return (
    <DashboardLayoutContext.Provider value={value}>{children}</DashboardLayoutContext.Provider>
  );
}

export function useDashboardLayoutStore() {
  const ctx = useContext(DashboardLayoutContext);
  if (!ctx) {
    throw new Error('useDashboardLayoutStore must be used within DashboardLayoutProvider');
  }
  return ctx;
}
