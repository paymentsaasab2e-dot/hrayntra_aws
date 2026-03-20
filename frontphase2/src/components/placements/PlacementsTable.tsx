'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpDown,
  Check,
  Eye,
  FileText,
  MoreHorizontal,
  NotebookTabs,
} from 'lucide-react';
import { ImageWithFallback } from '../ImageWithFallback';
import type { Placement } from '../../types/placement';
import {
  formatPlacementDate,
  getEmploymentTypeBadgeStyle,
  getPlacementStatusLabel,
  getStatusBadgeStyle,
} from '../../utils/placements';

interface PlacementsTableProps {
  data: Placement[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  isLoading: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort: (sortBy: string) => void;
  onView: (placement: Placement) => void;
  onMarkJoined: (placement: Placement) => void;
  onMarkFailed: (placement: Placement, mode: 'FAILED' | 'NO_SHOW') => void;
  onRequestReplacement: (placement: Placement) => void;
  onDelete: (placement: Placement) => void;
  onPageChange: (page: number) => void;
}

function SortableHeader({
  label,
  column,
  sortBy,
  onSort,
}: {
  label: string;
  column: string;
  sortBy?: string;
  onSort: (column: string) => void;
}) {
  const active = sortBy === column;
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={`inline-flex items-center gap-1 ${active ? 'text-[#111827]' : 'text-gray-500'}`}
    >
      {label}
      <ArrowUpDown className="h-3.5 w-3.5" />
    </button>
  );
}

function RowMenu({
  placement,
  onMarkFailed,
  onRequestReplacement,
  onDelete,
}: {
  placement: Placement;
  onMarkFailed: (placement: Placement, mode: 'FAILED' | 'NO_SHOW') => void;
  onRequestReplacement: (placement: Placement) => void;
  onDelete: (placement: Placement) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open ? (
        <div className="absolute right-0 top-11 z-20 w-52 rounded-xl border border-[#E5E7EB] bg-white p-2 shadow-xl">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onMarkFailed(placement, 'FAILED');
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[#111827] hover:bg-slate-50"
          >
            Mark as Failed
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onMarkFailed(placement, 'NO_SHOW');
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[#111827] hover:bg-slate-50"
          >
            Mark as No Show
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onRequestReplacement(placement);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[#111827] hover:bg-slate-50"
          >
            Request Replacement
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onDelete(placement);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[#DC2626] hover:bg-red-50"
          >
            Delete Placement
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function PlacementsTable({
  data,
  pagination,
  isLoading,
  sortBy,
  onSort,
  onView,
  onMarkJoined,
  onMarkFailed,
  onRequestReplacement,
  onDelete,
  onPageChange,
}: PlacementsTableProps) {
  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="space-y-3 p-6">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-xl bg-[#F3F4F6]" />
          ))}
        </div>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center shadow-sm">
        <p className="text-lg font-semibold text-[#111827]">No placements found</p>
        <p className="mt-2 text-sm text-[#6B7280]">Try adjusting filters or add a manual placement.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left">
          <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-6 py-4">Candidate</th>
              <th className="px-6 py-4">Client / Job</th>
              <th className="px-6 py-4">Recruiter</th>
              <th className="px-6 py-4">
                <SortableHeader label="Offer Date" column="offerDate" sortBy={sortBy} onSort={onSort} />
              </th>
              <th className="px-6 py-4">
                <SortableHeader label="Joining Date" column="joiningDate" sortBy={sortBy} onSort={onSort} />
              </th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((placement) => {
              const statusStyle = getStatusBadgeStyle(placement.status);
              const typeStyle = getEmploymentTypeBadgeStyle(placement.employmentType);
              const canMarkJoined = ['OFFER_ACCEPTED', 'JOINING_SCHEDULED'].includes(placement.status);

              return (
                <tr
                  key={placement.id}
                  onClick={() => onView(placement)}
                  className="cursor-pointer border-b border-gray-100 transition-colors hover:bg-gray-50"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 overflow-hidden rounded-full border border-gray-200">
                        <ImageWithFallback
                          src={placement.candidate.avatar || ''}
                          alt={`${placement.candidate.firstName} ${placement.candidate.lastName}`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div>
                        <Link
                          href={`/placements/${placement.id}`}
                          onClick={(event) => event.stopPropagation()}
                          className="font-medium text-[#2563EB] hover:underline"
                        >
                          {`${placement.candidate.firstName} ${placement.candidate.lastName}`.trim()}
                        </Link>
                        <div className="mt-1">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              placement.paymentStatus === 'PAID'
                                ? 'bg-[#D1FAE5] text-[#065F46]'
                                : placement.paymentStatus === 'OVERDUE'
                                ? 'bg-red-50 text-red-700'
                                : 'bg-[#F3F4F6] text-[#6B7280]'
                            }`}
                          >
                            {placement.paymentStatus || 'PENDING'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-[#111827]">{placement.client.companyName}</p>
                      <p className="text-sm text-[#6B7280]">{placement.job.title}</p>
                    </div>
                  </td>

                  <td className="px-6 py-4 text-sm text-[#111827]">{placement.recruiter?.name || '—'}</td>
                  <td className="px-6 py-4 text-sm text-[#111827]">{formatPlacementDate(placement.offerDate)}</td>
                  <td className="px-6 py-4 text-sm text-[#111827]">{formatPlacementDate(placement.joiningDate)}</td>

                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${typeStyle.bg} ${typeStyle.text}`}>
                      {placement.employmentType || '—'}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle.bg} ${statusStyle.text}`}>
                      {getPlacementStatusLabel(placement.status)}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                      <Link
                        href={`/placements/${placement.id}`}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-[#2563EB]"
                        title="View placement"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>

                      <button
                        type="button"
                        disabled={!placement.offerLetterUrl}
                        onClick={() => placement.offerLetterUrl && window.open(placement.offerLetterUrl, '_blank')}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                        title="View offer letter"
                      >
                        <FileText className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        disabled={!canMarkJoined}
                        onClick={() => onMarkJoined(placement)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
                        title="Mark as joined"
                      >
                        <Check className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onView(placement)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        title="Activity"
                      >
                        <NotebookTabs className="h-4 w-4" />
                      </button>

                      <RowMenu
                        placement={placement}
                        onMarkFailed={onMarkFailed}
                        onRequestReplacement={onRequestReplacement}
                        onDelete={onDelete}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
        <p className="text-sm text-[#6B7280]">
          Showing {(pagination.page - 1) * pagination.limit + 1}-
          {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} placements
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pagination.page <= 1}
            onClick={() => onPageChange(pagination.page - 1)}
            className="rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-[#6B7280]">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            type="button"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => onPageChange(pagination.page + 1)}
            className="rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
