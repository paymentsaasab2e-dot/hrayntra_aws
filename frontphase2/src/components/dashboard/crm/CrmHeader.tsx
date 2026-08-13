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
import type { CrmOverview } from '@/lib/dashboard/api';
import { CRM_SECTIONS, crmCard, useCrmDashboard } from './crmShared';

const DATE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7_days', label: 'This Week' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'Last Quarter' },
];

type Props = {
  overview: CrmOverview | null;
  onRefresh: () => void;
};

export function CrmHeader({ overview, onRefresh }: Props) {
  const {
    filters,
    setFilters,
    hiddenSections,
    toggleSection,
    bumpRefresh,
  } = useCrmDashboard();
  const [searchDraft, setSearchDraft] = useState(filters.search || '');
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        document.getElementById('crm-search')?.focus();
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
    a.download = `hryantra-crm-dashboard-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const teamLabel =
    overview?.teamOptions?.find((t) => t.id === filters.assignedTo)?.name || 'All Team';

  return (
    <header className={`${crmCard} px-5 py-4`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-slate-900">
            HRYANTRA CRM Dashboard
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Actionable insights · pipeline mix · records & team
          </p>
        </div>

        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <div className="relative min-w-[220px] flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              id="crm-search"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setFilters((f) => ({ ...f, search: searchDraft.trim() || undefined }));
                  bumpRefresh();
                }
              }}
              placeholder="Search leads, clients, email, phone, city..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-12 text-sm outline-none ring-blue-500/25 focus:bg-white focus:ring-2"
            />
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 text-[10px] text-slate-400">
              ⌘K
            </kbd>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setDateOpen((v) => !v)}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Filter size={14} /> Date
            </button>
            {dateOpen ? (
              <div className="absolute right-0 z-40 mt-2 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                {DATE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                      filters.dateRange === opt.value ? 'font-semibold text-blue-600' : 'text-slate-700'
                    }`}
                    onClick={() => {
                      setFilters((f) => ({ ...f, dateRange: opt.value }));
                      setDateOpen(false);
                      bumpRefresh();
                    }}
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
              onClick={() => setTeamOpen((v) => !v)}
              className="inline-flex h-10 max-w-[160px] items-center gap-1.5 truncate rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Users size={14} /> {teamLabel}
            </button>
            {teamOpen ? (
              <div className="absolute right-0 z-40 mt-2 max-h-64 w-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                  onClick={() => {
                    setFilters((f) => ({ ...f, assignedTo: undefined }));
                    setTeamOpen(false);
                    bumpRefresh();
                  }}
                >
                  All Team
                </button>
                {(overview?.teamOptions || []).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-slate-50"
                    onClick={() => {
                      setFilters((f) => ({ ...f, assignedTo: t.id }));
                      setTeamOpen(false);
                      bumpRefresh();
                    }}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download size={14} /> Export
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setCustomizeOpen((v) => !v)}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Settings2 size={14} /> Customize
            </button>
            {customizeOpen ? (
              <div className="absolute right-0 z-40 mt-2 w-60 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Legacy widget toggles
                </p>
                <p className="px-2 pb-2 text-[10px] text-slate-400">
                  Use category tabs below the insight row to navigate sections.
                </p>
                {CRM_SECTIONS.map((s) => (
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
