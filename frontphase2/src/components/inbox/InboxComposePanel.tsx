'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Minimize2, Paperclip, Send, X } from 'lucide-react';
import { apiSendOutlookComposeMail, apiSendGmailComposeMail } from '../../lib/api';
import {
  buildMailboxComposeUrl,
  openMailboxComposeTab,
  type MailboxComposeProvider,
} from '../../lib/mailboxCompose';
import { linkifyPlainTextToReactNodes } from '../../lib/emailLinkify';
import {
  appendEmailComposeSignature,
  bodyWithEmailSignatureToHtml,
  resolveComposeSignature,
  type ResolvedComposeSignature,
} from '../../lib/emailComposeSignature';

export type InboxComposeValues = {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
};

type Props = {
  provider: MailboxComposeProvider;
  fromEmail?: string;
  initial: InboxComposeValues;
  onClose: () => void;
};

type ComposeAttachment = {
  id: string;
  file: File;
};

const MAX_ATTACHMENTS = 10;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 12 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const idx = result.indexOf('base64,');
      resolve(idx >= 0 ? result.slice(idx + 7) : result);
    };
    reader.onerror = () => reject(reader.error || new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

async function buildAttachmentPayload(files: File[]) {
  const attachments = [];
  for (const file of files) {
    attachments.push({
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      contentBase64: await readFileAsBase64(file),
    });
  }
  return attachments;
}

export function InboxComposePanel({ provider, fromEmail, initial, onClose }: Props) {
  const [to, setTo] = useState(initial.to);
  const [cc, setCc] = useState(initial.cc || '');
  const [bcc, setBcc] = useState(initial.bcc || '');
  const [showCc, setShowCc] = useState(Boolean(String(initial.cc || '').trim()));
  const [showBcc, setShowBcc] = useState(Boolean(String(initial.bcc || '').trim()));
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const [attachments, setAttachments] = useState<ComposeAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sentHint, setSentHint] = useState('');
  const [minimized, setMinimized] = useState(false);
  const [resolvedSig, setResolvedSig] = useState<ResolvedComposeSignature | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let mounted = true;
    void resolveComposeSignature(provider).then((sig) => {
      if (!mounted) return;
      setResolvedSig(sig);
      if (sig.text) {
        setBody((prev) => appendEmailComposeSignature(prev, sig.text));
      }
      if (sig.requiresReconnect && provider === 'gmail') {
        setSentHint('Reconnect Gmail in Settings to use your Gmail signature (using app signature for now).');
      }
    });
    return () => {
      mounted = false;
    };
  }, [provider]);

  const brand = provider === 'outlook' ? 'Outlook' : 'Gmail';
  const linkPreview = useMemo(() => linkifyPlainTextToReactNodes(body), [body]);
  const hasLinks = linkPreview.some((node) => typeof node !== 'string');
  const attachmentBytes = useMemo(
    () => attachments.reduce((sum, row) => sum + row.file.size, 0),
    [attachments],
  );

  const buildBodyHtml = async () => {
    const sig = resolvedSig || (await resolveComposeSignature(provider));
    if (!resolvedSig) setResolvedSig(sig);
    return bodyWithEmailSignatureToHtml(body, {
      signature: sig.text,
      logoUrl: sig.logoUrl,
      providerHtml: sig.providerHtml,
    });
  };

  const handleAddFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    setError('');
    const next = [...attachments];
    let total = attachmentBytes;
    for (const file of Array.from(fileList)) {
      if (next.length >= MAX_ATTACHMENTS) {
        setError(`You can attach up to ${MAX_ATTACHMENTS} files.`);
        break;
      }
      if (file.size > MAX_FILE_BYTES) {
        setError(`"${file.name}" exceeds the 10MB limit.`);
        continue;
      }
      if (total + file.size > MAX_TOTAL_BYTES) {
        setError('Total attachments exceed the 12MB limit.');
        break;
      }
      total += file.size;
      next.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        file,
      });
    }
    setAttachments(next);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async () => {
    const toAddress = to.trim();
    if (!toAddress) {
      setError('Add a recipient email before sending.');
      return;
    }
    setError('');
    setSentHint('');
    setSending(true);
    const sig = resolvedSig || (await resolveComposeSignature(provider));
    const bodyWithSignature = appendEmailComposeSignature(body, sig.text);
    const bodyHtml = await buildBodyHtml();
    const files = attachments.map((row) => row.file);
    try {
      const attachmentPayload = files.length ? await buildAttachmentPayload(files) : undefined;
      if (provider === 'outlook') {
        const result = await apiSendOutlookComposeMail({
          to: toAddress,
          cc: cc.trim() || undefined,
          bcc: bcc.trim() || undefined,
          subject,
          body: bodyHtml,
          attachments: attachmentPayload,
        });
        setSentHint(`Sent from ${result?.email || fromEmail || 'Outlook'} to ${result?.to || toAddress}.`);
        window.setTimeout(() => onClose(), 1200);
        return;
      }

      try {
        const result = await apiSendGmailComposeMail({
          to: toAddress,
          cc: cc.trim() || undefined,
          bcc: bcc.trim() || undefined,
          subject,
          body: bodyHtml,
          attachments: attachmentPayload,
        });
        setSentHint(`Sent from ${result?.email || fromEmail || 'Gmail'} to ${result?.to || toAddress}.`);
        window.setTimeout(() => onClose(), 1200);
        return;
      } catch (err: unknown) {
        if (files.length) {
          throw err instanceof Error
            ? err
            : new Error('Could not send with attachments via Gmail. Reconnect Gmail in Settings and try again.');
        }
        // Fallback for older Gmail tokens without send/compose: open URL compose.
        const url = buildMailboxComposeUrl({
          provider: 'gmail',
          to: toAddress,
          subject,
          body: bodyWithSignature,
          accountEmail: fromEmail,
        });
        const opened = openMailboxComposeTab(url);
        if (!opened) {
          setError('Allow pop-ups to open Gmail compose.');
          return;
        }
        onClose();
      }
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
    <div className="fixed bottom-0 right-4 z-[120] flex h-[min(600px,74vh)] w-[min(560px,calc(100vw-2rem))] flex-col overflow-hidden rounded-t-xl bg-white shadow-[0_8px_28px_rgba(0,0,0,0.28)] ring-1 ring-black/10">
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
          <span className="flex shrink-0 items-center gap-2 text-[11px] font-semibold text-[#0b57d0]">
            {!showCc ? (
              <button type="button" onClick={() => setShowCc(true)} className="hover:underline">
                Cc
              </button>
            ) : null}
            {!showBcc ? (
              <button type="button" onClick={() => setShowBcc(true)} className="hover:underline">
                Bcc
              </button>
            ) : null}
          </span>
        </label>
        {showCc ? (
          <label className="flex items-center gap-2 border-b border-[#e0e0e0] px-4 py-2 text-sm">
            <span className="w-10 shrink-0 text-[#5f6368]">Cc</span>
            <input
              value={cc}
              onChange={(event) => setCc(event.target.value)}
              className="min-w-0 flex-1 bg-transparent outline-none"
              placeholder="Cc recipients (comma separated)"
              autoComplete="email"
            />
          </label>
        ) : null}
        {showBcc ? (
          <label className="flex items-center gap-2 border-b border-[#e0e0e0] px-4 py-2 text-sm">
            <span className="w-10 shrink-0 text-[#5f6368]">Bcc</span>
            <input
              value={bcc}
              onChange={(event) => setBcc(event.target.value)}
              className="min-w-0 flex-1 bg-transparent outline-none"
              placeholder="Bcc recipients (comma separated)"
              autoComplete="email"
            />
          </label>
        ) : null}
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
        {attachments.length ? (
          <div className="border-t border-[#e8eaed] bg-[#f8f9fa] px-4 py-2">
            <ul className="flex flex-wrap gap-2">
              {attachments.map((row) => (
                <li
                  key={row.id}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#dadce0] bg-white px-2.5 py-1 text-[11px] text-[#202124]"
                >
                  <Paperclip className="h-3 w-3 shrink-0 text-[#5f6368]" />
                  <span className="truncate">{row.file.name}</span>
                  <span className="shrink-0 text-[#5f6368]">{formatFileSize(row.file.size)}</span>
                  <button
                    type="button"
                    disabled={sending}
                    onClick={() => setAttachments((prev) => prev.filter((item) => item.id !== row.id))}
                    className="rounded-full p-0.5 text-[#5f6368] hover:bg-[#eee] hover:text-[#202124]"
                    aria-label={`Remove ${row.file.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
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

      <div className="flex flex-wrap items-center gap-2 border-t border-[#e0e0e0] px-4 py-3">
        <button
          type="button"
          disabled={sending}
          onClick={() => void handleSend()}
          className="inline-flex items-center gap-2 rounded-full bg-[#0b57d0] px-5 py-2 text-sm font-medium text-white hover:bg-[#0842a0] disabled:opacity-60"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {sending ? 'Sending…' : 'Send'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => handleAddFiles(event.target.files)}
        />
        <button
          type="button"
          disabled={sending || attachments.length >= MAX_ATTACHMENTS}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-full border border-[#dadce0] bg-white px-3.5 py-2 text-sm font-medium text-[#202124] hover:bg-[#f8f9fa] disabled:opacity-60"
        >
          <Paperclip className="h-4 w-4" />
          Attach
        </button>
        <p className="text-xs text-[#5f6368]">
          {attachments.length
            ? `${attachments.length} file${attachments.length === 1 ? '' : 's'} · ${formatFileSize(attachmentBytes)}`
            : `URLs are sent as clickable hyperlinks in ${brand}.`}
        </p>
        {error ? <p className="w-full text-xs text-rose-600">{error}</p> : null}
        {sentHint ? <p className="w-full text-xs text-emerald-700">{sentHint}</p> : null}
      </div>
    </div>
  );
}
