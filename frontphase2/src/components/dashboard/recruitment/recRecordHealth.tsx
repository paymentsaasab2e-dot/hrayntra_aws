'use client';

import React from 'react';
import type { RecruitmentOverview } from '@/lib/dashboard/api';
import { CrmStatNumber } from '@/components/dashboard/crm/crmStatNumber';
import { formatNum, relativeTime } from './recShared';

export type RecHealthDriver = {
  label: string;
  value: string;
  hint?: string;
  score: number;
  max: number;
};

type JobRow = NonNullable<RecruitmentOverview['jobsTable']>[number];
type CandRow = NonNullable<RecruitmentOverview['candidatesTable']>[number];

export function daysSince(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return Math.max(0, Math.round((Date.now() - d.getTime()) / 86_400_000));
}

export function recencyPts(iso?: string | null, max = 20) {
  const days = daysSince(iso);
  if (days == null) return 0;
  if (days <= 3) return max;
  if (days <= 7) return Math.round(max * 0.8);
  if (days <= 14) return Math.round(max * 0.55);
  if (days <= 30) return Math.round(max * 0.3);
  if (days <= 45) return Math.round(max * 0.12);
  return 0;
}

export function matchBlob(hay: string | undefined, needle: string) {
  const n = String(needle || '')
    .trim()
    .toLowerCase();
  if (n.length < 3) return false;
  return String(hay || '')
    .toLowerCase()
    .includes(n.slice(0, Math.min(n.length, 28)));
}

export function relatedInterviews(overview: RecruitmentOverview | null, needle: string) {
  return (overview?.interviewsTable || []).filter(
    (i) => matchBlob(i.candidate, needle) || matchBlob(i.job, needle),
  );
}

export function relatedPlacements(overview: RecruitmentOverview | null, needle: string) {
  return (overview?.placementsTable || []).filter(
    (p) => matchBlob(p.candidate, needle) || matchBlob(p.job, needle),
  );
}

export function relatedUpcoming(overview: RecruitmentOverview | null, needle: string) {
  return (overview?.schedule || []).filter((s) => matchBlob(s.title, needle) || matchBlob(s.assignee, needle));
}

export function relatedActivity(overview: RecruitmentOverview | null, needle: string) {
  return (overview?.activityTimeline || []).filter(
    (a) => matchBlob(a.label, needle) || matchBlob(a.detail, needle) || matchBlob(a.entityType, needle),
  );
}

export function jobHealth(
  row: JobRow,
  opts: { upcoming: number; relatedIv: number; relatedPl: number },
): { score: number; label: string; drivers: RecHealthDriver[] } {
  const openings = Math.max(1, Number(row.openings || 1));
  const applicants = Number(row.applicants || 0);
  const interviews = Number(row.interviews || 0);
  const placements = Number(row.placements || 0);
  const owned = Boolean(row.assignee && !/unassigned/i.test(String(row.assignee)));

  const coverage = Math.min(30, Math.round((applicants / openings) * 12));
  const momentum = Math.min(25, interviews * 4 + opts.upcoming * 6 + Math.min(8, opts.relatedIv * 2));
  const outcome = Math.min(25, Math.round((placements / openings) * 25) + (opts.relatedPl > 0 ? 4 : 0));
  const freshness = recencyPts(row.updatedAt || row.postedDate, 20);

  let penalty = 0;
  if (row.noCandidates || applicants === 0) penalty += 22;
  if (row.slaRisk) penalty += 18;
  if (!owned) penalty += 12;

  const boost = row.hot ? 6 : 0;
  const score = Math.max(0, Math.min(100, coverage + momentum + outcome + freshness + boost - penalty));
  const label = score >= 70 ? 'Healthy' : score >= 40 ? 'Watch' : 'At risk';

  return {
    score,
    label,
    drivers: [
      {
        label: 'Coverage',
        value: `${formatNum(applicants)} / ${formatNum(openings)}`,
        hint: applicants === 0 ? 'No candidates yet' : `${(applicants / openings).toFixed(1)}× openings`,
        score: coverage,
        max: 30,
      },
      {
        label: 'Momentum',
        value: `${formatNum(interviews)} interviews`,
        hint: opts.upcoming ? `${formatNum(opts.upcoming)} upcoming` : owned ? String(row.assignee) : 'Unassigned',
        score: momentum,
        max: 25,
      },
      {
        label: 'Fill',
        value: `${formatNum(placements)} placed`,
        hint: row.slaRisk ? 'SLA risk' : row.hot ? 'Hot req' : `${Math.round((placements / openings) * 100)}% of openings`,
        score: outcome,
        max: 25,
      },
      {
        label: 'Freshness',
        value: row.updatedAt || row.postedDate ? relativeTime(row.updatedAt || row.postedDate) : 'No date',
        hint: owned ? undefined : 'Needs an owner',
        score: freshness,
        max: 20,
      },
    ],
  };
}

