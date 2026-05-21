'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Copy, Expand, GripVertical, RefreshCcw, Settings2, Trash2, X } from 'lucide-react';
import { apiDashboardDataset } from '../../lib/dashboard/api';
import {
  buildWidgetTitle,
  filterWidgetChartRecommendations,
  isMetricsDatasetId,
  isPartitionChartType,
  resolveWidgetConfig,
} from '../../lib/dashboard/chartData';

function datasetKindFromId(datasetId: string, kind?: 'list' | 'metrics') {
  if (kind) return kind;
  return isMetricsDatasetId(datasetId) ? 'metrics' : 'list';
}
import type { DashboardFilterDef, DashboardWidget, WidgetConfig, WidgetFilters } from '../../lib/dashboard/types';
import { DashboardFilterFields } from './DashboardFilterFields';
import { WidgetChart } from './WidgetChart';

const LEGACY_DATASET_IDS: Record<string, string> = {
  tasks: 'tasks_and_activity',
  activities: 'tasks_and_activity',
};

function resolveDatasetId(id: string) {
  return LEGACY_DATASET_IDS[id] || id;
}

type Props = {
  widget: DashboardWidget;
  editMode: boolean;
  onUpdate: (widget: DashboardWidget) => void;
  onRemove: (id: string) => void;
  onDuplicate: (widget: DashboardWidget) => void;
};

