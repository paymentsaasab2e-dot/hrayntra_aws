'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, MessageSquarePlus, RefreshCcw, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  deleteTeamRequest,
  getTeamRequestsForSender,
  getCurrentUserRequestIdentity,
  TEAM_REQUESTS_UPDATED_EVENT,
} from '../../../lib/api/teamApi';
import type { TeamRequest, TeamRequestStatus } from '../../../types/team';
import { PH2_TABLE_CARD_CLASS } from '../../layout/Ph2ModulePageLayout';
import { TeamRequestDrawer } from '../TeamRequestDrawer';
import { usePermissions } from '../../../hooks/usePermissions';
import { requestConfirm } from '../../../lib/appDialog';

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

export function RequestsTab() {
  const { hasPermission } = usePermissions();
  const canCreateRequest = hasPermission('requests_create');
  const canDeleteRequest = hasPermission('requests_delete');
  const canViewAllRequests = hasPermission('view_all_requests');
  const [requests, setRequests] = useState<TeamRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequestDrawer, setShowRequestDrawer] = useState(false);
  const [requestDraft, setRequestDraft] = useState<{
    sendToId?: string;
    subject?: string;
    description?: string;
    priority?: 'low' | 'medium' | 'high';
  } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState(() => getCurrentUserRequestIdentity());

  const loadRequests = useCallback(async () => {
    setLoading(true);
    const user = getCurrentUserRequestIdentity();
    setCurrentUser(user);
    try {
      const res = await getTeamRequestsForSender({
        currentUser: getCurrentUserRequestIdentity(),
        viewAll: canViewAllRequests,
      });
      setRequests(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load requests');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [canViewAllRequests]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    const refresh = () => void loadRequests();
    window.addEventListener(TEAM_REQUESTS_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(TEAM_REQUESTS_UPDATED_EVENT, refresh);
  }, [loadRequests]);

  useEffect(() => {
    const handleOpenDrawer = () => setShowRequestDrawer(true);
    window.addEventListener('request:open-request-drawer', handleOpenDrawer);
    return () => window.removeEventListener('request:open-request-drawer', handleOpenDrawer);
  }, []);

  const sortedRequests = useMemo(() => requests, [requests]);

  const canDeleteSentRequest = useCallback(
    (request: TeamRequest) => {
      if (canDeleteRequest || canViewAllRequests) return true;
      const userId = String(currentUser.id || '').trim().toLowerCase();
      const userEmail = String(currentUser.email || '').trim().toLowerCase();
      if (userId && String(request.requestedById || '').trim().toLowerCase() === userId) return true;
      if (userEmail && String(request.requestedByEmail || '').trim().toLowerCase() === userEmail) {
        return true;
      }
      return false;
    },
    [canDeleteRequest, canViewAllRequests, currentUser.email, currentUser.id],
  );

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
        Loading requests…
      </div>
    );
  }

  return (
    <>
      <div className={PH2_TABLE_CARD_CLASS}>
        <div className="flex flex-col gap-3 border-b border-indigo-100/40 bg-gradient-to-br from-white via-indigo-50/25 to-violet-50/20 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Requests</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Submit and track requests sent to your administrator.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setRequestDraft(null);
              setShowRequestDrawer(true);
            }}
            disabled={!canCreateRequest}
            className="inline-flex items-center gap-1.5 self-start rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:from-blue-700 hover:via-indigo-700 hover:to-violet-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
          >
            <Send size={15} strokeWidth={2.25} />
            Send Request
          </button>
        </div>

        {sortedRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <MessageSquarePlus className="h-7 w-7" strokeWidth={1.8} />
            </div>
            <p className="text-sm font-semibold text-slate-800">No requests yet</p>
            <p className="mt-1 max-w-sm text-xs text-slate-500">
              Use the button above to send your first request to a team member.
            </p>
            <button
              type="button"
              onClick={() => {
                setRequestDraft(null);
                setShowRequestDrawer(true);
              }}
              disabled={!canCreateRequest}
              className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-indigo-200/70 bg-white px-3.5 py-2 text-xs font-semibold text-indigo-900 shadow-sm transition-all hover:border-indigo-300 hover:bg-indigo-50/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={15} strokeWidth={2.25} />
              Send Request
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-indigo-100/50 bg-gradient-to-r from-slate-50/95 via-indigo-50/50 to-violet-50/40 text-[9px] font-bold uppercase tracking-[0.12em] text-indigo-950/45">
                  <th className="px-4 py-3 sm:px-6">Subject</th>
                  <th className="px-4 py-3">Send To</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3 sm:pr-6">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedRequests.map((request) => {
                  const canDelete = canDeleteSentRequest(request);
                  const isDeleting = deletingId === request.id;
                  return (
                  <tr
                    key={request.id}
                    className="border-b border-slate-100/80 transition-colors even:bg-slate-50/35 hover:bg-indigo-50/45"
                  >
                    <td className="px-4 py-3.5 sm:px-6">
                      <p className="font-medium text-slate-900">{request.subject}</p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                        {request.description}
                      </p>
                      {request.status === 'rejected' && request.reviewNote ? (
                        <p className="mt-1 text-xs text-rose-700">Rejected: {request.reviewNote}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3.5 text-xs font-medium text-slate-700">
                      {request.sendToName || '—'}
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
                        {request.status === 'rejected' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setRequestDraft({
                                sendToId: request.sendToId,
                                subject: request.subject,
                                description: '',
                                priority: request.priority,
                              });
                              setShowRequestDrawer(true);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[11px] font-semibold text-violet-700 transition-colors hover:bg-violet-100"
                            title="Resend request"
                          >
                            <RefreshCcw className="size-3" strokeWidth={2.25} />
                            Resend
                          </button>
                        ) : null}
                        {canDelete ? (
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => void handleDelete(request)}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-60"
                          title="Delete request"
                        >
                          {isDeleting ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Trash2 className="size-3" strokeWidth={2.25} />
                          )}
                          Delete
                        </button>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
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

      <TeamRequestDrawer
        isOpen={showRequestDrawer && canCreateRequest}
        onClose={() => {
          setShowRequestDrawer(false);
          setRequestDraft(null);
        }}
        initialDraft={requestDraft || undefined}
        onSuccess={(request) => {
          setRequests((prev) => [request, ...prev]);
          setRequestDraft(null);
        }}
      />
    </>
  );
}
