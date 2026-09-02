'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, FileText, Loader2 } from 'lucide-react';
import { apiGetInterviewClientReviewContext } from '../../lib/api';
import { extractApiData } from '../../lib/mapCandidateProfile';
import {
  PURPOSE_COPY,
  type ClientReviewResponse,
  type InterviewClientReviewContext,
} from '../../lib/clientReviewTypes';
import { buildFileHref } from '../../utils/cloudinaryUrls';
import { startAsyncLoad } from '../../lib/asyncLoadGuard';

interface DrawerClientTabProps {
  interviewId: string;
}

function resolveClientReviewDocumentUrl(raw?: string | null, uploadsBase = ''): string {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (value.startsWith('http')) {
    const backendOrigin =
      uploadsBase ||
      (process.env.NEXT_PUBLIC_BACKEND_ORIGIN || 'https://api2.hryantra.com');
    return value.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i, backendOrigin);
  }
  if (value.startsWith('/uploads/interview-client-review/')) {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';
    const origin = apiBase.replace(/\/api\/v1\/?$/, '');
    return `${origin}/api/v1/public/uploads/${value.replace(/^\/uploads\//, '')}`;
  }
  return buildFileHref(value, uploadsBase);
}

function ClientResponseCard({
  response,
  uploadsBase,
  isOfferFlow,
}: {
  response: ClientReviewResponse;
  uploadsBase: string;
  isOfferFlow: boolean;
}) {
  const documentUrl = resolveClientReviewDocumentUrl(response.documentUrl, uploadsBase);
  const hasDocument = Boolean(response.documentFileName || documentUrl);

  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 space-y-4">
      <div
        className={`rounded-xl border p-4 ${
          isOfferFlow ? 'border-amber-200 bg-amber-50' : 'border-[#E5E7EB] bg-[#F9FAFB]'
        }`}
      >
        <h3 className="text-sm font-semibold text-[#111827]">
          {isOfferFlow ? 'Offer Letter' : 'Attach Document (optional)'}
        </h3>
        <p className="mt-1 text-xs text-[#6B7280]">
          {isOfferFlow
            ? 'Signed offer letter attached by the client (PDF, max 4 MB).'
            : 'Supporting document attached by the client (PDF, max 4 MB).'}
        </p>
        {hasDocument ? (
          <div className="mt-3 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2">
            <div className="flex items-start gap-2">
              <FileText className="mt-0.5 size-4 shrink-0 text-[#6B7280]" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#111827]">
                  {response.documentLabel || 'Document received'}
                </p>
                <p className="mt-0.5 truncate text-xs text-[#6B7280]">
                  {response.documentFileName || 'Uploaded document'}
                </p>
                {documentUrl ? (
                  <a
                    href={documentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[#2563EB] hover:underline"
                  >
                    <ExternalLink className="size-3.5" />
                    Open document
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-[#6B7280]">No file attached.</p>
        )}
      </div>

      <label className="block text-sm font-semibold text-[#111827]">
        {isOfferFlow ? 'Decision' : 'Select Tag'}
        <div className="mt-1 rounded-lg border border-[#D1D5DB] bg-[#F9FAFB] px-3 py-2 text-sm text-[#111827]">
          {response.tag || '—'}
        </div>
      </label>

      <label className="block text-sm font-semibold text-[#111827]">
        Comments
        <div className="mt-1 min-h-[5rem] whitespace-pre-wrap rounded-lg border border-[#D1D5DB] bg-[#F9FAFB] px-3 py-2 text-sm text-[#374151]">
          {response.comments || '—'}
        </div>
      </label>
    </div>
  );
}

export function DrawerClientTab({ interviewId }: DrawerClientTabProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [context, setContext] = useState<InterviewClientReviewContext | null>(null);

  const uploadsBase = useMemo(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';
    return apiBase.replace(/\/api\/v1\/?$/, '');
  }, []);

  useEffect(() => {
    if (!interviewId) {
      setLoading(false);
      setContext(null);
      return;
    }
    const load = startAsyncLoad(setLoading);
    setError('');
    void (async () => {
      try {
        const raw = await apiGetInterviewClientReviewContext(interviewId);
        if (!load.isActive()) return;
        const data = extractApiData<InterviewClientReviewContext>(raw);
        setContext(data);
      } catch (err: unknown) {
        if (!load.isActive()) return;
        setError(err instanceof Error ? err.message : 'Unable to load client review details');
        setContext(null);
      } finally {
        load.finish();
      }
    })();
    return () => {
      load.abort();
    };
  }, [interviewId]);

  const submissionType = String(context?.submissionType || 'GENERAL').toUpperCase();
  const purpose = PURPOSE_COPY[submissionType] || PURPOSE_COPY.GENERAL;
  const isOfferFlow = submissionType === 'OFFER_CONFIRMATION';
  const clientResponses = context?.clientResponses ?? [];

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-sm text-[#4B5563]">
        <Loader2 className="size-4 animate-spin" />
        Loading client review details...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!context) {
    return (
      <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-sm text-[#6B7280]">
        Client review details are not available for this interview.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-[#EFF6FF] px-4 py-3 text-[#1E3A8A]">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#1E40AF]">{purpose.title}</p>
        <p className="mt-1 text-sm text-[#1E3A8A]">{purpose.body}</p>
      </div>

      {clientResponses.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[#111827]">Client Response</h3>
          {clientResponses.length > 1 ? (
            <p className="text-xs text-[#6B7280]">
              {clientResponses.length} responses received from the client review link.
            </p>
          ) : null}
          {clientResponses.map((response, index) => (
            <ClientResponseCard
              key={`client-response-${index}`}
              response={response}
              uploadsBase={uploadsBase}
              isOfferFlow={isOfferFlow}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
          <h3 className="text-sm font-semibold text-[#111827]">Client Response</h3>
          <p className="mt-2 text-sm text-[#6B7280]">
            No response from the client yet. Once they submit on the review link (tag, comments, or
            document), it will appear here.
          </p>
        </div>
      )}

      {(context.interviewFeedback || []).length > 0 ? (
        <div className="rounded-xl border border-[#E5E7EB] p-4">
          <h3 className="text-sm font-semibold text-[#111827]">Interview Feedback</h3>
          <div className="mt-2 space-y-2">
            {(context.interviewFeedback || []).map((entry) => (
              <div key={entry.id} className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3">
                <p className="text-sm font-semibold text-[#111827]">{entry.interviewerName}</p>
                <p className="mt-1 text-sm text-[#4B5563]">Recommendation: {entry.recommendation || '-'}</p>
                <p className="mt-1 text-sm text-[#4B5563]">Comments: {entry.comments || '-'}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
