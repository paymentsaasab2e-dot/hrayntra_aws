'use client';

import React from 'react';
import { Eye } from 'lucide-react';
import type { ClientReviewBatchRow } from '../../lib/clientReviewTypes';

type Props = {
  rows: ClientReviewBatchRow[];
  onView: (row: ClientReviewBatchRow) => void;
};

export function ClientReviewBatchTable({ rows, onView }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-indigo-100/80 bg-white shadow-sm shadow-indigo-100/40">
      <div className="border-b border-indigo-50 bg-gradient-to-r from-slate-50 via-indigo-50/40 to-violet-50/30 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-900">Submitted candidates</h2>
        <p className="mt-1 text-xs text-slate-500">
          Open a candidate to review the profile the recruiter shared and submit your decision.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead>
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <th className="px-5 py-3">#</th>
              <th className="px-5 py-3">Candidate</th>
              <th className="px-5 py-3">Designation</th>
              <th className="px-5 py-3">Experience</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => (
              <tr
                key={row.matchId}
                className="cursor-pointer transition hover:bg-indigo-50/40"
                onClick={() => onView(row)}
              >
                <td className="px-5 py-3.5 text-slate-400">{index + 1}</td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                      {String(row.candidateName || 'C')
                        .split(/\s+/)
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join('')
                        .toUpperCase() || 'C'}
                    </span>
                    <span className="font-semibold text-slate-900">{row.candidateName || 'Candidate'}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-slate-600">{row.designation || '—'}</td>
                <td className="px-5 py-3.5 text-slate-600">
                  {typeof row.experience === 'number' ? `${row.experience} yrs` : '—'}
                </td>
                <td className="px-5 py-3.5 text-slate-600">{row.jobTitle || '—'}</td>
                <td className="px-5 py-3.5 text-right">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onView(row);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-95"
                  >
                    <Eye size={14} />
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
