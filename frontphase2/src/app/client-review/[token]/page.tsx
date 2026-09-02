'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ClientReviewBatchTable } from '../../../components/candidates/ClientReviewBatchTable';
import { ClientReviewCandidateDrawer } from '../../../components/candidates/ClientReviewCandidateDrawer';
import { ClientReviewCandidatePanel } from '../../../components/candidates/ClientReviewCandidatePanel';
import {
  PURPOSE_COPY,
  TAG_OPTIONS_BY_TYPE,
  type ClientReviewBatchRow,
  type ClientReviewData,
} from '../../../lib/clientReviewTypes';
import { getApiErrorMessage, readApiJson } from '../../../lib/apiNetworkErrors';

const LOCAL_API_BASE = 'http://127.0.0.1:5001/api/v1';
const PROD_PROXY_BASE = '/api/proxy';

const LOCAL_BACKEND_ORIGIN = 'http://127.0.0.1:5001';
const PROD_BACKEND_ORIGIN =
  process.env.NEXT_PUBLIC_BACKEND_ORIGIN || 'https://api2.hryantra.com';

// Keep under the serverless proxy/platform request-body limit (~4.5 MB on
// Vercel). A larger PDF is rejected by the platform with a plain-text
// "Request Entity Too Large" before it reaches the API, which the browser then
// fails to JSON-parse ("Unexpected token 'R'..."). Block it client-side first.
const MAX_OFFER_FILE_BYTES = 4 * 1024 * 1024;

const isLocalHost = () => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
};

const resolveApiBase = () => {
  if (typeof window === 'undefined') return PROD_PROXY_BASE;
  return isLocalHost() ? LOCAL_API_BASE : PROD_PROXY_BASE;
};

/**
 * Uploaded files are served by the backend's `/uploads/...` static handler on a
 * different origin than this SPA. Stored URLs can be relative (`/uploads/...`)
 * or an absolute dev URL (`http://localhost:5001/...`) — either would 404 when
 * opened from employers.hryantra.com, so rewrite them to the real backend host.
 */
const resolveUploadUrl = (raw?: string | null): string => {
  const value = String(raw || '').trim();
  if (!value) return '';
  const backendOrigin = isLocalHost() ? LOCAL_BACKEND_ORIGIN : PROD_BACKEND_ORIGIN;
  const rewritten = value.replace(
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i,
    backendOrigin,
  );
  const relative = rewritten.startsWith('/uploads/')
    ? rewritten
    : (() => {
        try {
          const pathname = new URL(rewritten).pathname || '';
          return pathname.startsWith('/uploads/') ? pathname : '';
        } catch {
          return '';
        }
      })();
  if (
    relative.startsWith('/uploads/placements/') ||
    relative.startsWith('/uploads/interview-client-review/')
  ) {
    return `${backendOrigin}/api/v1/public/uploads/${relative.replace(/^\/uploads\//, '')}`;
  }
  if (rewritten.startsWith('/uploads')) return `${backendOrigin}${rewritten}`;
  return rewritten;
};

