import React from 'react';
import { SHOW_TABLE_ROW_EDIT_ICON } from '../../../constants/tableUi';
import {
  Eye,
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

export type { CandidateTableColumnFilters } from './CandidateTableFilters';
export { EMPTY_CANDIDATE_TABLE_COLUMN_FILTERS } from './CandidateTableFilters';

export interface Candidate {
  id: string;
  name: string;
  avatar: string | null;
  designation: string;
  company: string;
  experience: number;
  location: string;
  assignedJobs: string[];
  stage: string;
  owner: string;
  lastActivity: string;
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
  // Inline-stage props are still accepted (kept on the interface for parent compatibility)
  // but no longer wired to the cell — the stage column is read-only from the table now.
  showMatchScore = false,
  onSubmitToClient,
  canSubmitToClient,
  submittingToClientCandidateId,
}) => {
  const allSelected = candidates.length > 0 && selectedIds.length === candidates.length;

  return (
    <div className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="sticky top-0 z-10 border-b border-indigo-100/50 bg-gradient-to-r from-slate-50/95 via-indigo-50/50 to-violet-50/40 text-[9px] font-bold uppercase tracking-[0.12em] text-indigo-950/45">
              <th className="w-10 px-3 py-2 first:pl-4 sm:px-4">
                <input 
                  type="checkbox" 
                  checked={allSelected}
                  onChange={onToggleSelectAll}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </th>
              <th className="px-3 py-2 sm:px-4">Candidate</th>
              {showMatchScore ? (
                <th className="px-3 py-2 text-center sm:px-4">Match</th>
              ) : null}
              <th className="px-3 py-2 sm:px-4">Role / company</th>
              <th className="px-3 py-2 text-center sm:px-4">Exp</th>
              <th className="px-3 py-2 sm:px-4">Location</th>
              <th className="px-3 py-2 sm:px-4">Assigned job</th>
              <th className="px-3 py-2 sm:px-4">Stage</th>
              <th className="px-3 py-2 sm:px-4">Owner</th>
              <th className="px-3 py-2 text-right sm:px-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {candidates.map((candidate) => (
              <tr 
                key={candidate.id}
                onClick={() => onViewProfile?.(candidate)}
                className={`transition-colors duration-200 hover:bg-indigo-50/45 ${
                  onViewProfile ? 'cursor-pointer' : ''
                } ${selectedIds.includes(candidate.id) ? 'bg-indigo-50/90' : 'even:bg-slate-50/35'}`}
              >
                <td
                  className="px-3 py-2.5 first:pl-4 sm:px-4 sm:py-3"
                  onClick={(event) => event.stopPropagation()}
                >
                  <input 
                    type="checkbox" 
                    checked={selectedIds.includes(candidate.id)}
                    onChange={() => onToggleSelect(candidate.id)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </td>
                <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <ImageWithFallback 
                        src={candidate.avatar || ''} 
                        fallbackInitials={initialsFromDisplayName(candidate.name)}
                        className="w-10 h-10 rounded-full object-cover ring-2 ring-white"
                        alt={candidate.name}
                      />
                      <div
                        className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-white"
                        title={getCandidateStageLabel(candidate.stage)}
                      >
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${getCandidateStageDotClasses(candidate.stage)}`}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onViewProfile?.(candidate)}
                          className="text-left text-sm font-semibold text-slate-900 hover:text-blue-600"
                        >
                          {candidate.name}
                        </button>
                        {candidate.isJobAppliedCandidate ? (
                          <span className="inline-flex rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-800">
                            Applied
                          </span>
                        ) : candidate.isNewCandidate ? (
                          <span className="inline-flex rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-800">
                            New
                          </span>
                        ) : null}
                        {candidate.isPhase1Candidate &&
                        !candidate.isNewCandidate &&
                        !candidate.isJobAppliedCandidate ? (
                          <span className="inline-flex rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-800">
                            Phase 1
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </td>
                {showMatchScore ? (
                  <td className="px-3 py-2.5 text-center sm:px-4 sm:py-3">
                    {(candidate.matchScore ?? 0) > 0 ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <span
                          className={`inline-flex min-w-[2.75rem] items-center justify-center rounded-lg px-2 py-1 text-xs font-bold tabular-nums ${scoreBadgeClass(candidate.matchScore ?? 0)}`}
                        >
                          {candidate.matchScore}%
                        </span>
                        <span className="max-w-[5.5rem] truncate text-[10px] font-medium text-slate-500">
                          {candidate.matchScoreBand ||
                            displayMatchBand(candidate.matchScore ?? 0)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs font-medium text-slate-400">Not scored</span>
                    )}
                  </td>
                ) : null}
                <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                  <div>
                    <p className="text-sm text-slate-700 font-medium truncate max-w-[130px]">{candidate.designation}</p>
                    <p className="text-xs text-slate-500 truncate max-w-[130px]">{candidate.company}</p>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-center sm:px-4 sm:py-3">
                  <span className="text-sm font-medium text-slate-600">{candidate.experience}y</span>
                </td>
                <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <MapPin size={14} className="shrink-0" />
                    <span className="text-sm truncate max-w-[100px]">{candidate.location}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                  <div className="flex items-center gap-2">
                    <Briefcase size={14} className="text-slate-400 shrink-0" />
                    <p className="text-sm text-slate-600 truncate max-w-[120px] font-medium">
                      {candidate.assignedJobs[0] || '--'}
                    </p>
                  </div>
                </td>
                <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                  {/* Stage is read-only on the list — recruiters change it from the candidate
                      edit drawer / profile drawer instead of inline. Keeping it as a chip avoids
                      accidental moves and matches the rest of the row's look-and-feel. */}
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getCandidateStageBadgeClasses(candidate.stage)}`}
                  >
                    {getCandidateStageLabel(candidate.stage)}
                  </span>
                </td>
                <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold">
                      {candidate.owner.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span className="text-sm text-slate-600 truncate max-w-[80px]">{candidate.owner}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right sm:px-4 sm:py-3">
                  {/* Colored action icons — matches the design used on the
                      Leads / Clients tabs so each verb has its own hue:
                      view = blue, message = emerald, edit = amber,
                      delete = rose. */}
                  <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center justify-end gap-0.5 rounded-2xl bg-slate-100/70 p-1 ring-1 ring-slate-200/60">
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-xl text-blue-600 hover:bg-white hover:text-blue-700 hover:shadow-sm transition-all"
                        title="View Profile"
                        onClick={() => onViewProfile?.(candidate)}
                      >
                        <Eye size={16} strokeWidth={2.25} />
                      </button>
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-xl text-emerald-600 hover:bg-white hover:text-emerald-800 hover:shadow-sm transition-all"
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
                          className="flex h-8 w-8 items-center justify-center rounded-xl text-amber-600 hover:bg-white hover:text-amber-800 hover:shadow-sm transition-all"
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
                          className="flex h-8 w-8 items-center justify-center rounded-xl text-rose-500 hover:bg-white hover:text-rose-700 hover:shadow-sm transition-all disabled:opacity-50 disabled:pointer-events-none"
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
