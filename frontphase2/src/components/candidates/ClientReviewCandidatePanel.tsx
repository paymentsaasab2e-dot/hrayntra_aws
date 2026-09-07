'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import type { ClientReviewData } from '../../lib/clientReviewTypes';
import { ClientReviewSectionsPanel } from './ClientReviewSectionsPanel';
import { normalizeClientTrackerOptions } from '../../lib/clientTrackerOptions';
import { isClientReviewFileHref } from '../../lib/clientReviewAssets';

const CVEditorModal = dynamic(() => import('../CVEditorModal'), { ssr: false });

type Props = {
  reviewData: ClientReviewData;
  variant?: 'drawer' | 'page';
};

function candidateInitials(name?: string): string {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return 'NA';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] || ''}${parts[parts.length - 1]![0] || ''}`.toUpperCase();
}

function ClientReviewSharedExtras({
  reviewData,
  showScore,
  showNotes,
  showFiles,
  showFeedback,
}: {
  reviewData: ClientReviewData;
  showScore: boolean;
  showNotes: boolean;
  showFiles: boolean;
  showFeedback: boolean;
}) {
  const score = Number(reviewData?.matchScore);
  const notes = String(reviewData?.recruiterNotes || '').trim();
  const files = Array.isArray(reviewData?.candidateFiles) ? reviewData.candidateFiles : [];
  const feedback = reviewData?.interviewFeedback || [];

  return (
    <>
      {showScore && Number.isFinite(score) ? (
        <div className="rounded-3xl bg-white px-5 py-4 shadow-[0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-slate-200/70">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-500">Match score</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{Math.round(score)}</p>
          <p className="mt-0.5 text-xs text-slate-500">AI / match score for this role</p>
        </div>
      ) : null}

      {showNotes && notes ? (
        <div className="rounded-3xl bg-white px-5 py-4 shadow-[0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-slate-200/70">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-500">Recruiter notes</p>
          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{notes}</p>
        </div>
      ) : null}

      {showFiles && files.length ? (
        <div className="rounded-3xl bg-white px-5 py-4 shadow-[0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-slate-200/70">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-500">Files</p>
          <div className="mt-2 space-y-2">
            {files.map((file) => (
              <a
                key={file.id}
                href={file.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
              >
                <span className="truncate">{file.fileName}</span>
                <span className="ml-3 shrink-0 text-xs text-slate-500">{file.fileType}</span>
              </a>
            ))}
          </div>
        </div>
      ) : null}

      {showFeedback ? (
        <div className="rounded-3xl bg-white px-5 py-4 shadow-[0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-slate-200/70">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-500">Interview feedback</p>
          {feedback.length ? (
            <div className="mt-2 space-y-2">
              {feedback.map((item) => (
                <div key={item.id} className="rounded-2xl bg-slate-50 px-3 py-3">
                  <p className="text-sm font-semibold text-slate-900">{item.interviewerName}</p>
                  <p className="mt-1 text-sm text-slate-600">Recommendation: {item.recommendation || '-'}</p>
                  <p className="mt-1 text-sm text-slate-600">Comments: {item.comments || '-'}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No interview feedback available.</p>
          )}
        </div>
      ) : null}
    </>
  );
}

export function ClientReviewCandidatePanel({ reviewData, variant = 'page' }: Props) {
  const tracker = normalizeClientTrackerOptions(reviewData?.trackerOptions);
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
  const presentationSections = reviewData?.presentationSections ?? [];
  const hasPresentationSections = presentationSections.length > 0;
  const isDrawer = variant === 'drawer';

  if (hasPresentationSections) {
    return (
      <div className="space-y-4">
        {isDrawer ? (
          <div className="rounded-3xl bg-white px-5 py-4 shadow-[0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-slate-200/70">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-500">Overview</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Open a section to review the profile the recruiter shared, then submit your decision below.
            </p>
          </div>
        ) : null}

        {tracker.viewProfile ? (
          <ClientReviewSectionsPanel
            sections={presentationSections}
            jobTitle={reviewData?.job?.title}
            clientName={reviewData?.client?.companyName}
            defaultOpen={!isDrawer}
            showMeta={!isDrawer}
            hideLinkedIn={!tracker.showLinkedIn}
            hideInternalNotes={!tracker.showNotes}
            hideResumeLinks={!tracker.downloadResume}
          />
        ) : (
          <div className="rounded-3xl bg-slate-50 px-5 py-4 ring-1 ring-slate-200/70">
            <p className="text-sm text-slate-600">The recruiter hid the candidate profile on this preview.</p>
          </div>
        )}

        {showSaasaCv && canOpenResume ? (
          <div className="rounded-3xl bg-amber-50 px-5 py-4 ring-1 ring-amber-100">
            <h2 className="text-sm font-semibold text-slate-900">HRYantra CV</h2>
            <p className="mt-1 text-sm text-slate-600">
              Annotated CV shared by the recruiter for your review.
            </p>
            <a
              href={sharedResumeUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex text-sm font-semibold text-amber-900 hover:underline"
            >
              Open HRYantra CV
            </a>
          </div>
        ) : null}

        {showEditedCv && canOpenResume ? (
          <a
            href={sharedResumeUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded-3xl bg-white px-5 py-4 shadow-[0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-slate-200/70 transition hover:ring-indigo-200"
          >
            <div>
              <p className="text-sm font-semibold text-slate-900">Source resume</p>
              <p className="mt-0.5 text-xs text-slate-500">Reference file shared by the recruiter</p>
            </div>
            <span className="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
              Open file
            </span>
          </a>
        ) : null}

        <ClientReviewSharedExtras
          reviewData={reviewData}
          showScore={tracker.showScore}
          showNotes={tracker.showNotes}
          showFiles={tracker.downloadFiles}
          showFeedback={tracker.showInterviewFeedback}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!isDrawer ? (
        <div className="rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] px-4 py-3 text-sm text-[#1E40AF]">
          {showSaasaCv
            ? 'You are viewing the HRYantra CV the recruiter selected for your review.'
            : showOriginalResume
              ? 'You are viewing the original resume file shared by the recruiter.'
              : hasCvPreview
                ? 'You are viewing the CV the recruiter selected and submitted for your review.'
                : 'You are viewing the recruiter’s updated CV profile for this candidate.'}
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
            {candidateInitials(reviewData?.candidate?.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">{reviewData?.candidate?.name || 'Candidate'}</p>
            <p className="truncate text-xs text-slate-500">
              {[reviewData?.candidate?.designation, reviewData?.candidate?.currentCompany]
                .filter(Boolean)
                .join(' · ') || reviewData?.job?.title || ''}
            </p>
          </div>
        </div>
      )}

      {hasCvPreview ? (
        <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-[#F9FAFB]">
          <CVEditorModal initialData={cvEditorPreview} readOnly embedded />
        </div>
      ) : null}

      {showEditedCv && canOpenResume ? (
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-4">
          <h2 className="text-sm font-semibold text-[#111827]">Source resume (reference)</h2>
          <a
            href={sharedResumeUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex text-sm font-semibold text-[#2563EB] hover:underline"
          >
            Open resume file
          </a>
        </div>
      ) : null}

      {tracker.viewProfile ? (
        <div className="rounded-xl border border-[#E5E7EB] p-4">
          <h2 className="text-sm font-semibold text-[#111827]">Personal Information</h2>
          <p className="mt-2 text-sm font-semibold text-[#111827]">{reviewData?.candidate?.name || '-'}</p>
          <p className="mt-1 text-sm text-[#4B5563]">{reviewData?.candidate?.email || '-'}</p>
          <p className="mt-1 text-sm text-[#4B5563]">Phone: {reviewData?.candidate?.phone || '-'}</p>
          <p className="mt-1 text-sm text-[#4B5563]">Designation: {reviewData?.candidate?.designation || '-'}</p>
          <p className="mt-1 text-sm text-[#4B5563]">Current Company: {reviewData?.candidate?.currentCompany || '-'}</p>
          <p className="mt-1 text-sm text-[#4B5563]">Experience: {reviewData?.candidate?.experience ?? '-'} years</p>
          <p className="mt-1 text-sm text-[#4B5563]">Role: {reviewData?.job?.title || '-'}</p>
          <p className="mt-1 text-sm text-[#4B5563]">Client: {reviewData?.client?.companyName || '-'}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-600">The recruiter hid the candidate profile on this preview.</p>
        </div>
      )}

      {tracker.viewProfile && showEditedCv && !hasCvPreview ? (
        <>
          {(reviewData?.candidate?.cvWorkExperienceEntries || []).length > 0 ? (
            <div className="rounded-xl border border-[#E5E7EB] p-4">
              <h2 className="text-sm font-semibold text-[#111827]">Work Experience</h2>
              <div className="mt-3 space-y-3">
                {(reviewData.candidate?.cvWorkExperienceEntries || []).map((entry, index) => (
                  <div key={`work-${index}`} className="rounded-lg border border-[#F3F4F6] bg-[#F9FAFB] p-3">
                    <p className="text-sm font-semibold text-[#111827]">
                      {[entry.title, entry.company].filter(Boolean).join(' · ') || 'Role'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {showSaasaCv && canOpenResume ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <h2 className="text-sm font-semibold text-[#111827]">HRYantra CV</h2>
          <p className="mt-1 text-sm text-[#4B5563]">
            Annotated CV shared by the recruiter for your review.
          </p>
          <a
            href={sharedResumeUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex text-sm font-semibold text-amber-900 hover:underline"
          >
            Open HRYantra CV
          </a>
        </div>
      ) : null}

      {showOriginalResume ? (
        <div className="rounded-xl border border-[#E5E7EB] p-4">
          <h2 className="text-sm font-semibold text-[#111827]">Original Resume</h2>
          {canOpenResume ? (
            <a
              href={sharedResumeUrl || reviewData.candidate?.resume}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex text-sm font-semibold text-[#2563EB] hover:underline"
            >
              Open Resume
            </a>
          ) : (
            <p className="mt-2 text-sm text-[#4B5563]">No resume available.</p>
          )}
        </div>
      ) : null}

      <ClientReviewSharedExtras
        reviewData={reviewData}
        showScore={tracker.showScore}
        showNotes={tracker.showNotes}
        showFiles={tracker.downloadFiles}
        showFeedback={tracker.showInterviewFeedback}
      />
    </div>
  );
}
