'use client';

import React, { useState } from 'react';
import { Loader2, Send, Sparkles } from 'lucide-react';
import { apiBrainAsk } from '@/lib/api';
import { cardClass } from './dashboardUi';

type Msg = { role: 'user' | 'assistant'; content: string };

const SUGGESTIONS = [
  'How many leads converted this month?',
  'Show overdue follow-ups',
  'Who is my best recruiter?',
  'Which jobs need candidates?',
  'Show revenue this month',
  'Which client generated maximum revenue?',
  'How many interviews today?',
  'Show inactive clients',
];

export function DashboardBrainChat() {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      content:
        'Ask anything about your CRM — answers use your live tenant database only. No hallucinations.',
    },
  ]);

  const ask = async (prompt: string) => {
    const text = prompt.trim();
    if (!text || busy) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setBusy(true);
    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await apiBrainAsk({
        question: text,
        sessionKey: 'dashboard-chat',
        pathname: '/dashboard',
        messages: history,
      });
      const reply = String(res.data?.reply || 'No answer returned.').trim();
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: error?.message || 'Brain is unavailable right now. Try again shortly.',
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      id="brain-chat"
      className={`${cardClass} flex min-h-[28rem] flex-col overflow-hidden`}
      aria-label="HRYANTRA Brain"
    >
      <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#3B82F6]/10 text-[#3B82F6]">
          <Sparkles size={18} />
        </span>
        <div>
          <h2 className="text-base font-bold text-slate-900">HRYANTRA Brain</h2>
          <p className="text-xs text-slate-500">Ask anything about your CRM</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-50 px-5 py-3">
        {SUGGESTIONS.slice(0, 6).map((s) => (
          <button
            key={s}
            type="button"
            disabled={busy}
            onClick={() => void ask(s)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              m.role === 'user'
                ? 'ml-auto bg-[#3B82F6] text-white'
                : 'border border-slate-100 bg-slate-50 text-slate-700'
            }`}
          >
            {m.content}
          </div>
        ))}
        {busy ? (
          <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            <Loader2 size={14} className="animate-spin" /> Thinking with your tenant data…
          </div>
        ) : null}
      </div>

      <form
        className="flex items-center gap-2 border-t border-slate-100 bg-white px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the Brain..."
          className="h-11 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none ring-[#3B82F6]/25 focus:bg-white focus:ring-2"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#3B82F6] text-white hover:bg-[#2563EB] disabled:opacity-50"
          aria-label="Send"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </form>
    </section>
  );
}
