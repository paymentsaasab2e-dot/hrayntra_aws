import { apiFetch } from '../api';

export type MemberAuditOverviewItem = {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  status?: string | null;
  roleName?: string | null;
  lastLogin?: string | null;
  eventCount: number;
  loginCount: number;
  crmActionCount: number;
  teamActionCount: number;
  lastActivityAt: string | null;
};

export type MemberAuditTimelineItem = {
  id: string;
  source: 'crm' | 'team' | 'auth';
  kind: string;
  title: string;
  description?: string;
  module?: string;
  entityType?: string;
  entityId?: string;
  relatedLabel?: string;
  category?: string;
  ipAddress?: string;
  device?: string;
  outcome?: string;
  at: string;
};

export type MemberAuditOverviewResponse = {
  date: string;
  range: { from: string; to: string };
  members: MemberAuditOverviewItem[];
};

export type MemberAuditTimelineResponse = {
  date: string;
  range: { from: string; to: string };
  member: {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
    status?: string | null;
    roleName?: string | null;
  };
  summary: {
    total: number;
    logins: number;
    loginFailures: number;
    logouts: number;
    crm: number;
    team: number;
  };
  items: MemberAuditTimelineItem[];
  groups: { label: string; items: MemberAuditTimelineItem[] }[];
};

function buildQs(params: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v) q.set(k, v);
  });
  const s = q.toString();
  return s ? `?${s}` : '';
}

export async function apiGetMemberAuditOverview(params: { date?: string; search?: string }) {
  const qs = buildQs({ date: params.date, search: params.search });
  return apiFetch<MemberAuditOverviewResponse>(`/audit/team-members${qs}`, { auth: true });
}

export async function apiGetMemberAuditTimeline(
  userId: string,
  params: { date?: string; from?: string; to?: string }
) {
  const qs = buildQs({ date: params.date, from: params.from, to: params.to });
  return apiFetch<MemberAuditTimelineResponse>(`/audit/team-members/${userId}/timeline${qs}`, {
    auth: true,
  });
}
