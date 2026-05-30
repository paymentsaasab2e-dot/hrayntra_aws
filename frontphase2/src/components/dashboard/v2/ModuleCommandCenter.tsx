'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Plus, RefreshCcw } from 'lucide-react';
import { apiDashboardDataset, type DashboardOverview } from '@/lib/dashboard/api';
import { apiGetTaskStats } from '@/lib/api';
import {
  commandCenterPrimaryDatasetId,
  commandCenterWidgetModule,
  getModuleConfig,
  type ModuleTabKey,
} from '@/lib/dashboard/moduleCommandConfig';
import { useCommandCenterLayout } from '@/lib/dashboard/useCommandCenterLayout';
import { DashboardDataTable } from '../DashboardDataTable';
import { DashboardWidgetCard } from '../DashboardWidget';
import { AddWidgetWizard } from '../AddWidgetWizard';
import { DashboardWidgetToolbar } from '../DashboardWidgetToolbar';
import type { KpiDef } from '@/lib/dashboard/moduleCommandConfig';
import type { DashboardWidget } from '@/lib/dashboard/types';
import { moduleSupportsKpiCards } from '@/lib/dashboard/commandCenterDefaults';
import {
  filterRowsByCommandCenterStatus,
  normalizeCommandCenterStatus,
} from '@/lib/dashboard/commandCenterTableFilter';

type Props = {
  moduleKey: ModuleTabKey;
  overview: DashboardOverview | null;
};

