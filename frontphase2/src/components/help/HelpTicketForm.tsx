'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, MessageSquareText, Ticket, X } from 'lucide-react';
import { BrandPngIcon } from '@/components/coins/BrandPngIcon';
import { SupportTicketChatModal } from '@/components/help/SupportTicketChatModal';
import {
  apiCreateSupportTicket,
  apiListMySupportTickets,
  apiUpdateMySupportTicket,
  type HqSupportTicket,
  type HqSupportTicketCategory,
  type HqSupportTicketPriority,
  type HqSupportTicketStatus,
} from '../../lib/api';
import { formatDateDMY } from '../../utils/dateDisplay';
import { toast } from 'sonner';

const PRIORITIES: { value: HqSupportTicketPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const CATEGORIES: { value: HqSupportTicketCategory; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'technical', label: 'Technical' },
  { value: 'billing', label: 'Billing' },
  { value: 'account', label: 'Account' },
  { value: 'feature', label: 'Feature request' },
];

function categoryLabel(value?: string) {
  return CATEGORIES.find((c) => c.value === value)?.label || value || '—';
}

function ticketStatusLabel(status?: HqSupportTicketStatus) {
  if (status === 'closed') return 'Completed';
  return 'Pending';
}

function isTicketCompleted(status?: HqSupportTicketStatus) {
  return status === 'closed';
}

function ticketStatusStyles(status?: HqSupportTicketStatus) {
  if (status === 'closed') {
    return { bg: 'rgba(16,185,129,0.12)', color: '#047857', border: 'rgba(16,185,129,0.35)' };
  }
  return { bg: 'rgba(245,158,11,0.12)', color: '#B45309', border: 'rgba(245,158,11,0.35)' };
}

function sortTickets(list: HqSupportTicket[]) {
  return [...list].sort((a, b) => {
    const aDone = a.status === 'closed' ? 1 : 0;
    const bDone = b.status === 'closed' ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });
}

