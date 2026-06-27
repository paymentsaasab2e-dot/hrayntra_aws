'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, ExternalLink, Star } from 'lucide-react';
import {
  apiGetInterviewApplication,
  apiUpdateInterviewApplication,
  type InterviewApplicationRow,
  type InterviewApplicationStatus,
} from '../../lib/api';
import {
  normalizeApplicationFormSchema,
  type ApplicationFormSchema,
} from '../../lib/applicationFormTypes';
import { useUser } from '../../hooks/useUser';

type Props = {
  applicationId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
};

function readAnswers(responses: unknown): Record<string, unknown> {
  if (!responses || typeof responses !== 'object') return {};
  const r = responses as { answers?: Record<string, unknown> };
  return r.answers && typeof r.answers === 'object' ? r.answers : (responses as Record<string, unknown>);
}

export function InterviewApplicationReviewDrawer({ applicationId, onClose, onUpdated }: Props) {
  const { user } = useUser();
  const [row, setRow] = useState<InterviewApplicationRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!applicationId) {
      setRow(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    void apiGetInterviewApplication(applicationId)
      .then((res) => {
        if (cancelled) return;
        const data = (res as { data?: InterviewApplicationRow })?.data ?? (res as InterviewApplicationRow);
        setRow(data);
        setNotes(String(data.interviewNotes || ''));
        setRating(Number(data.rating) || 0);
        setFeedback(String(data.feedback || ''));
        setRecommendation(String(data.recommendation || ''));
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load application');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  const schema = useMemo(
    () => normalizeApplicationFormSchema(row?.formSchema as ApplicationFormSchema | null),
    [row?.formSchema],
  );
  const answers = useMemo(() => readAnswers(row?.responses), [row?.responses]);

  const patch = async (payload: Parameters<typeof apiUpdateInterviewApplication>[1]) => {
    if (!applicationId) return;
    setSaving(true);
    setError('');
    try {
      const res = await apiUpdateInterviewApplication(applicationId, payload);
      const data = (res as { data?: InterviewApplicationRow })?.data ?? (res as InterviewApplicationRow);
      setRow(data);
      onUpdated?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const saveFeedback = async () => {
    const assigned = new Set(row?.assignedInterviewerIds || []);
    if (user?.id) assigned.add(String(user.id));
    await patch({
      interviewNotes: notes,
      rating: rating || undefined,
      feedback,
      recommendation,
      assignedInterviewerIds: Array.from(assigned),
    });
  };

  const setStatus = async (status: InterviewApplicationStatus) => {
    await patch({ status, interviewNotes: notes, rating: rating || undefined, feedback, recommendation });
  };

  return (
    <AnimatePresence>
      {applicationId ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-slate-900/40"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed right-0 top-0 z-[130] flex h-full w-full max-w-2xl flex-col border-l border-indigo-100 bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-600">
                  Interview application
                </p>
                <h2 className="text-lg font-bold text-slate-900">{row?.candidateName || 'Candidate'}</h2>
                <p className="text-xs text-slate-500">{row?.formName}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {loading ? (
                <p className="text-sm text-slate-500">Loading application…</p>
              ) : error ? (
                <p className="text-sm text-rose-600">{error}</p>
              ) : row ? (
                <>
                  <section className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Candidate</h3>
                    <dl className="mt-2 grid gap-1 text-sm text-slate-800">
                      <div>
                        <span className="text-slate-500">Email: </span>
                        {row.candidateEmail || '—'}
                      </div>
                      <div>
                        <span className="text-slate-500">Phone: </span>
                        {row.candidatePhone || '—'}
                      </div>
                      <div>
                        <span className="text-slate-500">Status: </span>
                        {row.status}
                      </div>
                      {row.resumeUrl ? (
                        <a
                          href={row.resumeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-indigo-700 hover:underline"
                        >
                          View resume <ExternalLink size={12} />
                        </a>
                      ) : null}
                    </dl>
                  </section>

                  {schema?.fields?.length ? (
                    <section className="rounded-xl border border-slate-100 p-4">
                      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Form responses
                      </h3>
                      <dl className="mt-3 space-y-3">
                        {schema.fields.map((field) => {
                          if (field.type === 'section_title') {
                            return (
                              <dt key={field.id} className="pt-2 text-sm font-semibold text-slate-900">
                                {field.label}
                              </dt>
                            );
                          }
                          const val = answers[field.id];
                          if (val == null || val === '') return null;
                          const display =
                            typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val);
                          return (
                            <div key={field.id}>
                              <dt className="text-[11px] font-semibold uppercase text-slate-500">
                                {field.label}
                              </dt>
                              <dd className="mt-0.5 whitespace-pre-wrap text-sm text-slate-800">{display}</dd>
                            </div>
                          );
                        })}
                      </dl>
                    </section>
                  ) : null}

                  <section className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-4 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-indigo-800">
                      Interview actions
                    </h3>
                    <label className="block text-xs font-medium text-slate-700">
                      Notes
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        placeholder="Interview notes…"
                      />
                    </label>
                    <label className="block text-xs font-medium text-slate-700">
                      Rating
                      <div className="mt-1 flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setRating(n)}
                            className={`rounded p-1 ${rating >= n ? 'text-amber-500' : 'text-slate-300'}`}
                          >
                            <Star size={18} fill={rating >= n ? 'currentColor' : 'none'} />
                          </button>
                        ))}
                      </div>
                    </label>
                    <label className="block text-xs font-medium text-slate-700">
                      Feedback
                      <textarea
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        rows={2}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block text-xs font-medium text-slate-700">
                      Recommendation
                      <input
                        value={recommendation}
                        onChange={(e) => setRecommendation(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        placeholder="e.g. Strong hire, hold for next round"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void setStatus('IN_INTERVIEW')}
                        className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-800"
                      >
                        Start interview
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void setStatus('INTERVIEW_COMPLETED')}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800"
                      >
                        Confirm interview
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void saveFeedback()}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800"
                      >
                        Save feedback
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void setStatus('APPROVED')}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void setStatus('REJECTED')}
                        className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        Reject
                      </button>
                    </div>
                  </section>
                </>
              ) : null}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
