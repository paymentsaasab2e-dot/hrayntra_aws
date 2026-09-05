'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Link2, Loader2, Mail, X } from 'lucide-react';
import { DetailsModalShell } from '../drawers/DetailsModalShell';
import {
  apiConnectIntegration,
  apiGetMailboxStatus,
  type MailboxStatusResponse,
} from '../../lib/api';
import {
  buildMailboxComposeUrl,
  buildSubmitToClientMailCopy,
  connectedMailboxProviders,
  openMailboxComposeTab,
  type MailboxComposeProvider,
} from '../../lib/mailboxCompose';

type Props = {
  isOpen: boolean;
  loading: boolean;
  error: string;
  reviewUrl: string;
  candidateNames: string[];
  jobTitle?: string;
  clientEmail?: string;
  visibleCount: number | null;
  hiddenCount: number | null;
  onClose: () => void;
  onRetry: () => void;
};

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const input = document.createElement('textarea');
      input.value = value;
      input.setAttribute('readonly', 'true');
      input.style.position = 'fixed';
      input.style.left = '-9999px';
      document.body.appendChild(input);
      input.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(input);
      return ok;
    } catch {
      return false;
    }
  }
}

export function SubmitToClientPreviewLinkModal({
  isOpen,
  loading,
  error,
  reviewUrl,
  candidateNames,
  jobTitle,
  clientEmail,
  visibleCount,
  hiddenCount,
  onClose,
  onRetry,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [mailboxStatus, setMailboxStatus] = useState<MailboxStatusResponse | null>(null);
  const [mailboxReady, setMailboxReady] = useState(false);
  const [mailHint, setMailHint] = useState('');
  const [connecting, setConnecting] = useState<MailboxComposeProvider | null>(null);

  useEffect(() => {
    setCopied(false);
    setMailHint('');
    setConnecting(null);
  }, [reviewUrl, isOpen]);

  useEffect(() => {
    if (!isOpen || loading) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, loading, onClose]);

  useEffect(() => {
    if (!isOpen || loading || !reviewUrl) {
      setMailboxStatus(null);
      setMailboxReady(false);
      return;
    }
    let cancelled = false;
    setMailboxReady(false);
    void apiGetMailboxStatus()
      .then((status) => {
        if (!cancelled) setMailboxStatus(status);
      })
      .catch(() => {
        if (!cancelled) setMailboxStatus(null);
      })
      .finally(() => {
        if (!cancelled) setMailboxReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, loading, reviewUrl]);

  const connectedProviders = useMemo(
    () => connectedMailboxProviders(mailboxStatus),
    [mailboxStatus],
  );

  const mailCopy = useMemo(
    () =>
      buildSubmitToClientMailCopy({
        reviewUrl,
        candidateNames,
        jobTitle,
      }),
    [reviewUrl, candidateNames, jobTitle],
  );

  if (!isOpen) return null;

  const namesLabel =
    candidateNames.length === 0
      ? ''
      : candidateNames.length === 1
        ? candidateNames[0]
        : `${candidateNames[0]} +${candidateNames.length - 1} more`;

  const openCompose = (provider: MailboxComposeProvider) => {
    const url = buildMailboxComposeUrl({
      provider,
      to: clientEmail,
      subject: mailCopy.subject,
      body: mailCopy.body,
    });
    const opened = openMailboxComposeTab(url);
    setMailHint(
      opened
        ? `Opened ${provider === 'gmail' ? 'Gmail' : 'Outlook'} compose in a new tab. Review and send it from there — HRYANTRA does not send this email.`
        : 'Allow pop-ups to open Gmail or Outlook compose.',
    );
  };

  const handleConnect = async (provider: MailboxComposeProvider) => {
    try {
      setConnecting(provider);
      await apiConnectIntegration(
        provider,
        typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : undefined,
      );
    } catch (err: unknown) {
      setConnecting(null);
      setMailHint(err instanceof Error ? err.message : 'Could not start Gmail or Outlook connect.');
    }
  };

  const handleCopy = async () => {
    if (!reviewUrl) return;
    const ok = await copyText(reviewUrl);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <DetailsModalShell
      size="sm"
      zIndexClass="z-[140]"
      panelClassName="!h-auto max-h-[min(80vh,640px)]"
      onBackdropClick={loading ? undefined : onClose}
      dialogTitleId="submit-client-preview-link-title"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-3 border-b border-indigo-100 px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-600">
              Submit to Client
            </p>
            <h2 id="submit-client-preview-link-title" className="mt-1 text-lg font-bold text-slate-900">
              Client preview link
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Copy this link to share the selected candidate
              {candidateNames.length > 1 ? 's' : ''}. Only fields marked Visible in Settings → Public
              Visibility → Submit to Client are included.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-5">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
              <div>
                <p className="text-sm font-semibold text-slate-800">Generating preview link…</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Applying Submit to Client visibility for the selected candidate
                  {candidateNames.length > 1 ? 's' : ''}.
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-4">
              <p className="text-sm font-semibold text-rose-800">Could not generate the link</p>
              <p className="mt-1 text-sm text-rose-700">{error}</p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 inline-flex items-center rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-700"
              >
                Try again
              </button>
            </div>
          ) : (
            <>
              {namesLabel ? (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Selected
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-800">{namesLabel}</p>
                  {candidateNames.length > 1 ? (
                    <p className="mt-1 text-xs text-slate-500">{candidateNames.join(', ')}</p>
                  ) : null}
                </div>
              ) : null}

              {visibleCount != null && hiddenCount != null ? (
                <p className="text-xs text-slate-500">
                  Client preview includes <span className="font-semibold text-slate-700">{visibleCount} visible</span>{' '}
                  fields
                  {hiddenCount > 0 ? (
                    <>
                      {' '}
                      · <span className="font-semibold text-slate-700">{hiddenCount} hidden</span> fields are not shown
                    </>
                  ) : null}
                  .
                </p>
              ) : null}

              <div>
                <label htmlFor="submit-client-preview-url" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Preview link
                </label>
                <div className="mt-1.5 flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="submit-client-preview-url"
                      readOnly
                      value={reviewUrl}
                      onFocus={(event) => event.currentTarget.select()}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none ring-indigo-200 focus:bg-white focus:ring-2"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCopy()}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                  >
                    {copied ? <Check size={15} strokeWidth={2.5} /> : <Copy size={15} strokeWidth={2.25} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Send a mail to the client
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Opens compose in a new tab. HRYANTRA does not send the email.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {!mailboxReady ? (
                    <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-500">
                      <Loader2 size={15} className="animate-spin" />
                      Checking mail accounts…
                    </span>
                  ) : connectedProviders.length ? (
                    <>
                      {connectedProviders.includes('gmail') ? (
                        <button
                          type="button"
                          onClick={() => openCompose('gmail')}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700"
                        >
                          <Mail size={15} strokeWidth={2.25} />
                          Gmail
                        </button>
                      ) : null}
                      {connectedProviders.includes('outlook') ? (
                        <button
                          type="button"
                          onClick={() => openCompose('outlook')}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
                        >
                          <Mail size={15} strokeWidth={2.25} />
                          Outlook
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-xs text-slate-500">Connect Gmail or Outlook to open compose.</p>
                  )}
                </div>

                {mailHint ? (
                  <p className="mt-2 text-xs leading-5 text-slate-600">{mailHint}</p>
                ) : null}

                {mailboxReady && !connectedProviders.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleConnect('gmail')}
                      disabled={connecting !== null}
                      className="inline-flex items-center rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                    >
                      {connecting === 'gmail' ? 'Connecting…' : 'Connect Gmail'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleConnect('outlook')}
                      disabled={connecting !== null}
                      className="inline-flex items-center rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-60"
                    >
                      {connecting === 'outlook' ? 'Connecting…' : 'Connect Outlook'}
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
          >
            Done
          </button>
        </div>
      </div>
    </DetailsModalShell>
  );
}
