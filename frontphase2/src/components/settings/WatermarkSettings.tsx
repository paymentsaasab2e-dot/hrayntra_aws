'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Droplets, ImagePlus, Loader2, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { usePermissions } from '../../hooks/usePermissions';
import { apiGetOrgWatermark, apiSetOrgWatermark, apiUploadOrgWatermarkLogo } from '../../lib/api';
import {
  DEFAULT_EXPORT_WATERMARK,
  resolveWatermarkImageSrc,
  cacheWatermarkLogoDataUrl,
  type ExportWatermarkSettings,
  writeCachedOrgWatermark,
} from '../../lib/exportWatermark';
import { SettingsPageHero } from './SettingsPageHero';

export function WatermarkSettings() {
  const { isSuperAdmin } = usePermissions();
  const canEdit = isSuperAdmin();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [draft, setDraft] = useState<ExportWatermarkSettings>(DEFAULT_EXPORT_WATERMARK);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [previewBroken, setPreviewBroken] = useState(false);

  const remotePreviewSrc = useMemo(
    () => resolveWatermarkImageSrc(draft.imageUrl),
    [draft.imageUrl],
  );
  const previewSrc = localPreviewUrl || remotePreviewSrc;
  const hasLogo = Boolean(draft.imageUrl || localPreviewUrl);

  const load = useCallback(async () => {
    if (!canEdit) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await apiGetOrgWatermark();
      const next = { ...DEFAULT_EXPORT_WATERMARK, ...(res.data?.watermark || {}) };
      setDraft(next);
      setPreviewBroken(false);
      writeCachedOrgWatermark(next);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load watermark');
    } finally {
      setLoading(false);
    }
  }, [canEdit]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    };
  }, [localPreviewUrl]);

  const save = async () => {
    if (!canEdit) return;
    const text = draft.text.trim();
    const imageUrl = draft.imageUrl.trim();
    if (draft.enabled && !text && !imageUrl) {
      toast.error('Add watermark text and/or upload a logo image before enabling');
      return;
    }
    setSaving(true);
    try {
      const res = await apiSetOrgWatermark({ ...draft, text, imageUrl });
      const next = { ...DEFAULT_EXPORT_WATERMARK, ...(res.data?.watermark || {}) };
      setDraft(next);
      writeCachedOrgWatermark(next);
      toast.success('Watermark saved — applies to all team exports');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save watermark');
    } finally {
      setSaving(false);
    }
  };

  const clearLogo = () => {
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    setLocalPreviewUrl(null);
    setPreviewBroken(false);
    setDraft((d) => ({ ...d, imageUrl: '' }));
  };

  const onPickLogo = async (file: File | null) => {
    if (!file || !canEdit) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG, JPG, WEBP, SVG)');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error('Logo must be under 4 MB');
      return;
    }

    // Instant local preview so the user sees the image immediately.
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    const objectUrl = URL.createObjectURL(file);
    setLocalPreviewUrl(objectUrl);
    setPreviewBroken(false);

    // Cache a PNG data-URL now so exports work even if the public file URL is slow/unavailable.
    void (async () => {
      try {
        const bitmap = await createImageBitmap(file);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, bitmap.width);
        canvas.height = Math.max(1, bitmap.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close?.();
        const dataUrl = canvas.toDataURL('image/png');
        // Temporarily keyed by object URL; re-keyed to server URL after upload.
        cacheWatermarkLogoDataUrl(objectUrl, dataUrl);
        (window as unknown as { __pendingWmLogoDataUrl?: string }).__pendingWmLogoDataUrl = dataUrl;
      } catch {
        /* ignore */
      }
    })();

    setUploading(true);
    try {
      const res = await apiUploadOrgWatermarkLogo(file);
      const url = String(res.data?.fileUrl || '').trim();
      if (!url) throw new Error('Upload succeeded but no file URL returned');
      const pending = (window as unknown as { __pendingWmLogoDataUrl?: string }).__pendingWmLogoDataUrl;
      if (pending) {
        cacheWatermarkLogoDataUrl(url, pending);
        delete (window as unknown as { __pendingWmLogoDataUrl?: string }).__pendingWmLogoDataUrl;
      }
      const next = {
        ...DEFAULT_EXPORT_WATERMARK,
        ...(res.data?.watermark || draft),
        imageUrl: url,
        enabled: Boolean(res.data?.watermark?.enabled ?? true),
      };
      setDraft(next);
      writeCachedOrgWatermark(next);
      toast.success('Logo uploaded and saved — you should see it in the preview below');
    } catch (error: any) {
      clearLogo();
      toast.error(error?.message || 'Failed to upload logo');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!canEdit) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Only Super Admin can configure the organization export watermark.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SettingsPageHero
        eyebrow="Organization"
        title="Export watermark"
        description="Add text and/or a logo image that appears on every Phase 2 PDF, Excel, and CSV export. All team members inherit this setting automatically."
        icon={<Droplets className="h-3.5 w-3.5" />}
        actions={
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || loading || uploading}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save watermark
          </button>
        }
      />

      <div className="rounded-2xl border border-indigo-100/70 bg-white p-5 shadow-sm sm:p-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="space-y-5">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
                className="mt-1 h-4 w-4 rounded border-indigo-200 text-indigo-600 focus:ring-indigo-500/30"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-800">
                  Enable watermark on exports
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  When on, text and/or logo below are stamped on PDF / Excel / CSV downloads across
                  Phase 2.
                </span>
              </span>
            </label>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Watermark text (optional)
              </label>
              <input
                type="text"
                value={draft.text}
                maxLength={120}
                placeholder="e.g. Confidential — Acme Recruiting"
                onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
              />
              <p className="mt-1 text-[11px] text-slate-400">{draft.text.length}/120</p>
            </div>

            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Watermark logo image (optional)
                </label>
                {hasLogo && !uploading ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Logo ready
                  </span>
                ) : null}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <div
                  className={`flex h-28 w-full max-w-[200px] items-center justify-center overflow-hidden rounded-xl border-2 border-dashed ${
                    hasLogo
                      ? 'border-emerald-200 bg-emerald-50/40'
                      : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  {uploading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                  ) : previewSrc && !previewBroken ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewSrc}
                      alt="Uploaded watermark logo"
                      className="max-h-full max-w-full object-contain p-2"
                      onError={() => setPreviewBroken(true)}
                      onLoad={() => setPreviewBroken(false)}
                    />
                  ) : (
                    <div className="px-3 text-center text-[11px] text-slate-400">
                      {previewBroken ? 'Image URL failed to load' : 'No logo yet'}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={(e) => void onPickLogo(e.target.files?.[0] || null)}
                    />
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-60"
                    >
                      {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ImagePlus className="h-4 w-4" />
                      )}
                      {hasLogo ? 'Replace logo' : 'Upload logo'}
                    </button>
                    {hasLogo ? (
                      <button
                        type="button"
                        onClick={clearLogo}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-400">
                    PNG / JPG / WEBP · max 4 MB. After upload you should see the image in the box on
                    the left and a green <strong>Logo ready</strong> badge.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Opacity ({Math.round(draft.opacity * 100)}%)
              </label>
              <input
                type="range"
                min={5}
                max={50}
                step={1}
                value={Math.round(draft.opacity * 100)}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, opacity: Number(e.target.value) / 100 }))
                }
                className="w-full accent-indigo-600"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  ['applyToPdf', 'PDF exports'],
                  ['applyToExcel', 'Excel exports'],
                  ['applyToCsv', 'CSV exports'],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-sm text-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={draft[key]}
                    onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.checked }))}
                    className="h-3.5 w-3.5 rounded border-indigo-200 text-indigo-600"
                  />
                  {label}
                </label>
              ))}
            </div>

            {(draft.text.trim() || hasLogo) ? (
              <div className="relative overflow-hidden rounded-xl border border-dashed border-indigo-200 bg-gradient-to-br from-slate-50 to-indigo-50/40 px-6 py-10 text-center">
                {previewSrc && !previewBroken ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewSrc}
                    alt="Watermark logo preview"
                    className="mx-auto max-h-24 max-w-[220px] object-contain"
                    style={{ opacity: draft.opacity, transform: 'rotate(-18deg)' }}
                  />
                ) : null}
                {draft.text.trim() ? (
                  <p
                    className="mt-4 select-none text-2xl font-semibold tracking-wide text-indigo-400"
                    style={{ opacity: draft.opacity, transform: 'rotate(-18deg)' }}
                  >
                    {draft.text.trim()}
                  </p>
                ) : null}
                <p className="mt-6 text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  Export preview
                </p>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
