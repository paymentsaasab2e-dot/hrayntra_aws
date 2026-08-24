'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GraduationCap, ImagePlus, Plus, RefreshCw, Search, Trash2, Upload, Users, Video, X } from 'lucide-react';
import {
  HqModulePageLayout,
  HQ_TABLE_BODY_SCROLL_CLASS,
  HQ_TABLE_CARD_CLASS,
  HQ_TOOLBAR_ROW_CLASS,
} from '@/components/hq/HqModulePageLayout';
import { HqPrimaryButton, HqSecondaryButton, HqStatCard } from '@/components/hq/hqUi';
import {
  apiHqBulkDeleteCourses,
  apiHqCreateCourse,
  apiHqDeleteCourse,
  apiHqListCourseEnrollments,
  apiHqListCourses,
  apiHqPassCourseCheckpoint,
  apiHqUpdateCourse,
  apiHqUploadCourseThumbnail,
  apiHqUploadCourseVideo,
  type HqCourseCertificate,
  type HqCourseCheckpoint,
  type HqCourseLearner,
  type HqCoursePayload,
  type HqCourseRow,
  type HqCourseStats,
} from '@/lib/api';
import { HqCourseCertificateAndJourney, defaultHqCourseCertificate } from '@/components/hq/HqCourseCertificateAndJourney';
import { requestConfirm, requestError, requestSuccess, requestWarning } from '@/lib/appDialog';

const EMPTY_STATS: HqCourseStats = {
  total: 0,
  published: 0,
  draft: 0,
  premium: 0,
  enrollments: 0,
};

const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
const TIERS = ['free', 'premium', 'certified'] as const;

type CourseFormState = {
  title: string;
  description: string;
  category: string;
  level: string;
  instructorName: string;
  estimatedHours: string;
  totalLessons: string;
  tags: string;
  accessTier: string;
  tokenCost: string;
  isPublished: boolean;
  isCertified: boolean;
  thumbnailUrl: string;
  videoUrl: string;
  certificate: HqCourseCertificate;
  checkpoints: HqCourseCheckpoint[];
};

const EMPTY_FORM: CourseFormState = {
  title: '',
  description: '',
  category: '',
  level: 'beginner',
  instructorName: '',
  estimatedHours: '0',
  totalLessons: '0',
  tags: '',
  accessTier: 'free',
  tokenCost: '0',
  isPublished: true,
  isCertified: false,
  thumbnailUrl: '',
  videoUrl: '',
  certificate: defaultHqCourseCertificate(),
  checkpoints: [],
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function toPayload(form: CourseFormState): HqCoursePayload {
  const accessTier = form.accessTier || 'free';
  const tokenCost = accessTier === 'free' ? 0 : Math.max(0, Number(form.tokenCost) || 0);
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    category: form.category.trim() || 'general',
    level: form.level || 'beginner',
    instructorName: form.instructorName.trim(),
    estimatedHours: Math.max(0, Number(form.estimatedHours) || 0),
    totalLessons: Math.max(0, Number(form.totalLessons) || 0),
    tags: form.tags,
    accessTier,
    tokenCost,
    isPublished: form.isPublished,
    isCertified: form.isCertified || accessTier === 'certified',
    thumbnailUrl: form.thumbnailUrl.trim(),
    videoUrl: form.videoUrl.trim(),
    certificate: form.certificate,
    checkpoints: form.checkpoints,
  };
}

function formFromCourse(course: HqCourseRow): CourseFormState {
  return {
    title: course.title || '',
    description: course.description || '',
    category: course.category || '',
    level: course.level || 'beginner',
    instructorName: course.instructorName || '',
    estimatedHours: String(course.estimatedHours ?? 0),
    totalLessons: String(course.totalLessons ?? 0),
    tags: (course.tags || []).join(', '),
    accessTier: course.accessTier || 'free',
    tokenCost: String(course.tokenCost ?? 0),
    isPublished: Boolean(course.isPublished),
    isCertified: Boolean(course.isCertified),
    thumbnailUrl: course.thumbnailUrl || '',
    videoUrl: course.videoUrl || '',
    certificate: course.certificate || defaultHqCourseCertificate(),
    checkpoints: Array.isArray(course.checkpoints) ? course.checkpoints : [],
  };
}

function isLikelyYoutubeUrl(url: string) {
  return /youtu\.?be/i.test(url);
}

