'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  CalendarDays,
  Coins,
  ImagePlus,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Users,
  X,
  Ban,
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  CreatePortalEventPayload,
  PortalEventMediaItem,
  PortalEventRegistrationRow,
  PortalEventRow,
  PortalEventSection,
  UpdatePortalEventPayload,
} from '@/lib/portal-events-api';
import {
  EVENT_CTA_PRESETS,
  PORTAL_EVENT_MEDIA_MAX_BYTES,
  PORTAL_EVENT_MEDIA_MAX_COUNT,
} from '@/lib/portal-events-api';
import {
  Ph2ModulePageLayout,
  PH2_TABLE_BODY_SCROLL_CLASS,
  PH2_TABLE_CARD_CLASS,
} from '@/components/layout/Ph2ModulePageLayout';
import { requestConfirm } from '@/lib/appDialog';

type PortalEventsManagerProps = {
  title: string;
  subtitle: string;
  listEvents: () => Promise<PortalEventRow[]>;
  createEvent: (payload: CreatePortalEventPayload) => Promise<PortalEventRow>;
  listRegistrations: (eventId: string) => Promise<{
    event: PortalEventRow;
    registrations: PortalEventRegistrationRow[];
  }>;
  updateEvent?: (eventId: string, payload: UpdatePortalEventPayload) => Promise<PortalEventRow>;
  cancelEvent?: (eventId: string) => Promise<PortalEventRow>;
  deleteEvent?: (eventId: string) => Promise<void>;
  uploadMedia?: (files: File[]) => Promise<PortalEventMediaItem[]>;
  /** module = standard Phase 2 CRM shell; embedded = inside HQ or custom wrapper */
  variant?: 'module' | 'embedded';
};

