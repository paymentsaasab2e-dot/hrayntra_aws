'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CalendarDays, ImagePlus, Loader2, Pencil, Plus, Trash2, Users, X, Ban } from 'lucide-react';
import { toast } from 'sonner';
import type {
  CreatePortalEventPayload,
  PortalEventMediaItem,
  PortalEventRegistrationRow,
  PortalEventRow,
  PortalEventSection,
  UpdatePortalEventPayload,
} from '@/lib/portal-events-api';
import { PORTAL_EVENT_MEDIA_MAX_BYTES, PORTAL_EVENT_MEDIA_MAX_COUNT } from '@/lib/portal-events-api';
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

  return {
    title: event.title || '',
    description: event.description || '',
    location: event.location || '',
    scheduledAt: toDatetimeLocalValue(event.scheduledAt),
    sections,
    media: Array.isArray(event.media) ? event.media : [],
  };
}

function isCancelled(event: PortalEventRow) {
  return String(event.status || 'active') === 'cancelled';
}

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

    const payload: CreatePortalEventPayload = {
      title: form.title.trim(),
      description: form.description.trim(),
      location: form.location.trim(),
      scheduledAt: new Date(form.scheduledAt).toISOString(),
      sections: form.sections.filter((s) => s.title.trim() || s.content.trim()),
      media: form.media,
      isPublished: true,
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">
                {editingEvent ? 'Edit event' : 'Create event'}
              </h2>
              <button type="button" onClick={closeFormModal} className="rounded-lg p-2 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Title</span>
                <input
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  placeholder="Event title"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Description</span>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  placeholder="What is this event about?"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Location</span>
                <input
                  value={form.location}
                  onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  placeholder="City, venue, or online link"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Date & time</span>
                <input
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(e) => setForm((prev) => ({ ...prev, scheduledAt: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </label>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Photos & videos
                  </span>
                  <span className="text-[11px] font-medium text-slate-400">Max 5 MB each</span>
                </div>
                {uploadMedia ? (
                  <div className="space-y-3">
                    <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-indigo-200 bg-indigo-50/30 px-4 py-6 text-center transition hover:border-indigo-300 hover:bg-indigo-50/50">
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
                      <p className="mt-2 text-sm font-semibold text-slate-700">
                        Upload images or videos
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        JPG, PNG, WEBP, GIF, MP4, WEBM, MOV · up to {PORTAL_EVENT_MEDIA_MAX_COUNT} files
                      </p>
                    </label>

                    {form.media.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {form.media.map((item) => (
                          <div
                            key={item.id}
                            className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
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
                              <img src={item.url} alt={item.name || 'Event media'} className="h-28 w-full object-cover" />
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
                  <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    Media upload is unavailable in this view.
                  </p>
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Sections</span>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        sections: [...prev.sections, emptySection(prev.sections.length + 1)],
                      }))
                    }
                    className="text-xs font-semibold text-indigo-600"
                  >
                    + Add section
                  </button>
                </div>
                <div className="space-y-3">
                  {form.sections.map((section, index) => (
                    <div key={section.id} className="rounded-xl border border-slate-200 p-3">
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
                        className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
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
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        placeholder="Section content"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                onClick={closeFormModal}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Close
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
                className="rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white hover:from-blue-700 hover:via-indigo-700 hover:to-violet-700 disabled:opacity-60"
              >
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Event applicants</h2>
                <p className="text-xs text-slate-500">Only visible to the user who created this event</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedEventId(null);
                  setRegistrations([]);
                }}
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {registrationsLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
              </div>
            ) : registrations.length === 0 ? (
              <div className="px-6 py-16 text-center text-sm text-slate-500">No applicants yet.</div>
            ) : (
              <div className="overflow-x-auto px-2 py-2">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wider text-slate-500">
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
          className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"
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
