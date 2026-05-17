'use client';

import React, { useEffect, useMemo, useState } from 'react';
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

type Props = {
  open: boolean;
  onClose: () => void;
  onAdd: (widgets: DashboardWidget[]) => void;
  nextPosition: { x: number; y: number };
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
  return {
    w: chartType === 'kpi' || chartType === 'counter' ? 3 : 6,
    h: chartType === 'table' ? 4 : 3,
  };
}

function analysisFromPayload(payload: DatasetPayload): DatasetAnalysisState {
  return {
    recommendations: payload.analysis.recommendations,
    insights: payload.analysis.insights,
    suggested: payload.analysis.suggested,
    rowCount: payload.rowCount,
    label: payload.dataset.label,
  };
}

export function AddWidgetWizard({ open, onClose, onAdd, nextPosition }: Props) {
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
  const [title, setTitle] = useState('');

  const allDatasets = useMemo(
    () => modules.flatMap((m) => m.datasets.map((d) => ({ ...d, moduleName: m.name }))),
    [modules]
  );

  const moduleDatasets = useMemo(() => {
    const mod = modules.find((m) => m.name === selectedModule);
    return mod?.datasets || [];
  }, [modules, selectedModule]);

  const previewMeta = useMemo(
    () => allDatasets.find((d) => d.id === previewDatasetId) || moduleDatasets[0] || null,
    [allDatasets, moduleDatasets, previewDatasetId]
  );

  const analysis = previewDatasetId ? analysisByDataset[previewDatasetId] : null;

  const widgetCount = useMemo(() => {
    if (!selectedDatasetIds.length || !selectedChartTypes.length) return 0;
    return selectedDatasetIds.length * selectedChartTypes.length;
  }, [selectedDatasetIds, selectedChartTypes]);

  useEffect(() => {
    if (!open) return;
    void apiDashboardCatalog()
      .then((catalog) => {
        setModules(catalog.modules);
        const firstMod = catalog.modules[0];
        const firstDs = firstMod?.datasets[0];
        setSelectedModule(firstMod?.name || '');
        setSelectedDatasetIds(firstDs ? [firstDs.id] : []);
        setPreviewDatasetId(firstDs?.id || '');
        setFilterDefs(firstDs?.filters || []);
        setFilterValues(defaultFilters(firstDs?.filters || []));
      })
      .catch(() => setModules([]));
    setAnalysisByDataset({});
    setSelectedChartTypes([]);
    setTitle('');
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
          return [payload.analysis.suggested.chartType];
        });
        setTitle((prev) => prev || payload.dataset.label);
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
    setPreviewDatasetId(selectedDatasetIds[0] || moduleDatasets[0]?.id || '');
  }, [selectedDatasetIds, previewDatasetId, moduleDatasets]);

  if (!open) return null;

  const toggleDataset = (datasetId: string, checked: boolean) => {
    setSelectedDatasetIds((prev) => {
      if (checked) return prev.includes(datasetId) ? prev : [...prev, datasetId];
      return prev.filter((id) => id !== datasetId);
    });
    if (checked) {
      setPreviewDatasetId(datasetId);
      const meta = allDatasets.find((d) => d.id === datasetId);
      if (meta?.filters?.length) {
        setFilterDefs(meta.filters);
        setFilterValues(defaultFilters(meta.filters));
      }
    }
  };

  const selectAllInModule = () => {
    const ids = moduleDatasets.map((d) => d.id);
    setSelectedDatasetIds((prev) => [...new Set([...prev, ...ids])]);
    if (ids[0]) setPreviewDatasetId(ids[0]);
  };

  const clearModuleSelection = () => {
    const moduleIds = new Set(moduleDatasets.map((d) => d.id));
    setSelectedDatasetIds((prev) => prev.filter((id) => !moduleIds.has(id)));
  };

  const toggleChartType = (chartId: string) => {
    setSelectedChartTypes((prev) =>
      prev.includes(chartId) ? prev.filter((id) => id !== chartId) : [...prev, chartId]
    );
  };

  const handleModuleChange = (moduleName: string) => {
    setSelectedModule(moduleName);
    const mod = modules.find((m) => m.name === moduleName);
    const first = mod?.datasets[0];
    if (first && !selectedDatasetIds.length) {
      setSelectedDatasetIds([first.id]);
      setPreviewDatasetId(first.id);
      setFilterDefs(first.filters || []);
      setFilterValues(defaultFilters(first.filters || []));
    }
  };

  const handleAdd = async () => {
    if (!selectedDatasetIds.length || !selectedChartTypes.length) return;
    setAdding(true);
    try {
      const newWidgets: DashboardWidget[] = [];
      let y = nextPosition.y;
      const useSharedTitle = selectedDatasetIds.length === 1 && selectedChartTypes.length > 1;

      for (const datasetId of selectedDatasetIds) {
        let payloadAnalysis = analysisByDataset[datasetId];
        let payload: DatasetPayload | null = null;

        if (!payloadAnalysis) {
          payload = await apiDashboardDataset(
            datasetId,
            datasetId === previewDatasetId ? filterValues : {}
          );
          payloadAnalysis = analysisFromPayload(payload);
        }

        const metaFilters = allDatasets.find((d) => d.id === datasetId)?.filters || payload?.filters || [];
        const filtersForWidget =
          datasetId === previewDatasetId ? { ...filterValues } : defaultFilters(metaFilters);

        for (const chartType of selectedChartTypes) {
          const { w, h } = widgetSize(chartType);
          const chartLabel =
            payloadAnalysis.recommendations.find((r) => r.id === chartType)?.label || chartType;
          const baseTitle = title.trim() || payloadAnalysis.label;
          const widgetTitle = useSharedTitle
            ? `${baseTitle} — ${chartLabel}`
            : selectedChartTypes.length > 1
              ? `${baseTitle} — ${chartLabel}`
              : baseTitle;

          newWidgets.push({
            id: `w_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            datasetId,
            chartType,
            title: widgetTitle,
            x: nextPosition.x,
            y,
            w,
            h,
            config: {
              categoryField: payloadAnalysis.suggested.categoryField || undefined,
              valueField: payloadAnalysis.suggested.valueField || undefined,
              timeField: payloadAnalysis.suggested.timeField || undefined,
              showLegend: true,
              sort: 'desc',
              filters: filtersForWidget,
            },
          });
          y += h;
        }
      }

      onAdd(newWidgets);
      onClose();
    } catch {
      // keep wizard open on failure
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-indigo-100/60 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Add dashboard widgets</h2>
            <p className="text-xs text-slate-500">
              Select multiple datasets and chart types to add several widgets at once.
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
                Datasets (multi-select)
              </span>
              <div className="flex gap-2 text-[11px] font-semibold">
                <button type="button" onClick={selectAllInModule} className="text-indigo-600 hover:underline">
                  All in module
                </button>
                <button type="button" onClick={clearModuleSelection} className="text-slate-500 hover:underline">
                  Clear module
                </button>
              </div>
            </div>
            <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 p-2">
              {moduleDatasets.map((d) => {
                const checked = selectedDatasetIds.includes(d.id);
                return (
                  <label
                    key={d.id}
                    className={`flex cursor-pointer items-start gap-2 rounded-lg px-2 py-2 text-sm transition-colors ${
                      checked ? 'bg-indigo-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => toggleDataset(d.id, e.target.checked)}
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
                {selectedDatasetIds.length} dataset{selectedDatasetIds.length === 1 ? '' : 's'} selected
                {selectedDatasetIds.length > 1 ? ' (across modules if you switch module)' : ''}
              </p>
            ) : null}
          </div>

          {previewMeta?.description ? (
            <p className="text-xs text-slate-500">{previewMeta.description}</p>
          ) : null}

          {filterDefs.length > 0 && selectedDatasetIds.length <= 1 ? (
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Filters</p>
              <DashboardFilterFields
                definitions={filterDefs}
                values={filterValues}
                onChange={setFilterValues}
              />
            </div>
          ) : selectedDatasetIds.length > 1 ? (
            <p className="rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
              Filters apply to the preview dataset only. Other selected datasets use default filters when added.
            </p>
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
                    Chart types (multi-select)
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedChartTypes(analysis.recommendations.slice(0, 4).map((r) => r.id))
                    }
                    className="text-[11px] font-semibold text-indigo-600 hover:underline"
                  >
                    Top 4 recommendations
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {analysis.recommendations.map((rec) => {
                    const selected = selectedChartTypes.includes(rec.id);
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

              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Base title (optional)
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={analysis.label}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
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
}