function TierBadge({ tier }: { tier: string }) {
  const style =
    tier === 'certified'
      ? 'bg-violet-50 text-violet-800 ring-violet-200'
      : tier === 'premium'
        ? 'bg-amber-50 text-amber-800 ring-amber-200'
        : 'bg-emerald-50 text-emerald-800 ring-emerald-200';
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${style}`}>
      {tier || 'free'}
    </span>
  );
}

function LearnerStatusBadge({ status }: { status: string }) {
  const style =
    status === 'completed'
      ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
      : status === 'in_progress'
        ? 'bg-sky-50 text-sky-800 ring-sky-200'
        : 'bg-slate-100 text-slate-700 ring-slate-200';
  const label =
    status === 'completed' ? 'Completed' : status === 'in_progress' ? 'In progress' : 'Joined';
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${style}`}>
      {label}
    </span>
  );
}

export default function HqCoursesPage() {
  const [courses, setCourses] = useState<HqCourseRow[]>([]);
  const [stats, setStats] = useState<HqCourseStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<HqCourseRow | null>(null);
  const [form, setForm] = useState<CourseFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [journeyLessons, setJourneyLessons] = useState<HqCourseRow['lessons']>([]);
  const [passingCheckpointId, setPassingCheckpointId] = useState<string | null>(null);
  const [learnersOpen, setLearnersOpen] = useState(false);
  const [learnersCourse, setLearnersCourse] = useState<HqCourseRow | null>(null);
  const [learners, setLearners] = useState<HqCourseLearner[]>([]);
  const [learnersLoading, setLearnersLoading] = useState(false);
  const [learnersError, setLearnersError] = useState<string | null>(null);
  const [learnerStats, setLearnerStats] = useState({
    total: 0,
    completed: 0,
    inProgress: 0,
    joined: 0,
  });
  const thumbnailInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  const loadCourses = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await apiHqListCourses();
      const data = result.data;
      setCourses(Array.isArray(data?.courses) ? data.courses : []);
      setStats(data?.stats || EMPTY_STATS);
      setSelectedIds([]);
    } catch (error: any) {
      setCourses([]);
      setStats(EMPTY_STATS);
      setLoadError(error?.message || 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return courses.filter((course) => {
      if (filter === 'published' && !course.isPublished) return false;
      if (filter === 'draft' && course.isPublished) return false;
      if (!q) return true;
      const hay = [
        course.title,
        course.category,
        course.level,
        course.instructorName,
        ...(course.tags || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [courses, filter, search]);

  const filteredIds = useMemo(() => filtered.map((c) => c.id), [filtered]);
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedIds.includes(id));
  const someFilteredSelected = filteredIds.some((id) => selectedIds.includes(id));

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
      return;
    }
    setSelectedIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setJourneyLessons([]);
    setModalOpen(true);
  };

  const openEdit = (course: HqCourseRow) => {
    setEditing(course);
    setForm(formFromCourse(course));
    setJourneyLessons(course.lessons || []);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setJourneyLessons([]);
  };

  const openLearners = async (course: HqCourseRow) => {
    setLearnersCourse(course);
    setLearnersOpen(true);
    setLearnersLoading(true);
    setLearnersError(null);
    setLearners([]);
    setLearnerStats({ total: 0, completed: 0, inProgress: 0, joined: 0 });
    try {
      const result = await apiHqListCourseEnrollments(course.id);
      setLearners(Array.isArray(result.data?.learners) ? result.data.learners : []);
      setLearnerStats(
        result.data?.stats || {
          total: 0,
          completed: 0,
          inProgress: 0,
          joined: 0,
        },
      );
      if (result.data?.course) {
        setLearnersCourse(result.data.course);
        setCourses((prev) =>
          prev.map((row) =>
            row.id === course.id
              ? { ...row, enrolledCount: result.data?.course?.enrolledCount ?? row.enrolledCount }
              : row,
          ),
        );
      }
    } catch (error: any) {
      setLearnersError(error?.message || 'Failed to load learners');
    } finally {
      setLearnersLoading(false);
    }
  };

  const closeLearners = () => {
    if (learnersLoading) return;
    setLearnersOpen(false);
    setLearnersCourse(null);
    setLearners([]);
    setLearnersError(null);
  };

  const handleSave = async () => {
    const payload = toPayload(form);
    if (!payload.title) {
      void requestWarning('Course title is required.');
      return;
    }
    setSaving(true);
    try {
      if (editing?.id) {
        await apiHqUpdateCourse(editing.id, payload);
        void requestSuccess('Course updated');
      } else {
        await apiHqCreateCourse(payload);
        void requestSuccess('Course created');
      }
      setModalOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      await loadCourses();
    } catch (error: any) {
      void requestError(error?.message || 'Failed to save course');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (course: HqCourseRow) => {
    const ok = await requestConfirm(`Delete course "${course.title}"? This cannot be undone.`, {
      tone: 'warning',
      title: 'Delete course',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });
    if (!ok) return;
    setDeletingId(course.id);
    try {
      await apiHqDeleteCourse(course.id);
      void requestSuccess('Course deleted');
      setSelectedIds((prev) => prev.filter((id) => id !== course.id));
      await loadCourses();
    } catch (error: any) {
      void requestError(error?.message || 'Failed to delete course');
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkDelete = async () => {
    const ids = selectedIds.filter(Boolean);
    if (!ids.length) {
      void requestWarning('Select at least one course to delete.');
      return;
    }
    const ok = await requestConfirm(
      `Delete ${ids.length} selected course${ids.length === 1 ? '' : 's'}? This cannot be undone.`,
      {
        tone: 'warning',
        title: 'Delete courses',
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
      },
    );
    if (!ok) return;
    setBulkDeleting(true);
    try {
      const result = await apiHqBulkDeleteCourses(ids);
      const count = result.data?.deletedCount ?? ids.length;
      void requestSuccess(`Deleted ${count} course${count === 1 ? '' : 's'}`);
      setSelectedIds([]);
      await loadCourses();
    } catch (error: any) {
      void requestError(error?.message || 'Failed to delete selected courses');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleThumbnailUpload = async (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      void requestWarning('Please choose an image file (JPG, PNG, WEBP, or GIF).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      void requestWarning('Image must be 5 MB or smaller.');
      return;
    }
    setUploadingThumbnail(true);
    try {
      const result = await apiHqUploadCourseThumbnail(file);
      const url = result.data?.thumbnail?.url;
      if (!url) throw new Error('Upload succeeded but no URL was returned');
      setForm((p) => ({ ...p, thumbnailUrl: url }));
    } catch (error: any) {
      void requestError(error?.message || 'Failed to upload thumbnail');
    } finally {
      setUploadingThumbnail(false);
      if (thumbnailInputRef.current) thumbnailInputRef.current.value = '';
    }
  };

  const handleVideoUpload = async (file: File | null | undefined) => {
    if (!file) return;
    const okType =
      file.type.startsWith('video/') ||
      /\.(mp4|webm|mov|m4v)$/i.test(file.name);
    if (!okType) {
      void requestWarning('Please choose a video file (MP4, WEBM, or MOV).');
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      void requestWarning('Video must be 100 MB or smaller.');
      return;
    }
    setUploadingVideo(true);
    try {
      const result = await apiHqUploadCourseVideo(file);
      const url = result.data?.video?.url;
      if (!url) throw new Error('Upload succeeded but no URL was returned');
      setForm((p) => ({ ...p, videoUrl: url }));
    } catch (error: any) {
      void requestError(error?.message || 'Failed to upload video');
    } finally {
      setUploadingVideo(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  return (
    <HqModulePageLayout
      title="Courses"
      subtitle="Create and manage Phase 1 LMS courses for candidates"
      icon={<GraduationCap className="h-5 w-5" />}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.length > 0 ? (
            <button
              type="button"
              onClick={() => void handleBulkDelete()}
              disabled={bulkDeleting || loading}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-600 px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-50"
            >
              <Trash2 className={`h-3.5 w-3.5 ${bulkDeleting ? 'animate-pulse' : ''}`} />
              Delete selected ({selectedIds.length})
            </button>
          ) : null}
          <HqSecondaryButton type="button" onClick={() => void loadCourses()} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </HqSecondaryButton>
          <HqPrimaryButton type="button" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            Create course
          </HqPrimaryButton>
        </div>
      }
      belowScroll={
        <>
        {modalOpen ? (
          <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
            <button
              type="button"
              className="absolute inset-0 bg-slate-900/45 backdrop-blur-[1px]"
              aria-label="Close"
              onClick={closeModal}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="hq-course-modal-title"
              className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div>
                  <h2 id="hq-course-modal-title" className="text-base font-bold text-slate-900">
                    {editing ? 'Edit course' : 'Create course'}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Courses are stored in the Phase 1 LMS catalog for candidates.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                  aria-label="Close dialog"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="max-h-[70vh] space-y-3 overflow-y-auto px-5 py-4">
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                    placeholder="e.g. Frontend Masterclass"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Description
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    rows={3}
                    className="w-full resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                    placeholder="What will candidates learn?"
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Category
                    </label>
                    <input
                      value={form.category}
                      onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                      placeholder="frontend, backend, behavioral…"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Level
                    </label>
                    <select
                      value={form.level}
                      onChange={(e) => setForm((p) => ({ ...p, level: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                    >
                      {LEVELS.map((level) => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Access tier
                    </label>
                    <select
                      value={form.accessTier}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          accessTier: e.target.value,
                          isCertified: e.target.value === 'certified' ? true : p.isCertified,
                          tokenCost: e.target.value === 'free' ? '0' : p.tokenCost,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                    >
                      {TIERS.map((tier) => (
                        <option key={tier} value={tier}>
                          {tier}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Token cost
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.tokenCost}
                      disabled={form.accessTier === 'free'}
                      onChange={(e) => setForm((p) => ({ ...p, tokenCost: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 disabled:bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Instructor
                    </label>
                    <input
                      value={form.instructorName}
                      onChange={(e) => setForm((p) => ({ ...p, instructorName: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                      placeholder="Instructor name"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Estimated hours
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.5"
                      value={form.estimatedHours}
                      onChange={(e) => setForm((p) => ({ ...p, estimatedHours: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Total lessons
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.totalLessons}
                      onChange={(e) => setForm((p) => ({ ...p, totalLessons: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                  <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <ImagePlus className="h-3.5 w-3.5" />
                    Course thumbnail
                  </label>
                  <p className="mb-3 text-xs text-slate-500">
                    Upload an image or paste a URL. JPG, PNG, WEBP, GIF · max 5 MB.
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <div className="flex h-28 w-full shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-white sm:w-40">
                      {form.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={form.thumbnailUrl}
                          alt="Course thumbnail preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="px-3 text-center text-[11px] font-medium text-slate-400">
                          No thumbnail yet
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <input
                        ref={thumbnailInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={(e) => void handleThumbnailUpload(e.target.files?.[0])}
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => thumbnailInputRef.current?.click()}
                          disabled={uploadingThumbnail || saving}
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-50"
                        >
                          <Upload className={`h-3.5 w-3.5 ${uploadingThumbnail ? 'animate-pulse' : ''}`} />
                          {uploadingThumbnail ? 'Uploading…' : 'Upload image'}
                        </button>
                        {form.thumbnailUrl ? (
                          <button
                            type="button"
                            onClick={() => setForm((p) => ({ ...p, thumbnailUrl: '' }))}
                            disabled={uploadingThumbnail || saving}
                            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Or thumbnail URL
                        </label>
                        <input
                          value={form.thumbnailUrl}
                          onChange={(e) => setForm((p) => ({ ...p, thumbnailUrl: e.target.value }))}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                          placeholder="https://…"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                  <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <Video className="h-3.5 w-3.5" />
                    Course video
                  </label>
                  <p className="mb-3 text-xs text-slate-500">
                    Upload a video file or paste a YouTube link. Shown in Phase 1 LMS. MP4/WEBM/MOV · max 100 MB.
                  </p>
                  <div className="flex flex-col gap-3">
                    {form.videoUrl ? (
                      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
                        {isLikelyYoutubeUrl(form.videoUrl) ? (
                          <div className="flex aspect-video items-center justify-center px-4 text-center text-xs font-medium text-slate-300">
                            YouTube link ready — candidates will see the embed in Phase 1 LMS
                          </div>
                        ) : (
                          <video
                            src={form.videoUrl}
                            className="aspect-video w-full bg-black object-contain"
                            controls
                            preload="metadata"
                          />
                        )}
                      </div>
                    ) : (
                      <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white">
                        <span className="text-[11px] font-medium text-slate-400">No video yet</span>
                      </div>
                    )}
                    <input
                      ref={videoInputRef}
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.webm,.mov,.m4v"
                      className="hidden"
                      onChange={(e) => void handleVideoUpload(e.target.files?.[0])}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => videoInputRef.current?.click()}
                        disabled={uploadingVideo || saving}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-50"
                      >
                        <Upload className={`h-3.5 w-3.5 ${uploadingVideo ? 'animate-pulse' : ''}`} />
                        {uploadingVideo ? 'Uploading…' : 'Upload video'}
                      </button>
                      {form.videoUrl ? (
                        <button
                          type="button"
                          onClick={() => setForm((p) => ({ ...p, videoUrl: '' }))}
                          disabled={uploadingVideo || saving}
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Or YouTube / video URL
                      </label>
                      <input
                        value={form.videoUrl}
                        onChange={(e) => setForm((p) => ({ ...p, videoUrl: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                        placeholder="https://www.youtube.com/watch?v=… or https://…"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Tags
                  </label>
                  <input
                    value={form.tags}
                    onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                    placeholder="react, css, frontend (comma separated)"
                  />
                </div>
                <div className="flex flex-wrap gap-4 pt-1">
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.isPublished}
                      onChange={(e) => setForm((p) => ({ ...p, isPublished: e.target.checked }))}
                      className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                    />
                    Published
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.isCertified}
                      onChange={(e) => setForm((p) => ({ ...p, isCertified: e.target.checked }))}
                      className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                    />
                    Certified
                  </label>
                </div>

                <HqCourseCertificateAndJourney
                  courseTitle={form.title}
                  instructorName={form.instructorName}
                  isCertified={form.isCertified || form.accessTier === 'certified'}
                  certificate={form.certificate}
                  checkpoints={form.checkpoints}
                  lessons={journeyLessons || []}
                  disabled={saving}
                  onCertificateChange={(certificate) => setForm((p) => ({ ...p, certificate }))}
                  onCheckpointsChange={(checkpoints) => setForm((p) => ({ ...p, checkpoints }))}
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
                <HqSecondaryButton type="button" onClick={closeModal} disabled={saving}>
                  Cancel
                </HqSecondaryButton>
                <HqPrimaryButton type="button" onClick={() => void handleSave()} disabled={saving}>
                  {saving ? 'Saving…' : editing ? 'Save changes' : 'Create course'}
                </HqPrimaryButton>
              </div>
            </div>
          </div>
        ) : null}

        {learnersOpen ? (
          <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
            <button
              type="button"
              className="absolute inset-0 bg-slate-900/45 backdrop-blur-[1px]"
              aria-label="Close learners"
              onClick={closeLearners}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="hq-course-learners-title"
              className="relative z-10 flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div>
                  <h2 id="hq-course-learners-title" className="text-base font-bold text-slate-900">
                    Learners · {learnersCourse?.title || 'Course'}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Phase 1 users who unlocked or joined this course.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeLearners}
                  disabled={learnersLoading}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                  aria-label="Close dialog"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 border-b border-slate-100 px-5 py-3 sm:grid-cols-4">
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Total</p>
                  <p className="text-sm font-bold text-slate-900">{learnerStats.total}</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Joined</p>
                  <p className="text-sm font-bold text-slate-900">{learnerStats.joined}</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">In progress</p>
                  <p className="text-sm font-bold text-slate-900">{learnerStats.inProgress}</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Completed</p>
                  <p className="text-sm font-bold text-slate-900">{learnerStats.completed}</p>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                {learnersLoading ? (
                  <p className="py-10 text-center text-sm text-slate-500">Loading learners…</p>
                ) : learnersError ? (
                  <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {learnersError}
                  </p>
                ) : learners.length === 0 ? (
                  <p className="py-10 text-center text-sm text-slate-500">
                    No learners yet. Users appear here after they unlock or join this course in Phase 1 LMS.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
                    {learners.map((learner) => (
                      <li key={learner.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-slate-900">{learner.name}</p>
                            <LearnerStatusBadge status={learner.status} />
                          </div>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {[learner.email, learner.phone, learner.title, learner.location]
                              .filter(Boolean)
                              .join(' · ') || `User ID ${learner.userId}`}
                          </p>
                        </div>
                        <div className="shrink-0 text-left text-xs text-slate-500 sm:text-right">
                          <p className="font-semibold text-slate-800">{learner.progressPercent}% complete</p>
                          <p className="mt-0.5">
                            Joined {formatDate(learner.startedAt || learner.lastAccessedAt)}
                          </p>
                          {learner.certificateId ? (
                            <p className="mt-0.5 font-medium text-violet-700">Cert {learner.certificateId}</p>
                          ) : null}
                          {(learnersCourse?.checkpoints || [])
                            .filter((cp) => cp.type === 'manual')
                            .map((cp) => {
                              const passed = Boolean(learner.checkpointProgress?.[cp.id]?.passed);
                              return (
                                <button
                                  key={cp.id}
                                  type="button"
                                  disabled={passed || passingCheckpointId === `${learner.id}:${cp.id}` || !learnersCourse?.id}
                                  onClick={async () => {
                                    if (!learnersCourse?.id) return;
                                    setPassingCheckpointId(`${learner.id}:${cp.id}`);
                                    try {
                                      await apiHqPassCourseCheckpoint(learnersCourse.id, learner.id, cp.id);
                                      void requestSuccess(`Signed off: ${cp.title || 'checkpoint'}`);
                                      await openLearners(learnersCourse);
                                    } catch (error: any) {
                                      void requestError(error?.message || 'Failed to sign off checkpoint');
                                    } finally {
                                      setPassingCheckpointId(null);
                                    }
                                  }}
                                  className="mt-1 inline-flex rounded-lg border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-800 disabled:opacity-50"
                                >
                                  {passed ? `Signed: ${cp.title || 'HQ'}` : `Sign off: ${cp.title || 'HQ'}`}
                                </button>
                              );
                            })}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex justify-end border-t border-slate-100 px-5 py-4">
                <HqSecondaryButton type="button" onClick={closeLearners} disabled={learnersLoading}>
                  Close
                </HqSecondaryButton>
              </div>
            </div>
          </div>
        ) : null}
        </>
      }
    >
      {loadError ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {loadError}
        </div>
      ) : null}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <HqStatCard label="Total courses" value={stats.total} />
        <HqStatCard label="Published" value={stats.published} />
        <HqStatCard label="Draft" value={stats.draft} />
        <HqStatCard label="Premium / certified" value={stats.premium} />
        <HqStatCard label="Course unlocks" value={stats.enrollments || 0} />
      </div>

      <div className={HQ_TABLE_CARD_CLASS}>
        <div className={HQ_TOOLBAR_ROW_CLASS}>
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'published', label: 'Published' },
                { id: 'draft', label: 'Draft' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  filter === tab.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
            {selectedIds.length > 0 ? (
              <span className="ml-1 text-xs font-semibold text-rose-700">
                {selectedIds.length} selected
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectedIds.length > 0 ? (
              <button
                type="button"
                onClick={() => void handleBulkDelete()}
                disabled={bulkDeleting}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Bulk delete
              </button>
            ) : null}
            <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search courses…"
                className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              />
            </div>
          </div>
        </div>

        <div className={HQ_TABLE_BODY_SCROLL_CLASS}>
          {loading ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">Loading courses…</p>
          ) : filtered.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">
              No courses yet. Click Create course to add one.
            </p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = !allFilteredSelected && someFilteredSelected;
                      }}
                      onChange={toggleSelectAllFiltered}
                      aria-label="Select all visible courses"
                      className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Course
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Category
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Level
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Tier
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Learners
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Status
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Updated
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((course) => {
                  const selected = selectedIds.includes(course.id);
                  return (
                  <tr
                    key={course.id}
                    className={`border-t border-slate-100 hover:bg-slate-50/70 ${
                      selected ? 'bg-violet-50/40' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSelectOne(course.id)}
                        aria-label={`Select ${course.title}`}
                        className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{course.title}</p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                        {course.instructorName || course.description || '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-600">{course.category || '—'}</td>
                    <td className="px-4 py-3 capitalize text-slate-600">{course.level || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <TierBadge tier={course.accessTier} />
                        {course.tokenCost > 0 ? (
                          <span className="text-[11px] font-semibold text-slate-500">
                            {course.tokenCost} coins
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void openLearners(course)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Users className="h-3.5 w-3.5 text-violet-600" />
                        {course.enrolledCount || 0}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${
                          course.isPublished
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                            : 'bg-slate-100 text-slate-600 ring-slate-200'
                        }`}
                      >
                        {course.isPublished ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(course.updatedAt || course.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => void openLearners(course)}
                          className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-100"
                        >
                          Learners
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(course)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(course)}
                          disabled={deletingId === course.id || bulkDeleting}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </HqModulePageLayout>
  );
}
