import React from 'react';

// Trimmed to the canonical funnel stages so the strip stays scannable.
// (Longlist / Shortlist / Submitted / Rejected are still tracked in stats and
// surfaced through the Filters drawer, but kept out of the top-level tab row.)
const stages = [
  { id: 'all', label: 'All', countKey: 'all' as const },
  { id: 'applied', label: 'Applied', countKey: 'applied' as const },
  { id: 'screening', label: 'Screening', countKey: 'screening' as const },
  { id: 'interviewing', label: 'Interviewing', countKey: 'interviewing' as const },
  { id: 'offered', label: 'Offered', countKey: 'offered' as const },
  { id: 'hired', label: 'Hired', countKey: 'hired' as const },
];

export interface CandidateStageStats {
  all: number;
  applied: number;
  longlist: number;
  shortlist: number;
  screening: number;
  submitted: number;
  interviewing: number;
  offered: number;
  hired: number;
  rejected: number;
}

interface StageTabsProps {
  activeStage: string;
  onStageChange: (id: string) => void;
  /** Stats are fetched at the page level so that the KPI cards and this tab
   * strip share one round-trip. Pass `null` to render placeholders. */
  stats: CandidateStageStats | null;
  loading?: boolean;
}

export const StageTabs: React.FC<StageTabsProps> = ({
  activeStage,
  onStageChange,
  stats,
  loading = false,
}) => {
  return (
    <div className="bg-white border-b border-slate-200 px-6 overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-2">
        {stages.map((stage) => {
          const count = stats ? stats[stage.countKey] : 0;
          return (
            <button
              key={stage.id}
              onClick={() => onStageChange(stage.id)}
              className={`flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                activeStage === stage.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {stage.label}
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeStage === stage.id
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-slate-100 text-slate-500'
              }`}>
                {loading ? '...' : count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
