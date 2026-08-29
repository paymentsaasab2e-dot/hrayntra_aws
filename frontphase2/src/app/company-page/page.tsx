'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  ExternalLink,
  Globe2,
  ImagePlus,
  Loader2,
  Pencil,
  RefreshCw,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import {
  apiCreateTenantCompanyPost,
  apiGetTenantCompanyPage,
  apiResyncTenantCompanyPage,
  apiUploadCompanyPageLogo,
  apiUploadCompanyPostMedia,
  apiUpsertTenantCompanyPage,
  type TenantCompanyPage,
  type TenantCompanyPost,
} from '@/lib/company-page-api';
import { IndustryMultiSelect } from '@/components/forms/IndustryMultiSelect';
import { LocationMultiSelect } from '@/components/forms/LocationMultiSelect';
import { parseIndustries, serializeIndustries } from '@/lib/industryOptions';
import { useUser } from '@/hooks/useUser';

const PHASE1_COMMUNITY =
  process.env.NEXT_PUBLIC_PHASE1_FRONTEND_URL?.replace(/\/+$/, '') || 'http://localhost:3000';

const FIELD =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none ring-sky-500/30 focus:ring-2';
const FIELD_ICON =
  'w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-900 outline-none ring-sky-500/30 focus:ring-2';

function toList(raw: string[] | string | undefined | null): string[] {
  if (Array.isArray(raw)) return raw.map((v) => String(v).trim()).filter(Boolean);
  return parseIndustries(raw || '');
}

/** Only persist http(s) logo URLs — blob: previews are local-only. */
function persistableLogoUrl(raw: string | null | undefined): string | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  if (value.startsWith('blob:') || value.startsWith('data:')) return null;
  return value;
}

