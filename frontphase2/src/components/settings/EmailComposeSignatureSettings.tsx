'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, ImagePlus, Loader2, Mail, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiUploadEmailSignatureLogo } from '../../lib/api';
import {
  ensureEmailComposeSignatureStateLoaded,
  getEmailComposeSignatureState,
  hydrateEmailComposeSignatureState,
  saveEmailComposeSignature,
  saveEmailComposeSignatureLogoUrl,
  subscribeEmailComposeSignatureStateChanged,
  toPublicSignatureAssetUrl,
} from '../../lib/emailComposeSignature';

function currentUserId(): string {
  try {
    const parsed = JSON.parse(localStorage.getItem('currentUser') || '{}') as { id?: string };
    return String(parsed?.id || '').trim();
  } catch {
    return '';
  }
}

function extractUploadedFileUrl(res: unknown): string {
  const root = res as {
    data?: {
      fileUrl?: string;
      url?: string;
      location?: string;
      settings?: { emailComposeSignatureLogoUrl?: string };
    } | string;
    fileUrl?: string;
  };
  const data = root?.data;
  if (typeof data === 'string' && data.trim()) return data.trim();
  if (data && typeof data === 'object') {
    const nested = String(
      data.fileUrl ||
        data.settings?.emailComposeSignatureLogoUrl ||
        data.url ||
        data.location ||
        '',
    ).trim();
    if (nested) return nested;
  }
  return String(root?.fileUrl || '').trim();
}

