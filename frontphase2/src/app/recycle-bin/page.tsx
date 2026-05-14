'use client';

/**
 * Recycle Bin
 *
 * Aggregated view of soft-deleted records across the platform — currently leads,
 * clients, candidates, and jobs. Mirrors the behaviour the user sees on the
 * source modules: every Delete action now performs a soft delete (sets
 * `isDeleted=true` on the row); the original document stays in the database
 * until it's purged from this page. From here the user can either restore the
 * record (visible again in its module) or permanently delete it.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Trash2,
  RefreshCcw,
  Users,
  Briefcase,
  Target,
  UserRound,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Inbox,
  FileText,
} from 'lucide-react';
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
} from '../../lib/api';
import { requestConfirm, requestError, requestSuccess } from '../../lib/appDialog';
import { formatDateTimeDMY } from '../../utils/dateDisplay';
import { RECYCLE_BIN_SYNC_EVENT } from '../../constants/recycleBin';
import {
  FAILED_BULK_RESUMES_CHANGED,
  getTrashedFailedBulkResumes,
  purgeFailedBulkResumeFromTrash,
  restoreFailedBulkResumeFromTrash,
  type TrashedFailedBulkResume,
} from '../../lib/failedBulkResumesStore';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type EntityKind = 'leads' | 'clients' | 'candidates' | 'jobs';

interface TrashItem {
  id: string;
  /** Human-readable name shown in the first table column (e.g. company name, candidate name). */
  primary: string;
  /** Lighter secondary line (e.g. email, client name, job title). */
  secondary?: string | null;
  deletedAt?: string | null;
  raw: any;
}

