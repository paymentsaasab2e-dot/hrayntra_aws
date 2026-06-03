'use client';

import { Loader2, Send } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  apiAssistantChat,
  apiExecuteUndo,
  buildApiUrl,
  type AriaUndoPayload,
  type AssistantChatMessage,
  type AssistantHistoryRecord,
  type AssistantStructuredResponse,
} from '../lib/api';

export type UiChatMessage = AssistantChatMessage & {
  id: string;
  structured?: AssistantStructuredResponse;
  undoPayload?: AriaUndoPayload;
};
export type AssistantPromptSuggestion = {
  label: string;
  prompt: string;
  description?: string;
};

const PROMPT_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bgenarte\b/gi, 'generate'],
  [/\bgenarate\b/gi, 'generate'],
  [/\brecommnedations\b/gi, 'recommendations'],
  [/\brpompt\b/gi, 'prompt'],
  [/\bpromt\b/gi, 'prompt'],
  [/\btyype\b/gi, 'type'],
  [/\bmisteka\b/gi, 'mistake'],
  [/\brelelavncy\b/gi, 'relevance'],
  [/\bclinet\b/gi, 'client'],
  [/\bcanddiate\b/gi, 'candidate'],
  [/\bcomapny\b/gi, 'company'],
  [/\bther\b/gi, 'there'],
  [/\bai assitnat\b/gi, 'AI assistant'],
  [/\bextartc\b/gi, 'extract'],
];

function normalizePromptInput(value: string) {
  let next = String(value || '').replace(/\s+/g, ' ').trimStart();
  for (const [pattern, replacement] of PROMPT_REPLACEMENTS) {
    next = next.replace(pattern, replacement);
  }
  next = next.replace(/\bi\b/g, 'I');
  next = next.replace(/\bai\b/g, 'AI');
  next = next.replace(/\breports page\b/i, 'reports page');
  return next;
}

