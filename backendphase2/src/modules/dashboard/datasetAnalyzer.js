const DATE_KEY_RE = /(date|time|at|on|day|month|year|timestamp|scheduled|due|posted|joined|created|updated)/i;
const STATUS_KEY_RE = /(status|stage|state|phase|pipeline|progress)/i;
const GEO_KEY_RE = /(location|city|country|region|geo|lat|lng|address)/i;
const NUMERIC_AGG_RE = /(count|total|amount|revenue|fee|salary|number|qty|quantity|score|rate|percent|pct)/i;

function isDateValue(value) {
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length < 8) return false;
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) && !Number.isNaN(parsed);
}

function isNumericValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return true;
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) return true;
  return false;
}

function flattenRow(row, prefix = '') {
  const out = {};
  if (!row || typeof row !== 'object') return out;
  for (const [key, value] of Object.entries(row)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value == null) continue;
    if (Array.isArray(value)) continue;
    if (typeof value === 'object' && !(value instanceof Date)) {
      Object.assign(out, flattenRow(value, path));
      continue;
    }
    out[path] = value;
  }
  return out;
}

function inspectFields(rows) {
  const sample = rows.slice(0, Math.min(rows.length, 200)).map((row) => flattenRow(row));
  const keys = new Set();
  sample.forEach((row) => Object.keys(row).forEach((k) => keys.add(k)));

  const fields = [];
  for (const key of keys) {
    const values = sample.map((row) => row[key]).filter((v) => v != null && v !== '');
    if (!values.length) continue;

    const dateHits = values.filter(isDateValue).length;
    const numericHits = values.filter(isNumericValue).length;
    const stringValues = values.filter((v) => typeof v === 'string');
    const uniqueStrings = new Set(stringValues.map((v) => String(v).trim().toLowerCase()));

    let kind = 'text';
    if (dateHits / values.length >= 0.6) kind = 'date';
    else if (numericHits / values.length >= 0.6) kind = 'number';
    else if (uniqueStrings.size <= Math.min(24, Math.max(2, Math.ceil(values.length * 0.4)))) kind = 'category';

    fields.push({
      key,
      kind,
      cardinality: kind === 'category' ? uniqueStrings.size : kind === 'number' ? numericHits : dateHits,
      sampleValues: values.slice(0, 5),
    });
  }

  return fields;
}

const CHART_CATALOG = {
  line: { label: 'Line Graph', types: ['timeline'], baseScore: 95 },
  area: { label: 'Area Graph', types: ['timeline'], baseScore: 85 },
  timeline: { label: 'Timeline Graph', types: ['timeline'], baseScore: 80 },
  bar: { label: 'Bar Graph', types: ['comparison', 'distribution'], baseScore: 88 },
  horizontalBar: { label: 'Horizontal Bar Graph', types: ['comparison'], baseScore: 82 },
  groupedBar: { label: 'Grouped Bar Graph', types: ['comparison'], baseScore: 78 },
  histogram: { label: 'Histogram', types: ['distribution'], baseScore: 90 },
  density: { label: 'Density Graph', types: ['distribution'], baseScore: 70 },
  boxPlot: { label: 'Box Plot', types: ['distribution'], baseScore: 65 },
  pie: { label: 'Pie Chart', types: ['partition'], baseScore: 88 },
  donut: { label: 'Donut Chart', types: ['partition'], baseScore: 86 },
  treemap: { label: 'Treemap', types: ['partition', 'hierarchical'], baseScore: 75 },
  scatter: { label: 'Scatter Plot', types: ['correlation'], baseScore: 92 },
  bubble: { label: 'Bubble Graph', types: ['correlation'], baseScore: 80 },
  heatmap: { label: 'Heatmap', types: ['correlation', 'geographic'], baseScore: 72 },
  hierarchyTree: { label: 'Hierarchy Tree', types: ['hierarchical'], baseScore: 68 },
  sunburst: { label: 'Sunburst', types: ['hierarchical'], baseScore: 66 },
  geoMap: { label: 'Geo Map', types: ['geographic'], baseScore: 85 },
  kpi: { label: 'KPI Card', types: ['kpi'], baseScore: 95 },
  counter: { label: 'Counter Widget', types: ['kpi'], baseScore: 88 },
  progressBar: { label: 'Progress Bar', types: ['progress'], baseScore: 86 },
  funnel: { label: 'Funnel Graph', types: ['progress'], baseScore: 84 },
  stepTracker: { label: 'Step Tracker', types: ['progress'], baseScore: 78 },
  table: { label: 'Data Table', types: ['raw'], baseScore: 70 },
  expandableTable: { label: 'Expandable Table', types: ['raw'], baseScore: 65 },
};