interface SectionState {
  loading: boolean;
  error: string | null;
  items: TrashItem[];
  total: number;
  expanded: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mappers — each entity exposes a slightly different shape so we normalize to
// `{ id, primary, secondary, deletedAt }` here. Keep `raw` for future drill-ins.
// ─────────────────────────────────────────────────────────────────────────────

function mapLeadRow(row: any): TrashItem {
  const primary = String(row?.companyName || row?.contactPerson || row?.email || 'Lead');
  const secondary =
    [row?.contactPerson, row?.email].filter(Boolean).join(' • ') || null;
  return { id: String(row?.id), primary, secondary, deletedAt: row?.deletedAt ?? null, raw: row };
}

function mapClientRow(row: any): TrashItem {
  const primary = String(row?.companyName || row?.name || 'Client');
  const secondary =
    [row?.industry, row?.location].filter(Boolean).join(' • ') || null;
  return { id: String(row?.id), primary, secondary, deletedAt: row?.deletedAt ?? null, raw: row };
}

function mapCandidateRow(row: any): TrashItem {
  const fullName =
    [row?.firstName, row?.lastName].filter(Boolean).join(' ').trim() ||
    row?.email ||
    'Candidate';
  const secondary =
    [row?.currentTitle, row?.email].filter(Boolean).join(' • ') || null;
  return { id: String(row?.id), primary: fullName, secondary, deletedAt: row?.deletedAt ?? null, raw: row };
}

function mapJobRow(row: any): TrashItem {
  const primary = String(row?.title || 'Job');
  const secondary =
    [row?.client?.companyName, row?.location].filter(Boolean).join(' • ') || null;
  return { id: String(row?.id), primary, secondary, deletedAt: row?.deletedAt ?? null, raw: row };
}

/** Pull the array of rows out of whatever shape the trash endpoint returned. */
function extractRows(response: any): any[] {
  const payload = response?.data ?? response;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function extractTotal(response: any, fallback: number): number {
  const payload = response?.data ?? response;
  if (typeof payload?.total === 'number') return payload.total;
  if (typeof payload?.pagination?.total === 'number') return payload.pagination.total;
  return fallback;
}

// ─────────────────────────────────────────────────────────────────────────────
// Section config — drives the per-entity card. All API calls + row mapping
// flow through this lookup so the markup stays declarative.
// ─────────────────────────────────────────────────────────────────────────────

interface SectionConfig {
  key: EntityKind;
  label: string;
  singular: string;
  icon: React.ElementType;
  accent: string;
  fetch: () => Promise<any>;
  restore: (id: string) => Promise<any>;
  purge: (id: string) => Promise<any>;
  bulkPurge: (ids: string[]) => Promise<any>;
  mapper: (row: any) => TrashItem;
  empty: string;
}

const SECTION_CONFIG: SectionConfig[] = [
  {
    key: 'leads',
    label: 'Leads',
    singular: 'lead',
    icon: Target,
    accent: 'text-rose-500 bg-rose-50',
    fetch: () => apiGetLeadsTrash({ limit: 200 }),
    restore: apiRestoreLead,
    purge: apiPurgeLead,
    bulkPurge: apiBulkPurgeLeads,
    mapper: mapLeadRow,
    empty: 'No deleted leads.',
  },
  {
    key: 'clients',
    label: 'Clients',
    singular: 'client',
    icon: Users,
    accent: 'text-blue-500 bg-blue-50',
    fetch: () => apiGetClientsTrash({ limit: 200 }),
    restore: apiRestoreClient,
    purge: apiPurgeClient,
    bulkPurge: apiBulkPurgeClients,
    mapper: mapClientRow,
    empty: 'No deleted clients.',
  },
  {
    key: 'candidates',
    label: 'Candidates',
    singular: 'candidate',
    icon: UserRound,
    accent: 'text-violet-500 bg-violet-50',
    fetch: () => apiGetCandidatesTrash({ limit: 200 }),
    restore: apiRestoreCandidate,
    purge: apiPurgeCandidate,
    bulkPurge: apiBulkPurgeCandidates,
    mapper: mapCandidateRow,
    empty: 'No deleted candidates.',
  },
  {
    key: 'jobs',
    label: 'Jobs',
    singular: 'job',
    icon: Briefcase,
    accent: 'text-amber-500 bg-amber-50',
    fetch: () => apiGetJobsTrash({ limit: 200 }),
    restore: apiRestoreJob,
    purge: apiPurgeJob,
    bulkPurge: apiBulkPurgeJobs,
    mapper: mapJobRow,
    empty: 'No deleted jobs.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function RecycleBinPage() {
  const [failedBulkLocalTrash, setFailedBulkLocalTrash] = useState<TrashedFailedBulkResume[]>([]);
  const [failedBulkLocalExpanded, setFailedBulkLocalExpanded] = useState(true);
  const [failedBulkLocalPending, setFailedBulkLocalPending] = useState<
    Record<string, 'restore' | 'purge' | undefined>
  >({});
  const [failedBulkSelected, setFailedBulkSelected] = useState<Set<string>>(new Set());
  const [failedBulkBulkBusy, setFailedBulkBulkBusy] = useState(false);

  const refreshFailedBulkLocalTrash = useCallback(() => {
    setFailedBulkLocalTrash(getTrashedFailedBulkResumes());
    setFailedBulkSelected((prev) => {
      const visible = new Set(getTrashedFailedBulkResumes().map((r) => r.id));
      if (!prev.size) return prev;
      const next = new Set<string>();
      prev.forEach((id) => {
        if (visible.has(id)) next.add(id);
      });
      return next.size === prev.size ? prev : next;
    });
  }, []);

  useEffect(() => {
    refreshFailedBulkLocalTrash();
  }, [refreshFailedBulkLocalTrash]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onLocalTrashSync = () => refreshFailedBulkLocalTrash();
    window.addEventListener(FAILED_BULK_RESUMES_CHANGED, onLocalTrashSync);
    window.addEventListener(RECYCLE_BIN_SYNC_EVENT, onLocalTrashSync);
    return () => {
      window.removeEventListener(FAILED_BULK_RESUMES_CHANGED, onLocalTrashSync);
      window.removeEventListener(RECYCLE_BIN_SYNC_EVENT, onLocalTrashSync);
    };
  }, [refreshFailedBulkLocalTrash]);

  const initialSections = useMemo<Record<EntityKind, SectionState>>(
    () => ({
      leads: { loading: true, error: null, items: [], total: 0, expanded: true },
      clients: { loading: true, error: null, items: [], total: 0, expanded: true },
      candidates: { loading: true, error: null, items: [], total: 0, expanded: true },
      jobs: { loading: true, error: null, items: [], total: 0, expanded: true },
    }),
    []
  );
  const [sections, setSections] = useState<Record<EntityKind, SectionState>>(initialSections);
  // Per-row pending state keeps the Restore / Delete buttons from being double-clicked.
  const [pending, setPending] = useState<Record<string, 'restore' | 'purge' | undefined>>({});
  // Bulk selection lives per section so a user can select a few candidates without
  // dropping their checkbox state when they expand another section. Using Set<string>
  // keeps toggle / has-checks O(1).
  const [selected, setSelected] = useState<Record<EntityKind, Set<string>>>({
    leads: new Set(),
    clients: new Set(),
    candidates: new Set(),
    jobs: new Set(),
  });
  const [bulkOp, setBulkOp] = useState<Record<EntityKind, 'restore' | 'purge' | null>>({
    leads: null,
    clients: null,
    candidates: null,
    jobs: null,
  });

  const loadSection = useCallback(async (cfg: SectionConfig) => {
    setSections((prev) => ({
      ...prev,
      [cfg.key]: { ...prev[cfg.key], loading: true, error: null },
    }));
    try {
      const response = await cfg.fetch();
      const rows = extractRows(response);
      const items = rows.map(cfg.mapper);
      const total = extractTotal(response, items.length);
      setSections((prev) => ({
        ...prev,
        [cfg.key]: { ...prev[cfg.key], loading: false, items, total, error: null },
      }));
      // Drop any selections that are no longer in the section (e.g. just purged).
      const visibleIds = new Set(items.map((it) => it.id));
      setSelected((prev) => {
        const current = prev[cfg.key];
        if (!current.size) return prev;
        const next = new Set<string>();
        current.forEach((id) => {
          if (visibleIds.has(id)) next.add(id);
        });
        if (next.size === current.size) return prev;
        return { ...prev, [cfg.key]: next };
      });
    } catch (err: any) {
      // 403 (permissions) shouldn't break the whole page — surface a friendly inline message.
      const message = err?.message || `Failed to load deleted ${cfg.label.toLowerCase()}`;
      setSections((prev) => ({
        ...prev,
        [cfg.key]: { ...prev[cfg.key], loading: false, items: [], total: 0, error: message },
      }));
    }
  }, []);

  const toggleRowSelection = (key: EntityKind, id: string) => {
    setSelected((prev) => {
      const current = new Set(prev[key]);
      if (current.has(id)) current.delete(id);
      else current.add(id);
      return { ...prev, [key]: current };
    });
  };

  const toggleSelectAll = (cfg: SectionConfig) => {
    setSelected((prev) => {
      const current = prev[cfg.key];
      const visibleItems = sections[cfg.key].items;
      const allSelected = visibleItems.length > 0 && visibleItems.every((it) => current.has(it.id));
      const next = allSelected ? new Set<string>() : new Set(visibleItems.map((it) => it.id));
      return { ...prev, [cfg.key]: next };
    });
  };

  const clearSelection = (key: EntityKind) => {
    setSelected((prev) => (prev[key].size ? { ...prev, [key]: new Set() } : prev));
  };

  useEffect(() => {
    for (const cfg of SECTION_CONFIG) {
      void loadSection(cfg);
    }
  }, [loadSection]);

  useEffect(() => {
    const onSync = () => {
      for (const cfg of SECTION_CONFIG) {
        void loadSection(cfg);
      }
    };
    if (typeof window === 'undefined') return;
    window.addEventListener(RECYCLE_BIN_SYNC_EVENT, onSync);
    return () => window.removeEventListener(RECYCLE_BIN_SYNC_EVENT, onSync);
  }, [loadSection]);

  const toggleSection = (key: EntityKind) => {
    setSections((prev) => ({ ...prev, [key]: { ...prev[key], expanded: !prev[key].expanded } }));
  };

  const handleRestore = async (cfg: SectionConfig, item: TrashItem) => {
    const ok = await requestConfirm(
      `Restore ${cfg.label.replace(/s$/, '').toLowerCase()} "${item.primary}"? It will reappear in ${cfg.label}.`,
      { confirmLabel: 'Restore', cancelLabel: 'Cancel' }
    );
    if (!ok) return;
    setPending((p) => ({ ...p, [item.id]: 'restore' }));
    try {
      await cfg.restore(item.id);
      setSections((prev) => ({
        ...prev,
        [cfg.key]: {
          ...prev[cfg.key],
          items: prev[cfg.key].items.filter((it) => it.id !== item.id),
          total: Math.max(0, prev[cfg.key].total - 1),
        },
      }));
      void requestSuccess(`Restored "${item.primary}"`);
    } catch (err: any) {
      void requestError(err?.message || 'Failed to restore record');
    } finally {
      setPending((p) => {
        const next = { ...p };
        delete next[item.id];
        return next;
      });
    }
  };

  const handlePurge = async (cfg: SectionConfig, item: TrashItem) => {
    const ok = await requestConfirm(
      `Permanently delete "${item.primary}"? This cannot be undone.`,
      { confirmLabel: 'Delete forever', cancelLabel: 'Cancel', tone: 'error' }
    );
    if (!ok) return;
    setPending((p) => ({ ...p, [item.id]: 'purge' }));
    try {
      await cfg.purge(item.id);
      setSections((prev) => ({
        ...prev,
        [cfg.key]: {
          ...prev[cfg.key],
          items: prev[cfg.key].items.filter((it) => it.id !== item.id),
          total: Math.max(0, prev[cfg.key].total - 1),
        },
      }));
      // Drop this id from the selection set if it was checked.
      setSelected((prev) => {
        if (!prev[cfg.key].has(item.id)) return prev;
        const next = new Set(prev[cfg.key]);
        next.delete(item.id);
        return { ...prev, [cfg.key]: next };
      });
      void requestSuccess(`Permanently deleted "${item.primary}"`);
    } catch (err: any) {
      void requestError(err?.message || 'Failed to delete record');
    } finally {
      setPending((p) => {
        const next = { ...p };
        delete next[item.id];
        return next;
      });
    }
  };

  const handleBulkRestore = async (cfg: SectionConfig) => {
    const ids = Array.from(selected[cfg.key]);
    if (!ids.length) return;
    const count = ids.length;
    const ok = await requestConfirm(
      `Restore ${count} ${count === 1 ? cfg.singular : cfg.label.toLowerCase()}? They will reappear in ${cfg.label}.`,
      { confirmLabel: 'Restore', cancelLabel: 'Cancel' }
    );
    if (!ok) return;
    setBulkOp((b) => ({ ...b, [cfg.key]: 'restore' }));
    try {
      const results = await Promise.allSettled(ids.map((id) => cfg.restore(id)));
      const restoredIds: string[] = [];
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') restoredIds.push(ids[i]);
      });
      const failed = ids.length - restoredIds.length;
      setSections((prev) => ({
        ...prev,
        [cfg.key]: {
          ...prev[cfg.key],
          items: prev[cfg.key].items.filter((it) => !restoredIds.includes(it.id)),
          total: Math.max(0, prev[cfg.key].total - restoredIds.length),
        },
      }));
      setSelected((prev) => {
        const next = new Set(prev[cfg.key]);
        restoredIds.forEach((id) => next.delete(id));
        return { ...prev, [cfg.key]: next };
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(RECYCLE_BIN_SYNC_EVENT));
      }
      if (failed === 0) {
        void requestSuccess(
          `Restored ${restoredIds.length} ${restoredIds.length === 1 ? cfg.singular : cfg.label.toLowerCase()}`
        );
      } else {
        void requestError(
          `${restoredIds.length} restored, ${failed} failed. Failed rows stay in the list — try again or restore one by one.`
        );
      }
    } catch (err: any) {
      void requestError(err?.message || 'Bulk restore failed');
    } finally {
      setBulkOp((b) => ({ ...b, [cfg.key]: null }));
    }
  };

