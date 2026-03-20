import React, { useEffect, useState } from 'react';
import { apiGetCandidateStats } from '../../../lib/api';

const stages = [
  { id: 'all', label: 'All', countKey: 'all' as const },
  { id: 'applied', label: 'Applied', countKey: 'applied' as const },
  { id: 'longlist', label: 'Longlist', countKey: 'longlist' as const },
  { id: 'shortlist', label: 'Shortlist', countKey: 'shortlist' as const },
  { id: 'screening', label: 'Screening', countKey: 'screening' as const },
  { id: 'submitted', label: 'Submitted', countKey: 'submitted' as const },
  { id: 'interviewing', label: 'Interviewing', countKey: 'interviewing' as const },
  { id: 'offered', label: 'Offered', countKey: 'offered' as const },
  { id: 'hired', label: 'Hired', countKey: 'hired' as const },
  { id: 'rejected', label: 'Rejected', countKey: 'rejected' as const },
];

interface StageTabsProps {
  activeStage: string;
  onStageChange: (id: string) => void;
  refreshTrigger?: number; // Optional trigger to refresh stats
}

export const StageTabs: React.FC<StageTabsProps> = ({ activeStage, onStageChange, refreshTrigger }) => {
  const [stats, setStats] = useState<{
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
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await apiGetCandidateStats();
      const statsData = res.data as typeof stats;
      setStats(statsData);
    } catch (error) {
      console.error('Failed to fetch candidate stats:', error);
      // Fallback to default counts
      setStats({
        all: 0,
        applied: 0,
        longlist: 0,
        shortlist: 0,
        screening: 0,
        submitted: 0,
        interviewing: 0,
        offered: 0,
        hired: 0,
        rejected: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [refreshTrigger]);
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
