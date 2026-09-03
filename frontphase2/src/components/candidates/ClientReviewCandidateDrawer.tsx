'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Briefcase, Building2, FileUp, X } from 'lucide-react';
import { ClientReviewCandidatePanel } from './ClientReviewCandidatePanel';
import {
  TAG_OPTIONS_BY_TYPE,
  type ClientReviewBatchRow,
} from '../../lib/clientReviewTypes';

type Props = {
  open: boolean;
  row: ClientReviewBatchRow | null;
  token: string;
  apiBase: string;
  onClose: () => void;
  onSubmitted?: (matchId: string, message: string) => void;
};

function initialsFromName(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'NA'
  );
}

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

  const roleLabel =
    reviewData.candidate?.designation || row.designation || reviewData.job?.title || row.jobTitle || '';
  const jobTitle = reviewData.job?.title || row.jobTitle || '';
  const clientName = reviewData.client?.companyName || '';

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Close candidate review"
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[42rem] flex-col overflow-hidden bg-[#F6F7FB] shadow-[-24px_0_80px_rgba(15,23,42,0.18)]"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 280 }}
          >
            <div className="relative overflow-hidden bg-gradient-to-br from-[#4F46E5] via-[#5B5BD6] to-[#7C3AED] px-6 pb-6 pt-5 text-white">
              <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
              <div className="pointer-events-none absolute bottom-0 left-24 h-24 w-56 rounded-full bg-sky-300/20 blur-2xl" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-4">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/15 text-base font-semibold tracking-wide ring-2 ring-white/30">
                    {initialsFromName(row.candidateName)}
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
                      Candidate review
                    </p>
                    <h2 className="mt-1 truncate text-[1.45rem] font-semibold leading-tight tracking-tight">
                      {row.candidateName}
                    </h2>
                    {roleLabel ? (
                      <p className="mt-1 truncate text-sm text-white/80">{roleLabel}</p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {jobTitle ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white">
                          <Briefcase size={11} />
                          {jobTitle}
                        </span>
                      ) : null}
                      {clientName ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white">
                          <Building2 size={11} />
                          {clientName}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full bg-white/10 p-2 text-white/90 transition hover:bg-white/20"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              <ClientReviewCandidatePanel reviewData={reviewData} variant="drawer" />

              <div className="mt-5 overflow-hidden rounded-3xl bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-slate-200/70">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-500">
                  Your response
                </p>
                <h3 className="mt-1 text-base font-semibold text-slate-900">
                  {isOfferFlow ? 'Confirm this offer' : 'Share a decision with the recruiter'}
                </h3>

                <div
                  className={`mt-4 rounded-2xl border border-dashed px-4 py-3.5 ${
                    isOfferFlow ? 'border-amber-300 bg-amber-50/70' : 'border-slate-200 bg-slate-50/80'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-white text-indigo-600 ring-1 ring-slate-200">
                      <FileUp size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">
                        {isOfferFlow ? 'Offer letter *' : 'Attach a document'}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {isOfferFlow
                          ? 'PDF, max 4 MB. Required to confirm the offer.'
                          : 'Optional PDF, max 4 MB.'}
                      </p>
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={(event) => setOfferLetterFile(event.target.files?.[0] || null)}
                        className="mt-2.5 block w-full text-xs file:mr-3 file:rounded-full file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-indigo-700"
                      />
                      {offerLetterFile ? (
                        <p className="mt-1.5 truncate text-xs font-medium text-slate-600">
                          {offerLetterFile.name}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <label className="mt-4 block text-sm font-semibold text-slate-900">
                  {isOfferFlow ? 'Decision' : 'Decision'}
                  <select
                    value={selectedTag}
                    onChange={(e) => setSelectedTag(e.target.value)}
                    className="mt-1.5 w-full rounded-2xl border-0 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-300"
                  >
                    {tagOptions.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="mt-4 block text-sm font-semibold text-slate-900">
                  Comments
                  <textarea
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    rows={4}
                    className="mt-1.5 w-full resize-none rounded-2xl border-0 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-300"
                    placeholder="Add any remarks for the recruiter..."
                  />
                </label>

                {error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}
                {success ? <p className="mt-3 text-sm font-medium text-emerald-600">{success}</p> : null}
              </div>
            </div>

            <div className="border-t border-slate-200/80 bg-white/90 px-5 py-4 backdrop-blur">
              <button
                type="button"
                onClick={submitTag}
                disabled={submitting}
                className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(79,70,229,0.35)] transition hover:brightness-105 disabled:opacity-60"
              >
                {submitting ? 'Submitting...' : isOfferFlow ? 'Confirm offer & submit' : 'Submit review'}
              </button>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
