import { apiGetSubmitToClientVisibilityDefaults, apiSaveSubmitToClientVisibilityDefaults, getTenantDbName } from './api';
import {
  DEFAULT_SUBMIT_TO_CLIENT_FIELD_VISIBILITY,
  parseSubmitToClientFieldVisibility,
  parseSubmitToClientTableColumns,
  type SubmitToClientFieldId,
  type SubmitToClientFieldVisibility,
} from './submitToClientFieldVisibility';
import {
  mergeClientStageCatalog,
  normalizeAllowedClientStages,
} from './clientTrackerOptions';
import { CLIENT_PIPELINE_STAGE_CHOICES } from './clientReviewTypes';

export type SubmitToClientVisibilityUserDefaults = {
  visibility: SubmitToClientFieldVisibility;
  tableColumns: SubmitToClientFieldId[];
  allowedClientStages: string[];
  clientStageCatalog: string[];
  updatedAt: string | null;
};

export const SUBMIT_TO_CLIENT_VISIBILITY_DEFAULTS_CHANGED_EVENT =
  'hrayntra:submit-to-client-visibility-defaults-changed';

const STORAGE_PREFIX = 'submitToClientFieldVisibilityUserDefaults';

const DEFAULT_STAGE_NAMES = CLIENT_PIPELINE_STAGE_CHOICES.map((s) => s.name);

function defaultStages(): Pick<
  SubmitToClientVisibilityUserDefaults,
  'allowedClientStages' | 'clientStageCatalog'
> {
  return {
    allowedClientStages: [...DEFAULT_STAGE_NAMES],
    clientStageCatalog: [...DEFAULT_STAGE_NAMES],
  };
}

export function emitSubmitToClientVisibilityDefaultsChanged(
  defaults: SubmitToClientVisibilityUserDefaults,
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<SubmitToClientVisibilityUserDefaults>(SUBMIT_TO_CLIENT_VISIBILITY_DEFAULTS_CHANGED_EVENT, {
      detail: defaults,
    }),
  );
}

export function subscribeSubmitToClientVisibilityDefaultsChanged(
  listener: (defaults: SubmitToClientVisibilityUserDefaults) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<SubmitToClientVisibilityUserDefaults>).detail;
    if (detail) listener(detail);
  };
  window.addEventListener(SUBMIT_TO_CLIENT_VISIBILITY_DEFAULTS_CHANGED_EVENT, handler);
  return () => window.removeEventListener(SUBMIT_TO_CLIENT_VISIBILITY_DEFAULTS_CHANGED_EVENT, handler);
}

function currentUserId(): string {
  if (typeof window === 'undefined') return '';
  try {
    const parsed = JSON.parse(localStorage.getItem('currentUser') || '{}') as { id?: string };
    return String(parsed?.id || '').trim();
  } catch {
    return '';
  }
}

function storageKey(): string {
  const tenant = String(getTenantDbName() || '').trim();
  const userId = currentUserId();
  return `${STORAGE_PREFIX}:${tenant || 'default'}:${userId || 'anon'}`;
}

function normalizeStageDefaults(raw: Record<string, unknown>): {
  allowedClientStages: string[];
  clientStageCatalog: string[];
} {
  const catalog = mergeClientStageCatalog(
    CLIENT_PIPELINE_STAGE_CHOICES,
    raw.clientStageCatalog ?? raw.allowedClientStages ?? DEFAULT_STAGE_NAMES,
  );
  const allowed = normalizeAllowedClientStages(raw.allowedClientStages, catalog, true);
  return {
    allowedClientStages: allowed,
    clientStageCatalog: catalog.map((row) => row.name),
  };
}

function normalizeDefaults(raw: unknown): SubmitToClientVisibilityUserDefaults {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const visibility = parseSubmitToClientFieldVisibility(
    source.fieldVisibility && typeof source.fieldVisibility === 'object'
      ? source.fieldVisibility
      : source,
  );
  const stages = normalizeStageDefaults(source);
  const tableColumns = parseSubmitToClientTableColumns(source.tableColumns, visibility);
  const updatedAt = typeof source.updatedAt === 'string' && source.updatedAt.trim() ? source.updatedAt : null;
  return { visibility, tableColumns, ...stages, updatedAt };
}

export function readCachedSubmitToClientVisibilityDefaults(): SubmitToClientVisibilityUserDefaults {
  if (typeof window === 'undefined') {
    return {
      visibility: { ...DEFAULT_SUBMIT_TO_CLIENT_FIELD_VISIBILITY },
      tableColumns: parseSubmitToClientTableColumns(null, DEFAULT_SUBMIT_TO_CLIENT_FIELD_VISIBILITY),
      ...defaultStages(),
      updatedAt: null,
    };
  }
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey()) || 'null');
    if (!parsed) {
      return {
        visibility: { ...DEFAULT_SUBMIT_TO_CLIENT_FIELD_VISIBILITY },
        tableColumns: parseSubmitToClientTableColumns(null, DEFAULT_SUBMIT_TO_CLIENT_FIELD_VISIBILITY),
        ...defaultStages(),
        updatedAt: null,
      };
    }
    return normalizeDefaults(parsed);
  } catch {
    return {
      visibility: { ...DEFAULT_SUBMIT_TO_CLIENT_FIELD_VISIBILITY },
      tableColumns: parseSubmitToClientTableColumns(null, DEFAULT_SUBMIT_TO_CLIENT_FIELD_VISIBILITY),
      ...defaultStages(),
      updatedAt: null,
    };
  }
}

