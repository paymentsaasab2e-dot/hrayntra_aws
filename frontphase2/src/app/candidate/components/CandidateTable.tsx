'use client';

import React, { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { SHOW_TABLE_ROW_EDIT_ICON } from '../../../constants/tableUi';
import {
  Phone,
  Pencil,
  UserPlus,
  ArrowRightLeft,
  ChevronDown,
  ExternalLink,
  MapPin,
  Briefcase,
  Trash2,
  Loader2,
  Send,
} from 'lucide-react';
import { ImageWithFallback, initialsFromDisplayName } from '../../../components/ImageWithFallback';
import {
  getCandidateStageBadgeClasses,
  getCandidateStageDotClasses,
  getCandidateStageLabel,
} from '../../../utils/candidateStage';
import { WhatsAppIcon } from '../../../components/icons/WhatsAppIcon';
import { displayMatchBand, scoreBadgeClass } from '../../../components/matches/types';
import type { AuditMeta } from '../../../types/audit';
import { TableAuditColumnHeader, TableAuditCell } from '../../../components/table/TableAuditCell';
import type { AiWorkspaceBriefAlert } from '@/lib/apiAiWorkspaceBrief';
import { WorkspaceAlertTableCell, WorkspaceAlertTableHeader } from '../../../components/ai/WorkspaceAlertTableCell';
import { useDrawerPortalDropdownPosition } from '../../../components/drawers/drawerFormUi';
import {
  SUBMIT_TO_CLIENT_STAGE_OPTION_LABEL,
  SUBMIT_TO_CLIENT_STAGE_OPTION_VALUE,
} from '../../../lib/candidateSubmitToClient';

export type { CandidateTableColumnFilters } from './CandidateTableFilters';
export { EMPTY_CANDIDATE_TABLE_COLUMN_FILTERS } from './CandidateTableFilters';

function normalizeStageKey(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function CandidateStageMoveDropdown({
  candidate,
  options,
  loadingOptions,
  moving,
  showSubmitToClient,
  onOpen,
  onChangeStage,
  onSubmitToClient,
}: {
  candidate: Candidate;
  options: Array<{ id: string; name: string }>;
  loadingOptions: boolean;
  moving: boolean;
  showSubmitToClient?: boolean;
  onOpen?: () => void | Promise<void>;
  onChangeStage: (stageId: string) => void | Promise<void>;
  onSubmitToClient?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const closeMenu = useCallback(() => setOpen(false), []);
  const { triggerRef, menuRef, menuPosition } = useDrawerPortalDropdownPosition(open, false, closeMenu);

  const selectedId =
    options.find((option) => normalizeStageKey(option.name) === normalizeStageKey(candidate.stage))
      ?.id || '';

  const menu =
    open && menuPosition && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-[1200] max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-2xl"
            style={{
              left: menuPosition.left,
              width: Math.max(menuPosition.width, 200),
              ...(menuPosition.placement === 'top'
                ? { bottom: menuPosition.bottom }
                : { top: menuPosition.top }),
            }}
            role="listbox"
            aria-label="Move candidate stage"
          >
            <div className="border-b border-slate-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Move stage
            </div>
            {loadingOptions && options.length === 0 ? (
              <div className="flex items-center gap-2 px-3 py-2.5 text-xs text-slate-500">
                <Loader2 size={14} className="animate-spin" />
                Loading stages…
              </div>
            ) : options.length === 0 && !showSubmitToClient ? (
              <div className="px-3 py-2.5 text-xs text-slate-500">No stages available</div>
            ) : (
              <>
                {options.map((option) => {
                  const isActive = option.id === selectedId;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      disabled={moving}
                      onClick={() => {
                        setOpen(false);
                        if (option.id === selectedId) return;
                        void onChangeStage(option.id);
                      }}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                        isActive
                          ? 'bg-blue-50 font-semibold text-blue-700'
                          : 'text-slate-700 hover:bg-slate-50'
                      } disabled:opacity-50`}
                    >
                      <span>{option.name}</span>
                      {isActive ? (
                        <span className="text-[10px] font-bold uppercase text-blue-500">Current</span>
                      ) : null}
                    </button>
                  );
                })}
                {showSubmitToClient && onSubmitToClient ? (
                  <>
                    <div className="my-1 border-t border-slate-100" />
                    <button
                      key={SUBMIT_TO_CLIENT_STAGE_OPTION_VALUE}
                      type="button"
                      role="option"
                      aria-selected={false}
                      disabled={moving}
                      onClick={() => {
                        setOpen(false);
                        onSubmitToClient();
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-50 disabled:opacity-50"
                    >
                      <Send size={14} className="shrink-0" strokeWidth={2.25} />
                      {SUBMIT_TO_CLIENT_STAGE_OPTION_LABEL}
                    </button>
                  </>
                ) : null}
              </>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={moving}
        title="Move stage"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          const next = !open;
          setOpen(next);
          if (next) void onOpen?.();
        }}
        className={`inline-flex max-w-[12rem] items-center gap-1 rounded-full border py-1 pl-2.5 pr-1.5 text-xs font-semibold shadow-sm transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500/25 disabled:cursor-wait disabled:opacity-60 ${getCandidateStageBadgeClasses(candidate.stage)}`}
      >
        <span className="truncate">{getCandidateStageLabel(candidate.stage)}</span>
        {moving ? (
          <Loader2 size={12} className="shrink-0 animate-spin opacity-80" />
        ) : (
          <ChevronDown size={12} className={`shrink-0 opacity-80 transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>
      {menu}
    </>
  );
}

export interface Candidate {
  id: string;
  name: string;
  avatar: string | null;
  designation: string;
  company: string;
  experience: number;
  /** Pre-formatted for table (`7y`, `<1y`, `—`). */
  experienceLabel?: string;
  location: string;
  assignedJobs: string[];
  stage: string;
  owner: string;
  lastActivity: string;
  auditMeta?: AuditMeta;
  hotlist: boolean;
  phone: string;
  email: string;
  skills: string[];
  noticePeriod: string;
  salary: { current: string; expected: string };
  source: string;
  rating: number;
  pipelineJobId?: string;
  /** Backend match id when known (submit to client) */
  matchId?: string;
  /** Optional AI / applied match score (0–100) for job drawer and similar views */
  matchScore?: number;
  matchScoreBand?: string;
  /** Phase 1 / candidatecommon pool */
  isPhase1Candidate?: boolean;
  /** Discovery-only — not yet linked to a tenant job */
  isNewCandidate?: boolean;
  /** Linked to a job via apply or assign — stage Applied */
  isJobAppliedCandidate?: boolean;
  /** Bulk duplicate copy badge, e.g. "Copy 1" */
  bulkCopyLabel?: string | null;
  /** Smart-search haystack fields (optional, not shown in table). */
  assignedToId?: string;
  backendStatus?: string;
  city?: string;
  country?: string;
  cvSummary?: string;
  education?: string;
  languagesList?: string[];
  certificationsList?: string[];
  availability?: string;
  linkedIn?: string;
  portfolio?: string;
  preferredLocation?: string;
  workExperienceText?: string;
  projectsText?: string;
}

interface CandidateTableProps {
  candidates: Candidate[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onViewProfile?: (candidate: Candidate) => void;
  onWhatsAppCandidate?: (candidate: Candidate) => void;
  onEditCandidate?: (candidate: Candidate) => void;
  /** Opens move-stage flow (e.g. job drawer pipeline modal). */
  onMoveStage?: (candidate: Candidate) => void;
  /** Permanently delete candidate (parent should confirm + call API). */
  onDeleteCandidate?: (candidate: Candidate) => void | Promise<void>;
  /** When set, that row shows a loading state on the delete control */
  deletingCandidateId?: string | null;
  stageOptionsByJobId?: Record<string, Array<{ id: string; name: string }>>;
  stageOptionsLoadingJobId?: string | null;
  movingCandidateId?: string | null;
  onLoadStageOptions?: (candidate: Candidate) => void | Promise<void>;
  onChangeCandidateStage?: (candidate: Candidate, stageId: string) => void | Promise<void>;
  /** Show match score column (job drawer after Run AI Applied Matches) */
  showMatchScore?: boolean;
  /** Opens Submit to Client drawer (same as Interviews page) */
  onSubmitToClient?: (candidate: Candidate) => void;
  /** When set, only rows passing this check show the submit action */
  canSubmitToClient?: (candidate: Candidate) => boolean;
  /** Row id currently opening submit modal */
  submittingToClientCandidateId?: string | null;
  workspaceAlertsByEntityId?: Record<string, AiWorkspaceBriefAlert[]>;
  /** When true, omit overflow wrappers so a parent scroll region owns scrolling. */
  fillScrollParent?: boolean;
}

export const CandidateTable: React.FC<CandidateTableProps> = ({
  candidates,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onViewProfile,
  onWhatsAppCandidate,
  onEditCandidate,
  onMoveStage,
  onDeleteCandidate,
  deletingCandidateId,
  stageOptionsByJobId = {},
  stageOptionsLoadingJobId = null,
  movingCandidateId = null,
  onLoadStageOptions,
  onChangeCandidateStage,
  showMatchScore = false,
  onSubmitToClient,
  canSubmitToClient,
  submittingToClientCandidateId,
  workspaceAlertsByEntityId,
  fillScrollParent = false,
}) => {
  const allSelected = candidates.length > 0 && selectedIds.length === candidates.length;
  const showAiAlertColumn = Boolean(
    workspaceAlertsByEntityId &&
      Object.values(workspaceAlertsByEntityId).some((alerts) => alerts.length > 0),
  );

  return (
    <div
      className={
        fillScrollParent
          ? 'contents'
          : 'overflow-hidden rounded-xl border border-indigo-100/70 bg-white shadow-[0_10px_28px_-18px_rgba(79,70,229,0.22)]'
      }
    >
      <div
        className={
          fillScrollParent
            ? 'contents'
            : 'overflow-x-auto [scrollbar-width:thin] [scrollbar-color:rgba(129,140,248,0.45)_transparent]'
        }
      >
        <table className="w-full min-w-[1180px] border-collapse text-left">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-indigo-100/60 bg-gradient-to-r from-slate-50 via-indigo-50/55 to-violet-50/40 text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-900/50 backdrop-blur-md">
              <th className="w-10 px-3 py-3 first:pl-4 sm:px-4 sm:first:pl-5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleSelectAll}
                  className="h-4 w-4 cursor-pointer rounded border-indigo-200 text-indigo-600 focus:ring-indigo-500/30"
                />
              </th>
              <th className="px-3 py-3 sm:px-4">Candidate</th>
              {showMatchScore ? (
                <th className="px-3 py-3 text-center sm:px-4">Match</th>
              ) : null}
              <th className="px-3 py-3 sm:px-4">Role / company</th>
              <th className="px-3 py-3 text-center sm:px-4">Exp</th>
              <th className="px-3 py-3 sm:px-4">Location</th>
              <th className="px-3 py-3 sm:px-4">Assigned job</th>
              <th className="px-3 py-3 sm:px-4">Stage</th>
              <th className="px-3 py-3 sm:px-4">Team Member</th>
              {showAiAlertColumn ? <WorkspaceAlertTableHeader /> : null}
              <TableAuditColumnHeader />
              <th className="px-3 py-3 text-right sm:px-4 sm:pr-5">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-indigo-50/80">
            {candidates.map((candidate) => (
              <tr
                key={candidate.id}
                onClick={() => onViewProfile?.(candidate)}
                className={`group transition-colors duration-150 hover:bg-indigo-50/50 ${
                  onViewProfile ? 'cursor-pointer' : ''
                } ${
                  selectedIds.includes(candidate.id)
                    ? 'bg-indigo-50/80 shadow-[inset_3px_0_0_0_rgb(99,102,241)]'
                    : 'even:bg-slate-50/40'
                }`}
              >
                <td
                  className="px-3 py-3 first:pl-4 sm:px-4 sm:py-3.5 sm:first:pl-5"
                  onClick={(event) => event.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(candidate.id)}
                    onChange={() => onToggleSelect(candidate.id)}
                    className="h-4 w-4 cursor-pointer rounded border-indigo-200 text-indigo-600 focus:ring-indigo-500/30"
                  />
                </td>
                <td className="px-3 py-3 sm:px-4 sm:py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <ImageWithFallback
                        src={candidate.avatar || ''}
                        fallbackInitials={initialsFromDisplayName(candidate.name)}
                        className="h-10 w-10 rounded-full object-cover ring-2 ring-white shadow-sm shadow-indigo-500/10"
                        alt={candidate.name}
                      />
                      <div
                        className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-indigo-100"
                        title={getCandidateStageLabel(candidate.stage)}
                      >
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${getCandidateStageDotClasses(candidate.stage)}`}
                        />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onViewProfile?.(candidate)}
                        className="text-left text-sm font-semibold text-slate-900 transition-colors hover:text-indigo-700"
                      >
                        {candidate.name}
                      </button>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        {candidate.isPhase1Candidate ? (
                          <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700 ring-1 ring-violet-100">
                            Phase 1
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </td>
                {showMatchScore ? (
                  <td className="px-3 py-3 text-center sm:px-4 sm:py-3.5">
                    {(candidate.matchScore ?? 0) > 0 ? (
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className={`inline-flex min-w-[2.85rem] items-center justify-center rounded-full px-2.5 py-1 text-xs font-bold tabular-nums shadow-sm ${scoreBadgeClass(candidate.matchScore ?? 0)}`}
                        >
                          {candidate.matchScore}%
                        </span>
                        <span className="max-w-[5.5rem] truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          {candidate.matchScoreBand ||
                            displayMatchBand(candidate.matchScore ?? 0)}
                        </span>
                      </div>
                    ) : (
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Not scored
                      </span>
                    )}
                  </td>
                ) : null}
                <td className="px-3 py-3 sm:px-4 sm:py-3.5">
                  <div>
                    <p className="max-w-[140px] truncate text-sm font-semibold text-slate-800">
                      {candidate.designation}
                    </p>
                    <p className="mt-0.5 max-w-[140px] truncate text-xs text-slate-500">
                      {candidate.company}
                    </p>
                  </div>
                </td>
                <td className="px-3 py-3 text-center sm:px-4 sm:py-3.5">
                  <span className="inline-flex min-w-[2.25rem] items-center justify-center rounded-lg bg-slate-100/90 px-2 py-1 text-xs font-bold tabular-nums text-slate-700 ring-1 ring-slate-200/70">
                    {candidate.experienceLabel ??
                      (() => {
                        const exp = Number(candidate.experience);
                        if (!Number.isFinite(exp) || exp <= 0) return '—';
                        return `${Number.isInteger(exp) ? exp : exp.toFixed(1)}y`;
                      })()}
                  </span>
                </td>
                <td className="px-3 py-3 sm:px-4 sm:py-3.5">
                  <div className="inline-flex max-w-[140px] items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1 text-slate-600 ring-1 ring-slate-200/70">
                    <MapPin size={13} className="shrink-0 text-indigo-400" />
                    <span className="truncate text-xs font-medium">{candidate.location}</span>
                  </div>
                </td>
                <td className="px-3 py-3 sm:px-4 sm:py-3.5">
                  <div className="inline-flex max-w-[150px] items-center gap-1.5 rounded-lg bg-indigo-50/70 px-2 py-1 text-indigo-800 ring-1 ring-indigo-100">
                    <Briefcase size={13} className="shrink-0 text-indigo-500" />
                    <p className="truncate text-xs font-semibold">
                      {candidate.assignedJobs?.[0] || '—'}
                    </p>
                  </div>
                </td>
                <td
                  className="px-3 py-3 sm:px-4 sm:py-3.5"
                  onClick={(event) => event.stopPropagation()}
                >
                  {onChangeCandidateStage && candidate.pipelineJobId ? (
                    <CandidateStageMoveDropdown
                      candidate={candidate}
                      options={stageOptionsByJobId[candidate.pipelineJobId] || []}
                      loadingOptions={stageOptionsLoadingJobId === candidate.pipelineJobId}
                      moving={movingCandidateId === candidate.id}
                      showSubmitToClient={Boolean(
                        onSubmitToClient &&
                          (!canSubmitToClient || canSubmitToClient(candidate)),
                      )}
                      onOpen={() => void onLoadStageOptions?.(candidate)}
                      onChangeStage={(stageId) => onChangeCandidateStage(candidate, stageId)}
                      onSubmitToClient={
                        onSubmitToClient
                          ? () => {
                              onSubmitToClient(candidate);
                            }
                          : undefined
                      }
                    />
                  ) : (
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getCandidateStageBadgeClasses(candidate.stage)}`}
                    >
                      {getCandidateStageLabel(candidate.stage)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 sm:px-4 sm:py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-[10px] font-bold text-white shadow-sm shadow-indigo-500/25">
                      {(candidate.owner || 'U')
                        .split(' ')
                        .filter(Boolean)
                        .map((n) => n[0])
                        .join('')}
                    </div>
                    <span className="max-w-[80px] truncate text-sm font-medium text-slate-700">
                      {candidate.owner}
                    </span>
                  </div>
                </td>
                {showAiAlertColumn ? (
                  <td className="px-3 py-3 sm:px-4 sm:py-3.5">
                    <WorkspaceAlertTableCell alerts={workspaceAlertsByEntityId?.[candidate.id]} />
                  </td>
                ) : null}
                <TableAuditCell audit={candidate.auditMeta} />
                <td className="px-3 py-3 text-right sm:px-4 sm:py-3.5 sm:pr-5">
                  <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center justify-end gap-0.5 rounded-2xl bg-indigo-50/60 p-1 opacity-90 ring-1 ring-indigo-100/80 transition group-hover:opacity-100">
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-xl text-emerald-600 transition-all hover:bg-white hover:text-emerald-800 hover:shadow-sm"
                        title="WhatsApp"
                        onClick={(e) => {
                          e.stopPropagation();
                          onWhatsAppCandidate?.(candidate);
                        }}
                      >
                        <WhatsAppIcon size={16} />
                      </button>
                      {onSubmitToClient &&
                      (!canSubmitToClient || canSubmitToClient(candidate)) ? (
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-xl text-indigo-600 transition-all hover:bg-white hover:text-indigo-800 hover:shadow-sm disabled:opacity-50"
                          title="Submit to client"
                          disabled={submittingToClientCandidateId === candidate.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSubmitToClient(candidate);
                          }}
                        >
                          {submittingToClientCandidateId === candidate.id ? (
                            <Loader2 size={16} className="animate-spin" strokeWidth={2.25} />
                          ) : (
                            <Send size={16} strokeWidth={2.25} />
                          )}
                        </button>
                      ) : null}
                      {onMoveStage ? (
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-xl text-violet-600 transition-all hover:bg-white hover:text-violet-800 hover:shadow-sm"
                          title="Move stage"
                          onClick={(e) => {
                            e.stopPropagation();
                            onMoveStage(candidate);
                          }}
                        >
                          <ArrowRightLeft size={16} strokeWidth={2.25} />
                        </button>
                      ) : null}
                      {SHOW_TABLE_ROW_EDIT_ICON ? (
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-xl text-amber-600 transition-all hover:bg-white hover:text-amber-800 hover:shadow-sm"
                          title="Edit candidate"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditCandidate?.(candidate);
                          }}
                        >
                          <Pencil size={16} strokeWidth={2.25} />
                        </button>
                      ) : null}
                      {onDeleteCandidate && (
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-xl text-rose-500 transition-all hover:bg-white hover:text-rose-700 hover:shadow-sm disabled:pointer-events-none disabled:opacity-50"
                          title="Delete candidate"
                          disabled={deletingCandidateId === candidate.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            void onDeleteCandidate(candidate);
                          }}
                        >
                          {deletingCandidateId === candidate.id ? (
                            <Loader2 size={16} className="animate-spin text-rose-600" />
                          ) : (
                            <Trash2 size={16} strokeWidth={2.25} />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