  const handleBulkPurge = async (cfg: SectionConfig) => {
    const ids = Array.from(selected[cfg.key]);
    if (!ids.length) return;
    const count = ids.length;
    const ok = await requestConfirm(
      `Permanently delete ${count} ${count === 1 ? cfg.singular : cfg.label.toLowerCase()}? This cannot be undone.`,
      { confirmLabel: 'Delete forever', cancelLabel: 'Cancel', tone: 'error' }
    );
    if (!ok) return;
    setBulkOp((b) => ({ ...b, [cfg.key]: 'purge' }));
    try {
      const response: any = await cfg.bulkPurge(ids);
      const result = response?.data ?? response ?? {};
      const successCount: number = typeof result.success === 'number' ? result.success : count;
      const failedCount: number = typeof result.failed === 'number' ? result.failed : 0;
      const failedIds = new Set<string>(
        Array.isArray(result.failures) ? result.failures.map((f: any) => String(f?.id || '')) : []
      );
      // Drop successfully-purged rows from the table immediately. Anything reported
      // as failed stays in place so the user can retry it.
      setSections((prev) => ({
        ...prev,
        [cfg.key]: {
          ...prev[cfg.key],
          items: prev[cfg.key].items.filter((it) => !(ids.includes(it.id) && !failedIds.has(it.id))),
          total: Math.max(0, prev[cfg.key].total - successCount),
        },
      }));
      // Keep failed ids checked so the user can retry; clear everything else.
      setSelected((prev) => ({ ...prev, [cfg.key]: failedIds }));
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
      setBulkOp((b) => ({ ...b, [cfg.key]: null }));
    }
  };

