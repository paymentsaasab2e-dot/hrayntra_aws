'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { apiDashboardGetLayout, apiDashboardSaveLayout } from './api';
import {
  createEmptyLayout,
  parseDashboardLayout,
  serializeLayout,
  type DashboardLayoutV2,
} from './layoutV2';

type DashboardLayoutContextValue = {
  layout: DashboardLayoutV2;
  loading: boolean;
  saving: boolean;
  reloadLayout: () => Promise<void>;
  saveLayout: (next: DashboardLayoutV2) => Promise<boolean>;
  setLayout: React.Dispatch<React.SetStateAction<DashboardLayoutV2>>;
};

const DashboardLayoutContext = createContext<DashboardLayoutContextValue | null>(null);

export function DashboardLayoutProvider({ children }: { children: React.ReactNode }) {
  const [layout, setLayout] = useState<DashboardLayoutV2>(createEmptyLayout);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const reloadLayout = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await apiDashboardGetLayout();
      setLayout(parseDashboardLayout(raw));
    } catch {
      setLayout(createEmptyLayout());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadLayout();
  }, [reloadLayout]);

  const saveLayout = useCallback(async (next: DashboardLayoutV2) => {
    setSaving(true);
    try {
      await apiDashboardSaveLayout(serializeLayout(next));
      setLayout(next);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save dashboard.');
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      layout,
      loading,
      saving,
      reloadLayout,
      saveLayout,
      setLayout,
    }),
    [layout, loading, saving, reloadLayout, saveLayout],
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
