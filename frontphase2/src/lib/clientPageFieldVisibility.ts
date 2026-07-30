export type ClientPageFieldVisibility = {
  interestLevel: boolean;
  status: boolean;
  assignedTo: boolean;
};

export const DEFAULT_CLIENT_PAGE_FIELD_VISIBILITY: ClientPageFieldVisibility = {
  interestLevel: false,
  status: false,
  assignedTo: false,
};

/** HQ Clients always shows the optional CRM fields regardless of org settings. */
export const HQ_CLIENT_PAGE_FIELD_VISIBILITY: ClientPageFieldVisibility = {
  interestLevel: true,
  status: true,
  assignedTo: true,
};

const STORAGE_KEY = 'orgClientPageFieldVisibility';

export function normalizeClientPageFieldVisibility(raw: unknown): ClientPageFieldVisibility {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_CLIENT_PAGE_FIELD_VISIBILITY };
  }
  const o = raw as Record<string, unknown>;
  return {
    interestLevel: o.interestLevel === true,
    status: o.status === true,
    assignedTo: o.assignedTo === true,
  };
}

export function getCachedClientPageFieldVisibility(): ClientPageFieldVisibility {
  if (typeof window === 'undefined') return { ...DEFAULT_CLIENT_PAGE_FIELD_VISIBILITY };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CLIENT_PAGE_FIELD_VISIBILITY };
    return normalizeClientPageFieldVisibility(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_CLIENT_PAGE_FIELD_VISIBILITY };
  }
}

export function cacheClientPageFieldVisibility(visibility: ClientPageFieldVisibility): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(visibility));
}
