'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LifeBuoy, RefreshCw, Search, Ticket } from 'lucide-react';
import {
  HqModulePageLayout,
  HQ_TABLE_BODY_SCROLL_CLASS,
  HQ_TABLE_CARD_CLASS,
  HQ_TOOLBAR_ROW_CLASS,
} from '@/components/hq/HqModulePageLayout';
import { HqPrimaryButton, HqSecondaryButton, HqStatCard } from '@/components/hq/hqUi';
import {
  apiHqListTickets,
  apiHqUpdateTicket,
  type HqSupportTicket,
  type HqSupportTicketStats,
  type HqSupportTicketStatus,
} from '@/lib/api';
import { formatDateDMY } from '@/utils/dateDisplay';
import { toast } from 'sonner';

const EMPTY_STATS: HqSupportTicketStats = {
  total: 0,
  open: 0,
  inProgress: 0,
  resolved: 0,
  closed: 0,
  highPriority: 0,
};

const STATUS_STYLES: Record<HqSupportTicketStatus, string> = {
  open: 'bg-sky-50 text-sky-700 ring-sky-200',
  in_progress: 'bg-amber-50 text-amber-700 ring-amber-200',
  resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  closed: 'bg-slate-100 text-slate-600 ring-slate-200',
};

const PRIORITY_STYLES: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600 ring-slate-200',
  medium: 'bg-blue-50 text-blue-700 ring-blue-200',
  high: 'bg-orange-50 text-orange-700 ring-orange-200',
  urgent: 'bg-rose-50 text-rose-700 ring-rose-200',
};

function labelStatus(status: string) {
  return String(status || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function HqTicketsPage() {
  const [tickets, setTickets] = useState<HqSupportTicket[]>([]);
  const [stats, setStats] = useState<HqSupportTicketStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiHqListTickets(statusFilter ? { status: statusFilter } : undefined);
      setTickets(res.data?.tickets || []);
      setStats(res.data?.stats || EMPTY_STATS);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load tickets');
      setTickets([]);
      setStats(EMPTY_STATS);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tickets;
    return tickets.filter((ticket) => {
      const haystack = [
        ticket.subject,
        ticket.description,
        ticket.organizationName,
        ticket.raisedByName,
        ticket.raisedByEmail,
        ticket.tenantDbName,
        ticket.category,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [search, tickets]);

  const selected = useMemo(
    () => filtered.find((ticket) => ticket.id === selectedId) || null,
    [filtered, selectedId],
  );

  const updateStatus = async (ticketId: string, status: HqSupportTicketStatus) => {
    setUpdatingId(ticketId);
    try {
      const res = await apiHqUpdateTicket(ticketId, { status });
      const updated = res.data?.ticket;
      if (updated) {
        setTickets((prev) => prev.map((ticket) => (ticket.id === ticketId ? updated : ticket)));
        toast.success(`Ticket marked ${labelStatus(status)}`);
      }
      await loadTickets();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update ticket');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <HqModulePageLayout
      title="Tickets"
      subtitle="Support requests raised by Phase 2 tenants from Help Center"
      icon={<Ticket className="h-5 w-5" />}
      actions={
        <HqSecondaryButton type="button" onClick={() => void loadTickets()}>
          <RefreshCw className="size-4" />
          Refresh
        </HqSecondaryButton>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <HqStatCard label="Total" value={stats.total} />
        <HqStatCard label="Open" value={stats.open} />
        <HqStatCard label="In progress" value={stats.inProgress} />
        <HqStatCard label="Resolved" value={stats.resolved} />
        <HqStatCard label="High / Urgent" value={stats.highPriority} />
      </div>

      <div className={`${HQ_TOOLBAR_ROW_CLASS} mt-4`}>
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subject, tenant, email…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700"
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <div className={HQ_TABLE_CARD_CLASS}>
          <div className={HQ_TABLE_BODY_SCROLL_CLASS}>
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Tenant</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Raised</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                      Loading tickets…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                      No support tickets yet.
                    </td>
                  </tr>
                ) : (
                  filtered.map((ticket) => (
                    <tr
                      key={ticket.id}
                      onClick={() => setSelectedId(ticket.id)}
                      className={`cursor-pointer transition hover:bg-slate-50 ${
                        selectedId === ticket.id ? 'bg-blue-50/70' : 'bg-white'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{ticket.subject}</div>
                        <div className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                          {ticket.description}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">
                          {ticket.organizationName || ticket.tenantDbName || '—'}
                        </div>
                        <div className="text-xs text-slate-500">
                          {ticket.raisedByName || ticket.raisedByEmail || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ring-1 ${
                            PRIORITY_STYLES[ticket.priority] || PRIORITY_STYLES.medium
                          }`}
                        >
                          {ticket.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ring-1 ${
                            STATUS_STYLES[ticket.status] || STATUS_STYLES.open
                          }`}
                        >
                          {labelStatus(ticket.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {ticket.createdAt ? formatDateDMY(ticket.createdAt) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {!selected ? (
            <div className="flex h-full min-h-[280px] flex-col items-center justify-center text-center text-slate-500">
              <LifeBuoy className="mb-3 size-8 text-slate-300" />
              <p className="text-sm font-medium">Select a ticket to view details</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {selected.category}
                </div>
                <h2 className="mt-1 text-lg font-bold text-slate-900">{selected.subject}</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                  {selected.description}
                </p>
              </div>

              <div className="grid gap-2 rounded-xl bg-slate-50 p-3 text-sm">
                <div>
                  <span className="text-slate-400">Tenant:</span>{' '}
                  <span className="font-medium text-slate-800">
                    {selected.organizationName || selected.tenantDbName || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Raised by:</span>{' '}
                  <span className="font-medium text-slate-800">
                    {selected.raisedByName || '—'} ({selected.raisedByEmail || '—'})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Created:</span>{' '}
                  <span className="font-medium text-slate-800">
                    {selected.createdAt ? formatDateDMY(selected.createdAt) : '—'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {(['open', 'in_progress', 'resolved', 'closed'] as HqSupportTicketStatus[]).map(
                  (status) => (
                    <HqPrimaryButton
                      key={status}
                      type="button"
                      disabled={updatingId === selected.id || selected.status === status}
                      onClick={() => void updateStatus(selected.id, status)}
                      className="!px-3 !py-2 !text-xs"
                    >
                      {labelStatus(status)}
                    </HqPrimaryButton>
                  ),
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </HqModulePageLayout>
  );
}
