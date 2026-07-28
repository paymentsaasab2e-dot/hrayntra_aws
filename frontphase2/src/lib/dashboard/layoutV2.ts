import { buildDefaultModuleWidgets, moduleSupportsKpiCards } from './commandCenterDefaults';
import type { ModuleCommandConfig, ModuleTabKey } from './moduleCommandConfig';
import type { DashboardWidget } from './types';

export type ModuleCommandCenterLayout = {
  widgets: DashboardWidget[];
  hiddenDefaultIds: string[];
  dismissed?: boolean;
  /** Set when the user saves a custom layout — disables auto re-adding removed default KPIs. */
  customized?: boolean;
};

export type DashboardLayoutV2 = {
  version: 2;
  modules: Partial<Record<ModuleTabKey, ModuleCommandCenterLayout>>;
  /** Module tabs hidden by the user (persisted per user). */
  hiddenTabs?: ModuleTabKey[];
  /** Enterprise Smart Dashboard preferences. */
  enterprise?: {
    hiddenSections?: string[];
    compact?: boolean;
  };
  /** CRM Leads & Clients dashboard preferences. */
  crm?: {
    hiddenSections?: string[];
  };
};

const EMPTY_MODULE: ModuleCommandCenterLayout = {
  widgets: [],
  hiddenDefaultIds: [],
};

export function createEmptyLayout(): DashboardLayoutV2 {
  return { version: 2, modules: {}, hiddenTabs: [] };
}

function moduleLayoutFromLegacyWidgets(
  widgets: DashboardWidget[],
): Partial<Record<ModuleTabKey, ModuleCommandCenterLayout>> {
  const modules: Partial<Record<ModuleTabKey, ModuleCommandCenterLayout>> = {};
  for (const widget of widgets) {
    if (!widget?.id || String(widget.id).startsWith('default-')) continue;
    const mod = String(widget.module || '').trim();
    const key = mod.toLowerCase();
    const tabKey = legacyModuleNameToKey(key);
    if (!tabKey) continue;
    modules[tabKey] = {
      widgets: [widget],
      hiddenDefaultIds: [],
    };
  }
  return modules;
}

function legacyModuleNameToKey(name: string): ModuleTabKey | null {
  const map: Record<string, ModuleTabKey> = {
    leads: 'leads',
    clients: 'clients',
    jobs: 'jobs',
    candidates: 'candidates',
    interviews: 'interviews',
    placements: 'placements',
    pipeline: 'pipeline',
    matches: 'matches',
    tasks: 'tasks',
    'task and activity': 'tasks',
    team: 'team',
    departments: 'departments',
  };
  return map[name] ?? null;
}

/** Parse API/local layout (array legacy or v2 object). */
export function parseDashboardLayout(raw: unknown): DashboardLayoutV2 {
  if (Array.isArray(raw)) {
    return {
      version: 2,
      modules: moduleLayoutFromLegacyWidgets(raw as DashboardWidget[]),
    };
  }
  if (raw && typeof raw === 'object' && (raw as DashboardLayoutV2).version === 2) {
    const layout = raw as DashboardLayoutV2;
    return {
      version: 2,
      modules: layout.modules || {},
      hiddenTabs: Array.isArray(layout.hiddenTabs) ? layout.hiddenTabs : [],
      enterprise: layout.enterprise && typeof layout.enterprise === 'object' ? layout.enterprise : undefined,
      crm: layout.crm && typeof layout.crm === 'object' ? layout.crm : undefined,
    };
  }
  return createEmptyLayout();
}

export function getModuleLayout(
  layout: DashboardLayoutV2,
  moduleKey: ModuleTabKey,
): ModuleCommandCenterLayout {
  return layout.modules[moduleKey] ?? { ...EMPTY_MODULE };
}

/** Replace legacy single `kpiStrip` widget with per-metric KPI cards. */
function migrateLegacyKpiStrip(
  widgets: DashboardWidget[],
  config: ModuleCommandConfig,
  widgetModuleName: string,
): DashboardWidget[] {
  if (!widgets.some((w) => w.chartType === 'kpiStrip')) {
    return widgets.filter((w) => w.chartType !== 'kpiStrip');
  }
  const defaults = buildDefaultModuleWidgets(config, widgetModuleName);
  const defaultKpis = defaults.filter((w) => w.chartType === 'kpi');
  const rest = widgets.filter((w) => w.chartType !== 'kpiStrip');
  return [...defaultKpis, ...rest];
}