export default function ClientReviewPage() {
  const params = useParams<{ token?: string }>();
  const searchParams = useSearchParams();
  const tokenFromPath =
    typeof window !== 'undefined'
      ? window.location.pathname.split('/').filter(Boolean).slice(-1)[0]
      : '';
  const token = String(
    params?.token || searchParams.get('token') || tokenFromPath || '',
  ).trim();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [comments, setComments] = useState('');
  const [reviewData, setReviewData] = useState<ClientReviewData | null>(null);
  const [offerLetterFile, setOfferLetterFile] = useState<File | null>(null);
  const [drawerRow, setDrawerRow] = useState<ClientReviewBatchRow | null>(null);
  const [reviewedMatchIds, setReviewedMatchIds] = useState<string[]>([]);

  const apiBase = useMemo(() => resolveApiBase(), []);

  const batchCandidates = reviewData?.batchCandidates ?? [];
  const isBatchReview = batchCandidates.length > 1;
  const submissionType = String(reviewData?.submissionType || 'GENERAL').toUpperCase();
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
        const payload = await readApiJson<any>(response);
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || 'Invalid or expired review link');
        }
        if (cancelled) return;
        const data: ClientReviewData = payload.data || payload;
        setReviewData(data);
        const initialOptions =
          TAG_OPTIONS_BY_TYPE[String(data.submissionType || 'GENERAL').toUpperCase()] ||
          TAG_OPTIONS_BY_TYPE.GENERAL;
        setSelectedTag(initialOptions[0]);
      } catch (err: unknown) {
        if (cancelled) return;
        setError(getApiErrorMessage(err) || 'Unable to load review details');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      setLoading(false);
    };
  }, [apiBase, token]);

  const submitTag = async () => {
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      if (isOfferFlow && !offerLetterFile && !reviewData?.offerLetterUrl) {
        throw new Error('Please attach the signed offer letter (PDF).');
      }

      if (offerLetterFile) {
        if (offerLetterFile.type && !/^application\/pdf$/i.test(offerLetterFile.type)) {
          throw new Error('Only PDF files are allowed. Please attach a PDF.');
        }
        if (offerLetterFile.size > MAX_OFFER_FILE_BYTES) {
          const sizeMb = (offerLetterFile.size / (1024 * 1024)).toFixed(1);
          throw new Error(
            `The selected file is ${sizeMb} MB. Please attach a PDF under 4 MB and try again.`,
          );
        }
      }

      const formData = new FormData();
      formData.append('tag', selectedTag);
      if (comments) formData.append('comments', comments);
      if (offerLetterFile) formData.append('offerLetter', offerLetterFile);
      if (reviewData?.matchId) formData.append('matchId', reviewData.matchId);

      const response = await fetch(
        `${apiBase}/interviews/public/review/${encodeURIComponent(token)}/tag`,
        {
          method: 'POST',
          body: formData,
        },
      );
      const payload = await readApiJson<any>(response);
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
            : 'Thank you. Your review has been submitted.',
      );
      const returnedUrl = payload.data?.offerLetterUrl as string | null | undefined;
      if (returnedUrl) {
        setReviewData((current) => (current ? { ...current, offerLetterUrl: returnedUrl } : current));
        setOfferLetterFile(null);
      }
    } catch (err: unknown) {
      setError(getApiErrorMessage(err) || 'Unable to submit your response');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDrawerSubmitted = (matchId: string) => {
    setReviewedMatchIds((current) =>
      current.includes(matchId) ? current : [...current, matchId],
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-8">
      <div className={`mx-auto rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm ${isBatchReview ? 'max-w-5xl' : 'max-w-3xl'}`}>
        <div className="mb-4 rounded-xl bg-[#EFF6FF] px-4 py-3 text-[#1E3A8A]">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#1E40AF]">
            {purpose.title}
          </p>
          <p className="mt-1 text-sm text-[#1E3A8A]">{purpose.body}</p>
        </div>
        <h1 className="text-2xl font-bold text-[#111827]">
          {isBatchReview ? 'Submitted Candidates' : 'Candidate Review'}
        </h1>
        {loading ? <p className="mt-4 text-sm text-[#6B7280]">Loading review details...</p> : null}
        {error ? <p className="mt-4 text-sm font-medium text-red-600">{error}</p> : null}

        {reviewData && isBatchReview ? (
          <div className="mt-5 space-y-4">
            <ClientReviewBatchTable
              rows={batchCandidates.map((row) => ({
                ...row,
                candidateName:
                  reviewedMatchIds.includes(row.matchId) && row.candidateName
                    ? `${row.candidateName} ✓`
                    : row.candidateName,
              }))}
              onView={(row) => setDrawerRow(row)}
            />
            {reviewedMatchIds.length > 0 ? (
              <p className="text-sm font-medium text-green-600">
                {reviewedMatchIds.length} of {batchCandidates.length} candidate
                {batchCandidates.length === 1 ? '' : 's'} reviewed.
              </p>
            ) : (
              <p className="text-sm text-[#6B7280]">
                Open each candidate with View, review their profile, and submit your decision.
              </p>
            )}
          </div>
        ) : null}

        {reviewData && !isBatchReview ? (
          <div className="mt-5 space-y-4">
            <ClientReviewCandidatePanel reviewData={reviewData} />

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
                  ? 'Attach the signed offer letter (PDF, max 4 MB) so the recruiter can finalize the placement.'
                  : 'Optionally attach any supporting document (PDF, max 4 MB).'}
              </p>
              {reviewData.offerLetterUrl ? (
                <p className="mt-2 text-xs text-emerald-700">
                  Already on file:&nbsp;
                  <a
                    href={resolveUploadUrl(reviewData.offerLetterUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold underline"
                  >
                    open uploaded document
                  </a>
                </p>
              ) : null}
              <input
                type="file"
                accept="application/pdf"
                onChange={(event) => setOfferLetterFile(event.target.files?.[0] || null)}
                className="mt-3 block w-full text-sm"
              />
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
                placeholder="Add any remarks for recruiter..."
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

      <ClientReviewCandidateDrawer
        open={Boolean(drawerRow)}
        row={drawerRow}
        token={token}
        apiBase={apiBase}
        onClose={() => setDrawerRow(null)}
        onSubmitted={handleDrawerSubmitted}
      />
    </div>
  );
}
