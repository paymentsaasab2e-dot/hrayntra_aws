'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowUpDown,
  Check,
  Eye,
  FileText,
  MoreHorizontal,
} from 'lucide-react';
import { ImageWithFallback } from '../ImageWithFallback';
import type { Placement } from '../../types/placement';
import {
  formatPlacementDate,
  getEmploymentTypeBadgeStyle,
  getPlacementStatusLabel,
  getStatusBadgeStyle,
} from '../../utils/placements';
import { buildFileHref } from '../../utils/cloudinaryUrls';
import PaginationAll from '../PaginationAll';
import { TableSkeleton } from '../ui/Skeleton';

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
  onMarkJoined?: (placement: Placement) => void;
  onMarkFailed?: (placement: Placement, mode: 'FAILED' | 'NO_SHOW') => void;
  onRequestReplacement?: (placement: Placement) => void;
  onDelete?: (placement: Placement) => void;
  onPageChange: (page: number) => void;
  /** Parent provides frosted card + footer pagination (Leads-style). */
  embedded?: boolean;
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

const MENU_WIDTH = 208; // matches w-52 / 13rem
const MENU_GAP = 6; // small offset from trigger

function RowMenu({
  placement,
  onMarkFailed,
  onRequestReplacement,
  onDelete,
}: {
  placement: Placement;
  onMarkFailed?: (placement: Placement, mode: 'FAILED' | 'NO_SHOW') => void;
  onRequestReplacement?: (placement: Placement) => void;
  onDelete?: (placement: Placement) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const hasMenuActions = Boolean(onMarkFailed || onRequestReplacement || onDelete);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Anchor the dropdown to the trigger using viewport coordinates so it
  // renders above any `overflow:hidden`/`overflow-x-auto` ancestor (the
  // table wrapper has both, which is why the menu was being clipped). We
  // also flip up if there isn't enough room below.
  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const menuHeight = menuRef.current?.offsetHeight ?? 200;
      const viewportH = window.innerHeight;
      const viewportW = window.innerWidth;

      let top = rect.bottom + MENU_GAP;
      if (top + menuHeight > viewportH - 8) {
        top = Math.max(8, rect.top - MENU_GAP - menuHeight);
      }
      let left = rect.right - MENU_WIDTH;
      left = Math.max(8, Math.min(left, viewportW - MENU_WIDTH - 8));
      setPosition({ top, left });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  // Outside-click + Escape close. We listen on `mousedown` so the menu
  // closes before any click handler on the underlying element fires.
  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  if (!hasMenuActions) {
    return null;
  }

  const closeAnd = (fn?: () => void) => () => {
    setOpen(false);
    fn?.();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        aria-haspopup="menu"
        aria-expanded={open}
        title="More actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {mounted && open && position
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
              className="fixed z-[1000] rounded-xl border border-[#E5E7EB] bg-white p-2 shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              {onMarkFailed && (
                <button
                  type="button"
                  onClick={closeAnd(() => onMarkFailed(placement, 'FAILED'))}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[#111827] hover:bg-slate-50"
                >
                  Mark as Failed
                </button>
              )}
              {onMarkFailed && (
                <button
                  type="button"
                  onClick={closeAnd(() => onMarkFailed(placement, 'NO_SHOW'))}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[#111827] hover:bg-slate-50"
                >
                  Mark as No Show
                </button>
              )}
              {onRequestReplacement && (
                <button
                  type="button"
                  onClick={closeAnd(() => onRequestReplacement(placement))}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[#111827] hover:bg-slate-50"
                >
                  Request Replacement
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={closeAnd(() => onDelete(placement))}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[#DC2626] hover:bg-red-50"
                >
                  Delete Placement
                </button>
              )}
            </div>,
            document.body
          )
        : null}
    </>
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
  embedded = false,
}: PlacementsTableProps) {
  // Offer-letter URLs returned by the backend look like `/uploads/...` —
  // they're served from the API host, not the Next.js dev origin. Resolve
  // the API base once so the "View offer letter" button opens via the
  // backend's static route instead of 404'ing on :3001.
  const uploadsBase = useMemo(
    () =>
      (typeof window !== 'undefined'
        ? process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1'
        : 'http://localhost:5001/api/v1'
      ).replace(/\/api\/v1\/?$/, ''),
    []
  );

  if (isLoading) {
    if (embedded) {
      return <TableSkeleton rows={8} columns={6} />;
    }
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
    if (embedded) {
      return (
        <div className="px-4 py-14 text-center">
          <p className="text-sm font-semibold text-slate-800">No placements found</p>
          <p className="mt-1 text-xs text-slate-500">Try adjusting filters or add a manual placement.</p>
        </div>
      );
    }
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center shadow-sm">
        <p className="text-lg font-semibold text-[#111827]">No placements found</p>
        <p className="mt-2 text-sm text-[#6B7280]">Try adjusting filters or add a manual placement.</p>
      </div>
    );
  }

  const outerWrap = embedded ? 'overflow-hidden' : 'overflow-hidden rounded-xl bg-white shadow-sm';
  const theadRow = embedded
    ? 'sticky top-0 z-10 border-b border-indigo-100/50 bg-gradient-to-r from-slate-50/95 via-indigo-50/50 to-violet-50/40 text-[9px] font-bold uppercase tracking-[0.12em] text-indigo-950/45'
    : 'bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500';
  const thPad = embedded ? 'px-3 py-2 sm:px-4' : 'px-6 py-4';
  const tdPad = embedded ? 'px-3 py-2.5 sm:px-4' : 'px-6 py-4';
  const rowClass = embedded
    ? 'border-b border-slate-100/90 transition-colors duration-200 even:bg-slate-50/35 hover:bg-indigo-50/45'
    : 'border-b border-gray-100 transition-colors hover:bg-gray-50';

  return (
    <div className={outerWrap}>
      <div className={embedded ? 'no-scrollbar overflow-x-auto' : 'overflow-x-auto'}>
        <table className="min-w-full border-collapse text-left">
          <thead>
            <tr className={theadRow}>
              <th className={thPad}>Candidate</th>
              <th className={thPad}>Client / Job</th>
              <th className={thPad}>Recruiter</th>
              <th className={thPad}>
                <SortableHeader label="Offer Date" column="offerDate" sortBy={sortBy} onSort={onSort} />
              </th>
              <th className={thPad}>
                <SortableHeader label="Joining Date" column="joiningDate" sortBy={sortBy} onSort={onSort} />
              </th>
              <th className={thPad}>Type</th>
              <th className={thPad}>Status</th>
              <th className={`${thPad} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody className={embedded ? 'divide-y divide-slate-100/80' : undefined}>
            {data.map((placement) => {
              const statusStyle = getStatusBadgeStyle(placement.status);
              const typeStyle = getEmploymentTypeBadgeStyle(placement.employmentType);
              const canMarkJoinedStatus = ['OFFER_ACCEPTED', 'JOINING_SCHEDULED'].includes(placement.status);

              return (
                <tr key={placement.id} className={rowClass}>
                  <td className={tdPad}>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 overflow-hidden rounded-full border border-gray-200">
                        <ImageWithFallback
                          src={placement.candidate.avatar || ''}
                          alt={`${placement.candidate.firstName} ${placement.candidate.lastName}`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() => onView(placement)}
                          className="font-medium text-[#2563EB] hover:underline"
                        >
                          {`${placement.candidate.firstName} ${placement.candidate.lastName}`.trim()}
                        </button>
                        {placement.paymentStatus === 'PAID' || placement.paymentStatus === 'OVERDUE' ? (
                          <div className="mt-1">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                placement.paymentStatus === 'PAID'
                                  ? 'bg-[#D1FAE5] text-[#065F46]'
                                  : 'bg-red-50 text-red-700'
                              }`}
                            >
                              {placement.paymentStatus}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </td>

                  <td className={tdPad}>
                    <div>
                      <p className="font-medium text-[#111827]">{placement.client.companyName}</p>
                      <p className="text-sm text-[#6B7280]">{placement.job.title}</p>
                    </div>
                  </td>

                  <td className={`${tdPad} text-sm text-[#111827]`}>{placement.recruiter?.name || '—'}</td>
                  <td className={`${tdPad} text-sm text-[#111827]`}>{formatPlacementDate(placement.offerDate)}</td>
                  <td className={`${tdPad} text-sm text-[#111827]`}>{formatPlacementDate(placement.joiningDate)}</td>

                  <td className={tdPad}>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${typeStyle.bg} ${typeStyle.text}`}>
                      {placement.employmentType || '—'}
                    </span>
                  </td>

                  <td className={tdPad}>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle.bg} ${statusStyle.text}`}>
                      {getPlacementStatusLabel(placement.status)}
                    </span>
                  </td>

                  <td className={tdPad}>
                    <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => onView(placement)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-[#2563EB]"
                        title="View placement"
                        aria-label="View placement"
                      >
                        <Eye className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        disabled={!placement.offerLetterUrl}
                        onClick={() => {
                          if (!placement.offerLetterUrl) return;
                          const href = buildFileHref(placement.offerLetterUrl, uploadsBase);
                          window.open(href, '_blank', 'noopener');
                        }}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                        title="View offer letter"
                      >
                        <FileText className="h-4 w-4" />
                      </button>

                      {onMarkJoined && (
                        <button
                          type="button"
                          disabled={!canMarkJoinedStatus}
                          onClick={() => onMarkJoined(placement)}
                          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
                          title="Mark as joined"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}

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

      {!embedded ? (
        <div className="flex w-full items-center border-t border-gray-100 px-6 py-4">
          <PaginationAll
            initialPage={pagination.page}
            totalPages={pagination.totalPages}
            totalCount={pagination.total}
            pageSize={pagination.limit}
            itemLabel="placements"
            onPageChange={onPageChange}
          />
        </div>
      ) : null}
    </div>
  );
}
