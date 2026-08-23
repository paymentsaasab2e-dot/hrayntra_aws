'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ImagePlus, Plus, Trash2, Upload } from 'lucide-react';
import {
  apiHqPreviewCourseCertificate,
  apiHqUploadCourseCertificateBackground,
  type HqCertificateSlot,
  type HqCourseCertificate,
  type HqCourseCheckpoint,
  type HqCourseLessonSummary,
} from '@/lib/api';
import { requestError, requestWarning } from '@/lib/appDialog';

const PRESETS = [
  { id: 'classic-gold', label: 'Classic gold' },
  { id: 'modern-minimal', label: 'Modern minimal' },
  { id: 'technical-badge', label: 'Technical badge' },
] as const;

const FONT_FAMILIES: Record<string, string> = {
  serif: 'Georgia, "Times New Roman", serif',
  sans: 'Inter, system-ui, sans-serif',
  display: '"Palatino Linotype", Palatino, "Book Antiqua", serif',
  modern: 'Arial, Helvetica, sans-serif',
};

const FONT_OPTIONS = [
  { id: 'serif', label: 'Serif (classic)' },
  { id: 'sans', label: 'Sans (modern)' },
  { id: 'display', label: 'Display (elegant)' },
  { id: 'modern', label: 'Arial (clean)' },
] as const;

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64];
const COLOR_SWATCHES = ['#0f172a', '#ffffff', '#b45309', '#1d4ed8', '#be123c', '#047857', '#334155', '#fbbf24'];
const NUDGE = 1.5;
const PAGE_CSS_WIDTH = 1123;

const SLOT_META: { key: string; label: string; hint: string }[] = [
  { key: 'learnerName', label: 'Learner name', hint: 'Student’s name printed on the certificate' },
  { key: 'courseTitle', label: 'Course title', hint: 'Name of this course' },
  { key: 'instructorName', label: 'Signed by', hint: 'Instructor / HQ sign-off line' },
  { key: 'completedAt', label: 'Completion date', hint: 'Date the learner finished' },
  { key: 'certificateId', label: 'Certificate ID', hint: 'Unique ID, usually bottom-right' },
];

const DEFAULT_SLOTS: Record<string, HqCertificateSlot> = {
  learnerName: { x: 50, y: 46, fontSize: 42, color: '#0f172a', align: 'center', fontFamily: 'serif' },
  courseTitle: { x: 50, y: 58, fontSize: 20, color: '#334155', align: 'center', fontFamily: 'serif' },
  instructorName: { x: 50, y: 68, fontSize: 14, color: '#475569', align: 'center', fontFamily: 'sans' },
  completedAt: { x: 28, y: 82, fontSize: 13, color: '#475569', align: 'left', fontFamily: 'sans' },
  certificateId: { x: 72, y: 82, fontSize: 12, color: '#64748b', align: 'right', fontFamily: 'sans' },
};

function slotCss(slot: HqCertificateSlot, scale = 1): React.CSSProperties {
  const transform =
    slot.align === 'center'
      ? 'translate(-50%, -50%)'
      : slot.align === 'right'
        ? 'translate(-100%, -50%)'
        : 'translate(0, -50%)';
  return {
    position: 'absolute',
    left: `${slot.x}%`,
    top: `${slot.y}%`,
    transform,
    textAlign: slot.align === 'left' || slot.align === 'right' ? slot.align : 'center',
    fontSize: `${Math.max(8, slot.fontSize * scale)}px`,
    color: slot.color,
    fontFamily: FONT_FAMILIES[slot.fontFamily || 'serif'] || FONT_FAMILIES.serif,
    width: '70%',
    lineHeight: 1.2,
    fontWeight: 700,
    margin: 0,
    pointerEvents: 'auto',
    cursor: 'pointer',
  };
}

function emptyCertificate(): HqCourseCertificate {
  return {
    mode: 'preset',
    presetId: 'classic-gold',
    backgroundUrl: null,
    slots: { ...DEFAULT_SLOTS },
  };
}

