import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SHOW_TABLE_ROW_EDIT_ICON } from '../../constants/tableUi';
import {
  ArrowRightCircle,
  CheckCircle2,
  ChevronDown,
  FilePenLine,
  FlagTriangleRight,
  MoreHorizontal,
  XCircle,
} from 'lucide-react';
import type { Interview } from '../../types/interview.types';
import { isInterviewCompleted } from '../../types/interview.types';
import PaginationAll from '../PaginationAll';
import { getCandidateStageBadgeClasses, getCandidateStageLabel } from '../../utils/candidateStage';
import { TableAuditColumnHeader, TableAuditCell } from '../table/TableAuditCell';
import type { AiWorkspaceBriefAlert } from '@/lib/apiAiWorkspaceBrief';
import { WorkspaceAlertTableCell, WorkspaceAlertTableHeader } from '../ai/WorkspaceAlertTableCell';

interface InterviewGroup {
  key: string;
  rounds: Interview[];
}

function interviewActivityTime(interview: Interview): number {
  const raw = interview.updatedAt || interview.scheduledAt || 0;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : 0;
}

function groupInterviewsForTable(items: Interview[]): InterviewGroup[] {
  const map = new Map<string, Interview[]>();
  for (const inv of items) {
    const k = `${inv.candidate.id}::${inv.job.id}`;
    const list = map.get(k);
    if (list) list.push(inv);
    else map.set(k, [inv]);
  }
  const groups: InterviewGroup[] = [];
  for (const [, rounds] of map) {
    const sorted = [...rounds].sort(
      (a, b) =>
        new Date(a.scheduledAt || 0).getTime() - new Date(b.scheduledAt || 0).getTime()
    );
    groups.push({
      key: `${sorted[0].candidate.id}::${sorted[0].job.id}`,
      rounds: sorted,
    });
  }
  return groups.sort(
    (a, b) =>
      Math.max(...b.rounds.map(interviewActivityTime)) -
      Math.max(...a.rounds.map(interviewActivityTime))
  );
}

/** Prefer next actionable round for drawer row-click; fallback to chronologically latest. */
function representativeInterview(rounds: Interview[]): Interview {
  const sorted = [...rounds];
  const now = Date.now();
  const active = sorted.filter((r) => r.status === 'Scheduled' || r.status === 'Rescheduled');
  const upcoming = active.find((r) => new Date(r.scheduledAt || 0).getTime() >= now - 60 * 60 * 1000);
  return upcoming ?? active[active.length - 1] ?? sorted[sorted.length - 1];
}

function mergedPanel(rounds: Interview[]): Interview['panel'] {
  const byKey = new Map<string, Interview['panel'][number]>();
  for (const inv of rounds) {
    for (const m of inv.panel) {
      const k = String(m.userId || m.id);
      if (!byKey.has(k)) byKey.set(k, m);
    }
  }
  return Array.from(byKey.values());
}

function resolveInterviewRoundLabel(
  interview: Interview,
  index: number,
  roundNumberByInterviewId?: Record<string, number>,
): number {
  return roundNumberByInterviewId?.[interview.id] ?? index + 1;
}

function resolveCreatedByLabel(createdBy: Interview['createdBy'] | { name?: string } | null | undefined): string {
  if (!createdBy) return '—';
  if (typeof createdBy === 'string') return createdBy || '—';
  return createdBy.name || '—';
}

