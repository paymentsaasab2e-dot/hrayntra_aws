'use client';

import React, { useMemo, useState } from 'react';
import { HQ_REPORTS_BTN_SECONDARY, HQ_REPORTS_CARD } from './hqReportsChrome';

export type HqReportTableColumn = {
  key: string;
  label: string;
  className?: string;
  align?: 'left' | 'right';
  badge?: boolean;
};

const MONEY_KEYS = new Set(['amount', 'tokens', 'pipeline', 'price', 'balance', 'enrollments', 'openings', 'registrations']);
const DATE_KEYS = new Set(['created', 'date', 'posted', 'scheduled', 'submitted', 'deletedAt', 'trialStart', 'trialEnd']);

function badgeClass(value: string) {
  const text = String(value || '').toLowerCase();
  if (['hot', 'active', 'converted', 'verified', 'published', 'live', 'granted', 'paid'].some((item) => text.includes(item))) {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  }
  if (['warm', 'pending', 'new', 'trial', 'demo', 'in progress', 'open'].some((item) => text.includes(item))) {
    return 'bg-amber-50 text-amber-800 ring-amber-200';
  }
  if (['cold', 'lost', 'closed', 'cancelled', 'expired', 'inactive', 'rejected'].some((item) => text.includes(item))) {
    return 'bg-rose-50 text-rose-700 ring-rose-200';
  }
  return 'bg-slate-100 text-slate-700 ring-slate-200';
}

export function HqReportRecordsTable({
  title,
  columns,
  rows,
  empty = 'No data available. There are no records matching the current date range or filters.',
  loading,
  search,
  onSearchChange,
  filterOptions,
  filters,
  onFilterChange,
}: {
  title: string;
  columns: HqReportTableColumn[];
  rows: Array<Record<string, string | number>>;
  empty?: string;
  loading?: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  filterOptions: Array<{ key: string; label: string; values: string[] }>;
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
}) {
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => Object.values(row).some((value) => String(value).toLowerCase().includes(q)));
  }, [rows, search]);

  const sorted = useMemo(() => {
    if (!sortKey) return searched;
    return [...searched].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const an = Number(av);
      const bn = Number(bv);
      if (!Number.isNaN(an) && !Number.isNaN(bn) && String(av) !== '' && String(bv) !== '') {
        return sortDir === 'asc' ? an - bn : bn - an;
      }
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [searched, sortDir, sortKey]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visible = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return (
    <section className={`${HQ_REPORTS_CARD} overflow-hidden`}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-indigo-300/60 to-transparent"
      />
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-50/80 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="h-4 w-1 shrink-0 rounded-full bg-gradient-to-b from-slate-900 to-blue-900" />
          <div>
            <h3 className="text-[13px] font-semibold tracking-tight text-slate-800">{title}</h3>
            <p className="text-[11px] font-medium text-slate-400">{sorted.length} records</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => {
              onSearchChange(e.target.value);
              setPage(0);
            }}
            placeholder="Search records…"
            className="w-52 rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-3 text-sm text-slate-800 outline-none ring-indigo-200 placeholder:text-slate-400 focus:ring-2"
          />
          {filterOptions.map((option) => (
            <select
              key={option.key}
              value={filters[option.key] || ''}
              onChange={(e) => {
                onFilterChange(option.key, e.target.value);
                setPage(0);
              }}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm font-semibold text-slate-700"
            >
              <option value="">All {option.label}</option>
              {option.values.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="space-y-2 px-4 py-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-8 animate-pulse rounded bg-slate-100" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-500">{empty}</p>
      ) : (
        <>
          <div className="max-h-[32rem] overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  {columns.map((col) => (
                    <th key={col.key} className={`whitespace-nowrap px-4 py-2 ${col.className || ''}`}>
                      <button type="button" onClick={() => toggleSort(col.key)} className="hover:text-slate-800">
                        {col.label}
                        {sortKey === col.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((row, index) => (
                  <tr key={String(row.id || index)} className="border-t border-slate-100 hover:bg-indigo-50/40">
                    {columns.map((col) => {
                      const raw = row[col.key];
                      const text = raw == null || raw === '' ? '—' : String(raw);
                      const align = col.align || (MONEY_KEYS.has(col.key) ? 'right' : 'left');
                      const isBadge = col.badge || col.key === 'status' || col.key === 'score' || col.key === 'stage' || col.key === 'origin';
                      return (
                        <td
                          key={col.key}
                          className={`max-w-[14rem] truncate px-4 py-2 text-slate-700 ${align === 'right' ? 'text-right tabular-nums' : ''} ${col.className || ''}`}
                        >
                          {isBadge && text !== '—' ? (
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${badgeClass(text)}`}>
                              {text}
                            </span>
                          ) : DATE_KEYS.has(col.key) ? (
                            text
                          ) : (
                            text
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pageCount > 1 ? (
            <div className="flex items-center justify-between border-t border-indigo-50/80 px-4 py-2.5 text-xs text-slate-500">
              <span>
                Page {safePage + 1} of {pageCount}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={safePage === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className={`${HQ_REPORTS_BTN_SECONDARY} h-8 px-3 text-xs disabled:opacity-40`}
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={safePage >= pageCount - 1}
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  className={`${HQ_REPORTS_BTN_SECONDARY} h-8 px-3 text-xs disabled:opacity-40`}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
