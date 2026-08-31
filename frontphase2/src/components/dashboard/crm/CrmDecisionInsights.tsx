'use client';

import React, { useMemo } from 'react';
import {
  ArrowRight,
  CalendarClock,
  Sparkles,
} from 'lucide-react';
import type { CrmOverview } from '@/lib/dashboard/api';
import { HqInfoTip } from '@/components/hq/analytics/HqPhase2DashboardParts';
import { useUser } from '@/hooks/useUser';
import { CrmInsightCharts } from './CrmInsightCharts';
import { CrmAlertsPanel, CrmFollowupActivity } from './CrmPanels';
import { formatMoney, formatNum, useCrmDashboard } from './crmShared';
import { CrmStatNumber, sparkDelta } from './crmStatNumber';

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
  const alerts = Array.isArray(overview.alerts) ? overview.alerts : [];
  const isDup = (text: string) => {
    const n = normalizeText(text);
    if (!n) return true;
    return alerts.some((a) => {
      const at = normalizeText(a.text || '');
      return at.includes(n.slice(0, 28)) || n.includes(at.slice(0, 28));
    });
  };

  const steps: NextStep[] = [];
  const leads = Array.isArray(overview.leadsTable) ? overview.leadsTable : [];
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
  const teamOverdue = (Array.isArray(overview.leaderboard) ? overview.leaderboard : []).reduce(
    (s, r) => s + Number(r.overdueFollowups || 0),
    0,
  );

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
      why: 'Team requests, task completions, conversions, and cross-dept items in your Approvals bucket.',
      href: '/request?view=approvals',
      tag: 'Approvals',
    });
  }

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
      title: 'Review pipeline conversion this period',
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

  (Array.isArray(overview.recommendations) ? overview.recommendations : []).forEach((rec, i) => {
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

const PULSE_GLASS: Record<string, string> = {
  indigo:
    'from-indigo-500/90 via-indigo-600/85 to-violet-700/90 shadow-[0_18px_40px_-18px_rgba(79,70,229,0.55)]',
  rose:
    'from-rose-500/90 via-rose-600/85 to-orange-600/80 shadow-[0_18px_40px_-18px_rgba(225,29,72,0.5)]',
  sky:
    'from-sky-500/90 via-cyan-600/85 to-indigo-600/80 shadow-[0_18px_40px_-18px_rgba(14,165,233,0.5)]',
  emerald:
    'from-emerald-500/90 via-teal-600/85 to-lime-600/75 shadow-[0_18px_40px_-18px_rgba(16,185,129,0.5)]',
};

function PulseStat({
  label,
  value,
  unit,
  hint,
  tone,
  deltaPct,
  spark,
  invertDelta,
}: {
  label: string;
  value: string;
  unit?: string;
  hint: string;
  tone: keyof typeof PULSE_GLASS;
  deltaPct?: number | null;
  spark?: number[];
  invertDelta?: boolean;
}) {
  return (
    <div
      className={`relative flex h-full min-h-[168px] flex-col justify-between overflow-hidden rounded-[1.5rem] border border-white/25 bg-gradient-to-br p-4 text-white backdrop-blur-xl ${PULSE_GLASS[tone]}`}
    >
      <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/20 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-10 left-4 h-20 w-20 rounded-full bg-black/10 blur-2xl" />
      <p className="relative text-[10px] font-semibold uppercase tracking-wider text-white/75">{label}</p>
      <CrmStatNumber
        className="relative"
        value={value}
        label={unit}
        light
        size="lg"
        deltaPct={deltaPct}
        invertDelta={invertDelta}
      />
      <p className="relative text-[11px] font-medium text-white/85">{hint}</p>
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
      <div className="grid gap-3 lg:grid-cols-12 lg:items-stretch">
        <div className="lg:col-span-4">
          <section className="relative flex h-full min-h-[168px] flex-col overflow-hidden rounded-[1.5rem] border border-white/25 bg-gradient-to-br from-indigo-600 via-violet-600 to-teal-500 p-4 text-white shadow-[0_20px_48px_-20px_rgba(79,70,229,0.55)] backdrop-blur-xl">
            <div className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-white/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-12 left-6 h-24 w-24 rounded-full bg-lime-300/25 blur-2xl" />

            <div className="relative mb-3 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/90">
                <Sparkles size={13} />
                AI next steps
              </span>
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white/95">
                {manager ? 'Manager' : 'My tasks'}
              </span>
            </div>

            <ul className="relative space-y-1">
              {(nextSteps.length ? nextSteps : [null]).map((step, i) => {
                const primary = i === 0;
                return (
                  <li key={step?.id || 'empty'}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!step) return;
                        openDrillDown({
                          title: step.title,
                          href: step.href,
                          rows: [{ Action: step.title, Why: step.why }],
                        });
                      }}
                      className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition ${
                        primary ? 'bg-white/18 hover:bg-white/25' : 'hover:bg-white/10'
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                          primary ? 'bg-white text-indigo-700' : 'bg-white/20 text-white'
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-white">
                        {step?.tag ? `${step.tag} · ` : ''}
                        {step?.title || 'You’re clear — keep logging today’s outreach'}
                      </span>
                      <ArrowRight size={12} className="shrink-0 text-white/80" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-8 lg:grid-cols-4">
          <PulseStat
            label="New leads today"
            value={formatNum(today?.newLeads)}
            unit="leads"
            hint={newLeads > 0 ? 'Fresh pipeline intake' : 'No new leads yet today'}
            tone="indigo"
            deltaPct={sparkDelta(overview?.leadSpark)}
          />
          <PulseStat
            label="Follow-ups due"
            value={formatNum(today?.followupsPending)}
            unit="due"
            hint="Today’s working queue"
            tone="rose"
            invertDelta
          />
          <PulseStat
            label="Meetings"
            value={formatNum(today?.meetingsScheduled)}
            unit="meetings"
            hint={meetings > 0 ? 'On your calendar today' : 'No meetings scheduled'}
            tone="sky"
          />
          <PulseStat
            label="Est. value"
            value={formatMoney(today?.estimatedBusinessValue)}
            unit="value"
            hint="Org currency · today’s signal"
            tone="emerald"
          />
        </div>
      </div>

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
