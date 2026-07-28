'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { CrmOverview } from '@/lib/dashboard/api';
import { crmCard, formatInr, formatNum, relativeTime, useCrmDashboard } from './crmShared';
import {
  buildClientSliceDrillDown,
  buildLeadSliceDrillDown,
  mapClientDrillRows,
  mapLeadDrillRows,
} from './crmDrillDown';

const COLORS = ['#2563EB', '#059669', '#D97706', '#7C3AED', '#E11D48', '#0891B2', '#4F46E5', '#64748B'];

function formatDateTime(iso?: string | null) {
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

type Props = { overview: CrmOverview | null; loading?: boolean };

function PieBlock({
  title,
  subtitle,
  data,
  center,
  centerLabel = 'Total',
  onSliceClick,
}: {
  title: string;
  subtitle?: string;
  data: Array<{ name: string; value: number }>;
  center?: string;
  centerLabel?: string;
  onSliceClick?: (sliceName: string) => void;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;

  return (
    <div
      className={`${crmCard} group relative overflow-hidden p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(15,23,42,0.08)]`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500/80 via-indigo-400/60 to-emerald-400/50 opacity-80" />

      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[13px] font-semibold tracking-tight text-slate-900">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-[11px] text-slate-400">{subtitle}</p> : null}
        </div>
        <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500 ring-1 ring-slate-100">
          {data.length} segments
        </span>
      </div>

      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
        <div className="relative h-[148px] w-[148px] shrink-0">
          {data.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={46}
                  outerRadius={68}
                  paddingAngle={3}
                  cornerRadius={4}
                  stroke="#fff"
                  strokeWidth={2}
                  onClick={(entry: { name?: string }) => {
                    if (entry?.name && onSliceClick) onSliceClick(String(entry.name));
                  }}
                  className={onSliceClick ? 'cursor-pointer' : undefined}
                >
                  {data.map((_, i) => (
                    <Cell
                      key={i}
                      fill={COLORS[i % COLORS.length]}
                      className="outline-none transition-opacity hover:opacity-90"
                    />
                  ))}
                </Pie>
                <Tooltip
                  cursor={false}
                  formatter={(v: number, name: string) => [
                    `${v} (${((Number(v) / total) * 100).toFixed(1)}%)`,
                    name,
                  ]}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
                    fontSize: 12,
                    padding: '8px 10px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-full bg-slate-50 text-xs text-slate-400 ring-1 ring-slate-100">
              No data
            </div>
          )}
          {center ? (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-2xl font-bold tracking-tight text-slate-900">{center}</p>
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                {centerLabel}
              </p>
            </div>
          ) : null}
        </div>

        <ul className="min-w-0 flex-1 space-y-2.5">
          {data.length ? (
            data.map((d, i) => {
              const pct = (d.value / total) * 100;
              return (
                <li key={d.name} className="group/item">
                  <button
                    type="button"
                    onClick={() => onSliceClick?.(d.name)}
                    className={`mb-1 flex w-full items-center justify-between gap-2 text-left ${
                      onSliceClick ? 'cursor-pointer rounded-lg px-1 py-0.5 hover:bg-slate-50' : ''
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2 text-[12px] font-medium text-slate-700">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white"
                        style={{ background: COLORS[i % COLORS.length] }}
                      />
                      <span className="truncate">{d.name}</span>
                    </span>
                    <span className="shrink-0 text-[11px] font-semibold tabular-nums text-slate-900">
                      {d.value}
                      <span className="ml-1 font-medium text-slate-400">{pct.toFixed(0)}%</span>
                    </span>
                  </button>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(pct, 2)}%`,
                        background: COLORS[i % COLORS.length],
                      }}
                    />
                  </div>
                </li>
              );
            })
          ) : (
            <li className="text-sm text-slate-400">Nothing to chart yet</li>
          )}
        </ul>
      </div>
    </div>
  );
}

