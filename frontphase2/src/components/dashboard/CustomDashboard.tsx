'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutDashboard, Pencil, Plus, Save } from 'lucide-react';
import { toast } from 'sonner';
import { apiDashboardCatalog, apiDashboardGetLayout, apiDashboardSaveLayout } from '../../lib/dashboard/api';
import { groupWidgetsByModule, hydrateWidgets } from '../../lib/dashboard/moduleGroups';
import type { DashboardCatalog, DashboardWidget } from '../../lib/dashboard/types';
import { DashboardModuleSection } from './DashboardModuleSection';
import { DashboardWidgetCard } from './DashboardWidget';
import { AddWidgetWizard } from './AddWidgetWizard';

const LAYOUT_STORAGE_KEY = 'customDashboardLayout:v1';

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

export function CustomDashboard() {
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

  const loadLayout = useCallback(async () => {
    setLoading(true);
    try {
      const remote = await apiDashboardGetLayout();
      if (remote.length) {
        setWidgets(remote);
        persistLocal(remote);
      } else {
        const local = loadLocalLayout();
        setWidgets(local);
      }
    } catch {
      setWidgets(loadLocalLayout());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLayout();
  }, [loadLayout]);

  const hydratedWidgets = useMemo(
    () => hydrateWidgets(widgets, catalog),
    [widgets, catalog]
  );

  const sections = useMemo(
    () => groupWidgetsByModule(hydratedWidgets, catalog),
    [hydratedWidgets, catalog]
  );

  const saveLayout = async () => {
    setSaving(true);
    const toSave = hydrateWidgets(widgets, catalog);
    persistLocal(toSave);
    try {
      await apiDashboardSaveLayout(toSave);
      setWidgets(toSave);
      toast.success('Dashboard layout saved.');
      setEditMode(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Saved locally; server sync failed.');
      setEditMode(false);
    } finally {
      setSaving(false);
    }
  };

  const updateWidget = (updated: DashboardWidget) => {
    setWidgets((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
  };

  const removeWidget = (id: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
  };

  const duplicateWidget = (widget: DashboardWidget) => {
    const copy: DashboardWidget = {
      ...widget,
      id: `w_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: `${widget.title} (copy)`,
      y: widget.y + widget.h,
    };
    setWidgets((prev) => [...prev, copy]);
  };

  const nextPosition = useMemo(() => {
    if (!widgets.length) return { x: 0, y: 0 };
    const maxY = Math.max(...widgets.map((w) => w.y + w.h));
    return { x: 0, y: maxY };
  }, [widgets]);

  const openWizard = (moduleName?: string) => {
    setWizardInitialModule(moduleName);
    setWizardOpen(true);
  };

  const handleWizardClose = () => {
    setWizardOpen(false);
    setWizardInitialModule(undefined);
  };

  const handleAddWidgets = (batch: DashboardWidget[]) => {
    const withModules = hydrateWidgets(batch, catalog);
    setWidgets((prev) => [...prev, ...withModules]);
    toast.success(
      batch.length === 1
        ? `Added 1 widget to ${withModules[0]?.module || 'dashboard'}.`
        : `Added ${batch.length} widgets across your module sections.`
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <LayoutDashboard className="text-indigo-600" size={26} />
            Dashboard
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Widgets are grouped by module — Leads, Clients, Jobs, and more. Add charts to each section separately.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setEditMode(true);
              openWizard();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-800 shadow-sm hover:bg-indigo-50"
          >
            <Plus size={14} /> Add widget
          </button>
          {editMode ? (
            <>
              <button
                type="button"
                onClick={() => void saveLayout()}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
              >
                <Save size={14} /> {saving ? 'Saving…' : 'Save layout'}
              </button>
              <button
                type="button"
                onClick={() => setEditMode(false)}
                className="rounded-lg px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Done
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setEditMode(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-800 shadow-sm hover:bg-indigo-50"
            >
              <Pencil size={14} /> Customize
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-dashed border-indigo-100 bg-white/60 px-6 py-16 text-center text-sm text-slate-500">
          Loading your dashboard…
        </div>
      ) : widgets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/30 px-6 py-16 text-center">
          <p className="text-sm font-medium text-slate-700">No widgets yet</p>
          <p className="mt-1 text-xs text-slate-500">
            Add widgets from Leads, Clients, or any module you can access. Each module gets its own section.
          </p>
          <button
            type="button"
            onClick={() => {
              setEditMode(true);
              openWizard();
            }}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            <Plus size={16} /> Add your first widget
          </button>
        </div>
      ) : sections.length > 0 ? (
        <div className="space-y-8">
          {sections.map((section) => (
            <DashboardModuleSection
              key={section.module}
              moduleName={section.module}
              widgets={section.widgets}
              editMode={editMode}
              onUpdate={updateWidget}
              onRemove={removeWidget}
              onDuplicate={duplicateWidget}
              onAddToModule={editMode ? (name) => openWizard(name) : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-4" style={{ gridAutoRows: 'minmax(80px, auto)' }}>
          {hydratedWidgets.map((widget) => (
            <DashboardWidgetCard
              key={widget.id}
              widget={widget}
              editMode={editMode}
              onUpdate={updateWidget}
              onRemove={removeWidget}
              onDuplicate={duplicateWidget}
            />
          ))}
        </div>
      )}

      <AddWidgetWizard
        open={wizardOpen}
        onClose={handleWizardClose}
        onAdd={handleAddWidgets}
        nextPosition={nextPosition}
        initialModule={wizardInitialModule}
      />
    </div>
  );
}

