'use client';

import React from 'react';
import {
  Bookmark,
  ChevronDown,
  GitMerge,
  MapPin,
  Pencil,
  Send,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { ImageWithFallback, initialsFromDisplayName } from '../ImageWithFallback';
import AIAnalysisPanel from './AIAnalysisPanel';
import type { ActiveView, MatchCandidate, MatchStatus } from './types';
import { displayMatchBand, scoreBadgeClass } from './types';
import type { AiWorkspaceBriefAlert } from '@/lib/apiAiWorkspaceBrief';
import { WorkspaceAlertTableCell, WorkspaceAlertTableHeader } from '../ai/WorkspaceAlertTableCell';

const statusColors: Record<MatchStatus, string> = {
  New: 'bg-blue-100 text-blue-700 border-blue-200',
  Reviewed: 'bg-slate-100 text-slate-700 border-slate-200',
  'Sent to Pipeline': 'bg-teal-100 text-teal-800 border-teal-200',
  Submitted: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  Selected: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  Rejected: 'bg-rose-100 text-rose-700 border-rose-200',
};

interface MatchCandidateTableProps {
  candidates: MatchCandidate[];
  activeView: ActiveView;
  selectedCandidates: string[];
  savedMatches: string[];
  expandedAnalysis: string | null;
  showMatchScore?: boolean;
  /** AI Applied Matches tab — label pipeline vs estimated scores */
  isAppliedMatchesTab?: boolean;
  onToggleSelect: (candidateId: string) => void;
  onToggleSelectAll: () => void;
  onToggleSave: (candidateId: string) => void;
  onToggleAnalysis: (candidateId: string) => void;
  onViewProfile: (candidateId: string) => void;
  onOpenPipeline: (candidateId: string) => void;
  onOpenSubmit: (candidateId: string) => void;
  onOpenReject: (candidateId: string) => void;
  onRateMatch: (candidateId: string, rating: number) => void;
  workspaceAlertsByEntityId?: Record<string, AiWorkspaceBriefAlert[]>;
}

export default function MatchCandidateTable({
  candidates,
  activeView,
  selectedCandidates,
  savedMatches,
  expandedAnalysis,
  showMatchScore = true,
  isAppliedMatchesTab = false,
  onToggleSelect,
  onToggleSelectAll,
  onToggleSave,
  onToggleAnalysis,
  onViewProfile,
  onOpenPipeline,
  onOpenSubmit,
  onOpenReject,
  onRateMatch,
  workspaceAlertsByEntityId,
}: MatchCandidateTableProps) {
  const allSelected = candidates.length > 0 && selectedCandidates.length === candidates.length;
  const showAiAlertColumn = Boolean(
    workspaceAlertsByEntityId &&
      Object.values(workspaceAlertsByEntityId).some((alerts) => alerts.length > 0),
  );
  const colCount = showMatchScore ? (showAiAlertColumn ? 9 : 8) : showAiAlertColumn ? 8 : 7;

  return (
    <div className="overflow-hidden rounded-lg border border-indigo-100/60 bg-white/80">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-left">
          <thead>
            <tr className="sticky top-0 z-10 border-b border-indigo-100/50 bg-gradient-to-r from-slate-50/95 via-indigo-50/50 to-violet-50/40 text-[9px] font-bold uppercase tracking-[0.12em] text-indigo-950/45">
              <th className="w-10 px-3 py-2 first:pl-4 sm:px-4">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleSelectAll}
                  className="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="px-3 py-2 sm:px-4">Candidate</th>
              {showMatchScore ? <th className="px-3 py-2 text-center sm:px-4">Match</th> : null}
              <th className="px-3 py-2 sm:px-4">Role / company</th>
              <th className="px-3 py-2 text-center sm:px-4">Exp</th>
              <th className="px-3 py-2 sm:px-4">Location</th>
              <th className="px-3 py-2 sm:px-4">Status</th>
              {showAiAlertColumn ? <WorkspaceAlertTableHeader /> : null}
              <th className="px-3 py-2 text-right sm:px-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {candidates.map((candidate) => {
              const isSelected = selectedCandidates.includes(candidate.id);
              const isSaved = savedMatches.includes(candidate.id);
              const isExpanded = expandedAnalysis === candidate.id;
              const band = displayMatchBand(candidate.score, candidate.explanation?.scoreBand);
              const hasPipelineScore = Boolean(candidate.matchId);
              const showScoreValue =
                candidate.score > 0 || hasPipelineScore || !candidate.isAppliedCandidate;
              const scoreSubLabel = isAppliedMatchesTab
                ? hasPipelineScore
                  ? band
                  : showScoreValue
                    ? 'Estimated'
                    : 'Not scored'
                : band;

              return (
                <React.Fragment key={candidate.id}>
                  <tr
                    className={`transition-colors duration-200 hover:bg-indigo-50/45 ${
                      isSelected ? 'bg-indigo-50/90' : 'even:bg-slate-50/35'
                    }`}
                  >
                    <td className="px-3 py-2.5 first:pl-4 sm:px-4 sm:py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect(candidate.id)}
                        className="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                      <div className="flex items-center gap-3">
                        <ImageWithFallback
                          src={candidate.photo || ''}
                          fallbackInitials={candidate.initials || initialsFromDisplayName(candidate.name)}
                          className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-white"
                          alt={candidate.name}
                        />
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => onViewProfile(candidate.id)}
                            className="truncate text-left text-sm font-semibold text-slate-900 hover:text-blue-600"
                          >
                            {candidate.name}
                          </button>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            {candidate.isAppliedCandidate ? (
                              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                                Applied
                              </span>
                            ) : null}
                            {candidate.isPhase1Candidate && !candidate.isAppliedCandidate ? (
                              <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-violet-700">
                                Phase 1
                              </span>
                            ) : null}
                            {candidate.skills.slice(0, 4).map((skill) => (
                              <span key={skill} className="truncate text-[10px] text-slate-400">
                                #{skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </td>
                    {showMatchScore ? (
                      <td className="px-3 py-2.5 text-center sm:px-4 sm:py-3">
                        <div className="flex flex-col items-center gap-1">
                          {showScoreValue ? (
                            <span
                              className={`inline-flex min-w-[3rem] justify-center rounded-lg px-2.5 py-1 text-sm font-bold tabular-nums ${scoreBadgeClass(
                                candidate.score
                              )}`}
                            >
                              {candidate.score}%
                            </span>
                          ) : (
                            <span className="inline-flex min-w-[3rem] justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-400">
                              —
                            </span>
                          )}
                          <span
                            className={`max-w-[96px] truncate text-[10px] font-medium ${
                              scoreSubLabel === 'Not scored' ? 'text-amber-600' : 'text-slate-500'
                            }`}
                          >
                            {scoreSubLabel}
                          </span>
                        </div>
                      </td>
                    ) : null}
                    <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                      <p className="max-w-[140px] truncate text-sm font-medium text-slate-700">
                        {candidate.currentTitle}
                      </p>
                      <p className="max-w-[140px] truncate text-xs text-slate-500">{candidate.currentCompany}</p>
                    </td>
                    <td className="px-3 py-2.5 text-center sm:px-4 sm:py-3">
                      <span className="text-sm font-medium text-slate-600">{candidate.experience}y</span>
                    </td>
                    <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                      <div className="flex max-w-[120px] items-center gap-1.5 text-slate-500">
                        <MapPin size={14} className="shrink-0" />
                        <span className="truncate text-sm">{candidate.location}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusColors[candidate.status]}`}
                      >
                        {candidate.status}
                      </span>
                    </td>
                    {showAiAlertColumn ? (
                      <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                        <WorkspaceAlertTableCell alerts={workspaceAlertsByEntityId?.[candidate.id]} />
                      </td>
                    ) : null}
                    <td className="px-3 py-2.5 text-right sm:px-4 sm:py-3">
                      <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center justify-end gap-0.5 rounded-2xl bg-slate-100/70 p-1 ring-1 ring-slate-200/60">
                          <button
                            type="button"
                            className="flex h-8 w-8 items-center justify-center rounded-xl text-amber-600 transition-all hover:bg-white hover:text-amber-800 hover:shadow-sm"
                            title="Edit profile"
                            onClick={() => onViewProfile(candidate.id)}
                          >
                            <Pencil size={16} strokeWidth={2.25} />
                          </button>
                          <button
                            type="button"
                            className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all hover:bg-white hover:shadow-sm ${
                              isSaved ? 'text-amber-600' : 'text-slate-500 hover:text-amber-600'
                            }`}
                            title={isSaved ? 'Saved' : 'Save match'}
                            onClick={() => onToggleSave(candidate.id)}
                          >
                            <Bookmark size={16} className={isSaved ? 'fill-current' : ''} strokeWidth={2.25} />
                          </button>
                          {activeView === 'internal' ? (
                            <>
                              <button
                                type="button"
                                className="flex h-8 w-8 items-center justify-center rounded-xl text-violet-600 transition-all hover:bg-white hover:text-violet-800 hover:shadow-sm"
                                title={isExpanded ? 'Hide AI analysis' : 'Show AI analysis'}
                                onClick={() => onToggleAnalysis(candidate.id)}
                              >
                                <Sparkles size={16} strokeWidth={2.25} />
                              </button>
                              <button
                                type="button"
                                className="flex h-8 w-8 items-center justify-center rounded-xl text-teal-600 transition-all hover:bg-white hover:text-teal-800 hover:shadow-sm"
                                title="Send to pipeline"
                                onClick={() => onOpenPipeline(candidate.id)}
                              >
                                <GitMerge size={16} strokeWidth={2.25} />
                              </button>
                              <button
                                type="button"
                                className="flex h-8 w-8 items-center justify-center rounded-xl text-indigo-600 transition-all hover:bg-white hover:text-indigo-800 hover:shadow-sm"
                                title="Submit to client"
                                onClick={() => onOpenSubmit(candidate.id)}
                              >
                                <Send size={16} strokeWidth={2.25} />
                              </button>
                              <button
                                type="button"
                                className="flex h-8 w-8 items-center justify-center rounded-xl text-rose-500 transition-all hover:bg-white hover:text-rose-700 hover:shadow-sm"
                                title="Reject"
                                onClick={() => onOpenReject(candidate.id)}
                              >
                                <XCircle size={16} strokeWidth={2.25} />
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </td>
                  </tr>
                  {activeView === 'internal' && isExpanded ? (
                    <tr className="bg-blue-50/30">
                      <td colSpan={colCount} className="px-4 py-3 sm:px-6">
                        <button
                          type="button"
                          onClick={() => onToggleAnalysis(candidate.id)}
                          className="mb-2 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-slate-500 hover:text-[#2563EB]"
                        >
                          Hide AI analysis
                          <ChevronDown size={14} className="rotate-180" />
                        </button>
                        <AIAnalysisPanel
                          candidate={candidate}
                          rating={candidate.matchRating}
                          onRate={(rating) => onRateMatch(candidate.id, rating)}
                        />
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
