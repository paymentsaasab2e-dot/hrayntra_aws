'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Filter, Search, X } from 'lucide-react';
import type { RecruitmentOverview } from '@/lib/dashboard/api';
import { HqInfoTip } from '@/components/hq/analytics/HqPhase2DashboardParts';
import { CrmStatNumber, sparkDelta, sparkValues } from '@/components/dashboard/crm/crmStatNumber';
import { recCard, formatNum, relativeTime } from './recShared';
import {
  REC_CARD,
  REC_CARD_COMPACT,
  REC_CHARCOAL,
  REC_ORANGE,
  REC_SLICE,
  RecChartHead,
  RecDonut,
  RecFunnel,
  RecMultiLine,
  RecSemiGauge,
  RecSparkArea,
  RecVBars,
  recInitials,
  recKpi,
} from './recViz';
import {
  RecHealthBlock,
  candidateHealth,
  daysSince,
  jobHealth,
  relatedActivity,
  relatedInterviews,
  relatedPlacements,
  relatedUpcoming,
} from './recRecordHealth';
import { useDashboardAccess } from '@/lib/dashboard/useDashboardAccess';

type Section = 'jobs' | 'candidates';
type Quick = 'all' | 'hot' | 'empty' | 'sla' | 'unassigned' | 'new' | 'active';

type JobRow = NonNullable<RecruitmentOverview['jobsTable']>[number];
type CandRow = NonNullable<RecruitmentOverview['candidatesTable']>[number];

const STATUS_COLORS = REC_SLICE;

