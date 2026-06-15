'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, ClipboardList, Eye, Loader2, ShieldCheck, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  deleteTeamRequest,
  getTeamRequestsForApproval,
  getCurrentUserRequestIdentity,
  updateTeamRequestStatus,
  TEAM_REQUESTS_UPDATED_EVENT,
  type TeamRequestUserIdentity,
} from '../../lib/api/teamApi';
import type { TeamRequest, TeamRequestStatus } from '../../types/team';
import { PH2_TABLE_CARD_CLASS } from '../layout/Ph2ModulePageLayout';
import { usePermissions } from '../../hooks/usePermissions';
import { requestConfirm } from '../../lib/appDialog';
import {
  TeamRequestActionDrawer,
  type TeamRequestDrawerMode,
} from './TeamRequestActionDrawer';

const STATUS_STYLES: Record<TeamRequestStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-200/80',
  approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200/80',
  rejected: 'bg-rose-50 text-rose-700 ring-rose-200/80',
  cancelled: 'bg-slate-100 text-slate-600 ring-slate-200/80',
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

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

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

export function RequestApprovalsPanel() {
  const { hasPermission } = usePermissions();
  const canUpdate = hasPermission('requests_update');
  const canDelete = hasPermission('requests_delete');
  const [requests, setRequests] = useState<TeamRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [actingId, setActingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reviewNoteById, setReviewNoteById] = useState<Record<string, string>>({});
  const [currentUser, setCurrentUser] = useState<TeamRequestUserIdentity>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<TeamRequestDrawerMode>('view');
  const [selectedRequest, setSelectedRequest] = useState<TeamRequest | null>(null);

  useEffect(() => {
    setCurrentUser(getCurrentUserRequestIdentity());
  }, []);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    const user = getCurrentUserRequestIdentity();
    setCurrentUser(user);
    try {
      const res = await getTeamRequestsForApproval({
        currentUser: user,
      });
      const inboxOnly = (Array.isArray(res.data) ? res.data : []).filter((request) =>
        isRequestForCurrentUser(request, user),
      );
      setRequests(inboxOnly);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load approval queue');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    const refresh = () => void loadRequests();
    window.addEventListener(TEAM_REQUESTS_UPDATED_EVENT, refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener(TEAM_REQUESTS_UPDATED_EVENT, refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [loadRequests]);

  const filteredRequests = useMemo(() => {
    if (statusFilter === 'all') return requests;
    return requests.filter((request) => request.status === statusFilter);
  }, [requests, statusFilter]);

  const pendingCount = useMemo(
    () => requests.filter((request) => request.status === 'pending').length,
    [requests],
  );

  const canActOnRequest = useCallback(
    (request: TeamRequest) => {
      if (request.status !== 'pending') return false;
      if (!canUpdate) return false;
      return isRequestForCurrentUser(request, currentUser);
    },
    [canUpdate, currentUser],
  );

  const canDeleteRequest = useCallback(
    (request: TeamRequest) => {
      if (!canDelete) return false;
      return isRequestForCurrentUser(request, currentUser);
    },
    [canDelete, currentUser],
  );

  const openDrawer = (request: TeamRequest, mode: TeamRequestDrawerMode) => {
    setSelectedRequest(request);
    setDrawerMode(mode);
    setDrawerOpen(true);
  };

  const handleDrawerSuccess = (updated: TeamRequest) => {
    setRequests((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
    setSelectedRequest(updated);
  };

  const handleReject = async (request: TeamRequest) => {
    const note = (reviewNoteById[request.id] || '').trim();
    if (!note) {
      toast.error('Remark is required when rejecting a request');
      return;
    }
    if (!(await requestConfirm('Are you sure you want to reject this request?'))) {
      return;
    }

    setActingId(request.id);
    try {
      const res = await updateTeamRequestStatus(request.id, { status: 'rejected', reviewNote: note });
      setRequests((prev) =>
        prev.map((entry) => (entry.id === request.id ? res.data : entry)),
      );
      toast.success('Request rejected');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reject request');
    } finally {
      setActingId(null);
    }
  };

  const handleDelete = async (request: TeamRequest) => {
    if (!(await requestConfirm(`Delete request "${request.subject}"? This cannot be undone.`))) {
      return;
    }

    setDeletingId(request.id);
    try {
      await deleteTeamRequest(request.id);
      setRequests((prev) => prev.filter((entry) => entry.id !== request.id));
      toast.success('Request deleted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete request');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-indigo-100/60 bg-white/70 p-12 text-sm text-slate-500">
        <Loader2 className="size-4 animate-spin text-indigo-600" />
        Loading approval queue…
      </div>
    );
  }

  return (
    <>
      <div className={PH2_TABLE_CARD_CLASS}>
        <div className="flex flex-col gap-3 border-b border-indigo-100/40 bg-gradient-to-br from-white via-indigo-50/25 to-violet-50/20 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Approval Queue</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Approve hiring requests, assign a tracked task with due date, and optionally verify completion yourself.
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

        {filteredRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <ShieldCheck className="h-7 w-7" strokeWidth={1.8} />
            </div>
            <p className="text-sm font-semibold text-slate-800">No requests in this queue</p>
            <p className="mt-1 max-w-sm text-xs text-slate-500">
              When someone sends a request to you, it will appear here for approval.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-indigo-100/50 bg-gradient-to-r from-slate-50/95 via-indigo-50/50 to-violet-50/40 text-[9px] font-bold uppercase tracking-[0.12em] text-indigo-950/45">
                  <th className="px-4 py-3 sm:px-6">Subject</th>
                  <th className="px-4 py-3">From</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Received</th>
                  <th className="px-4 py-3 sm:pr-6">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((request) => {
                  const canAct = canActOnRequest(request);
                  const canRemove = canDeleteRequest(request);
                  const isActing = actingId === request.id;
                  const isDeleting = deletingId === request.id;
                  const showAssignTask =
                    canUpdate &&
                    request.status === 'approved' &&
                    !request.linkedTaskId;
                  const showViewTask = Boolean(request.linkedTaskId);
                  const showViewJob = Boolean(request.linkedJobId);

                  return (
                    <tr
                      key={request.id}
                      className="border-b border-slate-100/80 transition-colors even:bg-slate-50/35 hover:bg-indigo-50/45"
                    >
                      <td className="px-4 py-3.5 sm:px-6">
                        <button
                          type="button"
                          onClick={() => openDrawer(request, 'view')}
                          className="text-left hover:text-indigo-700"
                        >
                          <p className="font-medium text-slate-900">{request.subject}</p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                            {request.description}
                          </p>
                        </button>
                      </td>
                      <td className="px-4 py-3.5 text-xs font-medium text-slate-700">
                        {request.requestedByName || '—'}
                      </td>
                      <td className="px-4 py-3.5 text-xs capitalize text-slate-600">
                        {request.priority}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ring-1 ring-inset ${STATUS_STYLES[request.status]}`}
                        >
                          {request.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500">
                        {formatDate(request.createdAt)}
                      </td>
                      <td className="px-4 py-3.5 sm:pr-6">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openDrawer(request, 'view')}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                          >
                            <Eye className="size-3" strokeWidth={2.25} />
                            Details
                          </button>
                          {canAct ? (
                            <>
                              <button
                                type="button"
                                disabled={isActing || isDeleting}
                                onClick={() => openDrawer(request, 'approve')}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                              >
                                <Check className="size-3" strokeWidth={2.5} />
                                Approve
                              </button>
                              <input
                                type="text"
                                placeholder="Remark (required to reject)"
                                className="min-w-[10rem] rounded-lg border border-slate-200 px-2 py-1 text-[11px]"
                                value={reviewNoteById[request.id] || ''}
                                onChange={(e) =>
                                  setReviewNoteById((prev) => ({
                                    ...prev,
                                    [request.id]: e.target.value,
                                  }))
                                }
                              />
                              <button
                                type="button"
                                disabled={isActing || isDeleting}
                                onClick={() => void handleReject(request)}
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-60"
                              >
                                {isActing ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  <X className="size-3" strokeWidth={2.5} />
                                )}
                                Reject
                              </button>
                            </>
                          ) : null}
                          {showAssignTask ? (
                            <button
                              type="button"
                              onClick={() => openDrawer(request, 'assign')}
                              className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
                            >
                              <ClipboardList className="size-3" strokeWidth={2.25} />
                              Assign task
                            </button>
                          ) : null}
                          {showViewTask ? (
                            <Link
                              href={`/Task&Activites?taskId=${encodeURIComponent(request.linkedTaskId || '')}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
                            >
                              <ClipboardList className="size-3" strokeWidth={2.25} />
                              Open task
                            </Link>
                          ) : null}
                          {showViewJob ? (
                            <Link
                              href={`/job?jobId=${encodeURIComponent(request.linkedJobId || '')}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
                            >
                              View job
                            </Link>
                          ) : null}
                          {canRemove ? (
                            <button
                              type="button"
                              disabled={isActing || isDeleting}
                              onClick={() => void handleDelete(request)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60"
                            >
                              {isDeleting ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <Trash2 className="size-3" strokeWidth={2.25} />
                              )}
                              Delete
                            </button>
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
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedRequest(null);
        }}
        request={selectedRequest}
        mode={drawerMode}
        onSuccess={handleDrawerSuccess}
      />
    </>
  );
}
