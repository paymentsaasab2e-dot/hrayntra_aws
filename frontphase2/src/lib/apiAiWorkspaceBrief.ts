import { apiFetch } from './api';

export type AiWorkspaceBriefAlert = {
  title: string;
  detail?: string;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
  area?: string;
  actionPath?: string;
  alertCode?: string;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
};

export type AiWorkspaceBriefRecommendation = {
  title: string;
  detail?: string;
  dueInDays?: number | null;
};

export type AiWorkspaceBrief = {
  id: string;
  userId?: string | null;
  scope?: 'personal' | 'tenant' | string;
  headline: string;
  summary: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  alerts: AiWorkspaceBriefAlert[];
  recommendations: AiWorkspaceBriefRecommendation[];
  signalCounts?: Record<string, number>;
  trigger?: string;
  emailSent?: boolean;
  createdAt?: string | null;
};

export async function apiGetWorkspaceBrief() {
  return apiFetch<{ brief: AiWorkspaceBrief | null; configured: boolean }>('/ai/workspace-brief', {
    auth: true,
  });
}

export async function apiGenerateWorkspaceBrief(options?: { force?: boolean; sendEmail?: boolean }) {
  return apiFetch<{ brief: AiWorkspaceBrief }>('/ai/workspace-brief/generate', {
    method: 'POST',
    body: options || {},
    auth: true,
  });
}

export type AiWorkspaceBriefEntityType =
  | 'CLIENT'
  | 'LEAD'
  | 'TASK'
  | 'JOB'
  | 'CANDIDATE'
  | 'INTERVIEW'
  | 'PLACEMENT'
  | 'USER'
  | 'DEPARTMENT';

export async function apiGetWorkspaceBriefEntityAlerts(
  entityType: AiWorkspaceBriefEntityType,
  entityId: string,
) {
  const params = new URLSearchParams({ entityType, entityId });
  return apiFetch<{ alerts: AiWorkspaceBriefAlert[]; configured: boolean }>(
    `/ai/workspace-brief/alerts?${params.toString()}`,
    { auth: true },
  );
}

export async function apiGetWorkspaceBriefEntityAlertsBatch(
  entityType: AiWorkspaceBriefEntityType,
  entityIds: string[],
) {
  const ids = entityIds.filter(Boolean).slice(0, 100);
  if (!ids.length) {
    return { data: { alertsByEntityId: {} as Record<string, AiWorkspaceBriefAlert[]>, configured: false } };
  }
  const params = new URLSearchParams({ entityType, entityIds: ids.join(',') });
  return apiFetch<{ alertsByEntityId: Record<string, AiWorkspaceBriefAlert[]>; configured: boolean }>(
    `/ai/workspace-brief/entity-alerts?${params.toString()}`,
    { auth: true },
  );
}

export const WORKSPACE_BRIEF_UPDATED_EVENT = 'hrayntra:workspace-brief-updated';
