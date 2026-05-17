'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

const LOCAL_API_BASE = 'http://127.0.0.1:5001/api/v1';
const PROD_PROXY_BASE = '/api/proxy';

const resolveApiBase = () => {
  if (typeof window === 'undefined') return PROD_PROXY_BASE;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')
    ? LOCAL_API_BASE
    : PROD_PROXY_BASE;
};

// Tag options change with the submission purpose so the client only sees
// decisions that make sense for what was asked of them.
const TAG_OPTIONS_BY_TYPE: Record<string, string[]> = {
  INITIAL_REVIEW: ['Proceed to Interview', 'Need Clarification', 'Hold', 'Not a Fit'],
  INTERIM_REVIEW: ['Proceed to Next Round', 'Need Clarification', 'Hold', 'Reject'],
  OFFER_CONFIRMATION: ['Offer Confirmed', 'Need Clarification', 'On Hold'],
  GENERAL: ['Interested', 'Need Clarification', 'Hold', 'Rejected', 'Proceed to Next Round'],
};

const PURPOSE_COPY: Record<string, { title: string; body: string }> = {
  INITIAL_REVIEW: {
    title: 'Initial Candidate Review',
    body: 'The recruiter is asking for your go-ahead before scheduling an interview with this candidate.',
  },
  INTERIM_REVIEW: {
    title: 'Mid-cycle Candidate Review',
    body: 'Please review the latest interview feedback and confirm whether to proceed to the next round.',
  },
  OFFER_CONFIRMATION: {
    title: 'Offer Confirmation',
    body: 'Final hand-off — please attach the signed offer letter and confirm the candidate is being placed.',
  },
  GENERAL: {
    title: 'Candidate Review',
    body: 'Please review the candidate details and share your decision with the recruiter.',
  },
};

interface CvWorkEntry {
  title?: string;
  company?: string;
  startDate?: string;
  endDate?: string;
  responsibilities?: string[];
}

interface CvEducationEntry {
  degree?: string;
  institution?: string;
  startYear?: string;
  endYear?: string;
}

interface ReviewData {
  interviewId: string;
  submissionType?: keyof typeof TAG_OPTIONS_BY_TYPE | string;
  cvShareMode?: 'edited' | 'original' | string;
  offerLetterUrl?: string | null;
  candidate?: {
    name?: string;
    email?: string;
    phone?: string;
    designation?: string;
    currentCompany?: string;
    experience?: number | null;
    address?: string;
    city?: string;
    country?: string;
    cvSummary?: string;
    education?: string;
    skills?: string[];
    languages?: string[];
    resume?: string;
    cvWorkExperienceEntries?: CvWorkEntry[];
    cvEducationEntries?: CvEducationEntry[];
  };
  job?: { title?: string };
  client?: { companyName?: string };
  interviewFeedback?: Array<{
    id: string;
    interviewerName: string;
    recommendation: string;
    comments: string;
  }>;
}

