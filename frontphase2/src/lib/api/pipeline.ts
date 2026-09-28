/* pipeline API */
import { apiFetch } from './core';
import type { BackendMatch } from './types';


export const apiGetPipelineStages = async (jobId: string) => {
  return apiFetch<Array<{ id: string; name: string; order?: number }>>(`/pipeline/job/${jobId}`, {
    auth: true,
  });
};

export async function apiGetMatches(params: {
  jobId?: string;
  candidateId?: string;
  status?: string;
  minScore?: number;
  /** Set to `'1'` to run the 4-pass AI pipeline (Scores + persist). Omit for list-only fetch. */
  runPipeline?: string;
  /** Set to `'1'` to bypass the 24h server-side evaluation cache and re-run the pipeline. */
  refresh?: string;
  forceRefresh?: string;
  source?: 'ai' | 'manual' | 'applied';
  saved?: boolean;
  page?: number;
  limit?: number;
}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });
  const qs = query.toString();
  const path = `/matches${qs ? `?${qs}` : ''}`;
  return apiFetch<{ data: BackendMatch[]; pagination?: any }>(path, { auth: true });
}

export const apiCreateMatch = async (payload: {
  candidateId: string;
  jobId: string;
  score?: number;
  status?: string;
  notes?: string;
}) => {
  return apiFetch<BackendMatch>('/matches', {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

/** Find or create the Match row used by Submit to Client (handles applied-pool candidates). */

export const apiResolveMatchForSubmit = async (payload: {
  candidateId: string;
  jobId: string;
  score?: number;
}) => {
  return apiFetch<{ id: string }>('/matches/resolve-for-submit', {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiToggleSavedMatch = async (matchId: string, saved: boolean) => {
  return apiFetch<BackendMatch>(`/matches/${matchId}/save`, {
    method: 'POST',
    body: { saved },
    auth: true,
  });
};

export const apiSubmitMatch = async (
  matchId: string,
  payload: {
    message: string;
    notifyClient: boolean;
    /** Link-only Submit to Client preview — backend must never email the client. */
    previewOnly?: boolean;
    submissionType?: string;
    cvShareMode?: 'edited' | 'original' | 'saasa';
    resumeFileId?: string;
    toEmail?: string;
    additionalClients?: Array<{ clientId: string; toEmail?: string }>;
    batchMatchIds?: string[];
    trackerOptions?: Record<string, boolean>;
    allowedClientStages?: string[];
    clientStageCatalog?: string[];
  }
) => {
  return apiFetch<BackendMatch & { reviewUrl?: string; emailSent?: boolean; emailError?: string | null; trackerOptions?: Record<string, boolean> }>(`/matches/${matchId}/submit`, {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiRejectMatch = async (
  matchId: string,
  payload: { reason: string; notes: string }
) => {
  return apiFetch<BackendMatch>(`/matches/${matchId}/reject`, {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiBulkRejectMatches = async (payload: {
  matchIds: string[];
  reason: string;
  notes?: string;
}) => {
  return apiFetch<{ count: number; items: BackendMatch[] }>('/matches/bulk/reject', {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiBulkAddMatchesToPipeline = async (payload: {
  candidateIds: string[];
  jobId: string;
  stage: string;
  recruiterId?: string;
  notes?: string;
  priority?: string;
}) => {
  return apiFetch<{ count: number; items: any[] }>('/matches/bulk/pipeline', {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiBulkEmailMatches = async (payload: {
  matchIds: string[];
  subject: string;
  message: string;
  submissionType?: string;
}) => {
  return apiFetch<{ count: number; recipients: string[] }>('/matches/bulk/email', {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

// ────────────────────────────────────────────────────────────
// Leads
// ────────────────────────────────────────────────────────────
