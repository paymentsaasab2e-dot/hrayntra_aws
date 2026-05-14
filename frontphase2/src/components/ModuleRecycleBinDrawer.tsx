'use client';

/**
 * Per-module trash drawer: same soft-deleted rows as /recycle-bin, opened from list pages.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Trash2, RefreshCcw, Loader2, AlertTriangle } from 'lucide-react';
import {
  apiGetLeadsTrash,
  apiRestoreLead,
  apiPurgeLead,
  apiBulkPurgeLeads,
  apiGetClientsTrash,
  apiRestoreClient,
  apiPurgeClient,
  apiBulkPurgeClients,
  apiGetCandidatesTrash,
  apiRestoreCandidate,
  apiPurgeCandidate,
  apiBulkPurgeCandidates,
  apiGetJobsTrash,
  apiRestoreJob,
  apiPurgeJob,
  apiBulkPurgeJobs,
} from '@/lib/api';
import { requestConfirm, requestError, requestSuccess } from '@/lib/appDialog';
import { formatDateTimeDMY } from '@/utils/dateDisplay';
import { RECYCLE_BIN_SYNC_EVENT } from '@/constants/recycleBin';

export type ModuleRecycleBinKind = 'leads' | 'clients' | 'candidates' | 'jobs';

type TrashRow = {
  id: string;
  primary: string;
  secondary?: string | null;
  deletedAt?: string | null;
};

function extractRows(response: unknown): any[] {
  const payload = (response as any)?.data ?? response;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray((payload as any)?.data)) return (payload as any).data;
  if (Array.isArray((payload as any)?.items)) return (payload as any).items;
  return [];
}

function mapLeadRow(row: any): TrashRow {
  const primary = String(row?.companyName || row?.contactPerson || row?.email || 'Lead');
  const secondary = [row?.contactPerson, row?.email].filter(Boolean).join(' • ') || null;
  return { id: String(row?.id), primary, secondary, deletedAt: row?.deletedAt ?? null };
}

function mapClientRow(row: any): TrashRow {
  const primary = String(row?.companyName || row?.name || 'Client');
  const secondary = [row?.industry, row?.location].filter(Boolean).join(' • ') || null;
  return { id: String(row?.id), primary, secondary, deletedAt: row?.deletedAt ?? null };
}

function mapCandidateRow(row: any): TrashRow {
  const fullName =
    [row?.firstName, row?.lastName].filter(Boolean).join(' ').trim() || row?.email || 'Candidate';
  const secondary = [row?.currentTitle, row?.email].filter(Boolean).join(' • ') || null;
  return { id: String(row?.id), primary: fullName, secondary, deletedAt: row?.deletedAt ?? null };
}

function mapJobRow(row: any): TrashRow {
  const primary = String(row?.title || 'Job');
  const secondary = [row?.client?.companyName, row?.location].filter(Boolean).join(' • ') || null;
  return { id: String(row?.id), primary, secondary, deletedAt: row?.deletedAt ?? null };
}

const KIND_CONFIG: Record<
  ModuleRecycleBinKind,
  {
    label: string;
    singular: string;
    fetch: () => Promise<unknown>;
    restore: (id: string) => Promise<unknown>;
    purge: (id: string) => Promise<unknown>;
    bulkPurge: (ids: string[]) => Promise<unknown>;
    map: (row: any) => TrashRow;
  }
> = {
  leads: {
    label: 'Leads',
    singular: 'lead',
    fetch: () => apiGetLeadsTrash({ limit: 200 }),
    restore: apiRestoreLead,
    purge: apiPurgeLead,
    bulkPurge: apiBulkPurgeLeads,
    map: mapLeadRow,
  },
  clients: {
    label: 'Clients',
    singular: 'client',
    fetch: () => apiGetClientsTrash({ limit: 200 }),
    restore: apiRestoreClient,
    purge: apiPurgeClient,
    bulkPurge: apiBulkPurgeClients,
    map: mapClientRow,
  },
  candidates: {
    label: 'Candidates',
    singular: 'candidate',
    fetch: () => apiGetCandidatesTrash({ limit: 200 }),
    restore: apiRestoreCandidate,
    purge: apiPurgeCandidate,
    bulkPurge: apiBulkPurgeCandidates,
    map: mapCandidateRow,
  },
  jobs: {
    label: 'Jobs',
    singular: 'job',
    fetch: () => apiGetJobsTrash({ limit: 200 }),
    restore: apiRestoreJob,
    purge: apiPurgeJob,
    bulkPurge: apiBulkPurgeJobs,
    map: mapJobRow,
  },
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  kind: ModuleRecycleBinKind;
  /** Called after one or more rows were restored (so the parent list can refetch). */
  onRestored?: () => void;
};

