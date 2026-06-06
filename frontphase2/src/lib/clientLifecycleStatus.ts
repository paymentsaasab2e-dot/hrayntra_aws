import type { Client } from '@/app/client/types';

export type ClientLifecycleBackendStatus = 'ACTIVE' | 'ON_HOLD' | 'INACTIVE';

export const DEFAULT_CLIENT_STATUS_LABELS = ['Active', 'On Hold', 'Inactive'] as const;
export const DEFAULT_CLIENT_PRIORITY_LABELS = ['High', 'Medium', 'Low'] as const;

export const CLIENT_LIFECYCLE_STATUS_OPTIONS: Array<{
  value: ClientLifecycleBackendStatus;
  label: string;
}> = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'INACTIVE', label: 'Inactive' },
];

export const clientLifecycleStatusColors: Record<ClientLifecycleBackendStatus, string> = {
  ACTIVE: 'bg-emerald-500/10 text-emerald-800 ring-1 ring-emerald-500/20',
  ON_HOLD: 'bg-amber-500/10 text-amber-900 ring-1 ring-amber-500/20',
  INACTIVE: 'bg-slate-500/10 text-slate-700 ring-1 ring-slate-400/25',
};

const CUSTOM_STATUS_COLOR = 'bg-indigo-500/10 text-indigo-800 ring-1 ring-indigo-500/20';

export function clientStatusLabelToBackend(label?: string | null): ClientLifecycleBackendStatus {
  const normalized = String(label || '').trim();
  if (normalized === 'On Hold') return 'ON_HOLD';
  if (normalized === 'Inactive') return 'INACTIVE';
  return 'ACTIVE';
}

const LEGACY_CLIENT_STATUS_ALIASES: Record<string, string> = {
  Converted: 'Active',
  converted: 'Active',
};

export function normalizeClientStatusLabel(label?: string | null): string {
  const normalized = String(label || '').trim();
  if (!normalized) return '';
  return LEGACY_CLIENT_STATUS_ALIASES[normalized] || normalized;
}

export function resolveClientStatusLabel(client: {
  leadStatus?: string | null;
  leadStatusValue?: string | null;
  stage?: string | null;
}): string {
  const explicit = normalizeClientStatusLabel(client.leadStatus || client.leadStatusValue);
  if (explicit) return explicit;
  return client.stage || 'Active';
}

export function clientStatusBadgeClass(label?: string | null): string {
  const backend = clientStatusLabelToBackend(label);
  if (
    String(label || '').trim() &&
    !DEFAULT_CLIENT_STATUS_LABELS.some(
      (option) => option.toLowerCase() === String(label || '').trim().toLowerCase(),
    )
  ) {
    return CUSTOM_STATUS_COLOR;
  }
  return clientLifecycleStatusColors[backend];
}

export function backendStatusToStage(status?: string | null): Client['stage'] {
  const normalized = String(status || '').trim().toUpperCase();
  if (normalized === 'ON_HOLD') return 'On Hold';
  if (normalized === 'INACTIVE') return 'Inactive';
  return 'Active';
}

export function stageToBackendStatus(stage?: string | null): ClientLifecycleBackendStatus {
  return clientStatusLabelToBackend(stage);
}

export function normalizeClientLifecycleStatus(
  status?: string | null,
): ClientLifecycleBackendStatus {
  const normalized = String(status || '').trim().toUpperCase();
  if (normalized === 'ON_HOLD') return 'ON_HOLD';
  if (normalized === 'INACTIVE') return 'INACTIVE';
  return 'ACTIVE';
}

export function lifecycleStatusLabel(status?: string | null): string {
  const backend = normalizeClientLifecycleStatus(status);
  return CLIENT_LIFECYCLE_STATUS_OPTIONS.find((option) => option.value === backend)?.label || 'Active';
}
