/* core-helpers API */
import { apiFetch } from './core';

export function buildSocketBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  const local =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.endsWith('.local');
  if (local) return 'http://127.0.0.1:5001';
  const fromEnv = typeof process.env.NEXT_PUBLIC_SOCKET_URL === 'string' && process.env.NEXT_PUBLIC_SOCKET_URL.trim();
  return fromEnv || 'https://api2.hryantra.com';
}

export const AI_FEATURE_COSTS_UPDATED_EVENT = 'hrayntra:ai-feature-costs-updated';

export const AI_FEATURE_COSTS_UPDATED_STORAGE_KEY = 'hrayntra:ai-feature-costs-updated-at';

/** Notify UI to refresh AI coin balance (optional known balance for instant update). */

export function notifyAiFeatureCostsUpdated(detail?: {
  updatedAt?: string;
  changed?: Array<{ id: string; name?: string; previous?: number; coins?: number }>;
}) {
  if (typeof window === 'undefined') return;
  const payload = {
    updatedAt: detail?.updatedAt || new Date().toISOString(),
    changed: detail?.changed || [],
  };
  try {
    localStorage.setItem(AI_FEATURE_COSTS_UPDATED_STORAGE_KEY, payload.updatedAt);
  } catch {
    /* ignore quota / private mode */
  }
  window.dispatchEvent(new CustomEvent(AI_FEATURE_COSTS_UPDATED_EVENT, { detail: payload }));
}

export function getCachedPhase1CommonPoolEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const raw = localStorage.getItem('orgPhase1CommonPoolEnabled');
  if (raw === null || raw === '') return true;
  return raw !== '0' && raw !== 'false';
}

export function getCachedTenantPaused(): { paused: boolean; pausedAt: string | null } {
  if (typeof window === 'undefined') return { paused: false, pausedAt: null };
  return {
    paused: localStorage.getItem('orgTenantPaused') === '1',
    pausedAt: localStorage.getItem('orgTenantPausedAt') || null,
  };
}

export const listPreScreenAssessments = async (type?: string) => {
  const qs = type ? `?type=${encodeURIComponent(type)}` : '';
  return apiFetch<unknown[]>(`/pre-screen-assessments/library${qs}`, { auth: true });
};

export const createPreScreenAssessment = async (payload: Record<string, unknown>) => {
  return apiFetch<Record<string, unknown>>('/pre-screen-assessments/library', {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const generatePreScreenAssessmentsWithAi = async (payload: {
  jobTitle: string;
  skills?: string[];
  jobDescription?: string;
}) => {
  return apiFetch<{
    mcq: Record<string, unknown>;
    coding: Record<string, unknown>;
    questionCount?: number;
    codingTestCaseCount?: number;
  }>('/pre-screen-assessments/library/generate', {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const generateMcqPreScreenAssessmentWithAi = async (payload: {
  jobTitle: string;
  skills?: string[];
  jobDescription?: string;
}) => {
  return apiFetch<{
    title: string;
    type: 'MCQ';
    durationMinutes: number;
    passScorePercent: number;
    config: { questions: unknown[]; antiCheat?: unknown };
  }>('/pre-screen-assessments/library/generate', {
    method: 'POST',
    body: { ...payload, type: 'MCQ' },
    auth: true,
  });
};

export const generateCodingPreScreenAssessmentWithAi = async (payload: {
  jobTitle: string;
  skills?: string[];
  jobDescription?: string;
}) => {
  return apiFetch<{
    title: string;
    type: 'CODING';
    durationMinutes: number;
    passScorePercent: number;
    config: { questions?: unknown[]; language?: string; antiCheat?: unknown };
  }>('/pre-screen-assessments/library/generate', {
    method: 'POST',
    body: { ...payload, type: 'CODING' },
    auth: true,
  });
};

export const updatePreScreenAssessment = async (id: string, payload: Record<string, unknown>) => {
  return apiFetch<Record<string, unknown>>(`/pre-screen-assessments/library/${id}`, {
    method: 'PATCH',
    body: payload,
    auth: true,
  });
};

export const deletePreScreenAssessment = async (id: string) => {
  return apiFetch<unknown>(`/pre-screen-assessments/library/${id}`, {
    method: 'DELETE',
    auth: true,
  });
};

export const getApplicationAssessmentResults = async (applicationId: string) => {
  return apiFetch<unknown[]>(`/pre-screen-assessments/applications/${applicationId}/results`, {
    auth: true,
  });
};

export const NOTIFICATIONS_UPDATED_EVENT = 'frontphase2:notifications-updated';

export function emitNotificationsUpdated() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
}
