'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  CalendarDays,
  Filter,
  Search,
  Settings2,
  Sparkles,
} from 'lucide-react';
import type { DashboardOverview } from '@/lib/dashboard/api';
import { ENTERPRISE_SECTIONS, useEnterpriseDashboard } from './smartDashboardFilters';
import { cardClass } from './dashboardUi';

const DATE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7_days', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'quarter', label: 'Last Quarter' },
  { value: 'custom', label: 'Custom' },
];

type Props = {
  overview: DashboardOverview | null;
  loading?: boolean;
  onRefresh: () => void;
};

function dateRangeLabel(filters: { dateRange?: string; startDate?: string; endDate?: string }) {
  const end = new Date();
  const start = new Date();
  const range = filters.dateRange || 'last_30_days';
  if (range === 'today') {
    /* same day */
  } else if (range === 'yesterday') {
    start.setDate(end.getDate() - 1);
    end.setDate(end.getDate() - 1);
  } else if (range === 'last_7_days') {
    start.setDate(end.getDate() - 6);
  } else if (range === 'month') {
    start.setDate(1);
  } else if (range === 'last_month') {
    start.setMonth(end.getMonth() - 1, 1);
    end.setDate(0);
  } else if (range === 'quarter') {
    start.setMonth(end.getMonth() - 3);
  } else {
    start.setDate(end.getDate() - 29);
  }
  if (filters.startDate && filters.endDate) {
    return `${new Date(filters.startDate).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
    })} - ${new Date(filters.endDate).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}`;
  }
  const fmt = (d: Date) =>
    d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  if (range === 'today' || range === 'yesterday') return fmt(end);
  return `${fmt(start).replace(/,?\s*\d{4}$/, '')} - ${fmt(end)}`;
}

export function SmartDashboardHeader({ overview, onRefresh }: Props) {
  const {
    filters,
    setFilters,
    hiddenSections,
    toggleSection,
    bumpRefresh,
  } = useEnterpriseDashboard();
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState(filters.search || '');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        document.getElementById('ecc-search')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const userMeta = useMemo(() => {
    try {
      const raw = localStorage.getItem('currentUser');
      if (!raw) return { name: 'Admin', role: 'Super Admin' };
      const u = JSON.parse(raw);
      return {
        name: u.name || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || 'Admin',
        role: u.role || u.roles?.[0] || 'Super Admin',
      };
    } catch {
      return { name: 'Admin', role: 'Super Admin' };
    }
  }, []);

  const alertCount = overview?.alerts?.length || 0;

  return (
    <header className={`${cardClass} px-5 py-4`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 shrink-0">
          <h1 className="text-[22px] font-bold tracking-tight text-slate-900">
            Enterprise Smart Dashboard
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            One Command Center for your entire business
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-xl flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            id="ecc-search"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setFilters((f) => ({ ...f, search: searchDraft.trim() || undefined }));
                bumpRefresh();
              }
            }}
            placeholder="Search leads, clients, jobs, candidates..."
            className="h-11 w-full rounded-full border border-slate-200 bg-slate-50/80 pl-10 pr-14 text-sm text-slate-800 outline-none ring-[#3B82F6]/30 transition focus:bg-white focus:ring-2"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
            ⌘K
          </kbd>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <CalendarDays size={15} className="text-slate-400" />
              <span className="hidden sm:inline">{dateRangeLabel(filters)}</span>
            </button>
            {filtersOpen ? (
              <div className="absolute right-0 z-40 mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                {DATE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                      filters.dateRange === opt.value ? 'font-semibold text-[#3B82F6]' : 'text-slate-700'
                    }`}
                    onClick={() => {
                      setFilters((f) => ({ ...f, dateRange: opt.value }));
                      setFiltersOpen(false);
                      bumpRefresh();
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Filter size={15} /> Filters
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setCustomizeOpen((v) => !v)}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Settings2 size={15} /> Customize
            </button>
            {customizeOpen ? (
              <div className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Widgets
                </p>
                {ENTERPRISE_SECTIONS.map((s) => (
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
                <button
                  type="button"
                  onClick={() => {
                    onRefresh();
                    setCustomizeOpen(false);
                  }}
                  className="mt-1 w-full rounded-lg bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Refresh data
                </button>
              </div>
            ) : null}
          </div>

          <a
            href="#brain-chat"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#3B82F6] px-3.5 text-sm font-semibold text-white shadow-sm shadow-blue-500/25 hover:bg-[#2563EB]"
          >
            <Sparkles size={15} /> AI Assistant
          </a>

          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            aria-label="Notifications"
          >
            <Bell size={16} />
            {alertCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                {alertCount > 99 ? '99+' : alertCount}
              </span>
            ) : null}
          </button>

          <div className="flex items-center gap-2 pl-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#3B82F6] to-[#6366F1] text-xs font-bold text-white">
              {userMeta.name
                .split(/\s+/)
                .slice(0, 2)
                .map((p) => p[0])
                .join('')
                .toUpperCase()}
            </div>
            <div className="hidden leading-tight lg:block">
              <p className="text-sm font-semibold text-slate-800">{userMeta.name}</p>
              <p className="text-[11px] text-slate-500">{userMeta.role}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
