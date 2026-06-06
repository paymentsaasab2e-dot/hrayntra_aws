'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import type { ClientReviewData } from '../../lib/clientReviewTypes';
import { ClientReviewSectionsPanel } from './ClientReviewSectionsPanel';

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

export function ClientReviewCandidatePanel({ reviewData, variant = 'page' }: Props) {
  const cvShareMode = String(reviewData?.cvShareMode || 'edited').toLowerCase();
  const showSaasaCv = cvShareMode === 'saasa';
  const showEditedCv = !showSaasaCv && cvShareMode !== 'original';
  const showOriginalResume = cvShareMode === 'original';
  const cvEditorPreview = reviewData?.cvEditorPreview ?? null;
  const sharedResumeUrl = String(
    reviewData?.sharedResumeUrl || reviewData?.candidate?.resume || '',
  ).trim();
  const hasCvPreview = Boolean(showEditedCv && cvEditorPreview);
  const presentationSections = reviewData?.presentationSections ?? [];
  const hasPresentationSections = presentationSections.length > 0;
  const isDrawer = variant === 'drawer';

  if (hasPresentationSections) {
    return (
      <div className="space-y-4">
        {isDrawer ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Overview</p>
            <p className="mt-1 text-sm text-slate-600">
              Sections below were selected by the recruiter for your client review.
            </p>
          </div>
        ) : null}

        <ClientReviewSectionsPanel
          sections={presentationSections}
          jobTitle={reviewData?.job?.title}
          clientName={reviewData?.client?.companyName}
          defaultOpen
          showMeta={!isDrawer}
        />

        {showSaasaCv && sharedResumeUrl.startsWith('http') ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
            <h2 className="text-sm font-semibold text-slate-900">SAASA CV</h2>
            <p className="mt-1 text-sm text-slate-600">
              Annotated CV shared by the recruiter for your review.
            </p>
            <a
              href={sharedResumeUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex text-sm font-semibold text-amber-900 hover:underline"
            >
              Open SAASA CV
            </a>
          </div>
        ) : null}

        {showEditedCv && sharedResumeUrl.startsWith('http') ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Source resume (reference)</h2>
            <a
              href={sharedResumeUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex text-sm font-semibold text-blue-700 hover:underline"
            >
              Open resume file
            </a>
          </div>
        ) : null}

        {!isDrawer ? (
          <div className="rounded-xl border border-[#E5E7EB] p-4">
            <h2 className="text-sm font-semibold text-[#111827]">Interview Feedback</h2>
            {(reviewData?.interviewFeedback || []).length ? (
              <div className="mt-2 space-y-2">
                {(reviewData.interviewFeedback || []).map((item) => (
                  <div key={item.id} className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3">
                    <p className="text-sm font-semibold text-[#111827]">{item.interviewerName}</p>
                    <p className="mt-1 text-sm text-[#4B5563]">Recommendation: {item.recommendation || '-'}</p>
                    <p className="mt-1 text-sm text-[#4B5563]">Comments: {item.comments || '-'}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-[#4B5563]">No interview feedback available.</p>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!isDrawer ? (
        <div className="rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] px-4 py-3 text-sm text-[#1E40AF]">
          {showSaasaCv
            ? 'You are viewing the SAASA CV the recruiter selected for your review.'
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

      {showEditedCv && sharedResumeUrl.startsWith('http') ? (
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

      {showEditedCv && !hasCvPreview ? (
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

      {showSaasaCv && sharedResumeUrl.startsWith('http') ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <h2 className="text-sm font-semibold text-[#111827]">SAASA CV</h2>
          <p className="mt-1 text-sm text-[#4B5563]">
            Annotated CV shared by the recruiter for your review.
          </p>
          <a
            href={sharedResumeUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex text-sm font-semibold text-amber-900 hover:underline"
          >
            Open SAASA CV
          </a>
        </div>
      ) : null}

      {showOriginalResume ? (
        <div className="rounded-xl border border-[#E5E7EB] p-4">
          <h2 className="text-sm font-semibold text-[#111827]">Original Resume</h2>
          {String(reviewData?.candidate?.resume || '').startsWith('http') ? (
            <a
              href={reviewData.candidate?.resume}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex text-sm font-semibold text-[#2563EB] hover:underline"
            >
              Open Resume
            </a>
          ) : (
            <p className="mt-2 text-sm text-[#4B5563]">{reviewData?.candidate?.resume || 'No resume available.'}</p>
          )}
        </div>
      ) : null}

      {!isDrawer ? (
        <div className="rounded-xl border border-[#E5E7EB] p-4">
          <h2 className="text-sm font-semibold text-[#111827]">Interview Feedback</h2>
          {(reviewData?.interviewFeedback || []).length ? (
            <div className="mt-2 space-y-2">
              {(reviewData.interviewFeedback || []).map((item) => (
                <div key={item.id} className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3">
                  <p className="text-sm font-semibold text-[#111827]">{item.interviewerName}</p>
                  <p className="mt-1 text-sm text-[#4B5563]">Recommendation: {item.recommendation || '-'}</p>
                  <p className="mt-1 text-sm text-[#4B5563]">Comments: {item.comments || '-'}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-[#4B5563]">No interview feedback available.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
