'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Lock, MessageSquareText, Send, X } from 'lucide-react';
import {
  apiHqListHelpTicketMessages,
  apiHqListSupportTicketMessages,
  apiHqSendHelpTicketMessage,
  apiHqSendSupportTicketMessage,
  type HqHelpTicketMessage,
  type HqSupportTicketMessage,
} from '@/lib/api';

type TicketKind = 'employee' | 'employer';

type Props = {
  open: boolean;
  onClose: () => void;
  ticketId: string;
  subject: string;
  ticketStatus?: string;
  ticketKind?: TicketKind;
};

type ChatMessage = HqHelpTicketMessage | HqSupportTicketMessage;

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function HqHelpTicketChatModal({
  open,
  onClose,
  ticketId,
  subject,
  ticketStatus,
  ticketKind = 'employee',
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<string>(ticketStatus || 'open');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const readOnly = status === 'closed';

  useEffect(() => {
    if (ticketStatus) setStatus(ticketStatus);
  }, [ticketStatus, ticketId]);

  const loadMessages = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    try {
      const res =
        ticketKind === 'employer'
          ? await apiHqListSupportTicketMessages(ticketId)
          : await apiHqListHelpTicketMessages(ticketId);
      setMessages(Array.isArray(res.data?.messages) ? res.data.messages : []);
      if (res.data?.status) setStatus(res.data.status);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [ticketId, ticketKind]);

  useEffect(() => {
    if (!open) return;
    void loadMessages();
    const timer = window.setInterval(() => void loadMessages(), 12000);
    return () => window.clearInterval(timer);
  }, [open, loadMessages]);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  const emptyHint = useMemo(() => {
    if (readOnly) return 'No messages on this completed ticket.';
    return ticketKind === 'employer'
      ? 'No messages yet. Reply to the entrepreneur below.'
      : 'No messages yet. Reply to the candidate below.';
  }, [readOnly, ticketKind]);

  const peerLabel = ticketKind === 'employer' ? 'Entrepreneur' : 'Candidate';

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    const text = draft.trim();
    if (!text || sending) return;

    setSending(true);
    try {
      if (ticketKind === 'employer') {
        await apiHqSendSupportTicketMessage(ticketId, text);
      } else {
        await apiHqSendHelpTicketMessage(ticketId, text);
      }
      setDraft('');
      await loadMessages();
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[12000] flex items-end justify-center bg-slate-900/40 p-4 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hq-help-ticket-chat-title"
      onClick={onClose}
    >
      <div
        className="flex h-[min(560px,82vh)] w-full max-w-lg flex-col overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3 text-white sm:px-5 ${
            readOnly ? 'bg-gradient-to-r from-slate-600 to-slate-500' : 'bg-gradient-to-r from-blue-700 to-emerald-600'
          }`}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <MessageSquareText className="h-5 w-5 shrink-0" />
              <h2 id="hq-help-ticket-chat-title" className="truncate text-base font-bold">
                {readOnly ? 'Ticket chat history' : 'Ticket chat'}
              </h2>
            </div>
            <p className="mt-1 truncate text-xs text-white/85">{subject}</p>
            <p className="mt-0.5 font-mono text-[10px] text-white/70">{ticketId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/90 hover:bg-white/10"
            aria-label="Close chat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {readOnly ? (
          <div className="flex items-center gap-2 border-b border-emerald-100 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            This ticket is completed. You can read past messages but cannot send new ones.
          </div>
        ) : null}

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50/80 px-4 py-4">
          {loading && messages.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-sm text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading messages…
            </div>
          ) : messages.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">{emptyHint}</p>
          ) : (
            messages.map((msg) => {
              const mine = msg.senderRole === 'hq';
              return (
                <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
                      mine
                        ? 'rounded-br-md bg-blue-700 text-white'
                        : 'rounded-bl-md border border-slate-200 bg-white text-slate-800'
                    }`}
                  >
                    <p className={`text-[10px] font-bold uppercase tracking-wide ${mine ? 'text-white/75' : 'text-slate-400'}`}>
                      {msg.senderName || (mine ? 'HQ Support' : peerLabel)}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap leading-relaxed">{msg.body}</p>
                    <p className={`mt-1 text-[10px] ${mine ? 'text-white/70' : 'text-slate-400'}`}>
                      {msg.createdAt ? formatWhen(msg.createdAt) : '—'}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {readOnly ? (
          <div className="border-t bg-slate-50 px-4 py-3 text-center text-xs text-slate-500">
            Messaging is disabled for completed tickets.
          </div>
        ) : (
          <form onSubmit={onSubmit} className="border-t bg-white p-3 sm:p-4">
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
                placeholder={ticketKind === 'employer' ? 'Reply to entrepreneur…' : 'Reply to candidate…'}
                className="min-h-[44px] flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-white disabled:opacity-50"
                aria-label="Send message"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
