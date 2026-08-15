'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Filter, Search, X } from 'lucide-react';
import type { CrmOverview } from '@/lib/dashboard/api';
import { HqInfoTip } from '@/components/hq/analytics/HqPhase2DashboardParts';
import { CrmRecordScopePanel, type CrmScopedRecord } from './CrmRecordScopePanel';
import { dashCard } from './crmShared';
import { useDashboardAccess } from '@/lib/dashboard/useDashboardAccess';

export type CrmPipelineSection = 'leads' | 'clients';
type QuickFilter = 'all' | 'unassigned' | 'overdue' | 'noTouch' | 'stale' | 'atRisk' | 'active';

export function PipelineSectionToggle({
  value,
  onChange,
  allowed = ['leads', 'clients'],
}: {
  value: CrmPipelineSection;
  onChange: (section: CrmPipelineSection) => void;
  allowed?: CrmPipelineSection[];
}) {
  const sections = (['leads', 'clients'] as const).filter((s) => allowed.includes(s));
  if (sections.length <= 1) {
    const only = sections[0] || value;
    return (
      <p className="text-[13px] font-semibold text-slate-800">{only === 'clients' ? 'Clients' : 'Leads'}</p>
    );
  }
  return (
    <div
      role="tablist"
      aria-label="Pipeline section"
      className="relative grid h-10 w-[196px] shrink-0 grid-cols-2 rounded-full bg-slate-100 p-1 ring-1 ring-slate-200/90"
    >
      <span
        aria-hidden
        className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full bg-slate-900 shadow-sm transition-all duration-200 ease-out ${
          value === 'leads' ? 'left-1' : 'left-[calc(50%)]'
        }`}
      />
      <button
        type="button"
        role="tab"
        aria-selected={value === 'leads'}
        onClick={() => onChange('leads')}
        className={`relative z-10 rounded-full text-[13px] font-semibold transition-colors ${
          value === 'leads' ? 'text-white' : 'text-slate-500 hover:text-slate-700'
        }`}
      >
        Leads
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === 'clients'}
        onClick={() => onChange('clients')}
        className={`relative z-10 rounded-full text-[13px] font-semibold transition-colors ${
          value === 'clients' ? 'text-white' : 'text-slate-500 hover:text-slate-700'
        }`}
      >
        Clients
      </button>
    </div>
  );
}

function initials(name: string) {
  const parts = String(name || '?')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function daysSince(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return Math.round((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
}

type Props = {
  overview: CrmOverview | null;
  section: CrmPipelineSection;
  onSectionChange: (section: CrmPipelineSection) => void;
  onScopedChange?: (scoped: boolean) => void;
};

export function CrmRecordScopePicker({
  overview,
  section,
  onSectionChange,
  onScopedChange,
}: Props) {
  const { modules } = useDashboardAccess();
  const allowedSections: CrmPipelineSection[] = [
    ...(modules.leads ? (['leads'] as const) : []),
    ...(modules.clients ? (['clients'] as const) : []),
  ];

  useEffect(() => {
    if (modules.leads && !modules.clients && section !== 'leads') onSectionChange('leads');
    else if (modules.clients && !modules.leads && section !== 'clients') onSectionChange('clients');
  }, [modules.leads, modules.clients, section, onSectionChange]);
  const [q, setQ] = useState('');
  const [quick, setQuick] = useState<QuickFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const sourceRows = useMemo(() => {
    return section === 'leads'
      ? ((overview?.leadsTable || []) as Array<Record<string, unknown>>)
      : ((overview?.clientsTable || []) as Array<Record<string, unknown>>);
  }, [overview?.leadsTable, overview?.clientsTable, section]);

  const filtered = useMemo(() => {
    let rows = sourceRows;

    if (section === 'leads') {
      if (quick === 'unassigned') {
        rows = rows.filter((r) => !r.assignee || /unassigned/i.test(String(r.assignee)));
      } else if (quick === 'overdue') {
        rows = rows.filter((r) => {
          const next = r.nextFollowUp ? new Date(String(r.nextFollowUp)) : null;
          return next && Number.isFinite(next.getTime()) && next.getTime() < Date.now();
        });
      } else if (quick === 'noTouch') {
        rows = rows.filter((r) => !Number(r.totalMeetings));
      } else if (quick === 'stale') {
        rows = rows.filter((r) => {
          const d = daysSince(r.lastActivity ? String(r.lastActivity) : null);
          return d == null || d > 30;
        });
      }
    } else if (quick === 'active') {
      rows = rows.filter((r) => /active|hot/i.test(String(r.status || '')));
    } else if (quick === 'atRisk') {
      rows = rows.filter((r) => {
        const d = daysSince(r.lastActivity ? String(r.lastActivity) : null);
        return /inactive|hold|cold/i.test(String(r.status || '')) || (d != null && d > 45);
      });
    } else if (quick === 'unassigned') {
      rows = rows.filter((r) => !r.assignee || /unassigned/i.test(String(r.assignee)));
    }

    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      [r.name, r.contact, r.email, r.status, r.industry, r.assignee, r.location, r.source, r.phone]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle)),
    );
  }, [sourceRows, section, quick, q]);

  useEffect(() => {
    setQ('');
    setQuick('all');
    setSelectedId(null);
    setFiltersOpen(false);
  }, [section]);

  useEffect(() => {
    if (!q.trim()) {
      if (selectedId && !filtered.some((r) => String(r.id) === selectedId)) setSelectedId(null);
      return;
    }
    if (!filtered.length) {
      setSelectedId(null);
      return;
    }
    if (filtered.length === 1) {
      setSelectedId(String(filtered[0].id));
      return;
    }
    if (selectedId && !filtered.some((r) => String(r.id) === selectedId)) {
      setSelectedId(null);
    }
  }, [filtered, selectedId, q]);

  const selectedRow = useMemo(
    () => filtered.find((r) => String(r.id) === selectedId) || null,
    [filtered, selectedId],
  );

  const scoped: CrmScopedRecord | null = selectedRow
    ? section === 'leads'
      ? {
          kind: 'lead',
          row: selectedRow as unknown as NonNullable<CrmOverview['leadsTable']>[number],
        }
      : {
          kind: 'client',
          row: selectedRow as unknown as NonNullable<CrmOverview['clientsTable']>[number],
        }
    : null;

  useEffect(() => {
    onScopedChange?.(Boolean(scoped));
  }, [scoped, onScopedChange]);

  const href = section === 'leads' ? '/leads' : '/client';
  const chips =
    section === 'leads'
      ? ([
          { id: 'all', label: 'All' },
          { id: 'unassigned', label: 'Unassigned' },
          { id: 'overdue', label: 'Overdue FU' },
          { id: 'noTouch', label: 'No touch' },
          { id: 'stale', label: 'Stale 30d+' },
        ] as const)
      : ([
          { id: 'all', label: 'All' },
          { id: 'active', label: 'Active' },
          { id: 'atRisk', label: 'At risk' },
          { id: 'unassigned', label: 'Unassigned' },
        ] as const);

  const searching = q.trim().length > 0;
  const filterActive = quick !== 'all' || searching;
  const showFilters = filtersOpen || quick !== 'all';

  return (
    <div className="space-y-3">
      <section className={`${dashCard} rounded-xl px-4 py-4 sm:px-5`}>
        <div className="flex items-center justify-between gap-3">
          <PipelineSectionToggle value={section} onChange={onSectionChange} allowed={allowedSections} />
          <div className="flex items-center gap-2">
            <span className="text-[12px] tabular-nums text-slate-400">
              {filtered.length}/{sourceRows.length}
            </span>
            <Link href={href} className="text-[12px] font-medium text-blue-600 hover:text-blue-700">
              Full list →
            </Link>
            <HqInfoTip text="Slide Leads or Clients, then search a record. Scoped health, timeline and outreach appear when one match is selected." />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={15}
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={
                section === 'leads'
                  ? 'Search any lead — name, owner, source, email…'
                  : 'Search any client — name, industry, owner…'
              }
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium ${
              showFilters ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            <Filter size={14} />
            Filter
          </button>
          {filterActive || selectedId ? (
            <button
              type="button"
              onClick={() => {
                setQ('');
                setQuick('all');
                setSelectedId(null);
                setFiltersOpen(false);
              }}
              className="inline-flex h-10 shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600"
            >
              <X size={12} />
              Reset
            </button>
          ) : null}
        </div>

        {showFilters ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setQuick(c.id)}
                className={`rounded-full px-2.5 py-1 text-[12px] font-medium transition ${
                  quick === c.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        ) : null}

        {searching && filtered.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2.5">
            <span className="self-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Matches
            </span>
            {filtered.slice(0, 12).map((r) => {
              const id = String(r.id);
              const active = id === selectedId;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedId(active ? null : id)}
                  className={`inline-flex max-w-[180px] items-center gap-1.5 truncate rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                    active
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-indigo-200'
                  }`}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/20 text-[8px] font-bold">
                    {initials(String(r.name || '?'))}
                  </span>
                  <span className="truncate">{String(r.name || '—')}</span>
                </button>
              );
            })}
            {filtered.length > 12 ? (
              <span className="self-center text-[10px] text-slate-400">+{filtered.length - 12}</span>
            ) : null}
          </div>
        ) : null}
      </section>

      {scoped ? (
        <CrmRecordScopePanel
          record={scoped}
          overview={overview}
          onClear={() => {
            setSelectedId(null);
            setQ('');
          }}
        />
      ) : searching && !filtered.length ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-6 text-center text-sm text-slate-400">
          No {section === 'leads' ? 'leads' : 'clients'} match that search
        </p>
      ) : null}
    </div>
  );
}
