'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Loader2, Sparkles, X } from 'lucide-react';
import { apiDashboardCatalog, apiDashboardDataset } from '../../lib/dashboard/api';
import type {
  ChartRecommendation,
  DashboardDatasetMeta,
  DashboardFilterDef,
  DashboardModuleGroup,
  DashboardWidget,
  DatasetPayload,
  WidgetFilters,
} from '../../lib/dashboard/types';
import { DashboardFilterFields } from './DashboardFilterFields';
import {
  EXCLUDED_WIDGET_CHART_TYPES,
  PARTITION_CHART_TYPES,
  PARTITION_FIELD_BY_DATASET,
  buildWidgetTitle,
  filterWidgetChartRecommendations,
  isMetricsDatasetId,
  isPartitionChartType,
  pickPrimaryListDataset,
} from '../../lib/dashboard/chartData';

type Props = {
  open: boolean;
  onClose: () => void;
  onAdd: (widgets: DashboardWidget[]) => void;
  nextPosition: { x: number; y: number };
  /** When set, wizard opens on this module (e.g. add more charts to Clients). */
  initialModule?: string;
};

type DatasetAnalysisState = {
  recommendations: ChartRecommendation[];
  insights: string[];
  suggested: {
    chartType: string;
    categoryField: string | null;
    valueField: string | null;
    timeField: string | null;
  };
  rowCount: number;
  label: string;
};

function defaultFilters(defs: DashboardFilterDef[]): WidgetFilters {
  const out: WidgetFilters = {};
  for (const def of defs) {
    out[def.key] = def.defaultValue ?? 'all';
  }
  return out;
}

function widgetSize(chartType: string) {
  const isTable =
    chartType === 'table' || chartType === 'expandableTable' || chartType === 'pivotTable';
  return {
    w: chartType === 'kpi' || chartType === 'counter' ? 3 : isTable ? 12 : 6,
    h: isTable ? 3 : 3,
  };
}

function analysisFromPayload(payload: DatasetPayload): DatasetAnalysisState {
  const datasetKind = isMetricsDatasetId(payload.dataset.id) ? 'metrics' : 'list';
  const recommendations = filterWidgetChartRecommendations(payload.analysis.recommendations, {
    datasetId: payload.dataset.id,
    datasetKind,
  });
  let suggestedType = payload.analysis.suggested.chartType;
  if (EXCLUDED_WIDGET_CHART_TYPES.has(suggestedType)) {
    suggestedType = recommendations[0]?.id || 'table';
  }
  if (isMetricsDatasetId(payload.dataset.id) && isPartitionChartType(suggestedType)) {
    suggestedType = recommendations[0]?.id || 'bar';
  }
  const partitionField = PARTITION_FIELD_BY_DATASET[payload.dataset.id];
  return {
    recommendations,
    insights: payload.analysis.insights,
    suggested: {
      ...payload.analysis.suggested,
      chartType: suggestedType,
      categoryField: partitionField || payload.analysis.suggested.categoryField,
    },
    rowCount: payload.rowCount,
    label: payload.dataset.label,
  };
}

