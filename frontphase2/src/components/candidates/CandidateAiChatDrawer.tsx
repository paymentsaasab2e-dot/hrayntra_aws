'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, ArrowUp, ClipboardPaste, FileText, Loader2, Lock, MessageSquare, Sparkles, Upload, X } from 'lucide-react';
import {
  apiCandidateAiChat,
  apiGenerateCandidateDetails,
  apiParseCandidateResume,
  type ImportedProfileData,
  type LeadAiChatMessage,
} from '@/lib/api';
import {
  buildCandidateAiMissingMessage,
  computeCandidateAiInsights,
  mapParsedResumeToAiPayload,
  type CandidateAiGeneratedPayload,
  type CandidateAiInsights,
} from '@/lib/candidateAiHelpers';
import { BULK_CV_ACCEPT_INPUT, BULK_CV_FORMAT_LABEL } from '@/lib/bulkCvFileTypes';
import { DrawerCloseButton } from '../drawers/DrawerCloseButton';
import { AiCoinLockBadge, useAiCoinGate } from '../coins/AiCoinGate';
import { AiCoinLockBanner } from '../coins/TenantCoinsContext';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  docked?: boolean;
  stageMode?: boolean;
  onContinue?: () => void;
  form: Record<string, unknown>;
  onApplyGenerated: (generated: CandidateAiGeneratedPayload, sourceText: string) => void;
  /** Apply the full resume-parse payload (education rows, file attach, etc.). */
  onResumeParsed?: (data: ImportedProfileData, file: File) => void;
  onExpandSections?: () => void;
  chatHistory: LeadAiChatMessage[];
  onChatHistoryChange: (history: LeadAiChatMessage[]) => void;
};

const MAX_RESUME_FILE_BYTES = (() => {
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_RESUME_MAX_FILE_BYTES) {
    const n = parseInt(String(process.env.NEXT_PUBLIC_RESUME_MAX_FILE_BYTES).trim(), 10);
    if (Number.isFinite(n) && n >= 5 * 1024 * 1024) return n;
  }
  return 25 * 1024 * 1024;
})();
const MAX_RESUME_FILE_LABEL = `${Math.round(MAX_RESUME_FILE_BYTES / (1024 * 1024))}MB`;

