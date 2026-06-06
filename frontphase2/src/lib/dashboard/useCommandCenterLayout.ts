'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  buildModuleLayoutFromSession,
  getModuleLayout,
  resolveModuleDisplayWidgets,
  type DashboardLayoutV2,
} from './layoutV2';
import type { ModuleCommandConfig, ModuleTabKey } from './moduleCommandConfig';
import type { DashboardWidget } from './types';
import { useDashboardLayoutStore } from './DashboardLayoutProvider';

export function useCommandCenterLayout(
  moduleKey: ModuleTabKey,
  config: ModuleCommandConfig | undefined,
  widgetModuleName: string,
) {
  const { layout, loading, saving, saveLayout: persistFullLayout } = useDashboardLayoutStore();
  const [editMode, setEditMode] = useState(false);
  const [sessionWidgets, setSessionWidgets] = useState<DashboardWidget[] | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => {
    setEditMode(false);
    setSessionWidgets(null);
    setWizardOpen(false);
  }, [moduleKey]);

  const moduleLayout = useMemo(
    () => getModuleLayout(layout, moduleKey),
    [layout, moduleKey],
  );

  const resolved = useMemo(() => {
    if (!config) return { widgets: [] as DashboardWidget[], usingDefaults: false };
    return resolveModuleDisplayWidgets(moduleKey, config, widgetModuleName, moduleLayout);
  }, [config, moduleKey, widgetModuleName, moduleLayout]);

  const displayWidgets = sessionWidgets ?? resolved.widgets;
  const usingDefaults = sessionWidgets == null && resolved.usingDefaults;

  const persistModule = useCallback(
    async (nextModuleLayout: ReturnType<typeof buildModuleLayoutFromSession>) => {
      const next: DashboardLayoutV2 = {
        ...layout,
        modules: {
          ...layout.modules,
          [moduleKey]: nextModuleLayout,
        },
      };
      const ok = await persistFullLayout(next);
      if (ok) {
        setSessionWidgets(null);
        setEditMode(false);
        toast.success('Command center layout saved.');
      }
    },
    [layout, moduleKey, persistFullLayout],
  );

  const startCustomize = useCallback(() => {
    setSessionWidgets([...resolved.widgets]);
    setEditMode(true);
  }, [resolved.widgets]);

  const saveLayout = useCallback(async () => {
    if (!config) return;
    const session = sessionWidgets ?? resolved.widgets;
    const nextModule = buildModuleLayoutFromSession(
      moduleKey,
      config,
      widgetModuleName,
      session,
      moduleLayout,
    );
    await persistModule(nextModule);
  }, [
    config,
    moduleKey,
    widgetModuleName,
    sessionWidgets,
    resolved.widgets,
    moduleLayout,
    persistModule,
  ]);

  const cancelCustomize = useCallback(() => {
    setSessionWidgets(null);
    setEditMode(false);
  }, []);

  const removeWidget = useCallback((id: string) => {
    setSessionWidgets((prev) => {
      const base = prev ?? resolved.widgets;
      return base.filter((w) => w.id !== id);
    });
    if (!editMode) setEditMode(true);
  }, [editMode, resolved.widgets]);

  const updateWidget = useCallback((updated: DashboardWidget) => {
    setSessionWidgets((prev) => {
      const base = prev ?? resolved.widgets;
      return base.map((w) => (w.id === updated.id ? updated : w));
    });
  }, [resolved.widgets]);

  const handleAddWidgets = useCallback(
    (batch: DashboardWidget[]) => {
      const added = batch.map((w, i) => ({
        ...w,
        id: w.id || `w_${Date.now()}_${moduleKey}_${i}`,
        module: widgetModuleName,
      }));
      setSessionWidgets((prev) => {
        const base = prev ?? resolved.widgets;
        return [...base, ...added];
      });
      setEditMode(true);
      setWizardOpen(false);
      toast.success('Chart added. Click Save layout to keep it.');
    },
    [moduleKey, widgetModuleName, resolved.widgets],
  );

  const startAddWidget = useCallback(() => {
    setEditMode(true);
    setWizardOpen(true);
  }, []);

  const nextPosition = useMemo(() => ({ x: 0, y: 0 }), []);

  const duplicateWidget = useCallback(() => {
    toast.message('Use Add widget to change the chart for this module.');
  }, []);

  return {
    loading,
    saving,
    editMode,
    displayWidgets,
    usingDefaults,
    wizardOpen,
    setWizardOpen: (open: boolean) => setWizardOpen(open),
    startCustomize,
    saveLayout,
    cancelCustomize,
    removeWidget,
    updateWidget,
    handleAddWidgets,
    startAddWidget,
    nextPosition,
    duplicateWidget,
  };
}
