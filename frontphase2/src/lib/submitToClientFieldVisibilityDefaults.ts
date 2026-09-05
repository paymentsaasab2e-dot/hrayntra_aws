import { apiGetSubmitToClientVisibilityDefaults, apiSaveSubmitToClientVisibilityDefaults, getTenantDbName } from './api';
import {
  DEFAULT_SUBMIT_TO_CLIENT_FIELD_VISIBILITY,
  parseSubmitToClientFieldVisibility,
  type SubmitToClientFieldVisibility,
} from './submitToClientFieldVisibility';

export type SubmitToClientVisibilityUserDefaults = {
  visibility: SubmitToClientFieldVisibility;
  updatedAt: string | null;
};

export const SUBMIT_TO_CLIENT_VISIBILITY_DEFAULTS_CHANGED_EVENT =
  'hrayntra:submit-to-client-visibility-defaults-changed';

const STORAGE_PREFIX = 'submitToClientFieldVisibilityUserDefaults';

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

function normalizeDefaults(raw: unknown): SubmitToClientVisibilityUserDefaults {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const visibility = parseSubmitToClientFieldVisibility(
    source.fieldVisibility && typeof source.fieldVisibility === 'object'
      ? source.fieldVisibility
      : source,
  );
  const updatedAt = typeof source.updatedAt === 'string' && source.updatedAt.trim() ? source.updatedAt : null;
  return { visibility, updatedAt };
}

export function readCachedSubmitToClientVisibilityDefaults(): SubmitToClientVisibilityUserDefaults {
  if (typeof window === 'undefined') {
    return {
      visibility: { ...DEFAULT_SUBMIT_TO_CLIENT_FIELD_VISIBILITY },
      updatedAt: null,
    };
  }
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey()) || 'null');
    if (!parsed) {
      return {
        visibility: { ...DEFAULT_SUBMIT_TO_CLIENT_FIELD_VISIBILITY },
        updatedAt: null,
      };
    }
    return normalizeDefaults(parsed);
  } catch {
    return {
      visibility: { ...DEFAULT_SUBMIT_TO_CLIENT_FIELD_VISIBILITY },
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

export function saveSubmitToClientVisibilityDefaultsLocal(
  visibility: SubmitToClientFieldVisibility,
): SubmitToClientVisibilityUserDefaults {
  const payload = {
    fieldVisibility: parseSubmitToClientFieldVisibility(visibility),
    updatedAt: new Date().toISOString(),
  };
  const optimistic = normalizeDefaults(payload);
  writeCachedSubmitToClientVisibilityDefaults(optimistic);
  emitSubmitToClientVisibilityDefaultsChanged(optimistic);
  return optimistic;
}

export async function saveSubmitToClientVisibilityDefaults(
  visibility: SubmitToClientFieldVisibility,
): Promise<SubmitToClientVisibilityUserDefaults> {
  const optimistic = saveSubmitToClientVisibilityDefaultsLocal(visibility);
  void apiSaveSubmitToClientVisibilityDefaults({
    fieldVisibility: optimistic.visibility,
    updatedAt: optimistic.updatedAt,
  })
    .then((res) => {
      writeCachedSubmitToClientVisibilityDefaults(normalizeDefaults(res.data));
    })
    .catch(() => {
      /* local defaults already stored — server sync can retry next save */
    });
  return optimistic;
}
