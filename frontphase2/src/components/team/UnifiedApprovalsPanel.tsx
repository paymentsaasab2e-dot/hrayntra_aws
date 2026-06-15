'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Check,
  ClipboardList,
  Eye,
  Loader2,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import type { TeamRequest } from '../../types/team';
import {
  CROSS_DEPT_REQUESTS_UPDATED_EVENT,
  getCrossDeptAssignOptions,
  getCurrentUserRequestIdentity,
  getTeamRequestsForApproval,
  LEAD_CONVERSION_REQUESTS_UPDATED_EVENT,
  listCrossDeptRequests,
  listLeadConversionRequests,
  reviewCrossDeptRequest,
  reviewLeadConversionRequest,
  TEAM_REQUESTS_UPDATED_EVENT,
  updateTeamRequestStatus,
  type CrossDepartmentWorkRequest,
  type CrossDeptTargetDepartment,
  type LeadConversionRequest,
  type TeamRequestUserIdentity,
} from '../../lib/api/teamApi';
import {
  apiApproveTaskCompletion,
  apiGetTasks,
  apiRejectTaskCompletion,
  type BackendTask,
} from '../../lib/api';
import { PH2_TABLE_CARD_CLASS } from '../layout/Ph2ModulePageLayout';
import { usePermissions } from '../../hooks/usePermissions';
import { requestConfirm } from '../../lib/appDialog';
import {
  TeamRequestActionDrawer,
  type TeamRequestDrawerMode,
} from './TeamRequestActionDrawer';
import {
  CrossDeptRequestActionDrawer,
  type CrossDeptRequestDrawerMode,
} from './CrossDeptRequestActionDrawer';

export type ApprovalKindFilter =
  | 'all'
  | 'team'
  | 'cross-dept'
  | 'lead-conversion'
  | 'task-completion';

type ApprovalKind = 'team' | 'cross-dept' | 'lead-conversion' | 'task-completion';

type UnifiedApprovalItem = {
  key: string;
  kind: ApprovalKind;
  id: string;
  subject: string;
  description?: string;
  from?: string;
  status: string;
  priority?: string;
  createdAt: string;
  teamRequest?: TeamRequest;
  crossDeptRequest?: CrossDepartmentWorkRequest;
  leadConversion?: LeadConversionRequest;
  task?: BackendTask;
};

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

const KIND_LABELS: Record<ApprovalKind, string> = {
  team: 'Team request',
  'cross-dept': 'Cross-department',
  'lead-conversion': 'Lead conversion',
  'task-completion': 'Task completion',
};

