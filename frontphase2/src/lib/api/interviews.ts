/* interviews API */
import { apiFetch } from './core';
import type { BackendInterviewKpis, BackendInterviewListItem, BackendInterviewListResponse, CreateInterviewPayload, InterviewApplicationForm, InterviewApplicationRow, InterviewApplicationStatus, StatusCatalogResponse } from './types';


export async function apiGetInterviewTypeCatalog() {
  return apiFetch<StatusCatalogResponse>('/settings/org/interview-types', { auth: true });
}

export async function apiAppendInterviewType(status: string) {
  return apiFetch<StatusCatalogResponse>('/settings/org/interview-types/append', {
    method: 'POST',
    auth: true,
    body: { status },
  });
}

export async function apiRemoveInterviewType(status: string) {
  return apiFetch<StatusCatalogResponse>('/settings/org/interview-types/remove', {
    method: 'POST',
    auth: true,
    body: { status },
  });
}

export const apiGetInterviews = async (params: {
  page?: number;
  limit?: number;
  status?: string;
  round?: string;
  mode?: string;
  interviewerId?: string;
  candidateId?: string;
  jobId?: string;
  companyId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  ids?: string;
} = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });
  return apiFetch<BackendInterviewListResponse>(`/interviews${query.toString() ? `?${query.toString()}` : ''}`, {
    auth: true,
  });
};

export const apiGetInterview = async (id: string) => {
  return apiFetch<BackendInterviewListItem>(`/interviews/${id}`, { auth: true });
};

