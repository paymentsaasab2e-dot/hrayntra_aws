'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Columns2, Loader2 } from 'lucide-react';
import { ClientReviewBatchTable } from '../../../components/candidates/ClientReviewBatchTable';
import { ClientReviewCandidateDrawer } from '../../../components/candidates/ClientReviewCandidateDrawer';
import { ClientReviewComparativeAnalysisDrawer } from '../../../components/candidates/ClientReviewComparativeAnalysisDrawer';
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
  const [compareOpen, setCompareOpen] = useState(false);
  const [reviewedMatchIds, setReviewedMatchIds] = useState<string[]>([]);
  const [stageByMatchId, setStageByMatchId] = useState<Record<string, string>>({});

  const apiBase = useMemo(() => resolveApiBase(), []);

  const tableRows = useMemo<ClientReviewBatchRow[]>(() => {
    const fromBatch = reviewData?.batchCandidates ?? [];
    if (fromBatch.length) {
      return fromBatch.map((row) => ({
        ...row,
        clientMarkedStage:
          stageByMatchId[row.matchId] ||
          row.clientMarkedStage ||
          row.detail?.clientMarkedStage ||
          null,
      }));
    }
    if (!reviewData) return [];
    const matchId = String(reviewData.matchId || reviewData.interviewId || 'candidate');
    return [
      {
        matchId,
        candidateName: reviewData.candidate?.name || 'Candidate',
        designation: reviewData.candidate?.designation,
        experience: reviewData.candidate?.experience ?? null,
        jobTitle: reviewData.job?.title,
        matchScore: reviewData.matchScore ?? null,
        clientMarkedStage:
          stageByMatchId[matchId] || reviewData.clientMarkedStage || null,
        detail: reviewData,
      },
    ];
  }, [reviewData, stageByMatchId]);

  const submissionType = String(reviewData?.submissionType || 'GENERAL').toUpperCase();
  const purpose = PURPOSE_COPY[submissionType] || PURPOSE_COPY.GENERAL;
  const canCompare = tableRows.length >= 1;

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
        const masked = maskClientReviewStorageUrls(data, token);
        setReviewData(masked);
        const initialStages: Record<string, string> = {};
        const seedStage = (matchId: string, stage?: string | null) => {
          const id = String(matchId || '').trim();
          const label = String(stage || '').trim();
          if (id && label) initialStages[id] = label;
        };
        if (Array.isArray(masked.batchCandidates)) {
          for (const row of masked.batchCandidates) {
            seedStage(
              row.matchId,
              row.clientMarkedStage || row.detail?.clientMarkedStage,
            );
          }
        }
        seedStage(
          String(masked.matchId || masked.interviewId || ''),
          masked.clientMarkedStage,
        );
        if (Object.keys(initialStages).length) {
          setStageByMatchId((prev) => ({ ...initialStages, ...prev }));
        }
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

  const handleDrawerSubmitted = (matchId: string, _message?: string, stage?: string | null) => {
    setReviewedMatchIds((current) =>
      current.includes(matchId) ? current : [...current, matchId],
    );
    const label = String(stage || '').trim();
    if (label) {
      setStageByMatchId((current) => ({ ...current, [matchId]: label }));
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F4F6FB]">
      <header className="shrink-0 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="flex w-full items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/hryantra-logo.png"
              alt="HRyantra"
              className="h-9 w-auto max-w-[150px] object-contain object-left"
              width={150}
              height={36}
              decoding="async"
              onError={(e) => {
                const el = e.currentTarget;
                if (el.dataset.fallback === '1') return;
                el.dataset.fallback = '1';
                el.src = '/saasa-logo.png';
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            {reviewData?.client?.companyName ? (
              <span className="hidden rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 sm:inline-flex">
                {reviewData.client.companyName}
              </span>
            ) : null}
            {reviewData && canCompare ? (
              <button
                type="button"
                onClick={() => setCompareOpen(true)}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 sm:text-sm"
              >
                <Columns2 className="h-4 w-4" />
                Comparative Analysis
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="shrink-0 border-b border-slate-800 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-4 py-5 text-white sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
              Client preview
            </p>
            <h1 className="mt-1.5 text-xl font-semibold tracking-tight sm:text-2xl">
              {purpose.title}
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-white/70">{purpose.body}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {reviewData?.job?.title ? (
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/15">
                  {reviewData.job.title}
                </span>
              ) : null}
              {tableRows.length ? (
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/15">
                  {tableRows.length} candidate{tableRows.length === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>
          </div>
          {reviewData && canCompare ? (
            <button
              type="button"
              onClick={() => setCompareOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              <Columns2 className="h-4 w-4 text-indigo-600" />
              Compare side by side
            </button>
          ) : null}
        </div>
      </div>

      <main className="flex min-h-0 flex-1 flex-col bg-white">
        {loading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-20 text-sm text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            Loading review details…
          </div>
        ) : null}
        {error ? (
          <p className="m-4 border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 sm:mx-6 lg:mx-8">
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
              stageByMatchId={stageByMatchId}
              onView={(row) => setDrawerRow(row)}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3.5 sm:px-6 lg:px-8">
              {reviewedMatchIds.length > 0 ? (
                <p className="text-sm font-medium text-emerald-600">
                  {reviewedMatchIds.length} of {tableRows.length} candidate
                  {tableRows.length === 1 ? '' : 's'} reviewed.
                </p>
              ) : (
                <p className="text-sm text-slate-500">
                  Click a row or View to open the profile, or use Comparative Analysis for a
                  side-by-side view.
                </p>
              )}
              {canCompare ? (
                <button
                  type="button"
                  onClick={() => setCompareOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 sm:text-sm"
                >
                  <Columns2 className="h-4 w-4" />
                  Comparative Analysis
                </button>
              ) : null}
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

      <ClientReviewComparativeAnalysisDrawer
        open={compareOpen}
        rows={tableRows}
        jobTitle={reviewData?.job?.title}
        clientName={reviewData?.client?.companyName}
        onClose={() => setCompareOpen(false)}
      />
    </div>
  );
}