function classifyDataset(fields, rowCount) {
  const types = new Set(['raw']);
  const dateFields = fields.filter((f) => f.kind === 'date');
  const numberFields = fields.filter((f) => f.kind === 'number');
  const categoryFields = fields.filter((f) => f.kind === 'category');
  const statusFields = fields.filter((f) => STATUS_KEY_RE.test(f.key));
  const geoFields = fields.filter((f) => GEO_KEY_RE.test(f.key));

  if (dateFields.length && numberFields.length) types.add('timeline');
  if (categoryFields.length && numberFields.length) types.add('comparison');
  if (numberFields.length >= 2) types.add('correlation');
  if (categoryFields.length && !numberFields.length) types.add('partition');
  if (numberFields.length === 1 && rowCount <= 8) types.add('kpi');
  if (numberFields.length >= 1 && categoryFields.length === 0 && rowCount > 12) types.add('distribution');
  if (statusFields.length) types.add('progress');
  if (geoFields.length && numberFields.length) types.add('geographic');
  if (categoryFields.some((f) => f.cardinality > 12)) types.add('hierarchical');

  const maxCategory = categoryFields.reduce((m, f) => Math.max(m, f.cardinality), 0);
  if (maxCategory > 8) types.delete('partition');

  return {
    types: [...types],
    dateFields,
    numberFields,
    categoryFields,
    statusFields,
    geoFields,
    maxCategoryCardinality: maxCategory,
  };
}

function buildInsights(classification, rowCount) {
  const insights = [];
  if (classification.types.includes('timeline')) {
    insights.push('Timeline pattern detected. Line Graph recommended.');
  }
  if (classification.maxCategoryCardinality > 8) {
    insights.push('Large category count detected. Pie Chart avoided.');
  }
  if (classification.types.includes('distribution')) {
    insights.push('Distribution pattern detected. Histogram recommended.');
  }
  if (classification.types.includes('hierarchical')) {
    insights.push('Hierarchical structure detected. Treemap recommended.');
  }
  if (classification.types.includes('correlation')) {
    insights.push('Numeric correlation detected. Scatter Plot recommended.');
  }
  if (classification.types.includes('partition') && classification.maxCategoryCardinality <= 6) {
    insights.push('Proportion pattern detected. Donut Chart recommended.');
  }
  if (rowCount <= 1 && classification.numberFields.length) {
    insights.push('Single metric detected. KPI Card recommended.');
  }
  return insights;
}

function scoreCharts(classification, rowCount) {
  const activeTypes = new Set(classification.types);
  const scores = [];

  for (const [id, meta] of Object.entries(CHART_CATALOG)) {
    const overlap = meta.types.filter((t) => activeTypes.has(t));
    if (!overlap.length && !activeTypes.has('raw')) continue;

    let score = meta.baseScore * (overlap.length ? 1 : 0.35);
    if (id === 'pie' || id === 'donut') {
      if (classification.maxCategoryCardinality > 8) score *= 0.25;
      else if (classification.maxCategoryCardinality <= 6) score *= 1.08;
    }
    if ((id === 'line' || id === 'area' || id === 'timeline') && classification.types.includes('timeline')) {
      score *= 1.05;
    }
    if (id === 'histogram' && classification.types.includes('distribution')) score *= 1.08;
    if (id === 'scatter' && classification.types.includes('correlation')) score *= 1.06;
    if (id === 'kpi' && rowCount <= 12 && classification.numberFields.length) score *= 1.1;
    if (id === 'table') score = Math.max(score, 55);

    scores.push({
      id,
      label: meta.label,
      suitability: Math.min(99, Math.round(score)),
      reasons: overlap,
    });
  }

  return scores.sort((a, b) => b.suitability - a.suitability).slice(0, 12);
}

export function analyzeDataset(rows = []) {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (!safeRows.length) {
    return {
      rowCount: 0,
      fields: [],
      classifications: ['raw'],
      recommendations: [{ id: 'table', label: 'Data Table', suitability: 90, reasons: ['raw'] }],
      insights: ['No data rows available. Add filters or choose another dataset.'],
      suggested: {
        chartType: 'table',
        categoryField: null,
        valueField: null,
        timeField: null,
      },
    };
  }

  const fields = inspectFields(safeRows);
  const classification = classifyDataset(fields, safeRows.length);
  const recommendations = scoreCharts(classification, safeRows.length);
  const insights = buildInsights(classification, safeRows.length);

  const top = recommendations[0];
  const suggested = {
    chartType: top?.id || 'table',
    categoryField: classification.categoryFields[0]?.key || classification.statusFields[0]?.key || null,
    valueField:
      classification.numberFields.find((f) => NUMERIC_AGG_RE.test(f.key))?.key ||
      classification.numberFields[0]?.key ||
      null,
    timeField: classification.dateFields[0]?.key || null,
  };

  return {
    rowCount: safeRows.length,
    fields,
    classifications: classification.types,
    recommendations,
    insights,
    suggested,
  };
}