export default function ModuleRecycleBinDrawer({ isOpen, onClose, kind, onRestored }: Props) {
  const cfg = KIND_CONFIG[kind];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<TrashRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Record<string, 'restore' | 'purge' | undefined>>({});
  const [bulkOp, setBulkOp] = useState<'restore' | 'purge' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await cfg.fetch();
      const rows = extractRows(res).map(cfg.map);
      setItems(rows);
      setSelected((prev) => {
        if (!prev.size) return prev;
        const visible = new Set(rows.map((r) => r.id));
        const next = new Set<string>();
        prev.forEach((id) => {
          if (visible.has(id)) next.add(id);
        });
        return next.size === prev.size ? prev : next;
      });
    } catch (e: any) {
      setItems([]);
      setError(e?.message || `Failed to load deleted ${cfg.label.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  }, [cfg]);

  useEffect(() => {
    if (!isOpen) return;
    void load();
  }, [isOpen, load]);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;
    const onSync = () => void load();
    window.addEventListener(RECYCLE_BIN_SYNC_EVENT, onSync);
    return () => window.removeEventListener(RECYCLE_BIN_SYNC_EVENT, onSync);
  }, [isOpen, load]);

  const selectedCount = selected.size;
  const allChecked = items.length > 0 && items.every((it) => selected.has(it.id));
  const someChecked = selectedCount > 0 && !allChecked;
  const busy = bulkOp !== null;

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected(() => {
      if (allChecked) return new Set();
      return new Set(items.map((it) => it.id));
    });
  };

  const clearSelection = () => setSelected(new Set());

  const handleRestoreOne = async (row: TrashRow) => {
    const ok = await requestConfirm(
      `Restore ${cfg.singular} "${row.primary}"? It will reappear in ${cfg.label}.`,
      { confirmLabel: 'Restore', cancelLabel: 'Cancel' }
    );
    if (!ok) return;
    setPending((p) => ({ ...p, [row.id]: 'restore' }));
    try {
      await cfg.restore(row.id);
      setItems((prev) => prev.filter((it) => it.id !== row.id));
      setSelected((prev) => {
        if (!prev.has(row.id)) return prev;
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(RECYCLE_BIN_SYNC_EVENT));
      }
      void requestSuccess(`Restored "${row.primary}"`);
      onRestored?.();
    } catch (err: any) {
      void requestError(err?.message || 'Failed to restore');
    } finally {
      setPending((p) => {
        const n = { ...p };
        delete n[row.id];
        return n;
      });
    }
  };

  const handlePurgeOne = async (row: TrashRow) => {
    const ok = await requestConfirm(
      `Permanently delete "${row.primary}"? This cannot be undone.`,
      { confirmLabel: 'Delete forever', cancelLabel: 'Cancel', tone: 'error' }
    );
    if (!ok) return;
    setPending((p) => ({ ...p, [row.id]: 'purge' }));
    try {
      await cfg.purge(row.id);
      setItems((prev) => prev.filter((it) => it.id !== row.id));
      setSelected((prev) => {
        if (!prev.has(row.id)) return prev;
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(RECYCLE_BIN_SYNC_EVENT));
      }
      void requestSuccess(`Permanently deleted "${row.primary}"`);
    } catch (err: any) {
      void requestError(err?.message || 'Failed to delete');
    } finally {
      setPending((p) => {
        const n = { ...p };
        delete n[row.id];
        return n;
      });
    }
  };

  const handleBulkRestore = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const ok = await requestConfirm(
      `Restore ${ids.length} ${ids.length === 1 ? cfg.singular : cfg.label.toLowerCase()}? They will reappear in ${cfg.label}.`,
      { confirmLabel: 'Restore', cancelLabel: 'Cancel' }
    );
    if (!ok) return;
    setBulkOp('restore');
    try {
      const results = await Promise.allSettled(ids.map((id) => cfg.restore(id)));
      const restored: string[] = [];
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') restored.push(ids[i]);
      });
      const failed = ids.length - restored.length;
      setItems((prev) => prev.filter((it) => !restored.includes(it.id)));
      setSelected((prev) => {
        const next = new Set(prev);
        restored.forEach((id) => next.delete(id));
        return next;
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(RECYCLE_BIN_SYNC_EVENT));
      }
      if (failed === 0) {
        void requestSuccess(
          `Restored ${restored.length} ${restored.length === 1 ? cfg.singular : cfg.label.toLowerCase()}`
        );
      } else {
        void requestError(
          `${restored.length} restored, ${failed} failed. Failed rows stay in the list.`
        );
      }
      if (restored.length) onRestored?.();
    } catch (err: any) {
      void requestError(err?.message || 'Bulk restore failed');
    } finally {
      setBulkOp(null);
    }
  };

  const handleBulkPurge = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const ok = await requestConfirm(
      `Permanently delete ${ids.length} ${ids.length === 1 ? cfg.singular : cfg.label.toLowerCase()}? This cannot be undone.`,
      { confirmLabel: 'Delete forever', cancelLabel: 'Cancel', tone: 'error' }
    );
    if (!ok) return;
    setBulkOp('purge');
    try {
      const response: any = await cfg.bulkPurge(ids);
      const result = response?.data ?? response ?? {};
      const successCount: number = typeof result.success === 'number' ? result.success : ids.length;
      const failedCount: number = typeof result.failed === 'number' ? result.failed : 0;
      const failedIds = new Set<string>(
        Array.isArray(result.failures) ? result.failures.map((f: any) => String(f?.id || '')) : []
      );
      setItems((prev) => prev.filter((it) => !(ids.includes(it.id) && !failedIds.has(it.id))));
      setSelected(() => failedIds);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(RECYCLE_BIN_SYNC_EVENT));
      }
      if (failedCount === 0) {
        void requestSuccess(
          `Permanently deleted ${successCount} ${successCount === 1 ? cfg.singular : cfg.label.toLowerCase()}`
        );
      } else {
        void requestError(
          `${successCount} deleted, ${failedCount} failed. Failed items stay selected for retry.`
        );
      }
    } catch (err: any) {
      void requestError(err?.message || 'Bulk delete failed');
    } finally {
      setBulkOp(null);
    }
  };

  const title = useMemo(() => `Deleted ${cfg.label}`, [cfg.label]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex justify-end">
      <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Close" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Soft-deleted {cfg.label.toLowerCase()} from the bin. Restore to bring them back, or delete forever.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void handleBulkRestore()}
            disabled={loading || busy || selectedCount === 0}
            title={selectedCount === 0 ? 'Select rows below' : `Restore ${selectedCount} selected`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {bulkOp === 'restore' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
            Bulk restore{selectedCount > 0 ? ` (${selectedCount})` : ''}
          </button>
          <button
            type="button"
            onClick={() => void handleBulkPurge()}
            disabled={loading || busy || selectedCount === 0}
            title={selectedCount === 0 ? 'Select rows below' : `Delete ${selectedCount} forever`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {bulkOp === 'purge' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Bulk delete{selectedCount > 0 ? ` (${selectedCount})` : ''}
          </button>
          {selectedCount > 0 ? (
            <button
              type="button"
              onClick={clearSelection}
              disabled={busy}
              className="ml-auto text-xs font-semibold text-slate-500 hover:text-slate-800 disabled:opacity-50"
            >
              Clear selection
            </button>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto">
          {error ? (
            <div className="m-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <AlertTriangle size={18} />
              {error}
            </div>
          ) : loading && !items.length ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 size={18} className="animate-spin" />
              Loading…
            </div>
          ) : !items.length ? (
            <div className="px-5 py-14 text-center text-sm text-slate-500">No deleted {cfg.label.toLowerCase()}.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="w-10 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        ref={(el) => {
                          if (el) el.indeterminate = someChecked;
                        }}
                        onChange={toggleSelectAll}
                        disabled={busy}
                        className="h-4 w-4 rounded border-slate-300 text-violet-600"
                      />
                    </th>
                    <th className="px-3 py-2.5">Name</th>
                    <th className="px-3 py-2.5">Details</th>
                    <th className="px-3 py-2.5">Deleted</th>
                    <th className="px-3 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((row) => {
                    const rowBusy = pending[row.id];
                    const isSel = selected.has(row.id);
                    return (
                      <tr key={row.id} className={isSel ? 'bg-violet-50/30' : undefined}>
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={isSel}
                            onChange={() => toggleRow(row.id)}
                            disabled={busy || !!rowBusy}
                            className="h-4 w-4 rounded border-slate-300 text-violet-600"
                          />
                        </td>
                        <td className="px-3 py-2.5 font-medium text-slate-900">{row.primary}</td>
                        <td className="max-w-[180px] truncate px-3 py-2.5 text-slate-500" title={row.secondary || ''}>
                          {row.secondary || '—'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">
                          {row.deletedAt ? formatDateTimeDMY(row.deletedAt) : '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              disabled={!!rowBusy || busy}
                              onClick={() => void handleRestoreOne(row)}
                              className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                            >
                              {rowBusy === 'restore' ? <Loader2 size={12} className="animate-spin" /> : 'Restore'}
                            </button>
                            <button
                              type="button"
                              disabled={!!rowBusy || busy}
                              onClick={() => void handlePurgeOne(row)}
                              className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                            >
                              {rowBusy === 'purge' ? <Loader2 size={12} className="animate-spin" /> : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 px-5 py-3 text-center text-[11px] text-slate-400">
          Full bin:{' '}
          <a href="/recycle-bin" className="font-semibold text-blue-600 hover:underline">
            Recycle Bin
          </a>
        </div>
      </div>
    </div>
  );
}