export function CandidateAiChatDrawer({
  isOpen,
  onClose,
  docked = false,
  stageMode = false,
  onContinue,
  form,
  onApplyGenerated,
  onResumeParsed,
  onExpandSections,
  chatHistory,
  onChatHistoryChange,
}: Props) {
  const pasteGate = useAiCoinGate('ai.candidate_details');
  const chatGate = useAiCoinGate('ai.candidate_chat');
  const [mode, setMode] = useState<'paste' | 'chat' | 'resume'>('chat');
  const [pasteText, setPasteText] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeDropActive, setResumeDropActive] = useState(false);
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [insights, setInsights] = useState<CandidateAiInsights | null>(null);
  const [readyToCreate, setReadyToCreate] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const formFirstName = String(form.firstName || '');
  const formEmail = String(form.email || '');

  useEffect(() => {
    if (!isOpen) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 200);
    return () => window.clearTimeout(t);
  }, [isOpen, mode]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chatHistory, busy, status, isOpen]);

  const finishApply = useCallback(
    (generated: CandidateAiGeneratedPayload, sourceText: string) => {
      onApplyGenerated(generated, sourceText);
      onExpandSections?.();
      const firstName = generated.firstName || formFirstName;
      const email = generated.email || formEmail;
      setInsights(
        computeCandidateAiInsights(
          {
            firstName,
            lastName: generated.lastName || String(form.lastName || ''),
            email,
            phone: generated.phone || String(form.phone || ''),
            currentDesignation: generated.currentDesignation || String(form.currentDesignation || ''),
            currentCompany: generated.currentCompany || String(form.currentCompany || ''),
            skills: generated.skills?.length ? generated.skills : (form.skills as string[]) || [],
            summary: generated.summary || String(form.summary || ''),
            priority: generated.priority || String(form.priority || ''),
          },
          sourceText,
        ),
      );
      const missingMsg = buildCandidateAiMissingMessage({ firstName, email });
      setReadyToCreate(!missingMsg);
      setStatus(
        missingMsg ||
          (onContinue
            ? 'Details captured. Click Continue to review the filled candidate form.'
            : 'Form updated — review Add Candidate and create when ready.'),
      );
      setError('');
    },
    [form, formEmail, formFirstName, onApplyGenerated, onContinue, onExpandSections],
  );

  const runPasteExtract = async () => {
    const input = pasteText.trim();
    if (!input) {
      setError('Paste or type candidate details first.');
      return;
    }
    if (!pasteGate.confirmAndUnlock()) return;
    setBusy(true);
    setError('');
    setStatus('');
    try {
      const response = await apiGenerateCandidateDetails({
        prompt: input,
        currentForm: form,
      });
      if (!response.data) throw new Error('AI did not return candidate details');
      finishApply(response.data, input);
      setPasteText('');
      setMode('chat');
      onChatHistoryChange([
        ...chatHistory,
        { role: 'user', content: input },
        {
          role: 'assistant',
          content: 'I extracted details from your notes and filled the candidate form.',
        },
      ]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to process candidate details');
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
      const response = await apiCandidateAiChat({
        message: input,
        currentForm: form,
        history: chatHistory,
      });
      const data = response.data;
      if (!data?.reply) throw new Error('AI did not return a reply');
      onChatHistoryChange([...nextHistory, { role: 'assistant', content: data.reply }]);
      if (data.candidate) finishApply(data.candidate, input);
      if (data.readyToCreate) {
        setReadyToCreate(true);
        setStatus(
          onContinue
            ? 'Candidate looks ready. Click Continue to review the filled form.'
            : 'Candidate looks ready — review the form and create.',
        );
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'AI assistant failed');
    } finally {
      setBusy(false);
    }
  };

  const parseResumeFile = async (file: File) => {
    if (!file) return;
    if (file.size > MAX_RESUME_FILE_BYTES) {
      setError(`Resume must be ${MAX_RESUME_FILE_LABEL} or smaller.`);
      return;
    }
    setResumeFile(file);
    setBusy(true);
    setError('');
    setStatus('');
    try {
      const response = await apiParseCandidateResume(file);
      const data = response.data;
      if (!data) throw new Error('Parser did not return candidate details');
      onResumeParsed?.(data, file);
      const mapped = mapParsedResumeToAiPayload(data);
      finishApply(mapped, `Resume: ${file.name}`);
      onChatHistoryChange([
        ...chatHistory,
        { role: 'user', content: `Uploaded resume: ${file.name}` },
        {
          role: 'assistant',
          content: mapped.firstName || mapped.email
            ? `I parsed ${file.name} and filled the candidate form. Review the details, then click Continue.`
            : `I parsed ${file.name}. Please review the form and add any missing name or email.`,
        },
      ]);
      setMode('chat');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not parse resume. Try again.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!isOpen || mode !== 'chat' || chatHistory.length > 0) return;
    onChatHistoryChange([
      {
        role: 'assistant',
        content: stageMode
          ? "Hi — I'll help capture this candidate. Upload a resume, paste CV notes, or chat. When you're done, click Continue to review the filled form. What's the candidate's name?"
          : "Hi — I'll help fill the Add Candidate form. Upload a resume or tell me the candidate's name.",
      },
    ]);
  }, [chatHistory.length, isOpen, mode, onChatHistoryChange, stageMode]);

  const canContinue =
    chatHistory.some((entry) => entry.role === 'user') || Boolean(insights) || readyToCreate;

  const panelClass = stageMode
    ? 'pointer-events-auto relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-gradient-to-b from-slate-50 via-white to-indigo-50/50'
    : docked
      ? 'pointer-events-auto relative flex h-[min(70vh,520px)] w-full max-w-4xl shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl ring-1 ring-slate-900/5 lg:h-[min(92vh,920px)] lg:w-[min(100%,22rem)] lg:max-w-none'
      : 'fixed inset-y-4 left-4 z-[55] flex w-[min(100%,28rem)] flex-col overflow-hidden rounded-[24px] border border-slate-200/90 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)] ring-1 ring-slate-900/5';

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.aside
          key="candidate-ai-chat-panel"
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
                  <h2 className="text-base font-bold tracking-tight text-slate-900">AI Candidate Assistant</h2>
                  <p className="text-xs text-slate-500">Chat or paste notes to fill the Add Candidate form</p>
                </div>
              </div>
              <DrawerCloseButton onClick={onClose} />
            </div>
          )}

          <div className={`shrink-0 px-5 ${stageMode ? 'pt-1 pb-3' : 'border-b border-slate-100 py-3'}`}>
            <div className="mx-auto flex w-full max-w-2xl items-center gap-1 rounded-full bg-slate-100 p-1 ring-1 ring-slate-200">
              <button
                type="button"
                onClick={() => setMode('chat')}
                className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2.5 text-sm font-bold transition ${
                  mode === 'chat'
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20'
                    : 'bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-950'
                }`}
              >
                <MessageSquare size={15} strokeWidth={2.25} />
                Chat
              </button>
              <button
                type="button"
                onClick={() => setMode('paste')}
                className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2.5 text-sm font-bold transition ${
                  mode === 'paste'
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20'
                    : 'bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-950'
                }`}
              >
                <ClipboardPaste size={15} strokeWidth={2.25} />
                Paste notes
              </button>
              <button
                type="button"
                onClick={() => setMode('resume')}
                className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2.5 text-sm font-bold transition ${
                  mode === 'resume'
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20'
                    : 'bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-950'
                }`}
              >
                <Upload size={15} strokeWidth={2.25} />
                Upload resume
              </button>
            </div>
          </div>

          {insights ? (
            <div className="mx-5 mb-2 shrink-0 rounded-2xl bg-gradient-to-r from-indigo-50 to-violet-50 px-4 py-3 text-xs text-indigo-950 shadow-sm ring-1 ring-indigo-100">
              <p className="font-semibold">
                Profile score: {insights.score}/100 · Suggested priority: {insights.priority}
              </p>
              <p className="mt-1 text-indigo-900/90">{insights.nextAction}</p>
              <p className="text-indigo-900/75">{insights.followUpHint}</p>
            </div>
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col">
            {mode === 'resume' ? (
              <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 pb-5">
                <p className="text-sm text-slate-600">
                  Upload a resume and we&apos;ll parse it with the existing CV engine, then fill the candidate form.
                </p>
                <input
                  ref={resumeInputRef}
                  type="file"
                  accept={BULK_CV_ACCEPT_INPUT}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) void parseResumeFile(file);
                  }}
                />
                <button
                  type="button"
                  onClick={() => resumeInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setResumeDropActive(true);
                  }}
                  onDragLeave={() => setResumeDropActive(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setResumeDropActive(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) void parseResumeFile(file);
                  }}
                  disabled={busy}
                  className={`flex min-h-[220px] w-full cursor-pointer flex-col items-center justify-center rounded-[1.5rem] border-2 border-dashed px-6 text-center transition ${
                    resumeDropActive
                      ? 'border-indigo-400 bg-indigo-50/80'
                      : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40'
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {busy ? (
                    <Loader2 className="mb-3 h-8 w-8 animate-spin text-indigo-600" />
                  ) : (
                    <Upload className="mb-3 h-8 w-8 text-indigo-600" />
                  )}
                  <p className="text-sm font-semibold text-slate-800">
                    {busy ? 'Parsing resume…' : 'Drag resume here or click to browse'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {BULK_CV_FORMAT_LABEL} · Max {MAX_RESUME_FILE_LABEL}
                  </p>
                </button>
                {resumeFile ? (
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{resumeFile.name}</p>
                      <p className="text-xs text-slate-500">
                        {busy ? 'Extracting candidate details…' : 'Parsed — review the form and continue'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setResumeFile(null)}
                      disabled={busy}
                      className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                      aria-label="Remove resume"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : null}
                {status ? (
                  <p className="rounded-2xl bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-100">{status}</p>
                ) : null}
                {error ? (
                  <p className="rounded-2xl bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-100">{error}</p>
                ) : null}
              </div>
            ) : mode === 'paste' ? (
              <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 pb-5">
                <p className="text-sm text-slate-600">
                  Paste CV text, WhatsApp notes, or a recruiter brief — we&apos;ll extract name, email, role, skills, and more.
                </p>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  rows={10}
                  disabled={busy}
                  placeholder={`Tell me about this candidate…\n\nExample:\nName: Priya Sharma\nEmail: priya@gmail.com\nPhone: 9876543210\nRole: Senior React Developer at BluePeak\nLocation: Bengaluru, Karnataka\nSkills: React, TypeScript, Node.js\nNotice: 30 days`}
                  className="w-full flex-1 resize-none rounded-3xl border-0 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
                <AiCoinLockBanner featureId="ai.candidate_details" className="mb-1" />
                <button
                  type="button"
                  onClick={() => void runPasteExtract()}
                  disabled={busy || !pasteText.trim()}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white shadow-md disabled:cursor-not-allowed disabled:opacity-60 ${
                    pasteGate.locked
                      ? 'bg-slate-500 hover:bg-slate-600'
                      : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-indigo-500/25'
                  }`}
                >
                  {pasteGate.locked ? <Lock size={14} /> : null}
                  {busy ? 'Analyzing…' : 'Analyze & fill form'}
                  <AiCoinLockBadge featureId="ai.candidate_details" />
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
                        className={`whitespace-pre-wrap rounded-3xl px-4 py-3 text-sm leading-6 shadow-sm ${
                          entry.role === 'assistant'
                            ? 'rounded-tl-lg bg-white text-slate-700 ring-1 ring-slate-100'
                            : 'rounded-tr-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-white'
                        }`}
                      >
                        {entry.content}
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
                  <AiCoinLockBanner featureId="ai.candidate_chat" className="mb-2" />
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
                          : 'Name, email, role, or paste CV notes…'
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
                    >
                      {chatGate.locked ? <Lock size={14} /> : <ArrowUp size={18} />}
                      <AiCoinLockBadge featureId="ai.candidate_chat" className="absolute -right-1 -top-1" />
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
                    : 'Chat, paste notes, or upload a resume, then continue.'
                  : 'Form updates live in Add Candidate →'}
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
            ) : null}
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
