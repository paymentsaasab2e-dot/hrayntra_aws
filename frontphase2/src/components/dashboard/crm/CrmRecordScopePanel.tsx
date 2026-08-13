'use client';

import React from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Mail,
  MessageCircle,
  Phone,
  PhoneCall,
  UserRound,
  Users,
  AlertTriangle,
  Clock3,
  TrendingUp,
} from 'lucide-react';
import type { CrmOverview } from '@/lib/dashboard/api';
import { HqInfoTip } from '@/components/hq/analytics/HqPhase2DashboardParts';
import { dashCard, formatMoney, formatNum, relativeTime } from './crmShared';

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
  if (/convert|won|active|hot/.test(s)) return 'bg-emerald-50 text-emerald-800 ring-emerald-200/80';
  if (/qualif|proposal|negotiat/.test(s)) return 'bg-amber-50 text-amber-800 ring-amber-200/80';
  if (/contact|progress|open/.test(s)) return 'bg-blue-50 text-blue-800 ring-blue-200/80';
  if (/new|prospect/.test(s)) return 'bg-slate-100 text-slate-700 ring-slate-200/80';
  if (/lost|cold|inactive|hold/.test(s)) return 'bg-rose-50 text-rose-700 ring-rose-200/80';
  return 'bg-violet-50 text-violet-800 ring-violet-200/80';
}

function stageProgress(status?: string) {
  const s = String(status || '').toLowerCase();
  if (/convert|won/.test(s)) return 100;
  if (/negotiat/.test(s)) return 85;
  if (/proposal/.test(s)) return 70;
  if (/qualif/.test(s)) return 55;
  if (/contact/.test(s)) return 35;
  if (/new/.test(s)) return 15;
  if (/lost|inactive|cold/.test(s)) return 5;
  return 40;
}

