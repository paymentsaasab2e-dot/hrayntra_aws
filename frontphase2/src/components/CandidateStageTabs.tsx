import React from 'react';

const stages = [
  { id: 'all', label: 'All', count: 1240 },
  { id: 'applied', label: 'Applied', count: 45 },
  { id: 'longlist', label: 'Longlist', count: 120 },
  { id: 'shortlist', label: 'Shortlist', count: 32 },
  { id: 'screening', label: 'Screening', count: 18 },
  { id: 'submitted', label: 'Submitted', count: 12 },
  { id: 'interviewing', label: 'Interviewing', count: 8 },
  { id: 'offered', label: 'Offered', count: 4 },
  { id: 'hired', label: 'Hired', count: 950 },
  { id: 'rejected', label: 'Rejected', count: 52 },
];

interface CandidateStageTabsProps {
  activeStage: string;
  onStageChange: (id: string) => void;
}

export const CandidateStageTabs: React.FC<CandidateStageTabsProps> = ({ activeStage, onStageChange }) => {
  return (
    <div className="bg-white border-b border-slate-200 px-6 overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-2">
        {stages.map((stage) => (
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
              {stage.count}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
