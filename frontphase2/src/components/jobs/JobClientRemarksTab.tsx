'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'motion/react';
import { ExternalLink, Eye, FileText, Loader2, MessageSquare, X } from 'lucide-react';
import { ImageWithFallback, initialsFromDisplayName } from '../ImageWithFallback';
import { DetailsModalShell } from '../drawers/DetailsModalShell';
import { formatDateTimeDMY } from '../../utils/dateDisplay';
import { buildFileHref } from '../../utils/cloudinaryUrls';
import type { JobClientRemark, JobClientRemarkCandidate } from '../../lib/api';

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

function latestRemark(row: JobClientRemarkCandidate): JobClientRemark | null {
  return row.remarks[0] || null;
}

function commentCount(row: JobClientRemarkCandidate): number {
  return row.remarks.filter((remark) => String(remark.comments || '').trim()).length;
}

function documentCount(row: JobClientRemarkCandidate): number {
  return row.remarks.filter((remark) => Boolean(remark.documentFileName || remark.documentUrl)).length;
}

function CandidateReplyDetail({
  remark,
  uploadsBase,
}: {
  remark: JobClientRemark;
  uploadsBase: string;
}) {
  const documentUrl = resolveClientReviewDocumentUrl(remark.documentUrl, uploadsBase);
  const hasDocument = Boolean(remark.documentFileName || documentUrl);
  const isOfferFlow = String(remark.submissionType || '').toUpperCase() === 'OFFER_CONFIRMATION';
  const comments = String(remark.comments || '').trim();

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-500">
          {remark.clientName || 'Client'}
          {remark.repliedAt ? ` · ${formatDateTimeDMY(remark.repliedAt)}` : ''}
        </p>
        {remark.tag ? (
          <span className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 ring-1 ring-indigo-100">
            {remark.tag}
          </span>
        ) : null}
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          {isOfferFlow ? 'Decision' : 'Tag'}
        </p>
        <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
          {remark.tag || '—'}
        </p>
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Comments</p>
        <p className="mt-1 min-h-[4.5rem] whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {comments || 'No comments from the client.'}
        </p>
      </div>

      {hasDocument ? (
        <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <FileText className="mt-0.5 size-4 shrink-0 text-slate-500" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900">
              {remark.documentLabel || (isOfferFlow ? 'Offer letter received' : 'Document received')}
            </p>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {remark.documentFileName || 'Uploaded document'}
            </p>
            {documentUrl ? (
              <a
                href={documentUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-indigo-700 hover:underline"
              >
                <ExternalLink className="size-3.5" />
                Open document
              </a>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
          No document uploaded.
        </p>
      )}
    </div>
  );
}

export function JobClientRemarksTab({
  loading,
  error,
  clientName,
  candidates,
  onViewCandidate,
}: {
  loading: boolean;
  error?: string | null;
  clientName?: string | null;
  candidates: JobClientRemarkCandidate[];
  onViewCandidate?: (candidateId: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const uploadsBase = useMemo(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';
    return apiBase.replace(/\/api\/v1\/?$/, '');
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  const selected = candidates.find((row) => row.candidateId === selectedId) || null;

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500">
        <Loader2 size={18} className="animate-spin text-indigo-500" />
        Loading client remarks…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {error}
      </div>
    );
  }

  if (!candidates.length) {
    return (
      <div className="p-8 text-center">
        <MessageSquare size={32} className="mx-auto mb-3 text-slate-300" />
        <p className="text-sm font-medium text-slate-700">No submitted candidates yet</p>
        <p className="mt-1 text-xs text-slate-500">
          When you submit a candidate to {clientName || 'the client'}, their name will appear here.
          Click a row to see comments or uploaded documents.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="max-h-[22rem] overflow-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="sticky top-0 bg-slate-50">
              <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-3 py-2.5">#</th>
                <th className="px-3 py-2.5">Candidate</th>
                <th className="px-3 py-2.5">Tag</th>
                <th className="px-3 py-2.5">Comments</th>
                <th className="px-3 py-2.5">Documents</th>
                <th className="px-3 py-2.5">Updated</th>
                <th className="px-3 py-2.5 text-right"> </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {candidates.map((row, index) => {
                const latest = latestRemark(row);
                const comments = commentCount(row);
                const documents = documentCount(row);
                return (
                  <tr
                    key={row.candidateId}
                    className="cursor-pointer transition hover:bg-indigo-50/50"
                    onClick={() => setSelectedId(row.candidateId)}
                  >
                    <td className="px-3 py-3 text-slate-400">{index + 1}</td>
                    <td className="px-3 py-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <ImageWithFallback
                          src={row.avatar || ''}
                          alt={row.candidateName}
                          fallbackInitials={initialsFromDisplayName(row.candidateName)}
                          className="h-8 w-8 rounded-full object-cover ring-2 ring-white shadow-sm"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{row.candidateName}</p>
                          <p className="truncate text-xs text-slate-500">{row.email || 'No email'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {latest?.tag ? (
                        <span className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 ring-1 ring-indigo-100">
                          {latest.tag}
                        </span>
                      ) : (
                        <span className="text-slate-400">Waiting</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-600">{comments || '—'}</td>
                    <td className="px-3 py-3 text-slate-600">{documents || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">
                      {latest?.repliedAt
                        ? formatDateTimeDMY(latest.repliedAt)
                        : row.submittedAt
                          ? formatDateTimeDMY(row.submittedAt)
                          : '—'}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">
                        <Eye size={13} />
                        Open
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Click a candidate to open their client comments and uploaded documents.
      </p>

      {mounted
        ? createPortal(
            <AnimatePresence>
              {selected ? (
                <DetailsModalShell
                  key={selected.candidateId}
                  size="md"
                  zIndexClass="z-[160]"
                  panelClassName="!h-auto max-h-[min(88vh,760px)]"
                  onBackdropClick={() => setSelectedId(null)}
                  dialogTitleId="job-client-candidate-remarks-title"
                >
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <div className="flex items-start justify-between gap-3 border-b border-indigo-100 px-5 py-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <ImageWithFallback
                          src={selected.avatar || ''}
                          alt={selected.candidateName}
                          fallbackInitials={initialsFromDisplayName(selected.candidateName)}
                          className="h-11 w-11 rounded-full object-cover ring-2 ring-white shadow-sm"
                        />
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-600">
                            Client reply
                          </p>
                          <h2
                            id="job-client-candidate-remarks-title"
                            className="mt-1 truncate text-lg font-bold text-slate-900"
                          >
                            {selected.candidateName}
                          </h2>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {selected.email || 'No email'}
                            {clientName ? ` · ${clientName}` : ''}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedId(null)}
                        className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Close"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
                      {selected.remarks.length ? (
                        selected.remarks.map((remark) => (
                          <CandidateReplyDetail
                            key={remark.id}
                            remark={remark}
                            uploadsBase={uploadsBase}
                          />
                        ))
                      ) : (
                        <p className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 px-4 py-6 text-sm text-slate-600">
                          Submitted to {clientName || 'the client'}. Waiting for their tag, comments,
                          or uploaded document.
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
                      {onViewCandidate ? (
                        <button
                          type="button"
                          onClick={() => onViewCandidate(selected.candidateId)}
                          className="rounded-xl px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
                        >
                          View profile
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setSelectedId(null)}
                        className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </DetailsModalShell>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </div>
  );
}
