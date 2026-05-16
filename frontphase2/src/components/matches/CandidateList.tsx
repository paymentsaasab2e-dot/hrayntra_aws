import React, { useMemo, useCallback } from 'react';
import { Search } from 'lucide-react';
import MatchCandidateTable from './MatchCandidateTable';
import { TableSkeleton } from '../ui/Skeleton';
import {
  AI_SCORE_TIERS,
  computeAiTierStats,
  tierSectionStyles,
  type ActiveView,
  type AiScoreTierId,
  type MatchCandidate,
  type MatchMode,
  tierForScore,
} from './types';

interface CandidateListProps {
  candidates: MatchCandidate[];
  activeTab: MatchMode;
  activeView: ActiveView;
  selectedCandidates: string[];
  savedMatches: string[];
  expandedAnalysis: string | null;
  sortBy: string;
  savedOnly?: boolean;
  onSortChange: (value: string) => void;
  onToggleSelect: (candidateId: string) => void;
  onToggleSave: (candidateId: string) => void;
  onToggleAnalysis: (candidateId: string) => void;
  onViewProfile: (candidateId: string, tab?: 'overview' | 'resume' | 'ai' | 'notes' | 'activity') => void;
  onOpenPipeline: (candidateId: string) => void;
  onOpenSubmit: (candidateId: string) => void;
  onOpenReject: (candidateId: string) => void;
  onExport: (candidateId: string) => void;
  onRateMatch: (candidateId: string, rating: number) => void;
  onResetFilters: () => void;
  embedded?: boolean;
  loading?: boolean;
}

