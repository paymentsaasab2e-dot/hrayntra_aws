'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUp, Lock, MessageSquare, Sparkles } from 'lucide-react';
import {
  apiClientAiChat,
  apiGenerateClientDetails,
  type LeadAiChatMessage,
} from '@/lib/api';
import {
  buildClientAiMissingMessage,
  clientAiHasAgreementData,
  clientAiHasKycData,
  computeClientAiInsights,
  type ClientAiGeneratedPayload,
  type ClientAiInsights,
} from '@/lib/clientAiHelpers';
import { DrawerCloseButton } from '../drawers/DrawerCloseButton';
import { AiCoinLockBadge, useAiCoinGate } from '../coins/AiCoinGate';
import { AiCoinLockBanner } from '../coins/TenantCoinsContext';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  form: Record<string, unknown>;
  onApplyGenerated: (generated: ClientAiGeneratedPayload, sourceText: string) => void;
  onExpandSections: () => void;
  chatHistory: LeadAiChatMessage[];
  onChatHistoryChange: (history: LeadAiChatMessage[]) => void;
  onCreateClient?: () => void;
  createDisabled?: boolean;
};

export function ClientAiChatDrawer({
  isOpen,
  onClose,
  form,
  onApplyGenerated,
  onExpandSections,
  chatHistory,
  onChatHistoryChange,
  onCreateClient,
  createDisabled = false,
}: Props) {
  const pasteGate = useAiCoinGate('ai.client_details');
  const chatGate = useAiCoinGate('ai.client_chat');
  const [mode, setMode] = useState<'paste' | 'chat'>('chat');
  const [pasteText, setPasteText] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [insights, setInsights] = useState<ClientAiInsights | null>(null);
  const [readyToCreate, setReadyToCreate] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const formCompany = String(form.companyName || '');
  const formDirector = String(form.directorName || '');
  const formEmail = String(form.contactEmail || form.email || '');

  useEffect(() => {
    if (!isOpen) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 200);
    return () => window.clearTimeout(t);
  }, [isOpen, mode]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chatHistory, busy, status, isOpen]);

  const finishApply = useCallback(
    (generated: ClientAiGeneratedPayload, sourceText: string) => {
      onApplyGenerated(generated, sourceText);
      onExpandSections();
      setInsights(
        computeClientAiInsights(
          {
            companyName: generated.companyName || formCompany,
            directorName: generated.directorName || formDirector,
            email: generated.email || formEmail,
            phone: generated.phone || String(form.contactPhone || ''),
            servicesNeeded: generated.servicesNeeded || String(form.servicesNeeded || ''),
            expectedBusinessValue:
              generated.expectedBusinessValue || String(form.expectedBusinessValue || ''),
            website: generated.website || String(form.website || ''),
            linkedIn: generated.linkedIn || String(form.linkedin || ''),
            nextFollowUpDue: generated.nextFollowUpDue || String(form.nextFollowUpDue || ''),
            priority: generated.priority || String(form.priority || ''),
          },
          sourceText,
        ),
      );
      const missingMsg = buildClientAiMissingMessage({
        companyName: generated.companyName || formCompany,
        directorName: generated.directorName || formDirector,
        email: generated.email || formEmail,
        contactEmail: formEmail,
      });
      setReadyToCreate(!missingMsg);
      const sectionHints: string[] = ['Client Information'];
      if (clientAiHasAgreementData(generated)) sectionHints.push('Agreements & Terms');
      if (clientAiHasKycData(generated)) sectionHints.push('KYC Form');
      setStatus(
        missingMsg ||
          `Updated ${sectionHints.join(', ')} — upload logo/agreement/KYC files manually if needed, then click Create Client.`,
      );
      setError('');
    },
    [formCompany, formDirector, formEmail, form, onApplyGenerated, onExpandSections],
  );

  const runPasteExtract = async () => {
    const input = pasteText.trim();
    if (!input) {
      setError('Paste or type client details first.');
      return;
    }
    if (!pasteGate.confirmAndUnlock()) return;
    setBusy(true);
    setError('');
    setStatus('');
    try {
      const response = await apiGenerateClientDetails({
        prompt: input,
        currentForm: form,
      });
      if (!response.data) throw new Error('AI did not return client details');
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
      setError(err instanceof Error ? err.message : 'Failed to process client details');
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
      const response = await apiClientAiChat({
        message: input,
        currentForm: form,
        history: chatHistory,
      });
      const data = response.data;
      if (!data?.reply) throw new Error('AI did not return a reply');
      onChatHistoryChange([...nextHistory, { role: 'assistant', content: data.reply }]);
      if (data.client) {
        finishApply(data.client, input);
      }
      if (data.readyToCreate) {
        setReadyToCreate(true);
        setStatus('Client looks ready — review the form and create the client.');
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
          "Hi — I'll help fill Client Information, Agreements & Terms, and KYC text fields (not file uploads). What's the company name?",
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
        <>
          <motion.div
            key="client-ai-chat-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[54] bg-slate-900/20 backdrop-blur-[1px] pointer-events-none"
          />
          <motion.aside
            key="client-ai-chat-panel"
            initial={{ x: '-100%', opacity: 0.9 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-100%', opacity: 0.9 }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="fixed inset-y-4 left-4 z-[55] flex w-[min(100%,28rem)] flex-col overflow-hidden rounded-[24px] border border-slate-200/90 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)] ring-1 ring-slate-900/5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-b from-white to-slate-50/50 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
                  <Sparkles size={18} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold tracking-tight text-slate-900">AI Client Assistant</h2>
                  <p className="text-xs text-slate-500">Chat fills the Add Client form as you go</p>
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
                  Client score: {insights.score}/100 · Suggested priority: {insights.priority}
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
                    placeholder={`Tell me about this client…\n\nExample:\nCompany: ABC Technologies\nContact: Rajesh Sharma, rajesh@abc.com, 9876543210\nTeam member: Priya Nair, priya@abc.com\nLocation: Bangalore, India\nServices: ATS + RPO | EBV: ₹15 lakh\nAgreement: 8.5% service charge, 30% advance, 3 months replacement\nKYC: Trade name ABC Tech, GSTIN 29AAAAA0000A1Z5\nBank: HDFC, IBAN AE07..., Signatory: Rajesh Sharma`}
                    className="w-full flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                  <AiCoinLockBanner featureId="ai.client_details" className="mb-1" />
                  <button
                    type="button"
                    onClick={() => void runPasteExtract()}
                    disabled={busy || !pasteText.trim()}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${
                      pasteGate.locked ? 'bg-slate-500 hover:bg-slate-600' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                    title={
                      pasteGate.locked
                        ? `Locked — needs ${pasteGate.cost} coins`
                        : `Spend ${pasteGate.cost} coins to unlock`
                    }
                  >
                    {pasteGate.locked ? <Lock size={14} /> : null}
                    {busy ? 'Analyzing…' : 'Analyze & fill form'}
                    <AiCoinLockBadge featureId="ai.client_details" />
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
                    <AiCoinLockBanner featureId="ai.client_chat" className="mb-2" />
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
                        placeholder={
                          chatGate.locked
                            ? `Locked — needs ${chatGate.cost} coins to chat`
                            : 'Reply to continue…'
                        }
                        className="min-h-[48px] flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                      <button
                        type="button"
                        onClick={() => void runChatTurn()}
                        disabled={busy || !chatInput.trim()}
                        className={`relative flex h-11 min-w-[2.75rem] shrink-0 items-center justify-center gap-1 rounded-full px-2 text-white disabled:bg-slate-300 ${
                          chatGate.locked ? 'bg-amber-600 hover:bg-amber-700' : 'bg-slate-900 hover:bg-slate-800'
                        }`}
                        aria-label="Send"
                        title={
                          chatGate.locked
                            ? `Locked — needs ${chatGate.cost} coins`
                            : `Spend ${chatGate.cost} coins`
                        }
                      >
                        {chatGate.locked ? <Lock size={14} /> : <ArrowUp size={18} />}
                        <AiCoinLockBadge featureId="ai.client_chat" className="absolute -right-1 -top-1" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-3">
              <p className="text-[11px] text-slate-500">Form updates live in Add Client →</p>
              {readyToCreate && onCreateClient ? (
                <button
                  type="button"
                  onClick={onCreateClient}
                  disabled={createDisabled || busy}
                  className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Create Client
                </button>
              ) : null}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
