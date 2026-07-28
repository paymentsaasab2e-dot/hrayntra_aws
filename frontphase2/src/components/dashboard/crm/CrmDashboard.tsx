'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ExternalLink, Loader2, Send, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiBrainAsk } from '@/lib/api';
import {
  apiCrmDashboardOverview,
  type CrmOverview,
} from '@/lib/dashboard/api';
import { useDashboardLayoutStore } from '@/lib/dashboard/DashboardLayoutProvider';
import {
  CrmDashboardProvider,
  crmCard,
  useCrmDashboard,
} from './crmShared';
import { CrmHeader } from './CrmHeader';
import { CrmKpiGrid } from './CrmKpiGrid';
import { CrmChartsAndTables } from './CrmChartsAndTables';
import {
  CrmAlertsPanel,
  CrmFollowupActivity,
  CrmTeamLeaderboard,
} from './CrmPanels';

const POLL_MS = 60_000;

function CrmDrillDownModal() {
  const { drillDown, closeDrillDown } = useCrmDashboard();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!drillDown) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDrillDown();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drillDown, closeDrillDown]);

  if (!mounted || !drillDown) return null;

  const rows = drillDown.rows || [];
  const columns = rows.length
    ? Array.from(
        rows.reduce((set, row) => {
          Object.keys(row || {}).forEach((key) => set.add(key));
          return set;
        }, new Set<string>()),
      )
    : [];

  const modal = (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[1px]"
        aria-label="Close"
        onClick={closeDrillDown}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={drillDown.title}
        className="relative z-10 flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Details</p>
            <h3 className="text-lg font-bold text-slate-900">{drillDown.title}</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {drillDown.subtitle ||
                (rows.length ? `${rows.length} record${rows.length === 1 ? '' : 's'}` : 'No records')}
            </p>
          </div>
          <button
            type="button"
            onClick={closeDrillDown}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          {rows.length && columns.length ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400">
                  <tr>
                    {columns.map((col) => (
                      <th key={col} className="whitespace-nowrap px-3 py-2.5 font-semibold">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className="border-t border-slate-100 hover:bg-slate-50/80">
                      {columns.map((col) => (
                        <td key={col} className="whitespace-nowrap px-3 py-2.5 text-slate-700">
                          {String(row?.[col] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              No matching records in the current dashboard data.
            </p>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={closeDrillDown}
            className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            Close
          </button>
          {drillDown.href ? (
            <Link
              href={drillDown.href}
              onClick={closeDrillDown}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Open records <ExternalLink size={14} />
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

function CrmBrainChat() {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content: 'Ask about your leads and clients — answers use your live CRM database only.',
    },
  ]);

  const ask = async (prompt: string) => {
    const text = prompt.trim();
    if (!text || busy) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setBusy(true);
    try {
      const res = await apiBrainAsk({
        question: text,
        sessionKey: 'crm-dashboard-chat',
        pathname: '/dashboard',
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: String(res.data?.reply || 'No answer returned.').trim() },
      ]);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: error?.message || 'Brain unavailable right now.' },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const suggestions = [
    'How many leads converted this month?',
    'Show overdue follow-ups',
    'Which leads are inactive?',
    'Show high value clients',
  ];

  return (
    <section id="crm-brain" className={`${crmCard} flex min-h-[22rem] flex-col overflow-hidden`}>
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
        <Sparkles size={16} className="text-blue-600" />
        <div>
          <h2 className="text-sm font-bold text-slate-900">AI Assistant</h2>
          <p className="text-[11px] text-slate-500">Ask anything about your CRM</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-b border-slate-50 px-4 py-2">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            disabled={busy}
            onClick={() => void ask(s)}
            className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 hover:bg-blue-50 hover:text-blue-700"
          >
            {s}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
              m.role === 'user' ? 'ml-auto bg-blue-600 text-white' : 'border border-slate-100 bg-slate-50 text-slate-700'
            }`}
          >
            {m.content}
          </div>
        ))}
      </div>
      <form
        className="flex gap-2 border-t border-slate-100 px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about leads & clients..."
          className="h-10 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/25"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white disabled:opacity-50"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        </button>
      </form>
    </section>
  );
}

function CrmDashboardInner() {
  const { filters, refreshKey, hiddenSections } = useCrmDashboard();
  const [overview, setOverview] = useState<CrmOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiCrmDashboardOverview(filters);
      setOverview(data);
    } catch (error: any) {
      setOverview(null);
      toast.error(error?.message || 'Failed to load CRM dashboard');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void apiCrmDashboardOverview(filters)
        .then((data) => setOverview(data))
        .catch(() => undefined);
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [filters]);

  const show = (id: string) => !hiddenSections.has(id);

  return (
    <div className="space-y-5">
      <CrmHeader overview={overview} onRefresh={() => void load()} />

      {show('kpis') ? <CrmKpiGrid overview={overview} loading={loading} /> : null}

      {show('charts') || show('tables') ? (
        <CrmChartsAndTables overview={overview} loading={loading} />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-9">
          {show('followups') ? (
            <CrmFollowupActivity overview={overview} loading={loading} />
          ) : null}
          {show('team') ? <CrmTeamLeaderboard overview={overview} loading={loading} /> : null}
          {show('brain') ? <CrmBrainChat /> : null}
        </div>
        <div className="xl:col-span-3">
          {show('alerts') ? <CrmAlertsPanel overview={overview} loading={loading} /> : null}
        </div>
      </div>

      {overview?.generatedAt ? (
        <p className="pb-2 text-center text-[11px] text-slate-400">
          Last updated {new Date(overview.generatedAt).toLocaleString()}
        </p>
      ) : null}

      <CrmDrillDownModal />
    </div>
  );
}

function CrmDashboardWithLayout() {
  const { layout, setLayout, saveLayout, loading: layoutLoading } = useDashboardLayoutStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!layoutLoading) setReady(true);
  }, [layoutLoading]);

  const onHiddenChange = useCallback(
    (hiddenSections: string[]) => {
      const next = {
        ...layout,
        version: 2 as const,
        crm: { ...(layout.crm || {}), hiddenSections },
      };
      setLayout(next);
      void saveLayout(next);
    },
    [layout, setLayout, saveLayout],
  );

  if (!ready) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-2xl bg-white" />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <CrmDashboardProvider
      initialHidden={layout.crm?.hiddenSections || []}
      onHiddenChange={onHiddenChange}
    >
      <CrmDashboardInner />
    </CrmDashboardProvider>
  );
}

export function CrmDashboard() {
  return <CrmDashboardWithLayout />;
}
