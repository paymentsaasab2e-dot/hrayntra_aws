'use client';

import React, { useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { SUPPORTED_CURRENCIES } from '@/utils/currency';
import { WORLD_CURRENCIES } from '@/lib/hqWorldCurrencies';
import { HQ_CURRENCY_FLAGS } from '@/lib/hqCurrency';

type CurrencySearchPickerProps = {
  value: string;
  onChange: (code: string) => void;
  label?: string;
  hint?: string;
  disabled?: boolean;
  /** Compact single-field mode for forms (commission / invoice). */
  compact?: boolean;
  className?: string;
};

function flagForCode(code: string): string {
  const upper = String(code || '').toUpperCase();
  if (upper in HQ_CURRENCY_FLAGS) {
    return HQ_CURRENCY_FLAGS[upper as keyof typeof HQ_CURRENCY_FLAGS];
  }
  try {
    const region = upper.slice(0, 2);
    const flag = String.fromCodePoint(
      ...[...region].map((c) => 127397 + c.charCodeAt(0)),
    );
    return flag || '💱';
  } catch {
    return '💱';
  }
}

/**
 * Same searchable world-currency UX as HQ Settings — reusable in tenant settings.
 */
export function CurrencySearchPicker({
  value,
  onChange,
  label,
  hint,
  disabled = false,
  compact = false,
  className = '',
}: CurrencySearchPickerProps) {
  const [search, setSearch] = useState('');
  const selected = String(value || 'USD').toUpperCase();

  const favorites = useMemo(() => {
    const base = Array.from(new Set([...SUPPORTED_CURRENCIES, 'CNY', selected]));
    return base;
  }, [selected]);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return WORLD_CURRENCIES.filter(
      (w) =>
        w.code.toLowerCase().includes(q) ||
        w.name.toLowerCase().includes(q) ||
        w.countries.toLowerCase().includes(q),
    ).slice(0, 30);
  }, [search]);

  const pick = (code: string) => {
    onChange(String(code || '').toUpperCase());
    setSearch('');
  };

  return (
    <div className={className}>
      {label ? <p className="text-xs font-semibold text-slate-600">{label}</p> : null}

      <div className={`relative ${label ? 'mt-2' : ''}`}>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          disabled={disabled}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search any currency (e.g. BRL, Swiss Franc, Yen)"
          className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-9 pr-9 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-500/15 disabled:opacity-50"
        />
        {search ? (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200/80 hover:text-slate-600"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {search.trim() ? (
        <div className="mt-2">
          {searchResults.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">
              No currency matches &ldquo;{search.trim()}&rdquo;
            </p>
          ) : (
            <ul className="max-h-[240px] overflow-y-auto rounded-xl border border-slate-200 bg-white">
              {searchResults.map((row) => {
                const active = row.code === selected;
                return (
                  <li key={row.code} className="border-b border-slate-50 last:border-b-0">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => pick(row.code)}
                      className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50 disabled:opacity-50 ${
                        active ? 'bg-indigo-50/80' : ''
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="text-lg leading-none">{flagForCode(row.code)}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900">
                            {row.code}
                            <span className="ml-1.5 font-medium text-slate-500">{row.name}</span>
                          </p>
                          {!compact ? (
                            <p className="truncate text-[11px] text-slate-400">{row.countries}</p>
                          ) : null}
                        </div>
                      </div>
                      {active ? (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white">
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <div className={`mt-2 flex flex-wrap gap-1.5 ${compact ? '' : ''}`}>
          {favorites.map((code) => {
            const active = code === selected;
            return (
              <button
                key={code}
                type="button"
                disabled={disabled}
                onClick={() => pick(code)}
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition disabled:opacity-50 ${
                  active
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span>{flagForCode(code)}</span>
                {code}
              </button>
            );
          })}
        </div>
      )}

      {hint ? <p className="mt-1 text-[11px] font-normal text-slate-500">{hint}</p> : null}
    </div>
  );
}
