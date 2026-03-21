'use client';

import { Loader2, Send } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiAssistantChat, type AssistantChatMessage } from '../lib/api';

export type UiChatMessage = AssistantChatMessage & { id: string };

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface AssistantChatPanelProps {
  messages: UiChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<UiChatMessage[]>>;
}

export function AssistantChatPanel({ messages, setMessages }: AssistantChatPanelProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<UiChatMessage[]>(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, error]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setError(null);
    setInput('');
    const userMsg: UiChatMessage = { id: newId(), role: 'user', content: text };
    const nextThread = [...messagesRef.current, userMsg];
    messagesRef.current = nextThread;
    setMessages(nextThread);
    setLoading(true);
    try {
      const payload: AssistantChatMessage[] = nextThread.map(({ role, content }) => ({ role, content }));
      const res = await apiAssistantChat({ messages: payload });
      const reply = res.data?.message;
      if (!reply) throw new Error('No reply from assistant');
      const withAssistant = [...messagesRef.current, { id: newId(), role: 'assistant' as const, content: reply }];
      messagesRef.current = withAssistant;
      setMessages(withAssistant);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Something went wrong';
      setError(msg);
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }, [input, loading, setMessages]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-[200px] flex-1 space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/80 p-3">
        {messages.length === 0 ? (
          <p className="px-1 text-sm leading-relaxed text-slate-600">
            Ask anything about using this ATS — candidates, jobs, pipeline, interviews, placements, and day-to-day
            recruiting workflows. Press <kbd className="rounded bg-white px-1.5 py-0.5 text-xs shadow-sm">Enter</kbd> to
            send, <kbd className="rounded bg-white px-1.5 py-0.5 text-xs shadow-sm">Shift+Enter</kbd> for a new line.
          </p>
        ) : null}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm ${
                m.role === 'user'
                  ? 'rounded-br-md bg-blue-600 text-white'
                  : 'rounded-bl-md border border-slate-200 bg-white text-slate-800'
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{m.content}</p>
            </div>
          </div>
        ))}
        {loading ? (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
              Thinking…
            </div>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {error ? (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </div>
      ) : null}

      <div className="mt-3 flex gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Message the assistant…"
          rows={2}
          disabled={loading}
          className="min-h-[44px] flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={loading || !input.trim()}
          className="flex shrink-0 items-center justify-center self-end rounded-xl bg-blue-600 px-4 py-2 text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Send message"
        >
          {loading ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
        </button>
      </div>
    </div>
  );
}
