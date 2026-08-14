'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, ArrowUp, Lock, MessageSquare, Sparkles } from 'lucide-react';
import type { AddLeadFormData } from '../drawers/LeadDetailsDrawer';
import { apiGenerateLeadDetails, apiLeadAiChat, type LeadAiChatMessage } from '@/lib/api';
import {
  buildLeadAiMissingMessage,
  computeLeadAiInsights,
  type LeadAiGeneratedPayload,
  type LeadAiInsights,
} from '@/lib/leadAiHelpers';
import { DrawerCloseButton } from '../drawers/DrawerCloseButton';
import { LeadAiChatMessageContent } from './LeadAiChatMessageContent';
import { AiCoinLockBadge, useAiCoinGate } from '../coins/AiCoinGate';
import { AiCoinLockBanner } from '../coins/TenantCoinsContext';

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
  /** When true, sits beside Add Lead modal instead of a separate left floating panel. */
  docked?: boolean;
  /** Full-modal first stage: chat only, then Continue to review the filled form. */
  stageMode?: boolean;
  onContinue?: () => void;
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
  docked = false,
  stageMode = false,
  onContinue,
}: Props) {
  const pasteGate = useAiCoinGate('ai.lead_details');
  const chatGate = useAiCoinGate('ai.lead_chat');
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
          (onContinue
            ? 'Details captured. Click Continue to review the filled lead form.'
            : 'Form updated — review the Add Lead drawer and click Create Lead when ready.'),
      );
      setError('');
    },
    [form, onApplyGenerated, onExpandSections, onContinue],
  );

  const runPasteExtract = async () => {
    const input = pasteText.trim();
    if (!input) {
      setError('Paste or type lead details first.');
      return;
    }
    if (!pasteGate.confirmAndUnlock()) return;
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
    if (!chatGate.confirmAndUnlock()) return;
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
        setStatus(
          onContinue
            ? 'Lead looks ready. Click Continue to review the filled form.'
            : 'Lead looks ready — review the form and create the lead.',
        );
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
        content: stageMode
          ? "Hi — I'm your lead assistant. Tell me about the company or paste notes from email/WhatsApp. I'll collect the details here. When you're done chatting, click Continue and I'll show the filled Add Lead form for you to review."
          : "Hi — I'm your lead assistant. Tell me about the company or paste notes from email/WhatsApp. I'll fill Company, Director, Team Member, Location, Industry, Source, Status, Interest Level, Follow-up, Services, and Business Value as we go. Only Company name and Director email are required — everything else is optional. What's the company name?",
      },
    ]);
  };

  useEffect(() => {
    if (isOpen && mode === 'chat') {
      startChatIfEmpty();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mode]);

  const canContinue =
    chatHistory.some((entry) => entry.role === 'user') || Boolean(insights) || readyToCreate;

  const panelClass = stageMode
    ? 'pointer-events-auto relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-gradient-to-b from-slate-50 via-white to-indigo-50/50'
    : docked
      ? 'pointer-events-auto relative flex h-[min(70vh,520px)] w-full max-w-4xl shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl ring-1 ring-slate-900/5 lg:h-[min(90vh,880px)] lg:w-[min(100%,22rem)] lg:max-w-none'
      : 'fixed inset-y-4 left-4 z-[56] flex w-[min(100%,28rem)] flex-col overflow-hidden rounded-[24px] border border-slate-200/90 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)] ring-1 ring-slate-900/5';

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.aside
          key="lead-ai-chat-panel"
          initial={stageMode ? { opacity: 0, y: 8 } : docked ? { opacity: 0, x: -16 } : { x: '-100%', opacity: 0.9 }}
          animate={stageMode ? { opacity: 1, y: 0 } : docked ? { opacity: 1, x: 0 } : { x: 0, opacity: 1 }}
          exit={stageMode ? { opacity: 0, y: 8 } : docked ? { opacity: 0, x: -16 } : { x: '-100%', opacity: 0.9 }}
          transition={{ type: 'spring', damping: 28, stiffness: 260 }}
          className={panelClass}
          onClick={(e) => e.stopPropagation()}
        >
            {stageMode ? null : (
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-b from-white to-slate-50/50 px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
                    <Sparkles size={18} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-bold tracking-tight text-slate-900">AI Lead Assistant</h2>
                    <p className="text-xs text-slate-500">Fills company, contact, location, source, services & more</p>
                  </div>
                </div>
                <DrawerCloseButton onClick={onClose} />
              </div>
            )}

            <div className={`shrink-0 px-5 ${stageMode ? 'pt-1 pb-3' : 'border-b border-slate-100 py-3'}`}>
              <div className="mx-auto flex w-full max-w-xl items-center rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-200/80">
                <button
                  type="button"
                  onClick={() => setMode('chat')}
                  className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition ${
                    mode === 'chat'
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <MessageSquare size={14} />
                  Chat
                </button>
                <button
                  type="button"
                  onClick={() => setMode('paste')}
                  className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold transition ${
                    mode === 'paste'
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Paste notes
                </button>
              </div>
            </div>

            {insights ? (
              <div className="mx-5 mb-2 shrink-0 rounded-2xl bg-gradient-to-r from-indigo-50 to-violet-50 px-4 py-3 text-xs text-indigo-950 shadow-sm ring-1 ring-indigo-100">
                <p className="font-semibold">
                  Lead score: {insights.score}/100 · Suggested priority: {insights.priority}
                </p>
                <p className="mt-1 text-indigo-900/90">{insights.nextAction}</p>
                <p className="text-indigo-900/75">{insights.followUpHint}</p>
              </div>
            ) : null}

            <div className="flex min-h-0 flex-1 flex-col">
              {mode === 'paste' ? (
                <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 pb-5">
                  <p className="text-sm text-slate-600">
                    Paste unstructured text — meeting notes, WhatsApp, or email — and we&apos;ll extract company,
                    director, team member, location, industry, source, follow-up, services, and business value.
                  </p>
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    rows={10}
                    disabled={busy}
                    placeholder={`Example:\nCompany: ABC Technologies\nWebsite: https://abc.com | LinkedIn: https://linkedin.com/company/abc\nDirector: Rajesh Sharma (CEO) — rajesh@abc.com, +91 9876543210\nTeam member: Priya Nair — priya@abc.com\nLocation: Bengaluru, Karnataka, India\nIndustry: Technology | Source: Website\nServices: Executive placement, ATS\nExpected value: ₹10 lakh annual\nFollow-up: 20/06/2026 10:00 AM\nAssign to: Sarah Chen`}
                    className="w-full flex-1 resize-none rounded-3xl border-0 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                  <AiCoinLockBanner featureId="ai.lead_details" className="mb-1" />
                  <button
                    type="button"
                    onClick={() => void runPasteExtract()}
                    disabled={busy || !pasteText.trim()}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white shadow-md disabled:cursor-not-allowed disabled:opacity-60 ${
                      pasteGate.locked
                        ? 'bg-slate-500 hover:bg-slate-600'
                        : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-indigo-500/25'
                    }`}
                    title={
                      pasteGate.locked
                        ? `Locked — needs ${pasteGate.cost} coins`
                        : `Spend ${pasteGate.cost} coins to unlock`
                    }
                  >
                    {pasteGate.locked ? <Lock size={14} /> : null}
                    {busy ? 'Analyzing…' : 'Analyze & fill form'}
                    <AiCoinLockBadge featureId="ai.lead_details" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-4">
                    {chatHistory.map((entry, index) => (
                      <div
                        key={`${entry.role}-${index}`}
                        className={`flex max-w-[88%] gap-2.5 ${
                          entry.role === 'assistant' ? 'items-start' : 'ml-auto justify-end'
                        }`}
                      >
                        {entry.role === 'assistant' ? (
                          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/20">
                            <Sparkles size={14} />
                          </span>
                        ) : null}
                        <div
                          className={`rounded-3xl px-4 py-3 text-sm leading-6 shadow-sm ${
                            entry.role === 'assistant'
                              ? 'rounded-tl-lg bg-white text-slate-700 ring-1 ring-slate-100'
                              : 'rounded-tr-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-white'
                          }`}
                        >
                          <LeadAiChatMessageContent content={entry.content} role={entry.role} />
                        </div>
                      </div>
                    ))}
                    {busy ? (
                      <div className="inline-flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-xs text-slate-500 shadow-sm ring-1 ring-slate-100">
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
                        Thinking…
                      </div>
                    ) : null}
                    <div ref={chatEndRef} />
                  </div>

                  <div className="shrink-0 px-5 pb-4">
                    {status ? (
                      <p className="mb-2 rounded-2xl bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-100">
                        {status}
                      </p>
                    ) : null}
                    {error ? (
                      <p className="mb-2 rounded-2xl bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-100">
                        {error}
                      </p>
                    ) : null}
                    <AiCoinLockBanner featureId="ai.lead_chat" className="mb-2" />
                    <div className="flex items-end gap-2 rounded-[28px] bg-white p-2 shadow-[0_12px_40px_-18px_rgba(79,70,229,0.45)] ring-1 ring-slate-200/80">
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
                        placeholder={
                          chatGate.locked
                            ? `Locked — needs ${chatGate.cost} coins to chat`
                            : 'Describe the company, contact, or paste notes…'
                        }
                        className="min-h-[52px] flex-1 resize-none rounded-3xl border-0 bg-transparent px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => void runChatTurn()}
                        disabled={busy || !chatInput.trim()}
                        className={`relative mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-md transition disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none ${
                          chatGate.locked
                            ? 'bg-amber-500 hover:bg-amber-600'
                            : 'bg-gradient-to-br from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-indigo-500/30'
                        }`}
                        aria-label="Send"
                        title={
                          chatGate.locked
                            ? `Locked — needs ${chatGate.cost} coins`
                            : `Spend ${chatGate.cost} coins`
                        }
                      >
                        {chatGate.locked ? <Lock size={14} /> : <ArrowUp size={18} />}
                        <AiCoinLockBadge featureId="ai.lead_chat" className="absolute -right-1 -top-1" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-5">
              <p className="text-xs text-slate-500">
                {stageMode
                  ? canContinue
                    ? 'Ready — continue to review the filled form.'
                    : 'Chat or paste notes, then continue.'
                  : 'Form updates live in Add Lead →'}
              </p>
              {stageMode && onContinue ? (
                <button
                  type="button"
                  onClick={onContinue}
                  disabled={!canContinue || busy}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : readyToCreate && onCreateLead ? (
                <button
                  type="button"
                  onClick={onCreateLead}
                  disabled={createDisabled || busy}
                  className="inline-flex items-center rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
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
