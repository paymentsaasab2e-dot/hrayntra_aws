export const DEFAULT_JOB_STATUS_OPTIONS = [
  'Active',
  'On Hold',
  'Closed',
  'Closed Won',
  'Closed not Won',
  'Duplicate',
  'Draft',
] as const;

/** Core statuses that cannot be deleted from the tenant catalog. */
export const PROTECTED_JOB_STATUS_OPTIONS = ['Active', 'On Hold', 'Closed'] as const;

export type DefaultJobStatus = (typeof DEFAULT_JOB_STATUS_OPTIONS)[number];

const PROTECTED_JOB_STATUS_SET = new Set(
  PROTECTED_JOB_STATUS_OPTIONS.map((status) => status.toLowerCase()),
);

export function normalizeJobStatusLabel(raw: string | null | undefined): string {
  return String(raw || '')
    .trim()
    .replace(/\s+/g, ' ');
}

/** True when the status cannot be removed from the org catalog. */
export function isProtectedJobStatus(status: string): boolean {
  return PROTECTED_JOB_STATUS_SET.has(normalizeJobStatusLabel(status).toLowerCase());
}

/** @deprecated Use isProtectedJobStatus — only core statuses are locked. */
export function isDefaultJobStatus(status: string): boolean {
  return isProtectedJobStatus(status);
}

export function mergeJobStatusOptions(
  catalog: string[] | null | undefined,
  current?: string | string[] | null,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (value: string | null | undefined) => {
    const label = normalizeJobStatusLabel(value);
    if (!label) return;
    // Drop legacy Filled from catalogs / current job values when merging UI options
    if (label.toLowerCase() === 'filled') return;
    const key = label.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(label);
  };

  // Prefer API catalog when present so tenant deletions stick.
  const base =
    Array.isArray(catalog) && catalog.length > 0
      ? catalog
      : [...DEFAULT_JOB_STATUS_OPTIONS];
  base.forEach(push);
  if (Array.isArray(current)) {
    current.forEach(push);
  } else {
    push(current);
  }
  return out;
}

/** Map CRM label → Prisma JobStatus enum. */
export function mapJobStatusLabelToBackend(
  status: string,
): 'DRAFT' | 'OPEN' | 'ON_HOLD' | 'CLOSED' | 'FILLED' {
  const key = normalizeJobStatusLabel(status)
    .toLowerCase()
    .replace(/[_-]+/g, ' ');
  switch (key) {
    case 'draft':
      return 'DRAFT';
    case 'active':
    case 'open':
    case 'published':
      return 'OPEN';
    case 'on hold':
    case 'hold':
    case 'paused':
      return 'ON_HOLD';
    case 'closed':
    case 'close':
    case 'closed not won':
    case 'duplicate':
      return 'CLOSED';
    case 'closed won':
    case 'filled':
    case 'hired':
      return 'FILLED';
    default:
      return 'OPEN';
  }
}

/** Prefer stored statusLabel; fall back to enum mapping. */
export function displayJobStatusFromBackend(
  backendStatus: string | null | undefined,
  statusLabel?: string | null,
): string {
  const label = normalizeJobStatusLabel(statusLabel);
  if (label) {
    if (label.toLowerCase() === 'filled') return 'Closed Won';
    return label;
  }
  switch (String(backendStatus || '').toUpperCase()) {
    case 'OPEN':
    case 'PUBLISHED':
      return 'Active';
    case 'ON_HOLD':
      return 'On Hold';
    case 'CLOSED':
      return 'Closed';
    case 'FILLED':
      return 'Closed Won';
    case 'DRAFT':
      return 'Draft';
    default:
      return 'Active';
  }
}

export function jobStatusPillClass(status: string): string {
  const key = normalizeJobStatusLabel(status).toLowerCase();
  if (key === 'active' || key === 'open' || key === 'published') {
    return 'bg-green-100 text-green-700 border-green-200';
  }
  if (key === 'on hold' || key === 'hold' || key === 'paused') {
    return 'bg-amber-100 text-amber-700 border-amber-200';
  }
  if (key === 'closed' || key === 'close' || key === 'closed not won') {
    return 'bg-gray-100 text-gray-700 border-gray-200';
  }
  if (key === 'closed won' || key === 'filled' || key === 'hired') {
    return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  }
  if (key === 'duplicate') {
    return 'bg-rose-50 text-rose-700 border-rose-200';
  }
  if (key === 'draft') {
    return 'bg-slate-100 text-slate-700 border-slate-200';
  }
  return 'bg-indigo-50 text-indigo-700 border-indigo-200';
}

/**
 * Outcomes that leave the main Jobs working list (Closed Won / Closed not Won / Closed / Duplicate).
 * Still available via the status filter (Closed / Closed Won).
 */
export function isArchivedFromJobsList(status: string | null | undefined): boolean {
  const key = normalizeJobStatusLabel(status).toLowerCase();
  return (
    key === 'closed' ||
    key === 'close' ||
    key === 'closed won' ||
    key === 'closed not won' ||
    key === 'duplicate' ||
    key === 'filled' ||
    key === 'hired'
  );
}

export function isDraftJobStatus(status: string | null | undefined): boolean {
  const key = normalizeJobStatusLabel(status).toLowerCase();
  return key === 'draft' || key === 'DRAFT'.toLowerCase();
}

/** Once a job has left Draft (e.g. Active), Draft must not be selectable again. */
export function canRevertJobToDraft(currentStatus: string | null | undefined): boolean {
  return isDraftJobStatus(currentStatus);
}

/** Drop Draft from the menu when the job is already Active / On Hold / Closed / etc. */
export function filterJobStatusOptionsForCurrent(
  options: string[],
  currentStatus: string | null | undefined,
): string[] {
  const list = Array.isArray(options) ? options : [];
  if (canRevertJobToDraft(currentStatus)) return list;
  return list.filter((status) => !isDraftJobStatus(status));
}

