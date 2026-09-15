'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'motion/react';
import { Loader2, MessageSquareText, X } from 'lucide-react';
import {
  CLIENT_PIPELINE_STAGE_CHOICES,
  type ClientReviewBatchRow,
} from '../../lib/clientReviewTypes';
import {
  clientTrackerAllowsResponse,
  normalizeClientTrackerOptions,
} from '../../lib/clientTrackerOptions';
import { DetailsModalShell } from '../drawers/DetailsModalShell';

type Props = {
  open: boolean;
  row: ClientReviewBatchRow | null;
  token: string;
  apiBase: string;
  onClose: () => void;
  onSubmitted?: (matchId: string, message: string, stage?: string | null) => void;
};

export function ClientReviewFeedbackModal({
  open,
  row,
  token,
  apiBase,
  onClose,
  onSubmitted,
}: Props) {
  // Keep last row during exit so AnimatePresence can finish without a content flash.
  const [displayRow, setDisplayRow] = useState<ClientReviewBatchRow | null>(row);
  useEffect(() => {
    if (row) setDisplayRow(row);
  }, [row]);

  const reviewData = displayRow?.detail ?? null;
  const stageOptions =
    Array.isArray(reviewData?.pipelineStages) && reviewData.pipelineStages.length
      ? reviewData.pipelineStages
      : CLIENT_PIPELINE_STAGE_CHOICES;
  const tracker = normalizeClientTrackerOptions(reviewData?.trackerOptions, true);
  const canRespond = clientTrackerAllowsResponse(tracker);

  const [comments, setComments] = useState('');
  const [selectedStage, setSelectedStage] = useState(stageOptions[0]?.name || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!open || !row) return;
    setComments('');
    const priorStage = String(
      row.clientMarkedStage || reviewData?.clientMarkedStage || '',
    ).trim();
    const known = stageOptions.find(
      (stage) => stage.name.toLowerCase() === priorStage.toLowerCase(),
    );
    setSelectedStage(known?.name || stageOptions[0]?.name || '');
    setError('');
    setSuccess('');
    setSubmitting(false);
  }, [open, row?.matchId, stageOptions, row?.clientMarkedStage, reviewData?.clientMarkedStage]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, submitting]);

  const submitFeedback = async () => {
    if (!displayRow?.matchId || submitting || !canRespond) return;
    const trimmed = comments.trim();
    if (tracker.changeStage && !selectedStage) {
      setError('Please pick a stage.');
      return;
    }
    if (tracker.addComments && !trimmed && !tracker.changeStage) {
      setError('Please add a comment before submitting.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const formData = new FormData();
      if (tracker.changeStage && selectedStage) formData.append('stage', selectedStage);
      if (tracker.addComments && trimmed) formData.append('comments', trimmed);
      formData.append('matchId', displayRow.matchId);

      const response = await fetch(
        `${apiBase}/interviews/public/review/${encodeURIComponent(token)}/tag`,
        {
          method: 'POST',
          body: formData,
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || 'Unable to submit feedback');
      }

      const stageLabel = String(payload?.data?.stageLabel || selectedStage || '').trim() || null;
      const message = 'Thank you. Your feedback has been submitted.';
      setSuccess(message);
      onSubmitted?.(displayRow.matchId, message, stageLabel);
      window.setTimeout(() => onClose(), 700);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  if (typeof document === 'undefined') return null;

  const show = open && Boolean(displayRow) && canRespond;

  return createPortal(
    <AnimatePresence
      onExitComplete={() => {
        if (!open) setDisplayRow(null);
      }}
    >
      {show && displayRow ? (
        <DetailsModalShell
          key="client-feedback-modal"
          size="sm"
          fit="content"
          zIndexClass="z-[220]"
          dialogTitleId="client-feedback-title"
          onBackdropClick={() => {
            if (!submitting) onClose();
          }}
          backdropClassName="bg-slate-900/45"
          panelClassName="shadow-2xl ring-1 ring-slate-200/80"
        >
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-indigo-50/80 via-white to-sky-50/40 px-5 py-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
                <MessageSquareText size={18} />
              </span>
              <div className="min-w-0">
                <h2 id="client-feedback-title" className="text-base font-semibold text-slate-900">
                  Feedback
                </h2>
                <p className="mt-0.5 truncate text-sm text-slate-500">
                  {displayRow.candidateName || 'Candidate'}
                  {displayRow.jobTitle ? ` · ${displayRow.jobTitle}` : ''}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!submitting) onClose();
              }}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close feedback"
            >
              <X size={18} />
            </button>
          </div>

          <div className="space-y-4 px-5 py-4">
            {tracker.changeStage ? (
              <label className="block text-sm font-semibold text-slate-900">
                Stage
                <select
                  value={selectedStage}
                  onChange={(e) => setSelectedStage(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border-0 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-300"
                >
                  {stageOptions.map((stage) => (
                    <option key={stage.id || stage.name} value={stage.name}>
                      {stage.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {tracker.addComments ? (
              <label className="block text-sm font-semibold text-slate-900">
                Comment
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  rows={5}
                  autoFocus
                  className="mt-1.5 w-full resize-none rounded-xl border-0 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-300"
                  placeholder="Share your feedback on this candidate…"
                />
              </label>
            ) : (
              <p className="text-sm text-slate-500">
                Comments are not enabled on this shared link. You can still update the stage if
                available.
              </p>
            )}

            {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
            {success ? <p className="text-sm font-medium text-emerald-600">{success}</p> : null}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3.5">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void submitFeedback()}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {submitting ? 'Submitting…' : 'Submit feedback'}
            </button>
          </div>
        </DetailsModalShell>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
