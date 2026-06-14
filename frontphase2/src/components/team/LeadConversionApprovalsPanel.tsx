'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  LEAD_CONVERSION_REQUESTS_UPDATED_EVENT,
  listLeadConversionRequests,
  reviewLeadConversionRequest,
  type LeadConversionRequest,
} from '../../lib/api/teamApi';
import { PH2_TABLE_CARD_CLASS } from '../layout/Ph2ModulePageLayout';
import { usePermissions } from '../../hooks/usePermissions';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-200/80',
  approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200/80',
  rejected: 'bg-rose-50 text-rose-700 ring-rose-200/80',
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

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

export function LeadConversionApprovalsPanel() {
  const { hasPermission } = usePermissions();
  const canUpdate =
    hasPermission('leads_update') ||
    hasPermission('requests_update') ||
    hasPermission('clients_create');
  const [requests, setRequests] = useState<LeadConversionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [actingId, setActingId] = useState<string | null>(null);
  const [reviewNoteById, setReviewNoteById] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listLeadConversionRequests('inbox');
      setRequests(data);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to load conversion requests');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const onUpdate = () => void load();
    window.addEventListener(LEAD_CONVERSION_REQUESTS_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(LEAD_CONVERSION_REQUESTS_UPDATED_EVENT, onUpdate);
  }, [load]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return requests;
    return requests.filter((r) => r.status === statusFilter);
  }, [requests, statusFilter]);

  const handleReview = async (request: LeadConversionRequest, action: 'accept' | 'reject') => {
    if (!canUpdate) {
      toast.error('You do not have permission to review conversion requests');
      return;
    }
    setActingId(request.id);
    try {
      const result = await reviewLeadConversionRequest(request.id, {
        action,
        note: reviewNoteById[request.id] || undefined,
      });
      toast.success(action === 'accept' ? 'Lead converted to client' : 'Conversion request rejected');
      if (action === 'accept' && result.createdClientId) {
        toast.message('Client created', {
          description: 'Open the Clients page to view the new record.',
        });
      }
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
          <h2 className="text-base font-bold text-slate-900">Lead conversion requests</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Approve or reject when sales staff request converting a lead to a client.
          </p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="all">All</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-5 py-16 text-center text-sm text-slate-500">No lead conversion requests in this filter.</div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {filtered.map((request) => (
            <li key={request.id} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">
                      {request.leadCompanyName || 'Lead conversion'}
                    </h3>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${STATUS_STYLES[request.status] || STATUS_STYLES.pending}`}
                    >
                      {request.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Requested by {request.requestedByName || 'team member'} · {formatDate(request.createdAt)}
                  </p>
                  {request.createdClientId ? (
                    <p className="mt-1 text-xs">
                      <Link
                        href={`/client?clientId=${encodeURIComponent(request.createdClientId)}`}
                        className="text-indigo-600 hover:underline"
                      >
                        Open created client
                      </Link>
                    </p>
                  ) : request.leadId ? (
                    <p className="mt-1 text-xs">
                      <Link href={`/leads?leadId=${encodeURIComponent(request.leadId)}`} className="text-indigo-600 hover:underline">
                        View lead
                      </Link>
                    </p>
                  ) : null}
                </div>
                {request.status === 'pending' && canUpdate ? (
                  <div className="flex flex-col items-end gap-2">
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
                        Approve
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