interface InterviewTableProps {
  interviews: Interview[];
  selectedIds: string[];
  page: number;
  totalPages: number;
  totalEntries: number;
  pageSize: number;
  onToggleSelect: (interviewId: string) => void;
  onToggleSelectAll: () => void;
  onRowClick: (interview: Interview) => void;
  onViewCandidate: (interview: Interview) => void;
  onEditInterview: (interview: Interview) => void;
  onNoShowInterview: (interview: Interview) => void;
  /** When set, shows a check control per round to mark that interview as Completed. */
  onMarkInterviewCompleted?: (interview: Interview) => void;
  onRejectCandidate: (interview: Interview) => void;
  onPageChange: (page: number) => void;
  /** When set with `pageSizeOptions`, shows rows-per-page control in the table footer. */
  pageSizeOptions?: number[];
  onPageSizeChange?: (pageSize: number) => void;
  /** Parent renders pagination in a shared card footer (Leads-style layout). */
  hidePagination?: boolean;
  workspaceAlertsByEntityId?: Record<string, AiWorkspaceBriefAlert[]>;
  /** Absolute round index per interview id (R1/R2 across full history, not just filtered rows). */
  roundNumberByInterviewId?: Record<string, number>;
  /** Hide Job / client when the table is already scoped to one job. */
  hideJobColumn?: boolean;
  /** Persistable column visibility; locked columns (select/candidate/actions) stay shown. */
  isColumnVisible?: (columnId: string) => boolean;
  /** Job candidates popup: show Edit / Complete / No show action buttons. */
  showEditCompleteNoShowActions?: boolean;
  /** Highest round number that exists on this job (enables move-to-next-round). */
  jobMaxRound?: number;
  /** Per-candidate highest round on this job (avoids wrong forward when filtered by round tab). */
  candidateMaxRoundByCandidateId?: Record<string, number>;
  /** Schedule / move candidate forward to the next interview round. */
  onScheduleNextRound?: (interview: Interview) => void;
}

const statusClasses = {
  Scheduled: 'bg-blue-50 text-[#2563EB]',
  Completed: 'bg-green-50 text-[#16A34A]',
  Cancelled: 'bg-red-50 text-[#DC2626]',
  Rescheduled: 'bg-orange-50 text-[#F59E0B]',
  'No Show': 'bg-slate-100 text-[#6B7280]',
};

const feedbackClasses = {
  Pending: 'text-[#F59E0B]',
  Submitted: 'text-[#16A34A]',
  'N/A': 'text-[#9CA3AF]',
};

function resolveInterviewGroupStatusBadge(
  rounds: Interview[],
  candidateStage?: string | null
): { label: string; className: string } | null {
  if (!rounds.length) return null;

  const allCompleted = rounds.every((round) => round.status === 'Completed');
  const stageNormalized = String(candidateStage || '').trim().toLowerCase();
  const isInterviewingStage =
    stageNormalized === 'interviewing' || stageNormalized === 'interview';

  if (allCompleted && (isInterviewingStage || !candidateStage)) {
    return {
      label: 'Interview completed',
      className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    };
  }

  if (!candidateStage) return null;

  return {
    label: getCandidateStageLabel(candidateStage),
    className: getCandidateStageBadgeClasses(candidateStage),
  };
}

