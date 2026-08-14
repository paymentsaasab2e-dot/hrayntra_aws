'use client';

import React, { useState } from 'react';
import { Download, RefreshCw, Settings2 } from 'lucide-react';
import type { RecruitmentOverview } from '@/lib/dashboard/api';
import { REC_SECTIONS, recCard, useRecDashboard } from './recShared';

export const REC_DATE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7_days', label: 'Week' },
  { value: 'last_30_days', label: '30 days' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All' },
];

export function RecTimelinePills({ className = '' }: { className?: string }) {
  const { filters, setFilters, bumpRefresh } = useRecDashboard();
  const dateRange = filters.dateRange || 'last_30_days';

  return (
    <div
      role="tablist"
      aria-label="Timeline"
      className={`flex flex-wrap items-center gap-0.5 rounded-full bg-slate-100 p-1 ring-1 ring-slate-200/90 ${className}`}
    >
      {REC_DATE_OPTIONS.map((opt) => {
        const active = dateRange === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => {
              setFilters((f) => ({ ...f, dateRange: opt.value, startDate: undefined, endDate: undefined }));
              bumpRefresh();
            }}
            className={`shrink-0 rounded-full px-2.5 py-1.5 text-[12px] font-semibold transition ${
              active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

type Props = {
  overview: RecruitmentOverview | null;
  onRefresh: () => void;
};

export function RecHeader({ overview, onRefresh }: Props) {
  const { filters, hiddenSections, toggleSection } = useRecDashboard();
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const dateLabel =
    REC_DATE_OPTIONS.find((d) => d.value === (filters.dateRange || 'last_30_days'))?.label || '30 days';
  const teamLabel = overview?.teamOptions?.find((t) => t.id === filters.assignedTo)?.name;

  const exportCsv = () => {
    const k = overview?.kpis || {};
    const rows = Object.entries(k).map(([key, value]) => `${key},${value ?? ''}`);
    const blob = new Blob([['metric,value', ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hryantra-recruitment-dashboard-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <header className={`${recCard} px-5 py-3.5`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[20px] font-bold tracking-tight text-slate-900">Recruitment Dashboard</h1>
          <p className="mt-0.5 text-[12px] text-slate-500">
            Stats for {dateLabel.toLowerCase()}
            {teamLabel ? ` · ${teamLabel}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download size={14} /> Export
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setCustomizeOpen((v) => !v)}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
            >
              <Settings2 size={14} /> Customize
            </button>
            {customizeOpen ? (
              <div className="absolute right-0 z-40 mt-2 w-60 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Legacy widget toggles
                </p>
                {REC_SECTIONS.map((s) => (
                  <label
                    key={s.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={!hiddenSections.has(s.id)}
                      onChange={() => toggleSection(s.id)}
                      className="rounded border-slate-300"
                    />
                    {s.label}
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