export function AddWidgetWizard({ open, onClose, onAdd, nextPosition, initialModule }: Props) {
  const [modules, setModules] = useState<DashboardModuleGroup[]>([]);
  const [selectedModule, setSelectedModule] = useState('');
  const [selectedDatasetIds, setSelectedDatasetIds] = useState<string[]>([]);
  const [selectedChartTypes, setSelectedChartTypes] = useState<string[]>([]);
  const [filterValues, setFilterValues] = useState<WidgetFilters>({});
  const [filterDefs, setFilterDefs] = useState<DashboardFilterDef[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [previewDatasetId, setPreviewDatasetId] = useState('');
  const [analysisByDataset, setAnalysisByDataset] = useState<Record<string, DatasetAnalysisState>>({});
  const allDatasets = useMemo(
    () => modules.flatMap((m) => m.datasets.map((d) => ({ ...d, moduleName: m.name }))),
    [modules]
  );

  const moduleDatasets = useMemo(() => {
    const mod = modules.find((m) => m.name === selectedModule);
    return mod?.datasets || [];
  }, [modules, selectedModule]);

  const usesPartitionCharts = useMemo(
    () => selectedChartTypes.some((t) => PARTITION_CHART_TYPES.has(t)),
    [selectedChartTypes]
  );

  const selectableModuleDatasets = useMemo(() => {
    if (!usesPartitionCharts) return moduleDatasets;
    return moduleDatasets.filter((d) => d.kind === 'list');
  }, [moduleDatasets, usesPartitionCharts]);

  const previewMeta = useMemo(
    () => allDatasets.find((d) => d.id === previewDatasetId) || moduleDatasets[0] || null,
    [allDatasets, moduleDatasets, previewDatasetId]
  );

  const analysis = previewDatasetId ? analysisByDataset[previewDatasetId] : null;

  const widgetCount = useMemo(() => {
    if (!selectedDatasetIds.length || !selectedChartTypes.length) return 0;
    return 1;
  }, [selectedDatasetIds, selectedChartTypes]);

  useEffect(() => {
    if (!open) return;
    void apiDashboardCatalog()
      .then((catalog) => {
        setModules(catalog.modules);
        const targetMod =
          catalog.modules.find((m) => m.name === initialModule) || catalog.modules[0];
        const firstDs = targetMod?.datasets[0];
        setSelectedModule(targetMod?.name || '');
        setSelectedDatasetIds(firstDs ? [firstDs.id] : []);
        setPreviewDatasetId(firstDs?.id || '');
        setFilterDefs(firstDs?.filters || []);
        setFilterValues(defaultFilters(firstDs?.filters || []));
      })
      .catch(() => setModules([]));
    setAnalysisByDataset({});
    setSelectedChartTypes([]);
  }, [open, initialModule]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!previewDatasetId) return;
    setLoading(true);
    void apiDashboardDataset(previewDatasetId, filterValues)
      .then((payload) => {
        if (payload.filters?.length) setFilterDefs(payload.filters);
        const next = analysisFromPayload(payload);
        setAnalysisByDataset((prev) => ({ ...prev, [previewDatasetId]: next }));
        setSelectedChartTypes((prev) => {
          if (prev.length) return prev;
          return [next.suggested.chartType];
        });
      })
      .catch(() => {
        setAnalysisByDataset((prev) => {
          const copy = { ...prev };
          delete copy[previewDatasetId];
          return copy;
        });
      })
      .finally(() => setLoading(false));
  }, [previewDatasetId, filterValues]);

  useEffect(() => {
    if (!previewDatasetId || selectedDatasetIds.includes(previewDatasetId)) return;
    setPreviewDatasetId(selectedDatasetIds[0] || selectableModuleDatasets[0]?.id || '');
  }, [selectedDatasetIds, previewDatasetId, selectableModuleDatasets]);

  useEffect(() => {
    if (!usesPartitionCharts) return;
    const allowed = new Set(selectableModuleDatasets.map((d) => d.id));
    setSelectedDatasetIds((prev) => {
      const next = prev.filter((id) => allowed.has(id));
      return next.length ? next : selectableModuleDatasets[0] ? [selectableModuleDatasets[0].id] : [];
    });
    if (!allowed.has(previewDatasetId) && selectableModuleDatasets[0]) {
      setPreviewDatasetId(selectableModuleDatasets[0].id);
    }
  }, [usesPartitionCharts, selectableModuleDatasets, previewDatasetId]);

  if (!open) return null;

  const toggleDataset = (datasetId: string, checked: boolean) => {
    setSelectedDatasetIds(checked ? [datasetId] : []);
    if (checked) {
      setPreviewDatasetId(datasetId);
      const meta = allDatasets.find((d) => d.id === datasetId);
      if (meta?.filters?.length) {
        setFilterDefs(meta.filters);
        setFilterValues(defaultFilters(meta.filters));
      }
    }
  };

  const toggleChartType = (chartId: string) => {
    setSelectedChartTypes((prev) => (prev[0] === chartId ? [] : [chartId]));
  };

  const handleModuleChange = (moduleName: string) => {
    setSelectedModule(moduleName);
    const mod = modules.find((m) => m.name === moduleName);
    const first = pickPrimaryListDataset(mod?.datasets || []);
    if (first) {
      setSelectedDatasetIds([first.id]);
      setPreviewDatasetId(first.id);
      setFilterDefs(first.filters || []);
      setFilterValues(defaultFilters(first.filters || []));
    } else {
      setSelectedDatasetIds([]);
      setPreviewDatasetId('');
    }
    setSelectedChartTypes([]);
    setAnalysisByDataset({});
  };

  const handleAdd = async () => {
    if (!selectedDatasetIds.length || !selectedChartTypes.length) return;
    setAdding(true);
    try {
      const newWidgets: DashboardWidget[] = [];
      const datasetId = selectedDatasetIds[0];
      const chartType = selectedChartTypes[0];
      let payloadAnalysis = analysisByDataset[datasetId];
      let payload: DatasetPayload | null = null;

      if (!payloadAnalysis) {
        payload = await apiDashboardDataset(
          datasetId,
          datasetId === previewDatasetId ? filterValues : {}
        );
        payloadAnalysis = analysisFromPayload(payload);
      }

      const datasetMeta = allDatasets.find((d) => d.id === datasetId);
      const widgetModule = datasetMeta?.moduleName || datasetMeta?.module || selectedModule;
      const metaFilters = datasetMeta?.filters || payload?.filters || [];

      if (!(isMetricsDatasetId(datasetId) && isPartitionChartType(chartType))) {
        const filtersForWidget =
          datasetId === previewDatasetId ? { ...filterValues } : defaultFilters(metaFilters);
        const { w, h } = widgetSize(chartType);
        const chartLabel =
          payloadAnalysis.recommendations.find((r) => r.id === chartType)?.label || chartType;
        const widgetTitle = buildWidgetTitle(payloadAnalysis.label, chartType, chartLabel);
        const partitionField = PARTITION_FIELD_BY_DATASET[datasetId];

        newWidgets.push({
          id: `w_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          datasetId,
          module: widgetModule,
          chartType,
          title: widgetTitle,
          x: nextPosition.x,
          y: nextPosition.y,
          w,
          h,
          config: {
            categoryField:
              isPartitionChartType(chartType) && partitionField
                ? partitionField
                : payloadAnalysis.suggested.categoryField || undefined,
            valueField: payloadAnalysis.suggested.valueField || undefined,
            timeField: payloadAnalysis.suggested.timeField || undefined,
            showLegend: true,
            sort: 'desc',
            filters: filtersForWidget,
          },
        });
      }

      onAdd(newWidgets);
      onClose();
    } catch {
      // keep wizard open on failure
    } finally {
      setAdding(false);
    }
  };

  const modal = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-dashboard-widget-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-indigo-100/60 px-5 py-4">
          <div>
            <h2 id="add-dashboard-widget-title" className="text-lg font-bold text-slate-900">
              Add dashboard widgets
            </h2>
            <p className="text-xs text-slate-500">
              Pick one module, one dataset, and one chart type. Each module can have only one widget on the dashboard.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <label className="block space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Module</span>
            <select
              value={selectedModule}
              onChange={(e) => handleModuleChange(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            >
              {modules.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Dataset
              </span>
            </div>
            {usesPartitionCharts && selectableModuleDatasets.length < moduleDatasets.length ? (
              <p className="mb-2 rounded-lg border border-indigo-100 bg-indigo-50/80 px-3 py-2 text-xs text-indigo-900">
                Pie and donut charts use the main list dataset (e.g. All clients) and show counts by{' '}
                <strong>status</strong>. KPI metric datasets are hidden for this chart type.
              </p>
            ) : null}
            <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 p-2">
              {selectableModuleDatasets.map((d) => {
                const checked = selectedDatasetIds.includes(d.id);
                return (
                  <label
                    key={d.id}
                    className={`flex cursor-pointer items-start gap-2 rounded-lg px-2 py-2 text-sm transition-colors ${
                      checked ? 'bg-indigo-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      checked={checked}
                      onChange={(e) => toggleDataset(d.id, e.target.checked)}
                      name="dashboard-widget-dataset"
                      className="mt-0.5 rounded border-slate-300 text-indigo-600"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-slate-900">{d.label}</span>
                      {d.description ? (
                        <span className="mt-0.5 block text-[11px] text-slate-500">{d.description}</span>
                      ) : null}
                    </span>
                    {previewDatasetId === d.id ? (
                      <span className="shrink-0 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
                        Preview
                      </span>
                    ) : checked ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setPreviewDatasetId(d.id);
                        }}
                        className="shrink-0 text-[10px] font-semibold text-indigo-600 hover:underline"
                      >
                        Preview
                      </button>
                    ) : null}
                  </label>
                );
              })}
            </div>
            {selectedDatasetIds.length > 0 ? (
              <p className="mt-1.5 text-[11px] text-slate-500">
                1 dataset selected
              </p>
            ) : null}
          </div>

          {previewMeta?.description ? (
            <p className="text-xs text-slate-500">{previewMeta.description}</p>
          ) : null}

          {filterDefs.length > 0 ? (
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Filters</p>
              <DashboardFilterFields
                definitions={filterDefs}
                values={filterValues}
                onChange={setFilterValues}
              />
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" /> Analyzing preview dataset…
            </div>
          ) : null}

          {analysis ? (
            <>
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 px-3 py-2 text-xs text-indigo-900">
                <p className="font-semibold">
                  Preview: {analysis.label} — {analysis.rowCount} rows
                </p>
                <ul className="mt-2 space-y-1">
                  {analysis.insights.map((line) => (
                    <li key={line} className="flex items-start gap-1.5">
                      <Sparkles size={12} className="mt-0.5 shrink-0" />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Chart type
                  </span>
                  <span className="text-[11px] font-semibold text-indigo-600">
                    Top recommendation first
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {analysis.recommendations.map((rec) => {
                    const selected = selectedChartTypes[0] === rec.id;
                    return (
                      <button
                        key={rec.id}
                        type="button"
                        onClick={() => toggleChartType(rec.id)}
                        className={`relative rounded-xl border px-3 py-2.5 text-left text-sm transition-all ${
                          selected
                            ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                            : 'border-slate-200 hover:border-indigo-200'
                        }`}
                      >
                        {selected ? (
                          <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white">
                            <Check size={12} />
                          </span>
                        ) : null}
                        <span className="font-semibold text-slate-900">{rec.label}</span>
                        <span className="ml-2 text-xs font-bold text-indigo-600">{rec.suitability}%</span>
                        <p className="mt-1 pr-6 text-[11px] text-slate-500">{rec.reasons[0]}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <p className="text-xs text-slate-500">
                Widget titles are created automatically (e.g.{' '}
                <span className="font-medium text-slate-700">
                  {buildWidgetTitle(analysis.label, 'pie', 'Pie Chart')}
                </span>
                ).
              </p>
            </>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-4">
          <p className="text-xs text-slate-500">
            {widgetCount > 0
              ? `Will add ${widgetCount} widget${widgetCount === 1 ? '' : 's'}`
              : 'Select at least one dataset and one chart type'}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={widgetCount === 0 || adding}
              onClick={() => void handleAdd()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {adding ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 size={14} className="animate-spin" /> Adding…
                </span>
              ) : (
                `Add ${widgetCount || ''} widget${widgetCount === 1 ? '' : 's'}`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modal, document.body);
}


