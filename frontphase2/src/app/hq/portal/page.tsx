'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Briefcase, Loader2, RefreshCw, Search, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import {
  HqPageContainer,
  HqPageHeader,
  HqPageMain,
  HqSecondaryButton,
  HqStatCard,
} from '@/components/hq/hqUi';
import {
  apiHqDeletePortalJob,
  apiHqListPortal,
  type HqPortalCandidateRow,
  type HqPortalJobRow,
  type HqPortalStats,
  type HqPortalStorageInfo,
} from '@/lib/api';

type PortalTab = 'candidates' | 'jobs';

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

function OriginBadge({ origin }: { origin: HqPortalCandidateRow['origin'] }) {
  const label =
    origin === 'phase1_common'
      ? 'Phase 1 common'
      : origin === 'phase2_crm'
        ? 'Phase 2 CRM'
        : 'Phase 1 portal';

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
  const [activeTab, setActiveTab] = useState<PortalTab>('candidates');
  const [candidates, setCandidates] = useState<HqPortalCandidateRow[]>([]);
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
      setCandidates(d?.candidates ?? []);
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

  const filteredCandidates = useMemo(() => {
    if (!needle) return candidates;
    return candidates.filter((row) => {
      const hay = [
        row.name,
        row.email,
        row.phone,
        row.title,
        row.location,
        row.status,
        row.source,
        row.stage,
        row.tenantDbName,
        row.origin,
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [candidates, needle]);

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
          subtitle="Phase 1 job portal plus Phase 2 CRM — all candidates and open jobs across tenants."
          actions={
            <HqSecondaryButton onClick={() => void loadPortal()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </HqSecondaryButton>
          }
        />

        {storage ? (
          <p className="mb-4 text-xs text-slate-500">
            Phase 1 portal{' '}
            <span className="font-semibold text-slate-700">{storage.portal.database}</span>
            {storage.common ? (
              <>
                , common pool{' '}
                <span className="font-semibold text-slate-700">{storage.common.database}</span>
              </>
            ) : null}
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

        <section className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
          <HqStatCard label="Total Candidates" value={stats.totalCandidates} active />
          <HqStatCard label="Phase 1 Portal" value={stats.portalCandidates} />
          <HqStatCard label="Phase 1 Common" value={stats.commonCandidates} />
          <HqStatCard label="Phase 2 CRM" value={stats.phase2Candidates} />
          <HqStatCard label="Total Jobs" value={stats.totalJobs} />
          <HqStatCard label="Phase 2 Open" value={stats.phase2Jobs} />
          <HqStatCard label="Tenant Jobs" value={stats.tenantJobs} />
          <HqStatCard label="Tenants" value={stats.tenantCount} />
        </section>

        <section className="mb-4 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex min-w-max items-center gap-1 border-b border-slate-100 px-2 py-2">
            <button
              type="button"
              onClick={() => setActiveTab('candidates')}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                activeTab === 'candidates'
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <UserRound className="h-4 w-4" />
              Candidates
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  activeTab === 'candidates'
                    ? 'bg-white text-slate-700 ring-1 ring-slate-200'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {candidates.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('jobs')}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                activeTab === 'jobs'
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <Briefcase className="h-4 w-4" />
              Jobs
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  activeTab === 'jobs'
                    ? 'bg-white text-slate-700 ring-1 ring-slate-200'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {jobs.length}
              </span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  activeTab === 'candidates'
                    ? 'Search candidates by name, email, title…'
                    : 'Search jobs by title, company, tenant…'
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-100"
              />
            </div>
            <p className="text-xs font-semibold text-slate-500">
              {loading
                ? 'Loading…'
                : activeTab === 'candidates'
                  ? `${filteredCandidates.length} shown`
                  : `${filteredJobs.length} shown`}
            </p>
          </div>

          {activeTab === 'candidates' ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Candidate</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Tenant</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCandidates.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                        {loading ? 'Loading candidates…' : 'No candidates found.'}
                      </td>
                    </tr>
                  ) : (
                    filteredCandidates.map((row) => (
                      <tr
                        key={`${row.origin}-${row.tenantDbName || 'none'}-${row.id}`}
                        className="border-b border-slate-100 transition hover:bg-slate-50/60"
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{row.name}</div>
                          <div className="mt-1">
                            <OriginBadge origin={row.origin} />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-slate-700">{row.email || '—'}</div>
                          <div className="text-xs text-slate-500">{row.phone || '—'}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{row.title || '—'}</td>
                        <td className="px-4 py-3 text-slate-700">{row.location || '—'}</td>
                        <td className="px-4 py-3">
                          <StatusPill value={row.status} />
                        </td>
                        <td className="px-4 py-3 text-slate-600">{row.tenantDbName || '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{row.source || '—'}</td>
                        <td className="px-4 py-3 text-slate-500">{formatDate(row.updatedAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
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
                            disabled={deletingJobKey === `${row.origin}-${row.tenantDbName || 'none'}-${row.id}`}
                            onClick={() => void handleDeleteJob(row)}
                            className={DELETE_BTN_CLASS}
                          >
                            {deletingJobKey === `${row.origin}-${row.tenantDbName || 'none'}-${row.id}` ? (
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
          )}
        </section>
      </HqPageContainer>
    </HqPageMain>
  );
}
