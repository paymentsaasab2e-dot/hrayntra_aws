import { apiGetJobVisibilityDefaults, apiSaveJobVisibilityDefaults, getTenantDbName } from './api';
import {
  DEFAULT_JOB_PUBLIC_FIELD_VISIBILITY,
  parseJobPublicFieldVisibility,
  type JobPublicFieldVisibility,
} from './jobPublicFieldVisibility';

export type JobVisibilityUserDefaults = {
  visibility: JobPublicFieldVisibility;
  showClient: boolean;
  updatedAt: string | null;
};

const STORAGE_PREFIX = 'jobPublicVisibilityUserDefaults';

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

function normalizeDefaults(raw: unknown): JobVisibilityUserDefaults {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const visibility = parseJobPublicFieldVisibility(
    source.publicFieldVisibility && typeof source.publicFieldVisibility === 'object'
      ? source.publicFieldVisibility
      : source,
  );
  const showClient =
    source.showClientNamePublicly === false || visibility.client === false ? false : true;
  visibility.client = showClient;
  const updatedAt = typeof source.updatedAt === 'string' && source.updatedAt.trim() ? source.updatedAt : null;
  return { visibility, showClient, updatedAt };
}

export function readCachedJobVisibilityUserDefaults(): JobVisibilityUserDefaults {
  if (typeof window === 'undefined') {
    return {
      visibility: { ...DEFAULT_JOB_PUBLIC_FIELD_VISIBILITY },
      showClient: true,
      updatedAt: null,
    };
  }
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey()) || 'null');
    if (!parsed) {
      return {
        visibility: { ...DEFAULT_JOB_PUBLIC_FIELD_VISIBILITY },
        showClient: true,
        updatedAt: null,
      };
    }
    return normalizeDefaults(parsed);
  } catch {
    return {
      visibility: { ...DEFAULT_JOB_PUBLIC_FIELD_VISIBILITY },
      showClient: true,
      updatedAt: null,
    };
  }
}

export function writeCachedJobVisibilityUserDefaults(defaults: JobVisibilityUserDefaults): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      storageKey(),
      JSON.stringify({
        publicFieldVisibility: defaults.visibility,
        showClientNamePublicly: defaults.showClient,
        updatedAt: defaults.updatedAt,
      }),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export function visibilityDefaultsForNewJob(): {
  publicFieldVisibility: JobPublicFieldVisibility;
  showClientNamePublicly: boolean;
} {
  const cached = readCachedJobVisibilityUserDefaults();
  return {
    publicFieldVisibility: { ...cached.visibility, client: cached.showClient },
    showClientNamePublicly: cached.showClient,
  };
}

export async function loadJobVisibilityUserDefaults(): Promise<JobVisibilityUserDefaults> {
  const cached = readCachedJobVisibilityUserDefaults();
  try {
    const res = await apiGetJobVisibilityDefaults();
    const next = normalizeDefaults(res.data);
    writeCachedJobVisibilityUserDefaults(next);
    return next;
  } catch {
    return cached;
  }
}

export async function saveJobVisibilityUserDefaults(
  visibility: JobPublicFieldVisibility,
  showClientNamePublicly: boolean,
): Promise<JobVisibilityUserDefaults> {
  const payload = {
    publicFieldVisibility: parseJobPublicFieldVisibility({ ...visibility, client: showClientNamePublicly }),
    showClientNamePublicly,
    updatedAt: new Date().toISOString(),
  };
  const optimistic = normalizeDefaults(payload);
  writeCachedJobVisibilityUserDefaults(optimistic);
  try {
    const res = await apiSaveJobVisibilityDefaults(payload);
    const saved = normalizeDefaults(res.data);
    writeCachedJobVisibilityUserDefaults(saved);
    return saved;
  } catch {
    return optimistic;
  }
}

export function jobVisibilityDefaultsEqual(
  a: JobPublicFieldVisibility,
  b: JobPublicFieldVisibility,
  showA: boolean,
  showB: boolean,
): boolean {
  if (Boolean(showA) !== Boolean(showB)) return false;
  const left = parseJobPublicFieldVisibility(a);
  const right = parseJobPublicFieldVisibility(b);
  return (Object.keys(left) as Array<keyof JobPublicFieldVisibility>).every(
    (key) => Boolean(left[key]) === Boolean(right[key]),
  );
}
