'use client';

import React, { useMemo, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import type { CrmOverview } from '@/lib/dashboard/api';
import { HqInfoTip } from '@/components/hq/analytics/HqPhase2DashboardParts';
import { buildKpiDrillDown } from './crmDrillDown';
import { buildCrmTeamStatsWithInfo, type CrmComboMetric } from './crmInsights';
import { formatNum, useCrmDashboard } from './crmShared';
import { CrmStatNumber, crmNumFont, sparkDelta, sparkValues } from './crmStatNumber';
import { CrmTeamLeaderboard } from './CrmTeamLeaderboard';

const ORANGE = '#F97316';
const CHARCOAL = '#334155';
const TRACK = '#E8EEF4';
const CARD =
  'relative h-full rounded-[1.25rem] border border-slate-100/80 bg-white shadow-[0_14px_40px_-28px_rgba(15,23,42,0.22)]';
const CARD_PAD = `${CARD} p-4`;
const CARD_COMPACT = `${CARD} p-3.5`;

type GaugeTone = 'lime' | 'indigo' | 'violet' | 'rose' | 'amber';
const TONE_TICKS: Record<GaugeTone, [string, string, string]> = {
  lime: ['#E8F9A8', '#A3E635', '#65A30D'],
  indigo: ['#C7D2FE', '#818CF8', '#4F46E5'],
  violet: ['#DDD6FE', '#A78BFA', '#7C3AED'],
  rose: ['#FECDD3', '#FB7185', '#E11D48'],
  amber: ['#FDE68A', '#FBBF24', '#D97706'],
};

function toneFromMetric(metric?: CrmComboMetric): GaugeTone {
  if (!metric) return 'lime';
  if (metric.tone === 'rose') return 'rose';
  if (metric.tone === 'amber') return 'amber';
  if (metric.tone === 'indigo') return 'violet';
  if (metric.tone === 'blue') return 'indigo';
  return 'lime';
}

function initials(name: string) {
  const parts = String(name || '?')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function StatShell({
  children,
  onClick,
  info,
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  info?: string;
  className?: string;
}) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`${onClick ? 'cursor-pointer transition hover:-translate-y-0.5' : ''} ${className}`}
    >
      {info ? (
        <span className="absolute right-2.5 top-2.5 z-20" onClick={(e) => e.stopPropagation()}>
          <HqInfoTip text={info} />
        </span>
      ) : null}
      {children}
    </div>
  );
}

/** Rectangle track + rectangular segments, rounded corners only (not a pie / pill). */
function SegmentedBar({
  parts,
  height = 12,
}: {
  parts: Array<{ value: number; color: string }>;
  height?: number;
}) {
  const sum = parts.reduce((s, p) => s + Math.max(0, p.value), 0);
  return (
    <div className="flex w-full overflow-hidden rounded-md bg-[#E8EEF4]" style={{ height }}>
      {sum <= 0
        ? null
        : parts.map((p, i) =>
            p.value > 0 ? (
              <div
                key={`${p.color}-${i}`}
                className="h-full min-w-0"
                style={{ width: `${(p.value / sum) * 100}%`, background: p.color }}
              />
            ) : null,
          )}
    </div>
  );
}

function FillBar({ pct, color, height = 12 }: { pct: number; color: string; height?: number }) {
  const w = Math.min(100, Math.max(0, pct));
  return (
    <div className="w-full overflow-hidden rounded-md bg-[#E8EEF4]" style={{ height }}>
      <div className="h-full rounded-none" style={{ width: `${w}%`, background: color }} />
    </div>
  );
}

function NavyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; name?: string; color?: string; payload?: Record<string, number | string> }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + Number(p.value || 0), 0);
  const denom = total || 1;
  const prev = Number(payload[0]?.payload?.prev ?? 0);
  const delta = prev > 0 ? Math.round(((total - prev) / prev) * 1000) / 10 : null;
  return (
    <div className="min-w-[168px] rounded-xl bg-[#1E293B] px-3 py-2.5 text-white shadow-[0_12px_28px_-12px_rgba(15,23,42,0.55)]">
      <p className="text-[10px] font-medium text-slate-400">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <p className="text-lg font-bold tabular-nums leading-none">{formatNum(total)}</p>
        {delta != null ? (
          <span
            className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
              delta >= 0 ? 'bg-emerald-400/20 text-emerald-300' : 'bg-rose-400/20 text-rose-300'
            }`}
          >
            {delta >= 0 ? '+' : ''}
            {delta}%
          </span>
        ) : null}
      </div>
      <div className="mt-2.5 flex h-2 overflow-hidden rounded-md bg-white/10">
        {payload.map((p, i) => {
          const v = Number(p.value || 0);
          if (v <= 0) return null;
          return (
            <div
              key={p.name || i}
              className="h-full"
              style={{ width: `${(v / denom) * 100}%`, background: p.color || ORANGE }}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between gap-2 text-[10px] text-slate-400">
        {payload.map((p) => (
          <span key={p.name}>
            {p.name} {formatNum(Number(p.value || 0))}
          </span>
        ))}
      </div>
    </div>
  );
}

function SemiGauge({
  display,
  pct,
  label,
  unit,
  sub,
  info,
  tone = 'lime',
  deltaPct,
  spark,
  invertDelta,
  onClick,
}: {
  display: string;
  pct: number;
  label: string;
  unit?: string;
  sub?: string;
  info?: string;
  tone?: GaugeTone;
  deltaPct?: number | null;
  spark?: number[];
  invertDelta?: boolean;
  onClick?: () => void;
}) {
  const gid = React.useId().replace(/:/g, '');
  const fillPct = Math.min(100, Math.max(0, pct));
  const [c0, c1, c2] = TONE_TICKS[tone];
  const r = 78;
  const trackLen = Math.PI * r;
  const fillLen = (fillPct / 100) * trackLen;
  const long = display.length > 5;

  return (
    <StatShell onClick={onClick} info={info} className={`${CARD_PAD} flex flex-col items-center pt-5 text-center`}>
      <div className="relative w-full max-w-[220px]">
        <svg viewBox="0 0 220 118" className="h-auto w-full" aria-hidden>
          <defs>
            <linearGradient id={`g-${gid}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={c0} />
              <stop offset="48%" stopColor={c1} />
              <stop offset="100%" stopColor={c2} />
            </linearGradient>
            <filter id={`glow-${gid}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path d="M 32 104 A 78 78 0 0 1 188 104" fill="none" stroke={TRACK} strokeWidth="18" strokeLinecap="round" />
          {fillPct > 0 ? (
            <path
              d="M 32 104 A 78 78 0 0 1 188 104"
              fill="none"
              stroke={`url(#g-${gid})`}
              strokeWidth="18"
              strokeLinecap="round"
              strokeDasharray={`${fillLen} ${trackLen}`}
              filter={`url(#glow-${gid})`}
            />
          ) : null}
        </svg>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-2">
          <CrmStatNumber
            value={display}
            label={label}
            size={long ? 'md' : 'lg'}
            variant="gauge"
            deltaPct={deltaPct}
            invertDelta={invertDelta}
          />
        </div>
      </div>
      {sub ? <p className="mt-3 line-clamp-2 max-w-[220px] text-[11px] font-medium leading-snug text-slate-400">{sub}</p> : null}
    </StatShell>
  );
}

function BlockColumns({
  series,
}: {
  series: { name: string; done: number; pending: number }[];
}) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(1, ...series.map((s) => s.done + s.pending), 6);
  const slots = Math.min(8, Math.max(5, max));
  return (
    <div className="relative flex h-[148px] items-end justify-around gap-2 px-1">
      {series.map((s) => {
        const total = s.done + s.pending;
        const filled = total > 0 ? Math.max(1, Math.round((total / max) * slots)) : 0;
        const doneN = total ? Math.round((s.done / total) * filled) : 0;
        const pendingN = Math.max(0, filled - doneN);
        const emptyN = slots - filled;
        const active = hover === s.name;
        return (
          <div
            key={s.name}
            className="relative flex min-w-0 flex-1 flex-col items-center gap-1.5"
            onMouseEnter={() => setHover(s.name)}
            onMouseLeave={() => setHover(null)}
          >
            {active ? (
              <div className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-20 w-[160px] -translate-x-1/2">
                <NavyTooltip
                  active
                  label={s.name}
                  payload={[
                    { name: 'Done', value: s.done, color: CHARCOAL },
                    { name: 'Pending', value: s.pending, color: ORANGE },
                  ]}
                />
              </div>
            ) : null}
            <div className="flex h-[118px] w-full max-w-[40px] flex-col-reverse justify-start gap-[4px]">
              {Array.from({ length: doneN }).map((_, i) => (
                <div key={`d-${i}`} className="h-[12px] w-full rounded-md bg-[#334155]" />
              ))}
              {Array.from({ length: pendingN }).map((_, i) => (
                <div key={`p-${i}`} className="h-[12px] w-full rounded-md bg-[#F97316]" />
              ))}
              {Array.from({ length: emptyN }).map((_, i) => (
                <div key={`e-${i}`} className="h-[12px] w-full rounded-md bg-[#E8EEF4]" />
              ))}
            </div>
            <span className="truncate text-[11px] font-medium text-slate-500">{s.name}</span>
          </div>
        );
      })}
    </div>
  );
}

