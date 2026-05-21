import type { ChartRecommendation, WidgetConfig } from './types';

/** Chart types hidden from the add/edit widget picker */
export const EXCLUDED_WIDGET_CHART_TYPES = new Set([
  'gauge',
  'pivotTable',
  'treemap',
  'stepTracker',
  'progressBar',
]);

export const PARTITION_CHART_TYPES = new Set(['pie', 'donut']);

export const CHART_TYPE_LABELS: Record<string, string> = {
  pie: 'Pie Chart',
  donut: 'Donut Chart',
  bar: 'Bar Graph',
  line: 'Line Graph',
  area: 'Area Graph',
  table: 'Data Table',
  kpi: 'KPI Card',
  counter: 'Counter',
  funnel: 'Funnel Graph',
};

/** List datasets used for status/stage breakdowns (pie & donut). */
export const PARTITION_FIELD_BY_DATASET: Record<string, string> = {
  leads: 'status',
  clients: 'status',
  jobs: 'status',
  candidates: 'status',
  interviews: 'status',
  placements: 'status',
  candidates_pipeline: 'stage',
  tasks_and_activity: 'recordType',
  team: 'status',
  departments: 'status',
};

const METRIC_KEY_LABELS: Record<string, string> = {
  activeClients: 'Active clients',
  openJobs: 'Open jobs',
  candidatesInProgress: 'Candidates in progress',
  totalCandidates: 'Total candidates',
  totalClients: 'Total clients',
  totalJobs: 'Total jobs',
  totalLeads: 'Total leads',
  joined: 'Joined',
  offered: 'Offered',
  pending: 'Pending',
};

export function isMetricsDatasetId(datasetId?: string) {
  if (!datasetId) return false;
  return /_(metrics|kpis|stats)$/.test(datasetId);
}

export function isPartitionChartType(chartType?: string) {
  return PARTITION_CHART_TYPES.has(chartType || '');
}

export function filterWidgetChartRecommendations(
  recommendations: ChartRecommendation[],
  opts?: { datasetId?: string; datasetKind?: 'list' | 'metrics' },
) {
  let filtered = recommendations.filter((r) => !EXCLUDED_WIDGET_CHART_TYPES.has(r.id));
  if (isMetricsDatasetId(opts?.datasetId) || opts?.datasetKind === 'metrics') {
    filtered = filtered.filter((r) => !PARTITION_CHART_TYPES.has(r.id));
  }
  return filtered;
}

export function buildWidgetTitle(
  datasetLabel: string,
  chartType: string,
  chartRecommendationLabel?: string,
): string {
  const chartLabel = chartRecommendationLabel || CHART_TYPE_LABELS[chartType] || chartType;
  return `${datasetLabel} — ${chartLabel}`;
}

export function pickPrimaryListDataset(datasets: { id: string; kind?: string }[]) {
  return datasets.find((d) => d.kind === 'list') || datasets[0] || null;
}

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

const PARTITION_CATEGORY_KEYS = [
  'status',
  'stage',
  'state',
  'metric',
  'recordType',
  'source',
  'module',
  'round',
  'industry',
] as const;

const ENTITY_LABEL_FIELD_RE =
  /^(name|title|companyname|companyName|client|candidate|email|firstname|lastname|candidatename|jobtitle|assignedto|recruiter|description|location|phone|address)$/i;

