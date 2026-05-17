import type { WidgetConfig } from './types';

function getNested(row: Record<string, unknown>, key: string) {
  if (!key) return undefined;
  if (key in row) return row[key];
  const parts = key.split('.');
  let cur: unknown = row;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function isNumericField(rows: Record<string, unknown>[], key: string) {
  if (!key) return false;
  return rows.some((row) => {
    const v = getNested(row, key);
    if (typeof v === 'number' && Number.isFinite(v)) return true;
    if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return true;
    return false;
  });
}

function findFirstNumericKey(rows: Record<string, unknown>[]) {
  const row = rows[0] || {};
  for (const [k, v] of Object.entries(row)) {
    if (k === 'id' || k.endsWith('Id')) continue;
    if (typeof v === 'number' && Number.isFinite(v)) return k;
    if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return k;
  }
  return '';
}

function findSecondNumericKey(rows: Record<string, unknown>[], skip: string) {
  const row = rows[0] || {};
  for (const [k, v] of Object.entries(row)) {
    if (k === skip || k === 'id' || k.endsWith('Id')) continue;
    if (typeof v === 'number' && Number.isFinite(v)) return k;
  }
  return skip;
}

function findFirstCategoryKey(rows: Record<string, unknown>[]) {
  const preferred = ['status', 'stage', 'metric', 'name', 'title', 'client', 'industry', 'source', 'module', 'round'];
  const row = rows[0] || {};
  for (const key of preferred) {
    if (key in row && typeof row[key] === 'string') return key;
  }
  for (const [k, v] of Object.entries(row)) {
    if (k === 'id' || k.endsWith('Id') || k.includes('At') || k.includes('Date')) continue;
    if (typeof v === 'string' && v.length > 0 && v.length < 80) return k;
  }
  return Object.keys(row).find((k) => k !== 'id') || 'name';
}

function findFirstDateKey(rows: Record<string, unknown>[]) {
  const row = rows[0] || {};
  for (const [k, v] of Object.entries(row)) {
    if (/date|time|at$/i.test(k)) return k;
    if (v && !Number.isNaN(Date.parse(String(v)))) return k;
  }
  return '';
}

/** Dataset-specific defaults when widget config is empty or auto. */
export function resolveWidgetConfig(
  datasetId: string,
  rows: Record<string, unknown>[],
  config: WidgetConfig = {},
): WidgetConfig {
  const next = { ...config };
  if (datasetId === 'candidates_pipeline') {
    next.categoryField = next.categoryField || 'stage';
    next.valueField = next.valueField || 'count';
  } else if (datasetId.endsWith('_metrics')) {
    next.categoryField = next.categoryField || 'metric';
    next.valueField = next.valueField || 'value';
  } else if (datasetId === 'clients' || datasetId === 'leads' || datasetId === 'jobs') {
    next.categoryField = next.categoryField || 'status';
    if (!next.valueField) next.valueField = undefined;
  } else if (datasetId === 'interviews') {
    next.categoryField = next.categoryField || 'status';
  } else if (datasetId === 'placements') {
    next.categoryField = next.categoryField || 'status';
    next.valueField = next.valueField || (isNumericField(rows, 'revenue') ? 'revenue' : '');
  }

  if (!next.categoryField && rows.length) {
    next.categoryField = findFirstCategoryKey(rows);
  }
  if (!next.timeField && rows.length) {
    const dateKey = findFirstDateKey(rows);
    if (dateKey) next.timeField = dateKey;
  }
  return next;
}

export function buildChartSeries(
  rows: Record<string, unknown>[],
  chartType: string,
  config: WidgetConfig = {},
  datasetId?: string,
) {
  if (!rows.length) return { series: [], tableRows: rows, kpiValue: 0 };

  const resolved = datasetId ? resolveWidgetConfig(datasetId, rows, config) : config;
  const categoryField = resolved.categoryField || '';
  const valueField = resolved.valueField || '';
  const timeField = resolved.timeField || '';

  if (chartType === 'kpi' || chartType === 'counter' || chartType === 'gauge') {
    let numericKey = valueField || findFirstNumericKey(rows);
    if (!isNumericField(rows, numericKey)) {
      return { series: [], tableRows: rows, kpiValue: chartType === 'counter' ? rows.length : rows.length };
    }
    const values = rows.map((r) => toNumber(getNested(r, numericKey)));
    const total = values.reduce((a, b) => a + b, 0);
    return { series: [], tableRows: rows, kpiValue: chartType === 'counter' ? rows.length : total };
  }

  if (chartType === 'table' || chartType === 'expandableTable' || chartType === 'pivotTable') {
    return { series: [], tableRows: rows.slice(0, 100), kpiValue: rows.length };
  }

  if (chartType === 'scatter' || chartType === 'bubble') {
    const xKey = valueField || findFirstNumericKey(rows);
    const yKey = findSecondNumericKey(rows, xKey);
    const series = rows.slice(0, 200).map((r, i) => ({
      x: toNumber(getNested(r, xKey)),
      y: toNumber(getNested(r, yKey)),
      z: chartType === 'bubble' ? toNumber(getNested(r, categoryField)) || 8 : undefined,
      name: String(getNested(r, categoryField) ?? i + 1),
    }));
    return { series, tableRows: rows, kpiValue: 0, xKey, yKey };
  }

  const timelineCharts = chartType === 'line' || chartType === 'area' || chartType === 'timeline';
  let groupKey =
    categoryField ||
    (timelineCharts ? findFirstDateKey(rows) || findFirstCategoryKey(rows) : findFirstCategoryKey(rows));

  let metricKey = valueField || findFirstNumericKey(rows);
  const useCountAggregation = !isNumericField(rows, metricKey);

  const bucket = new Map<string, number>();
  for (const row of rows) {
    let label = String(getNested(row, groupKey) ?? 'Unknown').trim() || 'Unknown';
    if (timeField && timelineCharts) {
      const raw = getNested(row, timeField);
      const d = raw ? new Date(String(raw)) : null;
      label = d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : label;
    }
    const val = useCountAggregation ? 1 : toNumber(getNested(row, metricKey));
    bucket.set(label, (bucket.get(label) || 0) + val);
  }

  let series = [...bucket.entries()]
    .map(([name, value]) => ({ name, value }))
    .filter((s) => s.value > 0);

  if (config.sort === 'asc') series.sort((a, b) => a.value - b.value);
  else series.sort((a, b) => b.value - a.value);

  const maxSlices = chartType === 'pie' || chartType === 'donut' ? 10 : 24;
  series = series.slice(0, maxSlices);

  if (chartType === 'histogram' && !useCountAggregation && metricKey) {
    const nums = rows.map((r) => toNumber(getNested(r, metricKey))).filter((n) => n > 0);
    if (nums.length) {
      const min = Math.min(...nums);
      const max = Math.max(...nums);
      const bins = 8;
      const step = (max - min) / bins || 1;
      series = Array.from({ length: bins }, (_, i) => ({
        name: `${Math.round(min + i * step)}–${Math.round(min + (i + 1) * step)}`,
        value: 0,
      }));
      for (const n of nums) {
        const idx = Math.min(bins - 1, Math.floor((n - min) / step));
        series[idx].value += 1;
      }
      series = series.filter((s) => s.value > 0);
    }
  }

  if (chartType === 'funnel' || chartType === 'progressBar' || chartType === 'stepTracker') {
    series = series.slice(0, 8);
  }

  return { series, tableRows: rows, kpiValue: 0, groupKey, metricKey, useCountAggregation };
}

export const CHART_COLORS = ['#2563eb', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#0ea5e9', '#ec4899', '#64748b'];