export default function CompanyPageManager() {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [page, setPage] = useState<TenantCompanyPage | null>(null);
  const [posts, setPosts] = useState<TenantCompanyPost[]>([]);
  const [form, setForm] = useState({
    name: '',
    description: '',
    website: '',
    industries: [] as string[],
    locations: [] as string[],
    logoUrl: '',
  });
  const [postText, setPostText] = useState('');
  const [postMediaUrl, setPostMediaUrl] = useState('');
  const [postMediaPreview, setPostMediaPreview] = useState('');
  const [uploadingPostMedia, setUploadingPostMedia] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const postMediaInputRef = useRef<HTMLInputElement>(null);

  const industrySerialized = useMemo(
    () => serializeIndustries(form.industries),
    [form.industries],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGetTenantCompanyPage();
      const nextPage = res.data?.page || null;
      setPage(nextPage);
      setPosts(Array.isArray(res.data?.posts) ? res.data.posts : []);
      if (nextPage) {
        setForm({
          name: nextPage.name || '',
          description: nextPage.description || '',
          website: nextPage.website || '',
          industries: toList(nextPage.industries ?? nextPage.industry),
          locations: toList(nextPage.locations ?? nextPage.location),
          logoUrl: nextPage.logoUrl || '',
        });
        setEditingProfile(false);
      } else {
        const hqName = String(user?.organizationName || user?.companyName || '').trim();
        if (hqName) {
          setForm((prev) => ({ ...prev, name: prev.name || hqName }));
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load company page');
    } finally {
      setLoading(false);
    }
  }, [user?.organizationName, user?.companyName]);

  useEffect(() => {
    void load();
  }, [load]);

  const savePage = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim()) {
      const msg = 'Company name is required';
      setFormError(msg);
      toast.error(msg);
      return;
    }
    if (uploadingLogo) {
      const msg = 'Please wait for the logo upload to finish';
      setFormError(msg);
      toast.error(msg);
      return;
    }
    setSaving(true);
    try {
      const res = await apiUpsertTenantCompanyPage({
        name: form.name.trim(),
        description: form.description.trim(),
        website: form.website.trim(),
        industries: form.industries,
        locations: form.locations,
        logoUrl: persistableLogoUrl(form.logoUrl),
      });
      const nextPage = res.data?.page || null;
      if (!nextPage) {
        throw new Error('Save succeeded but no company page was returned');
      }
      setPage(nextPage);
      setEditingProfile(false);
      setFormError(null);
      toast.success(
        res.data?.synced
          ? 'Company page synced to Phase 1'
          : 'Company page saved (Phase 1 sync pending)',
      );
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save company page';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const onLogoSelected = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Logo must be under 5 MB');
      return;
    }

    // Instant local preview while upload runs
    const localPreview = URL.createObjectURL(file);
    setForm((f) => ({ ...f, logoUrl: localPreview }));

    setUploadingLogo(true);
    try {
      const res = await apiUploadCompanyPageLogo(file);
      const url = String(res.data?.logoUrl || '').trim();
      if (!url) throw new Error('Upload succeeded but no logo URL returned');
      setForm((f) => ({ ...f, logoUrl: url }));
      if (res.data?.page) setPage(res.data.page);
      toast.success('Logo uploaded');
      // Drop blob after remote URL is set
      window.setTimeout(() => URL.revokeObjectURL(localPreview), 1500);
    } catch (err) {
      URL.revokeObjectURL(localPreview);
      setForm((f) => ({ ...f, logoUrl: page?.logoUrl || '' }));
      toast.error(err instanceof Error ? err.message : 'Logo upload failed');
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const clearPostMedia = () => {
    if (postMediaPreview.startsWith('blob:')) {
      URL.revokeObjectURL(postMediaPreview);
    }
    setPostMediaPreview('');
    setPostMediaUrl('');
    if (postMediaInputRef.current) postMediaInputRef.current.value = '';
  };

  const onPostMediaSelected = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Photo must be under 8 MB');
      return;
    }

    if (postMediaPreview.startsWith('blob:')) {
      URL.revokeObjectURL(postMediaPreview);
    }
    const localPreview = URL.createObjectURL(file);
    setPostMediaPreview(localPreview);
    setPostMediaUrl('');
    setUploadingPostMedia(true);
    try {
      const res = await apiUploadCompanyPostMedia(file);
      const url = String(res.data?.mediaUrl || '').trim();
      if (!url) throw new Error('Upload succeeded but no photo URL returned');
      setPostMediaUrl(url);
      toast.success('Photo ready to publish');
      window.setTimeout(() => URL.revokeObjectURL(localPreview), 1500);
    } catch (err) {
      URL.revokeObjectURL(localPreview);
      setPostMediaPreview('');
      setPostMediaUrl('');
      toast.error(err instanceof Error ? err.message : 'Photo upload failed');
    } finally {
      setUploadingPostMedia(false);
      if (postMediaInputRef.current) postMediaInputRef.current.value = '';
    }
  };

  const publishPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!page) return;
    if (uploadingPostMedia) {
      toast.error('Please wait for the photo upload to finish');
      return;
    }
    const mediaUrl = persistableLogoUrl(postMediaUrl);
    if (!postText.trim() && !mediaUrl) {
      toast.error('Add post text or a photo');
      return;
    }
    setPosting(true);
    try {
      const res = await apiCreateTenantCompanyPost({
        text: postText.trim(),
        mediaUrl: mediaUrl || undefined,
      });
      setPostText('');
      clearPostMedia();
      toast.success(
        res.data?.synced ? 'Published to Phase 1' : 'Posted (Phase 1 sync pending)',
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to post');
    } finally {
      setPosting(false);
    }
  };

  const resync = async () => {
    setSyncing(true);
    try {
      const res = await apiResyncTenantCompanyPage();
      toast.success(res.data?.synced ? 'Resynced to Phase 1' : 'Resync attempted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Resync failed');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading…
      </div>
    );
  }

  const logoUploader = (
    <div>
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Company logo
      </span>
      <div className="flex items-center gap-3">
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-lg font-bold text-slate-500">
          {form.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            (form.name || 'C').slice(0, 1).toUpperCase()
          )}
          {uploadingLogo ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70">
              <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onLogoSelected(e.target.files?.[0] || null)}
          />
          <button
            type="button"
            disabled={uploadingLogo}
            onClick={() => logoInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <ImagePlus className="h-3.5 w-3.5" />
            {form.logoUrl ? 'Change logo' : 'Upload logo'}
          </button>
          {form.logoUrl ? (
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, logoUrl: '' }))}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
            >
              <X className="h-3.5 w-3.5" />
              Remove
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );

  const profileFields = (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block sm:col-span-2">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Company name *
        </span>
        <input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className={FIELD}
          placeholder="Acme Hiring Pvt Ltd"
        />
      </label>
      <label className="block sm:col-span-2">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          About
        </span>
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          rows={2}
          className={FIELD}
          placeholder="What your company does…"
        />
      </label>
      <label className="block sm:col-span-2">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Website / domain
        </span>
        <div className="relative">
          <Globe2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={form.website}
            onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
            className={FIELD_ICON}
            placeholder="acme.com"
          />
        </div>
      </label>
      <div className="sm:col-span-2">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Locations (multi-select)
        </span>
        <LocationMultiSelect
          value={form.locations}
          onChange={(locations) => setForm((f) => ({ ...f, locations }))}
          placeholder="Type a city and select…"
        />
      </div>
      <div className="sm:col-span-2">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Industries (multi-select)
        </span>
        <IndustryMultiSelect
          value={industrySerialized}
          onChange={(raw) => setForm((f) => ({ ...f, industries: parseIndustries(raw) }))}
          companyName={form.name}
          placeholder="Type an industry and select…"
        />
      </div>
      <div className="sm:col-span-2">{logoUploader}</div>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 p-4 md:p-6 lg:px-8">
      <Toaster position="top-right" richColors />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-600">
            Phase 2 → Phase 1
          </p>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Company Page</h1>
        </div>
        {page ? (
          <div className="flex flex-wrap gap-2">
            <a
              href={`${PHASE1_COMMUNITY}/en/community?company=${encodeURIComponent(page.id)}${
                page.domainKey ? `&domain=${encodeURIComponent(page.domainKey)}` : ''
              }`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-sky-300"
            >
              Phase 1 community
              <ExternalLink className="h-3 w-3" />
            </a>
            <button
              type="button"
              onClick={() => void resync()}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-60"
            >
              {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Resync
            </button>
          </div>
        ) : null}
      </div>

      {!page ? (
        <form onSubmit={savePage} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Create company profile</h2>
              <p className="text-[11px] text-slate-500">Then you can publish posts to Phase 1</p>
            </div>
          </div>
          {profileFields}
          {formError ? (
            <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {formError}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={saving}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60 sm:w-auto"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {saving ? 'Creating…' : 'Create company page'}
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-900 text-base font-bold text-white">
                  {page.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={page.logoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (page.logoLetter || page.name || 'C').slice(0, 1).toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-bold text-slate-900">{page.name}</h2>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                    {page.description || 'No description yet'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-medium text-slate-500">
                    {page.domainKey ? (
                      <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-emerald-700 ring-1 ring-emerald-100">
                        {page.domainKey}
                      </span>
                    ) : null}
                    {toList(page.locations ?? page.location).map((loc) => (
                      <span key={loc} className="rounded-md bg-sky-50 px-2 py-0.5 text-sky-700 ring-1 ring-sky-100">
                        {loc}
                      </span>
                    ))}
                    {toList(page.industries ?? page.industry).map((ind) => (
                      <span key={ind} className="rounded-md bg-violet-50 px-2 py-0.5 text-violet-700 ring-1 ring-violet-100">
                        {ind}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingProfile((v) => !v)}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <Pencil className="h-3 w-3" />
                {editingProfile ? 'Cancel' : 'Edit'}
              </button>
            </div>

            {editingProfile ? (
              <form onSubmit={savePage} className="mt-4 border-t border-slate-100 pt-4">
                {profileFields}
                {formError ? (
                  <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {formError}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={saving}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-bold text-white disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Save changes
                </button>
              </form>
            ) : null}
          </div>

          <form
            onSubmit={publishPost}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <h2 className="text-base font-bold text-slate-900">Publish a post</h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Text and/or photo — shows under your company on Phase 1 community
            </p>
            <div className="mt-3 space-y-3">
              <textarea
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                rows={3}
                className={`${FIELD} min-h-[88px]`}
                placeholder="Share a hiring update, culture note, or announcement…"
              />

              {(postMediaPreview || postMediaUrl) && (
                <div className="relative inline-block max-w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={postMediaUrl || postMediaPreview}
                    alt="Post preview"
                    className="max-h-56 max-w-full object-contain"
                  />
                  {uploadingPostMedia ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                      <Loader2 className="h-5 w-5 animate-spin text-sky-600" />
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={clearPostMedia}
                    className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-white/95 px-2 py-1 text-[11px] font-semibold text-rose-600 shadow-sm ring-1 ring-slate-200 hover:bg-rose-50"
                  >
                    <X className="h-3 w-3" />
                    Remove
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={postMediaInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => void onPostMediaSelected(e.target.files?.[0] || null)}
                />
                <button
                  type="button"
                  disabled={uploadingPostMedia || posting}
                  onClick={() => postMediaInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  {uploadingPostMedia ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ImagePlus className="h-3.5 w-3.5" />
                  )}
                  {postMediaUrl || postMediaPreview ? 'Change photo' : 'Add photo'}
                </button>
                <button
                  type="submit"
                  disabled={
                    posting ||
                    uploadingPostMedia ||
                    (!postText.trim() && !postMediaUrl)
                  }
                  className="ml-auto inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 text-sm font-bold text-white hover:bg-sky-500 disabled:opacity-60"
                >
                  {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Publish
                </button>
              </div>
            </div>
          </form>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="text-base font-bold text-slate-900">Posts</h2>
              <span className="text-xs font-medium text-slate-400">{posts.length} total</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">#</th>
                    <th className="px-4 py-2.5">Post</th>
                    <th className="whitespace-nowrap px-4 py-2.5">Published</th>
                    <th className="px-4 py-2.5">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400">
                        No posts yet — publish your first update above.
                      </td>
                    </tr>
                  ) : (
                    posts.map((post, index) => (
                      <tr key={post.id} className="border-t border-slate-100 align-top hover:bg-slate-50/80">
                        <td className="px-4 py-3 tabular-nums text-slate-400">{index + 1}</td>
                        <td className="max-w-md px-4 py-3 text-slate-800">
                          <div className="flex gap-3">
                            {post.mediaUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={post.mediaUrl}
                                alt=""
                                className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 object-cover"
                              />
                            ) : null}
                            <p className="line-clamp-3 whitespace-pre-wrap">{post.text}</p>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                          {new Date(post.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-semibold capitalize text-sky-700 ring-1 ring-sky-100">
                            {post.type || 'text'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
