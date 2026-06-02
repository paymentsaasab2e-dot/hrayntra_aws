'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import {
  ClientReviewCandidatePanel,
} from './ClientReviewCandidatePanel';
import {
  TAG_OPTIONS_BY_TYPE,
  type ClientReviewBatchRow,
  type ClientReviewData,
} from '../../lib/clientReviewTypes';

type Props = {
  open: boolean;
  row: ClientReviewBatchRow | null;
  token: string;
  apiBase: string;
  onClose: () => void;
  onSubmitted?: (matchId: string, message: string) => void;
};

export function ClientReviewCandidateDrawer({
  open,
  row,
  token,
  apiBase,
  onClose,
  onSubmitted,
}: Props) {
  const reviewData = row?.detail ?? null;
  const submissionType = String(reviewData?.submissionType || 'GENERAL').toUpperCase();
  const isOfferFlow = submissionType === 'OFFER_CONFIRMATION';
  const tagOptions = TAG_OPTIONS_BY_TYPE[submissionType] || TAG_OPTIONS_BY_TYPE.GENERAL;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedTag, setSelectedTag] = useState(tagOptions[0]);
  const [comments, setComments] = useState('');
  const [offerLetterFile, setOfferLetterFile] = useState<File | null>(null);

  useEffect(() => {
    if (!open || !row) return;
    setSelectedTag(tagOptions[0]);
    setComments('');
    setOfferLetterFile(null);
    setError('');
    setSuccess('');
  }, [open, row?.matchId, tagOptions]);

  const submitTag = async () => {
    if (!row?.matchId) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      if (isOfferFlow && !offerLetterFile && !reviewData?.offerLetterUrl) {
        throw new Error('Please attach the signed offer letter (PDF).');
      }

      const formData = new FormData();
      formData.append('tag', selectedTag);
      if (comments) formData.append('comments', comments);
      if (offerLetterFile) formData.append('offerLetter', offerLetterFile);
      formData.append('matchId', row.matchId);

      const response = await fetch(
        `${apiBase}/interviews/public/review/${encodeURIComponent(token)}/tag`,
        {
          method: 'POST',
          body: formData,
        },
      );
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || 'Unable to submit your response');
      }

      const placementAttached = Boolean(payload.data?.placementOfferAttached);
      const message = isOfferFlow
        ? placementAttached
          ? 'Thank you. Offer letter received and attached to the placement record.'
          : 'Thank you. Offer letter received. The recruiter will be notified.'
        : 'Thank you. Your review has been submitted.';

      setSuccess(message);
      onSubmitted?.(row.matchId, message);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to submit your response');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !row || !reviewData) return null;

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Close candidate review"
            className="fixed inset-0 z-40 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-3xl flex-col border-l border-slate-200 bg-white shadow-2xl"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
          >
            <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                  {row.candidateName
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join('')
                    .toUpperCase() || 'NA'}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Candidate Review</p>
                  <h2 className="mt-0.5 truncate text-lg font-bold text-slate-900">{row.candidateName}</h2>
                  <p className="mt-0.5 truncate text-sm text-slate-600">
                    {reviewData.candidate?.designation || row.designation || reviewData.job?.title || row.jobTitle || ''}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {reviewData.job?.title || row.jobTitle ? (
                      <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold text-violet-800">
                        {reviewData.job?.title || row.jobTitle}
                      </span>
                    ) : null}
                    {reviewData.client?.companyName ? (
                      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                        {reviewData.client.companyName}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-slate-500 hover:bg-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-white px-5 py-4">
              <ClientReviewCandidatePanel reviewData={reviewData} variant="drawer" />

              <div
                className={`mt-4 rounded-xl border p-4 ${
                  isOfferFlow ? 'border-amber-200 bg-amber-50' : 'border-[#E5E7EB] bg-[#F9FAFB]'
                }`}
              >
                <h3 className="text-sm font-semibold text-[#111827]">
                  {isOfferFlow ? 'Offer Letter*' : 'Attach Document (optional)'}
                </h3>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(event) => setOfferLetterFile(event.target.files?.[0] || null)}
                  className="mt-3 block w-full text-sm"
                />
              </div>

              <label className="mt-4 block text-sm font-semibold text-[#111827]">
                {isOfferFlow ? 'Decision' : 'Select Tag'}
                <select
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm"
                >
                  {tagOptions.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </label>

              <label className="mt-4 block text-sm font-semibold text-[#111827]">
                Comments
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm"
                  placeholder="Add any remarks for recruiter..."
                />
              </label>

              {error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}
              {success ? <p className="mt-3 text-sm font-medium text-green-600">{success}</p> : null}
            </div>

            <div className="border-t border-[#E5E7EB] px-5 py-4">
              <button
                type="button"
                onClick={submitTag}
                disabled={submitting}
                className="w-full rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {submitting ? 'Submitting...' : isOfferFlow ? 'Confirm Offer & Submit' : 'Submit Review'}
              </button>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