function PipelineToggle({
  value,
  onChange,
  allowed = ['jobs', 'candidates'],
}: {
  value: Section;
  onChange: (v: Section) => void;
  allowed?: Section[];
}) {
  const sections = (['jobs', 'candidates'] as const).filter((s) => allowed.includes(s));
  if (sections.length <= 1) {
    const only = sections[0] || value;
    return <p className="text-[13px] font-semibold text-slate-800">{only === 'candidates' ? 'Candidates' : 'Jobs'}</p>;
  }
  return (
    <div role="tablist" aria-label="Pipeline section" className="relative grid h-10 w-[220px] shrink-0 grid-cols-2 rounded-full bg-slate-100 p-1 ring-1 ring-slate-200/90">
      <span
        aria-hidden
        className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full bg-slate-900 shadow-sm transition-all duration-200 ease-out ${
          value === 'jobs' ? 'left-1' : 'left-[calc(50%)]'
        }`}
      />
      <button type="button" role="tab" aria-selected={value === 'jobs'} onClick={() => onChange('jobs')} className={`relative z-10 rounded-full text-[13px] font-semibold ${value === 'jobs' ? 'text-white' : 'text-slate-500 hover:text-slate-700'}`}>
        Jobs
      </button>
      <button type="button" role="tab" aria-selected={value === 'candidates'} onClick={() => onChange('candidates')} className={`relative z-10 rounded-full text-[13px] font-semibold ${value === 'candidates' ? 'text-white' : 'text-slate-500 hover:text-slate-700'}`}>
        Candidates
      </button>
    </div>
  );
}

function recSourceBucket(raw?: string | null) {
  const t = String(raw || '').trim().toLowerCase();
  if (!t || t === 'unknown' || t === 'null') return 'Manual upload';
  if (/hryantra|hrayntra|hrynat|internal|ats|system/.test(t)) return 'Hryantra';
  if (/naukri|linkedin|indeed|monster|shine|portal|job.?board|foundit|iimjobs/.test(t)) return 'Job portal';
  if (/refer/.test(t)) return 'Referral';
  if (/upload|import|csv|excel|manual/.test(t)) return 'Manual upload';
  return 'Other';
}

function statusTone(status?: string) {
  const s = String(status || '').toLowerCase();
  if (/fill|join|placed|active|hired/.test(s)) return 'bg-emerald-50 text-emerald-800';
  if (/open|new|schedul/.test(s)) return 'bg-slate-100 text-slate-700';
  if (/hold|risk|pending|feedback/.test(s)) return 'bg-orange-50 text-orange-800';
  if (/close|inactiv|cancel|reject/.test(s)) return 'bg-rose-50 text-rose-700';
  return 'bg-blue-50 text-blue-800';
}

export function RecPipelineSection({ overview }: { overview: RecruitmentOverview | null; loading?: boolean }) {
  const { modules } = useDashboardAccess();
  const [section, setSection] = useState<Section>('jobs');
  const [q, setQ] = useState('');
  const [quick, setQuick] = useState<Quick>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (modules.jobs && !modules.candidates && section !== 'jobs') setSection('jobs');
    else if (modules.candidates && !modules.jobs && section !== 'candidates') setSection('candidates');
  }, [modules.jobs, modules.candidates, section]);

  const jobs = overview?.jobsTable || [];
  const cands = overview?.candidatesTable || [];

  const source = section === 'jobs' ? jobs : cands;

  const filtered = useMemo(() => {
    let rows = section === 'jobs' ? [...jobs] : [...cands];
    if (section === 'jobs') {
      if (quick === 'hot') rows = rows.filter((r) => Boolean((r as JobRow).hot));
      else if (quick === 'empty') rows = rows.filter((r) => Boolean((r as JobRow).noCandidates));
      else if (quick === 'sla') rows = rows.filter((r) => Boolean((r as JobRow).slaRisk));
      else if (quick === 'unassigned') rows = rows.filter((r) => !r.assignee || /unassigned/i.test(String(r.assignee)));
    } else {
      if (quick === 'new') rows = rows.filter((r) => /new/i.test(String((r as CandRow).status || '')));
      else if (quick === 'active') rows = rows.filter((r) => /active/i.test(String((r as CandRow).status || '')));
      else if (quick === 'unassigned') rows = rows.filter((r) => !r.assignee || /unassigned/i.test(String(r.assignee)));
    }
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      Object.values(r)
        .filter((v) => v != null && typeof v !== 'object')
        .some((v) => String(v).toLowerCase().includes(needle)),
    );
  }, [jobs, cands, section, quick, q]);

  useEffect(() => {
    setQ('');
    setQuick('all');
    setSelectedId(null);
    setFiltersOpen(false);
  }, [section]);

  useEffect(() => {
    if (!q.trim()) {
      if (selectedId && !filtered.some((r) => String(r.id) === selectedId)) setSelectedId(null);
      return;
    }
    if (!filtered.length) {
      setSelectedId(null);
      return;
    }
    if (filtered.length === 1) {
      setSelectedId(String(filtered[0].id));
      return;
    }
    if (selectedId && !filtered.some((r) => String(r.id) === selectedId)) setSelectedId(null);
  }, [filtered, selectedId, q]);

  const selected = filtered.find((r) => String(r.id) === selectedId) || null;
  const scoped = Boolean(selected);
  const href = section === 'jobs' ? '/job' : '/candidate';
  const chips =
    section === 'jobs'
      ? ([
          { id: 'all', label: 'All' },
          { id: 'hot', label: 'Hot' },
          { id: 'empty', label: 'No candidates' },
          { id: 'sla', label: 'SLA risk' },
          { id: 'unassigned', label: 'Unassigned' },
        ] as const)
      : ([
          { id: 'all', label: 'All' },
          { id: 'new', label: 'New' },
          { id: 'active', label: 'Active' },
          { id: 'unassigned', label: 'Unassigned' },
        ] as const);

  const jobStatus = overview?.jobStatusPie || [];
  const candStatus = overview?.candidateStatusPie || [];
  const sources = overview?.candidateSources || [];
  const clients = overview?.jobsByClient || [];
  const pipeline = overview?.pipeline || [];
  const interviewStatus = overview?.interviewStatusPie || [];
  const placementStatus = overview?.placementStatusPie || [];
  const spark = overview?.jobSpark || [];
  const sourceSpark = overview?.sourceSpark || [];
  const placementFallback = [
    { name: 'Offer sent', value: recKpi(overview, 'offersSent'), color: REC_ORANGE },
    { name: 'Accepted', value: recKpi(overview, 'offersAccepted'), color: '#1E3A8A' },
    { name: 'Joined', value: recKpi(overview, 'joinedPlacements'), color: '#0F766E' },
    { name: 'Pending', value: recKpi(overview, 'pendingPlacements'), color: '#64748B' },
  ];
  const placementSlices = (placementStatus.length ? placementStatus : placementFallback).map((d, i) => ({
    name: d.name,
    value: d.value,
    color: ('color' in d && d.color) || STATUS_COLORS[i % STATUS_COLORS.length],
  }));
  const placementTotal = placementSlices.reduce((s, d) => s + d.value, 0) || recKpi(overview, 'totalPlacements');
  const clientDemand = clients.length
    ? clients
    : Object.entries(
        jobs.reduce<Record<string, number>>((acc, j) => {
          const name = String(j.client || '').trim() || 'No client';
          acc[name] = (acc[name] || 0) + 1;
          return acc;
        }, {}),
      )
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
  const topReqs = [...jobs]
    .sort((a, b) => Number(b.applicants || 0) + Number(b.interviews || 0) - (Number(a.applicants || 0) + Number(a.interviews || 0)))
    .slice(0, 8);
  const sourceSeries = [
    { key: 'Job portal', color: REC_ORANGE },
    { key: 'Hryantra', color: REC_CHARCOAL },
    { key: 'Referral', color: '#1E3A8A' },
    { key: 'Manual upload', color: '#0F766E' },
    { key: 'Other', color: '#64748B' },
  ];
  const originMix = sourceSeries
    .map((s) => ({
      name: s.key,
      value: cands.filter((c) => recSourceBucket(c.source) === s.key).length,
      color: s.color,
    }))
    .filter((d) => d.value > 0);
  const originSpark = (() => {
    const days = 14;
    const keys = sourceSeries.map((s) => s.key);
    const byDay = new Map<string, Record<string, number>>();
    for (const c of cands) {
      const iso = c.createdAt || c.updatedAt;
      if (!iso) continue;
      const d = new Date(iso);
      if (!Number.isFinite(d.getTime())) continue;
      const key = d.toISOString().slice(0, 10);
      const rec = byDay.get(key) || Object.fromEntries(keys.map((k) => [k, 0]));
      const bucket = recSourceBucket(c.source);
      rec[bucket] = Number(rec[bucket] || 0) + 1;
      byDay.set(key, rec);
    }
    const api = sourceSpark.filter((row) =>
      keys.some((k) => Number(row[k] || 0) > 0),
    );
    if (api.length > 1) return sourceSpark;
    const out: Array<Record<string, string | number>> = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      out.push({ label: key.slice(5), ...(byDay.get(key) || Object.fromEntries(keys.map((k) => [k, 0]))) });
    }
    return out;
  })();
  const originSparkHasData = originSpark.some((row) =>
    sourceSeries.some((s) => Number(row[s.key] || 0) > 0),
  );
  const originLines = sourceSeries.filter((s) => originSpark.some((row) => Number(row[s.key] || 0) > 0));

  const jobsWithTalent = jobs.filter((j) => !j.noCandidates && Number(j.applicants || 0) > 0).length;
  const jobsEmpty = jobs.filter((j) => j.noCandidates || Number(j.applicants || 0) === 0).length;
  const jobsHot = jobs.filter((j) => j.hot).length;
  const jobsSla = jobs.filter((j) => j.slaRisk).length;
  const jobsUnassigned = jobs.filter((j) => !j.assignee || /unassigned/i.test(String(j.assignee))).length;
  const jobIvTotal = jobs.reduce((s, j) => s + Number(j.interviews || 0), 0);
  const jobAppTotal = jobs.reduce((s, j) => s + Number(j.applicants || 0), 0);
  const jobOpenCount = jobs.filter((j) => /open|active|hot/i.test(String(j.status || '')) || !j.status).length || jobs.length;
  const ivPerJob = jobOpenCount > 0 ? jobIvTotal / jobOpenCount : 0;
  const ivFromApps = jobAppTotal > 0 ? (jobIvTotal / jobAppTotal) * 100 : 0;

  const candsOwned = cands.filter((c) => c.assignee && !/unassigned/i.test(String(c.assignee))).length;
  const candsOpen = cands.length - candsOwned;
  const interviewedNames = new Set(
    (overview?.interviewsTable || []).map((i) => String(i.candidate || '').trim().toLowerCase()).filter(Boolean),
  );
  const candsInterviewed = cands.filter((c) => interviewedNames.has(String(c.name || '').trim().toLowerCase())).length;
  const candActive = cands.filter((c) => /active|new|interview|screen/i.test(String(c.status || ''))).length;
  const candParked = cands.filter((c) => /inactiv|reject|withdraw|hold|archive/i.test(String(c.status || ''))).length;
  const candActiveCount = Math.max(
    Number(pipeline.find((s) => s.stage === 'Active')?.count || 0),
    recKpi(overview, 'activeCandidates'),
    cands.filter((c) => /active/i.test(String(c.status || ''))).length,
  );
  const candAppliedCount = Math.max(
    Number(pipeline.find((s) => s.stage === 'Applied')?.count || 0),
    recKpi(overview, 'newCandidates'),
    cands.filter((c) => /new|applied/i.test(String(c.status || ''))).length,
  );
  const candInterviewCount = Math.max(
    Number(pipeline.find((s) => s.stage === 'Interview')?.count || 0),
    recKpi(overview, 'interviewsToday') + recKpi(overview, 'interviewsUpcoming'),
    (overview?.interviewsTable || []).length,
    candsInterviewed,
  );
  const candOfferCount = Math.max(
    Number(pipeline.find((s) => s.stage === 'Offer')?.count || 0),
    recKpi(overview, 'offersSent'),
    recKpi(overview, 'pendingPlacements'),
    (overview?.placementsTable || []).filter((p) => /offer|pending/i.test(String(p.status || ''))).length,
  );
  const candJoinedCount = Math.max(
    Number(pipeline.find((s) => s.stage === 'Joined')?.count || 0),
    recKpi(overview, 'joinedPlacements'),
    recKpi(overview, 'placedCandidates'),
    (overview?.placementsTable || []).filter((p) => /join|placed|hired/i.test(String(p.status || ''))).length,
  );

  const jobFunnelStages = [
    { name: 'Applied', value: candAppliedCount, color: '#0F172A' },
    { name: 'Interview', value: candInterviewCount, color: '#334155' },
    { name: 'Offer', value: candOfferCount, color: '#EA580C' },
    { name: 'Joined', value: candJoinedCount, color: '#0F766E' },
  ];
  const candidateFunnelStages = [
    { name: 'Active', value: candActiveCount, color: '#1E3A8A' },
    { name: 'Applied', value: candAppliedCount, color: '#0F172A' },
    { name: 'Interview', value: candInterviewCount, color: '#334155' },
    { name: 'Offer', value: candOfferCount, color: '#EA580C' },
    { name: 'Joined', value: candJoinedCount, color: '#0F766E' },
  ];
  const channelVsIv = ['Job portal', 'Hryantra', 'Referral', 'Manual upload', 'Other']
    .map((name) => {
      const rows = cands.filter((c) => recSourceBucket(c.source) === name);
      const interviewed = rows.filter((c) => interviewedNames.has(String(c.name || '').trim().toLowerCase())).length;
      return { name, Interviewed: interviewed, Screening: Math.max(0, rows.length - interviewed) };
    })
    .filter((r) => r.Interviewed + r.Screening > 0);

  return (
    <div className="space-y-4">
      <section className={`${recCard} rounded-xl px-4 py-4 sm:px-5`}>
        <div className="flex items-center justify-between gap-3">
          <PipelineToggle
            value={section}
            onChange={setSection}
            allowed={[
              ...(modules.jobs ? (['jobs'] as const) : []),
              ...(modules.candidates ? (['candidates'] as const) : []),
            ]}
          />
          <div className="flex items-center gap-2">
            <span className="text-[12px] tabular-nums text-slate-400">
              {filtered.length}/{source.length}
            </span>
            <Link href={href} className="text-[12px] font-medium text-blue-600 hover:text-blue-700">
              Full list →
            </Link>
            <HqInfoTip text="Slide Jobs or Candidates, then search a record. Health, conversion and related interviews appear when one match is selected." />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={section === 'jobs' ? 'Search any job — title, owner, client, dept…' : 'Search any candidate — name, owner, source, email…'}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium ${
              filtersOpen || quick !== 'all' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            <Filter size={14} />
            Filter
          </button>
          {q || quick !== 'all' || selectedId ? (
            <button
              type="button"
              onClick={() => {
                setQ('');
                setQuick('all');
                setSelectedId(null);
                setFiltersOpen(false);
              }}
              className="inline-flex h-10 shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600"
            >
              <X size={12} />
              Reset
            </button>
          ) : null}
        </div>

        {filtersOpen || quick !== 'all' ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setQuick(c.id)}
                className={`rounded-full px-2.5 py-1 text-[12px] font-medium transition ${
                  quick === c.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        ) : null}

        {q.trim() && filtered.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2.5">
            <span className="self-center text-[10px] font-bold uppercase tracking-wider text-slate-400">Matches</span>
            {filtered.slice(0, 12).map((r) => {
              const id = String(r.id);
              const active = id === selectedId;
              const label = section === 'jobs' ? String((r as JobRow).title || '—') : String((r as CandRow).name || '—');
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedId(active ? null : id)}
                  className={`inline-flex max-w-[200px] items-center gap-1.5 truncate rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                    active ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-slate-400'
                  }`}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/20 text-[8px] font-bold">
                    {recInitials(label)}
                  </span>
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </section>

      {scoped && selected && section === 'jobs' ? (
        <ScopedJob overview={overview} row={selected as JobRow} onClear={() => { setSelectedId(null); setQ(''); }} />
      ) : null}
      {scoped && selected && section === 'candidates' ? (
        <ScopedCandidate overview={overview} row={selected as CandRow} onClear={() => { setSelectedId(null); setQ(''); }} />
      ) : null}
      {q.trim() && !filtered.length ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-6 text-center text-sm text-slate-400">
          No {section} match that search
        </p>
      ) : null}

      {!scoped ? (
        <div className="grid items-start gap-3 xl:grid-cols-12">
          {section === 'jobs' ? (
            <>
              <div className="xl:col-span-6">
                <RecSemiGauge
                  display={`${jobs.length ? Math.round((jobsWithTalent / jobs.length) * 100) : 0}%`}
                  pct={jobs.length ? (jobsWithTalent / jobs.length) * 100 : 0}
                  label="Talent coverage"
                  sub={`${formatNum(jobsWithTalent)} with talent · ${formatNum(jobsEmpty)} empty`}
                  tone="lime"
                  info="Listed jobs with at least one applicant vs empty pipelines."
                />
              </div>
              <section className={`${REC_CARD_COMPACT} xl:col-span-6`}>
                <RecChartHead
                  title="Applicant → interview"
                  sub={`${Math.round(ivFromApps)}% converted · ${ivPerJob.toFixed(1)} interviews per job`}
                  info="Applicants, interviews and placements on listed jobs — real counts, not a target."
                />
                <RecVBars
                  height={148}
                  data={[
                    { name: 'Applicants', value: jobAppTotal, color: REC_CHARCOAL },
                    { name: 'Interviews', value: jobIvTotal, color: REC_ORANGE },
                    { name: 'Placements', value: jobs.reduce((s, j) => s + Number(j.placements || 0), 0), color: '#0F766E' },
                  ]}
                />
              </section>
              <section className={`${REC_CARD_COMPACT} xl:col-span-6`}>
                <RecChartHead title="Job status" sub="Open vs closed mix" info="How many reqs are open, on hold, filled or closed." />
                <RecDonut
                  data={jobStatus.map((d, i) => ({ name: d.name, value: d.value, color: STATUS_COLORS[i % STATUS_COLORS.length] }))}
                  center={{ value: formatNum(jobStatus.reduce((s, d) => s + d.value, 0)), label: 'jobs' }}
                />
              </section>
              <section className={`${REC_CARD_COMPACT} xl:col-span-6`}>
                <RecChartHead
                  title="Placement status"
                  sub="Offer → join mix"
                  info="Offers sent, accepted, joined and still pending. Empty pie means no placements yet — counts still show from hiring KPIs."
                />
                {placementTotal > 0 ? (
                  <RecDonut data={placementSlices} center={{ value: formatNum(placementTotal), label: 'placements' }} />
                ) : (
                  <div className="space-y-2 py-1">
                    <p className="text-center text-[13px] text-slate-400">No placements yet — stages stay at zero until an offer is logged.</p>
                    <RecVBars height={132} data={placementFallback} />
                  </div>
                )}
              </section>
              <section className={`${REC_CARD_COMPACT} xl:col-span-7`}>
                <RecChartHead
                  title="Demand by client"
                  sub="Open reqs · agencies staff for each client"
                  info="How many jobs sit with each client. Built for staffing agencies on this platform."
                />
                {clientDemand.length ? (
                  <RecVBars
                    height={188}
                    data={clientDemand.slice(0, 8).map((d) => ({
                      name: d.name.length > 14 ? `${d.name.slice(0, 13)}…` : d.name,
                      value: d.value,
                    }))}
                  />
                ) : (
                  <p className="py-10 text-center text-[13px] text-slate-400">No client split yet</p>
                )}
              </section>
              <section className={`${REC_CARD_COMPACT} xl:col-span-5`}>
                <RecChartHead title="New jobs over time" sub="Reqs opened in the selected period" info="Daily count of jobs created. Stock arrow is first day vs last day of this spark." />
                {spark.length > 1 ? (
                  <>
                    <div className="mb-1 flex justify-end">
                      <CrmStatNumber
                        value={formatNum(spark[spark.length - 1]?.value)}
                        label="last day"
                        size="sm"
                        deltaPct={sparkDelta(spark.map((d) => ({ label: d.label, value: d.value })))}
                        spark={sparkValues(spark.map((d) => ({ label: d.label, value: d.value })))}
                      />
                    </div>
                    <RecSparkArea data={spark} height={148} />
                  </>
                ) : (
                  <p className="py-10 text-center text-[13px] text-slate-400">Not enough inflow history yet</p>
                )}
              </section>
              <section className={`${REC_CARD_COMPACT} xl:col-span-5`}>
                <RecChartHead title="Job risk mix" sub="Hot · SLA · unassigned" info="Flags on listed jobs: hot reqs, SLA risk, and jobs with no recruiter." />
                <RecDonut
                  data={[
                    { name: 'Hot', value: jobsHot, color: REC_ORANGE },
                    { name: 'SLA', value: jobsSla, color: '#E11D48' },
                    { name: 'Unassigned', value: jobsUnassigned, color: '#64748B' },
                    { name: 'Clear', value: Math.max(0, jobs.length - jobsHot - jobsSla - jobsUnassigned), color: REC_CHARCOAL },
                  ]}
                  center={{ value: formatNum(jobs.length), label: 'listed' }}
                />
              </section>
              <section className={`${REC_CARD_COMPACT} xl:col-span-7`}>
                <RecChartHead title="Hiring funnel" sub="Applied → joined" info="Job hiring path: Applied → Interview → Offer → Joined. Active is a candidate status, so it is not on this jobs funnel." />
                <RecFunnel stages={jobFunnelStages} />
              </section>
              <section className={`${REC_CARD_COMPACT} xl:col-span-12`}>
                <RecChartHead
                  title="Busiest jobs"
                  sub={`Up to 8 reqs · ${formatNum(jobs.length)} in this snapshot`}
                  info="Grouped bars per job: applicants, interviews, placements. With many jobs, the busiest 8 by applicants + interviews are shown."
                />
                {topReqs.length ? (
                  <RecVBars
                    height={topReqs.length > 4 ? 220 : 188}
                    grouped={[
                      { key: 'Applicants', color: REC_CHARCOAL },
                      { key: 'Interviews', color: REC_ORANGE },
                      { key: 'Placements', color: '#0F766E' },
                    ]}
                    data={topReqs.map((j) => ({
                      name: String(j.title || '—').slice(0, 16),
                      Applicants: j.applicants || 0,
                      Interviews: j.interviews || 0,
                      Placements: j.placements || 0,
                    }))}
                  />
                ) : (
                  <p className="py-10 text-center text-[13px] text-slate-400">No jobs in this snapshot</p>
                )}
              </section>
            </>
          ) : (
            <>
              <div className="xl:col-span-6">
                <RecSemiGauge
                  display={`${cands.length ? Math.round((candsOwned / cands.length) * 100) : 0}%`}
                  pct={cands.length ? (candsOwned / cands.length) * 100 : 0}
                  label="Assigned to a recruiter"
                  sub={`${formatNum(candsOwned)} with a recruiter · ${formatNum(candsOpen)} waiting`}
                  tone="indigo"
                  info="How many candidates already have a recruiter vs still unassigned."
                />
              </div>
              <div className="xl:col-span-6">
                <RecSemiGauge
                  display={`${cands.length ? Math.round((candsInterviewed / cands.length) * 100) : 0}%`}
                  pct={cands.length ? (candsInterviewed / cands.length) * 100 : 0}
                  label="Reached interview"
                  sub={`${formatNum(candsInterviewed)} of ${formatNum(cands.length)} have an interview`}
                  tone="amber"
                  info="Share of listed candidates who already have an interview on file."
                />
              </div>
              <section className={`${REC_CARD_COMPACT} xl:col-span-6`}>
                <RecChartHead title="Candidate status" sub="New · active · placed · on hold" info="Where talent sits today: new, in process, placed, or inactive." />
                <RecDonut
                  data={candStatus.map((d, i) => ({ name: d.name, value: d.value, color: STATUS_COLORS[i % STATUS_COLORS.length] }))}
                  center={{ value: formatNum(candStatus.reduce((s, d) => s + d.value, 0)), label: 'candidates' }}
                />
              </section>
              <section className={`${REC_CARD_COMPACT} xl:col-span-6`}>
                <RecChartHead title="Interview status" sub="Scheduled vs done" info="Interview records: scheduled, completed, cancelled or waiting on feedback." />
                <RecDonut
                  data={interviewStatus.map((d, i) => ({ name: d.name, value: d.value, color: STATUS_COLORS[i % STATUS_COLORS.length] }))}
                  center={{ value: formatNum(interviewStatus.reduce((s, d) => s + d.value, 0)), label: 'interviews' }}
                />
              </section>
              <section className={`${REC_CARD_COMPACT} xl:col-span-7`}>
                <RecChartHead
                  title="Where candidates come from"
                  sub="Same listed talent as Interviewed by channel"
                  info="Channel mix for the candidates on this dashboard. Trend appears when those records have dates; otherwise the bars still match the channel chart."
                />
                {originMix.length ? (
                  <>
                    <RecVBars height={originSparkHasData ? 132 : 168} data={originMix} />
                    {originSparkHasData && originLines.length ? (
                      <div className="mt-3">
                        <p className="mb-1 text-[11px] font-medium text-slate-400">Inflow over the last days</p>
                        <RecMultiLine data={originSpark} series={originLines} height={140} />
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="py-10 text-center text-[13px] text-slate-400">No source on listed candidates yet</p>
                )}
              </section>
              <section className={`${REC_CARD_COMPACT} xl:col-span-5`}>
                <RecChartHead
                  title="Live vs on hold"
                  sub="Moving now vs paused / rejected"
                  info="Live = new or active talent. On hold = inactive, rejected, withdrawn or archived. Other is any remaining status."
                />
                <RecDonut
                  data={[
                    { name: 'Live', value: candActive, color: REC_CHARCOAL },
                    { name: 'On hold', value: candParked, color: REC_ORANGE },
                    { name: 'Other', value: Math.max(0, cands.length - candActive - candParked), color: '#94A3B8' },
                  ]}
                  center={{ value: formatNum(cands.length), label: 'listed' }}
                />
              </section>
              <section className={`${REC_CARD_COMPACT} xl:col-span-12`}>
                <RecChartHead
                  title="Interviewed by channel"
                  sub="Same candidates as Where they come from"
                  info="For each origin bar above: how many already have an interview vs still screening. Totals match the origin mix."
                />
                {channelVsIv.length ? (
                  <RecVBars
                    height={200}
                    grouped={[
                      { key: 'Interviewed', color: '#0F766E' },
                      { key: 'Screening', color: REC_ORANGE },
                    ]}
                    data={channelVsIv}
                  />
                ) : (
                  <p className="py-8 text-center text-[13px] text-slate-400">No channel vs interview split yet</p>
                )}
              </section>
              <section className={`${REC_CARD_COMPACT} xl:col-span-12`}>
                <RecChartHead title="Hiring funnel" sub="Active → applied → joined" info="Candidate path starts at Active, then Applied → Interview → Offer → Joined. Green/red is how that stage moved vs the one above." />
                <RecFunnel stages={candidateFunnelStages} />
              </section>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ScopedJob({
  overview,
  row,
  onClear,
}: {
  overview: RecruitmentOverview | null;
  row: JobRow;
  onClear: () => void;
}) {
  const openings = Math.max(1, Number(row.openings || 1));
  const applicants = Number(row.applicants || 0);
  const interviews = Number(row.interviews || 0);
  const placements = Number(row.placements || 0);
  const ivs = relatedInterviews(overview, row.title);
  const pls = relatedPlacements(overview, row.title);
  const upcoming = relatedUpcoming(overview, row.title);
  const activity = relatedActivity(overview, row.title);
  const health = jobHealth(row, { upcoming: upcoming.length, relatedIv: ivs.length, relatedPl: pls.length });
  const age = daysSince(row.postedDate || row.updatedAt);
  const depth = applicants / openings;
  const ivRate = applicants > 0 ? Math.round((interviews / applicants) * 100) : 0;
  const fillPct = Math.round((placements / openings) * 100);
  const lastAct = activity[0];

  return (
    <section className={`${REC_CARD} overflow-hidden`}>
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#334155] text-[12px] font-semibold text-white">
            {recInitials(row.title)}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-400">Job</p>
            <p className="truncate text-[16px] font-bold text-slate-900">{row.title}</p>
            <p className="text-[12px] text-slate-400">
              {row.client || 'No client'}
              {row.assignee ? ` · ${row.assignee}` : ' · Unassigned'}
              {row.updatedAt ? ` · ${relativeTime(row.updatedAt)}` : ''}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone(row.status)}`}>{row.status || '—'}</span>
          <Link href={row.href || `/job?id=${row.id}`} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white hover:bg-slate-800" title="Open job">
            <ArrowUpRight size={16} />
          </Link>
          <button type="button" onClick={onClear} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50" title="Clear">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-[12px] font-medium text-slate-500">Req health</h3>
            <HqInfoTip text="Composite from coverage, interviews, placements, recency, owner, SLA and empty-pipeline flags — all real fields on this job." />
          </div>
          <RecHealthBlock score={health.score} label={health.label} drivers={health.drivers} />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <CrmStatNumber value={`${depth.toFixed(1)}×`} label="talent / opening" size="sm" />
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <CrmStatNumber value={`${ivRate}%`} label="applicant → iv" size="sm" />
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <CrmStatNumber value={`${fillPct}%`} label="openings filled" size="sm" />
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <CrmStatNumber value={age == null ? '—' : formatNum(age)} label="days open" size="sm" invertDelta />
          </div>
        </div>

        <RecVBars
          height={140}
          data={[
            { name: 'Applicants', value: applicants, color: REC_CHARCOAL },
            { name: 'Interviews', value: interviews, color: REC_ORANGE },
            { name: 'Placements', value: placements, color: '#0F766E' },
            { name: 'Openings', value: Number(row.openings || 0), color: '#1E3A8A' },
          ]}
        />

        <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
          {row.hot ? <span className="rounded-md bg-orange-50 px-2 py-0.5 text-orange-700">Hot</span> : null}
          {row.noCandidates ? <span className="rounded-md bg-rose-50 px-2 py-0.5 text-rose-700">No candidates</span> : null}
          {row.slaRisk ? <span className="rounded-md bg-amber-50 px-2 py-0.5 text-amber-800">SLA risk</span> : null}
          {row.priority ? <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-indigo-700">{row.priority}</span> : null}
          {row.department ? <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">{row.department}</span> : null}
          {row.location ? <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">{row.location}</span> : null}
        </div>

        {(upcoming.length || ivs.length || pls.length || lastAct) ? (
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <h3 className="mb-1.5 text-[12px] font-medium text-slate-500">Related interviews</h3>
              {upcoming.length || ivs.length ? (
                <ul className="space-y-1.5">
                  {(upcoming.length ? upcoming : ivs).slice(0, 4).map((item) => (
                    <li key={item.id} className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="truncate text-[12px] font-semibold text-slate-800">
                        {'title' in item ? item.title : `${item.candidate} · ${item.round || item.status || 'Interview'}`}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {'at' in item && item.at
                          ? relativeTime(item.at)
                          : 'scheduledAt' in item && item.scheduledAt
                            ? relativeTime(item.scheduledAt)
                            : item.status || '—'}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12px] text-slate-400">No linked interviews in this snapshot</p>
              )}
            </div>
            <div>
              <h3 className="mb-1.5 text-[12px] font-medium text-slate-500">Related placements</h3>
              {pls.length ? (
                <ul className="space-y-1.5">
                  {pls.slice(0, 4).map((p) => (
                    <li key={p.id} className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="truncate text-[12px] font-semibold text-slate-800">{p.candidate}</p>
                      <p className="text-[11px] text-slate-400">
                        {p.status || '—'}
                        {p.client ? ` · ${p.client}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : lastAct ? (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
                  Last activity · {lastAct.label}
                  {lastAct.at ? ` · ${relativeTime(lastAct.at)}` : ''}
                </p>
              ) : (
                <p className="text-[12px] text-slate-400">No placements on this req yet</p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ScopedCandidate({
  overview,
  row,
  onClear,
}: {
  overview: RecruitmentOverview | null;
  row: CandRow;
  onClear: () => void;
}) {
  const ivs = relatedInterviews(overview, row.name);
  const pls = relatedPlacements(overview, row.name);
  const upcoming = relatedUpcoming(overview, row.name);
  const activity = relatedActivity(overview, row.name);
  const health = candidateHealth(row, {
    interviews: ivs.length,
    placements: pls.length,
    upcoming: upcoming.length,
  });
  const age = daysSince(row.updatedAt);
  const lastAct = activity[0];
  const completedIv = ivs.filter((i) => /complete|done|pass|select/i.test(String(i.status || ''))).length;
  const pendingIv = ivs.filter((i) => /schedul|pending|confirm/i.test(String(i.status || ''))).length;

  return (
    <section className={`${REC_CARD} overflow-hidden`}>
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#334155] text-[12px] font-semibold text-white">
            {recInitials(row.name)}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-400">Candidate</p>
            <p className="truncate text-[16px] font-bold text-slate-900">{row.name}</p>
            <p className="text-[12px] text-slate-400">
              {row.title || row.email || '—'}
              {row.assignee ? ` · ${row.assignee}` : ' · Unassigned'}
              {row.updatedAt ? ` · ${relativeTime(row.updatedAt)}` : ''}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone(row.status)}`}>{row.status || '—'}</span>
          <Link href={row.href || `/candidate?id=${row.id}`} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white hover:bg-slate-800" title="Open candidate">
            <ArrowUpRight size={16} />
          </Link>
          <button type="button" onClick={onClear} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50" title="Clear">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-[12px] font-medium text-slate-500">Candidate health</h3>
            <HqInfoTip text="Composite from recency, owner, interview activity and placement outcome on this person." />
          </div>
          <RecHealthBlock score={health.score} label={health.label} drivers={health.drivers} />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <CrmStatNumber value={formatNum(ivs.length)} label="interviews" size="sm" />
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <CrmStatNumber value={formatNum(upcoming.length)} label="upcoming" size="sm" />
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <CrmStatNumber value={formatNum(pls.length)} label="placements" size="sm" />
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <CrmStatNumber value={age == null ? '—' : formatNum(age)} label="days since update" size="sm" invertDelta />
          </div>
        </div>

        {ivs.length ? (
          <div>
            <h3 className="mb-1.5 text-[12px] font-medium text-slate-500">Interview mix</h3>
            <RecDonut
              data={[
                { name: 'Done', value: completedIv, color: REC_CHARCOAL },
                { name: 'Scheduled', value: pendingIv, color: '#1E3A8A' },
                { name: 'Other', value: Math.max(0, ivs.length - completedIv - pendingIv), color: REC_ORANGE },
              ]}
              center={{ value: formatNum(ivs.length), label: 'interviews' }}
              height={140}
            />
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-medium text-slate-400">Source</p>
            <p className="mt-0.5 text-[13px] font-semibold text-slate-800">{row.source || '—'}</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-medium text-slate-400">Location</p>
            <p className="mt-0.5 text-[13px] font-semibold text-slate-800">{row.location || '—'}</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-medium text-slate-400">Company</p>
            <p className="mt-0.5 text-[13px] font-semibold text-slate-800">{row.company || '—'}</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <CrmStatNumber value={row.experience == null ? '—' : formatNum(row.experience)} label="yrs exp" size="sm" />
          </div>
        </div>

        {(upcoming.length || ivs.length || pls.length || lastAct) ? (
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <h3 className="mb-1.5 text-[12px] font-medium text-slate-500">Interview trail</h3>
              {upcoming.length || ivs.length ? (
                <ul className="space-y-1.5">
                  {(upcoming.length ? upcoming : ivs).slice(0, 4).map((item) => (
                    <li key={item.id} className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="truncate text-[12px] font-semibold text-slate-800">
                        {'title' in item ? item.title : `${item.job || 'Interview'} · ${item.round || item.status || ''}`}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {'at' in item && item.at
                          ? relativeTime(item.at)
                          : 'scheduledAt' in item && item.scheduledAt
                            ? relativeTime(item.scheduledAt)
                            : item.status || '—'}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12px] text-slate-400">No interviews linked yet</p>
              )}
            </div>
            <div>
              <h3 className="mb-1.5 text-[12px] font-medium text-slate-500">Placement / last activity</h3>
              {pls.length ? (
                <ul className="space-y-1.5">
                  {pls.slice(0, 4).map((p) => (
                    <li key={p.id} className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="truncate text-[12px] font-semibold text-slate-800">{p.job || p.client || 'Placement'}</p>
                      <p className="text-[11px] text-slate-400">{p.status || '—'}</p>
                    </li>
                  ))}
                </ul>
              ) : lastAct ? (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
                  {lastAct.label}
                  {lastAct.performer ? ` · ${lastAct.performer}` : ''}
                  {lastAct.at ? ` · ${relativeTime(lastAct.at)}` : ''}
                </p>
              ) : (
                <p className="text-[12px] text-slate-400">No placement or recent activity yet</p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
