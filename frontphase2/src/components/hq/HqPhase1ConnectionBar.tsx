'use client';

import Link from 'next/link';
import { ExternalLink, Globe2, RefreshCcw, Users } from 'lucide-react';
import { getPhase1PortalUrl } from './HqBrandLogo';

type Props = {
  live?: boolean | null;
  generatedAt?: string | null;
  candidateCount?: number | null;
  sessionLogins7d?: number | null;
  onRefresh?: () => void;
  loading?: boolean;
  compact?: boolean;
};

export function HqPhase1ConnectionBar({
  live,
  generatedAt,
  candidateCount,
  sessionLogins7d,
  onRefresh,
  loading,
  compact,
}: Props) {
  const portalUrl = getPhase1PortalUrl();
  const updated = generatedAt
    ? new Date(generatedAt).toLocaleString(undefined, {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
        live
          ? 'border-emerald-200/80 bg-emerald-50/60'
          : 'border-amber-200/80 bg-amber-50/70'
      } ${compact ? 'mb-3' : 'mb-5'}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
              live
                ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200'
                : 'bg-amber-100 text-amber-800 ring-1 ring-amber-200'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {live ? 'Phase 1 connected' : 'Phase 1 waiting'}
          </span>
          {candidateCount != null ? (
            <span className="text-xs text-slate-600">
              <strong className="text-slate-800">{candidateCount.toLocaleString()}</strong> candidates
            </span>
          ) : null}
          {sessionLogins7d != null ? (
            <span className="text-xs text-slate-600">
              · <strong className="text-slate-800">{sessionLogins7d.toLocaleString()}</strong> logins / 7d
            </span>
          ) : null}
          {updated ? <span className="text-[11px] text-slate-400">· updated {updated}</span> : null}
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          HQ reads live Phase 1 portal DB (candidates, jobs, applications, sessions).
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/hq/candidates"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <Users className="h-3.5 w-3.5" />
          Candidates
        </Link>
        <Link
          href="/hq/portal"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <Globe2 className="h-3.5 w-3.5" />
          Portal jobs
        </Link>
        <a
          href={portalUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
        >
          Open Phase 1
          <ExternalLink className="h-3 w-3" />
        </a>
        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
            title="Refresh Phase 1 data"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
