import { apiFetch } from './api';

export type AiEntryEntityType =
  | 'LEAD'
  | 'CLIENT'
  | 'CANDIDATE'
  | 'JOB'
  | 'TASK'
  | 'PLACEMENT'
  | 'INTERVIEW';

export type AiEntryRecommendationAction = {
  title: string;
  detail?: string;
  dueInDays?: number | null;
};

export type AiEntryRecommendation = {
  id: string;
  entityType: AiEntryEntityType;
  entityId: string;
  entityLabel?: string;
  summary: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  tags: string[];
  actions: AiEntryRecommendationAction[];
  trigger?: string;
  emailSent?: boolean;
  createdAt?: string | null;
};

export async function apiGetEntryRecommendations(entityType: AiEntryEntityType, entityId: string) {
  const params = new URLSearchParams({ entityType, entityId });
  return apiFetch<{ recommendations: AiEntryRecommendation[]; configured: boolean }>(
    `/ai/entry-recommendations?${params.toString()}`,
    { auth: true },
  );
}

export async function apiRegenerateEntryRecommendation(body: {
  entityType: AiEntryEntityType;
  entityId: string;
  entityLabel?: string;
  trigger?: string;
  snapshot?: Record<string, unknown>;
}) {
  return apiFetch<{ recommendation: AiEntryRecommendation }>('/ai/entry-recommendations/regenerate', {
    method: 'POST',
    body,
    auth: true,
  });
}
