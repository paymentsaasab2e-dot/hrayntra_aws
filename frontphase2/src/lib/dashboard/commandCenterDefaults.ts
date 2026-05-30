import {
  COMMAND_CENTER_CHART_IDS,
  PARTITION_FIELD_BY_DATASET,
} from './chartData';
import { commandCenterPrimaryDatasetId } from './moduleCommandConfig';
import type { KpiCardTemplate, ModuleCommandConfig } from './moduleCommandConfig';
import type { DashboardWidget } from './types';

export function kpiWidgetId(moduleKey: string, slug: string) {
  return `default-${moduleKey}-kpi-${slug}`;
}

function buildDefaultKpiWidgets(
  config: ModuleCommandConfig,
  widgetModuleName: string,
  primaryDatasetId: string,
): DashboardWidget[] {
  const cards = config.kpiCards || [];
  return cards.map((kpi, index) => ({
    id: kpiWidgetId(config.key, kpi.slug),
    datasetId: kpi.datasetId || primaryDatasetId,
    module: widgetModuleName,
    chartType: 'kpi',
    title: kpi.label,
    x: (index % 6) * 2,
    y: 0,
    w: 2,
    h: 2,
    config: {
      kpiSlug: kpi.slug,
      kpiLabel: kpi.label,
      kpiColor: kpi.color,
      clientTab: kpi.clientTab,
      kpiMetric: kpi.kpiMetric,
      metricKey: kpi.metricKey,
      filters: kpi.filters ?? { dateRange: 'all', status: 'all' },
    },
  }));
}

export function moduleSupportsKpiCards(config: ModuleCommandConfig) {
  return (config.kpiCards?.length ?? 0) > 0;
}

/** Build read-only default widgets from module config (shown until user saves a custom layout). */
export function buildDefaultModuleWidgets(
  config: ModuleCommandConfig,
  widgetModuleName: string,
): DashboardWidget[] {
  const primaryDatasetId = commandCenterPrimaryDatasetId(config);

  const kpiWidgets = moduleSupportsKpiCards(config)
    ? buildDefaultKpiWidgets(config, widgetModuleName, primaryDatasetId)
    : [];

  const chartWidgets = config.charts
    .filter(
      (slot) =>
        COMMAND_CENTER_CHART_IDS.has(slot.chartType) && slot.chartType !== 'kpi',
    )
    .map((slot, index) => {
      const partitionField = PARTITION_FIELD_BY_DATASET[slot.datasetId];
      const usePartition =
        (slot.chartType === 'pie' || slot.chartType === 'donut') && partitionField;
      return {
        id: `default-${config.key}-${slot.chartType}-${index}`,
        datasetId: slot.datasetId,
        module: widgetModuleName,
        chartType: slot.chartType,
        title: slot.title,
        x: 0,
        y: Math.floor(index / 2) * 3 + 3,
        w:
          slot.chartType === 'table' || slot.chartType === 'expandableTable' ? 12 : 6,
        h:
          slot.chartType === 'table' || slot.chartType === 'expandableTable' ? 3 : 3,
        config: {
          categoryField: usePartition ? partitionField : slot.categoryField,
          valueField: slot.valueField,
          showLegend: true,
          sort: 'desc' as const,
        },
      };
    });

  return [...kpiWidgets, ...chartWidgets];
}

export function resolveKpiForWidget(
  widget: DashboardWidget,
  moduleKpis: { label: string; value: string | number; color: string }[],
) {
  const label = widget.config?.kpiLabel || widget.title;
  const match = moduleKpis.find((k) => k.label.toLowerCase() === label.toLowerCase());
  if (match) return match;
  return {
    label,
    value: '—',
    color: widget.config?.kpiColor || 'blue',
  };
}