const KIND_STYLES: Record<ApprovalKind, string> = {
  team: 'bg-indigo-50 text-indigo-700 ring-indigo-200/80',
  'cross-dept': 'bg-violet-50 text-violet-700 ring-violet-200/80',
  'lead-conversion': 'bg-amber-50 text-amber-700 ring-amber-200/80',
  'task-completion': 'bg-orange-50 text-orange-700 ring-orange-200/80',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-200/80',
  approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200/80',
  accepted: 'bg-emerald-50 text-emerald-700 ring-emerald-200/80',
  rejected: 'bg-rose-50 text-rose-700 ring-rose-200/80',
  cancelled: 'bg-slate-100 text-slate-600 ring-slate-200/80',
  forwarded: 'bg-blue-50 text-blue-700 ring-blue-200/80',
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function normalizeUserId(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function isRequestForCurrentUser(request: TeamRequest, user: TeamRequestUserIdentity) {
  const userId = normalizeUserId(user.id);
  const userEmail = normalizeEmail(user.email);
  if (userId && normalizeUserId(request.sendToId) === userId) return true;
  if (userEmail && normalizeEmail(request.sendToEmail) === userEmail) return true;
  return false;
}

function crossDeptKindLabel(request: CrossDepartmentWorkRequest) {
  if (request.workType === 'CLIENT') return 'Client handoff';
  if (request.workType === 'TASK') return 'Cross-dept task';
  return 'Cross-department';
}

function extractTasks(responseData: unknown): BackendTask[] {
  if (!responseData) return [];
  if (Array.isArray(responseData)) return responseData as BackendTask[];
  const payload = responseData as { data?: unknown; items?: unknown };
  if (Array.isArray(payload.data)) return payload.data as BackendTask[];
  if (Array.isArray(payload.items)) return payload.items as BackendTask[];
  return [];
}

function isPendingItem(item: UnifiedApprovalItem) {
  if (item.kind === 'task-completion') return item.task?.status === 'AWAITING_APPROVAL';
  return item.status === 'pending';
}

function matchesStatusFilter(item: UnifiedApprovalItem, filter: StatusFilter) {
  if (filter === 'all') return true;
  if (filter === 'pending') return isPendingItem(item);
  if (filter === 'approved') {
    return ['approved', 'accepted'].includes(item.status);
  }
  if (filter === 'rejected') return item.status === 'rejected';
  return true;
}

type Props = {
  kindFilter?: ApprovalKindFilter;
};

export function UnifiedApprovalsPanel({ kindFilter = 'all' }: Props) {
  const { hasPermission } = usePermissions();
  const canUpdateRequests = hasPermission('requests_update');
  const canUpdateTasks = hasPermission('tasks_update');
  const canUpdateLeads =
    hasPermission('leads_update') ||
    hasPermission('requests_update') ||
    hasPermission('clients_create');

  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [actingKey, setActingKey] = useState<string | null>(null);
  const [reviewNoteByKey, setReviewNoteByKey] = useState<Record<string, string>>({});
  const [currentUser, setCurrentUser] = useState<TeamRequestUserIdentity>({});

  const [teamRequests, setTeamRequests] = useState<TeamRequest[]>([]);
  const [crossDeptRequests, setCrossDeptRequests] = useState<CrossDepartmentWorkRequest[]>([]);
  const [leadConversions, setLeadConversions] = useState<LeadConversionRequest[]>([]);
  const [taskApprovals, setTaskApprovals] = useState<BackendTask[]>([]);
  const [departments, setDepartments] = useState<CrossDeptTargetDepartment[]>([]);
  const [ownDepartment, setOwnDepartment] = useState<CrossDeptTargetDepartment | null>(null);

  const [teamDrawerOpen, setTeamDrawerOpen] = useState(false);
  const [teamDrawerMode, setTeamDrawerMode] = useState<TeamRequestDrawerMode>('view');
  const [selectedTeamRequest, setSelectedTeamRequest] = useState<TeamRequest | null>(null);

  const [crossDrawerOpen, setCrossDrawerOpen] = useState(false);
  const [crossDrawerMode, setCrossDrawerMode] = useState<CrossDeptRequestDrawerMode>('view');
  const [selectedCrossRequest, setSelectedCrossRequest] = useState<CrossDepartmentWorkRequest | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    const user = getCurrentUserRequestIdentity();
    setCurrentUser(user);
    const userId = normalizeUserId(user.id);

    try {
      const [teamRes, crossDept, leads, tasksRes, assignOptions] = await Promise.all([
        getTeamRequestsForApproval({ currentUser: user }).catch(() => ({ data: [] as TeamRequest[] })),
        listCrossDeptRequests('inbox').catch(() => [] as CrossDepartmentWorkRequest[]),
        listLeadConversionRequests('inbox').catch(() => [] as LeadConversionRequest[]),
        apiGetTasks({ status: 'Awaiting Approval', limit: 200 }).catch(() => ({ data: [] })),
        getCrossDeptAssignOptions().catch(() => ({ departments: [] })),
      ]);

      const inboxTeam = (Array.isArray(teamRes.data) ? teamRes.data : []).filter((request) =>
        isRequestForCurrentUser(request, user),
      );

      const awaitingTasks = extractTasks(tasksRes.data).filter(
        (task) =>
          task.status === 'AWAITING_APPROVAL' &&
          userId &&
          normalizeUserId(task.completionApproverId) === userId,
      );

      setTeamRequests(inboxTeam);
      setCrossDeptRequests(crossDept);
      setLeadConversions(leads);
      setTaskApprovals(awaitingTasks);
      setDepartments(Array.isArray(assignOptions?.departments) ? assignOptions.departments : []);
      setOwnDepartment(assignOptions?.ownDepartment ?? null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load approvals');
      setTeamRequests([]);
      setCrossDeptRequests([]);
      setLeadConversions([]);
      setTaskApprovals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener(TEAM_REQUESTS_UPDATED_EVENT, refresh);
    window.addEventListener(CROSS_DEPT_REQUESTS_UPDATED_EVENT, refresh);
    window.addEventListener(LEAD_CONVERSION_REQUESTS_UPDATED_EVENT, refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener(TEAM_REQUESTS_UPDATED_EVENT, refresh);
      window.removeEventListener(CROSS_DEPT_REQUESTS_UPDATED_EVENT, refresh);
      window.removeEventListener(LEAD_CONVERSION_REQUESTS_UPDATED_EVENT, refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [load]);

  const membersForCrossRequest = useCallback(
    (request: CrossDepartmentWorkRequest) => {
      if (ownDepartment?.id === request.targetDepartmentId) {
        return ownDepartment.members || [];
      }
      const dept = departments.find((d) => d.id === request.targetDepartmentId);
      return dept?.members || [];
    },
    [departments, ownDepartment],
  );

  const allItems = useMemo(() => {
    const items: UnifiedApprovalItem[] = [];

    for (const request of teamRequests) {
      items.push({
        key: `team:${request.id}`,
        kind: 'team',
        id: request.id,
        subject: request.subject,
        description: request.description,
        from: request.requestedByName,
        status: request.status,
        priority: request.priority,
        createdAt: request.createdAt,
        teamRequest: request,
      });
    }

    for (const request of crossDeptRequests) {
      items.push({
        key: `cross-dept:${request.id}`,
        kind: 'cross-dept',
        id: request.id,
        subject: request.subject,
        description: request.description,
        from: request.requestedByName,
        status: request.status,
        priority: request.priority,
        createdAt: request.createdAt,
        crossDeptRequest: request,
      });
    }

    for (const request of leadConversions) {
      items.push({
        key: `lead-conversion:${request.id}`,
        kind: 'lead-conversion',
        id: request.id,
        subject: request.leadCompanyName || 'Lead conversion',
        description: request.requestNote,
        from: request.requestedByName,
        status: request.status,
        createdAt: request.createdAt,
        leadConversion: request,
      });
    }

    for (const task of taskApprovals) {
      items.push({
        key: `task-completion:${task.id}`,
        kind: 'task-completion',
        id: task.id,
        subject: task.title,
        description: task.description || undefined,
        from: task.assignedTo?.name || task.createdBy?.name,
        status: 'pending',
        priority: task.priority?.toLowerCase(),
        createdAt: task.completionRequestedAt || task.updatedAt || task.createdAt,
        task,
      });
    }

    return items.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [teamRequests, crossDeptRequests, leadConversions, taskApprovals]);

  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      if (kindFilter !== 'all' && item.kind !== kindFilter) return false;
      return matchesStatusFilter(item, statusFilter);
    });
  }, [allItems, kindFilter, statusFilter]);

  const pendingCount = useMemo(
    () => allItems.filter((item) => isPendingItem(item)).length,
    [allItems],
  );

  const openTeamDrawer = (request: TeamRequest, mode: TeamRequestDrawerMode) => {
    setSelectedTeamRequest(request);
    setTeamDrawerMode(mode);
    setTeamDrawerOpen(true);
  };

  const openCrossDrawer = (request: CrossDepartmentWorkRequest, mode: CrossDeptRequestDrawerMode) => {
    setSelectedCrossRequest(request);
    setCrossDrawerMode(mode);
    setCrossDrawerOpen(true);
  };

  const handleTeamDrawerSuccess = (updated: TeamRequest) => {
    setTeamRequests((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
    setSelectedTeamRequest(updated);
    void load();
  };

  const handleCrossDrawerSuccess = (updated: CrossDepartmentWorkRequest) => {
    setCrossDeptRequests((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
    setSelectedCrossRequest(updated);
    void load();
  };

  const handleTeamReject = async (request: TeamRequest) => {
    const note = (reviewNoteByKey[`team:${request.id}`] || '').trim();
    if (!note) {
      toast.error('Remark is required when rejecting a request');
      return;
    }
    if (!(await requestConfirm('Are you sure you want to reject this request?'))) return;

    setActingKey(`team:${request.id}`);
    try {
      await updateTeamRequestStatus(request.id, { status: 'rejected', reviewNote: note });
      toast.success('Request rejected');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reject request');
    } finally {
      setActingKey(null);
    }
  };

  const handleCrossReject = async (request: CrossDepartmentWorkRequest) => {
    const note = (reviewNoteByKey[`cross-dept:${request.id}`] || '').trim();
    if (!note) {
      toast.error('Remark is required when rejecting a request');
      return;
    }
    setActingKey(`cross-dept:${request.id}`);
    try {
      await reviewCrossDeptRequest(request.id, { action: 'reject', note });
      toast.success('Request rejected');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed');
    } finally {
      setActingKey(null);
    }
  };

  const handleLeadReview = async (request: LeadConversionRequest, action: 'accept' | 'reject') => {
    const note = (reviewNoteByKey[`lead-conversion:${request.id}`] || '').trim();
    if (action === 'reject' && !note) {
      toast.error('Remark is required when rejecting a conversion request');
      return;
    }
    setActingKey(`lead-conversion:${request.id}`);
    try {
      const result = await reviewLeadConversionRequest(request.id, {
        action,
        note: note || undefined,
      });
      toast.success(action === 'accept' ? 'Lead converted to client' : 'Conversion request rejected');
      if (action === 'accept' && result.createdClientId) {
        toast.message('Client created', {
          description: 'Open the Clients page to view the new record.',
        });
      }
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed');
    } finally {
      setActingKey(null);
    }
  };

  const handleTaskApprove = async (task: BackendTask) => {
    setActingKey(`task-completion:${task.id}`);
    try {
      await apiApproveTaskCompletion(task.id);
      toast.success('Task approved and completed');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to approve task');
    } finally {
      setActingKey(null);
    }
  };

  const handleTaskReject = async (task: BackendTask) => {
    const note = (reviewNoteByKey[`task-completion:${task.id}`] || '').trim();
    if (!note) {
      toast.error('Remark is required when rejecting task completion');
      return;
    }
    setActingKey(`task-completion:${task.id}`);
    try {
      await apiRejectTaskCompletion(task.id, note);
      toast.success('Task completion rejected');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reject task');
    } finally {
      setActingKey(null);
    }
  };

  const canActOnTeam = useCallback(
    (request: TeamRequest) =>
      request.status === 'pending' &&
      canUpdateRequests &&
      isRequestForCurrentUser(request, currentUser),
    [canUpdateRequests, currentUser],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-indigo-100/60 bg-white/70 p-12 text-sm text-slate-500">
        <Loader2 className="size-4 animate-spin text-indigo-600" />
        Loading approvals…
      </div>
    );
  }

  return (
    <>
      <div className={PH2_TABLE_CARD_CLASS}>
        <div className="flex flex-col gap-3 border-b border-indigo-100/40 bg-gradient-to-br from-white via-indigo-50/25 to-violet-50/20 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              {kindFilter === 'all' ? 'All approvals' : KIND_LABELS[kindFilter as ApprovalKind]}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Team requests, client handoffs, lead conversions, and task completions in one inbox.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {pendingCount > 0 ? (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200/80">
                {pendingCount} pending
              </span>
            ) : null}
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="rounded-lg border border-indigo-100/90 bg-white/95 px-2.5 py-1.5 text-xs font-medium text-slate-800 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <ShieldCheck className="h-7 w-7" strokeWidth={1.8} />
            </div>
            <p className="text-sm font-semibold text-slate-800">No approvals in this filter</p>
            <p className="mt-1 max-w-sm text-xs text-slate-500">
              When someone sends you a request or task for review, it will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-indigo-100/50 bg-gradient-to-r from-slate-50/95 via-indigo-50/50 to-violet-50/40 text-[9px] font-bold uppercase tracking-[0.12em] text-indigo-950/45">
                  <th className="px-4 py-3 sm:px-6">Type</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">From</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Received</th>
                  <th className="px-4 py-3 sm:pr-6">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const isActing = actingKey === item.key;
                  const noteValue = reviewNoteByKey[item.key] || '';

                  return (
                    <tr
                      key={item.key}
                      className="border-b border-slate-100/80 transition-colors even:bg-slate-50/35 hover:bg-indigo-50/45"
                    >
                      <td className="px-4 py-3.5 sm:px-6">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${KIND_STYLES[item.kind]}`}
                        >
                          {item.kind === 'cross-dept' && item.crossDeptRequest
                            ? crossDeptKindLabel(item.crossDeptRequest)
                            : KIND_LABELS[item.kind]}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-slate-900">{item.subject}</p>
                        {item.description ? (
                          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{item.description}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3.5 text-xs font-medium text-slate-700">
                        {item.from || '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ring-1 ring-inset ${STATUS_STYLES[item.status] || STATUS_STYLES.pending}`}
                        >
                          {item.kind === 'task-completion' && item.task?.status === 'AWAITING_APPROVAL'
                            ? 'pending'
                            : item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500">
                        {formatDate(item.createdAt)}
                      </td>
                      <td className="px-4 py-3.5 sm:pr-6">
                        <div className="flex flex-wrap items-center gap-2">
                          {item.kind === 'team' && item.teamRequest ? (
                            <>
                              <button
                                type="button"
                                onClick={() => openTeamDrawer(item.teamRequest!, 'view')}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                              >
                                <Eye className="size-3" />
                                Details
                              </button>
                              {canActOnTeam(item.teamRequest) ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={isActing}
                                    onClick={() => openTeamDrawer(item.teamRequest!, 'approve')}
                                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                                  >
                                    <Check className="size-3" />
                                    Approve
                                  </button>
                                  <input
                                    type="text"
                                    placeholder="Remark (required to reject)"
                                    className="min-w-[8rem] rounded-lg border border-slate-200 px-2 py-1 text-[11px]"
                                    value={noteValue}
                                    onChange={(e) =>
                                      setReviewNoteByKey((prev) => ({
                                        ...prev,
                                        [item.key]: e.target.value,
                                      }))
                                    }
                                  />
                                  <button
                                    type="button"
                                    disabled={isActing}
                                    onClick={() => void handleTeamReject(item.teamRequest!)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                                  >
                                    {isActing ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
                                    Reject
                                  </button>
                                </>
                              ) : null}
                              {canUpdateRequests &&
                              item.teamRequest.status === 'approved' &&
                              !item.teamRequest.linkedTaskId ? (
                                <button
                                  type="button"
                                  onClick={() => openTeamDrawer(item.teamRequest!, 'assign')}
                                  className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
                                >
                                  <ClipboardList className="size-3" />
                                  Assign task
                                </button>
                              ) : null}
                              {item.teamRequest.linkedTaskId ? (
                                <Link
                                  href={`/Task&Activites?taskId=${encodeURIComponent(item.teamRequest.linkedTaskId)}`}
                                  className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
                                >
                                  Open task
                                </Link>
                              ) : null}
                            </>
                          ) : null}

                          {item.kind === 'cross-dept' && item.crossDeptRequest ? (
                            <>
                              <button
                                type="button"
                                onClick={() => openCrossDrawer(item.crossDeptRequest!, 'view')}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                              >
                                <Eye className="size-3" />
                                Details
                              </button>
                              {item.crossDeptRequest.status === 'pending' &&
                              (canUpdateRequests || canUpdateTasks) ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={isActing}
                                    onClick={() => openCrossDrawer(item.crossDeptRequest!, 'accept')}
                                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                                  >
                                    <Check className="size-3" />
                                    Accept
                                  </button>
                                  <input
                                    type="text"
                                    placeholder="Remark (required to reject)"
                                    className="min-w-[8rem] rounded-lg border border-slate-200 px-2 py-1 text-[11px]"
                                    value={noteValue}
                                    onChange={(e) =>
                                      setReviewNoteByKey((prev) => ({
                                        ...prev,
                                        [item.key]: e.target.value,
                                      }))
                                    }
                                  />
                                  <button
                                    type="button"
                                    disabled={isActing}
                                    onClick={() => void handleCrossReject(item.crossDeptRequest!)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                                  >
                                    {isActing ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
                                    Reject
                                  </button>
                                </>
                              ) : null}
                              {item.crossDeptRequest.createdTaskId ? (
                                <Link
                                  href={`/Task&Activites?taskId=${encodeURIComponent(item.crossDeptRequest.createdTaskId)}`}
                                  className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
                                >
                                  Open task
                                </Link>
                              ) : item.crossDeptRequest.workType === 'CLIENT' &&
                                item.crossDeptRequest.linkedEntityId ? (
                                <Link
                                  href={`/client?clientId=${encodeURIComponent(item.crossDeptRequest.linkedEntityId)}`}
                                  className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
                                >
                                  Open client
                                </Link>
                              ) : null}
                            </>
                          ) : null}

                          {item.kind === 'lead-conversion' && item.leadConversion ? (
                            <>
                              {item.leadConversion.leadId ? (
                                <Link
                                  href={`/leads?leadId=${encodeURIComponent(item.leadConversion.leadId)}`}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                                >
                                  <Eye className="size-3" />
                                  View lead
                                </Link>
                              ) : null}
                              {item.leadConversion.status === 'pending' && canUpdateLeads ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={isActing}
                                    onClick={() => void handleLeadReview(item.leadConversion!, 'accept')}
                                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                                  >
                                    <Check className="size-3" />
                                    Approve
                                  </button>
                                  <input
                                    type="text"
                                    placeholder="Remark (required to reject)"
                                    className="min-w-[8rem] rounded-lg border border-slate-200 px-2 py-1 text-[11px]"
                                    value={noteValue}
                                    onChange={(e) =>
                                      setReviewNoteByKey((prev) => ({
                                        ...prev,
                                        [item.key]: e.target.value,
                                      }))
                                    }
                                  />
                                  <button
                                    type="button"
                                    disabled={isActing}
                                    onClick={() => void handleLeadReview(item.leadConversion!, 'reject')}
                                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                                  >
                                    {isActing ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
                                    Reject
                                  </button>
                                </>
                              ) : null}
                              {item.leadConversion.createdClientId ? (
                                <Link
                                  href={`/client?clientId=${encodeURIComponent(item.leadConversion.createdClientId)}`}
                                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
                                >
                                  Open client
                                </Link>
                              ) : null}
                            </>
                          ) : null}

                          {item.kind === 'task-completion' && item.task ? (
                            <>
                              <Link
                                href={`/Task&Activites?taskId=${encodeURIComponent(item.task.id)}`}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                              >
                                <Eye className="size-3" />
                                Open task
                              </Link>
                              {canUpdateTasks ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={isActing}
                                    onClick={() => void handleTaskApprove(item.task!)}
                                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                                  >
                                    <Check className="size-3" />
                                    Approve
                                  </button>
                                  <input
                                    type="text"
                                    placeholder="Remark (required to reject)"
                                    className="min-w-[8rem] rounded-lg border border-slate-200 px-2 py-1 text-[11px]"
                                    value={noteValue}
                                    onChange={(e) =>
                                      setReviewNoteByKey((prev) => ({
                                        ...prev,
                                        [item.key]: e.target.value,
                                      }))
                                    }
                                  />
                                  <button
                                    type="button"
                                    disabled={isActing}
                                    onClick={() => void handleTaskReject(item.task!)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                                  >
                                    {isActing ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
                                    Reject
                                  </button>
                                </>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <TeamRequestActionDrawer
        isOpen={teamDrawerOpen}
        onClose={() => {
          setTeamDrawerOpen(false);
          setSelectedTeamRequest(null);
        }}
        request={selectedTeamRequest}
        mode={teamDrawerMode}
        onSuccess={handleTeamDrawerSuccess}
      />

      <CrossDeptRequestActionDrawer
        isOpen={crossDrawerOpen}
        onClose={() => {
          setCrossDrawerOpen(false);
          setSelectedCrossRequest(null);
        }}
        request={selectedCrossRequest}
        members={selectedCrossRequest ? membersForCrossRequest(selectedCrossRequest) : []}
        mode={crossDrawerMode}
        onSuccess={handleCrossDrawerSuccess}
      />
    </>
  );
}