type Props = { overview: CrmOverview | null };

export function CrmTeamIntelligence({ overview }: Props) {
  const { openDrillDown } = useCrmDashboard();
  const metrics = useMemo(() => buildCrmTeamStatsWithInfo(overview), [overview]);
  const byKey = (key: string) => metrics.find((m) => m.key === key);
  const open = (m?: CrmComboMetric) => {
    if (!m?.href) return;
    openDrillDown(buildKpiDrillDown(overview, m.key, m.label, m.href));
  };

  const overdue = byKey('teamOverdue');
  const completion = byKey('avgCompletion');
  const closer = byKey('topCloser');
  const coverage = byKey('leadCoverage');
  const outreach = byKey('outreachRate');
  const volume = byKey('activityLoad');
  const load = byKey('teamLoad');
  const revenue = byKey('revenuePerRep');

  const leads = overview?.leadsTable || [];
  const unassigned = leads.filter((l) => !l.assignee || /unassigned/i.test(String(l.assignee))).length;
  const owned = Math.max(0, leads.length - unassigned);

  const lb = overview?.leaderboard || [];
  const closers = [...lb]
    .sort((a, b) => (b.conversions || 0) - (a.conversions || 0))
    .slice(0, 10)
    .map((r) => ({
      name: String(r.name || '?').split(/\s+/)[0],
      value: r.conversions || 0,
      leads: r.assignedLeads || 0,
    }));
  const closerMax = Math.max(1, ...closers.map((c) => c.value));
  const topName = closer?.value || closers[0]?.name || '—';

  const comm = overview?.communication;
  const channels = [
    { name: 'Calls', done: Number(comm?.calls?.completed || 0), pending: Number(comm?.calls?.pending || 0) },
    { name: 'Meetings', done: Number(comm?.meetings?.completed || 0), pending: Number(comm?.meetings?.pending || 0) },
    { name: 'Email', done: Number(comm?.emails?.completed || 0), pending: Number(comm?.emails?.pending || 0) },
    { name: 'WhatsApp', done: Number(comm?.whatsapp?.completed || 0), pending: Number(comm?.whatsapp?.pending || 0) },
  ];
  const doneTotal = channels.reduce((s, c) => s + c.done, 0);
  const pendingTotal = channels.reduce((s, c) => s + c.pending, 0);
  const mixTotal = doneTotal + pendingTotal;

  const overdueN = Number(overdue?.value || 0);
  const overduePct = Math.min(100, overdueN * 5);
  const completePct = completion?.pct ?? 0;
  const ownedPct = coverage?.pct ?? 0;

  const loadRows = [...lb]
    .sort((a, b) => (b.assignedLeads || 0) - (a.assignedLeads || 0))
    .slice(0, 10)
    .map((r) => ({
      name: String(r.name || '?').split(/\s+/)[0],
      leads: r.assignedLeads || 0,
      overdue: r.overdueFollowups || 0,
    }));
  const loadMax = Math.max(1, ...loadRows.map((r) => r.leads + r.overdue));

  const spark = useMemo(() => {
    const rows = overview?.leadSpark || [];
    return rows.map((d, i) => ({
      label: d.label,
      value: Number(d.value || 0),
      prev: i > 0 ? Number(rows[i - 1]?.value || 0) : Number(d.value || 0),
    }));
  }, [overview?.leadSpark]);

  return (
    <div className="space-y-4">
      <section>
        <div className="mb-2.5">
          <h2 className="text-[15px] font-bold text-slate-900">Team overview</h2>
          <p className="text-[12px] font-medium text-slate-400">Performance, ownership & completion</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatShell onClick={() => open(overdue)} info={overdue?.info} className={CARD_COMPACT}>
            <p className="text-[11px] font-medium text-slate-500">Team overdue</p>
            <CrmStatNumber className="mt-1.5" value={overdue?.value || '0'} label="open" invertDelta />
            <div className="mt-2.5">
              <FillBar pct={overduePct} color={ORANGE} height={10} />
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-slate-400">{overdue?.sub}</p>
          </StatShell>

          <StatShell onClick={() => open(completion)} info={completion?.info} className={CARD_COMPACT}>
            <p className="text-[11px] font-medium text-slate-500">Avg completion</p>
            <CrmStatNumber className="mt-1.5" value={completion?.value || '0%'} label="done" />
            <div className="mt-2.5">
              <FillBar pct={completePct} color={ORANGE} height={10} />
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-slate-400">{completion?.sub}</p>
          </StatShell>

          <StatShell onClick={() => open(coverage)} info={coverage?.info} className={CARD_COMPACT}>
            <p className="text-[11px] font-medium text-slate-500">Lead ownership</p>
            <CrmStatNumber className="mt-1.5" value={`${ownedPct}%`} label="owned" />
            <div className="mt-2.5">
              <SegmentedBar
                height={10}
                parts={[
                  { value: owned, color: CHARCOAL },
                  { value: unassigned, color: ORANGE },
                ]}
              />
            </div>
            <div className="mt-2 flex items-center gap-3 text-[11px] font-medium text-slate-500">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-[#334155]" />
                Owned {formatNum(owned)}
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-[#F97316]" />
                Open {formatNum(unassigned)}
              </span>
            </div>
          </StatShell>
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-12 xl:items-stretch">
        <section className={`${CARD_PAD} xl:col-span-7`}>
          <div className="mb-1 flex items-start justify-between gap-2">
            <div>
              <h3 className="text-[13px] font-bold text-slate-900">Outreach mix</h3>
              <p className="text-[11px] font-medium text-slate-400">Done vs pending by channel</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-medium text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-[#334155]" /> Done
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-[#F97316]" /> Pending
              </span>
            </div>
          </div>
          <BlockColumns series={channels} />
          {spark.length > 1 ? (
            <div className="mt-2">
              <CrmStatNumber
                value={formatNum(spark[spark.length - 1]?.value)}
                label="inflow"
                size="sm"
                deltaPct={sparkDelta(spark)}
                spark={sparkValues(spark)}
              />
              <div className="mt-1 h-[56px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={spark} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
                  <XAxis dataKey="label" hide />
                  <Tooltip content={<NavyTooltip />} cursor={{ stroke: '#94A3B8', strokeWidth: 1 }} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    name="Leads"
                    stroke={ORANGE}
                    strokeWidth={1.75}
                    fill="rgba(249,115,22,0.14)"
                    activeDot={{ r: 4, fill: ORANGE, stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
              </div>
            </div>
          ) : null}
        </section>

        <div className="grid min-h-0 gap-3 xl:col-span-5 xl:grid-rows-[auto_minmax(240px,1fr)]">
          <section className="relative shrink-0 rounded-[1.25rem] border border-slate-100/80 bg-white p-3 shadow-[0_14px_40px_-28px_rgba(15,23,42,0.22)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-[13px] font-bold text-slate-900">Queue health</h3>
                <p className="text-[11px] font-medium text-slate-400">Completed vs still open</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <span className="rounded-md bg-[#F1F5F9] px-2 py-1 text-[11px] font-semibold tabular-nums text-slate-700">
                  {formatNum(doneTotal)} done
                </span>
                <span className="rounded-md bg-orange-50 px-2 py-1 text-[11px] font-semibold tabular-nums text-orange-700">
                  {formatNum(pendingTotal)} pending
                </span>
              </div>
            </div>
            <div className="mt-2">
              {mixTotal ? (
                <SegmentedBar
                  height={10}
                  parts={[
                    { value: doneTotal, color: CHARCOAL },
                    { value: pendingTotal, color: ORANGE },
                  ]}
                />
              ) : (
                <p className="text-[12px] font-medium text-slate-400">No outreach yet</p>
              )}
            </div>
          </section>
          <CrmTeamLeaderboard overview={overview} className="min-h-[240px]" />
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-2 xl:items-stretch">
        <section className={CARD_PAD}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-[13px] font-bold text-slate-900">Top closer</h3>
              <p className="text-[11px] font-medium text-slate-400">Conversions across the team</p>
            </div>
            <span className="absolute right-3 top-3" onClick={(e) => e.stopPropagation()}>
              {closer?.info ? <HqInfoTip text={closer.info} /> : null}
            </span>
          </div>
          <button
            type="button"
            onClick={() => open(closer)}
            className="mt-3 flex w-full items-center gap-2.5 text-left"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#334155] text-[11px] font-semibold text-white">
              {initials(topName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-bold text-slate-900">{topName}</p>
              <p className="text-[11px] font-medium text-slate-400">{closer?.sub}</p>
            </div>
          </button>
          {closers.length ? (
            <div className="mt-3 flex h-[120px] items-end gap-1.5">
              {closers.map((c) => (
                <div key={c.name} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <p className={`${crmNumFont} text-[10px] font-semibold tabular-nums text-[#0F172A]`}>{c.value}</p>
                  <div
                    className="w-full max-w-[26px] rounded-md shadow-[0_6px_12px_rgba(249,115,22,0.28)]"
                    style={{
                      height: `${Math.max(10, (c.value / closerMax) * 86)}px`,
                      background: 'linear-gradient(180deg, #FB7185 0%, #F97316 52%, #FBBF24 100%)',
                    }}
                    title={`${c.name}: ${c.value} conversions`}
                  />
                  <span className="w-full truncate text-center text-[10px] font-medium text-slate-400">{c.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-[13px] text-slate-400">No team data yet</p>
          )}
        </section>

        <section className={CARD_PAD}>
          <h3 className="text-[13px] font-bold text-slate-900">Load by rep</h3>
          <p className="mb-3 text-[11px] font-medium text-slate-400">Assigned leads vs overdue follow-ups</p>
          {loadRows.length ? (
            <ul className="max-h-[220px] space-y-2.5 overflow-y-auto pr-1">
              {loadRows.map((r) => (
                <li key={r.name}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="text-[12px] font-medium text-slate-500">{r.name}</span>
                    <CrmStatNumber value={formatNum(r.leads)} label="leads" size="sm" />
                  </div>
                  <SegmentedBar
                    height={11}
                    parts={[
                      { value: r.leads, color: CHARCOAL },
                      { value: r.overdue, color: ORANGE },
                      { value: Math.max(0, loadMax - r.leads - r.overdue), color: TRACK },
                    ]}
                  />
                  <p className="mt-1 text-[10px] font-medium text-slate-400">Overdue {formatNum(r.overdue)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-slate-400">No team data yet</p>
          )}
        </section>
      </div>

      <section>
        <div className="mb-2.5">
          <h2 className="text-[15px] font-bold text-slate-900">Workload & revenue</h2>
          <p className="text-[12px] font-medium text-slate-400">Activity, load and pipeline value</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SemiGauge
            display={outreach?.value || '0%'}
            pct={outreach?.pct ?? 0}
            label="Outreach success"
            unit="rate"
            sub={outreach?.sub}
            info={outreach?.info}
            tone={toneFromMetric(outreach)}
            onClick={() => open(outreach)}
          />
          <SemiGauge
            display={volume?.value || '0'}
            pct={volume?.pct ?? 0}
            label="Outreach activity"
            unit="logged"
            sub={volume?.sub}
            info={volume?.info}
            tone={toneFromMetric(volume)}
            onClick={() => open(volume)}
          />
          <SemiGauge
            display={load?.value || '—'}
            pct={load?.pct ?? 0}
            label="Leads per rep"
            unit="leads"
            sub={load?.sub}
            info={load?.info}
            tone={toneFromMetric(load)}
            onClick={() => open(load)}
          />
          <SemiGauge
            display={revenue?.value || '—'}
            pct={revenue?.pct ?? 0}
            label="Revenue / rep"
            unit="per rep"
            sub={revenue?.sub}
            info={revenue?.info}
            tone={toneFromMetric(revenue)}
            onClick={() => open(revenue)}
          />
        </div>
      </section>
    </div>
  );
}
