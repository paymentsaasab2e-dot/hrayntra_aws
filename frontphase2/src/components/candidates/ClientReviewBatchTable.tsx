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
    <div className="overflow-hidden rounded-xl border border-[#E5E7EB]">
      <div className="border-b border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3">
        <h2 className="text-sm font-semibold text-[#111827]">Submitted Candidates</h2>
        <p className="mt-1 text-xs text-[#6B7280]">
          Review each candidate below. Click View to open their profile and submit your decision.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[#E5E7EB] text-sm">
          <thead className="bg-white">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#6B7280]">#</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Candidate</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Designation</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Experience</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Role</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB] bg-white">
            {rows.map((row, index) => (
              <tr key={row.matchId} className="hover:bg-[#F9FAFB]">
                <td className="px-4 py-3 text-[#6B7280]">{index + 1}</td>
                <td className="px-4 py-3 font-medium text-[#111827]">{row.candidateName || 'Candidate'}</td>
                <td className="px-4 py-3 text-[#4B5563]">{row.designation || '—'}</td>
                <td className="px-4 py-3 text-[#4B5563]">
                  {typeof row.experience === 'number' ? `${row.experience} yrs` : '—'}
                </td>
                <td className="px-4 py-3 text-[#4B5563]">{row.jobTitle || '—'}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onView(row)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1.5 text-xs font-semibold text-[#1D4ED8] hover:bg-[#DBEAFE]"
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
