'use client';

import React, { useEffect, useState } from 'react';
import {
  Download,
  Filter,
  RefreshCw,
  Search,
  Settings2,
  Users,
} from 'lucide-react';
import type { RecruitmentOverview } from '@/lib/dashboard/api';
import { REC_SECTIONS, recCard, useRecDashboard } from './recShared';

const DATE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7_days', label: 'This Week' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'Last Quarter' },
];

type Props = {
  overview: RecruitmentOverview | null;
  onRefresh: () => void;
};

export function RecHeader({ overview, onRefresh }: Props) {
  const { filters, setFilters, hiddenSections, toggleSection, bumpRefresh } = useRecDashboard();
  const [searchDraft, setSearchDraft] = useState(filters.search || '');
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        document.getElementById('rec-search')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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

  const teamLabel =
    overview?.teamOptions?.find((t) => t.id === filters.assignedTo)?.name || 'All Team';
  const health = overview?.health;

  return (
    <header className={`${recCard} px-5 py-4`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-slate-900">
            Recruitment Command Center
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Live hiring overview · Jobs, Candidates, Interviews & Placements
            {health ? (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                Health {health.score} · {health.label}
              </span>
            ) : null}
          </p>
        </div>

        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <div className="relative min-w-[220px] flex-1 max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={15}
            />
            <input
              id="rec-search"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setFilters((f) => ({ ...f, search: searchDraft.trim() || undefined }));
                  bumpRefresh();
                }
              }}
              placeholder="Search jobs, candidates, location, source..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-12 text-sm outline-none ring-amber-500/25 focus:bg-white focus:ring-2"
            />
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 text-[10px] text-slate-400">
              ⌘K
            </kbd>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setDateOpen((v) => !v);
                setTeamOpen(false);
                setCustomizeOpen(false);
              }}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Filter size={14} />
              {DATE_OPTIONS.find((d) => d.value === filters.dateRange)?.label || 'Last 30 Days'}
            </button>
            {dateOpen ? (
              <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                {DATE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setFilters((f) => ({ ...f, dateRange: opt.value }));
                      setDateOpen(false);
                      bumpRefresh();
                    }}
                    className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                      filters.dateRange === opt.value ? 'font-semibold text-amber-700' : 'text-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setTeamOpen((v) => !v);
                setDateOpen(false);
                setCustomizeOpen(false);
              }}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Users size={14} />
              {teamLabel}
            </button>
            {teamOpen ? (
              <div className="absolute right-0 z-20 mt-1 max-h-64 w-56 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                {(overview?.teamOptions || [{ id: '', name: 'All Team' }]).map((opt) => (
                  <button
                    key={opt.id || 'all'}
                    type="button"
                    onClick={() => {
                      setFilters((f) => ({
                        ...f,
                        assignedTo: opt.id || undefined,
                      }));
                      setTeamOpen(false);
                      bumpRefresh();
                    }}
                    className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                      (filters.assignedTo || '') === (opt.id || '')
                        ? 'font-semibold text-amber-700'
                        : 'text-slate-700'
                    }`}
                  >
                    {opt.name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => {
              onRefresh();
              bumpRefresh();
            }}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCw size={15} />
          </button>

          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download size={14} />
            Export
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setCustomizeOpen((v) => !v);
                setDateOpen(false);
                setTeamOpen(false);
              }}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Settings2 size={14} />
              Customize
            </button>
            {customizeOpen ? (
              <div className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Sections
                </p>
                {REC_SECTIONS.map((section) => (
                  <label
                    key={section.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={!hiddenSections.has(section.id)}
                      onChange={() => toggleSection(section.id)}
                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    {section.label}
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
