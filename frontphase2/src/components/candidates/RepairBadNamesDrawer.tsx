'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'motion/react';
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Loader2,
  Save,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  apiRepairBadCandidateNames,
  type RepairBadNamesChange,
  type RepairBadNamesResult,
} from '@/lib/api';
import { DetailsModalShell } from '@/components/drawers/DetailsModalShell';
import { invalidateEmployerCandidatesCache } from '@/lib/employerPageCache';

type RowStatus = 'checking' | 'ready' | 'saving' | 'done' | 'unchanged' | 'error';

type NameFixRow = {
  id: string;
  from: string;
  to: string;
  source?: string | null;
  status: RowStatus;
  error?: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onApplied?: () => void | Promise<void>;
};

function sourceLabel(source?: string | null): string {
  const key = String(source || '').trim().toLowerCase();
  if (key === 'openai') return 'OpenAI (re-parsed CV)';
  if (key === 'resume') return 'Resume text';
  if (key === 'email') return 'Email';
  return source || '';
}

function statusLabel(status: RowStatus): string {
  switch (status) {
    case 'checking':
      return 'In progress';
    case 'ready':
      return 'Ready';
    case 'saving':
      return 'Saving…';
    case 'done':
      return 'Done';
    case 'unchanged':
      return 'Unchanged';
    case 'error':
      return 'Failed';
    default:
      return status;
  }
}

