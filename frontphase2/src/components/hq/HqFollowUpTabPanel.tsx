'use client';

import React, { useState } from 'react';
import { Check, ChevronDown, Pencil, Trash2 } from 'lucide-react';
import { HqPrimaryButton, HqSecondaryButton } from './hqUi';
import {
  defaultNextFollowUpLocal,
  formatNextFollowUpDisplay,
  toDatetimeLocalValue,
} from '@/app/hq/leads/hqLeadsData';

export type HqCrmFollowUp = {
  id: string;
  type: string;
  scheduledAt: string | null;
  notes: string;
  status: string;
  createdAt: string | null;
  createdByEmail?: string | null;
  completedAt?: string | null;
};

const INPUT_CLASS =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200';

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <p className="mb-1.5 text-sm font-medium text-slate-800">
      {children}
      {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
    </p>
  );
}

function formatCreatedAt(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function HqFollowUpTabPanel({
  nextFollowUpAt,
  nextFollowUpLabel,
  followUps,
  followUpTypes,
  tabError,
  onClearError,
  onSchedule,
  onUpdate,
  onComplete,
  onDelete,
}: {
  nextFollowUpAt?: string | null;
  nextFollowUpLabel?: string;
  followUps: HqCrmFollowUp[];
  followUpTypes: readonly string[];
  tabError: string | null;
  onClearError: () => void;
  onSchedule: (values: { type: string; scheduledAt: string; notes: string }) => Promise<void>;
  onUpdate: (
    followUpId: string,
    values: { type: string; scheduledAt: string; notes: string }
  ) => Promise<void>;
  onComplete: (followUpId: string) => Promise<void>;
  onDelete: (followUpId: string) => Promise<void>;
}) {
  const [form, setForm] = useState({
    type: 'Call',
    scheduledAt: defaultNextFollowUpLocal(),
    notes: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setForm({
      type: 'Call',
      scheduledAt: toDatetimeLocalValue(nextFollowUpAt) || defaultNextFollowUpLocal(),
      notes: '',
    });
  };

  const handleEdit = (item: HqCrmFollowUp) => {
    onClearError();
    setEditingId(item.id);
    setForm({
      type: item.type,
      scheduledAt: toDatetimeLocalValue(item.scheduledAt) || defaultNextFollowUpLocal(),
      notes: item.notes || '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onClearError();
    if (!form.scheduledAt.trim()) return;
    setSubmitting(true);
    try {
      if (editingId) {
        await onUpdate(editingId, form);
      } else {
        await onSchedule(form);
      }
      resetForm();
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async (followUpId: string) => {
    onClearError();
    setActionId(followUpId);
    try {
      await onComplete(followUpId);
      if (editingId === followUpId) resetForm();
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (followUpId: string) => {
    onClearError();
    if (!window.confirm('Delete this follow-up?')) return;
    setActionId(followUpId);
    try {
      await onDelete(followUpId);
      if (editingId === followUpId) resetForm();
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-6">
      {tabError ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {tabError}
        </p>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Next scheduled</p>
        <p className="mt-2 text-sm font-semibold text-slate-900">
          {formatNextFollowUpDisplay(nextFollowUpAt) || nextFollowUpLabel || '—'}
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 p-4">
        <h3 className="text-sm font-bold text-slate-900">
          {editingId ? 'Edit Follow-up' : 'Schedule Follow-up'}
        </h3>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel required>Type</FieldLabel>
              <div className="relative">
                <select
                  className={`${INPUT_CLASS} appearance-none pr-10`}
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  {followUpTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
            <div>
              <FieldLabel required>Date & Time</FieldLabel>
              <input
                type="datetime-local"
                className={INPUT_CLASS}
                value={form.scheduledAt}
                onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
              />
            </div>
          </div>
          <div>
            <FieldLabel>Notes</FieldLabel>
            <textarea
              rows={3}
              className={`${INPUT_CLASS} min-h-[80px] resize-y`}
              placeholder="What to discuss on the follow-up..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2">
            {editingId ? (
              <HqSecondaryButton type="button" onClick={resetForm} disabled={submitting}>
                Cancel
              </HqSecondaryButton>
            ) : null}
            <HqPrimaryButton type="submit" disabled={submitting}>
              {submitting
                ? editingId
                  ? 'Saving…'
                  : 'Scheduling…'
                : editingId
                  ? 'Save Changes'
                  : 'Schedule Follow-up'}
            </HqPrimaryButton>
          </div>
        </form>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-bold text-slate-900">Follow-up History</h3>
        {followUps.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            No follow-ups scheduled yet.
          </p>
        ) : (
          <div className="space-y-3">
            {followUps.map((item) => {
              const isCompleted = item.status === 'completed';
              const isBusy = actionId === item.id;
              return (
                <div
                  key={item.id}
                  className={`rounded-xl border p-4 shadow-sm ${
                    isCompleted
                      ? 'border-emerald-200 bg-emerald-50/40'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{item.type}</span>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${
                          isCompleted
                            ? 'bg-emerald-100 text-emerald-700 ring-emerald-200'
                            : 'bg-sky-50 text-sky-700 ring-sky-200'
                        }`}
                      >
                        {isCompleted ? 'Completed' : 'Scheduled'}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-slate-500">
                      {formatNextFollowUpDisplay(item.scheduledAt)}
                    </span>
                  </div>
                  {item.notes ? (
                    <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">{item.notes}</p>
                  ) : null}
                  <p className="mt-2 text-[11px] text-slate-400">
                    Logged {formatCreatedAt(item.createdAt)}
                    {item.createdByEmail ? ` · ${item.createdByEmail}` : ''}
                    {isCompleted && item.completedAt
                      ? ` · Completed ${formatCreatedAt(item.completedAt)}`
                      : ''}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!isCompleted ? (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleComplete(item.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
                      >
                        <Check className="h-3.5 w-3.5" />
                        {isBusy ? 'Updating…' : 'Mark Complete'}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleEdit(item)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleDelete(item.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
