'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Coins, Sparkles, Trash2 } from 'lucide-react';
import {
  BULK_CV_TOKENS_CHANGED,
  clearBulkCvTokenSession,
  computeBulkCvRouteCounts,
  computeBulkCvTokenTotals,
  getBulkCvTokenSession,
  isBillableCvTokenRecord,
  removeBulkCvTokenRecords,
  resolveCvParseRoute,
  type BulkCvTokenRecord,
  type CvParseProvider,
  type CvParseRoute,
} from '@/lib/bulkCvTokensStore';
import { requestConfirm } from '@/lib/appDialog';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const EMPTY_TOKEN_RECORDS: BulkCvTokenRecord[] = [];

function formatProvider(provider: CvParseProvider) {
  if (provider === 'openai') return 'OpenAI';
  if (provider === 'mistral') return 'Mistral';
  if (provider === 'system') return 'System';
  if (provider === 'error') return 'AI failed';
  return 'No API';
}

function formatParseRoute(route: CvParseRoute) {
  if (route === 'openai') return 'OpenAI';
  if (route === 'mistral') return 'Mistral';
  return 'Regex fallback';
}

function routeBadgeClass(route: CvParseRoute) {
  if (route === 'openai') return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  if (route === 'mistral') return 'bg-violet-50 text-violet-800 border-violet-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function providerBadgeClass(provider: CvParseProvider, billable: boolean) {
  if (billable && provider === 'openai') {
    return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  }
  if (billable && provider === 'mistral') {
    return 'bg-violet-50 text-violet-800 border-violet-200';
  }
  if (provider === 'system') {
    return 'bg-slate-100 text-slate-700 border-slate-200';
  }
  return 'bg-amber-50 text-amber-800 border-amber-200';
}

function formatNumber(n: number) {
  return n.toLocaleString();
}