export default function ClientReviewPage() {
  const params = useParams<{ token?: string }>();
  const searchParams = useSearchParams();
  const tokenFromPath =
    typeof window !== 'undefined'
      ? window.location.pathname.split('/').filter(Boolean).slice(-1)[0]
      : '';
  const token = String(
    params?.token || searchParams.get('token') || tokenFromPath || ''
  ).trim();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [comments, setComments] = useState('');
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [offerLetterFile, setOfferLetterFile] = useState<File | null>(null);

  const apiBase = useMemo(() => resolveApiBase(), []);

  const submissionType = String(reviewData?.submissionType || 'GENERAL').toUpperCase();
  const cvShareMode = String(reviewData?.cvShareMode || 'edited').toLowerCase();
  const showEditedCv = cvShareMode !== 'original';
  const showOriginalResume = cvShareMode === 'original';
  const isOfferFlow = submissionType === 'OFFER_CONFIRMATION';
  const tagOptions = TAG_OPTIONS_BY_TYPE[submissionType] || TAG_OPTIONS_BY_TYPE.GENERAL;
  const purpose = PURPOSE_COPY[submissionType] || PURPOSE_COPY.GENERAL;

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError('No token provided');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    void (async () => {
      try {
        const response = await fetch(`${apiBase}/interviews/public/review/${encodeURIComponent(token)}`);
        const payload = await response.json();
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || 'Invalid or expired review link');
        }
        if (cancelled) return;
        const data: ReviewData = payload.data || payload;
        setReviewData(data);
        const initialOptions =
          TAG_OPTIONS_BY_TYPE[String(data.submissionType || 'GENERAL').toUpperCase()] ||
          TAG_OPTIONS_BY_TYPE.GENERAL;
        setSelectedTag(initialOptions[0]);
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message || 'Unable to load review details');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBase, token]);

  const submitTag = async () => {
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      // For the offer-confirmation flow we always send multipart so we can
      // also carry the signed PDF in the same request. For the other flows
      // we still use multipart with no file attached — keeps the backend
      // single-path.
      if (isOfferFlow && !offerLetterFile && !reviewData?.offerLetterUrl) {
        throw new Error('Please attach the signed offer letter (PDF).');
      }

      const formData = new FormData();
      formData.append('tag', selectedTag);
      if (comments) formData.append('comments', comments);
      if (offerLetterFile) formData.append('offerLetter', offerLetterFile);

      const response = await fetch(
        `${apiBase}/interviews/public/review/${encodeURIComponent(token)}/tag`,
        {
          method: 'POST',
          body: formData,
        }
      );
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || 'Unable to submit your response');
      }
      const placementAttached = Boolean(payload.data?.placementOfferAttached);
      const fileSent = Boolean(offerLetterFile);
      setSuccess(
        isOfferFlow
          ? placementAttached
            ? 'Thank you. Offer letter received and attached to the candidate\'s placement record — the recruiter can now preview it from the Placements tab.'
            : 'Thank you. Offer letter received. The recruiter will be notified to create the placement record.'
          : fileSent
            ? 'Thank you. Your review and the attached document have been submitted — the recruiter will see it on the candidate\'s Documents tab.'
            : 'Thank you. Your review has been submitted.'
      );
      // Refresh the offer-letter URL we now have on file so a re-submit can
      // simply reuse it instead of asking the client to upload again.
      const returnedUrl = payload.data?.offerLetterUrl as string | null | undefined;
      if (returnedUrl) {
        setReviewData((current) => (current ? { ...current, offerLetterUrl: returnedUrl } : current));
        setOfferLetterFile(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to submit your response');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-8">
      <div className="mx-auto max-w-3xl rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
        <div className="mb-4 rounded-xl bg-[#EFF6FF] px-4 py-3 text-[#1E3A8A]">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#1E40AF]">
            {purpose.title}
          </p>
          <p className="mt-1 text-sm text-[#1E3A8A]">{purpose.body}</p>
        </div>
        <h1 className="text-2xl font-bold text-[#111827]">Candidate Review</h1>
        {loading ? <p className="mt-4 text-sm text-[#6B7280]">Loading review details...</p> : null}
        {error ? <p className="mt-4 text-sm font-medium text-red-600">{error}</p> : null}
        {reviewData ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] px-4 py-3 text-sm text-[#1E40AF]">
              {showOriginalResume
                ? 'You are viewing the original resume file shared by the recruiter.'
                : 'You are viewing the recruiter’s updated CV profile for this candidate.'}
            </div>

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
              <p className="mt-1 text-sm text-[#4B5563]">
                Address: {[reviewData?.candidate?.address, reviewData?.candidate?.city, reviewData?.candidate?.country].filter(Boolean).join(', ') || '-'}
              </p>
            </div>

            {showEditedCv ? (
              <div className="rounded-xl border border-[#E5E7EB] p-4">
                <h2 className="text-sm font-semibold text-[#111827]">Professional Summary</h2>
                <p className="mt-2 text-sm text-[#4B5563]">{reviewData?.candidate?.cvSummary || 'No summary available.'}</p>
              </div>
            ) : null}

            {showEditedCv ? (
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
                          {(entry.startDate || entry.endDate) ? (
                            <p className="mt-0.5 text-xs text-[#6B7280]">
                              {[entry.startDate, entry.endDate].filter(Boolean).join(' – ')}
                            </p>
                          ) : null}
                          {(entry.responsibilities || []).length > 0 ? (
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#4B5563]">
                              {(entry.responsibilities || []).map((line, lineIndex) => (
                                <li key={lineIndex}>{line}</li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-xl border border-[#E5E7EB] p-4">
                  <h2 className="text-sm font-semibold text-[#111827]">Education</h2>
                  {(reviewData?.candidate?.cvEducationEntries || []).length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {(reviewData.candidate?.cvEducationEntries || []).map((entry, index) => (
                        <div key={`edu-${index}`} className="rounded-lg border border-[#F3F4F6] bg-[#F9FAFB] p-3">
                          <p className="text-sm font-semibold text-[#111827]">
                            {[entry.degree, entry.institution].filter(Boolean).join(' · ') || 'Education'}
                          </p>
                          {(entry.startYear || entry.endYear) ? (
                            <p className="mt-0.5 text-xs text-[#6B7280]">
                              {[entry.startYear, entry.endYear].filter(Boolean).join(' – ')}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-[#4B5563]">
                      {reviewData?.candidate?.education || 'No education details.'}
                    </p>
                  )}
                </div>
                <div className="rounded-xl border border-[#E5E7EB] p-4">
                  <h2 className="text-sm font-semibold text-[#111827]">Skills & Languages</h2>
                  <p className="mt-2 text-sm text-[#4B5563]">Skills: {(reviewData?.candidate?.skills || []).join(', ') || '-'}</p>
                  <p className="mt-1 text-sm text-[#4B5563]">Languages: {(reviewData?.candidate?.languages || []).join(', ') || '-'}</p>
                </div>
              </>
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

            <div
              className={`rounded-xl border p-4 ${
                isOfferFlow ? 'border-amber-200 bg-amber-50' : 'border-[#E5E7EB] bg-[#F9FAFB]'
              }`}
            >
              <h2 className="text-sm font-semibold text-[#111827]">
                {isOfferFlow ? 'Offer Letter*' : 'Attach Document (optional)'}
              </h2>
              <p className="mt-1 text-xs text-[#6B7280]">
                {isOfferFlow
                  ? 'Attach the signed offer letter (PDF, max 5 MB) so the recruiter can finalize the placement.'
                  : 'Optionally attach any supporting document (PDF, max 5 MB) — interview notes, signed NDA, requirement clarifications, etc. The recruiter will see it on the candidate\'s Documents tab.'}
              </p>
              {reviewData.offerLetterUrl ? (
                <p className="mt-2 text-xs text-emerald-700">
                  Already on file:&nbsp;
                  <a
                    href={reviewData.offerLetterUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold underline"
                  >
                    open uploaded document
                  </a>
                  . Re-upload below to replace it.
                </p>
              ) : null}
              <input
                type="file"
                accept="application/pdf"
                onChange={(event) => setOfferLetterFile(event.target.files?.[0] || null)}
                className="mt-3 block w-full text-sm"
              />
              {offerLetterFile ? (
                <p className="mt-2 text-xs text-[#374151]">
                  Selected: {offerLetterFile.name} ({Math.round(offerLetterFile.size / 1024)} KB)
                </p>
              ) : null}
            </div>

            <label className="block text-sm font-semibold text-[#111827]">
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

            <label className="block text-sm font-semibold text-[#111827]">
              Comments
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm"
                placeholder={
                  isOfferFlow
                    ? 'Add any clarifications about the offer (optional)...'
                    : 'Add any remarks for recruiter...'
                }
              />
            </label>

            <button
              type="button"
              onClick={submitTag}
              disabled={submitting}
              className="rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? 'Submitting...' : isOfferFlow ? 'Confirm Offer & Submit' : 'Submit Review'}
            </button>
            {success ? <p className="text-sm font-medium text-green-600">{success}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
