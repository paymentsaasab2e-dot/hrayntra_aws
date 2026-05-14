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
  Search,
  XCircle,
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
import {
  PH2_TABLE_CARD_CLASS,
  PH2_TOOLBAR_ROW_CLASS,
} from '../../components/layout/Ph2ModulePageLayout';

/** Table header row — matches Leads list. */
const RB_TABLE_HEAD_ROW =
  'bg-gradient-to-r from-slate-50/95 via-indigo-50/50 to-violet-50/40 border-b border-indigo-100/50 text-indigo-950/45 uppercase text-[9px] font-bold tracking-[0.12em]';

const RB_TH = 'px-3 py-2.5 text-left first:pl-4 sm:px-4 sm:first:pl-6 sm:py-3';

const RB_TABLE_BODY_ROW =
  'transition-colors duration-200 even:bg-slate-50/35 hover:bg-indigo-50/45';

const RB_SEARCH_INPUT_CLASS =
  'h-9 w-full rounded-xl border border-indigo-100/90 bg-white/95 pl-10 pr-3 text-xs text-slate-800 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] placeholder:text-slate-400 transition-all focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30';

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
  const [searchQuery, setSearchQuery] = useState('');

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

  const toggleSelectAll = (cfg: SectionConfig, displayItems: TrashItem[]) => {
    setSelected((prev) => {
      const current = new Set(prev[cfg.key]);
      const allSelected =
        displayItems.length > 0 && displayItems.every((it) => current.has(it.id));
      if (allSelected) {
        displayItems.forEach((it) => current.delete(it.id));
      } else {
        displayItems.forEach((it) => current.add(it.id));
      }
      return { ...prev, [cfg.key]: current };
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

  const toggleSelectAllFailedBulk = (visible: TrashedFailedBulkResume[]) => {
    setFailedBulkSelected((prev) => {
      if (!visible.length) return prev;
      const next = new Set(prev);
      const allSelected = visible.every((r) => next.has(r.id));
      if (allSelected) {
        visible.forEach((r) => next.delete(r.id));
      } else {
        visible.forEach((r) => next.add(r.id));
      }
      return next;
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

  const searchNorm = searchQuery.trim().toLowerCase();
  const trashItemMatches = (it: TrashItem) => {
    if (!searchNorm) return true;
    return `${it.primary} ${it.secondary || ''}`.toLowerCase().includes(searchNorm);
  };
  const failedBulkMatches = (row: TrashedFailedBulkResume) => {
    if (!searchNorm) return true;
    return `${row.fileName} ${row.reason}`.toLowerCase().includes(searchNorm);
  };

  const totalDeleted =
    SECTION_CONFIG.reduce((sum, cfg) => sum + sections[cfg.key].items.length, 0) + failedBulkLocalTrash.length;

  const filteredFailedBulk = failedBulkLocalTrash.filter(failedBulkMatches);
  const anySectionLoading = SECTION_CONFIG.some((cfg) => sections[cfg.key].loading);
  const refreshAll = () => {
    for (const cfg of SECTION_CONFIG) void loadSection(cfg);
  };

  return (
    <div className="w-full min-h-screen overflow-hidden text-slate-900">
      <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex min-h-[4.5rem] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-indigo-100/50 bg-white/80 px-4 py-3 shadow-[inset_0_-1px_0_0_rgba(99,102,241,0.08)] backdrop-blur-md sm:px-6">
          <div className="flex items-start gap-2.5 sm:gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-600 via-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30 ring-1 ring-white/20">
              <Trash2 className="h-5 w-5" strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight tracking-tight text-slate-900 sm:text-[1.35rem]">Recycle Bin</h1>
              <p className="mt-0.5 max-w-2xl text-xs text-slate-500">
                Restore or permanently delete soft-deleted records from Leads, Clients, Candidates, and Jobs. Failed bulk
                CV rows removed on Candidates are kept locally in this browser until you clear them.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200/80 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 shadow-sm">
              <Inbox size={14} className="text-indigo-500" strokeWidth={2.25} />
              {totalDeleted} item{totalDeleted === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              onClick={() => refreshAll()}
              disabled={anySectionLoading}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-indigo-200/80 bg-white text-indigo-700 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.2)] transition-all hover:border-indigo-300 hover:bg-indigo-50/90 active:scale-[0.98] disabled:opacity-50"
              title="Refresh all sections"
            >
              <RefreshCcw size={16} strokeWidth={2.25} className={anySectionLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-6 lg:px-6">
          <div className="mx-auto max-w-[1600px] space-y-4">
            <div className={PH2_TABLE_CARD_CLASS}>
              <div className={PH2_TOOLBAR_ROW_CLASS}>
                <div className="relative w-full lg:max-w-md lg:flex-1">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-400"
                    strokeWidth={2.25}
                  />
                  <input
                    type="text"
                    placeholder="Search deleted records by name, email, or details…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={RB_SEARCH_INPUT_CLASS}
                    aria-label="Search recycle bin"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {searchNorm ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
                    >
                      <XCircle size={15} className="shrink-0 text-rose-500" strokeWidth={2.35} />
                      Clear
                    </button>
                  ) : null}
                  <span className="whitespace-nowrap text-[11px] font-medium text-slate-500">
                    Total in bin: <span className="font-semibold text-slate-800">{totalDeleted}</span>
                  </span>
                </div>
              </div>
            </div>

            <section className={PH2_TABLE_CARD_CLASS}>
              <div className="flex flex-col border-b border-indigo-100/40 bg-gradient-to-br from-white via-indigo-50/25 to-violet-50/20 sm:flex-row sm:items-stretch">
            <button
              type="button"
              onClick={() => setFailedBulkLocalExpanded((v) => !v)}
              className="flex flex-1 items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-white/40 sm:min-w-0"
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
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-indigo-100/40 bg-white/50 px-3 py-2.5 sm:border-l sm:border-t-0 sm:px-3">
                <button
                  type="button"
                  onClick={() => void handleBulkRestoreFailedBulkLocal()}
                  disabled={failedBulkBulkBusy || failedBulkSelected.size === 0}
                  title={
                    failedBulkSelected.size === 0
                      ? 'Select one or more rows below'
                      : `Restore ${failedBulkSelected.size} selected`
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200/70 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.2)] transition-all hover:border-emerald-200 hover:bg-emerald-50/90 disabled:cursor-not-allowed disabled:opacity-50"
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
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-rose-600 to-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md transition-all hover:from-rose-700 hover:to-red-700 disabled:cursor-not-allowed disabled:opacity-50"
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
            <div className="border-t border-indigo-100/40">
              {failedBulkLocalTrash.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-slate-500">
                  No failed CV rows in the bin. Delete one from Candidates → Failed resumes to see it here.
                </div>
              ) : filteredFailedBulk.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-slate-500">No rows match your search.</div>
              ) : (
                <div className="no-scrollbar overflow-x-auto">
                  {failedBulkSelected.size > 0 ? (
                    <div className="flex items-center justify-between gap-3 border-b border-indigo-100/40 bg-indigo-50/30 px-4 py-2 text-sm">
                      <span className="font-medium text-slate-700">
                        {failedBulkSelected.size} selected — use{' '}
                        <span className="font-semibold text-slate-900">Bulk restore</span> or{' '}
                        <span className="font-semibold text-slate-900">Bulk delete</span> in the card header
                      </span>
                      <button
                        type="button"
                        onClick={clearFailedBulkSelection}
                        disabled={failedBulkBulkBusy}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-800 disabled:opacity-50"
                      >
                        Clear
                      </button>
                    </div>
                  ) : null}
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className={RB_TABLE_HEAD_ROW}>
                        <th className={`${RB_TH} w-10`}>
                          <input
                            type="checkbox"
                            aria-label="Select all failed CV rows"
                            checked={
                              filteredFailedBulk.length > 0 &&
                              filteredFailedBulk.every((r) => failedBulkSelected.has(r.id))
                            }
                            ref={(el) => {
                              if (!el) return;
                              const n = filteredFailedBulk.length;
                              const c = filteredFailedBulk.filter((r) => failedBulkSelected.has(r.id)).length;
                              el.indeterminate = c > 0 && c < n;
                            }}
                            onChange={() => toggleSelectAllFailedBulk(filteredFailedBulk)}
                            disabled={failedBulkBulkBusy}
                            className="h-4 w-4 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </th>
                        <th className={RB_TH}>File</th>
                        <th className={RB_TH}>Failure reason</th>
                        <th className={RB_TH}>Removed</th>
                        <th className={`${RB_TH} text-right`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/80">
                      {filteredFailedBulk.map((row) => {
                        const rowPending = failedBulkLocalPending[row.id];
                        const isSel = failedBulkSelected.has(row.id);
                        return (
                          <tr
                            key={row.id}
                            className={`${RB_TABLE_BODY_ROW} ${isSel ? 'bg-indigo-50/80' : ''}`}
                          >
                            <td className="px-3 py-3 sm:px-4">
                              <input
                                type="checkbox"
                                aria-label={`Select ${row.fileName}`}
                                checked={isSel}
                                onChange={() => toggleFailedBulkSelection(row.id)}
                                disabled={failedBulkBulkBusy || !!rowPending}
                                className="h-4 w-4 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              />
                            </td>
                            <td className="px-3 py-3 text-xs font-semibold text-slate-900 sm:px-4">{row.fileName}</td>
                            <td className="max-w-[280px] truncate px-3 py-3 text-xs text-slate-600 sm:px-4" title={row.reason}>
                              {row.reason}
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500 sm:px-4">
                              {row.trashedAt ? formatDateTimeDMY(row.trashedAt) : '—'}
                            </td>
                            <td className="px-3 py-3 sm:px-4">
                              <div className="inline-flex flex-wrap items-center justify-end gap-0.5 rounded-2xl bg-slate-100/70 p-1 ring-1 ring-slate-200/60">
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
                                  className="inline-flex items-center gap-1 rounded-xl border border-emerald-200/80 bg-white px-2.5 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm transition-all hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
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
                                  className="inline-flex items-center gap-1 rounded-xl border border-rose-200/80 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-700 shadow-sm transition-all hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
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
          const displayItems = state.items.filter(trashItemMatches);

          return (
            <section key={cfg.key} className={PH2_TABLE_CARD_CLASS}>
              <div className="flex flex-col border-b border-indigo-100/40 bg-gradient-to-br from-white via-indigo-50/25 to-violet-50/20 sm:flex-row sm:items-stretch">
                <button
                  type="button"
                  onClick={() => toggleSection(cfg.key)}
                  className="flex flex-1 items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-white/40 sm:min-w-0"
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
                  <div className="flex shrink-0 items-center gap-2 pr-2">
                    {state.loading && <Loader2 size={16} className="animate-spin text-indigo-400" />}
                    {state.expanded ? (
                      <ChevronDown size={18} className="text-slate-400" />
                    ) : (
                      <ChevronRight size={18} className="text-slate-400" />
                    )}
                  </div>
                </button>
                {showBulkInHeader ? (
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-indigo-100/40 bg-white/50 px-3 py-2.5 sm:border-l sm:border-t-0">
                    <button
                      type="button"
                      onClick={() => void handleBulkRestore(cfg)}
                      disabled={busy || selectedCount === 0}
                      title={
                        selectedCount === 0
                          ? 'Select rows below or use the header checkbox to select all'
                          : `Restore ${selectedCount} selected`
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200/70 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.2)] transition-all hover:border-emerald-200 hover:bg-emerald-50/90 disabled:cursor-not-allowed disabled:opacity-50"
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
                      className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-rose-600 to-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md transition-all hover:from-rose-700 hover:to-red-700 disabled:cursor-not-allowed disabled:opacity-50"
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
                <div className="border-t border-indigo-100/40">
                  {state.error ? (
                    <div className="flex items-center gap-2 bg-amber-50 px-4 py-6 text-sm text-amber-800">
                      <AlertTriangle size={16} />
                      {state.error}
                    </div>
                  ) : state.loading ? (
                    <div className="flex items-center gap-2 px-4 py-6 text-sm text-slate-500">
                      <Loader2 size={14} className="animate-spin text-indigo-400" />
                      Loading deleted {cfg.label.toLowerCase()}…
                    </div>
                  ) : state.items.length === 0 ? (
                    <div className="px-4 py-10 text-center text-sm text-slate-500">{cfg.empty}</div>
                  ) : displayItems.length === 0 ? (
                    <div className="px-4 py-10 text-center text-sm text-slate-500">No rows match your search.</div>
                  ) : (
                    (() => {
                      const allChecked =
                        displayItems.length > 0 && displayItems.every((it) => sectionSelected.has(it.id));
                      const someChecked =
                        displayItems.some((it) => sectionSelected.has(it.id)) && !allChecked;
                      return (
                        <>
                          {selectedCount > 0 ? (
                            <div className="flex items-center justify-between gap-3 border-b border-indigo-100/40 bg-indigo-50/30 px-4 py-2 text-sm">
                              <span className="font-medium text-slate-700">
                                {selectedCount} selected — use{' '}
                                <span className="font-semibold text-slate-900">Bulk restore</span> or{' '}
                                <span className="font-semibold text-slate-900">Bulk delete</span> in the card header
                              </span>
                              <button
                                type="button"
                                onClick={() => clearSelection(cfg.key)}
                                disabled={busy}
                                className="text-xs font-semibold text-rose-600 hover:text-rose-800 disabled:opacity-50"
                              >
                                Clear
                              </button>
                            </div>
                          ) : null}
                          <div className="no-scrollbar overflow-x-auto">
                            <table className="min-w-full text-left text-sm">
                              <thead>
                                <tr className={RB_TABLE_HEAD_ROW}>
                                  <th className={`${RB_TH} w-10`}>
                                    <input
                                      type="checkbox"
                                      aria-label={`Select all deleted ${cfg.label.toLowerCase()}`}
                                      checked={allChecked}
                                      ref={(el) => {
                                        if (el) el.indeterminate = someChecked;
                                      }}
                                      onChange={() => toggleSelectAll(cfg, displayItems)}
                                      disabled={busy}
                                      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                  </th>
                                  <th className={RB_TH}>Name</th>
                                  <th className={RB_TH}>Details</th>
                                  <th className={RB_TH}>Deleted</th>
                                  <th className={`${RB_TH} text-right`}>Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100/80">
                                {displayItems.map((item) => {
                                  const rowPending = pending[item.id];
                                  const isSelected = sectionSelected.has(item.id);
                                  return (
                                    <tr
                                      key={item.id}
                                      className={`${RB_TABLE_BODY_ROW} ${isSelected ? 'bg-indigo-50/85' : ''}`}
                                    >
                                      <td className="px-3 py-3 sm:px-4">
                                        <input
                                          type="checkbox"
                                          aria-label={`Select ${item.primary}`}
                                          checked={isSelected}
                                          onChange={() => toggleRowSelection(cfg.key, item.id)}
                                          disabled={busy || !!rowPending}
                                          className="h-4 w-4 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                      </td>
                                      <td className="px-3 py-3 text-xs font-semibold text-slate-900 sm:px-4">
                                        {item.primary}
                                      </td>
                                      <td className="max-w-[260px] truncate px-3 py-3 text-xs text-slate-600 sm:px-4">
                                        {item.secondary || '—'}
                                      </td>
                                      <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500 sm:px-4">
                                        {item.deletedAt ? formatDateTimeDMY(item.deletedAt) : '—'}
                                      </td>
                                      <td className="px-3 py-3 sm:px-4">
                                        <div className="inline-flex flex-wrap items-center justify-end gap-0.5 rounded-2xl bg-slate-100/70 p-1 ring-1 ring-slate-200/60">
                                          <button
                                            type="button"
                                            onClick={() => handleRestore(cfg, item)}
                                            disabled={!!rowPending || busy}
                                            className="inline-flex items-center gap-1 rounded-xl border border-emerald-200/80 bg-white px-2.5 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm transition-all hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
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
                                            className="inline-flex items-center gap-1 rounded-xl border border-rose-200/80 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-700 shadow-sm transition-all hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
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
      </main>
    </div>
  );
}
