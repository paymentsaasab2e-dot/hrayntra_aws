'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, Ticket } from 'lucide-react';
import { BrandPngIcon } from '@/components/coins/BrandPngIcon';
import {
  apiCreateSupportTicket,
  apiListMySupportTickets,
  type HqSupportTicket,
  type HqSupportTicketCategory,
  type HqSupportTicketPriority,
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

export function HelpTicketForm() {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<HqSupportTicketPriority>('medium');
  const [category, setCategory] = useState<HqSupportTicketCategory>('general');
  const [submitting, setSubmitting] = useState(false);
  const [myTickets, setMyTickets] = useState<HqSupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);

  const loadMyTickets = async () => {
    setLoadingTickets(true);
    try {
      const res = await apiListMySupportTickets();
      setMyTickets(res.data?.tickets || []);
    } catch {
      setMyTickets([]);
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    void loadMyTickets();
  }, []);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!subject.trim() || !description.trim()) {
      toast.error('Subject and description are required');
      return;
    }
    setSubmitting(true);
    try {
      await apiCreateSupportTicket({
        subject: subject.trim(),
        description: description.trim(),
        priority,
        category,
      });
      toast.success('Ticket submitted — HQ support will review it shortly.');
      setSubject('');
      setDescription('');
      setPriority('medium');
      setCategory('general');
      await loadMyTickets();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit ticket');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <Ticket className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Raise a support ticket</h2>
            <p className="text-sm text-slate-500">
              Tell us what you need — it will appear on the HQ Tickets board.
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
        <h3 className="text-lg font-bold text-slate-900">Your recent tickets</h3>
        <p className="mt-1 text-sm text-slate-500">Track the requests you have already raised.</p>

        <div className="mt-4 space-y-3">
          {loadingTickets ? (
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Loading…</div>
          ) : myTickets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              No tickets yet. Submit one above if you need help.
            </div>
          ) : (
            myTickets.slice(0, 8).map((ticket) => (
              <div key={ticket.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-slate-900">{ticket.subject}</div>
                  <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold uppercase text-slate-600 ring-1 ring-slate-200">
                    {ticket.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-slate-600">{ticket.description}</p>
                <div className="mt-2 text-xs text-slate-400">
                  {ticket.priority} · {ticket.createdAt ? formatDateDMY(ticket.createdAt) : '—'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
