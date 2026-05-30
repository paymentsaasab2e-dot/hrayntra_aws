'use client';

import React from 'react';
import type { ModuleTabKey } from '@/lib/dashboard/moduleCommandConfig';

type Tab = { key: ModuleTabKey; label: string };

type Props = {
  tabs: Tab[];
  active: ModuleTabKey;
  onChange: (key: ModuleTabKey) => void;
};

export function DashboardModuleTabs({ tabs, active, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200/80 bg-slate-50/80 p-1">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
              isActive
                ? 'bg-white text-indigo-800 shadow-sm ring-1 ring-indigo-100'
                : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
