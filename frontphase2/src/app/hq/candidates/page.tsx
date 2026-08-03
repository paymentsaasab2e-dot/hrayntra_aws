'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, UserRound } from 'lucide-react';
import {
  HqModulePageLayout,
  HQ_TABLE_BODY_SCROLL_CLASS,
  HQ_TABLE_CARD_CLASS,
  HQ_TOOLBAR_ROW_CLASS,
} from '@/components/hq/HqModulePageLayout';
import { HqSecondaryButton, HqStatCard } from '@/components/hq/hqUi';
import { HqPhase1ConnectionBar } from '@/components/hq/HqPhase1ConnectionBar';
import { HqCandidateBehaviorPanel } from '@/components/hq/HqCandidateBehaviorPanel';
import {
  apiHqListCandidates,
  type HqPortalCandidateRow,
  type HqPortalStorageInfo,
} from '@/lib/api';

type OriginFilter = 'all' | 'phase1_portal' | 'phase1_common';

type CandidateStats = {
  totalCandidates: number;
  portalCandidates: number;
  commonCandidates: number;
};

const EMPTY_STATS: CandidateStats = {
  totalCandidates: 0,
  portalCandidates: 0,
  commonCandidates: 0,
};

function formatDate(value: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function OriginBadge({ origin }: { origin: HqPortalCandidateRow['origin'] }) {
  const label = origin === 'phase1_common' ? 'Phase 1 common' : 'Phase 1 portal';
  const style =
    origin === 'phase1_common'
      ? 'bg-amber-50 text-amber-800 ring-amber-200'
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
      {value || '—'}
    </span>
  );
}

const ORIGIN_TABS: Array<{ id: OriginFilter; label: string }> = [
  { id: 'all', label: 'All Phase 1' },
  { id: 'phase1_portal', label: 'Portal' },
  { id: 'phase1_common', label: 'Common Pool' },
];

export default function HqCandidatesPage() {
  const [candidates, setCandidates] = useState<HqPortalCandidateRow[]>([]);
  const [stats, setStats] = useState<CandidateStats>(EMPTY_STATS);
  const [storage, setStorage] = useState<HqPortalStorageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [originFilter, setOriginFilter] = useState<OriginFilter>('all');
  const [selectedCandidate, setSelectedCandidate] = useState<HqPortalCandidateRow | null>(null);

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await apiHqListCandidates();
      const d = result.data;
      // Keep Phase 1 only on the client as a safety net if older API still returns Phase 2.
      const phase1Only = (Array.isArray(d?.candidates) ? d.candidates : []).filter(
        (row) => row.origin === 'phase1_portal' || row.origin === 'phase1_common',
      );
      setCandidates(phase1Only);
      setStats({
        totalCandidates: d?.stats?.totalCandidates ?? phase1Only.length,
        portalCandidates:
          d?.stats?.portalCandidates ??
          phase1Only.filter((c) => c.origin === 'phase1_portal').length,
        commonCandidates:
          d?.stats?.commonCandidates ??
          phase1Only.filter((c) => c.origin === 'phase1_common').length,
      });
      setStorage(d?.storage ?? null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load candidates');
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCandidates();
  }, [loadCandidates]);

  const needle = search.trim().toLowerCase();

  const filteredCandidates = useMemo(() => {
    return candidates.filter((row) => {
      if (originFilter !== 'all' && row.origin !== originFilter) return false;
      if (!needle) return true;
      const hay = [
        row.name,
        row.email,
        row.phone,
        row.title,
        row.location,
        row.status,
        row.source,
        row.stage,
        row.origin,
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [candidates, needle, originFilter]);

  const tabCounts = useMemo(
    () => ({
      all: candidates.length,
      phase1_portal: candidates.filter((c) => c.origin === 'phase1_portal').length,
      phase1_common: candidates.filter((c) => c.origin === 'phase1_common').length,
    }),
    [candidates],
  );

  return (
    <HqModulePageLayout
      title="Candidates"
      subtitle="Phase 1 candidates only — job portal and common pool."
      icon={<UserRound className="h-5 w-5" />}
      actions={
        <HqSecondaryButton onClick={() => void loadCandidates()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </HqSecondaryButton>
      }
      belowScroll={
        selectedCandidate ? (
          <HqCandidateBehaviorPanel
            candidate={selectedCandidate}
            onClose={() => setSelectedCandidate(null)}
          />
        ) : null
      }
    >
      <HqPhase1ConnectionBar
        live={!loadError && !loading}
        candidateCount={stats.totalCandidates}
        onRefresh={() => void loadCandidates()}
        loading={loading}
        compact
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
          </p>
        ) : null}

        {loadError ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {loadError}
            <button
              type="button"
              onClick={() => void loadCandidates()}
              className="ml-2 font-semibold underline"
            >
              Retry
            </button>
          </div>
        ) : null}

        <div className="mb-5 grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
          <HqStatCard label="Phase 1 Total" value={stats.totalCandidates} active />
          <HqStatCard label="Portal" value={stats.portalCandidates} />
          <HqStatCard label="Common Pool" value={stats.commonCandidates} />
        </div>

        <div className={HQ_TABLE_CARD_CLASS}>
          <div className={HQ_TOOLBAR_ROW_CLASS}>
            <div className="flex min-w-max items-center gap-1 overflow-x-auto">
              {ORIGIN_TABS.map((tab) => {
                const active = originFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setOriginFilter(tab.id)}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      active
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                    }`}
                  >
                    {tab.label}
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        active ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {tabCounts[tab.id]}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Phase 1 candidates by name, email, title…"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-100"
              />
            </div>
            <p className="text-xs font-semibold text-slate-500">
              {loading
                ? 'Loading Phase 1 candidates…'
                : `${filteredCandidates.length} of ${candidates.length} listed · click a row for behaviour analysis`}
            </p>
          </div>

          <div className={HQ_TABLE_BODY_SCROLL_CLASS}>
            <table className="min-w-full text-left">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Candidate</th>
                  <th>Contact</th>
                  <th>Title</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Source</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {filteredCandidates.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                      {loading ? 'Loading candidates…' : 'No Phase 1 candidates found.'}
                    </td>
                  </tr>
                ) : (
                  filteredCandidates.map((row, index) => (
                    <tr
                      key={`${row.origin}-${row.id}`}
                      onClick={() => setSelectedCandidate(row)}
                      className="cursor-pointer border-b border-slate-100 transition hover:bg-indigo-50/40"
                    >
                      <td className="px-4 py-3 text-xs text-slate-400">{index + 1}</td>
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
                      <td className="px-4 py-3 text-slate-600">{row.source || '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(row.updatedAt)}</td>
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
