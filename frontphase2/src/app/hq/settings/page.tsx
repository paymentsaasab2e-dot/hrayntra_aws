'use client';

import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  Coins,
  Globe2,
  Loader2,
  RefreshCw,
  Search,
  Sliders,
  X,
} from 'lucide-react';
import { HqModulePageLayout } from '@/components/hq/HqModulePageLayout';
import { useHqMoney } from '@/components/hq/HqCurrencyProvider';
import {
  HQ_CURRENCY_FLAGS,
  HQ_CURRENCY_LABELS,
  SUPPORTED_CURRENCIES,
  formatHqFxRate,
  formatHqMoneyFull,
} from '@/lib/hqCurrency';
import { WORLD_CURRENCIES } from '@/lib/hqWorldCurrencies';

const PREVIEW_AMOUNTS = [5_000, 50_000, 500_000, 2_000_000];

function formatFetchedAt(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function flagForCode(code: string): string {
  const known = HQ_CURRENCY_FLAGS[code as keyof typeof HQ_CURRENCY_FLAGS];
  if (known) return known;
  const upper = code.toUpperCase();
  if (upper === 'EUR') return '🇪🇺';
  if (upper.length >= 2) {
    const cp1 = 0x1f1e6 + upper.charCodeAt(0) - 65;
    const cp2 = 0x1f1e6 + upper.charCodeAt(1) - 65;
    return String.fromCodePoint(cp1, cp2);
  }
  return '💱';
}

function labelForCode(code: string): string {
  return (HQ_CURRENCY_LABELS as Record<string, string>)[code] || '';
}

export default function HqSettingsPage() {
  const {
    currency,
    baseCurrency,
    setCurrency,
    rates,
    getRate,
    fxDate,
    fxFetchedAt,
    fxLoading,
    refreshRates,
  } = useHqMoney();

  const [currencySearch, setCurrencySearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedRate = getRate(currency);
  const isSameCurrency = currency === baseCurrency;

  const previewRows = useMemo(
    () =>
      PREVIEW_AMOUNTS.map((amount) => ({
        amount,
        baseLabel: formatHqMoneyFull(amount, baseCurrency, rates),
        displayLabel: formatHqMoneyFull(amount, currency, rates),
      })),
    [currency, baseCurrency, rates],
  );

  const otherCurrencies = useMemo(
    () => SUPPORTED_CURRENCIES.filter((c) => c !== currency),
    [currency],
  );

  const searchResults = useMemo(() => {
    const q = currencySearch.trim().toLowerCase();
    if (!q) return [];

    const supportedSet = new Set<string>(SUPPORTED_CURRENCIES);

    return WORLD_CURRENCIES.filter((w) => {
      return (
        w.code.toLowerCase().includes(q) ||
        w.name.toLowerCase().includes(q) ||
        w.countries.toLowerCase().includes(q)
      );
    })
      .slice(0, 30)
      .map((w) => ({
        code: w.code,
        name: w.name,
        countries: w.countries,
        supported: supportedSet.has(w.code),
      }));
  }, [currencySearch]);

  const pickCurrency = (code: string) => {
    // Instant — all world rates are already loaded in one bulk fetch / cache.
    setCurrency(code);
    setCurrencySearch('');
  };

  return (
    <HqModulePageLayout
      title="Settings"
      subtitle="HQ workspace preferences — applies across all tabs."
      icon={<Sliders className="h-5 w-5" />}
      locked={false}
    >
      <div className="mx-auto w-full max-w-5xl space-y-5">
        {/* ── Top row: rate hero + rate info ── */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-indigo-200/60 bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 p-6 text-white shadow-[0_20px_50px_-18px_rgba(79,70,229,0.7)] lg:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/90 backdrop-blur">
                <Globe2 className="h-3 w-3" />
                Active rate
              </span>
              <button
                type="button"
                onClick={() => void refreshRates()}
                disabled={fxLoading}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white/90 backdrop-blur transition hover:bg-white/25 disabled:opacity-50"
              >
                {fxLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Refresh
              </button>
            </div>

            <div className="mt-5 flex items-end gap-4">
              <span className="text-4xl leading-none">{flagForCode(currency)}</span>
              <div className="min-w-0">
                <p className="text-[2rem] font-extrabold tabular-nums leading-none tracking-tight sm:text-[2.5rem]">
                  {isSameCurrency ? '1.00' : formatHqFxRate(currency, rates)}
                  <span className="ml-2 text-lg font-bold text-white/70">{currency}</span>
                </p>
                <p className="mt-2 text-sm font-medium text-indigo-100/80">
                  per 1 {baseCurrency}
                  {!isSameCurrency && selectedRate > 0
                    ? ` · 1 ${currency} = ${(1 / selectedRate).toFixed(6).replace(/0+$/, '').replace(/\.$/, '')} ${baseCurrency}`
                    : ''}
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs text-indigo-200/70">
              {labelForCode(currency) || currency} — display only, stored values stay in {baseCurrency}.
            </p>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Rate info</p>
            <dl className="mt-3 space-y-2.5 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-slate-500">Market date</dt>
                <dd className="font-semibold text-slate-800">{fxDate || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Refreshed</dt>
                <dd className="font-semibold text-slate-800">{formatFetchedAt(fxFetchedAt)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Auto refresh</dt>
                <dd className="font-semibold text-slate-800">30 min</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* ── Currency picker ── */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-900">Select display currency</h3>
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={currencySearch}
                onChange={(e) => setCurrencySearch(e.target.value)}
                placeholder="Search any currency (e.g. BRL, Swiss Franc, Yen)"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-9 pr-9 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-500/15"
              />
              {currencySearch ? (
                <button
                  type="button"
                  onClick={() => setCurrencySearch('')}
                  className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200/80 hover:text-slate-600"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </div>

          {currencySearch.trim() ? (
            <div className="mt-3">
              {searchResults.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  No currency matches &ldquo;{currencySearch.trim()}&rdquo;
                </p>
              ) : (
                <ul className="max-h-[320px] overflow-y-auto rounded-xl border border-slate-200 bg-white">
                  {searchResults.map((row) => {
                    const active = row.code === currency;
                    return (
                      <li key={row.code} className="border-b border-slate-50 last:border-b-0">
                        <button
                          type="button"
                          onClick={() => pickCurrency(row.code)}
                          className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50 ${
                            active ? 'bg-indigo-50/80' : ''
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="text-xl leading-none">{flagForCode(row.code)}</span>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-900">
                                {row.code}
                                <span className="ml-1.5 font-medium text-slate-500">{row.name}</span>
                              </p>
                              <p className="truncate text-[11px] text-slate-400">{row.countries}</p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {active ? (
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white">
                                <Check className="h-3 w-3" strokeWidth={3} />
                              </span>
                            ) : null}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
              {SUPPORTED_CURRENCIES.map((code) => {
                const active = code === currency;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => pickCurrency(code)}
                    className={`group relative flex flex-col items-center rounded-xl border px-2 py-3 text-center transition ${
                      active
                        ? 'border-indigo-300 bg-indigo-50 ring-2 ring-indigo-200'
                        : 'border-slate-150 bg-slate-50/50 hover:border-slate-300 hover:bg-white'
                    }`}
                  >
                    {active ? (
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-white shadow">
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      </span>
                    ) : null}
                    <span className="text-xl leading-none">{HQ_CURRENCY_FLAGS[code as keyof typeof HQ_CURRENCY_FLAGS]}</span>
                    <span className={`mt-1.5 text-xs font-bold ${active ? 'text-indigo-700' : 'text-slate-700'}`}>
                      {code}
                    </span>
                  </button>
                );
              })}

              {/* Show the current currency in the grid if it's not one of the 9 defaults */}
              {!SUPPORTED_CURRENCIES.includes(currency as any) ? (
                <button
                  type="button"
                  onClick={() => pickCurrency(currency)}
                  className="group relative flex flex-col items-center rounded-xl border border-indigo-300 bg-indigo-50 px-2 py-3 text-center ring-2 ring-indigo-200 transition"
                >
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-white shadow">
                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                  </span>
                  <span className="text-xl leading-none">{flagForCode(currency)}</span>
                  <span className="mt-1.5 text-xs font-bold text-indigo-700">{currency}</span>
                </button>
              ) : null}
            </div>
          )}
        </section>

        {/* ── Bottom: Conversion preview + live rates table ── */}
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4">
              <Coins className="h-4 w-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">Conversion preview</h3>
            </div>
            <div className="overflow-hidden">
              <div className="grid grid-cols-[1fr_24px_1fr] gap-0 border-b border-slate-100 bg-slate-50/80 px-5 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                <span>{baseCurrency}</span>
                <span />
                <span className="text-right">{currency}</span>
              </div>
              <ul>
                {previewRows.map((row, i) => (
                  <li
                    key={row.amount}
                    className={`grid grid-cols-[1fr_24px_1fr] items-center px-5 py-3 ${
                      i < previewRows.length - 1 ? 'border-b border-slate-50' : ''
                    }`}
                  >
                    <span className="text-sm font-medium tabular-nums text-slate-600">{row.baseLabel}</span>
                    <ArrowRight className="mx-auto h-3.5 w-3.5 text-slate-300" />
                    <span className="text-right text-sm font-bold tabular-nums text-indigo-700">{row.displayLabel}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="text-sm font-bold text-slate-900">All rates vs {baseCurrency}</h3>
              <span className="text-[11px] font-semibold text-slate-400">{fxDate || ''}</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  <th className="px-5 py-2 text-left">Currency</th>
                  <th className="px-5 py-2 text-right">Rate</th>
                </tr>
              </thead>
              <tbody>
                {otherCurrencies.map((code, i) => (
                  <tr key={code} className={i < otherCurrencies.length - 1 ? 'border-b border-slate-50' : ''}>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="text-base leading-none">{HQ_CURRENCY_FLAGS[code as keyof typeof HQ_CURRENCY_FLAGS]}</span>
                        <span className="font-semibold text-slate-900">{code}</span>
                        <span className="text-xs text-slate-400">{(HQ_CURRENCY_LABELS as Record<string, string>)[code]}</span>
                      </div>
                    </td>
                    <td className="px-5 py-2.5 text-right font-bold tabular-nums text-slate-800">
                      {formatHqFxRate(code, rates)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        <p className="px-1 text-center text-xs leading-relaxed text-slate-400">
          Exchange rates from market data, refreshed every 30 min. Conversion is display-only —
          all amounts stored in {baseCurrency}.
        </p>
      </div>
    </HqModulePageLayout>
  );
}
