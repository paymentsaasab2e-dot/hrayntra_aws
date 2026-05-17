export type ChartTypeId =
  | 'line'
  | 'area'
  | 'timeline'
  | 'bar'
  | 'horizontalBar'
  | 'groupedBar'
  | 'histogram'
  | 'pie'
  | 'donut'
  | 'treemap'
  | 'scatter'
  | 'bubble'
  | 'heatmap'
  | 'kpi'
  | 'counter'
  | 'gauge'
  | 'progressBar'
  | 'funnel'
  | 'table';

export type DashboardFilterDef = {
  key: string;
  label: string;
  type: 'select';
  options: { value: string; label: string }[];
  defaultValue?: string;
};

export type DashboardDatasetMeta = {
  id: string;
  label: string;
  module: string;
  description: string;
  kind: 'list' | 'metrics';
  filters?: DashboardFilterDef[];
};

export type DashboardModuleGroup = {
  name: string;
  datasets: DashboardDatasetMeta[];
};

export type FieldInsight = {
  key: string;
  kind: 'date' | 'number' | 'category' | 'text';
  cardinality: number;
};

export type ChartRecommendation = {
  id: string;
  label: string;
  suitability: number;
  reasons: string[];
};

export type DatasetAnalysis = {
  rowCount: number;
  fields: FieldInsight[];
  classifications: string[];
  recommendations: ChartRecommendation[];
  insights: string[];
  suggested: {
    chartType: string;
    categoryField: string | null;
    valueField: string | null;
    timeField: string | null;
  };
};

export type WidgetFilters = Record<string, string>;

export type WidgetConfig = {
  categoryField?: string;
  valueField?: string;
  timeField?: string;
  aggregation?: 'sum' | 'count' | 'avg';
  dateRange?: string;
  sort?: 'asc' | 'desc';
  showLegend?: boolean;
  filters?: WidgetFilters;
};

export type DashboardWidget = {
  id: string;
  datasetId: string;
  /** Module section name, e.g. Leads, Clients */
  module?: string;
  chartType: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  config?: WidgetConfig;
};

export type DatasetPayload = {
  dataset: { id: string; label: string; module: string };
  rows: Record<string, unknown>[];
  rowCount: number;
  filters?: DashboardFilterDef[];
  appliedFilters?: WidgetFilters;
  analysis: DatasetAnalysis;
};

export type DashboardCatalog = {
  datasets: DashboardDatasetMeta[];
  modules: DashboardModuleGroup[];
};
