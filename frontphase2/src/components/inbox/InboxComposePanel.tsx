'use client';

import React, { useMemo, useState } from 'react';
import { Loader2, Minimize2, Send, X } from 'lucide-react';
import { apiSendOutlookComposeMail } from '../../lib/api';
import {
  buildMailboxComposeUrl,
  openMailboxComposeTab,
  type MailboxComposeProvider,
} from '../../lib/mailboxCompose';
import { linkifyPlainTextToReactNodes } from '../../lib/emailLinkify';

export type InboxComposeValues = {
  to: string;
  subject: string;
  body: string;
};

type Props = {
  provider: MailboxComposeProvider;
  fromEmail?: string;
  initial: InboxComposeValues;
  onClose: () => void;
};

export function InboxComposePanel({ provider, fromEmail, initial, onClose }: Props) {
  const [to, setTo] = useState(initial.to);
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sentHint, setSentHint] = useState('');
  const [minimized, setMinimized] = useState(false);

  const brand = provider === 'outlook' ? 'Outlook' : 'Gmail';
  const linkPreview = useMemo(() => linkifyPlainTextToReactNodes(body), [body]);
  const hasLinks = linkPreview.some((node) => typeof node !== 'string');

  const handleSend = async () => {
    const toAddress = to.trim();
    if (!toAddress) {
      setError('Add a recipient email before sending.');
      return;
    }
    setError('');
    setSentHint('');
    setSending(true);
    try {
      if (provider === 'outlook') {
        const result = await apiSendOutlookComposeMail({
          to: toAddress,
          subject,
          body,
        });
        setSentHint(`Sent from ${result?.email || fromEmail || 'Outlook'} to ${result?.to || toAddress}.`);
        window.setTimeout(() => onClose(), 1200);
        return;
      }

      const url = buildMailboxComposeUrl({
        provider: 'gmail',
        to: toAddress,
        subject,
        body,
        accountEmail: fromEmail,
      });
      const opened = openMailboxComposeTab(url);
      if (!opened) {
        setError('Allow pop-ups to open Gmail compose.');
        return;
      }
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Could not send with ${brand}.`);
    } finally {
      setSending(false);
    }
  };

  if (minimized) {
    return (
      <div className="fixed bottom-4 right-4 z-[120] w-[280px] overflow-hidden rounded-t-xl bg-[#404040] text-white shadow-2xl">
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium"
        >
          <span className="truncate">{subject.trim() || 'New message'}</span>
          <span className="ml-2 inline-flex items-center gap-1">
            <Minimize2 className="h-4 w-4 rotate-180 opacity-80" />
            <X
              className="h-4 w-4 opacity-80"
              onClick={(event) => {
                event.stopPropagation();
                onClose();
              }}
            />
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 right-4 z-[120] flex h-[min(560px,70vh)] w-[min(520px,calc(100vw-2rem))] flex-col overflow-hidden rounded-t-xl bg-white shadow-[0_8px_28px_rgba(0,0,0,0.28)] ring-1 ring-black/10">
      <div className="flex items-center justify-between bg-[#404040] px-4 py-2.5 text-white">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">New message</p>
          {fromEmail ? (
            <p className="truncate text-[11px] text-white/70">From {fromEmail} · {brand}</p>
          ) : (
            <p className="truncate text-[11px] text-white/70">{brand}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMinimized(true)}
            className="rounded p-1.5 hover:bg-white/10"
            aria-label="Minimize"
          >
            <Minimize2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 hover:bg-white/10"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <label className="flex items-center gap-2 border-b border-[#e0e0e0] px-4 py-2 text-sm">
          <span className="w-10 shrink-0 text-[#5f6368]">To</span>
          <input
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="min-w-0 flex-1 bg-transparent outline-none"
            placeholder="Recipient"
            autoComplete="email"
          />
        </label>
        <label className="flex items-center gap-2 border-b border-[#e0e0e0] px-4 py-2 text-sm">
          <span className="w-10 shrink-0 text-[#5f6368]">Subject</span>
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className="min-w-0 flex-1 bg-transparent outline-none"
            placeholder="Subject"
          />
        </label>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="min-h-0 flex-1 resize-none px-4 py-3 text-sm leading-6 outline-none"
          placeholder="Write your message…"
        />
        {hasLinks ? (
          <div className="border-t border-[#e8eaed] bg-[#f8f9fa] px-4 py-2 text-[11px] leading-5 text-[#5f6368]">
            <span className="font-medium text-[#202124]">Links will send as clickable: </span>
            {linkPreview.map((node, index) =>
              typeof node === 'string' ? null : (
                <a
                  key={`${node.href}-${index}`}
                  href={node.href}
                  target="_blank"
                  rel="noreferrer"
                  className="mr-2 text-[#1a73e8] underline"
                >
                  {node.label}
                </a>
              ),
            )}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-[#e0e0e0] px-4 py-3">
        <button
          type="button"
          disabled={sending}
          onClick={() => void handleSend()}
          className="inline-flex items-center gap-2 rounded-full bg-[#0b57d0] px-5 py-2 text-sm font-medium text-white hover:bg-[#0842a0] disabled:opacity-60"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {sending ? 'Sending…' : 'Send'}
        </button>
        {provider === 'gmail' ? (
          <p className="text-xs text-[#5f6368]">Opens Gmail compose to finish sending.</p>
        ) : (
          <p className="text-xs text-[#5f6368]">Sends with your connected Outlook account.</p>
        )}
        {error ? <p className="w-full text-xs text-rose-600">{error}</p> : null}
        {sentHint ? <p className="w-full text-xs text-emerald-700">{sentHint}</p> : null}
      </div>
    </div>
  );
}
