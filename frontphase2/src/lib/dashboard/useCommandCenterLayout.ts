'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { apiDashboardGetLayout, apiDashboardSaveLayout } from './api';
import {
  buildModuleLayoutFromSession,
  createEmptyLayout,
  getModuleLayout,
  parseDashboardLayout,
  resolveModuleDisplayWidgets,
  serializeLayout,
  type DashboardLayoutV2,
} from './layoutV2';
import type { ModuleCommandConfig, ModuleTabKey } from './moduleCommandConfig';
import type { DashboardWidget } from './types';

export function useCommandCenterLayout(
  moduleKey: ModuleTabKey,
  config: ModuleCommandConfig | undefined,
  widgetModuleName: string,
) {
  const [layout, setLayout] = useState<DashboardLayoutV2>(createEmptyLayout);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [sessionWidgets, setSessionWidgets] = useState<DashboardWidget[] | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  const loadLayout = useCallback(async () => {
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
    void loadLayout();
  }, [loadLayout]);

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
      setSaving(true);
      const next: DashboardLayoutV2 = {
        ...layout,
        modules: {
          ...layout.modules,
          [moduleKey]: nextModuleLayout,
        },
      };
      try {
        await apiDashboardSaveLayout(serializeLayout(next));
        setLayout(next);
        setSessionWidgets(null);
        setEditMode(false);
        toast.success('Command center layout saved.');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not save layout.');
      } finally {
        setSaving(false);
      }
    },
    [layout, moduleKey],
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
    reloadLayout: loadLayout,
  };
}
