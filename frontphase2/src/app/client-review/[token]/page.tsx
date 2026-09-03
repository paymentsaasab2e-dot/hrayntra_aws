'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ClientReviewBatchTable } from '../../../components/candidates/ClientReviewBatchTable';
import { ClientReviewCandidateDrawer } from '../../../components/candidates/ClientReviewCandidateDrawer';
import {
  PURPOSE_COPY,
  type ClientReviewBatchRow,
  type ClientReviewData,
} from '../../../lib/clientReviewTypes';
import { getApiErrorMessage, readApiJson } from '../../../lib/apiNetworkErrors';

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
        setReviewData(data);
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#eef2ff_0,_#f8fafc_42%,_#f5f3ff_100%)]">
      <header className="border-b border-indigo-100/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-sm font-bold text-white shadow-sm">
              H
            </span>
            <div>
              <p className="text-sm font-semibold tracking-wide text-slate-900">HRYANTRA</p>
              <p className="text-xs text-slate-500">Secure client review</p>
            </div>
          </div>
          {reviewData?.client?.companyName ? (
            <span className="hidden rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-800 sm:inline-flex">
              {reviewData.client.companyName}
            </span>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="overflow-hidden rounded-[28px] border border-white/80 bg-white/90 shadow-[0_24px_80px_-40px_rgba(79,70,229,0.45)]">
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-6 py-7 text-white sm:px-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
              {purpose.title}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              {tableRows.length > 1 ? 'Submitted candidates' : 'Candidate review'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/85">{purpose.body}</p>
            {reviewData?.job?.title ? (
              <p className="mt-4 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white">
                Role: {reviewData.job.title}
              </p>
            ) : null}
          </div>

          <div className="px-5 py-6 sm:px-8 sm:py-8">
            {loading ? (
              <div className="rounded-2xl border border-dashed border-indigo-100 bg-indigo-50/40 px-5 py-10 text-center text-sm text-slate-500">
                Loading review details...
              </div>
            ) : null}
            {error ? (
              <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                {error}
              </p>
            ) : null}

            {reviewData ? (
              <div className="space-y-4">
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
                {reviewedMatchIds.length > 0 ? (
                  <p className="text-sm font-medium text-emerald-600">
                    {reviewedMatchIds.length} of {tableRows.length} candidate
                    {tableRows.length === 1 ? '' : 's'} reviewed.
                  </p>
                ) : (
                  <p className="text-sm text-slate-500">
                    Click a candidate row or View to open the profile and submit your decision.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </div>
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
