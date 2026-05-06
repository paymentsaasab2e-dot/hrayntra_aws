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

const tags = ['Interested', 'Need Clarification', 'Hold', 'Rejected', 'Proceed to Next Round'];

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
  const [selectedTag, setSelectedTag] = useState(tags[0]);
  const [comments, setComments] = useState('');
  const [reviewData, setReviewData] = useState<any>(null);

  const apiBase = useMemo(() => resolveApiBase(), []);

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
        setReviewData(payload.data || payload);
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
      const response = await fetch(
        `${apiBase}/interviews/public/review/${encodeURIComponent(token)}/tag`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag: selectedTag, comments }),
        }
      );
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || 'Unable to submit your response');
      }
      setSuccess('Thank you. Your review tag has been submitted.');
    } catch (err: any) {
      setError(err?.message || 'Unable to submit your response');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-8">
      <div className="mx-auto max-w-3xl rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-[#111827]">Candidate Review</h1>
        {loading ? <p className="mt-4 text-sm text-[#6B7280]">Loading review details...</p> : null}
        {error ? <p className="mt-4 text-sm font-medium text-red-600">{error}</p> : null}
        {reviewData ? (
          <div className="mt-5 space-y-4">
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

            <div className="rounded-xl border border-[#E5E7EB] p-4">
              <h2 className="text-sm font-semibold text-[#111827]">Summary</h2>
              <p className="mt-2 text-sm text-[#4B5563]">{reviewData?.candidate?.cvSummary || 'No summary available.'}</p>
            </div>

            <div className="rounded-xl border border-[#E5E7EB] p-4">
              <h2 className="text-sm font-semibold text-[#111827]">Education</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-[#4B5563]">{reviewData?.candidate?.education || 'No education details.'}</p>
            </div>

            <div className="rounded-xl border border-[#E5E7EB] p-4">
              <h2 className="text-sm font-semibold text-[#111827]">Skills & Languages</h2>
              <p className="mt-2 text-sm text-[#4B5563]">Skills: {(reviewData?.candidate?.skills || []).join(', ') || '-'}</p>
              <p className="mt-1 text-sm text-[#4B5563]">Languages: {(reviewData?.candidate?.languages || []).join(', ') || '-'}</p>
            </div>

            <div className="rounded-xl border border-[#E5E7EB] p-4">
              <h2 className="text-sm font-semibold text-[#111827]">Resume</h2>
              {String(reviewData?.candidate?.resume || '').startsWith('http') ? (
                <a
                  href={reviewData.candidate.resume}
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

            <div className="rounded-xl border border-[#E5E7EB] p-4">
              <h2 className="text-sm font-semibold text-[#111827]">Interview Feedback</h2>
              {(reviewData?.interviewFeedback || []).length ? (
                <div className="mt-2 space-y-2">
                  {reviewData.interviewFeedback.map((item: any) => (
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

            <label className="block text-sm font-semibold text-[#111827]">
              Select Tag
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm"
              >
                {tags.map((tag) => (
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
              {submitting ? 'Submitting...' : 'Submit Review'}
            </button>
            {success ? <p className="text-sm font-medium text-green-600">{success}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
