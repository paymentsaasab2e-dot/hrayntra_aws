'use client';

import React, { useMemo } from 'react';
import {
  ArrowRight,
  CalendarClock,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import type { CrmOverview } from '@/lib/dashboard/api';
import { HqInfoTip } from '@/components/hq/analytics/HqPhase2DashboardParts';
import { useUser } from '@/hooks/useUser';
import { CrmInsightCharts } from './CrmInsightCharts';
import { CrmAlertsPanel, CrmFollowupActivity } from './CrmPanels';
import { dashCard, formatMoney, formatNum, useCrmDashboard } from './crmShared';

type Props = { overview: CrmOverview | null; loading?: boolean };

type NextStep = {
  id: string;
  title: string;
  why: string;
  href: string;
  tag: string;
};

function normalizeText(s: string) {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function isManagerLike(role?: string | null, roleName?: string | null) {
  const r = `${role || ''} ${roleName || ''}`.toLowerCase();
  return /admin|manager|owner|super|director|head|lead\b|supervisor/.test(r);
}

/** Role-aware AI-style next steps — never duplicates alert wording. */
function buildNextSteps(
  overview: CrmOverview | null,
  opts: { manager: boolean; userName?: string },
): NextStep[] {
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
  const leads = overview.leadsTable || [];
  const myName = (opts.userName || '').toLowerCase();
  const mine = myName
    ? leads.filter((l) => String(l.assignee || '').toLowerCase().includes(myName.split(/\s+/)[0] || ''))
    : leads;

  const unassigned = leads.filter(
    (l) => !l.assignee || /unassigned/i.test(String(l.assignee)),
  ).length;
  const coldPool = opts.manager ? leads : mine.length ? mine : leads;
  const cold = coldPool.filter((l) => !Number(l.totalMeetings)).length;
  const overdue = Number(overview.followups?.overdue || overview.kpis?.overdueFollowups || 0);
  const todayFu = Number(overview.followups?.today || overview.todaySummary?.followupsPending || 0);
  const teamOverdue = (overview.leaderboard || []).reduce(
    (s, r) => s + Number(r.overdueFollowups || 0),
    0,
  );

  const push = (step: NextStep) => {
    if (isDup(step.title) || isDup(step.why)) return;
    if (steps.some((s) => normalizeText(s.title) === normalizeText(step.title))) return;
    steps.push(step);
  };

  if (opts.manager) {
    if (teamOverdue > 0 || overdue > 0) {
      push({
        id: 'mgr-overdue',
        title: `Coach team on ${teamOverdue || overdue} overdue follow-ups`,
        why: 'Manager view — clear blockers across assignees before new pipeline work.',
        href: '/leads',
        tag: 'Team',
      });
    }
    if (unassigned > 0) {
      push({
        id: 'mgr-assign',
        title: `Distribute ${unassigned} unassigned lead${unassigned === 1 ? '' : 's'}`,
        why: 'Balance ownership so every lead has a clear owner.',
        href: '/leads',
        tag: 'Assign',
      });
    }
    push({
      id: 'mgr-pipeline',
      title: 'Review qualified → win rate this period',
      why: 'Check Pipeline tab for stage drop-offs and coach closers.',
      href: '/dashboard',
      tag: 'Insight',
    });
  } else {
    if (todayFu > 0) {
      push({
        id: 'emp-today',
        title: `Finish ${todayFu} follow-up${todayFu === 1 ? '' : 's'} on your list today`,
        why: 'Your assigned queue for today — complete before new outreach.',
        href: '/leads',
        tag: 'My queue',
      });
    }
    if (overdue > 0) {
      push({
        id: 'emp-overdue',
        title: `Clear ${overdue} overdue item${overdue === 1 ? '' : 's'} assigned to you`,
        why: 'Past-due commitments on your plate need action first.',
        href: '/leads',
        tag: 'Urgent',
      });
    }
    if (cold > 0) {
      push({
        id: 'emp-touch',
        title: `Log a touch on ${Math.min(cold, 5)} cold lead${cold === 1 ? '' : 's'}`,
        why: 'Zero calls/emails yet — a quick outreach keeps deals warm.',
        href: '/leads',
        tag: 'Outreach',
      });
    }
  }

  (overview.recommendations || []).forEach((rec, i) => {
    push({
      id: rec.id || `rec-${i}`,
      title: rec.text,
      why: rec.detail || 'Suggested from your CRM signals.',
      href: rec.href || '/dashboard',
      tag: opts.manager ? 'Plan' : 'Task',
    });
  });

  return steps.slice(0, 3);
}

function PulseStat({
  label,
  value,
  hint,
  positive,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  positive?: boolean | null;
  accent: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[1.35rem] border border-white/80 bg-white p-4 shadow-[0_14px_40px_-22px_rgba(15,23,42,0.22)] ${accent}`}
    >
      <div className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-current opacity-[0.06]" />
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</p>
      <p className="mt-2.5 text-[1.75rem] font-bold leading-none tracking-tight tabular-nums text-slate-900">
        {value}
      </p>
      <p
        className={`mt-3 inline-flex items-center gap-1 text-[11px] font-semibold ${
          positive === true
            ? 'text-lime-600'
            : positive === false
              ? 'text-rose-500'
              : 'text-slate-400'
        }`}
      >
        {positive === true ? <TrendingUp size={12} /> : null}
        {positive === false ? <TrendingDown size={12} /> : null}
        {hint}
      </p>
    </div>
  );
}

export function CrmDecisionInsights({ overview, loading }: Props) {
  const { openDrillDown } = useCrmDashboard();
  const { user } = useUser();
  const roleName =
    user && 'roleName' in user ? String((user as { roleName?: string }).roleName || '') : '';
  const manager = isManagerLike(user?.role, roleName);
  const today = overview?.todaySummary;
  const nextSteps = useMemo(
    () =>
      buildNextSteps(overview, {
        manager,
        userName: user?.name || user?.email || '',
      }),
    [overview, manager, user?.name, user?.email],
  );

  const topInsight = nextSteps[0];
  const restSteps = nextSteps.slice(1);

  if (loading && !overview) {
    return (
      <div className="space-y-4">
        <div className="h-36 animate-pulse rounded-[1.5rem] bg-white/80" />
        <div className="h-64 animate-pulse rounded-[1.5rem] bg-white/80" />
      </div>
    );
  }

  const meetings = Number(today?.meetingsScheduled || 0);
  const newLeads = Number(today?.newLeads || 0);

  return (
    <div className="space-y-5">
      {/* Syntho-style top: AI update + pulse KPIs */}
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <button
            type="button"
            onClick={() => {
              if (!topInsight) return;
              openDrillDown({
                title: topInsight.title,
                href: topInsight.href,
                rows: [{ Action: topInsight.title, Why: topInsight.why }],
              });
            }}
            className="relative flex h-full min-h-[168px] w-full flex-col justify-between overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-[#3B1F8E] via-[#4F2AB8] to-[#6D28D9] p-5 text-left text-white shadow-[0_20px_50px_-28px_rgba(79,42,184,0.65)] transition hover:brightness-105"
          >
            <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-8 left-10 h-24 w-24 rounded-full bg-lime-300/20 blur-2xl" />
            <div className="relative flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur">
                <Zap size={11} className="text-lime-300" />
                AI suggestion
              </span>
              <span className="rounded-full bg-lime-300/20 px-2 py-0.5 text-[10px] font-semibold text-lime-200">
                {manager ? 'Manager' : 'My tasks'}
              </span>
            </div>
            <div className="relative mt-4">
              <p className="text-[15px] font-semibold leading-snug tracking-tight text-white">
                {topInsight?.title || 'You’re clear — keep logging today’s outreach'}
              </p>
              <p className="mt-2 text-[12px] leading-relaxed text-violet-100/90">
                {topInsight?.why || 'No urgent next step right now. Review follow-ups below.'}
              </p>
            </div>
            {topInsight ? (
              <span className="relative mt-4 inline-flex items-center gap-1 text-[11px] font-bold text-lime-200">
                Take action <ArrowRight size={12} />
              </span>
            ) : null}
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-8 lg:grid-cols-4">
          <PulseStat
            label="New leads today"
            value={formatNum(today?.newLeads)}
            hint={newLeads > 0 ? 'Fresh pipeline intake' : 'No new leads yet today'}
            positive={newLeads > 0 ? true : null}
            accent="text-indigo-500"
          />
          <PulseStat
            label="Follow-ups due"
            value={formatNum(today?.followupsPending)}
            hint="Today’s working queue"
            positive={Number(today?.followupsPending || 0) === 0 ? true : false}
            accent="text-violet-500"
          />
          <PulseStat
            label="Meetings"
            value={formatNum(today?.meetingsScheduled)}
            hint={meetings > 0 ? 'On your calendar today' : 'No meetings scheduled'}
            positive={meetings > 0 ? true : null}
            accent="text-sky-500"
          />
          <PulseStat
            label="Est. value"
            value={formatMoney(today?.estimatedBusinessValue)}
            hint="Org currency · today’s signal"
            positive={Number(today?.estimatedBusinessValue || 0) > 0 ? true : null}
            accent="text-lime-600"
          />
        </div>
      </div>

      {/* Compact secondary AI chips */}
      {restSteps.length ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            Also suggested
          </span>
          {restSteps.map((step) => (
            <button
              key={step.id}
              type="button"
              onClick={() =>
                openDrillDown({
                  title: step.title,
                  href: step.href,
                  rows: [{ Action: step.title, Why: step.why }],
                })
              }
              className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3 py-1.5 text-left text-[11px] font-semibold text-slate-700 shadow-sm transition hover:border-violet-200 hover:text-violet-800"
            >
              <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-violet-600">
                {step.tag}
              </span>
              <span className="truncate">{step.title}</span>
            </button>
          ))}
        </div>
      ) : null}

      {/* Today's work — follow-ups up front */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <CalendarClock size={16} className="text-indigo-600" />
          <h2 className="text-sm font-bold tracking-tight text-slate-900">Today&apos;s work</h2>
          <HqInfoTip text="Follow-up queue and recent activity for your working day — placed here because it drives today’s actions." />
        </div>
        <div className="grid gap-4 xl:grid-cols-12 xl:items-start">
          <div className="xl:col-span-8">
            <CrmFollowupActivity overview={overview} loading={loading} compact />
          </div>
          <div className="xl:col-span-4">
            <CrmAlertsPanel overview={overview} loading={loading} />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Sparkles size={16} className="text-violet-600" />
          <h2 className="text-sm font-bold tracking-tight text-slate-900">Trends & coverage</h2>
          <p className="text-[11px] text-slate-400">Insights-only charts · not repeated on Pipeline / Team</p>
        </div>
        <CrmInsightCharts overview={overview} />
      </div>
    </div>
  );
}
