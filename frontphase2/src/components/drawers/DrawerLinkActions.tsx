'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';

export function looksLikeHttpUrl(value: string): boolean {
  const v = String(value || '').trim();
  if (!v || v === '—' || v === '-') return false;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && !/^https?:\/\//i.test(v)) return false;
  return /^(https?:\/\/|www\.)/i.test(v) || /(^|\.)linkedin\.com\//i.test(v) || /(^|\.)github\.com\//i.test(v);
}

export function normalizeShareUrl(value: string): string {
  const v = String(value || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v.replace(/^\/+/, '')}`;
}

export function splitDisplayUrls(value: string): string[] {
  return String(value || '')
    .split(/\s*\|\s*/)
    .map((part) => part.trim())
    .filter(looksLikeHttpUrl);
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const input = document.createElement('textarea');
      input.value = text;
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

type ShareTarget = 'whatsapp' | 'linkedin' | 'x' | 'email';

function shareHref(url: string, title: string, target: ShareTarget): string {
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(`${title}\n${url}`);
  if (target === 'whatsapp') return `https://wa.me/?text=${encodedText}`;
  if (target === 'linkedin') return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
  if (target === 'x') return `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodeURIComponent(title)}`;
  return `mailto:?subject=${encodeURIComponent(title)}&body=${encodedText}`;
}

type DrawerLinkActionsProps = {
  url: string;
  shareTitle?: string;
  className?: string;
  showCopy?: boolean;
  showShare?: boolean;
  size?: 'sm' | 'md';
  menuAlign?: 'left' | 'right';
};

export function DrawerLinkActions({
  url,
  shareTitle = 'Shared link',
  className = '',
  showCopy = true,
  showShare = true,
  size = 'sm',
  menuAlign = 'left',
}: DrawerLinkActionsProps) {
  const href = normalizeShareUrl(url);
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const compact = size === 'sm';
  const disabled = !href;

  useEffect(() => {
    if (!shareOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setShareOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [shareOpen]);

  if (!href && showCopy && showShare) return null;

  const handleCopy = async () => {
    if (!href) return;
    const ok = await copyToClipboard(href);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const handleShare = async () => {
    if (!href) return;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title: shareTitle, url: href, text: shareTitle });
        setShareOpen(false);
        return;
      }
    } catch (error: unknown) {
      if ((error as { name?: string } | null)?.name === 'AbortError') return;
    }
    setShareOpen((open) => !open);
  };

  const openTarget = (target: ShareTarget) => {
    if (!href) return;
    const next = shareHref(href, shareTitle, target);
    if (target === 'email') window.location.href = next;
    else window.open(next, '_blank', 'noopener,noreferrer,width=640,height=640');
    setShareOpen(false);
  };

  const copyButtonClass = compact
    ? 'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-100 bg-white text-indigo-700 shadow-sm transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50'
    : 'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-indigo-200/80 bg-white text-indigo-700 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.2)] transition-all hover:border-indigo-300 hover:bg-indigo-50/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50';
  const shareButtonClass = compact
    ? 'inline-flex h-8 items-center gap-1.5 rounded-lg border border-indigo-100 bg-white px-2.5 text-xs font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50'
    : 'inline-flex h-9 items-center gap-1.5 rounded-lg border border-indigo-200/70 bg-white px-3 text-xs font-semibold text-indigo-900 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.25)] transition-all hover:border-indigo-300 hover:bg-indigo-50/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div ref={rootRef} className={`relative inline-flex items-center gap-1.5 ${className}`}>
      {showCopy ? (
        <button
          type="button"
          onClick={() => void handleCopy()}
          disabled={disabled}
          className={copyButtonClass}
          title={copied ? 'Copied' : 'Copy link'}
          aria-label={copied ? 'Copied' : 'Copy link'}
        >
          {copied ? <Check size={compact ? 14 : 16} strokeWidth={2.5} /> : <Copy size={compact ? 14 : 16} strokeWidth={2.25} />}
        </button>
      ) : null}
      {showShare ? (
        <button
          type="button"
          onClick={() => void handleShare()}
          disabled={disabled}
          className={shareButtonClass}
          title="Share link"
          aria-label="Share link"
        >
          <Share2 size={compact ? 14 : 16} strokeWidth={2.25} />
          Share
        </button>
      ) : null}
      {shareOpen && href ? (
        <div
          className={`absolute top-full z-50 mt-1 w-40 overflow-hidden rounded-xl border border-indigo-100 bg-white py-1 shadow-xl shadow-indigo-500/10 ${
            menuAlign === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {(
            [
              { id: 'whatsapp' as const, label: 'WhatsApp' },
              { id: 'linkedin' as const, label: 'LinkedIn' },
              { id: 'x' as const, label: 'X / Twitter' },
              { id: 'email' as const, label: 'Email' },
            ]
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => openTarget(item.id)}
              className="flex w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-900"
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type DrawerLinkFieldProps = {
  label?: string;
  value?: string | null;
  shareTitle?: string;
  emptyText?: string;
};

/** Field label + copy/share actions. Never prints the raw URL. */
export function DrawerLinkField({
  label,
  value,
  shareTitle,
  emptyText = '—',
}: DrawerLinkFieldProps) {
  const urls = splitDisplayUrls(String(value || ''));
  return (
    <div className="min-w-0">
      {label ? (
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      ) : null}
      {urls.length ? (
        <div className={`flex flex-col gap-1.5 ${label ? 'mt-1' : ''}`}>
          {urls.map((url) => (
            <DrawerLinkActions key={url} url={url} shareTitle={shareTitle || label || 'Shared link'} />
          ))}
        </div>
      ) : (
        <p className={`text-sm font-medium text-slate-400 ${label ? 'mt-0.5' : ''}`}>{emptyText}</p>
      )}
    </div>
  );
}