function LeadsClientsTable({ overview }: { overview: CrmOverview | null }) {
  const { openDrillDown } = useCrmDashboard();
  const [mode, setMode] = useState<'leads' | 'clients'>('leads');
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    const source =
      mode === 'leads'
        ? ((overview?.leadsTable || []) as Array<Record<string, unknown>>)
        : ((overview?.clientsTable || []) as Array<Record<string, unknown>>);
    const needle = q.trim().toLowerCase();
    if (!needle) return source;
    return source.filter((r) =>
      [r.name, r.contact, r.email, r.status, r.industry, r.assignee, r.location]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle)),
    );
  }, [overview?.leadsTable, overview?.clientsTable, mode, q]);

  const totalCount =
    mode === 'leads'
      ? overview?.leadsTable?.length || 0
      : overview?.clientsTable?.length || 0;
  const href = mode === 'leads' ? '/leads' : '/client';

  return (
    <section className={`${crmCard} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {mode === 'leads' ? 'All Leads' : 'All Clients'}
            </h3>
            <p className="text-[11px] text-slate-500">
              {rows.length} of {totalCount} records
            </p>
          </div>
          <div
            className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1"
            role="tablist"
            aria-label="Leads or Clients"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'leads'}
              onClick={() => {
                setMode('leads');
                setQ('');
              }}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                mode === 'leads'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Leads
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'clients'}
              onClick={() => {
                setMode('clients');
                setQ('');
              }}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                mode === 'clients'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Clients
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={mode === 'leads' ? 'Filter leads…' : 'Filter clients…'}
            className="h-9 w-44 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20"
          />
          <Link href={href} className="text-xs font-semibold text-blue-600 hover:underline">
            View all →
          </Link>
        </div>
      </div>
      <div className="max-h-[28rem] overflow-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-2.5 font-semibold">Name</th>
              {mode === 'leads' ? <th className="px-3 py-2.5 font-semibold">Contact</th> : null}
              <th className="px-3 py-2.5 font-semibold">Status</th>
              <th className="px-3 py-2.5 font-semibold">Industry</th>
              <th className="px-3 py-2.5 font-semibold">Assignee</th>
              {mode === 'clients' ? <th className="px-3 py-2.5 font-semibold">Value</th> : null}
              <th className="px-3 py-2.5 font-semibold">Last Activity</th>
              <th className="px-3 py-2.5 font-semibold">Next Follow-up</th>
              <th className="px-4 py-2.5 font-semibold">Location</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr
                  key={`${mode}-${String(row.id)}`}
                  className="cursor-pointer border-t border-slate-100 hover:bg-blue-50/40"
                  onClick={() =>
                    openDrillDown({
                      title: String(row.name || 'Record'),
                      href: String(row.href || href),
                      rows:
                        mode === 'leads'
                          ? mapLeadDrillRows([
                              row as unknown as NonNullable<CrmOverview['leadsTable']>[number],
                            ])
                          : mapClientDrillRows([
                              row as unknown as NonNullable<CrmOverview['clientsTable']>[number],
                            ]),
                    })
                  }
                >
                  <td className="px-4 py-2.5 font-semibold text-slate-800">
                    {String(row.name || '—')}
                  </td>
                  {mode === 'leads' ? (
                    <td className="px-3 py-2.5 text-slate-600">{String(row.contact || '—')}</td>
                  ) : null}
                  <td className="px-3 py-2.5">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                      {String(row.status || '—')}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{String(row.industry || '—')}</td>
                  <td className="px-3 py-2.5 text-slate-600">{String(row.assignee || '—')}</td>
                  {mode === 'clients' ? (
                    <td className="px-3 py-2.5 font-medium text-slate-800">
                      {formatInr(Number(row.value || 0))}
                    </td>
                  ) : null}
                  <td className="px-3 py-2.5 text-slate-600">
                    <span className="block text-[12px]">
                      {formatDateTime(row.lastActivity ? String(row.lastActivity) : null)}
                    </span>
                    {row.lastActivity ? (
                      <span
                        className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          (() => {
                            const days = Math.round(
                              (Date.now() - new Date(String(row.lastActivity)).getTime()) /
                                (24 * 60 * 60 * 1000),
                            );
                            if (days <= 7) return 'bg-emerald-50 text-emerald-700';
                            if (days <= 30) return 'bg-amber-50 text-amber-700';
                            return 'bg-rose-50 text-rose-700';
                          })()
                        }`}
                      >
                        {relativeTime(String(row.lastActivity))}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">
                    {row.nextFollowUp ? (
                      (() => {
                        const nextAt = new Date(String(row.nextFollowUp));
                        const isOverdue =
                          Number.isFinite(nextAt.getTime()) && nextAt.getTime() < Date.now();
                        return (
                          <div className="flex flex-col items-start gap-1">
                            <span className="text-[12px]">{formatDateTime(String(row.nextFollowUp))}</span>
                            {isOverdue ? (
                              <span className="inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 ring-1 ring-rose-100">
                                Overdue
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 ring-1 ring-sky-100">
                                Upcoming
                              </span>
                            )}
                          </div>
                        );
                      })()
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{String(row.location || '—')}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={mode === 'leads' ? 8 : 8} className="px-4 py-10 text-center text-slate-400">
                  No {mode} found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function CrmChartsAndTables({ overview, loading }: Props) {
  const { openDrillDown } = useCrmDashboard();
  const leadPie =
    overview?.leadStagePie?.length
      ? overview.leadStagePie
      : (overview?.leadStatusBars || []).map((r) => ({ name: r.name, value: r.value }));

  const clientPie =
    overview?.clientStatusPie?.length
      ? overview.clientStatusPie
      : [
          { name: 'Active', value: Number(overview?.kpis?.activeClients || 0) },
          { name: 'Inactive', value: Number(overview?.kpis?.inactiveClients || 0) },
          { name: 'On Hold', value: Number(overview?.kpis?.onHoldClients || 0) },
          { name: 'Prospect', value: Number(overview?.kpis?.prospectClients || 0) },
        ].filter((x) => x.value > 0);

  const sourcePie = overview?.leadSources || [];

  if (loading && !overview) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-2xl bg-white" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <PieBlock
          title="Lead Stages"
          subtitle="Click a stage to view matching leads"
          data={leadPie}
          center={formatNum(overview?.kpis?.totalLeads)}
          centerLabel="Leads"
          onSliceClick={(name) => openDrillDown(buildLeadSliceDrillDown(overview, name, 'status'))}
        />
        <PieBlock
          title="Client Status"
          subtitle="Click a status to view matching clients"
          data={clientPie}
          center={formatNum(overview?.kpis?.totalClients)}
          centerLabel="Clients"
          onSliceClick={(name) => openDrillDown(buildClientSliceDrillDown(overview, name))}
        />
        <PieBlock
          title="Lead Sources"
          subtitle="Click a source to view matching leads"
          data={sourcePie}
          center={formatNum(sourcePie.reduce((s, d) => s + Number(d.value || 0), 0))}
          centerLabel="Sources"
          onSliceClick={(name) => openDrillDown(buildLeadSliceDrillDown(overview, name, 'source'))}
        />
      </div>

      <LeadsClientsTable overview={overview} />
    </div>
  );
}

