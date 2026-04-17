import React from 'react';
import { Search } from 'lucide-react';
import CandidateCard from './CandidateCard';
import type { ActiveView, MatchCandidate, MatchMode } from './types';

interface CandidateListProps {
  candidates: MatchCandidate[];
  activeTab: MatchMode;
  activeView: ActiveView;
  selectedCandidates: string[];
  savedMatches: string[];
  expandedAnalysis: string | null;
  copiedCandidateId: string | null;
  sortBy: string;
  onSortChange: (value: string) => void;
  onToggleSelect: (candidateId: string) => void;
  onToggleSave: (candidateId: string) => void;
  onCopyLink: (candidateId: string) => void;
  onToggleAnalysis: (candidateId: string) => void;
  onViewProfile: (candidateId: string, tab?: 'overview' | 'resume' | 'ai' | 'notes' | 'activity') => void;
  onOpenPipeline: (candidateId: string) => void;
  onOpenSubmit: (candidateId: string) => void;
  onOpenReject: (candidateId: string) => void;
  onExport: (candidateId: string) => void;
  onRateMatch: (candidateId: string, rating: number) => void;
  onResetFilters: () => void;
}

export default function CandidateList({
  candidates,
  activeTab,
  activeView,
  selectedCandidates,
  savedMatches,
  expandedAnalysis,
  copiedCandidateId,
  sortBy,
  onSortChange,
  onToggleSelect,
  onToggleSave,
  onCopyLink,
  onToggleAnalysis,
  onViewProfile,
  onOpenPipeline,
  onOpenSubmit,
  onOpenReject,
  onExport,
  onRateMatch,
  onResetFilters,
}: CandidateListProps) {
  return (
    <div className="px-6 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-[16px] font-semibold text-slate-900">
              {activeTab === 'manual' ? 'Manual Candidates' : 'AI Matches'}
              <span className="ml-2 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-[#2563EB]">
                {candidates.length}
              </span>
            </h2>
            <p className="mt-1 text-sm text-[#6B7280]">
              {activeTab === 'manual'
                ? 'Showing hand-picked candidates for this position.'
                : 'Showing score-based candidates ranked by AI.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-[#6B7280]">Sort by:</span>
            <select
              value={sortBy}
              onChange={(event) => onSortChange(event.target.value)}
              className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[#2563EB]"
            >
              <option value="Highest Match">Highest Match</option>
              <option value="Experience">Experience</option>
              <option value="Status">Status</option>
            </select>
          </div>
        </div>

        {candidates.length ? (
          <div className="space-y-4">
            {candidates.map((candidate) => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                activeView={activeView}
                isSelected={selectedCandidates.includes(candidate.id)}
                isSaved={savedMatches.includes(candidate.id)}
                isExpanded={expandedAnalysis === candidate.id}
                copied={copiedCandidateId === candidate.id}
                onToggleSelect={() => onToggleSelect(candidate.id)}
                onToggleSave={() => onToggleSave(candidate.id)}
                onCopyLink={() => onCopyLink(candidate.id)}
                onToggleAnalysis={() => onToggleAnalysis(candidate.id)}
                onViewProfile={() => onViewProfile(candidate.id)}
                onOpenPipeline={() => onOpenPipeline(candidate.id)}
                onOpenSubmit={() => onOpenSubmit(candidate.id)}
                onOpenReject={() => onOpenReject(candidate.id)}
                onOpenHistory={() => onViewProfile(candidate.id, 'activity')}
                onOpenNotes={() => onViewProfile(candidate.id, 'notes')}
                onExport={() => onExport(candidate.id)}
                onRateMatch={(rating) => onRateMatch(candidate.id, rating)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-[#E5E7EB] bg-white px-6 py-20 text-center">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
              <Search size={30} className="text-slate-300" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">
              No candidates match your current filters
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-[#6B7280]">
              Try widening the filters or reset them to see the full candidate pool again.
            </p>
            <button
              type="button"
              onClick={onResetFilters}
              className="mt-6 rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
