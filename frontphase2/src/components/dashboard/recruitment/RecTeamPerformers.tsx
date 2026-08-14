'use client';

import React, { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { RecruitmentOverview } from '@/lib/dashboard/api';
import { formatNum, useRecDashboard } from './recShared';
import { recInitials } from './recViz';

type Props = { overview: RecruitmentOverview | null; className?: string };
type Quick = 'top' | 'all';

export function RecTeamPerformers({ overview, className = '' }: Props) {
  const { filters, setFilters, bumpRefresh, openDrillDown } = useRecDashboard();
  const all = overview?.leaderboard || [];
  const [q, setQ] = useState('');
  const [quick, setQuick] = useState<Quick>('top');
  const selectedId = filters.assignedTo;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = all.filter((r) => {
      if (!needle) return true;
      return String(r.name || '').toLowerCase().includes(needle) || String(r.email || '').toLowerCase().includes(needle);
    });
    list = [...list].sort((a, b) => (b.placements || 0) - (a.placements || 0) || (b.interviews || 0) - (a.interviews || 0));
    if (needle) return list.slice(0, 8);
    return list.slice(0, quick === 'all' ? 8 : 5);
  }, [all, q, quick]);

  const applyPerson = (id: string) => {
    const next = selectedId === id ? undefined : id;
    setFilters((f) => ({ ...f, assignedTo: next }));
    bumpRefresh();
  };

  return (
    <section className={`relative flex h-full min-h-[240px] flex-col rounded-[1.25rem] border border-slate-100/80 bg-white p-3.5 shadow-[0_14px_40px_-28px_rgba(15,23,42,0.22)] ${className}`}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[13px] font-bold text-slate-900">Top performers</h3>
          <p className="text-[11px] font-medium text-slate-400">Click a person to filter stats</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
              className="h-8 w-[132px] rounded-full border border-slate-200 bg-slate-50 pl-7 pr-7 text-[12px] outline-none ring-blue-500/20 focus:bg-white focus:ring-2"
            />
            {q ? (
              <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" onClick={() => setQ('')}>
                <X size={12} />
              </button>
            ) : null}
          </div>
          <div className="flex h-8 items-center rounded-full bg-slate-100 p-0.5 ring-1 ring-slate-200/80">
            {([['top', 'Top 5'], ['all', 'All']] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setQuick(id)}
                className={`rounded-full px-2 py-1 text-[11px] font-semibold ${quick === id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {selectedId ? (
        <button
          type="button"
          onClick={() => {
            setFilters((f) => ({ ...f, assignedTo: undefined }));
            bumpRefresh();
          }}
          className="mb-2 inline-flex w-fit items-center gap-1 rounded-full bg-slate-900 px-2.5 py-0.5 text-[11px] font-semibold text-white"
        >
          Filtered
          <X size={11} />
        </button>
      ) : null}

      <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
        {filtered.length ? (
          filtered.map((r) => {
            const on = selectedId === r.id;
            return (
              <li key={r.id}>
                <div className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 transition ${on ? 'bg-slate-900 text-white' : 'bg-slate-50/80 hover:bg-slate-100'}`}>
                  <button type="button" onClick={() => applyPerson(r.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${on ? 'bg-white/15 text-white' : 'bg-[#334155] text-white'}`}>
                      {recInitials(r.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-[13px] font-semibold ${on ? 'text-white' : 'text-slate-900'}`}>{r.name}</span>
                      <span className={`mt-0.5 flex flex-wrap items-center gap-1 ${on ? 'text-white/80' : 'text-slate-500'}`}>
                        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${on ? 'bg-white/10' : 'bg-white text-slate-600 ring-1 ring-slate-100'}`}>
                          {formatNum(r.openJobs)} jobs
                        </span>
                        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${on ? 'bg-white/10' : 'bg-white text-slate-600 ring-1 ring-slate-100'}`}>
                          {formatNum(r.placements)} placed
                        </span>
                        <span className={`text-[10px] font-medium ${on ? 'text-white/60' : 'text-slate-400'}`}>
                          {formatNum(r.interviews)} iv
                        </span>
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      openDrillDown({
                        title: r.name,
                        href: '/team',
                        rows: [
                          {
                            Name: r.name,
                            'Open jobs': r.openJobs,
                            Candidates: r.candidates,
                            Interviews: r.interviews,
                            Placements: r.placements,
                            Score: r.score ?? '—',
                          },
                        ],
                      })
                    }
                    className={`shrink-0 text-[11px] font-semibold ${on ? 'text-white/80 hover:text-white' : 'text-blue-600 hover:text-blue-800'}`}
                  >
                    Details
                  </button>
                </div>
              </li>
            );
          })
        ) : (
          <li className="py-6 text-center text-[12px] text-slate-400">No recruiters match</li>
        )}
      </ul>
    </section>
  );
}