function newCheckpoint(order: number): HqCourseCheckpoint {
  return {
    id: `cp-${Date.now().toString(36)}`,
    type: 'quiz',
    title: '',
    order,
    required: true,
    afterLessonId: '',
    quizId: '',
    passPercent: 70,
  };
}

type Props = {
  courseTitle: string;
  instructorName: string;
  isCertified: boolean;
  certificate: HqCourseCertificate;
  checkpoints: HqCourseCheckpoint[];
  lessons: HqCourseLessonSummary[];
  disabled?: boolean;
  onCertificateChange: (next: HqCourseCertificate) => void;
  onCheckpointsChange: (next: HqCourseCheckpoint[]) => void;
};

export function defaultHqCourseCertificate(): HqCourseCertificate {
  return emptyCertificate();
}

export function HqCourseCertificateAndJourney({
  courseTitle,
  instructorName,
  isCertified,
  certificate,
  checkpoints,
  lessons,
  disabled,
  onCertificateChange,
  onCheckpointsChange,
}: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const previewBoxRef = useRef<HTMLDivElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [activeSlot, setActiveSlot] = useState('learnerName');
  const [previewWidth, setPreviewWidth] = useState(0);
  const cert = {
    ...emptyCertificate(),
    ...certificate,
    slots: { ...DEFAULT_SLOTS, ...(certificate?.slots || {}) },
  };

  const setCert = (patch: Partial<HqCourseCertificate>) => {
    onCertificateChange({ ...cert, ...patch });
  };

  const updateSlot = (key: string, patch: Partial<HqCertificateSlot>) => {
    setCert({
      slots: {
        ...cert.slots,
        [key]: { ...DEFAULT_SLOTS[key], ...(cert.slots?.[key] || {}), ...patch },
      },
    });
  };

  const nudgeSlot = (key: string, dx: number, dy: number) => {
    const slot = { ...DEFAULT_SLOTS[key], ...(cert.slots?.[key] || {}) };
    updateSlot(key, {
      x: Math.min(100, Math.max(0, Number(slot.x) + dx)),
      y: Math.min(100, Math.max(0, Number(slot.y) + dy)),
    });
  };

  useEffect(() => {
    const el = previewBoxRef.current;
    if (!el) return;
    const sync = () => setPreviewWidth(el.clientWidth);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, [cert.mode, cert.backgroundUrl]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (cert.mode !== 'uploaded' || disabled) return;
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        nudgeSlot(activeSlot, -NUDGE, 0);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        nudgeSlot(activeSlot, NUDGE, 0);
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        nudgeSlot(activeSlot, 0, -NUDGE);
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        nudgeSlot(activeSlot, 0, NUDGE);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const handleUpload = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      void requestWarning('Please choose a JPG or PNG certificate layout.');
      return;
    }
    setUploading(true);
    try {
      const result = await apiHqUploadCourseCertificateBackground(file);
      const url = result.data?.background?.url;
      if (!url) throw new Error('Upload succeeded but no URL was returned');
      setCert({ mode: 'uploaded', backgroundUrl: url });
    } catch (error: any) {
      void requestError(error?.message || 'Failed to upload certificate layout');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const result = await apiHqPreviewCourseCertificate({
        learnerName: 'Alex Rivera',
        courseTitle: courseTitle || 'Sample certified course',
        instructorName: instructorName || 'HRYantra HQ',
        certificate: cert,
      });
      setPreviewHtml(result.data?.html || '');
    } catch (error: any) {
      void requestError(error?.message || 'Failed to preview certificate');
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <div className="space-y-5 rounded-2xl border border-violet-100 bg-violet-50/40 p-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-violet-700">Certificate</p>
        <p className="mt-1 text-xs text-slate-500">
          After a learner finishes the journey, their name is printed on this layout. Choose a preset now, or
          upload your own design and place the name / title slots.
        </p>
        {!isCertified ? (
          <p className="mt-2 text-xs font-medium text-amber-700">
            Tick Certified above to issue certificates on completion.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            disabled={disabled}
            onClick={() => setCert({ mode: 'preset', presetId: preset.id })}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${
              cert.mode !== 'uploaded' && cert.presetId === preset.id
                ? 'bg-violet-700 text-white ring-violet-700'
                : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setCert({ mode: 'uploaded' })}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${
            cert.mode === 'uploaded'
              ? 'bg-violet-700 text-white ring-violet-700'
              : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
          }`}
        >
          Uploaded layout
        </button>
      </div>

      {cert.mode === 'uploaded' ? (
        <div className="space-y-4">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => void handleUpload(e.target.files?.[0])}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={disabled || uploading}
              onClick={() => fileRef.current?.click()}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-violet-200 bg-white px-3 text-xs font-semibold text-violet-800 hover:bg-violet-50 disabled:opacity-50"
            >
              {cert.backgroundUrl ? <ImagePlus className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
              {uploading ? 'Uploading…' : cert.backgroundUrl ? 'Replace layout image' : 'Upload layout image'}
            </button>
          </div>
          {!cert.backgroundUrl ? (
            <p className="text-xs text-slate-500">Upload a landscape PNG/JPG. Then pick a tag below and move it with the arrows. Preview updates instantly.</p>
          ) : null}

          <div className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Text tags on this layout</p>
            {SLOT_META.map((meta) => {
              const selected = activeSlot === meta.key;
              return (
                <button
                  key={meta.key}
                  type="button"
                  disabled={disabled}
                  onClick={() => setActiveSlot(meta.key)}
                  className={`block w-full rounded-2xl border px-3 py-3 text-left transition ${
                    selected
                      ? 'border-violet-400 bg-white shadow-sm ring-2 ring-violet-200'
                      : 'border-slate-200 bg-white/80 hover:border-violet-200'
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-900">{meta.label}</p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500">{meta.hint}</p>
                  {selected ? (
                    <p className="mt-2 text-[11px] font-medium text-violet-700">You are moving this tag</p>
                  ) : (
                    <p className="mt-2 text-[11px] text-slate-400">Click to adjust this tag</p>
                  )}
                </button>
              );
            })}
          </div>

          {(() => {
            const slot = { ...DEFAULT_SLOTS[activeSlot], ...(cert.slots?.[activeSlot] || {}) };
            const meta = SLOT_META.find((row) => row.key === activeSlot);
            return (
              <div className="rounded-2xl border border-violet-200 bg-white p-3">
                <p className="text-sm font-semibold text-slate-900">Position · {meta?.label}</p>
                <p className="mt-1 text-xs text-slate-500">Use arrows. Each tap moves the selected tag on the live preview below.</p>
                <div className="mt-3 flex flex-wrap items-start gap-6">
                  <div className="grid grid-cols-3 gap-1">
                    <span />
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => nudgeSlot(activeSlot, 0, -NUDGE)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-violet-50 hover:text-violet-800 disabled:opacity-50"
                      aria-label="Move up"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <span />
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => nudgeSlot(activeSlot, -NUDGE, 0)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-violet-50 hover:text-violet-800 disabled:opacity-50"
                      aria-label="Move left"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <span className="flex h-10 w-10 items-center justify-center text-[10px] font-semibold uppercase text-slate-400">Move</span>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => nudgeSlot(activeSlot, NUDGE, 0)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-violet-50 hover:text-violet-800 disabled:opacity-50"
                      aria-label="Move right"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <span />
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => nudgeSlot(activeSlot, 0, NUDGE)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-violet-50 hover:text-violet-800 disabled:opacity-50"
                      aria-label="Move down"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="min-w-[220px] flex-1 space-y-3">
                    <label className="block text-xs font-semibold text-slate-600">
                      Font
                      <select
                        value={slot.fontFamily || 'serif'}
                        disabled={disabled}
                        onChange={(e) => updateSlot(activeSlot, { fontFamily: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-2.5 py-2 text-sm text-slate-800"
                      >
                        {FONT_OPTIONS.map((font) => (
                          <option key={font.id} value={font.id}>
                            {font.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="flex flex-wrap items-end gap-3">
                      <label className="block text-xs font-semibold text-slate-600">
                        Size
                        <select
                          value={slot.fontSize}
                          disabled={disabled}
                          onChange={(e) => updateSlot(activeSlot, { fontSize: Number(e.target.value) })}
                          className="mt-1 w-28 rounded-xl border border-slate-200 px-2.5 py-2 text-sm text-slate-800"
                        >
                          {Array.from(new Set([...FONT_SIZES, Number(slot.fontSize)])).sort((a, b) => a - b).map((size) => (
                            <option key={size} value={size}>
                              {size} px
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="flex gap-1 pb-0.5">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => updateSlot(activeSlot, { fontSize: Math.max(8, Number(slot.fontSize) - 2) })}
                          className="h-9 rounded-lg border border-slate-200 px-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          A−
                        </button>
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => updateSlot(activeSlot, { fontSize: Math.min(96, Number(slot.fontSize) + 2) })}
                          className="h-9 rounded-lg border border-slate-200 px-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          A+
                        </button>
                      </div>
                      <label className="block text-xs font-semibold text-slate-600">
                        Color
                        <input
                          type="color"
                          value={/^#[0-9a-fA-F]{6}$/.test(slot.color) ? slot.color : '#0f172a'}
                          disabled={disabled}
                          onChange={(e) => updateSlot(activeSlot, { color: e.target.value })}
                          className="mt-1 h-9 w-14 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                        />
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {COLOR_SWATCHES.map((color) => (
                        <button
                          key={color}
                          type="button"
                          disabled={disabled}
                          onClick={() => updateSlot(activeSlot, { color })}
                          className={`h-6 w-6 rounded-full border ${slot.color === color ? 'ring-2 ring-violet-500 ring-offset-1' : 'border-slate-200'}`}
                          style={{ background: color }}
                          aria-label={`Color ${color}`}
                        />
                      ))}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-600">Align</p>
                      <div className="mt-1 flex gap-1">
                        {(['left', 'center', 'right'] as const).map((align) => (
                          <button
                            key={align}
                            type="button"
                            disabled={disabled}
                            onClick={() => updateSlot(activeSlot, { align })}
                            className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize ${
                              slot.align === align ? 'bg-violet-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {align}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Live preview</p>
            <p className="mt-1 text-xs text-slate-500">
              This is what the learner PDF will look like. Click a line on the preview to select that tag.
            </p>
            <div
              ref={previewBoxRef}
              className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
              style={{ aspectRatio: '297 / 210' }}
            >
              {cert.backgroundUrl ? (
                <div className="relative h-full w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cert.backgroundUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  {SLOT_META.map((meta) => {
                    const slot = { ...DEFAULT_SLOTS[meta.key], ...(cert.slots?.[meta.key] || {}) };
                    const sample =
                      meta.key === 'learnerName'
                        ? 'Alex Rivera'
                        : meta.key === 'courseTitle'
                          ? courseTitle || 'Sample certified course'
                          : meta.key === 'instructorName'
                            ? `Signed, ${instructorName || 'HRYantra HQ'}`
                            : meta.key === 'completedAt'
                              ? new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
                              : 'HYC-DRAFT';
                    const selected = activeSlot === meta.key;
                    return (
                      <p
                        key={meta.key}
                        role="button"
                        onClick={() => setActiveSlot(meta.key)}
                        style={{
                          ...slotCss(slot, previewWidth ? previewWidth / PAGE_CSS_WIDTH : 0.5),
                          outline: selected ? '2px dashed #7c3aed' : 'none',
                          outlineOffset: 4,
                          background: selected ? 'rgba(139, 92, 246, 0.08)' : 'transparent',
                        }}
                      >
                        {sample}
                      </p>
                    );
                  })}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center px-6 text-center text-xs text-slate-500">
                  Upload a layout image to see the live certificate preview here.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || previewing}
          onClick={() => void handlePreview()}
          className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {previewing ? 'Previewing…' : 'Preview with sample name'}
        </button>
      </div>
      {previewHtml ? (
        <iframe title="Certificate preview" className="h-64 w-full rounded-xl border border-slate-200 bg-white" srcDoc={previewHtml} />
      ) : null}

      <div className="border-t border-violet-100 pt-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-violet-700">Journey checkpoints</p>
            <p className="mt-1 text-xs text-slate-500">
              Lessons already unlock in order. Add gates after a lesson (quiz score, assignment upload, or HQ sign-off).
              Leave empty to complete by finishing every lesson.
            </p>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onCheckpointsChange([...checkpoints, newCheckpoint(checkpoints.length + 1)])}
            className="inline-flex h-8 items-center gap-1 rounded-xl bg-violet-700 px-2.5 text-[11px] font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>

        <div className="mt-3 space-y-2">
          {checkpoints.length === 0 ? (
            <p className="rounded-xl border border-dashed border-violet-200 bg-white px-3 py-2 text-xs text-slate-500">
              No extra checkpoints. Completing all lessons issues the certificate (if Certified is on).
            </p>
          ) : (
            checkpoints.map((row, index) => (
              <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    value={row.title}
                    onChange={(e) => {
                      const next = [...checkpoints];
                      next[index] = { ...row, title: e.target.value };
                      onCheckpointsChange(next);
                    }}
                    placeholder="Checkpoint title"
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
                  />
                  <select
                    value={row.type}
                    onChange={(e) => {
                      const next = [...checkpoints];
                      next[index] = { ...row, type: e.target.value };
                      onCheckpointsChange(next);
                    }}
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
                  >
                    <option value="quiz">Quiz pass</option>
                    <option value="assignment">Assignment upload</option>
                    <option value="manual">HQ sign-off</option>
                  </select>
                  <select
                    value={row.afterLessonId || ''}
                    onChange={(e) => {
                      const next = [...checkpoints];
                      next[index] = { ...row, afterLessonId: e.target.value };
                      onCheckpointsChange(next);
                    }}
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
                  >
                    <option value="">After any / last lesson</option>
                    {lessons.map((lesson) => (
                      <option key={lesson.id} value={lesson.id}>
                        After: {lesson.title}
                      </option>
                    ))}
                  </select>
                  {row.type === 'quiz' ? (
                    <div className="flex gap-2">
                      <input
                        value={row.quizId || ''}
                        onChange={(e) => {
                          const next = [...checkpoints];
                          next[index] = { ...row, quizId: e.target.value };
                          onCheckpointsChange(next);
                        }}
                        placeholder="LMS quiz id"
                        className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
                      />
                      <input
                        type="number"
                        value={row.passPercent ?? 70}
                        onChange={(e) => {
                          const next = [...checkpoints];
                          next[index] = { ...row, passPercent: Number(e.target.value) };
                          onCheckpointsChange(next);
                        }}
                        className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                        title="Pass %"
                      />
                    </div>
                  ) : null}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
                    <input
                      type="checkbox"
                      checked={row.required !== false}
                      onChange={(e) => {
                        const next = [...checkpoints];
                        next[index] = { ...row, required: e.target.checked };
                        onCheckpointsChange(next);
                      }}
                    />
                    Required for certificate
                  </label>
                  <button
                    type="button"
                    onClick={() => onCheckpointsChange(checkpoints.filter((item) => item.id !== row.id))}
                    className="rounded-lg p-1 text-rose-500 hover:bg-rose-50"
                    aria-label="Remove checkpoint"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