export function resolveModuleDisplayWidgets(
  moduleKey: ModuleTabKey,
  config: ModuleCommandConfig,
  widgetModuleName: string,
  moduleLayout: ModuleCommandCenterLayout,
  allowedDatasetIds?: Set<string>,
): { widgets: DashboardWidget[]; usingDefaults: boolean } {
  if (moduleLayout.dismissed) {
    return { widgets: [], usingDefaults: false };
  }
  if (moduleLayout.widgets.length > 0) {
    let widgets = migrateLegacyKpiStrip(moduleLayout.widgets, config, widgetModuleName);
    const shouldMigrateMissingKpis =
      moduleSupportsKpiCards(config) &&
      !moduleLayout.customized &&
      !widgets.some((w) => w.chartType === 'kpi');
    if (shouldMigrateMissingKpis) {
      const defaults = buildDefaultModuleWidgets(config, widgetModuleName);
      const defaultKpis = defaults.filter((w) => w.chartType === 'kpi');
      const hidden = new Set(moduleLayout.hiddenDefaultIds || []);
      const missingKpis = defaultKpis.filter((w) => !hidden.has(w.id));
      if (missingKpis.length) widgets = [...missingKpis, ...widgets];
    }
    return {
      widgets: filterWidgetsByDatasets(widgets, allowedDatasetIds),
      usingDefaults: false,
    };
  }
  const defaults = buildDefaultModuleWidgets(config, widgetModuleName);
  const visible = defaults.filter((w) => !moduleLayout.hiddenDefaultIds.includes(w.id));
  return {
    widgets: filterWidgetsByDatasets(visible, allowedDatasetIds),
    usingDefaults: visible.length > 0,
  };
}

function filterWidgetsByDatasets(widgets: DashboardWidget[], allowedDatasetIds?: Set<string>) {
  if (!allowedDatasetIds?.size) return widgets;
  return widgets.filter((widget) => {
    const ds = widgetDatasetId(widget);
    if (!ds) return true;
    return allowedDatasetIds.has(ds);
  });
}

export function isDefaultWidgetId(id: string) {
  return String(id).startsWith('default-');
}

function dedupeWidgetsById(widgets: DashboardWidget[]): DashboardWidget[] {
  const seen = new Set<string>();
  const out: DashboardWidget[] = [];
  for (const w of widgets) {
    if (seen.has(w.id)) continue;
    seen.add(w.id);
    out.push(w);
  }
  return out;
}

/** Persist session after customize: removals, custom adds, or full dismiss. */
export function buildModuleLayoutFromSession(
  moduleKey: ModuleTabKey,
  config: ModuleCommandConfig,
  widgetModuleName: string,
  sessionWidgets: DashboardWidget[],
  previousLayout?: ModuleCommandCenterLayout,
): ModuleCommandCenterLayout {
  const session = dedupeWidgetsById(sessionWidgets);
  const defaults = buildDefaultModuleWidgets(config, widgetModuleName);
  const defaultIdSet = new Set(defaults.map((d) => d.id));
  const sessionIds = new Set(session.map((w) => w.id));

  if (session.length === 0) {
    return {
      widgets: [],
      hiddenDefaultIds: defaults.map((d) => d.id),
      dismissed: true,
      customized: true,
    };
  }

  const removedDefaultIds = defaults
    .filter((d) => !sessionIds.has(d.id))
    .map((d) => d.id);

  const hiddenDefaultIds = [
    ...new Set([
      ...(previousLayout?.hiddenDefaultIds ?? []).filter((id) => defaultIdSet.has(id)),
      ...removedDefaultIds,
    ]),
  ];

  return {
    widgets: session.map((w, i) => ({
      ...w,
      id:
        w.id.startsWith('w_') || w.id.startsWith('default-')
          ? w.id
          : `w_${Date.now()}_${moduleKey}_${i}`,
      module: widgetModuleName,
    })),
    hiddenDefaultIds,
    dismissed: false,
    customized: true,
  };
}

export function serializeLayout(layout: DashboardLayoutV2): DashboardLayoutV2 {
  return {
    version: 2,
    modules: { ...layout.modules },
    hiddenTabs: [...(layout.hiddenTabs || [])],
    enterprise: layout.enterprise ? { ...layout.enterprise } : undefined,
    crm: layout.crm ? { ...layout.crm } : undefined,
  };
}

function widgetDatasetId(widget: DashboardWidget): string | null {
  const direct = String(widget.datasetId || '').trim();
  if (direct) return direct;
  const filters = widget.filters as { datasetId?: string } | undefined;
  if (filters?.datasetId) return String(filters.datasetId).trim();
  return null;
}

/** Drop widgets and modules the viewer cannot access (saved layout may outlive permission changes). */
export function filterLayoutByAllowedDatasets(
  layout: DashboardLayoutV2,
  allowedDatasetIds: Set<string>,
  permittedTabKeys: Set<ModuleTabKey>,
): DashboardLayoutV2 {
  const modules: Partial<Record<ModuleTabKey, ModuleCommandCenterLayout>> = {};
  for (const [key, mod] of Object.entries(layout.modules || {})) {
    const tabKey = key as ModuleTabKey;
    if (!permittedTabKeys.has(tabKey) || !mod) continue;
    const widgets = (mod.widgets || []).filter((widget) => {
      const ds = widgetDatasetId(widget);
      if (!ds) return true;
      return allowedDatasetIds.has(ds);
    });
    modules[tabKey] = {
      widgets,
      hiddenDefaultIds: mod.hiddenDefaultIds || [],
      dismissed: mod.dismissed,
      customized: mod.customized,
    };
  }
  const hiddenTabs = (layout.hiddenTabs || []).filter((tab) => permittedTabKeys.has(tab));
  return {
    version: 2,
    modules,
    hiddenTabs,
    enterprise: layout.enterprise ? { ...layout.enterprise } : undefined,
    crm: layout.crm ? { ...layout.crm } : undefined,
  };
}
