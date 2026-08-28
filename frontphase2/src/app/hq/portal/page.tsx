'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Globe, Loader2, RefreshCw, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { requestConfirm } from '@/lib/appDialog';
import {
  HqModulePageLayout,
  HQ_TABLE_BODY_SCROLL_CLASS,
  HQ_TABLE_CARD_CLASS,
  HQ_TOOLBAR_ROW_CLASS,
} from '@/components/hq/HqModulePageLayout';
import { HqSecondaryButton, HqStatCard } from '@/components/hq/hqUi';
import { HqPhase1ConnectionBar } from '@/components/hq/HqPhase1ConnectionBar';
import {
  apiHqDeletePortalJob,
  apiHqListPortal,
  apiHqSetPortalJobClientVisibility,
  type HqPortalJobRow,
  type HqPortalStats,
  type HqPortalStorageInfo,
} from '@/lib/api';

const EMPTY_STATS: HqPortalStats = {
  totalCandidates: 0,
  portalCandidates: 0,
  commonCandidates: 0,
  phase2Candidates: 0,
  totalJobs: 0,
  phase2Jobs: 0,
  tenantJobs: 0,
  portalOnlyJobs: 0,
  tenantCount: 0,
};

function formatDate(value: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function JobOriginBadge({ origin }: { origin: HqPortalJobRow['origin'] }) {
  const label = origin === 'phase2_crm' ? 'Phase 2 CRM' : 'Phase 1 portal';
  const style =
    origin === 'phase2_crm'
      ? 'bg-violet-50 text-violet-700 ring-violet-200'
      : 'bg-sky-50 text-sky-700 ring-sky-200';

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${style}`}
    >
      {label}
    </span>
  );
}

function StatusPill({ value }: { value: string }) {
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">
      {value}
    </span>
  );
}

const DELETE_BTN_CLASS =
  'inline-flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700 transition hover:bg-rose-100 disabled:opacity-50';

const VISIBILITY_BTN_CLASS =
  'inline-flex items-center justify-center rounded-lg border p-2 transition disabled:opacity-50';

function jobRowKey(row: HqPortalJobRow) {
  return `${row.origin}-${row.tenantDbName || 'none'}-${row.id}`;
}

function isClientNameVisible(row: HqPortalJobRow) {
  return row.showClientNamePublicly !== false;
}

export default function HqPortalPage() {
  const [jobs, setJobs] = useState<HqPortalJobRow[]>([]);
  const [stats, setStats] = useState<HqPortalStats>(EMPTY_STATS);
  const [storage, setStorage] = useState<HqPortalStorageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [deletingJobKey, setDeletingJobKey] = useState<string | null>(null);
  const [visibilityJobKey, setVisibilityJobKey] = useState<string | null>(null);
  const [bulkHiding, setBulkHiding] = useState(false);

  const loadPortal = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await apiHqListPortal();
      const d = result.data;
      setJobs(d?.jobs ?? []);
      setStats(d?.stats ?? EMPTY_STATS);
      setStorage(d?.storage ?? null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load portal data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPortal();
  }, [loadPortal]);

  const needle = search.trim().toLowerCase();

  const filteredJobs = useMemo(() => {
    if (!needle) return jobs;
    return jobs.filter((row) => {
      const hay = [
        row.title,
        row.company,
        row.location,
        row.status,
        row.workMode,
        row.tenantDbName,
        row.postedBy,
        row.visibility,
        row.origin,
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [jobs, needle]);

  const hiddenClientCount = useMemo(
    () => filteredJobs.filter((row) => !isClientNameVisible(row)).length,
    [filteredJobs],
  );
  const visibleClientCount = filteredJobs.length - hiddenClientCount;

  const applyClientVisibilityToRow = (row: HqPortalJobRow, show: boolean) => {
    setJobs((prev) =>
      prev.map((job) =>
        job.id === row.id &&
        job.tenantDbName === row.tenantDbName &&
        job.origin === row.origin
          ? { ...job, showClientNamePublicly: show, hqHideClientName: !show }
          : job,
      ),
    );
  };

  const handleToggleClientName = async (row: HqPortalJobRow) => {
    const nextShow = !isClientNameVisible(row);
    setVisibilityJobKey(jobRowKey(row));
    try {
      await apiHqSetPortalJobClientVisibility(row.id, {
        showClientNamePublicly: nextShow,
        tenantDbName: row.tenantDbName || undefined,
      });
      applyClientVisibilityToRow(row, nextShow);
      toast.success(
        nextShow
          ? 'Client name is now visible on Phase 1'
          : 'Client name hidden on Phase 1 job cards',
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to update client name visibility',
      );
    } finally {
      setVisibilityJobKey(null);
    }
  };

  const handleBulkHideClientNames = async (show: boolean) => {
    const targets = filteredJobs.filter((row) => isClientNameVisible(row) !== show);
    if (targets.length === 0) {
      toast.info(show ? 'All shown jobs already display the client name.' : 'All shown jobs already hide the client name.');
      return;
    }

    const confirmed = await requestConfirm(
      `${show ? 'Show' : 'Hide'} the client name on Phase 1 for ${targets.length} job${
        targets.length === 1 ? '' : 's'
      }?\n\nThis affects the Phase 1 job cards and job detail pages.`,
      {
        tone: show ? 'info' : 'warning',
        title: show ? 'Show client names' : 'Hide client names',
        confirmLabel: show ? 'Show all' : 'Hide all',
        cancelLabel: 'Cancel',
      },
    );
    if (!confirmed) return;

    setBulkHiding(true);
    let failed = 0;
    for (const row of targets) {
      try {
        await apiHqSetPortalJobClientVisibility(row.id, {
          showClientNamePublicly: show,
          tenantDbName: row.tenantDbName || undefined,
        });
        applyClientVisibilityToRow(row, show);
      } catch {
        failed += 1;
      }
    }
    setBulkHiding(false);

    if (failed === 0) {
      toast.success(
        show
          ? `Client name shown on Phase 1 for ${targets.length} job(s)`
          : `Client name hidden on Phase 1 for ${targets.length} job(s)`,
      );
    } else {
      toast.error(`${failed} of ${targets.length} job(s) could not be updated`);
    }
  };

  const handleDeleteJob = async (row: HqPortalJobRow) => {
    const label = row.title || 'this job';
    const scope = row.tenantDbName
      ? `tenant ${row.tenantDbName}, Phase 1 portal, and Phase 2 CRM`
      : 'Phase 1 portal';

    const confirmed = await requestConfirm(
      `Delete "${label}" permanently?\n\nThis removes the job from ${scope}. This cannot be undone.`,
      {
        tone: 'warning',
        title: 'Delete portal job',
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
      },
    );
    if (!confirmed) return;

    const rowKey = `${row.origin}-${row.tenantDbName || 'none'}-${row.id}`;
    setDeletingJobKey(rowKey);
    try {
      await apiHqDeletePortalJob(row.id, {
        tenantDbName: row.tenantDbName || undefined,
      });
      setJobs((prev) =>
        prev.filter(
          (job) =>
            !(
              job.id === row.id &&
              job.tenantDbName === row.tenantDbName &&
              job.origin === row.origin
            ),
        ),
      );
      toast.success('Job deleted from tenant and portal');
      void loadPortal();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete job');
    } finally {
      setDeletingJobKey(null);
    }
  };

  return (
    <HqModulePageLayout
      title="Portal"
      subtitle="Phase 1 job portal — open jobs posted across tenants and the public portal."
      icon={<Globe className="h-5 w-5" />}
      actions={
        <>
          <HqSecondaryButton
            onClick={() => void handleBulkHideClientNames(true)}
            disabled={loading || bulkHiding || hiddenClientCount === 0}
          >
            <Eye className="h-4 w-4" />
            Show client names
          </HqSecondaryButton>
          <HqSecondaryButton
            onClick={() => void handleBulkHideClientNames(false)}
            disabled={loading || bulkHiding || visibleClientCount === 0}
          >
            {bulkHiding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <EyeOff className="h-4 w-4" />
            )}
            Hide client names
          </HqSecondaryButton>
          <HqSecondaryButton onClick={() => void loadPortal()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </HqSecondaryButton>
        </>
      }
    >

        <HqPhase1ConnectionBar
          live={!loadError && !loading}
          candidateCount={stats.totalCandidates}
          onRefresh={() => void loadPortal()}
          loading={loading}
          compact
        />

        {storage ? (
          <p className="mb-4 text-xs text-slate-500">
            Phase 1 portal{' '}
            <span className="font-semibold text-slate-700">{storage.portal.database}</span>
            {storage.phase2?.tenantDatabases?.length ? (
              <>
                , Phase 2 tenants ({storage.phase2.tenantDatabases.length}):{' '}
                <span className="font-semibold text-slate-700">
                  {storage.phase2.tenantDatabases.join(', ')}
                </span>
              </>
            ) : null}
          </p>
        ) : null}

        {loadError ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {loadError}
            <button
              type="button"
              onClick={() => void loadPortal()}
              className="ml-2 font-semibold underline"
            >
              Retry
            </button>
          </div>
        ) : null}

        <div className="mb-5 grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <HqStatCard label="Total Jobs" value={stats.totalJobs} active />
          <HqStatCard label="Phase 2 Open" value={stats.phase2Jobs} />
          <HqStatCard label="Tenant Jobs" value={stats.tenantJobs} />
          <HqStatCard label="Portal Only" value={stats.portalOnlyJobs} />
        </div>

        <div className={HQ_TABLE_CARD_CLASS}>
          <div className={HQ_TOOLBAR_ROW_CLASS}>
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search jobs by title, company, tenant…"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-100"
              />
            </div>
            <p className="text-xs font-semibold text-slate-500">
              {loading ? 'Loading…' : `${filteredJobs.length} shown`}
            </p>
          </div>

          <div className={HQ_TABLE_BODY_SCROLL_CLASS}>
            <table className="min-w-full text-left">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Company</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Origin</th>
                  <th>Posted by</th>
                  <th>Openings</th>
                  <th>Posted</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                      {loading ? 'Loading jobs…' : 'No jobs found.'}
                    </td>
                  </tr>
                ) : (
                  filteredJobs.map((row) => (
                    <tr
                      key={`${row.origin}-${row.tenantDbName || 'none'}-${row.id}`}
                      className="border-b border-slate-100 transition hover:bg-slate-50/60"
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{row.title}</div>
                        {row.workMode ? (
                          <div className="mt-1 text-xs text-slate-500">{row.workMode}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <div>{row.clientName || row.company}</div>
                        {!isClientNameVisible(row) ? (
                          <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-amber-200">
                            <EyeOff className="h-3 w-3" />
                            {row.hqHideClientName ? 'Hidden by HQ' : 'Hidden on Phase 1'}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{row.location || '—'}</td>
                      <td className="px-4 py-3">
                        <StatusPill value={row.status} />
                      </td>
                      <td className="px-4 py-3">
                        <JobOriginBadge origin={row.origin} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-700">{row.postedBy}</div>
                        {row.tenantDbName ? (
                          <div className="text-xs text-slate-500">{row.tenantDbName}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{row.openings}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(row.postedDate)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                        <button
                          type="button"
                          title={
                            isClientNameVisible(row)
                              ? 'Hide client name on Phase 1 job cards'
                              : 'Show client name on Phase 1 job cards'
                          }
                          aria-label={
                            isClientNameVisible(row)
                              ? 'Hide client name on Phase 1'
                              : 'Show client name on Phase 1'
                          }
                          disabled={visibilityJobKey === jobRowKey(row) || bulkHiding}
                          onClick={() => void handleToggleClientName(row)}
                          className={`${VISIBILITY_BTN_CLASS} ${
                            isClientNameVisible(row)
                              ? 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                              : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                          }`}
                        >
                          {visibilityJobKey === jobRowKey(row) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : isClientNameVisible(row) ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeOff className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          title="Delete job from tenant and portal"
                          disabled={
                            deletingJobKey ===
                            `${row.origin}-${row.tenantDbName || 'none'}-${row.id}`
                          }
                          onClick={() => void handleDeleteJob(row)}
                          className={DELETE_BTN_CLASS}
                        >
                          {deletingJobKey ===
                          `${row.origin}-${row.tenantDbName || 'none'}-${row.id}` ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
    </HqModulePageLayout>
  );
}