function tokenize(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

function rankSuggestions(input: string, suggestions: AssistantPromptSuggestion[]) {
  const tokens = tokenize(input);
  if (!tokens.length) return suggestions.slice(0, 6);

  return [...suggestions]
    .map((suggestion) => {
      const haystack = `${suggestion.label} ${suggestion.prompt} ${suggestion.description || ''}`.toLowerCase();
      const score = tokens.reduce((total, token) => total + (haystack.includes(token) ? 1 : 0), 0);
      return { suggestion, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.suggestion)
    .slice(0, 6);
}

function renderMessageWithLinks(content: string) {
  const base = buildApiUrl('/').replace(/\/api\/v1\/?$/, '').replace(/\/api\/proxy\/?$/, '');
  const parts = content.split(/(\/uploads\/[^\s]+)/g);
  return parts.map((part, index) => {
    if (/^\/uploads\/[^\s]+/.test(part)) {
      const href = `${base}${part}`;
      return (
        <a
          key={`${part}-${index}`}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="font-semibold underline underline-offset-2"
        >
          {part}
        </a>
      );
    }
    return <React.Fragment key={`${index}`}>{part}</React.Fragment>;
  });
}

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface AssistantChatPanelProps {
  pageKey?: string;
  pathname?: string;
  recommendations?: AssistantPromptSuggestion[];
  capabilities?: string[];
  externalPrompt?: string | null;
  externalPromptToken?: number;
  messages: UiChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<UiChatMessage[]>>;
  onHistorySync?: (history: AssistantHistoryRecord | null, structured?: AssistantStructuredResponse | null) => void;
}

function getInlineExportDatasets(content: string) {
  const normalized = String(content || '').toLowerCase();
  if (!normalized.includes('generate the same data as csv, excel, or pdf')) return [];

  const datasetMatch =
    content.match(/for\s+([a-z ,&-]+)\./i) ||
    content.match(/Here is the live database report from the assistant for\s+([a-z ,&-]+)\./i);

  const datasetText = datasetMatch?.[1]?.trim();
  if (!datasetText) return [];

  return datasetText
    .split(/[,&]/)
    .map((value) => value.trim().toLowerCase())
    .map((value) => {
      if (value === 'client') return 'clients';
      if (value === 'job') return 'jobs';
      if (value === 'lead') return 'leads';
      if (value === 'candidate') return 'candidates';
      if (value === 'interview') return 'interviews';
      if (value === 'placement') return 'placements';
      if (value === 'task') return 'tasks';
      if (value === 'team') return 'team';
      return value;
    })
    .filter(Boolean);
}

function getInlineExportPrompt(dataset: string, format: 'csv' | 'excel' | 'pdf') {
  if (!dataset) return null;
  return `Generate ${format.toUpperCase()} report for ${dataset}`;
}

function suggestionToPrompt(suggestion: { label?: string; action?: string; params?: Record<string, any> }) {
  const action = String(suggestion?.action || '').toUpperCase();
  const params = suggestion?.params || {};
  if (action === 'PROMPT' && params.text) return String(params.text);
  if (action === 'UPDATE_LEAD' && params.leadId) return `update lead ${params.leadId}`;
  if (action === 'CREATE_LEAD_FORCE') return 'create lead anyway';
  if (action === 'ASSIGN_LEAD' && params.leadId) return `assign lead ${params.leadId}`;
  if (action === 'CONVERT_LEAD' && params.leadId) return `convert lead ${params.leadId}`;
  return String(params.text || suggestion?.label || '').trim();
}

export function AssistantChatPanel({
  pageKey,
  pathname,
  recommendations = [],
  capabilities = [],
  externalPrompt,
  externalPromptToken,
  messages,
  setMessages,
  onHistorySync,
}: AssistantChatPanelProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [undoStatus, setUndoStatus] = useState<Record<string, 'available' | 'loading' | 'done' | 'expired'>>({});
  const [undoCountdowns, setUndoCountdowns] = useState<Record<string, number>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<UiChatMessage[]>(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, error]);

  useEffect(() => {
    if (!externalPrompt) return;
    setInput(externalPrompt);
    textareaRef.current?.focus();
  }, [externalPrompt, externalPromptToken]);

  useEffect(() => {
    const timers: ReturnType<typeof setInterval>[] = [];

    messages.forEach((m) => {
      const payload = m.structured?.undoPayload;
      if (
        payload?.available &&
        payload.actionId &&
        payload.expiresInSeconds &&
        undoStatus[payload.actionId] !== 'done'
      ) {
        const actionId = payload.actionId;
        if (undoCountdowns[actionId] === undefined) {
          setUndoCountdowns((prev) => ({
            ...prev,
            [actionId]: payload.expiresInSeconds,
          }));
        }
        const timer = setInterval(() => {
          setUndoCountdowns((prev) => {
            const current = prev[actionId] ?? 0;
            if (current <= 1) {
              clearInterval(timer);
              setUndoStatus((s) => ({ ...s, [actionId]: 'expired' }));
              return { ...prev, [actionId]: 0 };
            }
            return { ...prev, [actionId]: current - 1 };
          });
        }, 1000);
        timers.push(timer);
      }
    });

    return () => timers.forEach(clearInterval);
  }, [messages]);

  const refinedInput = normalizePromptInput(input);
  const liveRecommendations = rankSuggestions(refinedInput, recommendations);

  const send = useCallback(async (prefilledText?: string) => {
    const text = (prefilledText ?? input).trim();
    if (!text || loading) return;
    setError(null);
    if (!prefilledText) {
      setInput('');
    }
    const userMsg: UiChatMessage = { id: newId(), role: 'user', content: text };
    const nextThread = [...messagesRef.current, userMsg];
    messagesRef.current = nextThread;
    setMessages(nextThread);
    setLoading(true);
    try {
      const payload: AssistantChatMessage[] = nextThread.map(({ role, content }) => ({ role, content }));
      const res = await apiAssistantChat({ messages: payload, pageKey, pathname });
      const reply = res.data?.message;
      if (!reply) throw new Error('No reply from ARIA');
      const withAssistant = [...messagesRef.current, {
        id: newId(),
        role: 'assistant' as const,
        content: reply,
        structured: res.data?.structured,
      }];
      messagesRef.current = withAssistant;
      setMessages(withAssistant);

      if (res.data?.structured?.uiPayload) {
        window.dispatchEvent(new CustomEvent('aria-ui-payload', { detail: res.data.structured.uiPayload }));
      }

      onHistorySync?.(res.data?.history || null, res.data?.structured || null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Something went wrong';
      setError(msg);
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }, [input, loading, onHistorySync, pageKey, pathname, setMessages]);

  const handleUndo = async (actionId: string) => {
    if (
      !actionId ||
      undoStatus[actionId] === 'loading' ||
      undoStatus[actionId] === 'done'
    ) return;

    try {
      setUndoStatus(prev => ({ ...prev, [actionId]: 'loading' }));

      const res = await apiExecuteUndo(actionId);

      if (res.data?.success) {
        setUndoStatus(prev => ({ ...prev, [actionId]: 'done' }));

        if (res.data?.uiReverse) {
          window.dispatchEvent(
            new CustomEvent('aria-ui-payload', {
              detail: { type: 'REVERSE', ...res.data.uiReverse },
            })
          );
        }

        const undoneMsg: UiChatMessage = {
          id: newId(),
          role: 'assistant',
          content: '↩ Action undone successfully.',
          structured: {
            intent: 'UNDO_SUCCESS',
            module: '',
            currentPage: '',
            isBulk: false,
            recordCount: 0,
            clarificationNeeded: false,
            clarificationQuestion: null,
            sessionId: '',
            memoryUpdated: false,
            actions: [],
            result: {
              status: 'SUCCESS',
              created: 0,
              updated: 0,
              deleted: 0,
              skipped: 0,
              failed: 0,
              records: [],
              errors: [],
            },
            chatOutput: {
              headline: '↩ Undone ✓',
              summary: 'The action has been reversed successfully.',
              details: [
                { label: 'Status', value: 'Rolled back successfully' },
                { label: 'Action ID', value: actionId },
              ],
              warnings: [],
              aiInsights: [],
              undoLine: '',
              suggestions: [
                {
                  label: 'Re-add this record',
                  action: 'OPEN_DRAWER',
                  params: {},
                },
              ],
            },
          } as AssistantStructuredResponse,
        };

        setMessages(prev => [...prev, undoneMsg]);

      } else {
        throw new Error(res.data?.message || 'Undo failed on server');
      }
    } catch (e) {
      console.error('[ARIA] Undo failed:', e);
      setUndoStatus(prev => ({ ...prev, [actionId]: 'available' }));
      setError(
        'Undo failed — the action may have expired (10 min limit) or the server rejected it.'
      );
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-[200px] flex-1 space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/80 p-3">
        {capabilities.length > 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">What AI Can Do Here</p>
            <div className="mt-3 space-y-2">
              {capabilities.map((capability) => (
                <div key={capability} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {capability}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {messages.length === 0 ? (
          <p className="px-1 text-sm leading-relaxed text-slate-600">
            Ask for planning, live data checks, workflow help, lead-to-placement execution guidance, or task follow-up.
            The assistant keeps page-wise memory and can continue ongoing recruiting workflows. Press{' '}
            <kbd className="rounded bg-white px-1.5 py-0.5 text-xs shadow-sm">Enter</kbd> to send,{' '}
            <kbd className="rounded bg-white px-1.5 py-0.5 text-xs shadow-sm">Shift+Enter</kbd> for a new line.
          </p>
        ) : null}
        {messages.map((m) => (
          (() => {
            const exportDatasets = m.role === 'assistant' ? getInlineExportDatasets(m.content) : [];
            return (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm ${
                    m.role === 'user'
                      ? 'rounded-tr-sm bg-blue-600 text-white'
                      : 'rounded-tl-sm border border-slate-200 bg-white text-slate-800'
                  }`}
                >
                  {m.role === 'assistant' && m.structured?.chatOutput ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                        <span className="text-base">✳️</span>
                        <h3 className="font-bold text-slate-900">{m.structured.chatOutput.headline}</h3>
                      </div>

                      <p className="text-xs font-medium text-slate-500">{m.structured.chatOutput.summary}</p>
                      {m.structured.clarificationNeeded && m.structured.clarificationQuestion ? (
                        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">
                          {m.structured.clarificationQuestion}
                        </div>
                      ) : null}

                      <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-2 text-[13px]">
                        <div className="grid grid-cols-[100px_1fr] gap-x-3 gap-y-1.5">
                          {m.structured.chatOutput.details.map((detail, idx) => (
                            <React.Fragment key={idx}>
                              <div className="font-medium text-slate-400">{detail.label}</div>
                              <div className="font-semibold text-slate-700">{detail.value}</div>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>

                      {m.structured.chatOutput.bulkRows &&
                        m.structured.chatOutput.bulkRows.length > 0 && (
                        <div className="mt-2 space-y-1 rounded-xl border border-slate-100 bg-slate-50/50 p-2">
                          {m.structured.chatOutput.bulkRows.map((row, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2 text-[12px]"
                            >
                              <span className={
                                row.status === 'created'
                                  ? 'text-green-600'
                                  : row.status === 'skipped'
                                  ? 'text-amber-600'
                                  : 'text-red-600'
                              }>
                                {row.status === 'created'
                                  ? '✅'
                                  : row.status === 'skipped'
                                  ? '⚠️'
                                  : '❌'}
                              </span>
                              <span className="font-medium text-slate-700">
                                {row.label}
                              </span>
                              {row.id && (
                                <span className="text-slate-400">
                                  [{row.id}]
                                </span>
                              )}
                              {row.reason && (
                                <span className="text-slate-400 italic">
                                  — {row.reason}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {m.structured.chatOutput.warnings && m.structured.chatOutput.warnings.length > 0 && (
                        <div className="space-y-1 rounded-xl border border-orange-100 bg-orange-50/50 p-2">
                          {m.structured.chatOutput.warnings.map((warning, idx) => (
                            <div key={idx} className="flex gap-2 text-xs font-medium text-orange-700">
                              <span className="shrink-0">⚠️</span>
                              <span>{warning}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {m.structured.chatOutput.aiInsights && m.structured.chatOutput.aiInsights.length > 0 && (
                        <div className="space-y-1.5 px-1">
                          {m.structured.chatOutput.aiInsights.map((insight, idx) => (
                            <div key={idx} className="flex gap-2 text-xs text-slate-600">
                              <span className="shrink-0 text-blue-500">💡</span>
                              <span>{insight}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {m.role === 'assistant' && exportDatasets.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {exportDatasets.flatMap((dataset) =>
                            (['csv', 'excel', 'pdf'] as const).map((format) => {
                              const prompt = getInlineExportPrompt(dataset, format);
                              if (!prompt) return null;
                              return (
                                <button
                                  key={`${m.id}-${dataset}-${format}`}
                                  type="button"
                                  onClick={() => void send(prompt)}
                                  disabled={loading}
                                  className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100 disabled:opacity-60"
                                >
                                  {format.toUpperCase()} {dataset}
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}

                      {m.role === 'assistant' && (m.structured.undoPayload?.available || m.structured.chatOutput.undoLine) && (
                        <div className="mt-4 flex animate-pulse items-center justify-between gap-3 border-t border-slate-100 pt-3">
                          <p className="text-[11px] font-bold text-amber-600">
                            {(() => {
                              const actionId = m.structured?.undoPayload?.actionId;
                              const secs = actionId
                                ? (undoCountdowns[actionId] ??
                                   m.structured?.undoPayload?.expiresInSeconds ?? 600)
                                : 600;
                              const mins = Math.floor(secs / 60);
                              const seconds = secs % 60;
                              const display = `${mins}:${String(seconds).padStart(2, '0')}`;
                              return `↩ Undo available — expires in ${display} ⏱`;
                            })()}
                          </p>
                          {m.structured.undoPayload && undoStatus[m.structured.undoPayload.actionId] === 'expired' ? (
                            <span className="text-[11px] font-bold text-slate-300">
                              EXPIRED
                            </span>
                          ) : m.structured.undoPayload && undoStatus[m.structured.undoPayload.actionId] !== 'done' ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (m.structured?.undoPayload) {
                                  void handleUndo(m.structured.undoPayload.actionId);
                                }
                              }}
                              disabled={undoStatus[m.structured.undoPayload.actionId] === 'loading'}
                              className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm ring-1 ring-red-200 transition-all hover:bg-red-700 hover:shadow-md disabled:opacity-50"
                            >
                              {undoStatus[m.structured.undoPayload.actionId] === 'loading' ? 'WAIT...' : 'UNDO'}
                            </button>
                          ) : (
                            <span className="text-[11px] font-bold text-slate-400">UNDONE ✓</span>
                          )}
                        </div>
                      )}

                      {m.structured.chatOutput.suggestions && m.structured.chatOutput.suggestions.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2 pt-2">
                          {m.structured.chatOutput.suggestions.map((s, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                const prompt = suggestionToPrompt(s);
                                if (prompt) void send(prompt);
                              }}
                              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-medium text-blue-600 shadow-sm transition hover:border-blue-300 hover:bg-blue-50"
                            >
                              → {s.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{renderMessageWithLinks(m.content)}</p>
                  )}
                </div>
              </div>
            );
          })()
        ))}
        {loading ? (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
              Thinking...
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
          onChange={(e) => setInput(normalizePromptInput(e.target.value))}
          onKeyDown={onKeyDown}
          placeholder="Ask the system operator..."
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

      {refinedInput && refinedInput !== input ? (
        <button
          type="button"
          onClick={() => {
            setInput(refinedInput);
            textareaRef.current?.focus();
          }}
          className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-left text-xs text-emerald-800"
        >
          Use refined prompt: {refinedInput}
        </button>
      ) : null}

      {input.trim() && liveRecommendations.length > 0 ? (
        <div className="mt-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Relevant Suggestions</p>
          <div className="mt-2 space-y-2">
            {liveRecommendations.map((recommendation) => (
              <button
                key={`live-${recommendation.label}`}
                type="button"
                onClick={() => {
                  setInput(recommendation.prompt);
                  textareaRef.current?.focus();
                }}
                className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-700 transition hover:border-blue-300 hover:bg-blue-50"
              >
                {recommendation.prompt}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <p className="mt-2 text-center text-[10px] font-medium text-slate-400">Powered by SAASA B2E</p>
    </div>
  );
}
