'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUp, MessageSquare, Sparkles } from 'lucide-react';
import type { AddLeadFormData } from '../drawers/LeadDetailsDrawer';
import { apiGenerateLeadDetails, apiLeadAiChat, type LeadAiChatMessage } from '@/lib/api';
import {
  buildLeadAiMissingMessage,
  computeLeadAiInsights,
  type LeadAiGeneratedPayload,
  type LeadAiInsights,
} from '@/lib/leadAiHelpers';
import { DrawerCloseButton } from '../drawers/DrawerCloseButton';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  form: AddLeadFormData;
  onApplyGenerated: (generated: LeadAiGeneratedPayload) => void;
  onExpandSections: () => void;
  chatHistory: LeadAiChatMessage[];
  onChatHistoryChange: (history: LeadAiChatMessage[]) => void;
  onCreateLead?: () => void;
  createDisabled?: boolean;
};

export function LeadAiChatDrawer({
  isOpen,
  onClose,
  form,
  onApplyGenerated,
  onExpandSections,
  chatHistory,
  onChatHistoryChange,
  onCreateLead,
  createDisabled = false,
}: Props) {
  const [mode, setMode] = useState<'paste' | 'chat'>('chat');
  const [pasteText, setPasteText] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [insights, setInsights] = useState<LeadAiInsights | null>(null);
  const [readyToCreate, setReadyToCreate] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 200);
    return () => window.clearTimeout(t);
  }, [isOpen, mode]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chatHistory, busy, status, isOpen]);

  const finishApply = useCallback(
    (generated: LeadAiGeneratedPayload, sourceText: string) => {
      onApplyGenerated(generated);
      onExpandSections();
      setInsights(
        computeLeadAiInsights(
          {
            companyName: generated.companyName || form.companyName,
            contactPerson: generated.contactPerson || form.contactPerson,
            email: generated.email || form.email,
            phone: generated.phone || form.phone,
            interestedNeeds: generated.interestedNeeds || form.interestedNeeds,
            notes: generated.expectedBusinessValue || generated.notes || form.notes,
            website: generated.website || form.website,
            linkedIn: generated.linkedIn || form.linkedIn,
            nextFollowUp: generated.nextFollowUp || form.nextFollowUp,
            priority: generated.priority || form.priority,
          },
          sourceText,
        ),
      );
      const missingMsg = buildLeadAiMissingMessage({
        companyName: generated.companyName || form.companyName,
        email: generated.email || form.email,
        emails: generated.emails || form.emails,
      });
      setReadyToCreate(!missingMsg);
      setStatus(
        missingMsg ||
          'Form updated — review the Add Lead drawer and click Create Lead when ready.',
      );
      setError('');
    },
    [form, onApplyGenerated, onExpandSections],
  );

  const runPasteExtract = async () => {
    const input = pasteText.trim();
    if (!input) {
      setError('Paste or type lead details first.');
      return;
    }
    setBusy(true);
    setError('');
    setStatus('');
    try {
      const response = await apiGenerateLeadDetails({
        prompt: input,
        currentForm: form as unknown as Record<string, unknown>,
      });
      if (!response.data) throw new Error('AI did not return lead details');
      finishApply(response.data, input);
      setPasteText('');
      setMode('chat');
      onChatHistoryChange([
        ...chatHistory,
        { role: 'user', content: input },
        {
          role: 'assistant',
          content: 'I extracted details from your notes and filled the form on the right.',
        },
      ]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to process lead details');
    } finally {
      setBusy(false);
    }
  };

  const runChatTurn = async () => {
    const input = chatInput.trim();
    if (!input) return;
    setBusy(true);
    setError('');
    const nextHistory: LeadAiChatMessage[] = [...chatHistory, { role: 'user', content: input }];
    onChatHistoryChange(nextHistory);
    setChatInput('');
    try {
      const response = await apiLeadAiChat({
        message: input,
        currentForm: form as unknown as Record<string, unknown>,
        history: chatHistory,
      });
      const data = response.data;
      if (!data?.reply) throw new Error('AI did not return a reply');
      onChatHistoryChange([...nextHistory, { role: 'assistant', content: data.reply }]);
      if (data.lead) {
        finishApply(data.lead, input);
      }
      if (data.readyToCreate) {
        setReadyToCreate(true);
        setStatus('Lead looks ready — review the form and create the lead.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'AI assistant failed');
    } finally {
      setBusy(false);
    }
  };

  const startChatIfEmpty = () => {
    if (chatHistory.length > 0) return;
    onChatHistoryChange([
      {
        role: 'assistant',
        content:
          "Hi — I'm your lead assistant. Tell me about the company, or paste notes from email or WhatsApp. What's the company name?",
      },
    ]);
  };

  useEffect(() => {
    if (isOpen && mode === 'chat') {
      startChatIfEmpty();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mode]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.aside
          key="lead-ai-chat-panel"
          initial={{ x: '-100%', opacity: 0.9 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '-100%', opacity: 0.9 }}
          transition={{ type: 'spring', damping: 28, stiffness: 260 }}
          className="fixed inset-y-4 left-4 z-[56] flex w-[min(100%,28rem)] flex-col overflow-hidden rounded-[24px] border border-slate-200/90 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)] ring-1 ring-slate-900/5"
          onClick={(e) => e.stopPropagation()}
        >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-b from-white to-slate-50/50 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
                  <Sparkles size={18} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold tracking-tight text-slate-900">AI Lead Assistant</h2>
                  <p className="text-xs text-slate-500">Chat fills the Add Lead form as you go</p>
                </div>
              </div>
              <DrawerCloseButton onClick={onClose} />
            </div>

            <div className="flex shrink-0 gap-2 border-b border-slate-100 px-5 py-3">
              <button
                type="button"
                onClick={() => setMode('chat')}
                className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                  mode === 'chat'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                }`}
              >
                <MessageSquare size={14} />
                Chat
              </button>
              <button
                type="button"
                onClick={() => setMode('paste')}
                className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                  mode === 'paste'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                }`}
              >
                Paste notes
              </button>
            </div>

            {insights ? (
              <div className="shrink-0 border-b border-indigo-100 bg-indigo-50/80 px-5 py-3 text-xs text-indigo-950">
                <p className="font-semibold">
                  Lead score: {insights.score}/100 · Suggested priority: {insights.priority}
                </p>
                <p className="mt-1 text-indigo-900/90">{insights.nextAction}</p>
                <p className="text-indigo-900/75">{insights.followUpHint}</p>
              </div>
            ) : null}

            <div className="flex min-h-0 flex-1 flex-col">
              {mode === 'paste' ? (
                <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">
                  <p className="text-sm text-slate-600">
                    Paste unstructured text — meeting notes, WhatsApp, or email — and we&apos;ll fill the form.
                  </p>
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    rows={10}
                    disabled={busy}
                    placeholder={`Tell me about this lead…\n\nExample:\nI met Rajesh Sharma from ABC Technologies.\nThey need an ATS for 500 employees.\nEmail: rajesh@abc.com\nPhone: 9876543210\nBudget ₹10 lakh.\nFollow up next week.`}
                    className="w-full flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                  <button
                    type="button"
                    onClick={() => void runPasteExtract()}
                    disabled={busy || !pasteText.trim()}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy ? 'Analyzing…' : 'Analyze & fill form'}
                  </button>
                </div>
              ) : (
                <>
                  <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
                    {chatHistory.map((entry, index) => (
                      <div
                        key={`${entry.role}-${index}`}
                        className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                          entry.role === 'assistant'
                            ? 'bg-slate-100 text-slate-800'
                            : 'ml-auto bg-blue-600 text-white'
                        }`}
                      >
                        {entry.content}
                      </div>
                    ))}
                    {busy ? (
                      <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2 text-xs text-slate-500">
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                        Thinking…
                      </div>
                    ) : null}
                    <div ref={chatEndRef} />
                  </div>

                  <div className="shrink-0 border-t border-slate-100 bg-white p-4">
                    {status ? (
                      <p className="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        {status}
                      </p>
                    ) : null}
                    {error ? (
                      <p className="mb-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                        {error}
                      </p>
                    ) : null}
                    <div className="flex items-end gap-2">
                      <textarea
                        ref={inputRef}
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey && !busy) {
                            e.preventDefault();
                            void runChatTurn();
                          }
                        }}
                        rows={2}
                        disabled={busy}
                        placeholder="Reply to continue…"
                        className="min-h-[48px] flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                      <button
                        type="button"
                        onClick={() => void runChatTurn()}
                        disabled={busy || !chatInput.trim()}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-300"
                        aria-label="Send"
                      >
                        <ArrowUp size={18} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-3">
              <p className="text-[11px] text-slate-500">Form updates live in Add Lead →</p>
              {readyToCreate && onCreateLead ? (
                <button
                  type="button"
                  onClick={onCreateLead}
                  disabled={createDisabled || busy}
                  className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Create Lead
                </button>
              ) : null}
            </div>
          </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
