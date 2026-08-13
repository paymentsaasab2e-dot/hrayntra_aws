'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Mail, RefreshCw, Search, Ticket } from 'lucide-react';
import {
  apiHqListHelpTickets,
  apiHqListTickets,
  apiHqUpdateHelpTicket,
  apiHqUpdateTicket,
  type HqHelpTicketStatus,
  type HqSupportTicketStatus,
} from '@/lib/api';

type Audience = 'employee' | 'employer';

type UnifiedTicket = {
  id: string;
  subject: string;
  description: string;
  name: string;
  email: string;
  category: string;
  status: string;
  createdAt: string | null;
  meta?: string;
  priority?: string;
  userId?: string | null;
  audience: Audience;
};

type UnifiedStats = {
  total: number;
  open: number;
  inProgress: number;
  closed: number;
  resolved?: number;
  highPriority?: number;
};

const EMPTY_STATS: UnifiedStats = {
  total: 0,
  open: 0,
  inProgress: 0,
  closed: 0,
  resolved: 0,
  highPriority: 0,
};

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-sky-50 text-sky-700 ring-sky-200',
  in_progress: 'bg-amber-50 text-amber-700 ring-amber-200',
  resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  closed: 'bg-slate-100 text-slate-600 ring-slate-200',
};

function labelStatus(status: string) {
  return String(status || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatWhen(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type Props = {
  Panel: React.ComponentType<{ children: React.ReactNode; className?: string }>;
  PanelTitle: React.ComponentType<{ title: string; right?: React.ReactNode }>;
  /** When set (from Employees / Employers nav), lock queue and hide audience toggle. */
  lockedAudience?: Audience;
};

export function HqCrmHelpTicketsPanel({ Panel, PanelTitle, lockedAudience }: Props) {
  const [audience, setAudience] = useState<Audience>(lockedAudience || 'employee');
  const [tickets, setTickets] = useState<UnifiedTicket[]>([]);
  const [stats, setStats] = useState<UnifiedStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!lockedAudience) return;
    setAudience(lockedAudience);
    setStatusFilter('');
    setSearch('');
    setSelectedId(null);
    setError('');
  }, [lockedAudience]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (audience === 'employee') {
        const res = await apiHqListHelpTickets(
          statusFilter
            ? { status: statusFilter as HqHelpTicketStatus, limit: 100 }
            : { limit: 100 },
        );
        const list: UnifiedTicket[] = (res.data?.tickets || []).map((t) => ({
          id: t.id,
          subject: t.subject,
          description: t.description,
          name: t.name,
          email: t.email,
          category: t.category || '—',
          status: t.status,
          createdAt: t.createdAt || null,
          meta: t.problemId || undefined,
          userId: t.userId || null,
          audience: 'employee' as const,
        }));
        setTickets(list);
        setStats({
          total: res.data?.stats?.total ?? list.length,
          open: res.data?.stats?.open ?? list.filter((x) => x.status === 'open').length,
          inProgress:
            res.data?.stats?.inProgress ?? list.filter((x) => x.status === 'in_progress').length,
          closed: res.data?.stats?.closed ?? list.filter((x) => x.status === 'closed').length,
        });
        setSelectedId((prev) => {
          if (prev && list.some((t) => t.id === prev)) return prev;
          return list[0]?.id || null;
        });
      } else {
        const res = await apiHqListTickets(statusFilter ? { status: statusFilter } : undefined);
        const list: UnifiedTicket[] = (res.data?.tickets || []).map((t) => ({
          id: t.id,
          subject: t.subject,
          description: t.description,
          name: t.raisedByName || t.organizationName || '—',
          email: t.raisedByEmail || '',
          category: t.category || '—',
          status: t.status,
          createdAt: t.createdAt,
          meta: t.organizationName || t.tenantDbName || undefined,
          priority: t.priority,
          userId: t.raisedByUserId || null,
          audience: 'employer' as const,
        }));
        setTickets(list);
        setStats({
          total: res.data?.stats?.total ?? list.length,
          open: res.data?.stats?.open ?? 0,
          inProgress: res.data?.stats?.inProgress ?? 0,
          closed: res.data?.stats?.closed ?? 0,
          resolved: res.data?.stats?.resolved ?? 0,
          highPriority: res.data?.stats?.highPriority ?? 0,
        });
        setSelectedId((prev) => {
          if (prev && list.some((t) => t.id === prev)) return prev;
          return list[0]?.id || null;
        });
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load tickets');
      setTickets([]);
      setStats(EMPTY_STATS);
    } finally {
      setLoading(false);
    }
  }, [audience, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const switchAudience = (next: Audience) => {
    if (next === audience) return;
    setAudience(next);
    setStatusFilter('');
    setSearch('');
    setSelectedId(null);
    setError('');
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tickets;
    return tickets.filter((t) => {
      const hay = [t.subject, t.description, t.name, t.email, t.category, t.meta, t.userId, t.id]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [tickets, search]);

  const selected = useMemo(
    () => filtered.find((t) => t.id === selectedId) || filtered[0] || null,
    [filtered, selectedId],
  );

  const updateStatus = async (ticketId: string, status: string) => {
    setUpdatingId(ticketId);
    try {
      if (audience === 'employee') {
        await apiHqUpdateHelpTicket(ticketId, status as HqHelpTicketStatus);
      } else {
        await apiHqUpdateTicket(ticketId, { status: status as HqSupportTicketStatus });
      }
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to update ticket');
    } finally {
      setUpdatingId(null);
    }
  };

  const statusActions =
    audience === 'employee'
      ? ([
          { status: 'open', label: 'Mark open' },
          { status: 'in_progress', label: 'In progress' },
          { status: 'closed', label: 'Close' },
        ] as const)
      : ([
          { status: 'open', label: 'Mark open' },
          { status: 'in_progress', label: 'In progress' },
          { status: 'resolved', label: 'Resolve' },
          { status: 'closed', label: 'Close' },
        ] as const);

  const statCards =
    audience === 'employee'
      ? [
          { label: 'Total', value: stats.total },
          { label: 'Open', value: stats.open },
          { label: 'In progress', value: stats.inProgress },
          { label: 'Closed', value: stats.closed },
        ]
      : [
          { label: 'Total', value: stats.total },
          { label: 'Open', value: stats.open },
          { label: 'In progress', value: stats.inProgress },
          { label: 'Resolved', value: stats.resolved || 0 },
          { label: 'High / Urgent', value: stats.highPriority || 0 },
        ];

  return (
    <section className="mb-2 grid grid-cols-12 items-start gap-4">
      {!lockedAudience ? (
      <div className="col-span-12">
        <div className="inline-flex rounded-2xl border border-slate-200/90 bg-slate-100/80 p-1 shadow-inner">
          {(
            [
              {
                id: 'employee' as const,
                label: 'Employee',
                hint: 'Candidate portal /help',
              },
              {
                id: 'employer' as const,
                label: 'Employer',
                hint: 'Tenant Help Center',
              },
            ] as const
          ).map((opt) => {
            const on = audience === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => switchAudience(opt.id)}
                className={`rounded-xl px-4 py-2 text-left transition ${
                  on
                    ? 'bg-gradient-to-r from-blue-600 via-blue-900 to-emerald-600 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-white/70 hover:text-slate-800'
                }`}
              >
                <span className="block text-[13px] font-semibold">{opt.label}</span>
                <span className={`block text-[10px] ${on ? 'text-white/80' : 'text-slate-400'}`}>
                  {opt.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      ) : null}

      <div
        className={`col-span-12 grid grid-cols-2 gap-3 ${
          audience === 'employer' ? 'sm:grid-cols-3 xl:grid-cols-5' : 'sm:grid-cols-4'
        }`}
      >
        {statCards.map((m) => (
          <div
            key={m.label}
            className="rounded-xl border border-slate-100 bg-white/80 px-3 py-3 text-center shadow-sm"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {m.label}
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{m.value}</p>
          </div>
        ))}
      </div>

      <Panel className="col-span-12 !p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                audience === 'employee'
                  ? 'Search subject, name, email, category…'
                  : 'Search subject, tenant, email…'
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none ring-blue-200 focus:bg-white focus:ring-2"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700"
          >
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            {audience === 'employer' ? <option value="resolved">Resolved</option> : null}
            <option value="closed">Closed</option>
          </select>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </button>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          {audience === 'employee' ? (
            <>
              Employee tickets from candidate portal Help (`/help`) ·{' '}
              <span className="font-mono text-slate-600">/api/hq-tickets</span>
            </>
          ) : (
            <>
              Employer tickets from Phase 2 tenant Help Center ·{' '}
              <span className="font-mono text-slate-600">/hq/tickets</span>
            </>
          )}
        </p>
        {error ? (
          <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </div>
        ) : null}
      </Panel>

      <Panel className="col-span-12 overflow-hidden !p-0 lg:col-span-7">
        <div className="border-b border-slate-100 px-4 py-3">
          <PanelTitle
            title={audience === 'employee' ? 'Employee ticket queue' : 'Employer ticket queue'}
            right={
              <span className="text-[11px] font-medium text-slate-500">
                {filtered.length} shown
              </span>
            }
          />
        </div>
        <div className="max-h-[480px] overflow-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="sticky top-0 bg-slate-50/95 text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-2 font-semibold">Subject</th>
                <th className="px-2 py-2 font-semibold">
                  {audience === 'employee' ? 'User' : 'Raised by'}
                </th>
                <th className="px-2 py-2 font-semibold">
                  {audience === 'employee' ? 'Category' : 'Tenant'}
                </th>
                <th className="px-4 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && tickets.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                    Loading tickets…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                    {audience === 'employee'
                      ? 'No employee help tickets yet. Raise one from portal `/help`.'
                      : 'No employer support tickets yet.'}
                  </td>
                </tr>
              ) : (
                filtered.map((ticket) => (
                  <tr
                    key={ticket.id}
                    onClick={() => setSelectedId(ticket.id)}
                    className={`cursor-pointer border-b border-slate-50 transition last:border-0 hover:bg-slate-50 ${
                      selected?.id === ticket.id ? 'bg-blue-50/70' : 'bg-white'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{ticket.subject}</p>
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        {formatWhen(ticket.createdAt)}
                        {ticket.priority ? ` · ${ticket.priority}` : ''}
                      </p>
                    </td>
                    <td className="px-2 py-3">
                      <p className="truncate font-medium text-slate-800">{ticket.name}</p>
                      <p className="truncate text-[11px] text-slate-500">{ticket.email || '—'}</p>
                    </td>
                    <td className="px-2 py-3 text-slate-600">
                      {audience === 'employee' ? ticket.category : ticket.meta || ticket.category}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${
                          STATUS_STYLES[ticket.status] || STATUS_STYLES.open
                        }`}
                      >
                        {labelStatus(ticket.status)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel className="col-span-12 lg:col-span-5">
        <PanelTitle
          title="Ticket detail"
          right={
            selected ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                <Ticket className="h-3 w-3" />
                {audience === 'employee' ? 'Employee' : 'Employer'}
              </span>
            ) : null
          }
        />
        {!selected ? (
          <p className="py-10 text-center text-xs text-slate-400">Select a ticket to act on it</p>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-base font-bold text-slate-900">{selected.subject}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                {selected.category}
                {selected.meta ? ` · ${selected.meta}` : ''}
                {selected.priority ? ` · ${selected.priority}` : ''} ·{' '}
                {formatWhen(selected.createdAt)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Raised by
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{selected.name}</p>
              {selected.email ? (
                <a
                  href={`mailto:${selected.email}?subject=Re: ${encodeURIComponent(selected.subject)}`}
                  className="mt-0.5 inline-flex items-center gap-1 text-[12px] font-medium text-blue-700 hover:underline"
                >
                  <Mail className="h-3 w-3" />
                  {selected.email}
                </a>
              ) : null}
              {selected.userId ? (
                <p className="mt-1 truncate font-mono text-[10px] text-slate-400">
                  userId · {selected.userId}
                </p>
              ) : audience === 'employee' ? (
                <p className="mt-1 text-[10px] text-slate-400">Guest ticket (no userId)</p>
              ) : null}
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Description
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {selected.description}
              </p>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Actions
              </p>
              <div className="flex flex-wrap gap-2">
                {statusActions.map((action) => {
                  const active = selected.status === action.status;
                  const busy = updatingId === selected.id;
                  return (
                    <button
                      key={action.status}
                      type="button"
                      disabled={busy || active}
                      onClick={() => void updateStatus(selected.id, action.status)}
                      className={`rounded-xl px-3 py-2 text-[12px] font-semibold transition disabled:opacity-50 ${
                        active
                          ? 'bg-slate-900 text-white'
                          : action.status === 'closed'
                            ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            : action.status === 'resolved'
                              ? 'border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                              : action.status === 'in_progress'
                                ? 'border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                                : 'border border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100'
                      }`}
                    >
                      {busy && !active ? (
                        <Loader2 className="inline h-3.5 w-3.5 animate-spin" />
                      ) : (
                        action.label
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Panel>
    </section>
  );
}
