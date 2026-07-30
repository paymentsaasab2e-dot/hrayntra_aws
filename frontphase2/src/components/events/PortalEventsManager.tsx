'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Loader2, MapPin, Plus, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import type {
  CreatePortalEventPayload,
  PortalEventRegistrationRow,
  PortalEventRow,
  PortalEventSection,
} from '@/lib/portal-events-api';

type PortalEventsManagerProps = {
  title: string;
  subtitle: string;
  listEvents: () => Promise<PortalEventRow[]>;
  createEvent: (payload: CreatePortalEventPayload) => Promise<PortalEventRow>;
  listRegistrations: (eventId: string) => Promise<{
    event: PortalEventRow;
    registrations: PortalEventRegistrationRow[];
  }>;
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

export function PortalEventsManager({
  title,
  subtitle,
  listEvents,
  createEvent,
  listRegistrations,
}: PortalEventsManagerProps) {
  const [events, setEvents] = useState<PortalEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [registrations, setRegistrations] = useState<PortalEventRegistrationRow[]>([]);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    location: '',
    scheduledAt: '',
    sections: [emptySection(1)],
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

  async function handleCreate() {
    if (!form.title.trim() || !form.description.trim() || !form.location.trim() || !form.scheduledAt) {
      toast.error('Title, description, location, and date are required.');
      return;
    }
    setSaving(true);
    try {
      const payload: CreatePortalEventPayload = {
        title: form.title.trim(),
        description: form.description.trim(),
        location: form.location.trim(),
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        sections: form.sections.filter((s) => s.title.trim() || s.content.trim()),
        isPublished: true,
      };
      await createEvent(payload);
      toast.success('Event created and published to the job portal.');
      setCreateOpen(false);
      setForm({ title: '', description: '', location: '', scheduledAt: '', sections: [emptySection(1)] });
      await loadEvents();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create event');
    } finally {
      setSaving(false);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"
        >
          <Plus className="h-4 w-4" />
          Create event
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-sky-500" />
          </div>
        ) : events.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-500">
            No events yet. Create one to publish it on the candidate portal.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Event</th>
                  <th className="px-4 py-3 font-semibold">Location</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Applicants</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-900">{event.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">{event.description}</p>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{event.location || '—'}</td>
                    <td className="px-4 py-4 text-slate-600">{formatDate(event.scheduledAt)}</td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                        <Users className="h-3.5 w-3.5" />
                        {event.registrationCount}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        onClick={() => void openRegistrations(event.id)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        View applicants
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">Create event</h2>
              <button type="button" onClick={() => setCreateOpen(false)} className="rounded-lg p-2 hover:bg-slate-100">
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
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Sections</span>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        sections: [...prev.sections, emptySection(prev.sections.length + 1)],
                      }))
                    }
                    className="text-xs font-semibold text-sky-600"
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
                onClick={() => setCreateOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleCreate()}
                className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
              >
                {saving ? 'Creating…' : 'Create & publish'}
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
                <Loader2 className="h-7 w-7 animate-spin text-sky-500" />
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
    </div>
  );
}