export function ModuleCommandCenter({ moduleKey, overview }: Props) {
  const config = getModuleConfig(moduleKey);
  const widgetModuleName = config ? commandCenterWidgetModule(moduleKey, config.label) : '';
  const primaryDatasetId = config ? commandCenterPrimaryDatasetId(config) : '';

  const cc = useCommandCenterLayout(moduleKey, config, widgetModuleName);

  const [loading, setLoading] = useState(true);
  const [rowsByDataset, setRowsByDataset] = useState<Record<string, Record<string, unknown>[]>>({});
  const [taskStats, setTaskStats] = useState<Awaited<ReturnType<typeof apiGetTaskStats>>['data'] | null>(null);
  const [tableStatusFilter, setTableStatusFilter] = useState('all');

  const load = useCallback(async () => {
    if (!config) return;
    setLoading(true);
    try {
      const entries = await Promise.all(
        config.datasets.map(async (id) => {
          try {
            const payload = await apiDashboardDataset(id);
            return [id, payload.rows || []] as const;
          } catch {
            return [id, []] as const;
          }
        }),
      );
      const map: Record<string, Record<string, unknown>[]> = {};
      for (const [id, rows] of entries) map[id] = rows;

      if (moduleKey === 'tasks') {
        try {
          const statsRes = await apiGetTaskStats();
          setTaskStats(statsRes.data);
        } catch {
          setTaskStats(null);
        }
      }

      setRowsByDataset(map);
    } finally {
      setLoading(false);
    }
  }, [config, moduleKey]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setTableStatusFilter('all');
  }, [moduleKey]);

  const kpis = useMemo(() => {
    if (!config) return [];
    return config.buildKpis({ rowsByDataset, overview, taskStats });
  }, [config, rowsByDataset, overview, taskStats]);

  if (!config) {
    return <p className="text-sm text-slate-500">Module not configured.</p>;
  }

  const tableRowsRaw = config.tableDatasetId ? rowsByDataset[config.tableDatasetId] || [] : [];
  const tableRows = useMemo(
    () => filterRowsByCommandCenterStatus(moduleKey, tableRowsRaw, tableStatusFilter),
    [moduleKey, tableRowsRaw, tableStatusFilter],
  );
  const tableFilterActive = normalizeCommandCenterStatus(tableStatusFilter) !== 'all';

  const headerProps = {
    label: config.label,
    listRoute: config.listRoute,
    editMode: cc.editMode,
    saving: cc.saving,
    onRefresh: () => void load(),
    onAddWidget: () => cc.startAddWidget(),
    onSaveLayout: () => void cc.saveLayout(),
    onDone: () => cc.cancelCustomize(),
    onCustomize: () => cc.startCustomize(),
  };

  const hasTableWidget = cc.displayWidgets.some(
    (w) => w.chartType === 'table' || w.chartType === 'expandableTable',
  );

  const kpiWidgets = cc.displayWidgets.filter(isKpiCardWidget);
  const chartWidgets = cc.displayWidgets.filter((w) => !isKpiCardWidget(w));

  const showKpiRow = moduleSupportsKpiCards(config);

  const kpiSection =
    showKpiRow && (kpiWidgets.length > 0 || cc.editMode) ? (
      <CommandCenterKpiRow
        moduleKey={moduleKey}
        kpiWidgets={kpiWidgets}
        editMode={cc.editMode}
        usingDefaults={cc.usingDefaults}
        tableStatusFilter={tableStatusFilter}
        onTableStatusSelect={setTableStatusFilter}
        onUpdate={cc.updateWidget}
        onRemove={cc.removeWidget}
        onDuplicate={cc.duplicateWidget}
      />
    ) : null;

  const widgetsSection = (
    <CommandCenterCharts
      chartWidgets={chartWidgets}
      usingDefaults={cc.usingDefaults}
      editMode={cc.editMode}
      widgetsLoading={cc.loading}
      widgetModuleName={widgetModuleName}
      moduleKpis={kpis}
      onStartAdd={() => cc.startAddWidget()}
      onUpdate={cc.updateWidget}
      onRemove={cc.removeWidget}
      onDuplicate={cc.duplicateWidget}
    />
  );

  const wizard = (
    <AddWidgetWizard
      variant="commandCenter"
      open={cc.wizardOpen}
      onClose={() => cc.setWizardOpen(false)}
      onAdd={cc.handleAddWidgets}
      nextPosition={cc.nextPosition}
      initialModule={widgetModuleName}
      initialDatasetId={primaryDatasetId}
    />
  );

  if (moduleKey === 'matches' && !config.datasets.length) {
    return (
      <div className="space-y-6">
        <CommandCenterHeader {...headerProps} />
        <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 px-6 py-12 text-center">
          <p className="text-sm font-medium text-slate-700">Matches command center</p>
          <p className="mt-1 text-xs text-slate-500">
            Open the Matches page to review AI suggestions and submit to clients.
          </p>
          <Link
            href={config.listRoute}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Open matches <ExternalLink size={14} />
          </Link>
        </div>
        {kpiSection}
        {widgetsSection}
        {wizard}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CommandCenterHeader {...headerProps} />

      {loading ? (
        <div className="space-y-4">
          {showKpiRow ? (
            <div
              className={`grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 ${
                (config.kpiCards?.length ?? 0) > 4 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'
              }`}
            >
              {Array.from({ length: config.kpiCards?.length ?? 4 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : null}
          <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
        </div>
      ) : (
        <>
          {kpiSection}
          {widgetsSection}

          {config.tableDatasetId && !hasTableWidget ? (
            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-800">{config.tableTitle}</h3>
                {tableFilterActive ? (
                  <button
                    type="button"
                    onClick={() => setTableStatusFilter('all')}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-500"
                  >
                    Clear status filter ({tableStatusFilter})
                  </button>
                ) : (
                  <p className="text-xs text-slate-500">Click a KPI card to filter this table</p>
                )}
              </div>
              <DashboardDataTable
                rows={tableRows}
                variant="expandable"
                maxRows={50}
                viewAllHref={config.listRoute}
                viewAllLabel={`View all ${config.label.toLowerCase()}`}
                fillHeight={false}
              />
            </div>
          ) : null}
        </>
      )}

      {wizard}
    </div>
  );
}

function CommandCenterHeader({
  label,
  listRoute,
  editMode,
  saving,
  onRefresh,
  onAddWidget,
  onSaveLayout,
  onDone,
  onCustomize,
}: {
  label: string;
  listRoute: string;
  editMode: boolean;
  saving: boolean;
  onRefresh: () => void;
  onAddWidget: () => void;
  onSaveLayout: () => void;
  onDone: () => void;
  onCustomize: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <h2 className="text-lg font-bold text-slate-900">{label} command center</h2>
      <div className="flex flex-wrap items-center gap-2">
        <DashboardWidgetToolbar
          editMode={editMode}
          saving={saving}
          onAddWidget={onAddWidget}
          onSaveLayout={onSaveLayout}
          onDone={onDone}
          onCustomize={onCustomize}
        />
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <RefreshCcw size={14} /> Refresh
        </button>
        <Link
          href={listRoute}
          className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-800 hover:bg-indigo-100"
        >
          Open {label} <ExternalLink size={12} />
        </Link>
      </div>
    </div>
  );
}

function isKpiCardWidget(widget: DashboardWidget) {
  return widget.chartType === 'kpi';
}

/** KPI tiles under the command center header — click to filter table (like /leads list). */
function CommandCenterKpiRow({
  moduleKey,
  kpiWidgets,
  editMode,
  usingDefaults,
  tableStatusFilter,
  onTableStatusSelect,
  onUpdate,
  onRemove,
  onDuplicate,
}: {
  moduleKey: ModuleTabKey;
  kpiWidgets: DashboardWidget[];
  editMode: boolean;
  usingDefaults: boolean;
  tableStatusFilter: string;
  onTableStatusSelect: (status: string) => void;
  onUpdate: (w: DashboardWidget) => void;
  onRemove: (id: string) => void;
  onDuplicate: (w: DashboardWidget) => void;
}) {
  return (
    <section className="space-y-2">
      {editMode ? (
        <p className="text-xs text-slate-500">
          Click the <strong>gear</strong> on a card to change <strong>Status</strong> (All Clients, Active,
          On Hold, …) and <strong>Date range</strong>, then <strong>Save layout</strong>.
        </p>
      ) : (
        <p className="text-xs text-slate-500">
          Click a card to filter the table below by that status (click again to clear).
        </p>
      )}
      <div className="mb-1 grid grid-cols-2 gap-2 overflow-visible sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
        {kpiWidgets.map((widget) => (
            <DashboardWidgetCard
              key={widget.id}
              widget={widget}
              moduleKey={moduleKey}
              editMode={editMode}
              tableStatusFilter={tableStatusFilter}
              onTableStatusSelect={onTableStatusSelect}
              onUpdate={onUpdate}
              onRemove={onRemove}
              onDuplicate={onDuplicate}
            />
        ))}
      </div>
    </section>
  );
}

function CommandCenterCharts({
  chartWidgets,
  usingDefaults,
  editMode,
  widgetsLoading,
  widgetModuleName,
  moduleKpis,
  onStartAdd,
  onUpdate,
  onRemove,
  onDuplicate,
}: {
  chartWidgets: DashboardWidget[];
  usingDefaults: boolean;
  editMode: boolean;
  widgetsLoading: boolean;
  widgetModuleName: string;
  moduleKpis: KpiDef[];
  onStartAdd: () => void;
  onUpdate: (w: DashboardWidget) => void;
  onRemove: (id: string) => void;
  onDuplicate: (w: DashboardWidget) => void;
}) {
  if (widgetsLoading) return null;

  if (!chartWidgets.length && !editMode) return null;

  const customizeHint = editMode ? (
    <p className="mt-0.5 text-xs text-slate-500">
      Remove charts you do not need, add a new one, then click <strong>Save layout</strong>.
      <strong> Done</strong> cancels without saving.
    </p>
  ) : usingDefaults ? (
    <p className="mt-0.5 text-xs text-slate-500">
      Default for all users in your organization. Click <strong>Customize</strong> to remove or change
      charts, then <strong>Save layout</strong>.
    </p>
  ) : null;

  return (
    <div className="rounded-xl border border-indigo-100/80 bg-indigo-50/20 p-4">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-slate-800">
          {usingDefaults && !editMode && chartWidgets.length ? 'Recommended charts' : 'Charts'}
        </h3>
        {customizeHint}
      </div>
      {chartWidgets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-indigo-200 bg-white/80 px-4 py-8 text-center">
          <p className="text-xs text-slate-500">No charts for {widgetModuleName}.</p>
          <button
            type="button"
            onClick={onStartAdd}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
          >
            <Plus size={14} /> Add widget
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-4" style={{ gridAutoRows: 'minmax(80px, auto)' }}>
          {chartWidgets.map((widget) => (
            <DashboardWidgetCard
              key={widget.id}
              widget={widget}
              editMode={editMode}
              moduleKpis={moduleKpis}
              onUpdate={onUpdate}
              onRemove={onRemove}
              onDuplicate={onDuplicate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