export function InterviewTable({
  interviews,
  selectedIds,
  page,
  totalPages,
  totalEntries,
  pageSize,
  onToggleSelect,
  onToggleSelectAll,
  onRowClick,
  onViewCandidate,
  onEditInterview,
  onNoShowInterview,
  onMarkInterviewCompleted,
  onRejectCandidate,
  onPageChange,
  pageSizeOptions,
  onPageSizeChange,
  hidePagination = false,
  workspaceAlertsByEntityId,
  roundNumberByInterviewId,
  hideJobColumn = false,
  isColumnVisible = () => true,
  showEditCompleteNoShowActions = false,
  jobMaxRound = 1,
  candidateMaxRoundByCandidateId,
  onScheduleNextRound,
}: InterviewTableProps) {
  const show = isColumnVisible;
  const groups = useMemo(() => groupInterviewsForTable(interviews), [interviews]);
  const showAiAlertColumn = Boolean(
    workspaceAlertsByEntityId &&
      Object.values(workspaceAlertsByEntityId).some((alerts) => alerts.length > 0),
  );
  const allIdsOnPage = useMemo(() => interviews.map((i) => i.id), [interviews]);
  const allSelected =
    allIdsOnPage.length > 0 && allIdsOnPage.every((id) => selectedIds.includes(id));

  const [roundMenuOpenFor, setRoundMenuOpenFor] = useState<string | null>(null);
  const [roundMenuPlacement, setRoundMenuPlacement] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const roundMenuAnchorRef = useRef<HTMLButtonElement | null>(null);

  const closeRoundMenu = () => {
    roundMenuAnchorRef.current = null;
    setRoundMenuOpenFor(null);
    setRoundMenuPlacement(null);
  };

  useLayoutEffect(() => {
    if (roundMenuOpenFor === null) {
      setRoundMenuPlacement(null);
      return undefined;
    }
    const updatePlacement = () => {
      const btn = roundMenuAnchorRef.current;
      if (!btn) {
        setRoundMenuPlacement(null);
        return;
      }
      const rect = btn.getBoundingClientRect();
      setRoundMenuPlacement({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    };
    updatePlacement();
    window.addEventListener('scroll', updatePlacement, true);
    window.addEventListener('resize', updatePlacement);
    return () => {
      window.removeEventListener('scroll', updatePlacement, true);
      window.removeEventListener('resize', updatePlacement);
    };
  }, [roundMenuOpenFor]);

  useEffect(() => {
    if (roundMenuOpenFor === null) return undefined;
    let removeListener: (() => void) | undefined;
    const frame = requestAnimationFrame(() => {
      const onDocMouseDown = (e: MouseEvent) => {
        const node = e.target;
        if (!(node instanceof Element)) return;
        if (node.closest('[data-interview-actions-menu-root]')) return;
        if (node.closest('[data-interview-round-dropdown-portal]')) return;
        closeRoundMenu();
      };
      document.addEventListener('mousedown', onDocMouseDown);
      removeListener = () => document.removeEventListener('mousedown', onDocMouseDown);
    });
    return () => {
      cancelAnimationFrame(frame);
      removeListener?.();
    };
  }, [roundMenuOpenFor]);

  const roundMenuGroup = useMemo(
    () => groups.find((g) => g.key === roundMenuOpenFor) ?? null,
    [groups, roundMenuOpenFor]
  );

  const roundMenuPortal =
    roundMenuOpenFor &&
    roundMenuGroup &&
    roundMenuPlacement &&
    typeof document !== 'undefined'
      ? createPortal(
          <div
            data-interview-round-dropdown-portal
            className="fixed z-[200] min-w-[11.5rem] max-w-[16rem] rounded-xl border border-[#E5E7EB] bg-white py-1 text-left shadow-lg"
            style={{ top: roundMenuPlacement.top, right: roundMenuPlacement.right }}
          >
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#6B7280]">
              Per round
            </div>
            {roundMenuGroup.rounds.map((interview, index) => {
              const roundLabel = resolveInterviewRoundLabel(interview, index, roundNumberByInterviewId);
              return (
              <div
                key={interview.id}
                className="border-t border-[#F3F4F6] px-2 py-2 first:border-t-0"
              >
                <p className="truncate px-1 text-[11px] font-semibold text-[#111827]">
                  R{roundLabel} · {interview.round}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {SHOW_TABLE_ROW_EDIT_ICON && !isInterviewCompleted(interview) ? (
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB]"
                      title={`Edit round ${roundLabel}`}
                      onClick={() => {
                        closeRoundMenu();
                        onEditInterview(interview);
                      }}
                    >
                      <FilePenLine className="size-3.5" />
                    </button>
                  ) : null}
                  {!isInterviewCompleted(interview) ? (
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB]"
                      title={`No-show round ${roundLabel}`}
                      onClick={() => {
                        closeRoundMenu();
                        onNoShowInterview(interview);
                      }}
                    >
                      <FlagTriangleRight className="size-3.5" />
                    </button>
                  ) : null}
                  {onMarkInterviewCompleted ? (
                    <button
                      type="button"
                      disabled={
                        interview.status === 'Completed' ||
                        interview.status === 'Cancelled' ||
                        interview.status === 'No Show'
                      }
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-emerald-200 text-emerald-600 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-[#E5E7EB] disabled:text-[#D1D5DB] disabled:hover:bg-transparent"
                      title={
                        interview.status === 'Completed'
                          ? 'Already completed'
                          : `Complete round ${roundLabel} (submit feedback)`
                      }
                      onClick={() => {
                        if (
                          interview.status === 'Completed' ||
                          interview.status === 'Cancelled' ||
                          interview.status === 'No Show'
                        ) {
                          return;
                        }
                        closeRoundMenu();
                        onMarkInterviewCompleted(interview);
                      }}
                    >
                      <CheckCircle2 className="size-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>
            );
            })}
          </div>,
          document.body
        )
      : null;

  const safePageSize = Math.max(pageSize || 1, 1);
  const displayTotal = totalEntries > 0 ? totalEntries : interviews.length;

  return (
    <div className={hidePagination ? 'contents' : 'overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm'}>
      <div className={hidePagination ? 'contents' : 'overflow-x-auto'}>
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-indigo-100/50 bg-gradient-to-r from-slate-50/95 via-indigo-50/50 to-violet-50/40 text-[9px] font-bold uppercase tracking-[0.12em] text-indigo-950/45 backdrop-blur-sm">
              <th className="w-10 px-3 py-2 first:pl-4 sm:px-4">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleSelectAll}
                  className="size-4 rounded border-[#D1D5DB] text-[#2563EB]"
                />
              </th>
              <th className="px-3 py-2 sm:px-4">Candidate</th>
              {!hideJobColumn && show('job') ? (
                <th className="px-3 py-2 sm:px-4">Job / client</th>
              ) : null}
              {show('round') ? (
                <th
                  className="min-w-[7.5rem] max-w-[12rem] px-2 py-2 sm:py-2"
                  title="Click R1, R2, ... to open that round in the drawer; hover for schedule details"
                >
                  Round
                </th>
              ) : null}
              {show('panel') ? (
                <th className="w-[6rem] min-w-[5.5rem] max-w-[7rem] shrink-0 px-3 py-2 text-center sm:py-2" title="Interviewers">
                  INT
                </th>
              ) : null}
              {show('status') ? (
                <th className="min-w-[16rem] border-l border-indigo-100/40 pl-10 pr-3 py-2 sm:pl-12 sm:pr-4 sm:py-2">Status</th>
              ) : null}
              {show('scheduled') ? <th className="px-3 py-2 sm:px-4">Date / time</th> : null}
              {show('duration') ? <th className="px-3 py-2 sm:px-4">Duration</th> : null}
              {show('type') ? <th className="px-3 py-2 sm:px-4">Interview type</th> : null}
              {show('mode') ? <th className="px-3 py-2 sm:px-4">Mode</th> : null}
              {show('platform') ? <th className="px-3 py-2 sm:px-4">Meeting platform</th> : null}
              {show('location') ? <th className="px-3 py-2 sm:px-4">Location</th> : null}
              {show('feedback') ? <th className="px-3 py-2 sm:px-4">Feedback</th> : null}
              {show('createdBy') ? <th className="px-3 py-2 sm:px-4">Created by</th> : null}
              {show('candidateStage') ? <th className="px-3 py-2 sm:px-4">Candidate stage</th> : null}
              {showAiAlertColumn ? <WorkspaceAlertTableHeader /> : null}
              {show('audit') ? <TableAuditColumnHeader /> : null}
              <th className="px-3 py-2 text-right sm:px-4">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100/80">
            {groups.map((group) => {
              const { rounds } = group;
              const primary = representativeInterview(rounds);
              const panelMerged = mergedPanel(rounds);
              const statusBadge = resolveInterviewGroupStatusBadge(
                rounds,
                primary.candidate.stage
              );
              const everySelected = rounds.length > 0 && rounds.every((r) => selectedIds.includes(r.id));
              const someSelected = rounds.some((r) => selectedIds.includes(r.id));

              const toggleGroupSelection = () => {
                const ids = rounds.map((r) => r.id);
                if (everySelected) {
                  ids.forEach((id) => {
                    if (selectedIds.includes(id)) onToggleSelect(id);
                  });
                } else {
                  ids.forEach((id) => {
                    if (!selectedIds.includes(id)) onToggleSelect(id);
                  });
                }
              };

              return (
                <tr
                  key={group.key}
                  onClick={() => onRowClick(primary)}
                  className="group cursor-pointer align-top transition-colors duration-150 even:bg-slate-50/40 hover:bg-indigo-50/50"
                >
                  <td className="px-3 py-2.5 first:pl-4 sm:px-4" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={everySelected}
                      ref={(el) => {
                        if (el) el.indeterminate = !everySelected && someSelected;
                      }}
                      onChange={toggleGroupSelection}
                      className="size-4 rounded border-[#D1D5DB] text-[#2563EB]"
                      title="Select all rounds for this candidate & job"
                    />
                  </td>
                  <td className="px-3 py-2.5 sm:px-4" onClick={(event) => event.stopPropagation()}>
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-semibold text-[#2563EB]">
                        {primary.candidate.name
                          .split(' ')
                          .map((part) => part[0])
                          .slice(0, 2)
                          .join('')}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0">
                          <button
                            type="button"
                            onClick={() => onViewCandidate(primary)}
                            className="text-left text-[13px] font-semibold text-slate-900 transition-colors hover:text-indigo-700"
                          >
                            {primary.candidate.name}
                          </button>
                          {rounds.length > 1 ? (
                            <span className="text-[11px] font-medium text-[#2563EB]">({rounds.length} rounds)</span>
                          ) : null}
                        </div>
                        <div className="truncate text-[11px] text-[#6B7280]">
                          {primary.candidate.email || 'No email available'}
                        </div>
                      </div>
                    </div>
                  </td>
                  {!hideJobColumn && show('job') ? (
                  <td className="max-w-[10rem] px-3 py-2.5 sm:px-4">
                    <div className="truncate text-[12px] font-semibold text-[#111827]">{primary.job.title}</div>
                    <div className="truncate text-[11px] text-[#6B7280]">{primary.job.client}</div>
                  </td>
                  ) : null}
                  {show('round') ? (
                  <td
                    className="min-w-[7.5rem] max-w-[12rem] px-2 py-2.5 sm:py-2.5"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="flex flex-row flex-wrap items-center gap-1">
                      {rounds.map((interview, index) => {
                        const roundLabel = resolveInterviewRoundLabel(
                          interview,
                          index,
                          roundNumberByInterviewId,
                        );
                        return (
                        <button
                          key={interview.id}
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onRowClick(interview);
                          }}
                          className="inline-flex shrink-0 cursor-pointer rounded-md bg-[#EFF6FF] px-2 py-0.5 text-[11px] font-bold tracking-wide text-[#1D4ED8] transition hover:bg-[#DBEAFE] hover:ring-1 hover:ring-[#BFDBFE] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-1"
                          title={`${interview.round} · ${interview.date} ${interview.time}`}
                          aria-label={`Open interview drawer for round ${roundLabel}`}
                        >
                          R{roundLabel}
                        </button>
                        );
                      })}
                    </div>
                  </td>
                  ) : null}
                  {show('panel') ? (
                  <td className="w-[6rem] min-w-[5.5rem] max-w-[7rem] shrink-0 px-3 py-2.5 sm:py-2.5">
                    <div className="flex items-center justify-center">
                      {panelMerged.slice(0, 3).map((member, index) => (
                        <div
                          key={member.id}
                          title={member.name}
                          className="-ml-2 flex size-7 items-center justify-center rounded-full border-2 border-white bg-[#DBEAFE] text-[10px] font-semibold text-[#2563EB]"
                          style={{ marginLeft: index === 0 ? 0 : -8 }}
                        >
                          {member.avatar}
                        </div>
                      ))}
                      {panelMerged.length > 3 ? (
                        <div className="-ml-2 flex size-7 items-center justify-center rounded-full border-2 border-white bg-[#F3F4F6] text-[10px] font-semibold text-[#374151]">
                          +{panelMerged.length - 3}
                        </div>
                      ) : null}
                    </div>
                  </td>
                  ) : null}
                  {show('status') ? (
                  <td className="min-w-[16rem] border-l border-slate-100/90 pl-10 pr-3 py-2.5 sm:pl-12 sm:pr-4 sm:py-2.5">
                    <div className="flex flex-col gap-y-0.5 leading-tight">
                      {rounds.map((interview, index) => {
                        const roundLabel = resolveInterviewRoundLabel(
                          interview,
                          index,
                          roundNumberByInterviewId,
                        );
                        return (
                        <div
                          key={interview.id}
                          className="font-mono text-[11px] tabular-nums text-[#374151]"
                          title={`Round ${roundLabel}: ${interview.status}, feedback ${interview.feedbackStatus}`}
                        >
                          <span className="font-semibold text-[#2563EB]">R{roundLabel}</span>
                          <span className="text-[#64748B]"> · </span>
                          <span
                            className={
                              interview.status === 'Completed'
                                ? 'font-semibold text-emerald-700'
                                : undefined
                            }
                          >
                            {interview.status === 'Completed' ? 'Interview completed' : interview.status}
                          </span>
                          <span className="text-[#64748B]"> · </span>
                          <span className={`font-semibold ${feedbackClasses[interview.feedbackStatus]}`}>
                            {interview.feedbackStatus}
                          </span>
                        </div>
                        );
                      })}
                    </div>
                    {statusBadge ? (
                      <div className="mt-1.5">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusBadge.className}`}
                        >
                          {statusBadge.label}
                        </span>
                      </div>
                    ) : null}
                  </td>
                  ) : null}
                  {show('scheduled') ? (
                    <td className="px-3 py-2.5 sm:px-4">
                      <span className="text-[12px] text-[#111827]">
                        {[primary.date, primary.time].filter(Boolean).join(' ') || '—'}
                      </span>
                    </td>
                  ) : null}
                  {show('duration') ? (
                    <td className="px-3 py-2.5 sm:px-4">
                      <span className="text-[12px] text-[#111827]">
                        {primary.duration != null ? `${primary.duration} min` : '—'}
                      </span>
                    </td>
                  ) : null}
                  {show('type') ? (
                    <td className="px-3 py-2.5 sm:px-4">
                      <span className="text-[12px] text-[#111827]">{primary.type || '—'}</span>
                    </td>
                  ) : null}
                  {show('mode') ? (
                    <td className="px-3 py-2.5 sm:px-4">
                      <span className="text-[12px] text-[#111827]">{primary.mode || '—'}</span>
                    </td>
                  ) : null}
                  {show('platform') ? (
                    <td className="px-3 py-2.5 sm:px-4">
                      <span className="text-[12px] text-[#111827]">{primary.meetingPlatform || '—'}</span>
                    </td>
                  ) : null}
                  {show('location') ? (
                    <td className="px-3 py-2.5 sm:px-4">
                      <span className="text-[12px] text-[#111827]">{primary.location || '—'}</span>
                    </td>
                  ) : null}
                  {show('feedback') ? (
                    <td className="px-3 py-2.5 sm:px-4">
                      <span
                        className={`text-[12px] font-semibold ${
                          feedbackClasses[primary.feedbackStatus] || 'text-[#9CA3AF]'
                        }`}
                      >
                        {primary.feedbackStatus || '—'}
                      </span>
                    </td>
                  ) : null}
                  {show('createdBy') ? (
                    <td className="px-3 py-2.5 sm:px-4">
                      <span className="text-[12px] text-[#111827]">
                        {resolveCreatedByLabel(primary.createdBy)}
                      </span>
                    </td>
                  ) : null}
                  {show('candidateStage') ? (
                    <td className="px-3 py-2.5 sm:px-4">
                      {primary.candidate?.stage ? (
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getCandidateStageBadgeClasses(primary.candidate.stage)}`}
                        >
                          {getCandidateStageLabel(primary.candidate.stage)}
                        </span>
                      ) : (
                        <span className="text-[12px] text-[#9CA3AF]">—</span>
                      )}
                    </td>
                  ) : null}
                  {showAiAlertColumn ? (
                    <td className="px-3 py-2.5 sm:px-4">
                      <WorkspaceAlertTableCell alerts={workspaceAlertsByEntityId?.[primary.id]} />
                    </td>
                  ) : null}
                  {show('audit') ? <TableAuditCell audit={primary.auditMeta} /> : null}
                  <td className="px-3 py-2.5 text-right sm:px-4" onClick={(event) => event.stopPropagation()}>
                    {showEditCompleteNoShowActions ? (
                      <div className="inline-flex flex-nowrap items-center justify-end gap-1">
                        {(() => {
                          const roundsMax = Math.max(
                            1,
                            ...rounds.map((round, index) =>
                              resolveInterviewRoundLabel(round, index, roundNumberByInterviewId),
                            ),
                          );
                          const candidateMaxRound =
                            candidateMaxRoundByCandidateId?.[primary.candidate.id] ?? roundsMax;
                          const canMoveForward =
                            Boolean(onScheduleNextRound) &&
                            Number(jobMaxRound) > candidateMaxRound;
                          const canAct = !isInterviewCompleted(primary);

                          return (
                            <>
                              {canAct ? (
                                <button
                                  type="button"
                                  onClick={() => onEditInterview(primary)}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50"
                                  title="Edit"
                                  aria-label="Edit interview"
                                >
                                  <FilePenLine className="size-3.5" />
                                </button>
                              ) : null}
                              {onMarkInterviewCompleted && canAct ? (
                                <button
                                  type="button"
                                  onClick={() => onMarkInterviewCompleted(primary)}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                  title="Complete"
                                  aria-label="Mark complete"
                                >
                                  <CheckCircle2 className="size-3.5" />
                                </button>
                              ) : null}
                              {canAct ? (
                                <button
                                  type="button"
                                  onClick={() => onNoShowInterview(primary)}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                                  title="No show"
                                  aria-label="Mark no show"
                                >
                                  <FlagTriangleRight className="size-3.5" />
                                </button>
                              ) : null}
                              {canMoveForward ? (
                                <button
                                  type="button"
                                  onClick={() => onScheduleNextRound?.(primary)}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
                                  title={`Move to round ${candidateMaxRound + 1}`}
                                  aria-label={`Move to round ${candidateMaxRound + 1}`}
                                >
                                  <ArrowRightCircle className="size-3.5" />
                                </button>
                              ) : null}
                              {!canAct && !canMoveForward ? (
                                <span className="text-[11px] font-medium text-slate-400">—</span>
                              ) : null}
                            </>
                          );
                        })()}
                      </div>
                    ) : (
                    <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-1">
                      {!isInterviewCompleted(primary) ? (
                        <button
                          type="button"
                          onClick={() => onEditInterview(primary)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#111827]"
                          title="Edit interview"
                          aria-label="Edit interview"
                        >
                          <FilePenLine className="size-3.5" />
                        </button>
                      ) : null}
                      {rounds.some((round) => !isInterviewCompleted(round)) ? (
                        <div className="relative" data-interview-actions-menu-root>
                          <button
                            type="button"
                            onClick={(e) => {
                              const btn = e.currentTarget;
                              setRoundMenuOpenFor((key) => {
                                if (key === group.key) {
                                  roundMenuAnchorRef.current = null;
                                  return null;
                                }
                                roundMenuAnchorRef.current = btn;
                                return group.key;
                              });
                            }}
                            className={`inline-flex h-7 items-center gap-0.5 rounded-md border border-[#E5E7EB] px-1.5 text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#111827] ${
                              roundMenuOpenFor === group.key ? 'bg-[#F3F4F6]' : ''
                            }`}
                            title="Edit or mark no-show for a specific round"
                            aria-expanded={roundMenuOpenFor === group.key}
                            aria-haspopup="true"
                          >
                            <MoreHorizontal className="size-3.5" />
                            <ChevronDown className="size-3" />
                          </button>
                        </div>
                      ) : null}
                      {!isInterviewCompleted(primary) ? (
                        <button
                          type="button"
                          onClick={() => onRejectCandidate(primary)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                          title="Reject candidate"
                          aria-label="Reject candidate"
                        >
                          <XCircle className="size-3.5" />
                        </button>
                      ) : null}
                    </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!hidePagination ? (
        <div className="flex w-full items-center border-t border-indigo-100/50 bg-gradient-to-r from-slate-50/40 via-white to-indigo-50/25 px-3 py-2 sm:px-4">
          <PaginationAll
            initialPage={page}
            totalPages={Math.max(totalPages, 1)}
            totalCount={displayTotal}
            pageSize={pageSize}
            pageSizeOptions={pageSizeOptions}
            onPageSizeChange={onPageSizeChange}
            itemLabel="interviews"
            onPageChange={onPageChange}
          />
        </div>
      ) : null}
      {roundMenuPortal}
    </div>
  );
}
