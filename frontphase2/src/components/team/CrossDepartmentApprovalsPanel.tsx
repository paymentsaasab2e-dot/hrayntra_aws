'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  CROSS_DEPT_REQUESTS_UPDATED_EVENT,
  getCrossDeptAssignOptions,
  listCrossDeptRequests,
  reviewCrossDeptRequest,
  type CrossDepartmentWorkRequest,
  type CrossDeptTargetDepartment,
} from '../../lib/api/teamApi';
import { PH2_TABLE_CARD_CLASS } from '../layout/Ph2ModulePageLayout';
import { usePermissions } from '../../hooks/usePermissions';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-200/80',
  accepted: 'bg-emerald-50 text-emerald-700 ring-emerald-200/80',
  rejected: 'bg-rose-50 text-rose-700 ring-rose-200/80',
  forwarded: 'bg-blue-50 text-blue-700 ring-blue-200/80',
  cancelled: 'bg-slate-100 text-slate-600 ring-slate-200/80',
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

type StatusFilter = 'all' | 'pending' | 'accepted' | 'rejected';

export function CrossDepartmentApprovalsPanel() {
  const { hasPermission } = usePermissions();
  const canUpdate = hasPermission('requests_update') || hasPermission('tasks_update');
  const [requests, setRequests] = useState<CrossDepartmentWorkRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [actingId, setActingId] = useState<string | null>(null);
  const [reviewNoteById, setReviewNoteById] = useState<Record<string, string>>({});
  const [assignToById, setAssignToById] = useState<Record<string, string>>({});
  const [departments, setDepartments] = useState<CrossDeptTargetDepartment[]>([]);
  const [ownDepartment, setOwnDepartment] = useState<CrossDeptTargetDepartment | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, options] = await Promise.all([
        listCrossDeptRequests('inbox'),
        getCrossDeptAssignOptions().catch(() => ({ departments: [] })),
      ]);
      setRequests(data);
      setDepartments(Array.isArray(options?.departments) ? options.departments : []);
      setOwnDepartment(options?.ownDepartment ?? null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load cross-department requests';
      toast.error(message);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const onUpdate = () => void load();
    window.addEventListener(CROSS_DEPT_REQUESTS_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(CROSS_DEPT_REQUESTS_UPDATED_EVENT, onUpdate);
  }, [load]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return requests;
    return requests.filter((r) => r.status === statusFilter);
  }, [requests, statusFilter]);

  const membersForRequest = useCallback(
    (request: CrossDepartmentWorkRequest) => {
      if (ownDepartment?.id === request.targetDepartmentId) {
        return ownDepartment.members || [];
      }
      const dept = departments.find((d) => d.id === request.targetDepartmentId);
      return dept?.members || [];
    },
    [departments, ownDepartment],
  );

  const handleReview = async (request: CrossDepartmentWorkRequest, action: 'accept' | 'reject') => {
    if (!canUpdate) {
      toast.error('You do not have permission to review requests');
      return;
    }
    setActingId(request.id);
    try {
      const assignToId =
        action === 'accept'
          ? assignToById[request.id] || request.targetUserId || undefined
          : undefined;
      await reviewCrossDeptRequest(request.id, {
        action,
        note: reviewNoteById[request.id] || undefined,
        assignToId,
      });
      toast.success(action === 'accept' ? 'Request accepted' : 'Request rejected');
      await load();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Action failed');
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className={PH2_TABLE_CARD_CLASS}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Cross-department requests</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Work sent from other departments for your approval.
          </p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
        >
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="all">All</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-5 py-16 text-center text-sm text-slate-500">No cross-department requests in this filter.</div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {filtered.map((request) => (
            <li key={request.id} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">{request.subject}</h3>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${STATUS_STYLES[request.status] || STATUS_STYLES.pending}`}>
                      {request.status}
                    </span>
                    <span className="text-[10px] font-semibold uppercase text-slate-400">{request.workType}</span>
                  </div>
                  {request.description ? (
                    <p className="mt-1 text-sm text-slate-600 whitespace-pre-wrap">{request.description}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-slate-500">
                    From {request.requestedByName || 'another department'} · {formatDate(request.createdAt)}
                  </p>
                  {request.createdTaskId ? (
                    <p className="mt-1 text-xs">
                      <Link href={`/Task&Activites?taskId=${encodeURIComponent(request.createdTaskId)}`} className="text-indigo-600 hover:underline">
                        Open created task
                      </Link>
                    </p>
                  ) : request.workType === 'CLIENT' && request.linkedEntityId ? (
                    <p className="mt-1 text-xs">
                      <Link href={`/client?clientId=${encodeURIComponent(request.linkedEntityId)}`} className="text-indigo-600 hover:underline">
                        Open client
                      </Link>
                    </p>
                  ) : null}
                </div>
                {request.status === 'pending' && canUpdate ? (
                  <div className="flex flex-col items-end gap-2">
                    {(request.workType === 'CLIENT' || request.workType === 'TASK') &&
                    membersForRequest(request).length > 0 ? (
                      <select
                        value={assignToById[request.id] || request.targetUserId || ''}
                        onChange={(e) =>
                          setAssignToById((prev) => ({ ...prev, [request.id]: e.target.value }))
                        }
                        className="w-48 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                      >
                        <option value="">Assign to…</option>
                        {membersForRequest(request).map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    <input
                      type="text"
                      placeholder="Optional review note"
                      className="w-48 rounded-lg border border-slate-200 px-2 py-1 text-xs"
                      value={reviewNoteById[request.id] || ''}
                      onChange={(e) =>
                        setReviewNoteById((prev) => ({ ...prev, [request.id]: e.target.value }))
                      }
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={actingId === request.id}
                        onClick={() => void handleReview(request, 'accept')}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {actingId === request.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check size={14} />}
                        Accept
                      </button>
                      <button
                        type="button"
                        disabled={actingId === request.id}
                        onClick={() => void handleReview(request, 'reject')}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                      >
                        <X size={14} /> Reject
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
