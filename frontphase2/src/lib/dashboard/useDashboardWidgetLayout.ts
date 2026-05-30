'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { apiDashboardCatalog, apiDashboardGetLayout, apiDashboardSaveLayout } from './api';
import { hydrateWidgets } from './moduleGroups';
import { parseDashboardLayout, type DashboardLayoutV2 } from './layoutV2';
import type { DashboardCatalog, DashboardWidget } from './types';

const LAYOUT_STORAGE_KEY = 'customDashboardLayout:v1';

function moduleKey(widget: DashboardWidget) {
  return String(widget.module || widget.datasetId || '').trim().toLowerCase();
}

export function enforceSingleWidgetPerModule(widgets: DashboardWidget[]) {
  const next: DashboardWidget[] = [];
  const seen = new Map<string, number>();
  for (const widget of widgets) {
    const key = moduleKey(widget);
    if (!key) {
      next.push(widget);
      continue;
    }
    const existingIndex = seen.get(key);
    if (existingIndex === undefined) {
      seen.set(key, next.length);
      next.push(widget);
    } else {
      next[existingIndex] = widget;
    }
  }
  return next;
}

function loadLocalLayout(): DashboardWidget[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistLocal(widgets: DashboardWidget[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(widgets));
}

export function useDashboardWidgetLayout() {
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [catalog, setCatalog] = useState<DashboardCatalog | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardInitialModule, setWizardInitialModule] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void apiDashboardCatalog()
      .then(setCatalog)
      .catch(() => setCatalog(null));
  }, []);

  const flattenLayoutWidgets = useCallback((raw: DashboardLayoutV2 | DashboardWidget[]) => {
    const parsed = parseDashboardLayout(raw);
    const flat: DashboardWidget[] = [];
    for (const mod of Object.values(parsed.modules)) {
      if (mod?.widgets?.length) flat.push(...mod.widgets);
    }
    if (Array.isArray(raw)) return enforceSingleWidgetPerModule(raw);
    return enforceSingleWidgetPerModule(flat);
  }, []);

  const loadLayout = useCallback(async () => {
    setLoading(true);
    try {
      const remote = await apiDashboardGetLayout();
      const flat = flattenLayoutWidgets(remote);
      if (flat.length) {
        setWidgets(flat);
        persistLocal(flat);
      } else {
        const local = enforceSingleWidgetPerModule(loadLocalLayout());
        setWidgets(local);
        persistLocal(local);
      }
    } catch {
      const local = enforceSingleWidgetPerModule(loadLocalLayout());
      setWidgets(local);
      persistLocal(local);
    } finally {
      setLoading(false);
    }
  }, [flattenLayoutWidgets]);

  useEffect(() => {
    void loadLayout();
  }, [loadLayout]);

  const hydratedWidgets = useMemo(
    () => hydrateWidgets(widgets, catalog),
    [widgets, catalog],
  );

  const nextPosition = useMemo(() => {
    if (!widgets.length) return { x: 0, y: 0 };
    const maxY = Math.max(...widgets.map((w) => w.y + w.h));
    return { x: 0, y: maxY };
  }, [widgets]);

  const openWizard = useCallback((moduleName?: string) => {
    setWizardInitialModule(moduleName);
    setWizardOpen(true);
  }, []);

  const handleWizardClose = useCallback(() => {
    setWizardOpen(false);
    setWizardInitialModule(undefined);
  }, []);

  const saveLayout = useCallback(async () => {
    setSaving(true);
    const toSave = enforceSingleWidgetPerModule(hydrateWidgets(widgets, catalog));
    persistLocal(toSave);
    try {
      const existing = parseDashboardLayout(await apiDashboardGetLayout());
      await apiDashboardSaveLayout({ version: 2, modules: existing.modules });
      setWidgets(toSave);
      toast.success('Dashboard layout saved.');
      setEditMode(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Saved locally; server sync failed.');
      setEditMode(false);
    } finally {
      setSaving(false);
    }
  }, [widgets, catalog]);

  const updateWidget = useCallback((updated: DashboardWidget) => {
    setWidgets((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
  }, []);

  const removeWidget = useCallback((id: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const duplicateWidget = useCallback((widget: DashboardWidget) => {
    toast.error(`Only one widget is allowed in ${widget.module || 'this module'}.`);
  }, []);

  const handleAddWidgets = useCallback(
    (batch: DashboardWidget[]) => {
      const withModules = hydrateWidgets(batch, catalog);
      setWidgets((prev) => enforceSingleWidgetPerModule([...prev, ...withModules]));
      const moduleName = withModules[0]?.module || 'dashboard';
      const replaced = widgets.some(
        (widget) => moduleKey(widget) === moduleKey(withModules[0]),
      );
      toast.success(
        replaced
          ? `Replaced the existing widget in ${moduleName}.`
          : `Added 1 widget to ${moduleName}.`,
      );
      setEditMode(true);
    },
    [catalog, widgets],
  );

  const startAddWidget = useCallback(
    (moduleName?: string) => {
      setEditMode(true);
      openWizard(moduleName);
    },
    [openWizard],
  );

  return {
    widgets,
    catalog,
    hydratedWidgets,
    editMode,
    setEditMode,
    wizardOpen,
    wizardInitialModule,
    loading,
    saving,
    nextPosition,
    openWizard,
    handleWizardClose,
    saveLayout,
    updateWidget,
    removeWidget,
    duplicateWidget,
    handleAddWidgets,
    startAddWidget,
  };
}