export default function CandidateList(props: CandidateListProps) {
  const {
    candidates,
    activeTab,
    activeView,
    selectedCandidates,
    savedMatches,
    expandedAnalysis,
    sortBy,
    savedOnly,
    onSortChange,
    onToggleSelect,
    onToggleSave,
    onToggleAnalysis,
    onViewProfile,
    onOpenPipeline,
    onOpenSubmit,
    onOpenReject,
    onExport,
    onRateMatch,
    onResetFilters,
    embedded = false,
    loading = false,
  } = props;

  const heading = savedOnly
    ? 'Saved Matches'
    : activeTab === 'manual'
      ? 'AI Applied Matches'
      : 'AI Matches';
  const subtitle = savedOnly
    ? 'Showing only matches you bookmarked. Toggle "Saved only" off in the filter bar to see everyone.'
    : activeTab === 'manual'
      ? 'Tenant candidates assigned to this job. Use Run AI Applied Matches to score.'
      : 'All scored candidates are grouped by match band. Run AI Matches to refresh scores for the selected job.';

  const aiTierStats = useMemo(
    () => (activeTab === 'ai' ? computeAiTierStats(candidates) : null),
    [activeTab, candidates]
  );

  const aiTierGroups = useMemo(() => {
    if (activeTab !== 'ai' || !candidates.length) return null;
    const buckets: Record<AiScoreTierId, MatchCandidate[]> = {
      tier100_80: [],
      tier80_60: [],
      tier50_59: [],
      tierBelow50: [],
    };
    for (const c of candidates) {
      if (c.isAppliedCandidate) continue;
      buckets[tierForScore(c.score)].push(c);
    }
    for (const id of Object.keys(buckets) as AiScoreTierId[]) {
      buckets[id].sort((a, b) => b.score - a.score);
    }
    return AI_SCORE_TIERS.map((tier) => ({
      ...tier,
      candidates: buckets[tier.id],
    })).filter((g) => g.candidates.length > 0);
  }, [activeTab, candidates]);

  const handleToggleSelectAll = useCallback(
    (list: MatchCandidate[]) => {
      const allInList = list.length > 0 && list.every((c) => selectedCandidates.includes(c.id));
      if (allInList) {
        list.filter((c) => selectedCandidates.includes(c.id)).forEach((c) => onToggleSelect(c.id));
      } else {
        list.filter((c) => !selectedCandidates.includes(c.id)).forEach((c) => onToggleSelect(c.id));
      }
    },
    [onToggleSelect, selectedCandidates]
  );

  const tableProps = {
    activeView,
    selectedCandidates,
    savedMatches,
    expandedAnalysis,
    showMatchScore: activeTab === 'ai',
    onToggleSelect,
    onToggleSave,
    onToggleAnalysis,
    onViewProfile: (id: string) => onViewProfile(id),
    onOpenPipeline,
    onOpenSubmit,
    onOpenReject,
    onRateMatch,
  };

  const renderTable = (list: MatchCandidate[], keyPrefix: string) => (
    <MatchCandidateTable
      key={keyPrefix}
      candidates={list}
      {...tableProps}
      onToggleSelectAll={() => handleToggleSelectAll(list)}
    />
  );

  return (
    <div className={embedded ? 'px-3 pb-4 pt-2 sm:px-4 sm:pb-5' : 'px-6 py-8 sm:px-8'}>
      <div className={embedded ? '' : 'mx-auto max-w-6xl'}>
        <div className="mb-4 flex flex-col gap-3 sm:mb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h2
              className={
                embedded
                  ? 'text-sm font-bold uppercase tracking-wide text-indigo-950/80'
                  : 'text-[16px] font-semibold text-slate-900'
              }
            >
              {heading}
              <span
                className={
                  embedded
                    ? 'ml-2 inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-700 ring-1 ring-indigo-200/60'
                    : 'ml-2 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-[#2563EB]'
                }
              >
                {loading ? '…' : candidates.length}
              </span>
            </h2>
            <p className={`mt-1 text-sm ${embedded ? 'text-slate-500' : 'text-[#6B7280]'}`}>{subtitle}</p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <span className={`text-xs font-medium ${embedded ? 'text-slate-500' : 'text-sm text-[#6B7280]'}`}>
              Sort by:
            </span>
            <select
              value={sortBy}
              onChange={(event) => onSortChange(event.target.value)}
              className={
                embedded
                  ? 'rounded-lg border border-indigo-100/90 bg-white/95 px-2.5 py-1.5 text-xs font-medium text-slate-800 shadow-sm outline-none transition-all focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/25'
                  : 'rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[#2563EB]'
              }
            >
              <option value="Highest Match">Highest Match</option>
              <option value="Experience">Experience</option>
              <option value="Status">Status</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="overflow-hidden rounded-lg border border-indigo-100/40 bg-white/50 p-2">
            <TableSkeleton rows={embedded ? 8 : 10} columns={7} />
          </div>
        ) : candidates.length ? (
          <div className="space-y-6">
            {aiTierStats ? (
              <div className="rounded-xl border border-indigo-100/80 bg-gradient-to-r from-indigo-50/50 via-white to-violet-50/40 px-3 py-3 sm:px-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-900/70">
                  AI match summary
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {AI_SCORE_TIERS.map((tier) => {
                    const count = aiTierStats[tier.id];
                    const styles = tierSectionStyles(tier.id);
                    return (
                      <span
                        key={tier.id}
                        className={`inline-flex items-center gap-1.5 rounded-full border bg-white px-2.5 py-1 text-[11px] font-semibold ring-1 ${styles.badge}`}
                      >
                        <span className={styles.title}>{tier.label}</span>
                        <span className="tabular-nums">{count}</span>
                      </span>
                    );
                  })}
                </div>
                {aiTierStats.tier80_60 > 0 ? (
                  <p className="mt-2 text-xs text-emerald-800">
                    Top picks (60–79): review Phase 1 dev profiles first — strongest skill overlap for this role.
                  </p>
                ) : null}
              </div>
            ) : null}
            {aiTierGroups
              ? aiTierGroups.map((group) => {
                  const styles = tierSectionStyles(group.id);
                  return (
                    <section key={group.id} className="space-y-2">
                      <div
                        className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 ${styles.header}`}
                      >
                        <h3 className={`text-xs font-bold uppercase tracking-wide ${styles.title}`}>
                          Match score {group.label}
                          {group.id === 'tier80_60' ? ' · top picks' : ''}
                        </h3>
                        <span
                          className={`rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold ring-1 ${styles.badge}`}
                        >
                          {group.candidates.length}
                        </span>
                      </div>
                      {renderTable(group.candidates, group.id)}
                    </section>
                  );
                })
              : renderTable(candidates, 'all')}
          </div>
        ) : (
          <div
            className={
              embedded
                ? 'rounded-xl border border-dashed border-indigo-200/70 bg-gradient-to-br from-slate-50/80 via-white to-indigo-50/30 px-4 py-16 text-center sm:px-6'
                : 'rounded-3xl border border-dashed border-[#E5E7EB] bg-white px-6 py-20 text-center'
            }
          >
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
              <Search size={30} className="text-slate-300" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">No candidates match your current filters</h3>
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
