'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  HqPageContainer,
  HqPageHeader,
  HqPageMain,
  HqSecondaryButton,
  HqStatCard,
} from '@/components/hq/hqUi';
import { HqPhase1ConnectionBar } from '@/components/hq/HqPhase1ConnectionBar';
import {
  apiHqDeletePortalJob,
  apiHqListPortal,
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

export default function HqPortalPage() {
  const [jobs, setJobs] = useState<HqPortalJobRow[]>([]);
  const [stats, setStats] = useState<HqPortalStats>(EMPTY_STATS);
  const [storage, setStorage] = useState<HqPortalStorageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [deletingJobKey, setDeletingJobKey] = useState<string | null>(null);

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

  const handleDeleteJob = async (row: HqPortalJobRow) => {
    const label = row.title || 'this job';
    const scope = row.tenantDbName
      ? `tenant ${row.tenantDbName}, Phase 1 portal, and Phase 2 CRM`
      : 'Phase 1 portal';

    const confirmed = window.confirm(
      `Delete "${label}" permanently?\n\nThis removes the job from ${scope}. This cannot be undone.`,
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
    <HqPageMain>
      <HqPageContainer>
        <HqPageHeader
          title="Portal"
          subtitle="Phase 1 job portal — open jobs posted across tenants and the public portal."
          actions={
            <HqSecondaryButton onClick={() => void loadPortal()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </HqSecondaryButton>
          }
        />

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

        <section className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <HqStatCard label="Total Jobs" value={stats.totalJobs} active />
          <HqStatCard label="Phase 2 Open" value={stats.phase2Jobs} />
          <HqStatCard label="Tenant Jobs" value={stats.tenantJobs} />
          <HqStatCard label="Portal Only" value={stats.portalOnlyJobs} />
        </section>

        <section className="mb-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search jobs by title, company, tenant…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-100"
              />
            </div>
            <p className="text-xs font-semibold text-slate-500">
              {loading ? 'Loading…' : `${filteredJobs.length} shown`}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Job</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Origin</th>
                  <th className="px-4 py-3">Posted by</th>
                  <th className="px-4 py-3">Openings</th>
                  <th className="px-4 py-3">Posted</th>
                  <th className="px-4 py-3 text-right">Actions</th>
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
                      <td className="px-4 py-3 text-slate-700">{row.company}</td>
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
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </HqPageContainer>
    </HqPageMain>
  );
}
