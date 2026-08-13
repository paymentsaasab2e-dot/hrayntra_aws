'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Filter, Search, X } from 'lucide-react';
import type { CrmOverview } from '@/lib/dashboard/api';
import { HqInfoTip } from '@/components/hq/analytics/HqPhase2DashboardParts';
import { CrmRecordScopePanel, type CrmScopedRecord } from './CrmRecordScopePanel';
import { dashCard } from './crmShared';

type Mode = 'leads' | 'clients';
type QuickFilter = 'all' | 'unassigned' | 'overdue' | 'noTouch' | 'stale' | 'atRisk' | 'active';

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

type Props = { overview: CrmOverview | null };

/** Compact top toolbar — search/filters first; scoped panel only when a record is picked */
export function CrmRecordScopePicker({ overview }: Props) {
  const [mode, setMode] = useState<Mode>('leads');
  const [q, setQ] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [quick, setQuick] = useState<QuickFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sourceRows = useMemo(() => {
    return mode === 'leads'
      ? ((overview?.leadsTable || []) as Array<Record<string, unknown>>)
      : ((overview?.clientsTable || []) as Array<Record<string, unknown>>);
  }, [overview?.leadsTable, overview?.clientsTable, mode]);

  const filtered = useMemo(() => {
    let rows = sourceRows;

    if (mode === 'leads') {
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
  }, [sourceRows, mode, quick, q]);

  useEffect(() => {
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
  }, [filtered, selectedId]);

  const selectedRow = useMemo(
    () => filtered.find((r) => String(r.id) === selectedId) || null,
    [filtered, selectedId],
  );

  const scoped: CrmScopedRecord | null = selectedRow
    ? mode === 'leads'
      ? {
          kind: 'lead',
          row: selectedRow as unknown as NonNullable<CrmOverview['leadsTable']>[number],
        }
      : {
          kind: 'client',
          row: selectedRow as unknown as NonNullable<CrmOverview['clientsTable']>[number],
        }
    : null;

  const href = mode === 'leads' ? '/leads' : '/client';
  const chips =
    mode === 'leads'
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

  const filterActive = quick !== 'all' || q.trim().length > 0;

  const reset = () => {
    setQ('');
    setQuick('all');
    setSelectedId(null);
    setSearchOpen(false);
  };

  return (
    <div className="space-y-3">
      <section className={`${dashCard} relative overflow-hidden rounded-[1.35rem] px-4 py-3.5 sm:px-5`}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-400 to-lime-400" />

        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-auto flex min-w-0 items-center gap-2">
            <h3 className="flex items-center gap-1 text-[13px] font-bold tracking-tight text-slate-900">
              Find record
              <HqInfoTip text="Search or filter a lead/client at the top — scoped stats appear below when you pick one." />
            </h3>
            <span className="hidden text-[11px] text-slate-400 sm:inline">
              {filtered.length}/{sourceRows.length} {mode}
            </span>
          </div>

          <div
            className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5"
            role="tablist"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'leads'}
              onClick={() => {
                setMode('leads');
                reset();
              }}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${
                mode === 'leads' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600'
              }`}
            >
              Leads
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'clients'}
              onClick={() => {
                setMode('clients');
                reset();
              }}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${
                mode === 'clients' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600'
              }`}
            >
              Clients
            </button>
          </div>

          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-xl border px-2.5 text-[11px] font-semibold transition ${
              searchOpen || q
                ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Search size={13} />
            Search
          </button>

          {filterActive || selectedId ? (
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-8 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600"
            >
              <X size={12} />
              Reset
            </button>
          ) : null}

          <Link
            href={href}
            className="inline-flex h-8 items-center rounded-xl border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-blue-600 hover:bg-blue-50"
          >
            Full list →
          </Link>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
            <Filter size={10} />
            Filters
          </span>
          {chips.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setQuick(c.id)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                quick === c.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {searchOpen ? (
          <div className="relative mt-2.5 max-w-lg">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={14}
            />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={
                mode === 'leads'
                  ? 'Find lead by name, owner, source…'
                  : 'Find client by name, industry…'
              }
              className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        ) : null}

        {(filterActive || selectedId) && filtered.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2.5">
            <span className="self-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Pick
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
      ) : null}
    </div>
  );
}
