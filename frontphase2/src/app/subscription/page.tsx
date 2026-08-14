'use client';

import React, { useEffect, useState } from 'react';
import { Coins, Loader2, Ticket } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { TokenCoinIcon } from '@/components/coins/TokenCoinIcon';
import { useTenantCoins } from '@/components/coins/TenantCoinsContext';
import {
  apiCreateSupportTicket,
  apiListMySupportTickets,
  type HqSupportTicket,
} from '@/lib/api';
import { dashTextFont } from '@/lib/dashTypeFonts';
import { formatDateDMY } from '@/utils/dateDisplay';

export default function SubscriptionPage() {
  const { coins, planName, loading, refresh } = useTenantCoins();
  const [amount, setAmount] = useState('100');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [tickets, setTickets] = useState<HqSupportTicket[]>([]);

  const loadTickets = async () => {
    try {
      const res = await apiListMySupportTickets();
      const all = res.data?.tickets || [];
      setTickets(
        all.filter(
          (t) =>
            t.category === 'billing' ||
            /token|coin/i.test(`${t.subject || ''} ${t.description || ''}`),
        ),
      );
    } catch {
      setTickets([]);
    }
  };

  useEffect(() => {
    void loadTickets();
  }, []);

  const qty = Math.max(0, Math.round(Number(amount) || 0));

  const raiseTicket = async () => {
    if (qty < 1) {
      toast.error('Enter how many tokens you need');
      return;
    }
    setSubmitting(true);
    try {
      await apiCreateSupportTicket({
        subject: `Add ${qty.toLocaleString()} tenant tokens`,
        description: [
          `Please add ${qty.toLocaleString()} tokens to this tenant wallet.`,
          `Current balance: ${coins.toLocaleString()}.`,
          planName ? `Plan: ${planName}.` : '',
          note.trim() ? `Note: ${note.trim()}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
        priority: qty >= 500 ? 'high' : 'medium',
        category: 'billing',
      });
      toast.success('Ticket sent to HQ. They will add tokens after review.');
      setNote('');
      await loadTickets();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not raise ticket');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Toaster position="top-right" richColors style={{ top: '5rem' }} />
      <div className={`${dashTextFont} w-full min-h-screen text-slate-800`}>
        <header className="flex min-h-[4.5rem] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-white/80 px-4 py-3 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-amber-300 shadow-lg shadow-slate-900/20">
              <Coins className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-none tracking-tight text-slate-900">Subscription</h1>
              <p className="mt-1 text-xs text-slate-500">Tenant-wide tokens · connected to HQ · Super Admin only</p>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Current balance</p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
              <p className="flex items-center gap-2 text-4xl font-bold text-slate-900">
                <TokenCoinIcon className="h-8 w-8" />
                {loading ? '—' : coins.toLocaleString()}
              </p>
              <p className="text-[13px] text-slate-500">{planName || 'Workspace plan'}</p>
            </div>
            <button
              type="button"
              onClick={() => void refresh()}
              className="mt-3 text-[12px] font-semibold text-orange-600 hover:text-orange-700"
            >
              Refresh balance
            </button>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-[15px] font-bold text-slate-900">Request tokens from HQ</h2>
            <p className="mt-1 text-[13px] text-slate-500">
              Type how many tokens this tenant needs. That sends a ticket to HQ — they credit the wallet after review.
            </p>
            <label className="mt-4 block text-[12px] font-semibold text-slate-600">
              Tokens to add
              <input
                type="number"
                min={1}
                step={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[15px] font-semibold text-slate-900 outline-none ring-orange-200 focus:bg-white focus:ring-2"
              />
            </label>
            <label className="mt-3 block text-[12px] font-semibold text-slate-600">
              Note (optional)
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Why you need more tokens…"
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-800 outline-none ring-orange-200 focus:bg-white focus:ring-2"
              />
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => void raiseTicket()}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-slate-900 px-5 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800 disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
                Send to HQ · {qty || 0} tokens
              </button>
              <button
                type="button"
                disabled
                title="Direct checkout is not live yet"
                className="inline-flex h-11 cursor-not-allowed items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-5 text-sm font-semibold text-slate-400"
              >
                Direct buy · Coming soon
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-[15px] font-bold text-slate-900">HQ tickets</h2>
            {tickets.length ? (
              <ul className="divide-y divide-slate-100">
                {tickets.slice(0, 8).map((t) => (
                  <li key={t.id} className="flex items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-slate-800">{t.subject}</p>
                      <p className="text-[11px] text-slate-400">
                        {t.status} · {t.createdAt ? formatDateDMY(t.createdAt) : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-slate-400">No HQ token tickets yet</p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
