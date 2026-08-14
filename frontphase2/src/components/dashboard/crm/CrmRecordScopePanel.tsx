'use client';

import React from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowUpRight, TrendingUp, X } from 'lucide-react';
import type { CrmOverview } from '@/lib/dashboard/api';
import { dashCard, formatMoney, formatNum, relativeTime } from './crmShared';
import { CrmStatNumber } from './crmStatNumber';

type LeadRow = NonNullable<CrmOverview['leadsTable']>[number];
type ClientRow = NonNullable<CrmOverview['clientsTable']>[number];

export type CrmScopedRecord =
  | { kind: 'lead'; row: LeadRow }
  | { kind: 'client'; row: ClientRow };

function initials(name: string) {
  const parts = String(name || '?')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function statusTone(status: string) {
  const s = status.toLowerCase();
  if (/convert|won|active|hot/.test(s)) return 'bg-emerald-50 text-emerald-800';
  if (/qualif|proposal|negotiat/.test(s)) return 'bg-amber-50 text-amber-800';
  if (/contact|progress|open/.test(s)) return 'bg-blue-50 text-blue-800';
  if (/new|prospect/.test(s)) return 'bg-slate-100 text-slate-700';
  if (/lost|cold|inactive|hold/.test(s)) return 'bg-rose-50 text-rose-700';
  return 'bg-violet-50 text-violet-800';
}

function formatDay(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function recencyScore(iso?: string | null, max = 25) {
  if (!iso) return 0;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return 0;
  const days = Math.round((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 7) return max;
  if (days <= 14) return Math.round(max * 0.72);
  if (days <= 30) return Math.round(max * 0.4);
  if (days <= 45) return Math.round(max * 0.16);
  return 0;
}

type HealthDriver = {
  label: string;
  value: string;
  hint?: string;
  score: number;
  max: number;
};

function recordHealth(opts: {
  lastContactAt?: string | null;
  lastContactBy?: string | null;
  lastTask?: string | null;
  lastTaskBy?: string | null;
  lastTaskAt?: string | null;
  nextFollowUp?: string | null;
  isOverdue: boolean;
  totalTouch: number;
}): { score: number; drivers: HealthDriver[] } {
  const contactPts = recencyScore(opts.lastContactAt, 50);
  const taskRecency = recencyScore(opts.lastTaskAt || opts.lastContactAt, 25);
  const taskVolume = Math.min(15, opts.totalTouch * 4);
  const taskPts = Math.min(40, taskRecency + taskVolume);
  const fuPts = opts.isOverdue ? 0 : opts.nextFollowUp ? 20 : 6;

  const drivers: HealthDriver[] = [
    {
      label: 'Last contact',
      value: opts.lastContactAt ? relativeTime(opts.lastContactAt) : 'None',
      hint: opts.lastContactBy || undefined,
      score: contactPts,
      max: 50,
    },
    {
      label: 'Last task',
      value: opts.lastTask || (opts.totalTouch ? `${opts.totalTouch} touches` : 'None'),
      hint: [opts.lastTaskBy, opts.totalTouch ? `${opts.totalTouch} logged` : null]
        .filter(Boolean)
        .join(' · ') || undefined,
      score: taskPts,
      max: 40,
    },
    {
      label: 'Follow-up',
      value: opts.isOverdue ? 'Overdue' : opts.nextFollowUp ? formatDay(opts.nextFollowUp) : 'Not set',
      hint: opts.isOverdue ? 'Needs action' : opts.nextFollowUp ? 'Scheduled' : undefined,
      score: fuPts,
      max: 20,
    },
  ];

  return { score: Math.min(100, contactPts + taskPts + fuPts), drivers };
}

function IconBtn({
  children,
  title,
  onClick,
  href,
  dark,
}: {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
  href?: string;
  dark?: boolean;
}) {
  const cls = `inline-flex h-9 w-9 items-center justify-center rounded-full transition ${
    dark
      ? 'bg-slate-900 text-white hover:bg-slate-800'
      : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800'
  }`;
  if (href) {
    return (
      <Link href={href} title={title} aria-label={title} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

const DRIVER_TONE: Record<string, string> = {
  'Last contact': 'bg-sky-50 text-sky-900',
  'Last task': 'bg-indigo-50 text-indigo-900',
  'Follow-up': 'bg-rose-50 text-rose-900',
};

function HealthBlock({ score, drivers }: { score: number; drivers: HealthDriver[] }) {
  const pct = Math.min(100, Math.max(0, score));
  const tone = pct >= 70 ? '#16A34A' : pct >= 40 ? '#D97706' : '#E11D48';
  const label = pct >= 70 ? 'Healthy' : pct >= 40 ? 'Watch' : 'At risk';
  const r = 48;
  const trackLen = Math.PI * r;
  const fillLen = (pct / 100) * trackLen;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative mx-auto h-[96px] w-[140px] shrink-0 sm:mx-0">
        <svg viewBox="0 0 160 96" className="h-full w-full" aria-hidden>
          <path
            d="M 32 84 A 48 48 0 0 1 128 84"
            fill="none"
            stroke="#E2E8F0"
            strokeWidth="12"
            strokeLinecap="round"
          />
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
      <ul className="grid min-w-0 flex-1 gap-2 sm:grid-cols-3">
        {drivers.map((d) => {
          const danger = d.value === 'Overdue';
          const tile =
            d.label === 'Follow-up'
              ? danger
                ? DRIVER_TONE['Follow-up']
                : 'bg-amber-50 text-amber-900'
              : DRIVER_TONE[d.label] || 'bg-slate-50';
          return (
            <li key={d.label} className={`rounded-lg px-3 py-2.5 ${tile}`}>
              <p className="text-[11px] font-medium opacity-70">{d.label}</p>
              <p className={`mt-0.5 text-[15px] font-semibold leading-snug ${danger ? 'text-rose-700' : ''}`}>
                {d.value}
              </p>
              {d.hint ? <p className="mt-0.5 text-[11px] opacity-70">{d.hint}</p> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function LifeTimeline({
  createdAt,
  lastActivity,
  nextFollowUp,
  isOverdue,
}: {
  createdAt?: string | null;
  lastActivity?: string | null;
  nextFollowUp?: string | null;
  isOverdue: boolean;
}) {
  const steps = [
    { label: 'Opened', at: createdAt, done: Boolean(createdAt), risk: false },
    { label: 'Last touch', at: lastActivity, done: Boolean(lastActivity), risk: false },
    {
      label: 'Next follow-up',
      at: nextFollowUp,
      done: Boolean(nextFollowUp) && !isOverdue,
      risk: isOverdue,
    },
  ];
  return (
    <ol className="grid grid-cols-3 gap-2">
      {steps.map((s, i) => (
        <li key={s.label} className="min-w-0 text-center">
          <div className="mb-1.5 flex items-center">
            {i > 0 ? (
              <span className={`h-px flex-1 ${s.done || s.risk ? 'bg-slate-400' : 'bg-slate-200'}`} />
            ) : (
              <span className="flex-1" />
            )}
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                s.risk ? 'bg-rose-500' : s.done ? 'bg-slate-800' : 'bg-slate-300'
              }`}
            />
            {i < steps.length - 1 ? (
              <span
                className={`h-px flex-1 ${steps[i + 1].done || steps[i + 1].risk ? 'bg-slate-400' : 'bg-slate-200'}`}
              />
            ) : (
              <span className="flex-1" />
            )}
          </div>
          <p className="text-[12px] font-medium text-slate-700">{s.label}</p>
          <p className={`mt-0.5 text-[12px] ${s.risk ? 'font-medium text-rose-600' : 'text-slate-500'}`}>
            {s.at ? formatDay(s.at) : '—'}
            {s.risk ? ' · overdue' : ''}
          </p>
        </li>
      ))}
    </ol>
  );
}

type Props = {
  record: CrmScopedRecord;
  overview: CrmOverview | null;
  onClear: () => void;
};

export function CrmRecordScopePanel({ record, overview, onClear }: Props) {
  const isLead = record.kind === 'lead';
  const row = record.row;
  const name = String(row.name || 'Record');
  const status = String(row.status || '—');
  const assignee = String(row.assignee || 'Unassigned');
  const nextFollowUp = row.nextFollowUp ? String(row.nextFollowUp) : null;
  const nextAt = nextFollowUp ? new Date(nextFollowUp) : null;
  const isOverdue =
    nextAt && Number.isFinite(nextAt.getTime()) ? nextAt.getTime() < Date.now() : false;
  const lastActivity = row.lastActivity ? String(row.lastActivity) : null;

  const lead = isLead ? (row as LeadRow) : null;
  const client = !isLead ? (row as ClientRow) : null;
  const breakdown = lead?.meetingsBreakdown || {};
  const calls = Number(breakdown.calls || 0);
  const meetings = Number(breakdown.meetings || 0);
  const emails = Number(breakdown.emails || 0);
  const whatsapp = Number(breakdown.whatsapp || 0);
  const totalTouch = Number(lead?.totalMeetings || calls + meetings + emails + whatsapp);

  const relatedAlerts = (overview?.alerts || []).filter((a) => {
    const t = String(a.text || '').toLowerCase();
    return t.includes(name.toLowerCase().slice(0, 12));
  });

  const converted = /convert|won/.test(status.toLowerCase());
  const href = String(row.href || (isLead ? '/leads' : '/client'));
  const lastAction = (overview?.activityTimeline || []).find((a) => {
    const blob = `${a.label || ''} ${a.detail || ''}`.toLowerCase();
    return blob.includes(name.toLowerCase().slice(0, 10));
  });
  const lastContactAt = lastActivity || (lastAction?.at ? String(lastAction.at) : null);
  const lastContactBy = lastAction?.performer || (assignee && !/unassigned/i.test(assignee) ? assignee : null);

  const health = recordHealth({
    lastContactAt,
    lastContactBy,
    lastTask: lastAction?.label || null,
    lastTaskBy: lastAction?.performer || null,
    lastTaskAt: lastAction?.at ? String(lastAction.at) : lastContactAt,
    nextFollowUp,
    isOverdue,
    totalTouch,
  });

  const outreachCounts = [
    { name: 'Calls', value: calls },
    { name: 'Meetings', value: meetings },
    { name: 'Email', value: emails },
    { name: 'WhatsApp', value: whatsapp },
  ];

  return (
    <section className={`${dashCard} overflow-hidden rounded-2xl`}>
      <header className="flex items-start justify-between gap-3 border-b border-indigo-100 bg-indigo-50/50 px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[13px] font-semibold text-indigo-800">
            {initials(name)}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-indigo-600/80">{isLead ? 'Lead' : 'Client'}</p>
            <h2 className="truncate text-lg font-semibold tracking-tight text-slate-900">{name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusTone(status)}`}>
                {status}
              </span>
              {lead?.priority ? (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                  {lead.priority}
                </span>
              ) : null}
              <span className="truncate text-[12px] text-slate-500">
                {[lead?.contact || lead?.email, lead?.phone, client?.location].filter(Boolean).join(' · ') ||
                  'No contact details'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <IconBtn href={href} title="Go to record" dark>
            <ArrowUpRight size={16} />
          </IconBtn>
          <IconBtn title="Clear" onClick={onClear}>
            <X size={16} />
          </IconBtn>
        </div>
      </header>

      <div className="space-y-4 px-5 py-4">
        <section>
          <h3 className="mb-2 text-[12px] font-medium text-slate-500">Health</h3>
          <HealthBlock score={health.score} drivers={health.drivers} />
        </section>

        <section>
          <h3 className="mb-2 text-[12px] font-medium text-slate-500">Timeline</h3>
          <LifeTimeline
            createdAt={row.createdAt ? String(row.createdAt) : null}
            lastActivity={lastActivity}
            nextFollowUp={nextFollowUp}
            isOverdue={isOverdue}
          />
        </section>

        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-medium text-slate-500">Owner</p>
            <p className="mt-0.5 text-[14px] font-semibold text-slate-900">{assignee}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-medium text-slate-500">Source</p>
            <p className="mt-0.5 text-[14px] font-semibold text-slate-900">
              {lead?.source || client?.industry || '—'}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-medium text-slate-500">Value</p>
            <CrmStatNumber
              className="mt-0.5"
              value={formatMoney(Number((isLead ? lead?.value : client?.value) || 0))}
              label="value"
              size="sm"
            />
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-medium text-slate-500">{isLead ? 'Priority' : 'Location'}</p>
            <p className="mt-0.5 text-[14px] font-semibold text-slate-900">
              {isLead ? String(lead?.priority || '—') : String(client?.location || '—')}
            </p>
          </div>
        </section>

        {isLead ? (
          <section>
            <h3 className="mb-2 text-[12px] font-medium text-slate-500">Outreach</h3>
            <div className="grid grid-cols-4 gap-2">
              {outreachCounts.map((d) => (
                <div key={d.name} className="rounded-lg bg-indigo-50/60 px-3 py-2">
                  <p className="text-[11px] font-medium text-slate-500">{d.name}</p>
                  <CrmStatNumber className="mt-0.5" value={formatNum(d.value)} label={d.name.toLowerCase()} size="sm" />
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {relatedAlerts.length ? (
          <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-rose-700">
              <AlertTriangle size={14} />
              Alerts
            </p>
            <ul className="space-y-1">
              {relatedAlerts.slice(0, 3).map((a) => (
                <li key={a.id} className="text-[13px] text-rose-800">
                  {a.text}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {converted && isLead ? (
          <p className="flex items-center gap-2 text-[13px] font-medium text-emerald-700">
            <TrendingUp size={15} />
            Converted — go to Clients to find the account.
          </p>
        ) : null}
      </div>
    </section>
  );
}