export function EmailComposeSignatureSettings() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoPreview, setLogoPreview] = useState('');
  const [logoBroken, setLogoBroken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const current = await ensureEmailComposeSignatureStateLoaded();
        if (!mounted) return;
        setDraft(current.signature);
        setSaved(current.signature);
        const absolute = toPublicSignatureAssetUrl(current.logoUrl);
        setLogoUrl(absolute);
        setLogoPreview(absolute);
        setLogoBroken(false);
      } catch {
        if (mounted) toast.error('Could not load email signature');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    return subscribeEmailComposeSignatureStateChanged((next) => {
      setSaved(next.signature);
      setDraft(next.signature);
      const absolute = toPublicSignatureAssetUrl(next.logoUrl);
      setLogoUrl(absolute);
      setLogoPreview((prev) => (prev.startsWith('blob:') ? prev : absolute));
      setLogoBroken(false);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (logoPreview.startsWith('blob:')) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  const dirty = draft.trimEnd() !== saved.trimEnd();
  const displayLogo = logoPreview || logoUrl;

  const handleSave = async () => {
    setSaving(true);
    try {
      const next = await saveEmailComposeSignature(draft);
      setSaved(next);
      setDraft(next);
      toast.success(next || logoUrl ? 'Email signature saved' : 'Email signature cleared');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not save email signature');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      await saveEmailComposeSignature('');
      await saveEmailComposeSignatureLogoUrl('');
      setDraft('');
      setSaved('');
      setLogoUrl('');
      if (logoPreview.startsWith('blob:')) URL.revokeObjectURL(logoPreview);
      setLogoPreview('');
      setLogoBroken(false);
      toast.success('Email signature cleared');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not clear email signature');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file (PNG, JPG, or SVG)');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo must be under 2 MB');
      return;
    }
    const userId = currentUserId();
    if (!userId) {
      toast.error('Sign in again to upload a logo');
      return;
    }

    const localPreview = URL.createObjectURL(file);
    if (logoPreview.startsWith('blob:')) URL.revokeObjectURL(logoPreview);
    setLogoPreview(localPreview);
    setLogoBroken(false);

    setUploadingLogo(true);
    try {
      const res = await apiUploadEmailSignatureLogo(userId, file);
      const url = extractUploadedFileUrl(res);
      if (!url) throw new Error('Upload did not return a file URL');
      const absolute = toPublicSignatureAssetUrl(url);
      const settings = (res as { data?: { settings?: { emailComposeSignature?: string; emailComposeSignatureLogoUrl?: string } } })
        ?.data?.settings;
      hydrateEmailComposeSignatureState({
        signature: settings?.emailComposeSignature ?? getEmailComposeSignatureState().signature,
        logoUrl: settings?.emailComposeSignatureLogoUrl || absolute,
      });
      setLogoUrl(absolute);
      URL.revokeObjectURL(localPreview);
      setLogoPreview(absolute);
      toast.success('Signature logo saved');
    } catch (err: unknown) {
      URL.revokeObjectURL(localPreview);
      setLogoPreview(logoUrl);
      toast.error(err instanceof Error ? err.message : 'Could not upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    setUploadingLogo(true);
    try {
      await saveEmailComposeSignatureLogoUrl('');
      setLogoUrl('');
      if (logoPreview.startsWith('blob:')) URL.revokeObjectURL(logoPreview);
      setLogoPreview('');
      setLogoBroken(false);
      toast.success('Signature logo removed');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not remove logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const hasAnything = Boolean(saved || logoUrl || getEmailComposeSignatureState().signature);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
          <Mail className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-slate-900">Email signature</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Fallback signature for Inbox and Submit to Client. When Gmail is connected, your Gmail
            signature is used first; if it is empty (or Outlook, which cannot share its signature),
            this text and logo are used instead. Your logo is always included when set.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          Logo (optional)
        </span>
        <div className="flex flex-wrap items-center gap-3">
          {displayLogo && !logoBroken ? (
            <div className="flex h-20 w-48 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={displayLogo}
                alt="Signature logo preview"
                className="max-h-full max-w-full object-contain"
                onError={() => setLogoBroken(true)}
              />
            </div>
          ) : (
            <div className="flex h-20 w-48 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-2 text-center text-slate-400">
              <ImagePlus className="h-5 w-5" />
              {logoBroken ? (
                <span className="text-[10px] leading-tight text-rose-500">Image URL not reachable</span>
              ) : null}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,image/gif"
              className="hidden"
              onChange={(e) => void handleLogoPick(e)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || uploadingLogo || saving}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploadingLogo ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImagePlus className="h-3.5 w-3.5" />
              )}
              {logoUrl ? 'Change logo' : 'Upload logo'}
            </button>
            {logoUrl ? (
              <button
                type="button"
                onClick={() => void handleRemoveLogo()}
                disabled={loading || uploadingLogo || saving}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </button>
            ) : null}
          </div>
        </div>
        <p className="text-xs text-slate-400">PNG, JPG, or SVG · max 2 MB · shown above your signature text</p>
      </div>

      <label className="mt-4 block space-y-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          Signature text
        </span>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={6}
          disabled={loading || saving}
          placeholder={'Thanks,\nYour Name\nCompany · Phone'}
          className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm leading-6 text-slate-800 outline-none ring-indigo-200 placeholder:text-slate-400 focus:bg-white focus:ring-2 disabled:opacity-60"
        />
      </label>

      {(displayLogo && !logoBroken) || draft.trim() ? (
        <div className="mt-4 space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Preview
          </span>
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm leading-6 text-slate-800">
            {displayLogo && !logoBroken ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={displayLogo}
                alt=""
                className="mb-3 block max-h-[72px] max-w-[220px] object-contain"
              />
            ) : null}
            {draft.trim() ? (
              <>
                <div className="border-t border-slate-200 pt-2 text-slate-400">--</div>
                <div className="mt-2 whitespace-pre-wrap">{draft}</div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!dirty || loading || saving}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          {saving ? 'Saving…' : dirty ? 'Save signature' : 'Saved'}
        </button>
        {hasAnything ? (
          <button
            type="button"
            onClick={() => void handleClear()}
            disabled={loading || saving || uploadingLogo}
            className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          >
            Clear all
          </button>
        ) : null}
      </div>
    </div>
  );
}