function emptySection(index: number): PortalEventSection {
  return { id: `sec_${index}`, title: '', content: '' };
}

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function toDatetimeLocalValue(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function eventFormFromRow(event: PortalEventRow) {
  const sections =
    Array.isArray(event.sections) && event.sections.length > 0
      ? event.sections.map((section, index) => ({
          id: section.id || `sec_${index + 1}`,
          title: section.title || '',
          content: section.content || '',
        }))
      : [emptySection(1)];

  const accessType = event.accessType === 'purchase' || Number(event.tokenCost) > 0 ? 'purchase' : 'free';
  return {
    title: event.title || '',
    description: event.description || '',
    location: event.location || '',
    scheduledAt: toDatetimeLocalValue(event.scheduledAt),
    sections,
    media: Array.isArray(event.media) ? event.media : [],
    accessType,
    tokenCost: String(accessType === 'free' ? 0 : event.tokenCost || 0),
    ctaLabel: event.ctaLabel || 'Join',
  };
}

function isCancelled(event: PortalEventRow) {
  return String(event.status || 'active') === 'cancelled';
}

const EVENT_FIELD_CLASS =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 disabled:bg-slate-50 disabled:text-slate-400';
const EVENT_LABEL_CLASS = 'mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400';

export function PortalEventsManager({
  title,
  subtitle,
  listEvents,
  createEvent,
  listRegistrations,
  updateEvent,
  cancelEvent,
  deleteEvent,
  uploadMedia,
  variant = 'embedded',
}: PortalEventsManagerProps) {
  const [events, setEvents] = useState<PortalEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<PortalEventRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [registrations, setRegistrations] = useState<PortalEventRegistrationRow[]>([]);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    location: '',
    scheduledAt: '',
    sections: [emptySection(1)],
    media: [] as PortalEventMediaItem[],
    accessType: 'free' as 'free' | 'purchase',
    tokenCost: '0',
    ctaLabel: 'Join',
  });

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listEvents();
      setEvents(rows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [listEvents]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  function resetForm() {
    setForm({
      title: '',
      description: '',
      location: '',
      scheduledAt: '',
      sections: [emptySection(1)],
      media: [],
      accessType: 'free',
      tokenCost: '0',
      ctaLabel: 'Join',
    });
    setEditingEvent(null);
  }

  function openCreateModal() {
    resetForm();
    setFormOpen(true);
  }

  function openEditModal(event: PortalEventRow) {
    setEditingEvent(event);
    setForm(eventFormFromRow(event));
    setFormOpen(true);
  }

  function closeFormModal() {
    setFormOpen(false);
    resetForm();
  }

  async function handleSave() {
    if (!form.title.trim() || !form.description.trim() || !form.location.trim() || !form.scheduledAt) {
      toast.error('Title, description, location, and date are required.');
      return;
    }

    const accessType = form.accessType === 'purchase' ? 'purchase' : 'free';
    const tokenCost = accessType === 'free' ? 0 : Math.max(0, Math.floor(Number(form.tokenCost) || 0));
    if (accessType === 'purchase' && tokenCost <= 0) {
      toast.error('Enter how many tokens candidates need to join this event.');
      return;
    }

    const payload: CreatePortalEventPayload = {
      title: form.title.trim(),
      description: form.description.trim(),
      location: form.location.trim(),
      scheduledAt: new Date(form.scheduledAt).toISOString(),
      sections: form.sections.filter((s) => s.title.trim() || s.content.trim()),
      media: form.media,
      isPublished: true,
      accessType,
      tokenCost,
      ctaLabel: form.ctaLabel.trim() || 'Join',
    };

    setSaving(true);
    try {
      if (editingEvent && updateEvent) {
        await updateEvent(editingEvent.id, payload);
        toast.success('Event updated on the job portal.');
      } else {
        await createEvent(payload);
        toast.success('Event created and published to the job portal.');
      }
      closeFormModal();
      await loadEvents();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : editingEvent ? 'Failed to update event' : 'Failed to create event');
    } finally {
      setSaving(false);
    }
  }

  async function handleMediaSelect(fileList: FileList | null) {
    if (!uploadMedia || !fileList?.length) return;

    const existingCount = form.media.length;
    const incoming = Array.from(fileList);
    if (existingCount + incoming.length > PORTAL_EVENT_MEDIA_MAX_COUNT) {
      toast.error(`You can attach up to ${PORTAL_EVENT_MEDIA_MAX_COUNT} images or videos.`);
      return;
    }

    const validFiles: File[] = [];
    for (const file of incoming) {
      if (file.size > PORTAL_EVENT_MEDIA_MAX_BYTES) {
        toast.error(`"${file.name}" exceeds the 5 MB limit.`);
        continue;
      }
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      if (!isImage && !isVideo) {
        toast.error(`"${file.name}" is not a supported image or video.`);
        continue;
      }
      validFiles.push(file);
    }

    if (!validFiles.length) return;

    setMediaUploading(true);
    try {
      const uploaded = await uploadMedia(validFiles);
      setForm((prev) => ({
        ...prev,
        media: [...prev.media, ...uploaded].slice(0, PORTAL_EVENT_MEDIA_MAX_COUNT),
      }));
      toast.success(`${uploaded.length} file(s) uploaded.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload media');
    } finally {
      setMediaUploading(false);
    }
  }

  function removeMediaItem(mediaId: string) {
    setForm((prev) => ({
      ...prev,
      media: prev.media.filter((item) => item.id !== mediaId),
    }));
  }

  async function handleCancelEvent(event: PortalEventRow) {
    if (!cancelEvent) return;
    const applicantNote =
      event.registrationCount > 0
        ? ` ${event.registrationCount} registered candidate(s) will be notified.`
        : '';
    if (
      !(await requestConfirm(
        `Cancel "${event.title}"? It will be removed from the public portal.${applicantNote}`,
      ))
    ) {
      return;
    }

    setActionLoadingId(event.id);
    try {
      await cancelEvent(event.id);
      toast.success(
        event.registrationCount > 0
          ? 'Event cancelled and applicants notified.'
          : 'Event cancelled.',
      );
      await loadEvents();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel event');
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleDeleteEvent(event: PortalEventRow) {
    if (!deleteEvent) return;
    const applicantNote =
      event.registrationCount > 0
        ? ` ${event.registrationCount} registered candidate(s) will be notified before removal.`
        : '';
    if (
      !(await requestConfirm(
        `Delete "${event.title}" permanently? This cannot be undone.${applicantNote}`,
      ))
    ) {
      return;
    }

    setActionLoadingId(event.id);
    try {
      await deleteEvent(event.id);
      toast.success(
        event.registrationCount > 0
          ? 'Event deleted and applicants notified.'
          : 'Event deleted.',
      );
      await loadEvents();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete event');
    } finally {
      setActionLoadingId(null);
    }
  }

  async function openRegistrations(eventId: string) {
    setSelectedEventId(eventId);
    setRegistrationsLoading(true);
    try {
      const result = await listRegistrations(eventId);
      setRegistrations(result.registrations);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load applicants');
      setSelectedEventId(null);
    } finally {
      setRegistrationsLoading(false);
    }
  }

  const eventsTable = (
    <div className={`${variant === 'module' ? PH2_TABLE_CARD_CLASS : 'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm'} min-h-0 flex-1`}>
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
        </div>
      ) : events.length === 0 ? (
        <div className="px-6 py-16 text-center text-sm text-slate-500">
          No events yet. Create one to publish it on the candidate portal.
        </div>
      ) : (
        <div className={variant === 'module' ? PH2_TABLE_BODY_SCROLL_CLASS : 'overflow-x-auto'}>
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-indigo-100/40 bg-gradient-to-br from-white via-indigo-50/25 to-violet-50/20 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Event</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Access</th>
                <th className="px-4 py-3 font-semibold">Location</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Applicants</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => {
                const cancelled = isCancelled(event);
                const rowBusy = actionLoadingId === event.id;
                return (
                  <tr key={event.id} className="border-b border-slate-100 last:border-0 hover:bg-indigo-50/20">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-900">{event.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">{event.description}</p>
                    </td>
                    <td className="px-4 py-4">
                      {cancelled ? (
                        <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                          Cancelled
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {event.accessType === 'purchase' || Number(event.tokenCost) > 0 ? (
                        <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                          {Number(event.tokenCost) || 0} tokens
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          Free
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-slate-600">{event.location || '—'}</td>
                    <td className="px-4 py-4 text-slate-600">{formatDate(event.scheduledAt)}</td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                        <Users className="h-3.5 w-3.5" />
                        {event.registrationCount}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => void openRegistrations(event.id)}
                          className="rounded-lg border border-indigo-200/70 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-800 hover:bg-indigo-50/80"
                        >
                          Applicants
                        </button>
                        {!cancelled && updateEvent ? (
                          <button
                            type="button"
                            disabled={rowBusy}
                            onClick={() => openEditModal(event)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                        ) : null}
                        {!cancelled && cancelEvent ? (
                          <button
                            type="button"
                            disabled={rowBusy}
                            onClick={() => void handleCancelEvent(event)}
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                          >
                            {rowBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                            Cancel
                          </button>
                        ) : null}
                        {deleteEvent ? (
                          <button
                            type="button"
                            disabled={rowBusy}
                            onClick={() => void handleDeleteEvent(event)}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                          >
                            {rowBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const modals = (
    <>
      {formOpen ? (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/45 backdrop-blur-[1px]"
            aria-label="Close"
            onClick={closeFormModal}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="portal-event-modal-title"
            className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 id="portal-event-modal-title" className="text-base font-bold text-slate-900">
                  {editingEvent ? 'Edit event' : 'Create event'}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Published to the candidate portal. Choose free access or a token price.
                </p>
              </div>
              <button
                type="button"
                onClick={closeFormModal}
                disabled={saving}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div>
                <label className={EVENT_LABEL_CLASS}>
                  Title <span className="text-rose-500">*</span>
                </label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  className={EVENT_FIELD_CLASS}
                  placeholder="e.g. Career workshop · React hiring day"
                />
              </div>

              <div>
                <label className={EVENT_LABEL_CLASS}>
                  Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className={`${EVENT_FIELD_CLASS} resize-none`}
                  placeholder="What should candidates know about this event?"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={EVENT_LABEL_CLASS}>
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      Location <span className="text-rose-500">*</span>
                    </span>
                  </label>
                  <input
                    value={form.location}
                    onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                    className={EVENT_FIELD_CLASS}
                    placeholder="City, venue, or online link"
                  />
                </div>
                <div>
                  <label className={EVENT_LABEL_CLASS}>
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Date & time <span className="text-rose-500">*</span>
                    </span>
                  </label>
                  <input
                    type="datetime-local"
                    value={form.scheduledAt}
                    onChange={(e) => setForm((prev) => ({ ...prev, scheduledAt: e.target.value }))}
                    className={EVENT_FIELD_CLASS}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                <label className={EVENT_LABEL_CLASS}>Access</label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, accessType: 'free', tokenCost: '0' }))}
                    className={`rounded-xl border px-4 py-3 text-left transition ${
                      form.accessType === 'free'
                        ? 'border-emerald-300 bg-white ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900">Free</p>
                    <p className="mt-0.5 text-xs text-slate-500">Anyone can join</p>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        accessType: 'purchase',
                        tokenCost: prev.tokenCost === '0' ? '' : prev.tokenCost,
                      }))
                    }
                    className={`rounded-xl border px-4 py-3 text-left transition ${
                      form.accessType === 'purchase'
                        ? 'border-amber-300 bg-white ring-2 ring-amber-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900">Purchase</p>
                    <p className="mt-0.5 text-xs text-slate-500">Tokens required to join</p>
                  </button>
                </div>
                {form.accessType === 'purchase' ? (
                  <div className="mt-3">
                    <label className={EVENT_LABEL_CLASS}>
                      <span className="inline-flex items-center gap-1.5">
                        <Coins className="h-3.5 w-3.5" />
                        Token cost <span className="text-rose-500">*</span>
                      </span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={form.tokenCost}
                      onChange={(e) => setForm((prev) => ({ ...prev, tokenCost: e.target.value }))}
                      className={EVENT_FIELD_CLASS}
                      placeholder="e.g. 25"
                    />
                    <p className="mt-1.5 text-[11px] text-slate-500">
                      Deducted from the candidate wallet and credited to your account.
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-[11px] text-slate-500">
                    Candidates can register without spending tokens.
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                <label className={EVENT_LABEL_CLASS}>Button CTA</label>
                <p className="mb-2 text-[11px] text-slate-500">
                  Phase 1 candidates see this text on the event button. Pick a preset or type your own.
                </p>
                <div className="mb-2 flex flex-wrap gap-2">
                  {EVENT_CTA_PRESETS.map((preset) => {
                    const active = form.ctaLabel.trim().toLowerCase() === preset.toLowerCase();
                    return (
                      <button
                        type="button"
                        key={preset}
                        onClick={() => setForm((prev) => ({ ...prev, ctaLabel: preset }))}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                          active
                            ? 'border-indigo-300 bg-indigo-50 text-indigo-800 ring-2 ring-indigo-500/20'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {preset}
                      </button>
                    );
                  })}
                </div>
                <input
                  value={form.ctaLabel}
                  onChange={(e) => setForm((prev) => ({ ...prev, ctaLabel: e.target.value }))}
                  className={EVENT_FIELD_CLASS}
                  placeholder="e.g. Learn, Apply, Join…"
                  maxLength={32}
                />
                <p className="mt-2 text-[11px] text-slate-500">
                  Preview:{' '}
                  <span className="ml-1 inline-flex rounded-full bg-indigo-600 px-3 py-1 text-[11px] font-semibold text-white">
                    {form.ctaLabel.trim() || 'Join'}
                    {form.accessType === 'purchase' && Number(form.tokenCost) > 0
                      ? ` · ${form.tokenCost} tokens`
                      : ''}
                  </span>
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <ImagePlus className="h-3.5 w-3.5" />
                    Photos & videos
                  </label>
                  <span className="text-[11px] font-medium text-slate-400">Max 5 MB each</span>
                </div>
                {uploadMedia ? (
                  <div className="space-y-3">
                    <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-indigo-200 bg-white px-4 py-6 text-center transition hover:border-indigo-300 hover:bg-indigo-50/40">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                        multiple
                        className="hidden"
                        disabled={mediaUploading || form.media.length >= PORTAL_EVENT_MEDIA_MAX_COUNT}
                        onChange={(e) => {
                          void handleMediaSelect(e.target.files);
                          e.target.value = '';
                        }}
                      />
                      {mediaUploading ? (
                        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                      ) : (
                        <ImagePlus className="h-6 w-6 text-indigo-500" />
                      )}
                      <p className="mt-2 text-sm font-semibold text-slate-700">Upload images or videos</p>
                      <p className="mt-1 text-xs text-slate-500">
                        JPG, PNG, WEBP, GIF, MP4, WEBM, MOV · up to {PORTAL_EVENT_MEDIA_MAX_COUNT} files
                      </p>
                    </label>

                    {form.media.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {form.media.map((item) => (
                          <div
                            key={item.id}
                            className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white"
                          >
                            {item.type === 'video' ? (
                              <video
                                src={item.url}
                                className="h-28 w-full object-cover"
                                muted
                                playsInline
                                preload="metadata"
                              />
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.url}
                                alt={item.name || 'Event media'}
                                className="h-28 w-full object-cover"
                              />
                            )}
                            <button
                              type="button"
                              onClick={() => removeMediaItem(item.id)}
                              className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-rose-600 shadow-sm opacity-0 transition group-hover:opacity-100"
                              title="Remove"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                              <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-white">
                                {item.type}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                    Media upload is unavailable in this view.
                  </p>
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Sections
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        sections: [...prev.sections, emptySection(prev.sections.length + 1)],
                      }))
                    }
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add section
                  </button>
                </div>
                <div className="space-y-3">
                  {form.sections.map((section, index) => (
                    <div key={section.id} className="rounded-xl border border-slate-200 bg-white p-3.5">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Section {index + 1}
                        </p>
                        {form.sections.length > 1 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setForm((prev) => ({
                                ...prev,
                                sections: prev.sections.filter((_, i) => i !== index),
                              }))
                            }
                            className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            title="Remove section"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                      <input
                        value={section.title}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            sections: prev.sections.map((s, i) =>
                              i === index ? { ...s, title: e.target.value } : s,
                            ),
                          }))
                        }
                        className={`${EVENT_FIELD_CLASS} mb-2`}
                        placeholder="Section title"
                      />
                      <textarea
                        value={section.content}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            sections: prev.sections.map((s, i) =>
                              i === index ? { ...s, content: e.target.value } : s,
                            ),
                          }))
                        }
                        rows={3}
                        className={`${EVENT_FIELD_CLASS} resize-none`}
                        placeholder="Section content"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={closeFormModal}
                disabled={saving}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:from-blue-700 hover:via-indigo-700 hover:to-violet-700 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {saving
                  ? editingEvent
                    ? 'Saving…'
                    : 'Creating…'
                  : editingEvent
                    ? 'Save changes'
                    : 'Create & publish'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedEventId ? (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/45 backdrop-blur-[1px]"
            aria-label="Close"
            onClick={() => {
              setSelectedEventId(null);
              setRegistrations([]);
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Event applicants</h2>
                <p className="mt-0.5 text-xs text-slate-500">Only visible to the organizer of this event</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedEventId(null);
                  setRegistrations([]);
                }}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {registrationsLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
              </div>
            ) : registrations.length === 0 ? (
              <div className="px-6 py-16 text-center text-sm text-slate-500">No applicants yet.</div>
            ) : (
              <div className="min-h-0 flex-1 overflow-auto px-2 py-2">
                <table className="min-w-full text-left text-sm">
                  <thead className="sticky top-0 bg-white text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Name</th>
                      <th className="px-4 py-2">Email</th>
                      <th className="px-4 py-2">Phone</th>
                      <th className="px-4 py-2">City</th>
                      <th className="px-4 py-2">Registered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrations.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                        <td className="px-4 py-3 text-slate-600">{row.email}</td>
                        <td className="px-4 py-3 text-slate-600">{row.phone}</td>
                        <td className="px-4 py-3 text-slate-600">{row.city}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(row.registeredAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );

  if (variant === 'module') {
    return (
      <Ph2ModulePageLayout
        title={title}
        icon={<CalendarDays className="h-5 w-5" strokeWidth={2.2} />}
        actions={
          <>
            <button
              type="button"
              onClick={() => void loadEvents()}
              disabled={loading}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-indigo-200/80 bg-white text-indigo-700 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.2)] transition-all hover:border-indigo-300 hover:bg-indigo-50/90 active:scale-[0.98] disabled:opacity-50"
              title="Refresh"
            >
              <Loader2 size={16} strokeWidth={2.25} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:from-blue-700 hover:via-indigo-700 hover:to-violet-700 active:scale-[0.98]"
            >
              <Plus size={16} strokeWidth={2.5} />
              Create event
            </button>
          </>
        }
        belowScroll={modals}
      >
        <p className="mb-4 shrink-0 text-sm text-slate-600">{subtitle}</p>
        <div className="flex min-h-0 flex-1 flex-col">{eventsTable}</div>
      </Ph2ModulePageLayout>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:from-blue-700 hover:via-indigo-700 hover:to-violet-700"
        >
          <Plus className="h-4 w-4" />
          Create event
        </button>
      </div>
      {eventsTable}
      {modals}
    </div>
  );
}