function formatWhen(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatTile({
  label,
  value,
  sub,
  tone = 'slate',
  info,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: 'slate' | 'blue' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'teal';
  info?: string;
}) {
  const tones = {
    slate: 'from-slate-50 to-white ring-slate-100',
    blue: 'from-blue-50/80 to-white ring-blue-100',
    emerald: 'from-emerald-50/80 to-white ring-emerald-100',
    amber: 'from-amber-50/80 to-white ring-amber-100',
    rose: 'from-rose-50/80 to-white ring-rose-100',
    indigo: 'from-indigo-50/80 to-white ring-indigo-100',
    teal: 'from-teal-50/80 to-white ring-teal-100',
  };
  return (
    <div className={`rounded-xl bg-gradient-to-b p-3.5 ring-1 ${tones[tone]}`}>
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
        {info ? <HqInfoTip text={info} /> : null}
      </p>
      <p className="mt-1 text-lg font-bold tabular-nums tracking-tight text-slate-900">{value}</p>
      {sub ? <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-500">{sub}</p> : null}
    </div>
  );
}

function ChannelChip({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 ring-1 ${tone}`}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/80">
        <Icon size={15} />
      </span>
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wide opacity-70">{label}</p>
        <p className="text-base font-bold tabular-nums">{formatNum(value)}</p>
      </div>
    </div>
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
  const progress = stageProgress(row.status);
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
  const followupsLogged = Number(breakdown.followups || 0);
  const totalTouch = Number(lead?.totalMeetings || calls + meetings + emails + whatsapp + followupsLogged);

  const relatedAlerts = (overview?.alerts || []).filter((a) => {
    const t = String(a.text || '').toLowerCase();
    return t.includes(name.toLowerCase().slice(0, 12));
  });

  const converted = /convert|won/i.test(status);
  const href = String(row.href || (isLead ? '/leads' : '/client'));

  // People working: assignee + anyone mentioned in activity for this record
  const workers = new Set<string>();
  if (assignee && !/unassigned/i.test(assignee)) workers.add(assignee);
  (overview?.activityTimeline || []).forEach((a) => {
    const label = String(a.label || '').toLowerCase();
    const detail = String(a.detail || '').toLowerCase();
    if (label.includes(name.toLowerCase().slice(0, 10)) || detail.includes(name.toLowerCase().slice(0, 10))) {
      if (a.performer) workers.add(a.performer);
    }
  });

  const lastAction = (overview?.activityTimeline || []).find((a) => {
    const blob = `${a.label || ''} ${a.detail || ''}`.toLowerCase();
    return blob.includes(name.toLowerCase().slice(0, 10));
  });

  return (
    <section className={`${dashCard} relative overflow-hidden`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500/70 via-blue-400/50 to-teal-400/50" />

      {/* Header — HQ-style scope banner */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50/90 via-white to-blue-50/30 px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/10 text-sm font-bold text-blue-700 ring-1 ring-blue-100">
            {initials(name)}
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600/80">
              Scoped {isLead ? 'lead' : 'client'} · detail view
            </p>
            <h2 className="truncate text-lg font-bold tracking-tight text-slate-900">{name}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ring-1 ${statusTone(status)}`}>
                {status}
              </span>
              {lead?.source ? (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
                  Source · {lead.source}
                </span>
              ) : null}
              {client?.industry ? (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
                  {client.industry}
                </span>
              ) : null}
              {isOverdue ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-semibold text-rose-700 ring-1 ring-rose-100">
                  <Clock3 size={10} /> Follow-up overdue
                </span>
              ) : null}
            </div>
            <p className="mt-1 truncate text-[11px] text-slate-400">
              {[lead?.contact || lead?.email, lead?.phone, client?.location].filter(Boolean).join(' · ') ||
                'No contact details'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={href}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Open record
          </Link>
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Clear scope
          </button>
        </div>
      </div>

      <div className="space-y-5 p-5">
        {/* Progress */}
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
              Overall completion
              <HqInfoTip text="Estimated from pipeline stage (New → Contacted → Qualified → Converted)." />
            </p>
            <span className="text-sm font-bold tabular-nums text-slate-900">{progress}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-teal-400 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* KPI tiles */}
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {isLead ? (
            <>
              <StatTile
                label="Source"
                value={lead?.source || 'Unknown'}
                sub="Acquisition channel"
                tone="indigo"
                info="Where this lead came from."
              />
              <StatTile
                label="People on it"
                value={workers.size || 1}
                sub={[...workers].slice(0, 3).join(', ') || assignee}
                tone="blue"
                info="Assignee plus teammates seen on related activity."
              />
              <StatTile
                label="Touchpoints"
                value={totalTouch}
                sub={
                  totalTouch
                    ? `${calls} calls · ${meetings} meets · ${emails} email · ${whatsapp} WA`
                    : 'No outreach logged yet'
                }
                tone={totalTouch ? 'teal' : 'amber'}
                info="Sum of calls, meetings, emails, WhatsApp and follow-ups on this lead."
              />
              <StatTile
                label="Conversion"
                value={converted ? 'Converted' : status}
                sub={converted ? 'Won from pipeline' : 'Still in pipeline'}
                tone={converted ? 'emerald' : 'slate'}
                info="Whether this lead has reached Converted / Won."
              />
            </>
          ) : (
            <>
              <StatTile
                label="Revenue"
                value={formatMoney(Number(client?.value || 0))}
                sub="Recorded client value"
                tone="emerald"
                info="Business value stored on this client record."
              />
              <StatTile
                label="Owner"
                value={assignee.split(/\s+/)[0] || '—'}
                sub={assignee}
                tone="blue"
                info="Primary owner of this client account."
              />
              <StatTile
                label="Follow-up"
                value={isOverdue ? 'Overdue' : nextFollowUp ? 'Scheduled' : 'None'}
                sub={formatWhen(nextFollowUp)}
                tone={isOverdue ? 'rose' : nextFollowUp ? 'amber' : 'slate'}
                info="Next scheduled follow-up for this client."
              />
              <StatTile
                label="Alerts"
                value={relatedAlerts.length}
                sub={relatedAlerts.length ? relatedAlerts[0].text : 'No scoped alerts'}
                tone={relatedAlerts.length ? 'rose' : 'emerald'}
                info="CRM alerts that mention this client."
              />
            </>
          )}
        </div>

        {/* Channel breakdown — leads */}
        {isLead ? (
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Outreach done
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <ChannelChip
                icon={PhoneCall}
                label="Calls"
                value={calls}
                tone="bg-blue-50 text-blue-700 ring-blue-100"
              />
              <ChannelChip
                icon={Users}
                label="Meetings"
                value={meetings}
                tone="bg-indigo-50 text-indigo-700 ring-indigo-100"
              />
              <ChannelChip
                icon={Mail}
                label="Emails"
                value={emails}
                tone="bg-violet-50 text-violet-700 ring-violet-100"
              />
              <ChannelChip
                icon={MessageCircle}
                label="WhatsApp"
                value={whatsapp}
                tone="bg-emerald-50 text-emerald-700 ring-emerald-100"
              />
            </div>
          </div>
        ) : null}

        {/* Timeline / last action / next */}
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
              <UserRound size={13} className="text-blue-500" />
              Owner
            </p>
            <p className="text-sm font-bold text-slate-900">{assignee}</p>
            <p className="mt-1 text-[11px] text-slate-400">
              {workers.size > 1 ? `${workers.size} people involved` : 'Primary assignee'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
              <CheckCircle2 size={13} className="text-emerald-500" />
              Last action
            </p>
            <p className="text-sm font-bold text-slate-900">
              {lastAction?.label || (lastActivity ? 'Activity logged' : 'No recent action')}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              {lastAction?.performer
                ? `By ${lastAction.performer} · ${relativeTime(lastAction.at)}`
                : lastActivity
                  ? relativeTime(lastActivity)
                  : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
              {isOverdue ? (
                <AlertTriangle size={13} className="text-rose-500" />
              ) : (
                <Clock3 size={13} className="text-amber-500" />
              )}
              Next follow-up
            </p>
            <p className="text-sm font-bold text-slate-900">
              {nextFollowUp ? formatWhen(nextFollowUp) : 'Not scheduled'}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              {isOverdue ? 'Overdue — needs action' : nextFollowUp ? 'Scheduled' : 'Set a next step'}
            </p>
          </div>
        </div>

        {/* Client extras / lead value */}
        <div className="grid gap-2.5 sm:grid-cols-3">
          {isLead ? (
            <>
              <StatTile
                label="Lead value"
                value={formatMoney(Number(lead?.value || 0))}
                sub="Estimated deal value"
                tone="emerald"
              />
              <StatTile
                label="Priority"
                value={String(lead?.priority || 'Unset')}
                sub="Tagged priority"
                tone="amber"
              />
              <StatTile
                label="Follow-ups logged"
                value={followupsLogged}
                sub="In meetings breakdown"
                tone="blue"
              />
            </>
          ) : (
            <>
              <StatTile
                label="Location"
                value={String(client?.location || '—')}
                sub="Account location"
                tone="slate"
              />
              <StatTile
                label="Last touch"
                value={lastActivity ? relativeTime(lastActivity) : '—'}
                sub={formatWhen(lastActivity)}
                tone="teal"
              />
              <StatTile
                label="Status health"
                value={/active|hot/i.test(status) ? 'Healthy' : status}
                sub="Account status label"
                tone={/active|hot/i.test(status) ? 'emerald' : 'amber'}
              />
            </>
          )}
        </div>

        {relatedAlerts.length ? (
          <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-rose-700">
              <AlertTriangle size={13} />
              Alerts for this record
            </p>
            <ul className="space-y-1.5">
              {relatedAlerts.slice(0, 4).map((a) => (
                <li key={a.id} className="text-[12px] text-rose-800">
                  {a.text}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {converted && isLead ? (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-[12px] font-medium text-emerald-800">
            <TrendingUp size={14} />
            This lead has converted — open Clients to find the account record.
          </div>
        ) : null}
      </div>
    </section>
  );
}
