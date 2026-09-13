'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, ExternalLink, FileText, FileUp, UserRound } from 'lucide-react';
import { ClientReviewSectionsPanel } from './ClientReviewSectionsPanel';
import { ResumeInlinePreview } from './ResumeInlinePreview';
import { DrawerCloseButton } from '../drawers/drawerLayout';
import {
  CLIENT_PIPELINE_STAGE_CHOICES,
  TAG_OPTIONS_BY_TYPE,
  type ClientReviewBatchRow,
} from '../../lib/clientReviewTypes';
import {
  clientTrackerAllowsResponse,
  normalizeClientTrackerOptions,
} from '../../lib/clientTrackerOptions';
import { isClientReviewFileHref } from '../../lib/clientReviewAssets';

const CVEditorModal = dynamic(() => import('../CVEditorModal'), { ssr: false });

type Props = {
  open: boolean;
  row: ClientReviewBatchRow | null;
  token: string;
  apiBase: string;
  onClose: () => void;
  onSubmitted?: (matchId: string, message: string, stage?: string | null) => void;
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
  const stageOptions =
    Array.isArray(reviewData?.pipelineStages) && reviewData.pipelineStages.length
      ? reviewData.pipelineStages
      : CLIENT_PIPELINE_STAGE_CHOICES;
  const tracker = normalizeClientTrackerOptions(reviewData?.trackerOptions, true);
  const canRespond = clientTrackerAllowsResponse(tracker);
  const canAttachDocument = tracker.attachDocument || isOfferFlow;

  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedTag, setSelectedTag] = useState(tagOptions[0]);
  const [selectedStage, setSelectedStage] = useState(stageOptions[0]?.name || '');
  const [comments, setComments] = useState('');
  const [offerLetterFile, setOfferLetterFile] = useState<File | null>(null);

  useEffect(() => {
    if (!open || !row) return;
    setSelectedTag(tagOptions[0]);
    const priorStage = String(
      row.clientMarkedStage || reviewData?.clientMarkedStage || '',
    ).trim();
    const known = stageOptions.find(
      (stage) => stage.name.toLowerCase() === priorStage.toLowerCase(),
    );
    setSelectedStage(known?.name || stageOptions[0]?.name || '');
    setComments('');
    setOfferLetterFile(null);
    setError('');
    setSuccess('');
    setConfirmOpen(false);
  }, [open, row?.matchId, tagOptions, stageOptions, row?.clientMarkedStage, reviewData?.clientMarkedStage]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !confirmOpen) onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, confirmOpen]);

  const requestSubmitConfirmation = () => {
    if (!row?.matchId || submitting) return;
    setError('');
    if (isOfferFlow && canAttachDocument && !offerLetterFile && !reviewData?.offerLetterUrl) {
      setError('Please attach the signed offer letter (PDF).');
      return;
    }
    if (tracker.addRemarks && !selectedTag) {
      setError('Please pick a decision.');
      return;
    }
    if (tracker.changeStage && !selectedStage) {
      setError('Please pick a stage.');
      return;
    }
    setConfirmOpen(true);
  };

  const submitTag = async () => {
    if (!row?.matchId) return;
    setConfirmOpen(false);
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      if (isOfferFlow && canAttachDocument && !offerLetterFile && !reviewData?.offerLetterUrl) {
        throw new Error('Please attach the signed offer letter (PDF).');
      }

      const formData = new FormData();
      if (tracker.addRemarks && selectedTag) formData.append('tag', selectedTag);
      if (tracker.changeStage && selectedStage) formData.append('stage', selectedStage);
      if (tracker.addComments && comments) formData.append('comments', comments);
      if (canAttachDocument && offerLetterFile) formData.append('offerLetter', offerLetterFile);
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
      const stageLabel = String(payload.data?.stageLabel || selectedStage || '').trim() || null;
      const message = isOfferFlow
        ? placementAttached
          ? 'Thank you. Offer letter received and attached to the placement record.'
          : 'Thank you. Offer letter received. The recruiter will be notified.'
        : 'Thank you. Your review has been submitted.';

      setSuccess(message);
      onSubmitted?.(row.matchId, message, stageLabel);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to submit your response');
    } finally {
      setSubmitting(false);
    }
  };

  const cvShareMode = String(reviewData?.cvShareMode || 'edited').toLowerCase();
  const showSaasaCv = tracker.downloadResume && cvShareMode === 'saasa';
  const showEditedCv = tracker.downloadResume && !showSaasaCv && cvShareMode !== 'original';
  const showOriginalResume = tracker.downloadResume && cvShareMode === 'original';
  const cvEditorPreview = reviewData?.cvEditorPreview ?? null;
  const sharedResumeUrl = String(
    reviewData?.sharedResumeUrl || reviewData?.candidate?.resume || '',
  ).trim();
  const canOpenResume = sharedResumeUrl.startsWith('http') || isClientReviewFileHref(sharedResumeUrl);
  const hasCvPreview = Boolean(showEditedCv && cvEditorPreview);
  const hasCvTab = Boolean(
    tracker.downloadResume && (hasCvPreview || canOpenResume || showSaasaCv || showOriginalResume),
  );

  const presentationSections = reviewData?.presentationSections ?? [];
  const hasPresentationSections = presentationSections.length > 0;

  const extraTabs: Array<{ id: string; label: string; content: React.ReactNode }> = [];

  if (hasCvTab) {
    const resumeTitle = showSaasaCv
      ? 'HRYantra CV'
      : showOriginalResume
        ? 'Original resume'
        : 'Candidate CV';
    const resumeSubtitle = showSaasaCv
      ? 'Annotated CV shared by the recruiter for your review.'
      : 'Preview of the resume shared by the recruiter.';

    extraTabs.push({
      id: 'cv',
      label: 'CV',
      content: (
        <div className="flex min-h-[70vh] flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-100/80 bg-white px-4 py-3 shadow-[0_10px_30px_-18px_rgba(79,70,229,0.28)] ring-1 ring-indigo-500/5 sm:px-5">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
                <FileText size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{resumeTitle}</p>
                <p className="mt-0.5 text-xs text-slate-500">{resumeSubtitle}</p>
              </div>
            </div>
            {canOpenResume ? (
              <a
                href={sharedResumeUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <ExternalLink size={14} />
                Open in new tab
              </a>
            ) : null}
          </div>

          {hasCvPreview ? (
            <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-indigo-100/80 bg-white shadow-[0_10px_30px_-18px_rgba(79,70,229,0.28)] ring-1 ring-indigo-500/5">
              <CVEditorModal initialData={cvEditorPreview} readOnly embedded />
            </div>
          ) : null}

          {canOpenResume && !hasCvPreview ? (
            <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-indigo-100/80 bg-white shadow-[0_10px_30px_-18px_rgba(79,70,229,0.28)] ring-1 ring-indigo-500/5">
              <ResumeInlinePreview
                resumeUrl={sharedResumeUrl}
                candidateName={row?.candidateName || reviewData?.candidate?.name || 'Candidate'}
                enabled
                minHeightClass="min-h-[70vh]"
                className="rounded-2xl"
              />
            </div>
          ) : null}

          {canOpenResume && hasCvPreview ? (
            <div className="overflow-hidden rounded-2xl border border-indigo-100/80 bg-white shadow-[0_10px_30px_-18px_rgba(79,70,229,0.28)] ring-1 ring-indigo-500/5">
              <p className="border-b border-slate-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Source resume file
              </p>
              <ResumeInlinePreview
                resumeUrl={sharedResumeUrl}
                candidateName={row?.candidateName || reviewData?.candidate?.name || 'Candidate'}
                enabled
                minHeightClass="min-h-[52vh]"
              />
            </div>
          ) : null}

          {!hasCvPreview && !canOpenResume ? (
            <p className="rounded-2xl border border-indigo-100/80 bg-white px-5 py-8 text-center text-sm text-slate-500 ring-1 ring-indigo-500/5">
              No CV was shared on this preview.
            </p>
          ) : null}
        </div>
      ),
    });
  }

  if (canRespond) {
    extraTabs.push({
      id: 'actions',
      label: 'Actions',
          content: (
            <div className="overflow-hidden rounded-2xl border border-indigo-100/80 bg-white p-5 shadow-[0_10px_30px_-18px_rgba(79,70,229,0.28)] ring-1 ring-indigo-500/5 sm:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-500">
                Your response
              </p>
              <h3 className="mt-1 text-base font-semibold text-slate-900">
                {isOfferFlow ? 'Confirm this offer' : 'Share a decision with the recruiter'}
              </h3>

          {canAttachDocument ? (
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
          ) : null}

          {tracker.addRemarks ? (
            <label className="mt-4 block text-sm font-semibold text-slate-900">
              Decision
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
          ) : null}

          {tracker.changeStage ? (
            <label className="mt-4 block text-sm font-semibold text-slate-900">
              Stage
              <select
                value={selectedStage}
                onChange={(e) => setSelectedStage(e.target.value)}
                className="mt-1.5 w-full rounded-2xl border-0 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-300"
              >
                {stageOptions.map((stage) => (
                  <option key={stage.id || stage.name} value={stage.name}>
                    {stage.name}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs font-normal text-slate-500">
                Your stage choice appears in the candidate table on this page and on the recruiter
                Client tab. It does not change the CRM pipeline stage.
              </span>
            </label>
          ) : null}

          {tracker.addComments ? (
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
          ) : null}

          {error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}
          {success ? <p className="mt-3 text-sm font-medium text-emerald-600">{success}</p> : null}

            <button
              type="button"
              onClick={requestSubmitConfirmation}
              disabled={submitting}
              className="mt-5 w-full rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:brightness-105 disabled:opacity-60"
            >
              {submitting ? 'Submitting...' : isOfferFlow ? 'Confirm offer & submit' : 'Submit review'}
            </button>
        </div>
      ),
    });
  }

  const roleLabel =
    reviewData?.candidate?.designation || row?.designation || reviewData?.job?.title || row?.jobTitle || '';
  const jobTitle = reviewData?.job?.title || row?.jobTitle || '';
  const clientName = reviewData?.client?.companyName || '';
  const canShowDrawer = Boolean(open && row && reviewData);

  if (typeof document === 'undefined') return null;

  const drawerTree = (
    <AnimatePresence>
      {canShowDrawer && row && reviewData ? (
        <>
          <motion.div
            key="client-candidate-review-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-[2px]"
            data-drawer-skip-dirty="true"
          />
          <motion.aside
            key="client-candidate-review-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="client-candidate-review-title"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed right-0 top-0 z-[201] flex h-full w-full max-w-[min(100vw,96rem)] flex-col overflow-hidden border-l border-indigo-100/70 bg-white shadow-2xl sm:w-[min(96vw,96rem)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative flex h-full min-h-0 flex-col">
              <div className="relative z-30 flex shrink-0 items-start justify-between gap-3 border-b border-indigo-100/70 bg-gradient-to-r from-indigo-50/90 via-white to-sky-50/50 px-5 py-4 sm:px-6">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-blue-600 to-sky-500 text-white shadow-lg shadow-indigo-500/25">
                    <UserRound size={20} />
                  </div>
                  <div className="min-w-0">
                    <h2
                      id="client-candidate-review-title"
                      className="truncate text-lg font-bold text-slate-900 sm:text-xl"
                    >
                      {row.candidateName}
                    </h2>
                    <p className="mt-0.5 truncate text-sm text-slate-500">
                      {[roleLabel, jobTitle, clientName].filter(Boolean).join(' · ') ||
                        'Review the shared profile and submit your decision'}
                    </p>
                  </div>
                </div>
                <DrawerCloseButton onClick={onClose} aria-label="Close candidate review" />
              </div>

              <div className="relative z-10 flex min-h-0 flex-1 flex-col">
                {tracker.viewProfile && hasPresentationSections ? (
                  <ClientReviewSectionsPanel
                    mode="tabs"
                    sections={presentationSections}
                    jobTitle={jobTitle}
                    clientName={clientName}
                    showMeta={false}
                    hideLinkedIn={!tracker.showLinkedIn}
                    hideInternalNotes={!tracker.showNotes}
                    hideResumeLinks={!tracker.downloadResume}
                    visibleFields={reviewData.visibleFields}
                    extraTabs={extraTabs}
                  />
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col">
                    {extraTabs.length ? (
                      <ClientReviewSectionsPanel
                        mode="tabs"
                        sections={[]}
                        showMeta={false}
                        extraTabs={extraTabs}
                      />
                    ) : (
                      <div className="m-6 rounded-2xl border border-indigo-100/80 bg-white px-5 py-8 text-center text-sm text-slate-600 ring-1 ring-indigo-500/5">
                        The recruiter hid the candidate profile on this preview.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.aside>

          {confirmOpen ? (
            <div className="fixed inset-0 z-[220] flex items-center justify-center px-4">
              <button
                type="button"
                aria-label="Cancel submit"
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
                onClick={() => setConfirmOpen(false)}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="client-review-confirm-title"
                className="relative w-full max-w-md overflow-hidden rounded-2xl border border-indigo-100/70 bg-white shadow-[0_24px_64px_-20px_rgba(79,70,229,0.35)] ring-1 ring-indigo-500/10"
              >
                <div className="px-6 pt-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                    <CheckCircle2 size={22} />
                  </span>
                  <h3 id="client-review-confirm-title" className="mt-4 text-lg font-semibold text-slate-900">
                    Submit this review?
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Your review for{' '}
                    <span className="font-semibold text-slate-900">{row.candidateName}</span>
                    {tracker.changeStage && selectedStage ? (
                      <>
                        {' '}
                        will show their stage as{' '}
                        <span className="font-semibold text-slate-900">{selectedStage}</span> in the
                        candidate table and on the recruiter Client tab (it will not change the CRM
                        pipeline stage)
                      </>
                    ) : selectedTag ? (
                      <>
                        {' '}
                        will be sent to the recruiter as{' '}
                        <span className="font-semibold text-slate-900">{selectedTag}</span>
                      </>
                    ) : (
                      <> will be sent to the recruiter</>
                    )}
                    . You can still cancel if you need to change it.
                  </p>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
                  <button
                    type="button"
                    onClick={() => setConfirmOpen(false)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitTag()}
                    className="rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:brightness-105"
                  >
                    Yes, submit
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </AnimatePresence>
  );

  return createPortal(drawerTree, document.body);
}
