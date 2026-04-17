'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { buildApiUrl } from '../lib/api';

const ARIA_ENDPOINT = buildApiUrl('/ai/aria');

function getToken() {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('accessToken');
  } catch {
    return null;
  }
}

function getTenant() {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('tenantDbName');
  } catch {
    return null;
  }
}

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function suggestionToPrompt(suggestion) {
  const action = String(suggestion?.action || '').toUpperCase();
  const params = suggestion?.params || {};
  if (action === 'PROMPT' && params.text) return String(params.text);
  if (action === 'UPDATE_LEAD' && params.leadId) return `update lead ${params.leadId}`;
  if (action === 'CREATE_LEAD_FORCE') return 'create lead anyway';
  if (action === 'ASSIGN_LEAD' && params.leadId) return `assign lead ${params.leadId}`;
  if (action === 'CONVERT_LEAD' && params.leadId) return `convert lead ${params.leadId}`;
  return String(params.text || suggestion?.label || '').trim();
}

async function parseResponseSafe(res) {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }

  const text = await res.text();
  const snippet = String(text || '').slice(0, 120).replace(/\s+/g, ' ');
  throw new Error(
    `Server returned non-JSON response (${res.status}). ${snippet || 'Check API route/proxy configuration.'}`
  );
}

export default function AriaChat({
  currentPage = 'leads',
  onUiPayload,
  onUiAction,
}) {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [undoStatus, setUndoStatus] = useState({});
  const [undoCountdowns, setUndoCountdowns] = useState({});
  const fileRef = useRef(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        id: newId(),
        role: 'assistant',
        content: null,
        structured: {
          chatOutput: {
            headline: 'ARIA — Leads Assistant',
            summary: 'I can create, update, search, and import leads. What would you like to do?',
            details: [],
            warnings: [],
            aiInsights: [
              'Try: "create lead for TCS, contact Rahul, LinkedIn"',
              'Try: "show all qualified leads"',
              'Try: "update TCS lead status to Contacted"',
              'Upload a CSV file to bulk import leads',
            ],
            undoLine: '',
            suggestions: [
              { label: 'Create a Lead', action: 'PROMPT', params: { text: 'create lead' } },
              { label: 'Show All Leads', action: 'PROMPT', params: { text: 'show all leads' } },
              { label: 'Import CSV', action: 'UPLOAD', params: {} },
            ],
          },
        },
      }]);
    }
  }, [open, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    const timers = [];
    messages.forEach((m) => {
      const payload = m.structured?.undoPayload;
      if (
        payload?.available &&
        payload.actionId &&
        payload.expiresInSeconds &&
        undoStatus[payload.actionId] !== 'done' &&
        undoStatus[payload.actionId] !== 'expired'
      ) {
        const id = payload.actionId;
        if (undoCountdowns[id] === undefined) {
          setUndoCountdowns((prev) => ({ ...prev, [id]: payload.expiresInSeconds }));
        }
        const timer = setInterval(() => {
          setUndoCountdowns((prev) => {
            const current = prev[id] ?? 0;
            if (current <= 1) {
              clearInterval(timer);
              setUndoStatus((s) => ({ ...s, [id]: 'expired' }));
              return { ...prev, [id]: 0 };
            }
            return { ...prev, [id]: current - 1 };
          });
        }, 1000);
        timers.push(timer);
      }
    });
    return () => timers.forEach(clearInterval);
  }, [messages, undoStatus, undoCountdowns]);

  const sendMessage = useCallback(async (text, file) => {
    const msgText = (text || input || '').trim();
    if (!msgText && !file) return;
    if (loading) return;

    setError(null);
    if (!file) setInput('');

    setMessages((prev) => [
      ...prev,
      { id: newId(), role: 'user', content: file ? `📎 ${file.name}` : msgText },
    ]);
    setLoading(true);

    try {
      const token = getToken();
      const tenant = getTenant();
      if (!token) throw new Error('Not authenticated. Please log in.');

      const headers = { Authorization: `Bearer ${token}` };
      if (tenant) headers['x-tenant-db-name'] = tenant;

      let body;
      if (file) {
        body = new FormData();
        body.append('file', file);
        body.append('currentPage', currentPage);
        body.append('message', msgText || 'Process this file');
      } else {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify({ message: msgText, currentPage });
      }

      const res = await fetch(ARIA_ENDPOINT, { method: 'POST', headers, body });
      const json = await parseResponseSafe(res);
      if (!res.ok || json.success === false) throw new Error(json.message || 'ARIA request failed');

      const structured = json.structured || json.data?.structured || null;
      const uiPayload = structured?.uiPayload;
      if (uiPayload) {
        if (onUiPayload) onUiPayload(uiPayload);
        if (onUiAction) onUiAction(uiPayload);
        window.dispatchEvent(new CustomEvent('aria-ui-payload', { detail: uiPayload }));
      }

      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'assistant',
          content: json.message || '',
          structured,
        },
      ]);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [currentPage, input, loading, onUiAction, onUiPayload]);

  const handleUndo = async (actionId) => {
    if (!actionId || ['loading', 'done', 'expired'].includes(undoStatus[actionId])) return;
    try {
      setUndoStatus((prev) => ({ ...prev, [actionId]: 'loading' }));
      const token = getToken();
      const tenant = getTenant();
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };
      if (tenant) headers['x-tenant-db-name'] = tenant;

      const res = await fetch(`${ARIA_ENDPOINT}/undo`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ actionId }),
      });
      const json = await parseResponseSafe(res);
      if (!json.success) throw new Error(json.message || 'Undo failed');

      setUndoStatus((prev) => ({ ...prev, [actionId]: 'done' }));
      if (json.uiReverse) {
        const reversePayload = { type: 'REVERSE', ...json.uiReverse };
        if (onUiPayload) onUiPayload(reversePayload);
        if (onUiAction) onUiAction(reversePayload);
        window.dispatchEvent(new CustomEvent('aria-ui-payload', { detail: reversePayload }));
      }
    } catch (err) {
      setUndoStatus((prev) => ({ ...prev, [actionId]: 'available' }));
      setError(err.message || 'Undo failed. The action may have expired.');
    }
  };

  const handleSuggestionClick = (suggestion) => {
    if (suggestion.action === 'UPLOAD') {
      fileRef.current?.click();
      return;
    }
    const prompt = suggestionToPrompt(suggestion);
    if (prompt) sendMessage(prompt);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      sendMessage('', file);
      e.target.value = '';
    }
  };

  const formatCountdown = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: '#4f46e5',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          fontSize: 24,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 9999,
        }}
        title="Open ARIA"
      >
        ✳️
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      width: 400,
      height: minimized ? 56 : 600,
      background: '#fff',
      borderRadius: 16,
      boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      border: '1px solid #e2e8f0',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 9999,
      overflow: 'hidden',
    }}>
      <div style={{ background: '#4f46e5', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: '#fff', fontWeight: 600, fontSize: 14, flex: 1 }}>ARIA</span>
        <button onClick={() => setMinimized((m) => !m)} style={{ background: 'none', border: 'none', color: '#c7d2fe', cursor: 'pointer' }}>
          {minimized ? '▲' : '▼'}
        </button>
        <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#c7d2fe', cursor: 'pointer' }}>
          ×
        </button>
      </div>

      {!minimized && (
        <>
          <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10, background: '#f8fafc' }}>
            {messages.map((m) => (
              <div key={m.id} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {m.role === 'user' ? (
                  <div style={{ background: '#4f46e5', color: '#fff', borderRadius: '12px 12px 2px 12px', padding: '8px 12px', maxWidth: '80%', fontSize: 13 }}>
                    {m.content}
                  </div>
                ) : (
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px 12px 12px 2px', padding: 12, width: '100%' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                      {m.structured?.chatOutput?.headline || m.content || 'ARIA'}
                    </div>
                    {m.structured?.chatOutput?.summary ? <div style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>{m.structured.chatOutput.summary}</div> : null}
                    {m.structured?.clarificationNeeded && m.structured?.clarificationQuestion ? (
                      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', borderRadius: 8, padding: '8px 10px', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                        {m.structured.clarificationQuestion}
                      </div>
                    ) : null}
                    {Array.isArray(m.structured?.chatOutput?.details) && m.structured.chatOutput.details.length > 0 && (
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 8 }}>
                        {m.structured.chatOutput.details.map((d, i) => (
                          <div key={`${m.id}-d-${i}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, gap: 10 }}>
                            <span style={{ color: '#64748b' }}>{d.label}</span>
                            <span style={{ color: '#334155', fontWeight: 600 }}>{String(d.value)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {m.structured?.undoPayload?.available && undoStatus[m.structured.undoPayload.actionId] !== 'expired' ? (
                      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#d97706', fontSize: 11, fontWeight: 700 }}>
                          Undo — expires {formatCountdown(undoCountdowns[m.structured.undoPayload.actionId] ?? m.structured.undoPayload.expiresInSeconds ?? 600)}
                        </span>
                        <button
                          onClick={() => handleUndo(m.structured.undoPayload.actionId)}
                          style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}
                        >
                          UNDO
                        </button>
                      </div>
                    ) : null}
                    {Array.isArray(m.structured?.chatOutput?.suggestions) && m.structured.chatOutput.suggestions.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                        {m.structured.chatOutput.suggestions.map((s, i) => (
                          <button
                            key={`${m.id}-s-${i}`}
                            onClick={() => handleSuggestionClick(s)}
                            style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, padding: '4px 10px', fontSize: 11, color: '#4f46e5', cursor: 'pointer' }}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
            {loading ? <div style={{ color: '#64748b', fontSize: 13 }}>Thinking...</div> : null}
            {error ? <div style={{ color: '#dc2626', fontSize: 12 }}>{error}</div> : null}
            <div ref={bottomRef} />
          </div>

          <div style={{ padding: '10px 12px', borderTop: '1px solid #e2e8f0', background: '#fff', display: 'flex', gap: 8 }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ask ARIA..."
              rows={2}
              disabled={loading}
              style={{ flex: 1, resize: 'none', border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 10px', fontSize: 13 }}
            />
            <button onClick={() => fileRef.current?.click()} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px' }}>📎</button>
            <button onClick={() => sendMessage()} disabled={loading || !input.trim()} style={{ background: loading || !input.trim() ? '#94a3b8' : '#4f46e5', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 14px' }}>➤</button>
          </div>

          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={handleFileChange} />
        </>
      )}
    </div>
  );
}