export function DashboardWidgetCard({ widget, editMode, onUpdate, onRemove, onDuplicate }: Props) {
  const [data, setData] = useState<Awaited<ReturnType<typeof apiDashboardDataset>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [configOpen, setConfigOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const datasetId = resolveDatasetId(widget.datasetId);
  const widgetFilters: WidgetFilters = widget.config?.filters || {};
  const filtersKey = JSON.stringify(widgetFilters);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await apiDashboardDataset(datasetId, JSON.parse(filtersKey) as WidgetFilters);
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load widget data');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [datasetId, filtersKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const fields = data?.analysis?.fields || [];
  const suggested = data?.analysis?.suggested;
  const filterDefinitions: DashboardFilterDef[] = data?.filters || [];

  const updateFilters = (filters: WidgetFilters) => {
    onUpdate({ ...widget, config: { ...widget.config, filters } });
  };

  const isTableWidget =
    widget.chartType === 'table' ||
    widget.chartType === 'expandableTable' ||
    widget.chartType === 'pivotTable';

  const config: WidgetConfig = resolveWidgetConfig(
    datasetId,
    (data?.rows as Record<string, unknown>[]) || [],
    {
      categoryField: widget.config?.categoryField || suggested?.categoryField || undefined,
      valueField: widget.config?.valueField || suggested?.valueField || undefined,
      timeField: widget.config?.timeField || suggested?.timeField || undefined,
      sort: widget.config?.sort,
      showLegend: widget.config?.showLegend,
      aggregation: widget.config?.aggregation,
    },
    widget.chartType,
  );

  const datasetLabel = data?.dataset?.label;
  const chartRecLabel = filterWidgetChartRecommendations(data?.analysis?.recommendations || [], {
    datasetId,
    datasetKind: data?.dataset?.kind,
  }).find((r) => r.id === widget.chartType)?.label;

  const displayTitle =
    datasetLabel && isPartitionChartType(widget.chartType)
      ? buildWidgetTitle(datasetLabel, widget.chartType, chartRecLabel)
      : widget.title;

  const datasetSubtitle = datasetLabel || widget.module || data?.dataset?.module || widget.datasetId;

  const panel = (
    <div
      className={`flex h-full flex-col overflow-hidden rounded-xl border border-indigo-100/70 bg-white/90 shadow-[0_12px_40px_-18px_rgba(59,130,246,0.18)] ${
        editMode ? 'ring-1 ring-indigo-200/80' : ''
      }`}
      style={{ gridColumn: `span ${widget.w}`, minHeight: widget.h * 80 }}
    >
      <div className="flex items-center gap-2 border-b border-indigo-100/50 bg-gradient-to-r from-white via-indigo-50/30 to-violet-50/20 px-3 py-2">
        {editMode ? <GripVertical size={14} className="shrink-0 text-slate-400" /> : null}
        <div className="min-w-0 flex-1">
          {editMode ? (
            <input
              value={widget.title}
              onChange={(e) => onUpdate({ ...widget, title: e.target.value })}
              className="w-full truncate bg-transparent text-sm font-semibold text-slate-900 outline-none"
            />
          ) : (
            <h3 className="truncate text-sm font-semibold text-slate-900">{displayTitle}</h3>
          )}
          <p className="truncate text-[10px] text-slate-500">{datasetSubtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button type="button" onClick={() => void load()} className="rounded p-1 text-slate-500 hover:bg-slate-100" title="Refresh">
            <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button type="button" onClick={() => setFullscreen(true)} className="rounded p-1 text-slate-500 hover:bg-slate-100" title="Expand">
            <Expand size={14} />
          </button>
          {editMode ? (
            <>
              <button type="button" onClick={() => setConfigOpen((v) => !v)} className="rounded p-1 text-slate-500 hover:bg-slate-100">
                <Settings2 size={14} />
              </button>
              <button type="button" onClick={() => onDuplicate(widget)} className="rounded p-1 text-slate-500 hover:bg-slate-100">
                <Copy size={14} />
              </button>
              <button type="button" onClick={() => onRemove(widget.id)} className="rounded p-1 text-red-500 hover:bg-red-50">
                <Trash2 size={14} />
              </button>
            </>
          ) : null}
        </div>
      </div>

      {configOpen && editMode ? (
        <div className="space-y-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2 text-xs">
          {filterDefinitions.length > 0 ? (
            <div>
              <p className="mb-1 font-semibold text-slate-600">Filters</p>
              <DashboardFilterFields
                compact
                definitions={filterDefinitions}
                values={widgetFilters}
                onChange={updateFilters}
              />
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
          <label className="space-y-0.5">
            <span className="text-slate-500">Chart</span>
            <select
              value={widget.chartType}
              onChange={(e) => onUpdate({ ...widget, chartType: e.target.value })}
              className="w-full rounded border border-slate-200 px-2 py-1"
            >
              {filterWidgetChartRecommendations(data?.analysis?.recommendations || [], {
                datasetId,
                datasetKind: datasetKindFromId(datasetId, data?.dataset?.kind),
              }).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label} ({r.suitability}%)
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-0.5">
            <span className="text-slate-500">Category / X</span>
            <select
              value={config.categoryField || ''}
              onChange={(e) => onUpdate({ ...widget, config: { ...widget.config, ...config, categoryField: e.target.value } })}
              className="w-full rounded border border-slate-200 px-2 py-1"
            >
              <option value="">Auto</option>
              {fields.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.key}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-0.5">
            <span className="text-slate-500">Value / Y</span>
            <select
              value={config.valueField || ''}
              onChange={(e) => onUpdate({ ...widget, config: { ...widget.config, ...config, valueField: e.target.value } })}
              className="w-full rounded border border-slate-200 px-2 py-1"
            >
              <option value="">Auto</option>
              {fields.filter((f) => f.kind === 'number').map((f) => (
                <option key={f.key} value={f.key}>
                  {f.key}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-0.5">
            <span className="text-slate-500">Time field</span>
            <select
              value={config.timeField || ''}
              onChange={(e) => onUpdate({ ...widget, config: { ...widget.config, ...config, timeField: e.target.value } })}
              className="w-full rounded border border-slate-200 px-2 py-1"
            >
              <option value="">None</option>
              {fields.filter((f) => f.kind === 'date').map((f) => (
                <option key={f.key} value={f.key}>
                  {f.key}
                </option>
              ))}
            </select>
          </label>
          </div>
        </div>
      ) : null}

      <div className={`flex min-h-0 flex-1 flex-col p-3 ${isTableWidget ? 'overflow-hidden' : ''}`}>
        {loading ? (
          <div className="flex h-40 items-center justify-center text-sm text-slate-500">Loading…</div>
        ) : error ? (
          <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
        ) : data?.rows?.length ? (
          <div className={isTableWidget ? 'flex min-h-0 flex-1 flex-col' : 'h-full'}>
            <WidgetChart
              chartType={widget.chartType}
              datasetId={datasetId}
              module={widget.module || data?.dataset?.module}
              rows={data.rows as Record<string, unknown>[]}
              config={config}
            />
          </div>
        ) : (
          <div className="flex h-40 items-center justify-center text-sm text-slate-500">No data available</div>
        )}
      </div>
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[80] flex flex-col bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="mx-auto flex h-full w-full max-w-6xl flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-lg font-semibold text-slate-900">{widget.title}</h2>
              <button type="button" onClick={() => setFullscreen(false)} className="rounded-lg p-2 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <div className={`flex min-h-0 flex-1 flex-col p-4 ${isTableWidget ? 'overflow-hidden' : ''}`}>
              {data?.rows?.length ? (
                <div className={isTableWidget ? 'flex min-h-0 flex-1 flex-col' : 'h-full'}>
                  <WidgetChart
                    chartType={widget.chartType}
                    datasetId={datasetId}
                    module={widget.module || data?.dataset?.module}
                    rows={data.rows as Record<string, unknown>[]}
                    config={config}
                    height={480}
                    expandTable
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
    );
  }

  return panel;
}



