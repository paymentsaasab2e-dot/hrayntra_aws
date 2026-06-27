'use client';

import React from 'react';

export type InterviewModuleTab = 'scheduled' | 'applications' | 'interviewer';

type Props = {
  active: InterviewModuleTab;
  onChange: (tab: InterviewModuleTab) => void;
};

const TABS: { key: InterviewModuleTab; label: string }[] = [
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'applications', label: 'Applications' },
  { key: 'interviewer', label: 'Interviewer' },
];

export function InterviewModuleTabs({ active, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl border border-indigo-100/90 bg-white/95 p-1 shadow-sm">
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
              isActive
                ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-indigo-50/60 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