export function HelpTicketForm() {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<HqSupportTicketPriority>('medium');
  const [category, setCategory] = useState<HqSupportTicketCategory>('general');
  const [submitting, setSubmitting] = useState(false);
  const [myTickets, setMyTickets] = useState<HqSupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [updatingTicketId, setUpdatingTicketId] = useState<string | null>(null);
  const [chatTicket, setChatTicket] = useState<HqSupportTicket | null>(null);
  const [successTicket, setSuccessTicket] = useState<{ id: string; subject: string } | null>(null);

  const loadMyTickets = async () => {
    setLoadingTickets(true);
    try {
      const res = await apiListMySupportTickets();
      setMyTickets(sortTickets(res.data?.tickets || []));
    } catch {
      setMyTickets([]);
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    void loadMyTickets();
  }, []);

  const counts = useMemo(() => {
    const pending = myTickets.filter((t) => !isTicketCompleted(t.status)).length;
    const completed = myTickets.filter((t) => isTicketCompleted(t.status)).length;
    return { pending, completed };
  }, [myTickets]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!subject.trim() || !description.trim()) {
      toast.error('Subject and description are required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiCreateSupportTicket({
        subject: subject.trim(),
        description: description.trim(),
        priority,
        category,
      });
      const ticket = res.data?.ticket;
      toast.success('Ticket submitted — HQ support will review it shortly.');
      setSubject('');
      setDescription('');
      setPriority('medium');
      setCategory('general');
      if (ticket?.id) {
        setSuccessTicket({ id: ticket.id, subject: ticket.subject });
      }
      await loadMyTickets();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const markTicketCompleted = async (ticketId: string) => {
    setUpdatingTicketId(ticketId);
    try {
      await apiUpdateMySupportTicket(ticketId, 'closed');
      toast.success('Ticket marked as completed');
      await loadMyTickets();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update ticket');
    } finally {
      setUpdatingTicketId(null);
    }
  };

  return (
    <div className="space-y-6">
      {chatTicket ? (
        <SupportTicketChatModal
          open
          onClose={() => setChatTicket(null)}
          ticketId={chatTicket.id}
          subject={chatTicket.subject}
          ticketStatus={chatTicket.status}
        />
      ) : null}

      {successTicket ? (
        <div
          className="fixed inset-0 z-[11000] flex items-center justify-center bg-slate-900/45 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setSuccessTicket(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-emerald-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <button
                type="button"
                onClick={() => setSuccessTicket(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-900">Ticket submitted</h3>
            <p className="mt-2 text-sm text-slate-600">
              Your request was registered with HQ. Use the chat button in your ticket table to follow up.
            </p>
            <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">Ticket ID</p>
            <p className="mt-1 font-mono text-2xl font-bold tracking-wide text-emerald-700">{successTicket.id}</p>
            <p className="mt-1 text-sm font-medium text-slate-800">{successTicket.subject}</p>
            <button
              type="button"
              onClick={() => setSuccessTicket(null)}
              className="mt-5 w-full rounded-xl bg-[#0F2A44] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#163a5c]"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <Ticket className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Raise a support ticket</h2>
            <p className="text-sm text-slate-500">
              Tell us what you need — it will appear on the HQ Tickets board and in your table below.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Subject *
            </label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Short summary of the issue"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              maxLength={200}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as HqSupportTicketCategory)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              >
                {CATEGORIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as HqSupportTicketPriority)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              >
                {PRIORITIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Description *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue, steps to reproduce, or what you need help with…"
              rows={5}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              maxLength={5000}
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0F2A44] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#163a5c] disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrandPngIcon name="send" className="h-4 w-4" />}
            {submitting ? 'Submitting…' : 'Submit ticket'}
          </button>
        </div>
      </form>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Your support tickets</h3>
            <p className="mt-1 text-sm text-slate-500">Chat with HQ or mark tickets completed when resolved.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-200">
              Pending · {counts.pending}
            </span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 ring-1 ring-emerald-200">
              Completed · {counts.completed}
            </span>
          </div>
        </div>

        {loadingTickets ? (
          <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500">Loading tickets…</div>
        ) : myTickets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
            No tickets yet. Submit one above if you need help.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-slate-50/80">
                  <th className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">
                    Ticket ID
                  </th>
                  <th className="min-w-[200px] px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">
                    Subject
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">
                    Category
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">
                    Status
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">
                    Raised on
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {myTickets.map((ticket) => {
                  const statusStyle = ticketStatusStyles(ticket.status);
                  return (
                    <tr key={ticket.id} className="border-b last:border-b-0">
                      <td className="whitespace-nowrap px-4 py-3.5 font-mono text-xs font-semibold text-emerald-700">
                        {ticket.id}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="line-clamp-2 font-semibold text-slate-900">{ticket.subject}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-slate-500">
                        {categoryLabel(ticket.category)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <span
                          className="inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide"
                          style={{
                            background: statusStyle.bg,
                            color: statusStyle.color,
                            borderColor: statusStyle.border,
                          }}
                        >
                          {ticketStatusLabel(ticket.status)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-slate-500">
                        {ticket.createdAt ? formatDateDMY(ticket.createdAt) : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setChatTicket(ticket)}
                            title={
                              isTicketCompleted(ticket.status)
                                ? 'View chat history (read-only)'
                                : 'Open ticket chat'
                            }
                            className={`inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-[#0F2A44] hover:bg-slate-50 ${
                              isTicketCompleted(ticket.status) ? 'opacity-75' : ''
                            }`}
                          >
                            <MessageSquareText className="h-3.5 w-3.5" />
                            Chat
                          </button>
                          {isTicketCompleted(ticket.status) ? (
                            <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-700">
                              Completed
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void markTicketCompleted(ticket.id)}
                              disabled={updatingTicketId === ticket.id}
                              className="inline-flex items-center justify-center rounded-full bg-[#0F2A44] px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
                            >
                              {updatingTicketId === ticket.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                'Completed'
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
