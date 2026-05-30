'use client';

import React, { useMemo } from 'react';
import { LayoutDashboard, Plus } from 'lucide-react';
import { groupWidgetsByModule } from '../../lib/dashboard/moduleGroups';
import { useDashboardWidgetLayout } from '../../lib/dashboard/useDashboardWidgetLayout';
import { DashboardModuleSection } from './DashboardModuleSection';
import { DashboardWidgetCard } from './DashboardWidget';
import { AddWidgetWizard } from './AddWidgetWizard';
import { DashboardWidgetToolbar } from './DashboardWidgetToolbar';

type CustomDashboardProps = {
  /** When true, hide page title (used inside Dashboard V2 advanced section). */
  embedded?: boolean;
};

export function CustomDashboard({ embedded = false }: CustomDashboardProps) {
  const layout = useDashboardWidgetLayout();
  const {
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
    handleWizardClose,
    saveLayout,
    updateWidget,
    removeWidget,
    duplicateWidget,
    handleAddWidgets,
    startAddWidget,
    openWizard,
  } = layout;

  const sections = useMemo(
    () => groupWidgetsByModule(hydratedWidgets, catalog),
    [hydratedWidgets, catalog],
  );

  return (
    <div className="space-y-6">
      <div className={`flex flex-wrap items-center justify-between gap-3 ${embedded ? 'pt-1' : ''}`}>
        {!embedded ? (
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
              <LayoutDashboard className="text-indigo-600" size={26} />
              Dashboard
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Widgets are grouped by module — Leads, Clients, Jobs, and more. Add charts to each section separately.
            </p>
          </div>
        ) : (
          <div />
        )}
        <DashboardWidgetToolbar
          editMode={editMode}
          saving={saving}
          onAddWidget={() => startAddWidget()}
          onSaveLayout={() => void saveLayout()}
          onDone={() => setEditMode(false)}
          onCustomize={() => setEditMode(true)}
        />
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
            onClick={() => startAddWidget()}
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
