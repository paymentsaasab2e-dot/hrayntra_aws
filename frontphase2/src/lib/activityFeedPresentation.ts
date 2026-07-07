import type { BackendGlobalActivity } from './api';

export type ActivityDisplayKind = 'create' | 'update' | 'delete' | 'info';

export type PresentedActivity = BackendGlobalActivity & {
  displaySummary?: string | null;
  displayKind?: ActivityDisplayKind | string | null;
};

const MODULE_LABELS: Record<string, string> = {
  GENERAL: 'General',
  JOBS: 'Jobs',
  CANDIDATES: 'Candidates',
  INTERVIEWS: 'Interviews',
  BILLING: 'Billing',
  NOTES: 'Notes',
  FILES: 'Files',
  CONTACTS: 'Contacts',
  PLACEMENTS: 'Placements',
  TEAM: 'Team',
  SYSTEM: 'System',
  REQUEST: 'Requests',
  CLIENT: 'Clients',
  JOB: 'Jobs',
  CANDIDATE: 'Candidates',
  LEAD: 'Leads',
  INTERVIEW: 'Interviews',
  PLACEMENT: 'Placements',
  TASK: 'Tasks',
  CONTACT: 'Contacts',
  USER: 'Team',
};

const KIND_LABELS: Record<ActivityDisplayKind, string> = {
  create: 'Added',
  update: 'Changed',
  delete: 'Removed',
  info: 'Activity',
};

function cleanupDescription(text: string): string {
  let output = text.trim();
  if (!output) return '—';

  output = output
    .replace(/"\[object Object\]"/g, '"structured data"')
    .replace(/\[object Object\]/g, 'structured data')
    .replace(/\s+changed from "N\/A" to ""/gi, ' was cleared')
    .replace(/\s+changed from "" to ""/gi, ' was updated')
    .replace(/changed from "([^"]+)" to "\1"/gi, 'updated (no visible change)');

  if (!/[.!?]$/.test(output)) output += '.';
  return output;
}

export function formatActivityModule(row: BackendGlobalActivity): string {
  const key = String(row.category || row.entityType || '').trim().toUpperCase();
  return MODULE_LABELS[key] || row.category || row.entityType || 'General';
}

export function resolveActivityKind(row: PresentedActivity): ActivityDisplayKind {
  const raw = String(row.displayKind || '').toLowerCase();
  if (raw === 'create' || raw === 'update' || raw === 'delete' || raw === 'info') {
    return raw;
  }
  const action = String(row.action || '').toLowerCase();
  if (/created|added|applied|sent|scheduled|converted|approved|restored|tag added|joined/i.test(action)) {
    return 'create';
  }
  if (/deleted|removed|rejected|cancelled|recycle|soft-deleted|no show/i.test(action)) {
    return 'delete';
  }
  if (/moved|pipeline|assigned|delegated|changed|updated|field|status|role|rescheduled/i.test(action)) {
    return 'update';
  }
  return 'info';
}

export function formatActivitySummary(row: PresentedActivity): string {
  const fromApi = String(row.displaySummary || '').trim();
  if (fromApi) return fromApi;
  const raw = row.description || row.relatedLabel || row.action || '';
  if (!raw) return 'Activity recorded.';
  return cleanupDescription(String(raw));
}

export function formatActivityAction(row: BackendGlobalActivity): string {
  const action = String(row.action || '').trim();
  if (!action) return '—';
  if (/^field updated$/i.test(action)) return 'Updated';
  return action;
}

export function formatActivityDetails(row: BackendGlobalActivity): string {
  return formatActivitySummary(row as PresentedActivity);
}

export function formatActivityKindLabel(row: PresentedActivity): string {
  return KIND_LABELS[resolveActivityKind(row)];
}

export function activityModuleTone(module: string): string {
  switch (module) {
    case 'Candidates':
      return 'bg-sky-50 text-sky-700 ring-sky-100';
    case 'Jobs':
      return 'bg-amber-50 text-amber-700 ring-amber-100';
    case 'Team':
      return 'bg-violet-50 text-violet-700 ring-violet-100';
    case 'Requests':
      return 'bg-rose-50 text-rose-700 ring-rose-100';
    case 'Leads':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
    case 'Interviews':
      return 'bg-indigo-50 text-indigo-700 ring-indigo-100';
    default:
      return 'bg-slate-50 text-slate-600 ring-slate-100';
  }
}

export function activityKindTone(kind: ActivityDisplayKind): string {
  switch (kind) {
    case 'create':
      return 'bg-emerald-100 text-emerald-700';
    case 'update':
      return 'bg-amber-100 text-amber-700';
    case 'delete':
      return 'bg-rose-100 text-rose-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

export function buildActivityHeadline(
  row: PresentedActivity,
  performer: string,
  options?: { showPerformer?: boolean }
): string {
  const summary = formatActivitySummary(row);
  if (options?.showPerformer && performer && performer !== '—') {
    return `${performer} — ${summary}`;
  }
  return summary;
}
