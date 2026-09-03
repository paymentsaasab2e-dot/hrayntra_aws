'use client';

import { Building2, ExternalLink, FileText } from 'lucide-react';
import { buildFileHref } from '../../utils/cloudinaryUrls';
import { formatDateTimeDMY } from '../../utils/dateDisplay';
import { DrawerSectionCard } from './drawerFormUi';
import type {
  CandidateClientReply,
  CandidateClientSubmission,
} from './candidateProfileDrawerData';

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

export function CandidateClientRepliesTab({
  replies,
  submissions = [],
  fallbackClientName,
  uploadsBase,
}: {
  replies: CandidateClientReply[];
  submissions?: CandidateClientSubmission[];
  fallbackClientName?: string | null;
  uploadsBase: string;
}) {
  if (replies.length) {
    return (
      <div className="space-y-4">
        {replies.map((reply) => {
          const documentUrl = resolveClientReviewDocumentUrl(reply.documentUrl, uploadsBase);
          const hasDocument = Boolean(reply.documentFileName || documentUrl);
          const isOfferFlow = String(reply.submissionType || '').toUpperCase() === 'OFFER_CONFIRMATION';

          return (
            <DrawerSectionCard
              key={reply.id}
              title={reply.clientName || 'Client'}
              subtitle={[reply.jobTitle, reply.repliedAt ? formatDateTimeDMY(reply.repliedAt) : null]
                .filter(Boolean)
                .join(' · ')}
              icon={Building2}
              accent="violet"
            >
              <div className="space-y-4">
                <label className="block text-sm font-semibold text-slate-900">
                  {isOfferFlow ? 'Decision' : 'Tag'}
                  <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
                    {reply.tag || '—'}
                  </div>
                </label>

                <label className="block text-sm font-semibold text-slate-900">
                  Comments
                  <div className="mt-1 min-h-[5rem] whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {reply.comments || '—'}
                  </div>
                </label>

                {hasDocument ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-start gap-2">
                      <FileText className="mt-0.5 size-4 shrink-0 text-slate-500" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">
                          {reply.documentLabel || (isOfferFlow ? 'Offer letter received' : 'Document received')}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {reply.documentFileName || 'Uploaded document'}
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
                  </div>
                ) : null}
              </div>
            </DrawerSectionCard>
          );
        })}
      </div>
    );
  }

  const waitingCards =
    submissions.length > 0
      ? submissions
      : [
          {
            id: 'waiting-client',
            clientName: fallbackClientName || 'Client',
            jobTitle: null,
            submittedAt: null,
          },
        ];

  return (
    <div className="space-y-4">
      {waitingCards.map((row) => (
        <DrawerSectionCard
          key={row.id}
          title={row.clientName || 'Client'}
          subtitle={[row.jobTitle, row.submittedAt ? `Sent ${formatDateTimeDMY(row.submittedAt)}` : null]
            .filter(Boolean)
            .join(' · ')}
          icon={Building2}
          accent="violet"
        >
          <p className="text-sm text-slate-600">
            Waiting for {row.clientName || 'the client'} to reply on the review page. Their tag,
            comments, and any uploaded document will appear here.
          </p>
        </DrawerSectionCard>
      ))}
    </div>
  );
}
