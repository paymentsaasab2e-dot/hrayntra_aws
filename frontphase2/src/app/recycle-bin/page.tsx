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
  const [bulkBusy, setBulkBusy] = useState<Record<EntityKind, boolean>>({
    leads: false,
    clients: false,
    candidates: false,
    jobs: false,
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

  const handleBulkPurge = async (cfg: SectionConfig) => {
    const ids = Array.from(selected[cfg.key]);
    if (!ids.length) return;
    const count = ids.length;
    const ok = await requestConfirm(
      `Permanently delete ${count} ${count === 1 ? cfg.singular : cfg.label.toLowerCase()}? This cannot be undone.`,
      { confirmLabel: 'Delete forever', cancelLabel: 'Cancel', tone: 'error' }
    );
    if (!ok) return;
    setBulkBusy((b) => ({ ...b, [cfg.key]: true }));
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
      setBulkBusy((b) => ({ ...b, [cfg.key]: false }));
    }
  };

  const totalDeleted = SECTION_CONFIG.reduce((sum, cfg) => sum + sections[cfg.key].items.length, 0);

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
            Anything you delete from Leads, Clients, Candidates, or Jobs lands here. You can restore
            it back to its module or permanently delete it. Permanent deletion can not be undone.
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
        {SECTION_CONFIG.map((cfg) => {
          const state = sections[cfg.key];
          const Icon = cfg.icon;
          return (
            <section
              key={cfg.key}
              className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggleSection(cfg.key)}
                className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${cfg.accent}`}>
                    <Icon size={16} />
                  </span>
                  <div>
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
                <div className="flex items-center gap-3">
                  {state.loading && <Loader2 size={16} className="animate-spin text-slate-400" />}
                  {state.expanded ? (
                    <ChevronDown size={18} className="text-slate-400" />
                  ) : (
                    <ChevronRight size={18} className="text-slate-400" />
                  )}
                </div>
              </button>

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
                      const sectionSelected = selected[cfg.key];
                      const selectedCount = sectionSelected.size;
                      const allChecked =
                        state.items.length > 0 && state.items.every((it) => sectionSelected.has(it.id));
                      const someChecked = selectedCount > 0 && !allChecked;
                      const busy = bulkBusy[cfg.key];
                      return (
                        <>
                          {selectedCount > 0 && (
                            <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-red-50/70 border-b border-red-100">
                              <div className="flex items-center gap-3 text-sm">
                                <span className="font-semibold text-red-700">
                                  {selectedCount} selected
                                </span>
                                <button
                                  type="button"
                                  onClick={() => clearSelection(cfg.key)}
                                  disabled={busy}
                                  className="text-xs font-medium text-slate-500 hover:text-slate-700 disabled:opacity-60"
                                >
                                  Clear
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleBulkPurge(cfg)}
                                disabled={busy}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                                title={`Permanently delete ${selectedCount} ${selectedCount === 1 ? cfg.singular : cfg.label.toLowerCase()}`}
                              >
                                {busy ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <Trash2 size={12} />
                                )}
                                Delete forever ({selectedCount})
                              </button>
                            </div>
                          )}
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