function StatusBadge({ status }: { status: BulkCvTokenRecord['status'] }) {
  const styles =
    status === 'created'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : status === 'skipped'
        ? 'bg-amber-50 text-amber-800 border-amber-200'
        : 'bg-rose-50 text-rose-800 border-rose-200';
  const label = status === 'created' ? 'Imported' : status === 'skipped' ? 'Skipped' : 'Failed';
  return (
    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase ${styles}`}>
      {label}
    </span>
  );
}

export default function BulkCvTokensDrawer({ isOpen, onClose }: Props) {
  const [session, setSession] = useState(() => getBulkCvTokenSession());
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkRemoving, setBulkRemoving] = useState(false);

  const records = session?.records ?? EMPTY_TOKEN_RECORDS;

  const recordIdKey = useMemo(
    () => records.map((row) => row.id).join('\u0000'),
    [session?.records]
  );

  const refresh = useCallback(() => {
    setSession(getBulkCvTokenSession());
  }, []);

  useEffect(() => {
    if (isOpen) refresh();
    else setSelectedIds([]);
  }, [isOpen, refresh]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => refresh();
    window.addEventListener(BULK_CV_TOKENS_CHANGED, handler);
    return () => window.removeEventListener(BULK_CV_TOKENS_CHANGED, handler);
  }, [refresh]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const valid = new Set(records.map((row) => row.id));
      const next = prev.filter((id) => valid.has(id));
      if (next.length === prev.length && next.every((id, index) => id === prev[index])) {
        return prev;
      }
      return next;
    });
  }, [recordIdKey, records]);

  const totals = useMemo(() => computeBulkCvTokenTotals(records), [recordIdKey, records]);
  const routeCounts = useMemo(() => computeBulkCvRouteCounts(records), [recordIdKey, records]);

  const allSelected = records.length > 0 && selectedIds.length === records.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(records.map((row) => row.id));
  };

  const handleRemoveSelected = async () => {
    if (!selectedIds.length || bulkRemoving) return;
    const confirmed = await requestConfirm(
      `Remove ${selectedIds.length} token record${selectedIds.length === 1 ? '' : 's'} from this session?`
    );
    if (!confirmed) return;
    setBulkRemoving(true);
    try {
      removeBulkCvTokenRecords(selectedIds);
      setSelectedIds([]);
      refresh();
    } finally {
      setBulkRemoving(false);
    }
  };

  const handleClearAll = async () => {
    if (!records.length || bulkRemoving) return;
    const confirmed = await requestConfirm(
      'Clear all CV parse token history for this session? This cannot be undone.'
    );
    if (!confirmed) return;
    setBulkRemoving(true);
    try {
      clearBulkCvTokenSession();
      setSelectedIds([]);
      refresh();
    } finally {
      setBulkRemoving(false);
    }
  };

  const handleRemoveOne = async (id: string, fileName: string) => {
    const confirmed = await requestConfirm(`Remove token record for "${fileName}"?`);
    if (!confirmed) return;
    removeBulkCvTokenRecords([id]);
    setSelectedIds((prev) => prev.filter((item) => item !== id));
    refresh();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1200] flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        aria-label="Close tokens drawer"
        onClick={onClose}
      />
      <div className="relative flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <Coins size={20} className="text-indigo-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">CV parse tokens</h2>
              <p className="text-xs text-slate-500">
                Counts per engine · OpenAI → Mistral → regex fallback
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="border-b border-slate-100 bg-gradient-to-br from-indigo-50 to-violet-50 px-5 py-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600/80">
            CVs parsed by engine (this session)
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-emerald-200 bg-white px-3 py-2.5 shadow-sm">
              <p className="text-[10px] font-semibold uppercase text-emerald-700">OpenAI</p>
              <p className="mt-0.5 text-xl font-bold text-emerald-900">{routeCounts.openaiCvCount}</p>
              <p className="text-[10px] text-slate-500">CVs</p>
            </div>
            <div className="rounded-xl border border-violet-200 bg-white px-3 py-2.5 shadow-sm">
              <p className="text-[10px] font-semibold uppercase text-violet-700">Mistral</p>
              <p className="mt-0.5 text-xl font-bold text-violet-900">{routeCounts.mistralCvCount}</p>
              <p className="text-[10px] text-slate-500">CVs</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
              <p className="text-[10px] font-semibold uppercase text-slate-600">Regex</p>
              <p className="mt-0.5 text-xl font-bold text-slate-900">{routeCounts.regexCvCount}</p>
              <p className="text-[10px] text-slate-500">fallback</p>
            </div>
          </div>

          <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-indigo-600/80">
            Billable tokens (OpenAI + Mistral)
          </p>
          <div className="mt-2 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-indigo-100 bg-white px-3 py-3 shadow-sm">
              <p className="text-[10px] font-semibold uppercase text-slate-500">Input</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{formatNumber(totals.inputTokens)}</p>
            </div>
            <div className="rounded-xl border border-indigo-100 bg-white px-3 py-3 shadow-sm">
              <p className="text-[10px] font-semibold uppercase text-slate-500">Output</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{formatNumber(totals.outputTokens)}</p>
            </div>
            <div className="rounded-xl border border-violet-100 bg-white px-3 py-3 shadow-sm">
              <p className="text-[10px] font-semibold uppercase text-slate-500">Total</p>
              <p className="mt-1 text-lg font-bold text-violet-700">{formatNumber(totals.totalTokens)}</p>
            </div>
          </div>
          {session?.startedAt ? (
            <p className="mt-2 text-[11px] text-slate-600">
              {totals.resumeCount} log{totals.resumeCount === 1 ? '' : 's'}
              {' · OpenAI '}
              {formatNumber(routeCounts.openaiTotalTokens)} tok
              {' · Mistral '}
              {formatNumber(routeCounts.mistralTotalTokens)} tok
              {totals.billableResumeCount > 0
                ? ` · ${totals.billableResumeCount} billable LLM parse${totals.billableResumeCount === 1 ? '' : 's'}`
                : ' · no billable LLM usage yet'}
              {routeCounts.unparsedCount > 0 ? ` · ${routeCounts.unparsedCount} failed before parse` : ''}
              {' · started '}
              {new Date(session.startedAt).toLocaleString()}
            </p>
          ) : null}
        </div>

        {records.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-5 py-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected;
                }}
                onChange={handleToggleSelectAll}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Select all
            </label>
            <button
              type="button"
              disabled={!selectedIds.length || bulkRemoving}
              onClick={() => void handleRemoveSelected()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 size={14} />
              {bulkRemoving
                ? 'Removing…'
                : `Remove selected${selectedIds.length ? ` (${selectedIds.length})` : ''}`}
            </button>
            <button
              type="button"
              disabled={bulkRemoving}
              onClick={() => void handleClearAll()}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 size={14} className="text-slate-500" />
              Clear all
            </button>
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!records.length ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-16 text-center">
              <Sparkles size={28} className="text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-700">No token data yet</p>
              <p className="mt-1 max-w-xs text-xs text-slate-500">
                Run a <strong>Bulk CV</strong> upload. Each resume shows which API was used
                (OpenAI, Mistral, or System regex) and billable tokens only when an LLM succeeds.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {records.map((row) => {
                const isSelected = selectedIds.includes(row.id);
                const billable = isBillableCvTokenRecord(row);
                const parseRoute = resolveCvParseRoute(row);
                return (
                  <li
                    key={row.id}
                    className={`rounded-xl border p-4 transition-colors ${
                      isSelected
                        ? 'border-indigo-300 bg-indigo-50/40'
                        : 'border-slate-200 bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(row.id)}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        aria-label={`Select ${row.fileName}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-900" title={row.fileName}>
                              {row.fileName}
                            </p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              <span
                                className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${routeBadgeClass(parseRoute)}`}
                              >
                                {formatParseRoute(parseRoute)}
                              </span>
                              <span
                                className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${providerBadgeClass(row.provider, billable)}`}
                              >
                                {formatProvider(row.provider)}
                              </span>
                              {billable ? (
                                <span className="text-[10px] font-semibold text-indigo-600">
                                  Billable
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold text-slate-500">
                                  No billable tokens
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs font-medium text-slate-700">
                              API used:{' '}
                              {row.apiUsedLabel || `${formatProvider(row.provider)} API`}
                              {row.model && billable ? ` · ${row.model}` : ''}
                            </p>
                            {(row.parseChain || !billable) ? (
                              <p
                                className="mt-0.5 text-[11px] text-slate-500 line-clamp-2"
                                title={row.parseChain || ''}
                              >
                                {row.parseChain ||
                                  (billable
                                    ? `${formatProvider(row.provider)} completed parse`
                                    : 'OpenAI gpt-4.1 → System regex')}
                              </p>
                            ) : null}
                            {row.errorMessage ? (
                              <p
                                className="mt-1 text-[11px] text-amber-700 line-clamp-2"
                                title={row.errorMessage}
                              >
                                {row.errorMessage}
                              </p>
                            ) : null}
                          </div>
                          <StatusBadge status={row.status} />
                        </div>

                        {billable ? (
                          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                            <div className="rounded-lg border border-slate-100 bg-white px-2 py-2">
                              <p className="text-[10px] text-slate-500">Input</p>
                              <p className="text-sm font-bold text-slate-900">
                                {formatNumber(row.inputTokens)}
                              </p>
                            </div>
                            <div className="rounded-lg border border-slate-100 bg-white px-2 py-2">
                              <p className="text-[10px] text-slate-500">Output</p>
                              <p className="text-sm font-bold text-slate-900">
                                {formatNumber(row.outputTokens)}
                              </p>
                            </div>
                            <div className="rounded-lg border border-slate-100 bg-white px-2 py-2">
                              <p className="text-[10px] text-slate-500">Total</p>
                              <p className="text-sm font-bold text-indigo-700">
                                {formatNumber(row.totalTokens)}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-3 rounded-lg border border-dashed border-slate-200 bg-white/80 px-3 py-2 text-center text-[11px] text-slate-500">
                            System regex fallback — tokens not counted (OpenAI/Mistral did not complete
                            this parse).
                          </p>
                        )}

                        {row.durationMs > 0 && billable ? (
                          <p className="mt-2 text-[10px] text-slate-500">
                            LLM ~{(row.durationMs / 1000).toFixed(1)}s
                          </p>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void handleRemoveOne(row.id, row.fileName)}
                          className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700"
                        >
                          <Trash2 size={12} />
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