export const apiCreateInterview = async (payload: CreateInterviewPayload) => {
  return apiFetch<BackendInterviewListItem>('/interviews', {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiUpdateInterview = async (
  id: string,
  payload: {
    candidateId?: string;
    jobId?: string;
    clientId?: string;
    round?: string;
    type?: string;
    mode?: string;
    date?: string;
    duration?: number;
    timezone?: string;
    meetingPlatform?: 'ZOOM' | 'GOOGLE_MEET' | 'MS_TEAMS' | null;
    location?: string | null;
    notes?: string | null;
    status?: string;
    panelUserIds?: string[];
    panelRoles?: Record<string, 'HR' | 'TECHNICAL' | 'CLIENT' | 'HIRING_MANAGER'>;
  }
) => {
  return apiFetch<BackendInterviewListItem>(`/interviews/${id}`, {
    method: 'PATCH',
    body: payload,
    auth: true,
  });
};

export const apiRescheduleInterview = async (
  id: string,
  payload: {
    newDate: string;
    newTime: string;
    reason: string;
    notifyCandidate: boolean;
    notifyInterviewer: boolean;
  }
) => {
  return apiFetch<BackendInterviewListItem>(`/interviews/${id}/reschedule`, {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiAcceptInterviewProposal = async (
  id: string,
  payload?: { proposedAt?: string; timezone?: string }
) => {
  return apiFetch<BackendInterviewListItem>(`/interviews/${id}/proposal/accept`, {
    method: 'POST',
    body: {
      proposedAt: payload?.proposedAt || undefined,
      timezone: payload?.timezone || undefined,
    },
    auth: true,
  });
};

export const apiRejectInterviewProposal = async (id: string, payload?: { reason?: string }) => {
  return apiFetch<BackendInterviewListItem>(`/interviews/${id}/proposal/reject`, {
    method: 'POST',
    body: { reason: payload?.reason || '' },
    auth: true,
  });
};

export const apiCancelInterview = async (
  id: string,
  payload: { reason: string; notes: string; notifyCandidate: boolean }
) => {
  return apiFetch<BackendInterviewListItem>(`/interviews/${id}/cancel`, {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiDeleteInterview = async (id: string) => {
  return apiFetch<{ message: string }>(`/interviews/${id}`, {
    method: 'DELETE',
    auth: true,
  });
};

export const apiMarkInterviewNoShow = async (id: string, payload: { reason: string; notes: string }) => {
  return apiFetch<BackendInterviewListItem>(`/interviews/${id}/no-show`, {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiSubmitInterviewFeedback = async (
  id: string,
  payload: {
    technicalScore: number;
    communicationScore: number;
    problemSolvingScore: number;
    cultureFitScore: number;
    experienceMatchScore: number;
    overallScore?: number;
    strengths?: string;
    weakness?: string;
    comments?: string;
    recommendation: 'PASS' | 'REJECT' | 'HOLD' | 'NEXT_ROUND';
    salaryFit: boolean;
    availableToJoin: string;
  }
) => {
  return apiFetch(`/interviews/${id}/feedback`, {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiGenerateInterviewFeedbackSummary = async (id: string, feedbackId: string) => {
  return apiFetch<{ summary: string }>(`/interviews/${id}/feedback/ai-summary`, {
    method: 'POST',
    body: { feedbackId },
    auth: true,
  });
};

export const apiAddInterviewPanelMember = async (
  id: string,
  payload: { userId: string; role: 'HR' | 'TECHNICAL' | 'CLIENT' | 'HIRING_MANAGER' }
) => {
  return apiFetch(`/interviews/${id}/panel`, {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiRemoveInterviewPanelMember = async (id: string, panelId: string) => {
  return apiFetch(`/interviews/${id}/panel/${panelId}`, {
    method: 'DELETE',
    auth: true,
  });
};

export const apiGetInterviewNotes = async (id: string) => {
  return apiFetch(`/interviews/${id}/notes`, {
    auth: true,
  });
};

export const apiAddInterviewNote = async (id: string, note: string) => {
  return apiFetch(`/interviews/${id}/notes`, {
    method: 'POST',
    body: { note },
    auth: true,
  });
};

export const apiDeleteInterviewNote = async (id: string, noteId: string) => {
  return apiFetch(`/interviews/${id}/notes/${noteId}`, {
    method: 'DELETE',
    auth: true,
  });
};

export const apiGetInterviewKpis = async () => {
  return apiFetch<BackendInterviewKpis>('/interviews/kpis', {
    auth: true,
  });
};

// ────────────────────────────────────────────────────────────
// Interview application forms & Phase 1 submissions
// ────────────────────────────────────────────────────────────

export const apiListInterviewForms = async () => {
  return apiFetch<InterviewApplicationForm[]>('/interview-applications/forms', { auth: true });
};

export const apiGetInterviewForm = async (id: string) => {
  return apiFetch<InterviewApplicationForm>(`/interview-applications/forms/${id}`, { auth: true });
};

export const apiCreateInterviewForm = async (payload: {
  title: string;
  description?: string;
  schema?: unknown;
}) => {
  return apiFetch<InterviewApplicationForm>('/interview-applications/forms', {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiUpdateInterviewForm = async (
  id: string,
  payload: { title?: string; description?: string; schema?: unknown },
) => {
  return apiFetch<InterviewApplicationForm>(`/interview-applications/forms/${id}`, {
    method: 'PATCH',
    body: payload,
    auth: true,
  });
};

export const apiPublishInterviewForm = async (id: string) => {
  return apiFetch<InterviewApplicationForm>(`/interview-applications/forms/${id}/publish`, {
    method: 'POST',
    auth: true,
  });
};

export const apiUnpublishInterviewForm = async (id: string) => {
  return apiFetch<InterviewApplicationForm>(`/interview-applications/forms/${id}/unpublish`, {
    method: 'POST',
    auth: true,
  });
};

export const apiArchiveInterviewForm = async (id: string) => {
  return apiFetch<InterviewApplicationForm>(`/interview-applications/forms/${id}/archive`, {
    method: 'POST',
    auth: true,
  });
};

export const apiDeleteInterviewForm = async (id: string) => {
  return apiFetch<{ deleted: boolean }>(`/interview-applications/forms/${id}`, {
    method: 'DELETE',
    auth: true,
  });
};

export const apiListInterviewApplications = async (params?: {
  formId?: string;
  status?: string;
  search?: string;
}) => {
  const query = new URLSearchParams();
  if (params?.formId) query.set('formId', params.formId);
  if (params?.status) query.set('status', params.status);
  if (params?.search) query.set('search', params.search);
  const qs = query.toString();
  return apiFetch<InterviewApplicationRow[]>(
    `/interview-applications/applications${qs ? `?${qs}` : ''}`,
    { auth: true },
  );
};

export const apiListInterviewerApplications = async (params?: { status?: string }) => {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  const qs = query.toString();
  return apiFetch<InterviewApplicationRow[]>(
    `/interview-applications/applications/interviewer${qs ? `?${qs}` : ''}`,
    { auth: true },
  );
};

export const apiGetInterviewApplication = async (id: string) => {
  return apiFetch<InterviewApplicationRow>(`/interview-applications/applications/${id}`, {
    auth: true,
  });
};

export const apiUpdateInterviewApplication = async (
  id: string,
  payload: Partial<{
    status: InterviewApplicationStatus;
    interviewNotes: string;
    rating: number;
    feedback: string;
    recommendation: string;
    assignedInterviewerIds: string[];
  }>,
) => {
  return apiFetch<InterviewApplicationRow>(`/interview-applications/applications/${id}`, {
    method: 'PATCH',
    body: payload,
    auth: true,
  });
};

// ────────────────────────────────────────────────────────────
// Placements
// ────────────────────────────────────────────────────────────
