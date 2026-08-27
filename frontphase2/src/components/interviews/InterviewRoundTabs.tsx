'use client';

import React from 'react';

type InterviewRoundTabsProps = {
  rounds: number[];
  active: number | 'all';
  onChange: (round: number | 'all') => void;
  /** Optional candidate counts keyed by round number */
  countsByRound?: Record<number, number>;
  allCount?: number;
};

export function InterviewRoundTabs({
  rounds,
  active,
  onChange,
  countsByRound,
  allCount,
}: InterviewRoundTabsProps) {
  if (rounds.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-indigo-200 bg-white/80 px-3 py-2 text-xs text-slate-500">
        No interview rounds yet — schedule an interview to create Round 1.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-xl border border-indigo-100/90 bg-white/95 p-1 shadow-sm">
      <button
        type="button"
        onClick={() => onChange('all')}
        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
          active === 'all'
            ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-sm'
            : 'text-slate-600 hover:bg-indigo-50/60 hover:text-slate-900'
        }`}
      >
        All rounds
        {typeof allCount === 'number' ? (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              active === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {allCount}
          </span>
        ) : null}
      </button>
      {rounds.map((round) => {
        const isActive = active === round;
        const count = countsByRound?.[round];
        return (
          <button
            key={round}
            type="button"
            onClick={() => onChange(round)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
              isActive
                ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-indigo-50/60 hover:text-slate-900'
            }`}
          >
            Round {round}
            {typeof count === 'number' ? (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