export function writeCachedSubmitToClientVisibilityDefaults(
  defaults: SubmitToClientVisibilityUserDefaults,
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      storageKey(),
      JSON.stringify({
        fieldVisibility: defaults.visibility,
        tableColumns: defaults.tableColumns,
        allowedClientStages: defaults.allowedClientStages,
        clientStageCatalog: defaults.clientStageCatalog,
        updatedAt: defaults.updatedAt,
      }),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export async function loadSubmitToClientVisibilityDefaults(): Promise<SubmitToClientVisibilityUserDefaults> {
  const cached = readCachedSubmitToClientVisibilityDefaults();
  try {
    const res = await apiGetSubmitToClientVisibilityDefaults();
    const next = normalizeDefaults(res.data);
    const cachedTime = Date.parse(String(cached.updatedAt || '')) || 0;
    const nextTime = Date.parse(String(next.updatedAt || '')) || 0;
    if (cached.updatedAt && cachedTime >= nextTime) {
      return cached;
    }
    writeCachedSubmitToClientVisibilityDefaults(next);
    return next;
  } catch {
    return cached;
  }
}

export function stagesDefaultsEqual(
  a: Pick<SubmitToClientVisibilityUserDefaults, 'allowedClientStages' | 'clientStageCatalog'>,
  b: Pick<SubmitToClientVisibilityUserDefaults, 'allowedClientStages' | 'clientStageCatalog'>,
): boolean {
  const norm = (list: string[]) =>
    (Array.isArray(list) ? list : [])
      .map((s) => String(s || '').trim().toLowerCase())
      .filter(Boolean)
      .join('\0');
  return (
    norm(a.allowedClientStages) === norm(b.allowedClientStages) &&
    norm(a.clientStageCatalog) === norm(b.clientStageCatalog)
  );
}

export function saveSubmitToClientVisibilityDefaultsLocal(payload: {
  visibility: SubmitToClientFieldVisibility;
  tableColumns?: SubmitToClientFieldId[];
  allowedClientStages?: string[];
  clientStageCatalog?: string[];
}): SubmitToClientVisibilityUserDefaults {
  const cached = readCachedSubmitToClientVisibilityDefaults();
  const stages = normalizeStageDefaults({
    allowedClientStages: payload.allowedClientStages ?? cached.allowedClientStages,
    clientStageCatalog: payload.clientStageCatalog ?? cached.clientStageCatalog,
  });
  const visibility = parseSubmitToClientFieldVisibility(payload.visibility);
  const next = normalizeDefaults({
    fieldVisibility: visibility,
    tableColumns: parseSubmitToClientTableColumns(
      payload.tableColumns ?? cached.tableColumns,
      visibility,
    ),
    ...stages,
    updatedAt: new Date().toISOString(),
  });
  writeCachedSubmitToClientVisibilityDefaults(next);
  emitSubmitToClientVisibilityDefaultsChanged(next);
  return next;
}

export async function saveSubmitToClientVisibilityDefaults(
  visibility: SubmitToClientFieldVisibility,
  extras?: {
    tableColumns?: SubmitToClientFieldId[];
    allowedClientStages?: string[];
    clientStageCatalog?: string[];
  },
): Promise<SubmitToClientVisibilityUserDefaults> {
  const optimistic = saveSubmitToClientVisibilityDefaultsLocal({
    visibility,
    tableColumns: extras?.tableColumns,
    allowedClientStages: extras?.allowedClientStages,
    clientStageCatalog: extras?.clientStageCatalog,
  });
  void apiSaveSubmitToClientVisibilityDefaults({
    fieldVisibility: optimistic.visibility,
    tableColumns: optimistic.tableColumns,
    allowedClientStages: optimistic.allowedClientStages,
    clientStageCatalog: optimistic.clientStageCatalog,
    updatedAt: optimistic.updatedAt,
  })
    .then((res) => {
      const server = normalizeDefaults(res.data);
      // Keep the values we just saved so a lagging/older server schema cannot
      // silently rewrite Visible / Hidden / Table back to defaults.
      const merged: SubmitToClientVisibilityUserDefaults = {
        ...optimistic,
        updatedAt: server.updatedAt || optimistic.updatedAt,
      };
      writeCachedSubmitToClientVisibilityDefaults(merged);
      emitSubmitToClientVisibilityDefaultsChanged(merged);
    })
    .catch(() => {
      /* local defaults already stored — server sync can retry next save */
    });
  return optimistic;
}