function statusClass(status: RowStatus): string {
  switch (status) {
    case 'checking':
    case 'saving':
      return 'bg-amber-50 text-amber-800 ring-amber-200';
    case 'ready':
      return 'bg-sky-50 text-sky-800 ring-sky-200';
    case 'done':
      return 'bg-emerald-50 text-emerald-800 ring-emerald-200';
    case 'unchanged':
      return 'bg-slate-100 text-slate-600 ring-slate-200';
    case 'error':
      return 'bg-rose-50 text-rose-800 ring-rose-200';
    default:
      return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
}

function mapChangesToRows(
  changes: RepairBadNamesChange[],
  status: RowStatus,
): NameFixRow[] {
  return (Array.isArray(changes) ? changes : [])
    .map((row) => {
      const id = String(row?.id || '').trim();
      if (!id) return null;
      return {
        id,
        from: String(row.from || '').trim() || '—',
        to: String(row.to || '').trim() || '—',
        source: row.source || null,
        status,
      } satisfies NameFixRow;
    })
    .filter((row) => Boolean(row)) as NameFixRow[];
}

export default function RepairBadNamesDrawer({ isOpen, onClose, onApplied }: Props) {
  const [rows, setRows] = useState<NameFixRow[]>([]);
  const [summary, setSummary] = useState<RepairBadNamesResult | null>(null);
  const [phase, setPhase] = useState<'idle' | 'rechecking' | 'saving'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && phase === 'idle') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose, phase]);

  const counts = useMemo(() => {
    const ready = rows.filter((r) => r.status === 'ready').length;
    const done = rows.filter((r) => r.status === 'done').length;
    const checking = rows.filter((r) => r.status === 'checking' || r.status === 'saving').length;
    const failed = rows.filter((r) => r.status === 'error').length;
    return { ready, done, checking, failed, total: rows.length };
  }, [rows]);

  const clearResults = useCallback(() => {
    if (phase !== 'idle') return;
    setRows([]);
    setSummary(null);
    setError('');
  }, [phase]);

  const handleRecheck = useCallback(async () => {
    if (phase !== 'idle') return;
    setPhase('rechecking');
    setError('');
    setRows([]);
    setSummary(null);

    // Placeholder progress row while the scan runs.
    setRows([
      {
        id: '__scanning__',
        from: 'Scanning candidate names…',
        to: 'Reading stored CVs',
        status: 'checking',
      },
    ]);

    try {
      const result = await apiRepairBadCandidateNames({
        dryRun: true,
        execute: false,
        limit: 2000,
        scopeAllCompanies: true,
      });
      setSummary(result);
      const preview = mapChangesToRows(result.changes || result.samples || [], 'ready');

      if (!preview.length) {
        setRows([]);
        toast.success('No bad names found — all candidate names look OK.');
        return;
      }

      // Reveal rows as “in progress” then flip to ready so the process is visible.
      setRows(
        preview.map((row) => ({
          ...row,
          status: 'checking' as const,
        })),
      );

      for (let i = 0; i < preview.length; i += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 28));
        setRows((prev) =>
          prev.map((row, index) =>
            index <= i ? { ...row, status: 'ready' as const } : row,
          ),
        );
      }

      toast.success(
        `Found ${preview.length} name${preview.length === 1 ? '' : 's'} to fix.`,
      );
    } catch (err: unknown) {
      setRows([]);
      const message = err instanceof Error ? err.message : 'Failed to recheck names';
      setError(message);
      toast.error(message);
    } finally {
      setPhase('idle');
    }
  }, [phase]);

  const handleSave = useCallback(async () => {
    if (phase !== 'idle') return;
    const readyIds = new Set(rows.filter((r) => r.status === 'ready').map((r) => r.id));
    if (!readyIds.size) {
      toast.error('Recheck first, then save the proposed name fixes.');
      return;
    }

    setPhase('saving');
    setError('');
    setRows((prev) =>
      prev.map((row) =>
        readyIds.has(row.id) ? { ...row, status: 'saving' as const } : row,
      ),
    );

    try {
      const result = await apiRepairBadCandidateNames({
        execute: true,
        dryRun: false,
        limit: 2000,
        scopeAllCompanies: true,
      });
      setSummary(result);
      const applied = new Map(
        mapChangesToRows(result.changes || result.samples || [], 'done').map((row) => [
          row.id,
          row,
        ]),
      );

      setRows((prev) =>
        prev.map((row) => {
          if (!readyIds.has(row.id) && row.status !== 'saving') return row;
          const next = applied.get(row.id);
          if (next) {
            return { ...row, from: next.from, to: next.to, status: 'done' as const };
          }
          // Still mark saving rows done if backend updated count matches.
          if (row.status === 'saving') {
            return { ...row, status: 'done' as const };
          }
          return row;
        }),
      );

      invalidateEmployerCandidatesCache();
      await onApplied?.();
      const fixed = result.updated || applied.size;
      toast.success(`Saved ${fixed} name fix${fixed === 1 ? '' : 'es'}.`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save name fixes';
      setError(message);
      setRows((prev) =>
        prev.map((row) =>
          row.status === 'saving'
            ? { ...row, status: 'error' as const, error: message }
            : row,
        ),
      );
      toast.error(message);
    } finally {
      setPhase('idle');
    }
  }, [onApplied, phase, rows]);

  if (typeof document === 'undefined') return null;

  const busy = phase !== 'idle';
  const canSave = !busy && counts.ready > 0;
  const canClear = !busy && (rows.length > 0 || Boolean(summary) || Boolean(error));

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <DetailsModalShell
          key="repair-bad-names-drawer"
          size="md"
          fit="viewport"
          zIndexClass="z-[220]"
          dialogTitleId="repair-bad-names-title"
          onBackdropClick={() => {
            if (!busy) onClose();
          }}
          panelClassName="max-w-2xl"
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-indigo-100/70 bg-gradient-to-r from-indigo-50/90 via-white to-sky-50/40 px-5 py-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
                <Sparkles size={18} />
              </span>
              <div className="min-w-0">
                <h2 id="repair-bad-names-title" className="text-base font-semibold text-slate-900">
                  Fix candidate names
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  Recheck bad names from stored CVs. Each name is parsed with OpenAI from the CV, then you can save.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              aria-label="Close fix names"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-100 bg-white px-5 py-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleRecheck()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
            >
              {phase === 'rechecking' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CircleDashed className="h-4 w-4" />
              )}
              {phase === 'rechecking' ? 'Rechecking…' : 'Recheck'}
            </button>
            <button
              type="button"
              disabled={!canSave}
              onClick={() => void handleSave()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
            >
              {phase === 'saving' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {phase === 'saving' ? 'Saving…' : `Save${counts.ready ? ` (${counts.ready})` : ''}`}
            </button>
            <button
              type="button"
              disabled={!canClear}
              onClick={clearResults}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Clear
            </button>
            {summary ? (
              <span className="ml-auto text-xs text-slate-500">
                Scanned {summary.scanned} · bad {summary.badNames}
                {counts.done ? ` · saved ${counts.done}` : ''}
              </span>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {error ? (
              <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            ) : null}

            {!rows.length && phase === 'idle' ? (
              <div className="flex h-full min-h-[16rem] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center">
                <Sparkles className="mb-3 h-8 w-8 text-indigo-400" />
                <p className="text-sm font-semibold text-slate-800">No name fixes yet</p>
                <p className="mt-1 max-w-sm text-xs text-slate-500">
                  Click <span className="font-semibold text-slate-700">Recheck</span> to scan
                  candidates. OpenAI reads each stored CV and lists the real person name to save.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {rows.map((row) => (
                  <li
                    key={row.id}
                    className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="truncate font-medium text-slate-500 line-through decoration-slate-300">
                            {row.from}
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="truncate font-semibold text-slate-900">{row.to}</span>
                        </div>
                        {row.source ? (
                          <p className="mt-1 text-[11px] text-slate-400">Source: {sourceLabel(row.source)}</p>
                        ) : null}
                        {row.error ? (
                          <p className="mt-1 text-[11px] font-medium text-rose-600">{row.error}</p>
                        ) : null}
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${statusClass(row.status)}`}
                      >
                        {row.status === 'checking' || row.status === 'saving' ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : row.status === 'done' ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : null}
                        {statusLabel(row.status)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DetailsModalShell>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
