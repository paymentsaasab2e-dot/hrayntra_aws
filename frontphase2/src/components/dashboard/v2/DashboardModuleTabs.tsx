'use client';

import React from 'react';
import { RotateCcw, X } from 'lucide-react';
import type { ModuleTabKey } from '@/lib/dashboard/moduleCommandConfig';

type Tab = { key: ModuleTabKey; label: string };

type Props = {
  tabs: Tab[];
  active: ModuleTabKey;
  onChange: (key: ModuleTabKey) => void;
  editMode?: boolean;
  onRemoveTab?: (key: ModuleTabKey) => void;
  hiddenTabs?: Tab[];
  onRestoreTab?: (key: ModuleTabKey) => void;
};

export function DashboardModuleTabs({
  tabs,
  active,
  onChange,
  editMode = false,
  onRemoveTab,
  hiddenTabs = [],
  onRestoreTab,
}: Props) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200/80 bg-slate-50/80 p-1">
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <div key={tab.key} className="relative">
              <button
                type="button"
                onClick={() => onChange(tab.key)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-white text-indigo-800 shadow-sm ring-1 ring-indigo-100'
                    : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
                } ${editMode ? 'pr-8' : ''}`}
              >
                {tab.label}
              </button>
              {editMode && onRemoveTab ? (
                <button
                  type="button"
                  onClick={() => onRemoveTab(tab.key)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  title={`Hide ${tab.label} tab`}
                  aria-label={`Hide ${tab.label} tab`}
                >
                  <X size={12} />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {editMode && hiddenTabs.length > 0 && onRestoreTab ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Hidden tabs
          </span>
          {hiddenTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => onRestoreTab(tab.key)}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-indigo-200 hover:text-indigo-700"
            >
              <RotateCcw size={11} />
              {tab.label}
            </button>
          ))}
        </div>
      ) : null}

      {editMode ? (
        <p className="text-xs text-slate-500">
          Click <strong>×</strong> on a tab to hide it, then click <strong>Save dashboard</strong>.
          Use <strong>Customize</strong> inside a module to remove charts, KPI cards, or tables.
        </p>
      ) : null}
    </div>
  );
}
