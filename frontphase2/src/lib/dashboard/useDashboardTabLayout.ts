'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { ModuleTabKey } from './moduleCommandConfig';
import { useDashboardLayoutStore } from './DashboardLayoutProvider';

export function useDashboardTabLayout() {
  const { layout, saving, saveLayout } = useDashboardLayoutStore();
  const [editMode, setEditMode] = useState(false);
  const [sessionHiddenTabs, setSessionHiddenTabs] = useState<ModuleTabKey[]>([]);

  useEffect(() => {
    if (!editMode) {
      setSessionHiddenTabs(layout.hiddenTabs || []);
    }
  }, [layout.hiddenTabs, editMode]);

  const hiddenTabSet = useMemo(
    () => new Set(editMode ? sessionHiddenTabs : layout.hiddenTabs || []),
    [editMode, sessionHiddenTabs, layout.hiddenTabs],
  );

  const startCustomize = useCallback(() => {
    setSessionHiddenTabs(layout.hiddenTabs || []);
    setEditMode(true);
  }, [layout.hiddenTabs]);

  const cancelCustomize = useCallback(() => {
    setSessionHiddenTabs(layout.hiddenTabs || []);
    setEditMode(false);
  }, [layout.hiddenTabs]);

  const hideTab = useCallback((key: ModuleTabKey) => {
    setSessionHiddenTabs((prev) => (prev.includes(key) ? prev : [...prev, key]));
    if (!editMode) setEditMode(true);
  }, [editMode]);

  const restoreTab = useCallback((key: ModuleTabKey) => {
    setSessionHiddenTabs((prev) => prev.filter((k) => k !== key));
  }, []);

  const saveTabLayout = useCallback(async () => {
    const ok = await saveLayout({
      ...layout,
      hiddenTabs: sessionHiddenTabs,
    });
    if (ok) {
      setEditMode(false);
      toast.success('Dashboard tabs saved.');
    }
  }, [layout, saveLayout, sessionHiddenTabs]);

  return {
    editMode,
    saving,
    hiddenTabSet,
    sessionHiddenTabs,
    startCustomize,
    cancelCustomize,
    hideTab,
    restoreTab,
    saveTabLayout,
  };
}