  const toggleFailedBulkSelection = (id: string) => {
    setFailedBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllFailedBulk = () => {
    setFailedBulkSelected((prev) => {
      const all = failedBulkLocalTrash.map((r) => r.id);
      if (!all.length) return new Set();
      const allSelected = all.length > 0 && all.every((id) => prev.has(id));
      return allSelected ? new Set() : new Set(all);
    });
  };

  const clearFailedBulkSelection = () => setFailedBulkSelected(new Set());

  const handleBulkRestoreFailedBulkLocal = async () => {
    const ids = Array.from(failedBulkSelected);
    if (!ids.length) return;
    const ok = await requestConfirm(
      `Restore ${ids.length} failed CV ${ids.length === 1 ? 'entry' : 'entries'} to the Failed resumes list on Candidates?`,
      { confirmLabel: 'Restore', cancelLabel: 'Cancel' }
    );
    if (!ok) return;
    setFailedBulkBulkBusy(true);
    try {
      for (const id of ids) {
        restoreFailedBulkResumeFromTrash(id);
      }
      refreshFailedBulkLocalTrash();
      clearFailedBulkSelection();
      void requestSuccess(`Restored ${ids.length} ${ids.length === 1 ? 'entry' : 'entries'}`);
    } catch (err: any) {
      void requestError(err?.message || 'Bulk restore failed');
    } finally {
      setFailedBulkBulkBusy(false);
    }
  };

  const handleBulkPurgeFailedBulkLocal = async () => {
    const ids = Array.from(failedBulkSelected);
    if (!ids.length) return;
    const ok = await requestConfirm(
      `Permanently delete ${ids.length} ${ids.length === 1 ? 'entry' : 'entries'} from this device? This cannot be undone.`,
      { confirmLabel: 'Delete forever', cancelLabel: 'Cancel', tone: 'error' }
    );
    if (!ok) return;
    setFailedBulkBulkBusy(true);
    try {
      for (const id of ids) {
        purgeFailedBulkResumeFromTrash(id);
      }
      refreshFailedBulkLocalTrash();
      clearFailedBulkSelection();
      void requestSuccess(`Permanently deleted ${ids.length} ${ids.length === 1 ? 'entry' : 'entries'}`);
    } catch (err: any) {
      void requestError(err?.message || 'Bulk delete failed');
    } finally {
      setFailedBulkBulkBusy(false);
    }
  };

  const totalDeleted =
    SECTION_CONFIG.reduce((sum, cfg) => sum + sections[cfg.key].items.length, 0) + failedBulkLocalTrash.length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Trash2 size={20} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Recycle Bin</h1>
          </div>
          <p className="text-sm text-slate-500 max-w-2xl">
            Anything you delete from Leads, Clients, Candidates, or Jobs lands here. Failed bulk CV
            rows you remove from the Candidates page are stored locally in your browser until you
            restore or delete them forever. You can restore records back to their module or
            permanently delete them. Permanent deletion cannot be undone.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
            <Inbox size={14} className="text-slate-400" />
            {totalDeleted} item{totalDeleted === 1 ? '' : 's'}
          </span>
          <button
            type="button"
            onClick={() => {
              for (const cfg of SECTION_CONFIG) void loadSection(cfg);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <RefreshCcw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Sections ───────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col border-b border-slate-100 sm:flex-row sm:items-stretch">
            <button
              type="button"
              onClick={() => setFailedBulkLocalExpanded((v) => !v)}
              className="flex flex-1 items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-slate-50/50 sm:min-w-0"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                  <FileText size={16} />
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-slate-900">Failed bulk CV (this browser)</h2>
                  <p className="text-xs text-slate-500">
                    {failedBulkLocalTrash.length}{' '}
                    {failedBulkLocalTrash.length === 1 ? 'entry' : 'entries'} removed from the Failed resumes list
                  </p>
                </div>
              </div>
              {failedBulkLocalExpanded ? (
                <ChevronDown size={18} className="shrink-0 text-slate-400" />
              ) : (
                <ChevronRight size={18} className="shrink-0 text-slate-400" />
              )}
            </button>
            {failedBulkLocalTrash.length > 0 ? (
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-3 py-2.5 sm:border-l sm:border-t-0 sm:px-3">
                <button
                  type="button"
                  onClick={() => void handleBulkRestoreFailedBulkLocal()}
                  disabled={failedBulkBulkBusy || failedBulkSelected.size === 0}
                  title={
                    failedBulkSelected.size === 0
                      ? 'Select one or more rows below'
                      : `Restore ${failedBulkSelected.size} selected`
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {failedBulkBulkBusy ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <RefreshCcw size={14} />
                  )}
                  Bulk restore
                  {failedBulkSelected.size > 0 ? ` (${failedBulkSelected.size})` : ''}
                </button>
                <button
                  type="button"
                  onClick={() => void handleBulkPurgeFailedBulkLocal()}
                  disabled={failedBulkBulkBusy || failedBulkSelected.size === 0}
                  title={
                    failedBulkSelected.size === 0
                      ? 'Select one or more rows below'
                      : `Delete ${failedBulkSelected.size} selected forever`
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {failedBulkBulkBusy ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                  Bulk delete
                  {failedBulkSelected.size > 0 ? ` (${failedBulkSelected.size})` : ''}
                </button>
              </div>
            ) : null}
          </div>
          {failedBulkLocalExpanded ? (
            <div className="border-t border-slate-100">
              {failedBulkLocalTrash.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-slate-500">
                  No failed CV rows in the bin. Delete one from Candidates → Failed resumes to see it here.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  {failedBulkSelected.size > 0 ? (
                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-2 text-sm">
                      <span className="font-medium text-slate-700">
                        {failedBulkSelected.size} selected — use{' '}
                        <span className="font-semibold text-slate-900">Bulk restore</span> or{' '}
                        <span className="font-semibold text-slate-900">Bulk delete</span> in the card header
                      </span>
                      <button
                        type="button"
                        onClick={clearFailedBulkSelection}
                        disabled={failedBulkBulkBusy}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-800 disabled:opacity-50"
                      >
                        Clear
                      </button>
                    </div>
                  ) : null}
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50/60 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="px-4 py-2.5 w-10">
                          <input
                            type="checkbox"
                            aria-label="Select all failed CV rows"
                            checked={
                              failedBulkLocalTrash.length > 0 &&
                              failedBulkLocalTrash.every((r) => failedBulkSelected.has(r.id))
                            }
                            ref={(el) => {
                              if (!el) return;
                              const n = failedBulkLocalTrash.length;
                              const c = failedBulkSelected.size;
                              el.indeterminate = c > 0 && c < n;
                            }}
                            onChange={() => toggleSelectAllFailedBulk()}
                            disabled={failedBulkBulkBusy}
                            className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
                          />
                        </th>
                        <th className="px-4 py-2.5">File</th>
                        <th className="px-4 py-2.5">Failure reason</th>
                        <th className="px-4 py-2.5">Removed</th>
                        <th className="px-4 py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {failedBulkLocalTrash.map((row) => {
                        const rowPending = failedBulkLocalPending[row.id];
                        const isSel = failedBulkSelected.has(row.id);
                        return (
                          <tr
                            key={row.id}
                            className={`hover:bg-slate-50/50 ${isSel ? 'bg-violet-50/40' : ''}`}
                          >
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                aria-label={`Select ${row.fileName}`}
                                checked={isSel}
                                onChange={() => toggleFailedBulkSelection(row.id)}
                                disabled={failedBulkBulkBusy || !!rowPending}
                                className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
                              />
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-900">{row.fileName}</td>
                            <td className="max-w-[280px] truncate px-4 py-3 text-slate-500" title={row.reason}>
                              {row.reason}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                              {row.trashedAt ? formatDateTimeDMY(row.trashedAt) : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  disabled={!!rowPending || failedBulkBulkBusy}
                                  onClick={async () => {
                                    const ok = await requestConfirm(
                                      `Put "${row.fileName}" back on the Failed resumes list on the Candidates page?`,
                                      { confirmLabel: 'Restore', cancelLabel: 'Cancel' }
                                    );
                                    if (!ok) return;
                                    setFailedBulkLocalPending((p) => ({ ...p, [row.id]: 'restore' }));
                                    try {
                                      restoreFailedBulkResumeFromTrash(row.id);
                                      refreshFailedBulkLocalTrash();
                                      void requestSuccess(`Restored "${row.fileName}" to Failed resumes`);
                                    } catch (err: any) {
                                      void requestError(err?.message || 'Failed to restore');
                                    } finally {
                                      setFailedBulkLocalPending((p) => {
                                        const n = { ...p };
                                        delete n[row.id];
                                        return n;
                                      });
                                    }
                                  }}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {rowPending === 'restore' ? (
                                    <Loader2 size={12} className="animate-spin" />
                                  ) : (
                                    <RefreshCcw size={12} />
                                  )}
                                  Restore
                                </button>
                                <button
                                  type="button"
                                  disabled={!!rowPending || failedBulkBulkBusy}
                                  onClick={async () => {
                                    const ok = await requestConfirm(
                                      `Permanently remove "${row.fileName}" from this device? This cannot be undone.`,
                                      { confirmLabel: 'Delete forever', cancelLabel: 'Cancel', tone: 'error' }
                                    );
                                    if (!ok) return;
                                    setFailedBulkLocalPending((p) => ({ ...p, [row.id]: 'purge' }));
                                    try {
                                      purgeFailedBulkResumeFromTrash(row.id);
                                      refreshFailedBulkLocalTrash();
                                      void requestSuccess(`Removed "${row.fileName}" permanently`);
                                    } catch (err: any) {
                                      void requestError(err?.message || 'Failed to delete');
                                    } finally {
                                      setFailedBulkLocalPending((p) => {
                                        const n = { ...p };
                                        delete n[row.id];
                                        return n;
                                      });
                                    }
                                  }}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {rowPending === 'purge' ? (
                                    <Loader2 size={12} className="animate-spin" />
                                  ) : (
                                    <Trash2 size={12} />
                                  )}
                                  Delete forever
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
          ) : null}
        </section>

        {SECTION_CONFIG.map((cfg) => {
          const state = sections[cfg.key];
          const Icon = cfg.icon;
          const sectionSelected = selected[cfg.key];
          const selectedCount = sectionSelected.size;
          const busy = bulkOp[cfg.key] !== null;
          const restoring = bulkOp[cfg.key] === 'restore';
          const purging = bulkOp[cfg.key] === 'purge';
          const showBulkInHeader = !state.loading && !state.error && state.items.length > 0;

          return (
            <section
              key={cfg.key}
              className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
            >
              <div className="flex flex-col border-b border-slate-100 sm:flex-row sm:items-stretch">
                <button
                  type="button"
                  onClick={() => toggleSection(cfg.key)}
                  className="flex flex-1 items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-slate-50/50 sm:min-w-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${cfg.accent}`}>
                      <Icon size={16} />
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-sm font-bold text-slate-900">{cfg.label}</h2>
                      <p className="text-xs text-slate-500">
                        {state.loading
                          ? 'Loading…'
                          : state.error
                            ? state.error
                            : `${state.items.length} deleted ${cfg.label.toLowerCase()}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {state.loading && <Loader2 size={16} className="animate-spin text-slate-400" />}
                    {state.expanded ? (
                      <ChevronDown size={18} className="text-slate-400" />
                    ) : (
                      <ChevronRight size={18} className="text-slate-400" />
                    )}
                  </div>
                </button>
                {showBulkInHeader ? (
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-3 py-2.5 sm:border-l sm:border-t-0">
                    <button
                      type="button"
                      onClick={() => void handleBulkRestore(cfg)}
                      disabled={busy || selectedCount === 0}
                      title={
                        selectedCount === 0
                          ? 'Select rows below or use the header checkbox to select all'
                          : `Restore ${selectedCount} selected`
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {restoring ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <RefreshCcw size={14} />
                      )}
                      Bulk restore
                      {selectedCount > 0 ? ` (${selectedCount})` : ''}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleBulkPurge(cfg)}
                      disabled={busy || selectedCount === 0}
                      title={
                        selectedCount === 0
                          ? 'Select rows below or use the header checkbox to select all'
                          : `Permanently delete ${selectedCount} selected`
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {purging ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                      Bulk delete
                      {selectedCount > 0 ? ` (${selectedCount})` : ''}
                    </button>
                  </div>
                ) : null}
              </div>

              {state.expanded && (
                <div className="border-t border-slate-100">
                  {state.error ? (
                    <div className="px-4 py-6 text-sm text-amber-700 bg-amber-50 flex items-center gap-2">
                      <AlertTriangle size={16} />
                      {state.error}
                    </div>
                  ) : state.loading ? (
                    <div className="px-4 py-6 text-sm text-slate-500 flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin" />
                      Loading deleted {cfg.label.toLowerCase()}…
                    </div>
                  ) : state.items.length === 0 ? (
                    <div className="px-4 py-10 text-center text-sm text-slate-500">
                      {cfg.empty}
                    </div>
                  ) : (
                    (() => {
                      const allChecked =
                        state.items.length > 0 && state.items.every((it) => sectionSelected.has(it.id));
                      const someChecked = selectedCount > 0 && !allChecked;
                      return (
                        <>
                          {selectedCount > 0 ? (
                            <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-2 text-sm">
                              <span className="font-medium text-slate-700">
                                {selectedCount} selected — use{' '}
                                <span className="font-semibold text-slate-900">Bulk restore</span> or{' '}
                                <span className="font-semibold text-slate-900">Bulk delete</span> in the card header
                              </span>
                              <button
                                type="button"
                                onClick={() => clearSelection(cfg.key)}
                                disabled={busy}
                                className="text-xs font-semibold text-slate-500 hover:text-slate-800 disabled:opacity-50"
                              >
                                Clear
                              </button>
                            </div>
                          ) : null}
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                              <thead>
                                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50/60">
                                  <th className="px-4 py-2.5 w-10">
                                    <input
                                      type="checkbox"
                                      aria-label={`Select all deleted ${cfg.label.toLowerCase()}`}
                                      checked={allChecked}
                                      ref={(el) => {
                                        if (el) el.indeterminate = someChecked;
                                      }}
                                      onChange={() => toggleSelectAll(cfg)}
                                      disabled={busy}
                                      className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
                                    />
                                  </th>
                                  <th className="px-4 py-2.5">Name</th>
                                  <th className="px-4 py-2.5">Details</th>
                                  <th className="px-4 py-2.5">Deleted</th>
                                  <th className="px-4 py-2.5 text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {state.items.map((item) => {
                                  const rowPending = pending[item.id];
                                  const isSelected = sectionSelected.has(item.id);
                                  return (
                                    <tr
                                      key={item.id}
                                      className={`hover:bg-slate-50/50 ${isSelected ? 'bg-red-50/30' : ''}`}
                                    >
                                      <td className="px-4 py-3">
                                        <input
                                          type="checkbox"
                                          aria-label={`Select ${item.primary}`}
                                          checked={isSelected}
                                          onChange={() => toggleRowSelection(cfg.key, item.id)}
                                          disabled={busy || !!rowPending}
                                          className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
                                        />
                                      </td>
                                      <td className="px-4 py-3 font-medium text-slate-900">{item.primary}</td>
                                      <td className="px-4 py-3 text-slate-500 truncate max-w-[260px]">
                                        {item.secondary || '—'}
                                      </td>
                                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                                        {item.deletedAt ? formatDateTimeDMY(item.deletedAt) : '—'}
                                      </td>
                                      <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-2">
                                          <button
                                            type="button"
                                            onClick={() => handleRestore(cfg, item)}
                                            disabled={!!rowPending || busy}
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-60 disabled:cursor-not-allowed"
                                            title="Restore"
                                          >
                                            {rowPending === 'restore' ? (
                                              <Loader2 size={12} className="animate-spin" />
                                            ) : (
                                              <RefreshCcw size={12} />
                                            )}
                                            Restore
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handlePurge(cfg, item)}
                                            disabled={!!rowPending || busy}
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-60 disabled:cursor-not-allowed"
                                            title="Delete permanently"
                                          >
                                            {rowPending === 'purge' ? (
                                              <Loader2 size={12} className="animate-spin" />
                                            ) : (
                                              <Trash2 size={12} />
                                            )}
                                            Delete
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </>
                      );
                    })()
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
