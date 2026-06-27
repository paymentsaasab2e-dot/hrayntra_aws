'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Eye, Plus, RefreshCcw } from 'lucide-react';
import {
  apiListInterviewApplications,
  type InterviewApplicationRow,
  type InterviewApplicationStatus,
} from '../../lib/api';
import { PH2_TABLE_CARD_CLASS, PH2_TOOLBAR_ROW_CLASS } from '../layout/Ph2ModulePageLayout';
import { TableSkeleton } from '../ui/Skeleton';

const STATUS_LABELS: Record<InterviewApplicationStatus, string> = {
  SUBMITTED: 'Submitted',
  PENDING_REVIEW: 'Pending Review',
  IN_INTERVIEW: 'In Interview',
  INTERVIEW_COMPLETED: 'Interview Completed',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

type Props = {
  onReview: (row: InterviewApplicationRow) => void;
};

export function InterviewApplicationsTab({ onReview }: Props) {
  const [rows, setRows] = useState<InterviewApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiListInterviewApplications(
        statusFilter ? { status: statusFilter } : undefined,
      );
      const data = (res as { data?: InterviewApplicationRow[] })?.data ?? res;
      setRows(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load applications');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const statusOptions = useMemo(() => Object.entries(STATUS_LABELS), []);

  return (
    <div className={PH2_TABLE_CARD_CLASS}>
      <div className={PH2_TOOLBAR_ROW_CLASS}>
        <p className="text-xs font-semibold text-slate-600">
          Phase 1 interview form submissions for this tenant
        </p>
        <div className="flex items-center gap-2">
          <Link
            href="/interviews/forms"
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:opacity-95"
          >
            <Plus size={14} strokeWidth={2.5} />
            Create interview form
          </Link>
          <select
            className="h-9 rounded-lg border border-indigo-100 bg-white px-2 text-xs font-medium text-slate-700"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            {statusOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-indigo-200 bg-white text-indigo-700"
            title="Refresh"
          >
            <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={6} columns={5} />
      ) : error ? (
        <div className="p-8 text-center text-sm text-rose-600">{error}</div>
      ) : !rows.length ? (
        <div className="px-4 py-14 text-center">
          <p className="text-sm font-semibold text-slate-800">No interview applications yet</p>
          <p className="mt-1 text-xs text-slate-500">
            Create and publish an interview form, then share it with Phase 1 candidates.
          </p>
          <Link
            href="/interviews/forms"
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:opacity-95"
          >
            <Plus size={14} strokeWidth={2.5} />
            Create interview form
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Candidate</th>
                <th className="px-4 py-3">Form</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-indigo-50/30">
                  <td className="px-4 py-3 font-medium text-slate-900">{row.candidateName}</td>
                  <td className="px-4 py-3 text-slate-700">{row.formName}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(row.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-800">
                      {STATUS_LABELS[row.status] || row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.source || 'Phase 1 Portal'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onReview(row)}
                      className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-indigo-800 hover:bg-indigo-50"
                    >
                      <Eye size={12} />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