export function candidateHealth(
  row: CandRow,
  opts: { interviews: number; placements: number; upcoming: number },
): { score: number; label: string; drivers: RecHealthDriver[] } {
  const owned = Boolean(row.assignee && !/unassigned/i.test(String(row.assignee)));
  const status = String(row.status || '').toLowerCase();
  const parked = /inactiv|reject|withdraw|hold|archive/.test(status);
  const placed = /plac|join|hired|offer/.test(status) || opts.placements > 0;

  const freshness = recencyPts(row.updatedAt, 35);
  const ownership = owned ? 20 : 0;
  const momentum = Math.min(25, opts.interviews * 8 + opts.upcoming * 6);
  const outcome = placed ? 20 : parked ? 0 : /active|interview|screen/.test(status) ? 10 : 4;

  let penalty = 0;
  if (!owned) penalty += 10;
  if (parked) penalty += 18;
  if (!row.source) penalty += 4;

  const score = Math.max(0, Math.min(100, freshness + ownership + momentum + outcome - penalty));
  const label = score >= 70 ? 'Healthy' : score >= 40 ? 'Watch' : 'At risk';

  return {
    score,
    label,
    drivers: [
      {
        label: 'Freshness',
        value: row.updatedAt ? relativeTime(row.updatedAt) : 'No activity',
        hint: parked ? 'Parked / inactive' : undefined,
        score: freshness,
        max: 35,
      },
      {
        label: 'Owner',
        value: owned ? String(row.assignee) : 'Unassigned',
        hint: row.source ? `Source · ${row.source}` : 'No source',
        score: ownership,
        max: 20,
      },
      {
        label: 'Interviews',
        value: formatNum(opts.interviews),
        hint: opts.upcoming ? `${formatNum(opts.upcoming)} upcoming` : row.status || undefined,
        score: momentum,
        max: 25,
      },
      {
        label: 'Outcome',
        value: placed ? `${formatNum(opts.placements)} placement${opts.placements === 1 ? '' : 's'}` : row.status || 'Open',
        hint: placed ? 'In offer / join track' : undefined,
        score: outcome,
        max: 20,
      },
    ],
  };
}

export function RecHealthBlock({ score, label, drivers }: { score: number; label: string; drivers: RecHealthDriver[] }) {
  const pct = Math.min(100, Math.max(0, score));
  const tone = pct >= 70 ? '#16A34A' : pct >= 40 ? '#D97706' : '#E11D48';
  const r = 48;
  const trackLen = Math.PI * r;
  const fillLen = (pct / 100) * trackLen;
  const tiles: Record<string, string> = {
    Coverage: 'bg-slate-100 text-slate-800',
    Momentum: 'bg-orange-50 text-orange-900',
    Fill: 'bg-emerald-50 text-emerald-900',
    Freshness: 'bg-sky-50 text-sky-900',
    Owner: 'bg-indigo-50 text-indigo-900',
    Interviews: 'bg-orange-50 text-orange-900',
    Outcome: 'bg-emerald-50 text-emerald-900',
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative mx-auto h-[96px] w-[140px] shrink-0 sm:mx-0">
        <svg viewBox="0 0 160 96" className="h-full w-full" aria-hidden>
          <path d="M 32 84 A 48 48 0 0 1 128 84" fill="none" stroke="#E2E8F0" strokeWidth="12" strokeLinecap="round" />
          {pct > 0 ? (
            <path
              d="M 32 84 A 48 48 0 0 1 128 84"
              fill="none"
              stroke={tone}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${fillLen} ${trackLen}`}
            />
          ) : null}
        </svg>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 text-center">
          <CrmStatNumber value={pct} label={label.toLowerCase()} size="md" align="center" />
        </div>
      </div>
      <ul className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {drivers.map((d) => (
          <li key={d.label} className={`rounded-lg px-3 py-2.5 ${tiles[d.label] || 'bg-slate-50 text-slate-800'}`}>
            <p className="text-[11px] font-medium opacity-70">{d.label}</p>
            <p className="mt-0.5 text-[14px] font-semibold leading-snug">{d.value}</p>
            {d.hint ? <p className="mt-0.5 text-[11px] opacity-70">{d.hint}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
