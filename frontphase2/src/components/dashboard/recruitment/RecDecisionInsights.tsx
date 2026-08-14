'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Sparkles } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import type { RecruitmentOverview } from '@/lib/dashboard/api';
import { HqInfoTip } from '@/components/hq/analytics/HqPhase2DashboardParts';
import { useUser } from '@/hooks/useUser';
import { CrmStatNumber, sparkDelta, sparkValues } from '@/components/dashboard/crm/crmStatNumber';
import { formatInr, formatNum, relativeTime, recCard, useRecDashboard } from './recShared';
import {
  REC_CARD,
  REC_CARD_COMPACT,
  REC_CHARCOAL,
  REC_ORANGE,
  RecFillBar,
  RecNavyTooltip,
  RecSegmentedBar,
  RecSemiGauge,
  RecStatShell,
  recKpi,
} from './recViz';

type Props = { overview: RecruitmentOverview | null; loading?: boolean };

type NextStep = { id: string; title: string; why: string; href: string; tag: string };

function normalizeText(s: string) {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function isManagerLike(role?: string | null, roleName?: string | null) {
  const r = `${role || ''} ${roleName || ''}`.toLowerCase();
  return /admin|manager|owner|super|director|head|lead\b|supervisor/.test(r);
}

function buildNextSteps(overview: RecruitmentOverview | null, opts: { manager: boolean }): NextStep[] {
  if (!overview) return [];
  const alerts = overview.alerts || [];
  const isDup = (text: string) => {
    const n = normalizeText(text);
    if (!n) return true;
    return alerts.some((a) => {
      const at = normalizeText(a.text || '');
      return at.includes(n.slice(0, 28)) || n.includes(at.slice(0, 28));
    });
  };
  const steps: NextStep[] = [];
  const push = (step: NextStep) => {
    if (isDup(step.title) || isDup(step.why)) return;
    if (steps.some((s) => normalizeText(s.title) === normalizeText(step.title))) return;
    steps.push(step);
  };

  const waiting = Number(overview.myWork?.pendingApprovalsTotal || overview.kpis?.waitingOnYou || 0);
  if (waiting > 0) {
    push({
      id: 'approvals-waiting',
      title: `Act on ${waiting} approval${waiting === 1 ? '' : 's'} waiting on you`,
      why: 'Open the Approvals bucket for tasks, conversions, and cross-dept requests assigned to you.',
      href: '/request?view=approvals',
      tag: 'Approvals',
    });
  }

  const noCand = recKpi(overview, 'jobsNoCandidates');
  const sla = recKpi(overview, 'jobsSlaRisk');
  const feedback = recKpi(overview, 'interviewsOverdueFeedback');
  const todayIv = recKpi(overview, 'interviewsToday');

  if (opts.manager) {
    if (sla > 0) {
      push({
        id: 'mgr-sla',
        title: `Unblock ${sla} SLA-risk job${sla === 1 ? '' : 's'}`,
        why: 'Open roles past SLA need owner attention before new reqs.',
        href: '/job',
        tag: 'Team',
      });
    }
    if (noCand > 0) {
      push({
        id: 'mgr-source',
        title: `Source talent for ${noCand} empty pipeline${noCand === 1 ? '' : 's'}`,
        why: 'Open jobs with zero candidates stall fill rate.',
        href: '/job',
        tag: 'Source',
      });
    }
  } else {
    if (todayIv > 0) {
      push({
        id: 'emp-today',
        title: `Run ${todayIv} interview${todayIv === 1 ? '' : 's'} on today’s calendar`,
        why: 'Your scheduled queue for today.',
        href: '/interviews',
        tag: 'Today',
      });
    }
    if (feedback > 0) {
      push({
        id: 'emp-fb',
        title: `Submit ${feedback} overdue feedback item${feedback === 1 ? '' : 's'}`,
        why: 'Past interviews still waiting on notes.',
        href: '/interviews',
        tag: 'Urgent',
      });
    }
  }

  (overview.recommendations || []).forEach((rec, i) => {
    push({
      id: rec.id || `rec-${i}`,
      title: rec.text,
      why: rec.detail || 'Suggested from hiring signals.',
      href: rec.href || '/recruitment',
      tag: opts.manager ? 'Plan' : 'Task',
    });
  });

  return steps.slice(0, 3);
}

const PULSE_GLASS: Record<string, string> = {
  indigo: 'from-indigo-500/90 via-indigo-600/85 to-violet-700/90 shadow-[0_18px_40px_-18px_rgba(79,70,229,0.55)]',
  rose: 'from-rose-500/90 via-rose-600/85 to-orange-600/80 shadow-[0_18px_40px_-18px_rgba(225,29,72,0.5)]',
  sky: 'from-sky-500/90 via-cyan-600/85 to-indigo-600/80 shadow-[0_18px_40px_-18px_rgba(14,165,233,0.5)]',
  emerald: 'from-emerald-500/90 via-teal-600/85 to-lime-600/75 shadow-[0_18px_40px_-18px_rgba(16,185,129,0.5)]',
};

function PulseStat({
  label,
  value,
  unit,
  hint,
  tone,
  deltaPct,
  invertDelta,
}: {
  label: string;
  value: string;
  unit?: string;
  hint: string;
  tone: keyof typeof PULSE_GLASS;
  deltaPct?: number | null;
  invertDelta?: boolean;
}) {
  return (
    <div
      className={`relative flex h-full min-h-[168px] flex-col justify-between overflow-hidden rounded-[1.5rem] border border-white/25 bg-gradient-to-br p-4 text-white backdrop-blur-xl ${PULSE_GLASS[tone]}`}
    >
      <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/20 blur-2xl" />
      <p className="relative text-[10px] font-semibold uppercase tracking-wider text-white/75">{label}</p>
      <CrmStatNumber className="relative" value={value} label={unit} light size="lg" deltaPct={deltaPct} invertDelta={invertDelta} />
      <p className="relative text-[11px] font-medium text-white/85">{hint}</p>
    </div>
  );
}

export function RecDecisionInsights({ overview, loading }: Props) {
  const { openDrillDown } = useRecDashboard();
  const { user } = useUser();
  const roleName = user && 'roleName' in user ? String((user as { roleName?: string }).roleName || '') : '';
  const manager = isManagerLike(user?.role, roleName);
  const nextSteps = useMemo(() => buildNextSteps(overview, { manager }), [overview, manager]);
  const k = overview?.kpis || {};
  const today = overview?.todaySummary;
  const alerts = overview?.alerts || [];
  const schedule = overview?.schedule || [];
  const spark = useMemo(() => {
    const rows = overview?.jobSpark || [];
    return rows.map((d, i) => ({
      label: d.label,
      value: Number(d.value || 0),
      prev: i > 0 ? Number(rows[i - 1]?.value || 0) : Number(d.value || 0),
    }));
  }, [overview?.jobSpark]);

  if (loading && !overview) {
    return (
      <div className="space-y-4">
        <div className="h-36 animate-pulse rounded-[1.5rem] bg-white/80" />
        <div className="h-64 animate-pulse rounded-[1.5rem] bg-white/80" />
      </div>
    );
  }

  const noCand = recKpi(overview, 'jobsNoCandidates');
  const sla = recKpi(overview, 'jobsSlaRisk');
  const openJobs = recKpi(overview, 'openJobs');
  const fillRate = recKpi(overview, 'fillRate');
  const ivRate = recKpi(overview, 'interviewCompletionRate');
  const offerRate = recKpi(overview, 'offerAcceptRate');
  const feedback = recKpi(overview, 'interviewsOverdueFeedback');
  const ivToday = recKpi(overview, 'interviewsToday');
  const ivUp = recKpi(overview, 'interviewsUpcoming');
  const jobStatus = overview?.jobStatusPie || [];
  const statusColors = [REC_CHARCOAL, REC_ORANGE, '#64748B', '#0F766E', '#1E3A8A'];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 lg:grid-cols-12 lg:items-stretch">
        <div className="lg:col-span-4">
          <section className="relative flex h-full min-h-[168px] flex-col overflow-hidden rounded-[1.5rem] border border-white/25 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 p-4 text-white shadow-[0_20px_48px_-20px_rgba(15,23,42,0.55)]">
            <div className="relative mb-3 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/90">
                <Sparkles size={13} />
                Next steps
              </span>
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white/95">
                {manager ? 'Manager' : 'My tasks'}
              </span>
            </div>
            <ul className="relative space-y-1">
              {(nextSteps.length ? nextSteps : [null]).map((step, i) => (
                <li key={step?.id || 'empty'}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!step) return;
                      openDrillDown({ title: step.title, href: step.href, rows: [{ Action: step.title, Why: step.why }] });
                    }}
                    className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition ${
                      i === 0 ? 'bg-white/18 hover:bg-white/25' : 'hover:bg-white/10'
                    }`}
                  >
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${i === 0 ? 'bg-white text-slate-900' : 'bg-white/20 text-white'}`}>
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-white">
                      {step?.tag ? `${step.tag} · ` : ''}
                      {step?.title || 'You’re clear — keep today’s interviews on track'}
                    </span>
                    <ArrowRight size={12} className="shrink-0 text-white/80" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-8 lg:grid-cols-4">
          <PulseStat
            label="Interviews today"
            value={formatNum(today?.interviewsToday ?? ivToday)}
            unit="today"
            hint={ivToday > 0 ? 'On the calendar today' : 'No interviews scheduled today'}
            tone="indigo"
          />
          <PulseStat
            label="New candidates"
            value={formatNum(today?.newCandidates ?? recKpi(overview, 'newCandidates'))}
            unit="new"
            hint="Fresh talent this period"
            tone="sky"
            deltaPct={sparkDelta(spark)}
          />
          <PulseStat
            label="Open jobs"
            value={formatNum(today?.openJobs ?? openJobs)}
            unit="open"
            hint={`${formatNum(noCand)} with no candidates`}
            tone="rose"
            invertDelta
          />
          <PulseStat
            label="Placement revenue"
            value={formatInr(today?.placementRevenue ?? recKpi(overview, 'placementRevenue'))}
            unit="value"
            hint={`${formatNum(today?.pendingOffers ?? recKpi(overview, 'offersSent'))} offers in play`}
            tone="emerald"
          />
        </div>
      </div>

      <section>
        <div className="mb-2.5 flex items-center gap-2">
          <CalendarClock size={16} className="text-slate-700" />
          <h2 className="text-[15px] font-bold text-slate-900">Today&apos;s work</h2>
          <HqInfoTip text="Upcoming interviews and hiring alerts for this working day." />
        </div>
        <div className="grid gap-3 xl:grid-cols-12 xl:items-start">
          <section className={`${recCard} p-4 xl:col-span-8`}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[13px] font-bold text-slate-900">Upcoming interviews</h3>
              <Link href="/interviews" className="text-[12px] font-semibold text-blue-600 hover:text-blue-800">
                Calendar →
              </Link>
            </div>
            {schedule.length ? (
              <ul className="space-y-2">
                {schedule.slice(0, 6).map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-2 rounded-xl bg-slate-50/80 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {item.at ? relativeTime(item.at) : '—'}
                        {item.round ? ` · ${item.round}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-100">
                      {item.status || 'SCHEDULED'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-[13px] text-slate-400">
                No interviews in the next 7 days
              </p>
            )}
          </section>

          <section className={`${recCard} p-4 xl:col-span-4`}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[13px] font-bold text-slate-900">Hiring alerts</h3>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{alerts.length}</span>
            </div>
            {alerts.length ? (
              <ul className="space-y-2">
                {alerts.slice(0, 6).map((alert) => (
                  <li key={alert.id}>
                    <Link
                      href={alert.href || '/recruitment'}
                      className={`flex gap-2.5 rounded-xl px-3 py-2.5 text-left ring-1 ${
                        alert.severity === 'high'
                          ? 'bg-rose-50 text-rose-800 ring-rose-100'
                          : alert.severity === 'medium'
                            ? 'bg-orange-50 text-orange-800 ring-orange-100'
                            : 'bg-slate-50 text-slate-700 ring-slate-100'
                      }`}
                    >
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-[12px] font-semibold leading-snug">{alert.text}</span>
                        {alert.action ? <span className="mt-0.5 block text-[11px] opacity-80">{alert.action} →</span> : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
                <CheckCircle2 className="mb-2 text-emerald-500" size={20} />
                <p className="text-[13px] text-slate-400">No hiring alerts right now</p>
              </div>
            )}
          </section>
        </div>
      </section>

      <section>
        <div className="mb-2.5">
          <h2 className="text-[15px] font-bold text-slate-900">Trends & coverage</h2>
          <p className="text-[12px] font-medium text-slate-400">Insights-only charts · not repeated on Pipeline / Team</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <RecStatShell
            info="Open jobs with zero candidates — source before adding more reqs."
            className={REC_CARD_COMPACT}
            onClick={() => openDrillDown({ title: 'Jobs with no candidates', href: '/job', rows: [{ Count: noCand }] })}
          >
            <p className="text-[11px] font-medium text-slate-500">Empty pipelines</p>
            <CrmStatNumber className="mt-1.5" value={formatNum(noCand)} label="jobs" invertDelta />
            <div className="mt-2.5">
              <RecFillBar pct={openJobs > 0 ? (noCand / openJobs) * 100 : 0} color={REC_ORANGE} height={10} />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">{formatNum(openJobs)} open roles</p>
          </RecStatShell>
          <RecStatShell
            info="Open jobs flagged at SLA risk."
            className={REC_CARD_COMPACT}
            onClick={() => openDrillDown({ title: 'SLA risk jobs', href: '/job', rows: [{ Count: sla }] })}
          >
            <p className="text-[11px] font-medium text-slate-500">SLA risk</p>
            <CrmStatNumber className="mt-1.5" value={formatNum(sla)} label="open" invertDelta />
            <div className="mt-2.5">
              <RecFillBar pct={openJobs > 0 ? (sla / openJobs) * 100 : 0} color={REC_ORANGE} height={10} />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">Needs owner follow-through</p>
          </RecStatShell>
          <RecStatShell info="Job status mix for current filters." className={REC_CARD_COMPACT}>
            <p className="text-[11px] font-medium text-slate-500">Job status mix</p>
            <CrmStatNumber className="mt-1.5" value={formatNum(k.totalJobs)} label="jobs" />
            <div className="mt-2.5">
              <RecSegmentedBar
                height={10}
                parts={jobStatus.map((d, i) => ({ value: d.value, color: statusColors[i % statusColors.length] }))}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-medium text-slate-500">
              {jobStatus.slice(0, 4).map((d, i) => (
                <span key={d.name} className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm" style={{ background: statusColors[i % statusColors.length] }} />
                  {d.name} {formatNum(d.value)}
                </span>
              ))}
            </div>
          </RecStatShell>
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-12 xl:items-stretch">
          <section className={`${REC_CARD} p-4 xl:col-span-7`}>
            <div className="mb-1 flex items-start justify-between gap-2">
              <div>
                <h3 className="text-[13px] font-bold text-slate-900">Job inflow</h3>
                <p className="text-[11px] font-medium text-slate-400">New reqs opened recently</p>
              </div>
            </div>
            {spark.length > 1 ? (
              <>
                <CrmStatNumber
                  value={formatNum(spark[spark.length - 1]?.value)}
                  label="opened"
                  size="sm"
                  deltaPct={sparkDelta(spark)}
                  spark={sparkValues(spark)}
                />
                <div className="mt-1 h-[72px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={spark} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
                      <XAxis dataKey="label" hide />
                      <Tooltip content={<RecNavyTooltip />} cursor={{ stroke: '#94A3B8', strokeWidth: 1 }} />
                      <Area
                        type="monotone"
                        dataKey="value"
                        name="Jobs"
                        stroke={REC_ORANGE}
                        strokeWidth={1.75}
                        fill="rgba(249,115,22,0.14)"
                        activeDot={{ r: 4, fill: REC_ORANGE, stroke: '#fff', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <p className="py-8 text-center text-[13px] text-slate-400">Not enough inflow history yet</p>
            )}
          </section>

          <section className={`${REC_CARD} shrink-0 p-3 xl:col-span-5`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[13px] font-bold text-slate-900">Interview queue</h3>
                <p className="text-[11px] font-medium text-slate-400">Today · upcoming · feedback due</p>
              </div>
            </div>
            <div className="mt-2">
              <RecSegmentedBar
                height={10}
                parts={[
                  { value: ivToday, color: REC_CHARCOAL },
                  { value: ivUp, color: '#1E3A8A' },
                  { value: feedback, color: REC_ORANGE },
                ]}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold tabular-nums text-slate-700">
                {formatNum(ivToday)} today
              </span>
              <span className="rounded-md bg-blue-50 px-2 py-1 text-[11px] font-semibold tabular-nums text-blue-800">
                {formatNum(ivUp)} upcoming
              </span>
              <span className="rounded-md bg-orange-50 px-2 py-1 text-[11px] font-semibold tabular-nums text-orange-700">
                {formatNum(feedback)} feedback
              </span>
            </div>
          </section>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <RecSemiGauge display={`${fillRate}%`} pct={fillRate} label="Fill rate" sub={`${formatNum(k.filledJobs)} filled`} tone="lime" info="Filled vs open + filled roles." />
          <RecSemiGauge display={`${ivRate}%`} pct={ivRate} label="Interview completion" sub={`${formatNum(k.completedInterviews)} done`} tone="indigo" info="Completed interviews vs all interviews." />
          <RecSemiGauge display={`${offerRate}%`} pct={offerRate} label="Offer accept" sub={`${formatNum(k.offersAccepted)} accepted`} tone="amber" info="Accepted offers vs sent + accepted." />
          <RecSemiGauge
            display={`${recKpi(overview, 'totalPlacements') > 0 ? Math.round((recKpi(overview, 'joinedPlacements') / recKpi(overview, 'totalPlacements')) * 100) : 0}%`}
            pct={recKpi(overview, 'totalPlacements') > 0 ? (recKpi(overview, 'joinedPlacements') / recKpi(overview, 'totalPlacements')) * 100 : 0}
            label="Joined rate"
            sub={`${formatNum(k.joinedPlacements)} joined · ${formatInr(recKpi(overview, 'placementRevenue'))}`}
            tone="violet"
            info="Joined placements vs all placements. Revenue shown in the subtitle."
          />
        </div>
      </section>
    </div>
  );
}