function isEntityLabelField(key: string) {
  const bare = key.includes('.') ? key.split('.').pop() || key : key;
  if (PARTITION_CATEGORY_KEYS.includes(bare as (typeof PARTITION_CATEGORY_KEYS)[number])) return false;
  if (/status|stage|state|metric|source|module|round|type$/i.test(bare)) return false;
  return ENTITY_LABEL_FIELD_RE.test(bare) || /name$/i.test(bare);
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

function fieldExistsOnRows(rows: Record<string, unknown>[], key: string) {
  return rows.some((row) => {
    const v = getNested(row, key);
    return v != null && String(v).trim() !== '';
  });
}

/** Pie/donut should group by status/stage — not individual client or company names. */
export function resolvePartitionCategoryField(
  datasetId: string | undefined,
  rows: Record<string, unknown>[],
  config: WidgetConfig = {},
): string {
  const resolved = datasetId ? resolveWidgetConfig(datasetId, rows, config) : config;
  const configured = resolved.categoryField || '';

  if (datasetId === 'candidates_pipeline') return 'stage';
  if (datasetId?.endsWith('_metrics') || datasetId?.endsWith('_kpis') || datasetId?.endsWith('_stats')) {
    return 'metric';
  }
  if (datasetId === 'tasks_and_activity') return fieldExistsOnRows(rows, 'recordType') ? 'recordType' : 'module';
  if (datasetId === 'departments') return fieldExistsOnRows(rows, 'status') ? 'status' : 'name';

  if (configured && !isEntityLabelField(configured) && fieldExistsOnRows(rows, configured)) {
    return configured;
  }

  for (const key of PARTITION_CATEGORY_KEYS) {
    if (fieldExistsOnRows(rows, key)) return key;
  }

  const row = rows[0] || {};
  for (const k of Object.keys(row)) {
    if (k === 'id' || k.endsWith('Id') || isEntityLabelField(k)) continue;
    if (/status|stage|state|metric|source|module|round|type/i.test(k) && fieldExistsOnRows(rows, k)) {
      return k;
    }
  }

  return configured && fieldExistsOnRows(rows, configured) ? configured : findFirstCategoryKey(rows);
}

export function formatPartitionLabel(raw: string): string {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return 'Unknown';
  if (METRIC_KEY_LABELS[trimmed]) return METRIC_KEY_LABELS[trimmed];

  if (/[a-z][A-Z]/.test(trimmed) || /^[a-z][a-zA-Z0-9]+$/.test(trimmed)) {
    return trimmed
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  if (/[_\s]/.test(trimmed) && trimmed.length > 2) {
    return trimmed
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  if (trimmed.length <= 12 && trimmed === trimmed.toUpperCase()) {
    return trimmed
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return trimmed;
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
  chartType?: string,
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

  if (isPartitionChartType(chartType)) {
    next.categoryField = resolvePartitionCategoryField(datasetId, rows, next);
    if (PARTITION_FIELD_BY_DATASET[datasetId] && !isMetricsDatasetId(datasetId)) {
      next.categoryField = PARTITION_FIELD_BY_DATASET[datasetId];
    }
  }

  return next;
}

/** Hiring pipeline stages in funnel order (matches backend candidates_pipeline). */
const HIRING_PIPELINE_STAGE_ORDER = [
  'Applied',
  'Longlist',
  'Shortlist',
  'Screening',
  'Submitted',
  'Interviewing',
  'Offered',
  'Hired',
];

const FUNNEL_EXCLUDE_STAGES = new Set(['rejected', 'no candidates', 'unknown']);

function stageRank(name: string) {
  const lower = name.toLowerCase().trim();
  const exact = HIRING_PIPELINE_STAGE_ORDER.findIndex((stage) => stage.toLowerCase() === lower);
  if (exact >= 0) return exact;
  const partial = HIRING_PIPELINE_STAGE_ORDER.findIndex(
    (stage) => lower.includes(stage.toLowerCase()) || stage.toLowerCase().includes(lower),
  );
  return partial >= 0 ? partial : 999;
}

function shouldUsePipelineStageOrder(
  series: { name: string; value: number }[],
  datasetId?: string,
  categoryField?: string,
) {
  if (datasetId === 'candidates_pipeline' || categoryField === 'stage') return true;
  return series.some((s) =>
    HIRING_PIPELINE_STAGE_ORDER.some((stage) => stage.toLowerCase() === s.name.toLowerCase().trim()),
  );
}

export function orderFunnelSeries(
  series: { name: string; value: number }[],
  opts?: { datasetId?: string; categoryField?: string; chartType?: string },
) {
  let items = series.filter((s) => !FUNNEL_EXCLUDE_STAGES.has(s.name.toLowerCase().trim()));

  if (shouldUsePipelineStageOrder(items, opts?.datasetId, opts?.categoryField)) {
    items.sort((a, b) => stageRank(a.name) - stageRank(b.name));
  } else if (opts?.chartType === 'funnel' || opts?.chartType === 'progressBar') {
    items.sort((a, b) => b.value - a.value);
  }

  return items.slice(0, 8);
}

export function buildChartSeries(
  rows: Record<string, unknown>[],
  chartType: string,
  config: WidgetConfig = {},
  datasetId?: string,
) {
  if (!rows.length) return { series: [], tableRows: rows, kpiValue: 0 };

  const resolved = datasetId
    ? resolveWidgetConfig(datasetId, rows, config, chartType)
    : config;
  const partitionChart = isPartitionChartType(chartType);

  if (partitionChart && isMetricsDatasetId(datasetId)) {
    return {
      series: [],
      tableRows: rows,
      kpiValue: 0,
      partitionMetricsBlocked: true,
    };
  }

  const categoryField = partitionChart
    ? resolvePartitionCategoryField(datasetId, rows, resolved)
    : resolved.categoryField || '';
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
    if (partitionChart) {
      label = formatPartitionLabel(label);
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
    series = orderFunnelSeries(series, {
      datasetId,
      categoryField: groupKey,
      chartType,
    });
  }

  return { series, tableRows: rows, kpiValue: 0, groupKey, metricKey, useCountAggregation };
}

export { CHART_COLORS, CHART_COLOR_TOP } from './chartTheme';
