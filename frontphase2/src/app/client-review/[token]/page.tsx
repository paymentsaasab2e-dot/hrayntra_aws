'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ClientReviewBatchTable } from '../../../components/candidates/ClientReviewBatchTable';
import { ClientReviewCandidateDrawer } from '../../../components/candidates/ClientReviewCandidateDrawer';
import { PURPOSE_COPY, type ClientReviewBatchRow, type ClientReviewData } from '../../../lib/clientReviewTypes';
import { getApiErrorMessage, readApiJson } from '../../../lib/apiNetworkErrors';
import { maskClientReviewStorageUrls } from '../../../lib/clientReviewAssets';

const LOCAL_API_BASE = 'http://127.0.0.1:5001/api/v1';
const PROD_PROXY_BASE = '/api/proxy';

const isLocalHost = () => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
};

const resolveApiBase = () => {
  if (typeof window === 'undefined') return PROD_PROXY_BASE;
  return isLocalHost() ? LOCAL_API_BASE : PROD_PROXY_BASE;
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
  const [error, setError] = useState('');
  const [reviewData, setReviewData] = useState<ClientReviewData | null>(null);
  const [drawerRow, setDrawerRow] = useState<ClientReviewBatchRow | null>(null);
  const [reviewedMatchIds, setReviewedMatchIds] = useState<string[]>([]);

  const apiBase = useMemo(() => resolveApiBase(), []);

  const tableRows = useMemo<ClientReviewBatchRow[]>(() => {
    const fromBatch = reviewData?.batchCandidates ?? [];
    if (fromBatch.length) return fromBatch;
    if (!reviewData) return [];
    return [
      {
        matchId: String(reviewData.matchId || reviewData.interviewId || 'candidate'),
        candidateName: reviewData.candidate?.name || 'Candidate',
        designation: reviewData.candidate?.designation,
        experience: reviewData.candidate?.experience ?? null,
        jobTitle: reviewData.job?.title,
        matchScore: reviewData.matchScore ?? null,
        detail: reviewData,
      },
    ];
  }, [reviewData]);

  const submissionType = String(reviewData?.submissionType || 'GENERAL').toUpperCase();
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
        setReviewData(maskClientReviewStorageUrls(data, token));
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

  const handleDrawerSubmitted = (matchId: string) => {
    setReviewedMatchIds((current) =>
      current.includes(matchId) ? current : [...current, matchId],
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="flex w-full items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/hryantra-logo.png"
              alt="HRyantra"
              className="h-10 w-auto max-w-[168px] object-contain object-left"
              width={168}
              height={40}
              decoding="async"
              onError={(e) => {
                const el = e.currentTarget;
                if (el.dataset.fallback === '1') return;
                el.dataset.fallback = '1';
                el.src = '/saasa-logo.png';
              }}
            />
          </div>
          {reviewData?.client?.companyName ? (
            <span className="hidden rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-800 sm:inline-flex">
              {reviewData.client.companyName}
            </span>
          ) : null}
        </div>
      </header>

      <div className="shrink-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-4 py-3.5 text-white sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-base font-semibold tracking-tight sm:text-lg">
            {purpose.title}
          </h1>
          {reviewData?.job?.title ? (
            <span className="max-w-[16rem] truncate rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-medium text-white/90">
              {reviewData.job.title}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs leading-5 text-white/80 sm:text-sm">{purpose.body}</p>
      </div>

      <main className="flex min-h-0 flex-1 flex-col bg-white">
        {loading ? (
          <div className="flex flex-1 items-center justify-center px-4 py-16 text-sm text-slate-500">
            Loading review details...
          </div>
        ) : null}
        {error ? (
          <p className="m-4 border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 sm:m-6 lg:mx-8">
            {error}
          </p>
        ) : null}

        {reviewData ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <ClientReviewBatchTable
              rows={tableRows.map((row) => ({
                ...row,
                candidateName:
                  reviewedMatchIds.includes(row.matchId) && row.candidateName
                    ? `${row.candidateName} ✓`
                    : row.candidateName,
              }))}
              onView={(row) => setDrawerRow(row)}
            />
            <div className="border-t border-slate-100 px-4 py-3 sm:px-6 lg:px-8">
              {reviewedMatchIds.length > 0 ? (
                <p className="text-sm font-medium text-emerald-600">
                  {reviewedMatchIds.length} of {tableRows.length} candidate
                  {tableRows.length === 1 ? '' : 's'} reviewed.
                </p>
              ) : (
                <p className="text-sm text-slate-500">
                  Click a candidate row or View to open the profile, or use CV to open the resume
                  directly.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </main>

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
