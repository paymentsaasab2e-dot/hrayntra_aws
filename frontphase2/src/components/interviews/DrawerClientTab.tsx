'use client';

import React, { useMemo } from 'react';
import type { InterviewFeedbackEntry } from '../../types/interview.types';
import { ClientOfferLetterCard } from '../candidates/ClientOfferLetterCard';
import { useFiles } from '../../hooks/useFiles';
import { buildFileHref } from '../../utils/cloudinaryUrls';
import { ExternalLink, FileText } from 'lucide-react';

interface DrawerClientTabProps {
  candidateId: string;
  notes: string;
  feedbackEntries: InterviewFeedbackEntry[];
}

function extractClientTags(notes: string) {
  const rows = String(notes || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('[Client Tag]'));
  return rows.map((line) => line.replace('[Client Tag]', '').trim());
}

function extractClientUploads(notes: string) {
  return String(notes || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('[Client Upload]'))
    .map((line) => line.replace('[Client Upload]', '').trim());
}

export function DrawerClientTab({ candidateId, notes, feedbackEntries }: DrawerClientTabProps) {
  const clientTags = extractClientTags(notes);
  const clientUploads = extractClientUploads(notes);

  const { files: candidateFiles, loading: candidateFilesLoading } = useFiles('candidate', candidateId);

  const uploadsBase = useMemo(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';
    return apiBase.replace(/\/api\/v1\/?$/, '');
  }, []);

  const offerFromFiles = candidateFiles.find(
    (file) => String(file.fileType || '').toLowerCase() === 'offer' && file.fileUrl
  );

  const offerFromNotes = useMemo(() => {
    const offerLine = clientUploads.find((line) => /offer letter received/i.test(line));
    if (!offerLine) return null;
    const fileName = offerLine.split(':').slice(1).join(':').trim();
    if (!fileName) return null;
    const match = candidateFiles.find(
      (file) =>
        String(file.fileType || '').toLowerCase() === 'offer' &&
        String(file.fileName || '').trim() === fileName
    );
    return match || null;
  }, [clientUploads, candidateFiles]);

  const resolvedOffer = offerFromFiles || offerFromNotes;

  return (
    <div className="space-y-4">
      <ClientOfferLetterCard
        files={resolvedOffer ? [resolvedOffer] : candidateFiles}
        uploadsBase={uploadsBase}
        loading={candidateFilesLoading}
      />

      {!candidateFilesLoading && !resolvedOffer && clientUploads.some((line) => /offer letter/i.test(line)) ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Offer letter noted from client review</p>
          <p className="mt-1 text-xs text-amber-800">
            The client submitted an offer letter, but the file is not linked on this candidate yet. Check the
            Documents tab or re-upload from the client review link if needed.
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            {clientUploads
              .filter((line) => /offer letter/i.test(line))
              .map((line, index) => (
                <li key={`${line}-${index}`} className="flex items-center gap-1.5">
                  <FileText size={14} className="shrink-0" />
                  {line}
                </li>
              ))}
          </ul>
        </div>
      ) : null}

      {resolvedOffer?.fileUrl ? (
        <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Quick open</p>
          <a
            href={buildFileHref(resolvedOffer.fileUrl, uploadsBase)}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#2563EB] hover:underline"
          >
            <ExternalLink size={14} />
            {resolvedOffer.fileName || 'Offer letter'}
          </a>
        </div>
      ) : null}

      <div className="rounded-xl border border-[#E5E7EB] p-4">
        <h3 className="text-sm font-semibold text-[#111827]">Client Feedback</h3>
        {clientTags.length ? (
          <div className="mt-2 space-y-2">
            {clientTags.map((tag, index) => (
              <div
                key={`${tag}-${index}`}
                className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-sm text-[#374151]"
              >
                {tag}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-[#6B7280]">No client feedback received yet.</p>
        )}
      </div>

      {clientUploads.length > 0 ? (
        <div className="rounded-xl border border-[#E5E7EB] p-4">
          <h3 className="text-sm font-semibold text-[#111827]">Client uploads</h3>
          <div className="mt-2 space-y-2">
            {clientUploads.map((line, index) => (
              <div
                key={`${line}-${index}`}
                className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-sm text-[#374151]"
              >
                {line}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-[#E5E7EB] p-4">
        <h3 className="text-sm font-semibold text-[#111827]">Interview Feedback</h3>
        {feedbackEntries.length ? (
          <div className="mt-2 space-y-2">
            {feedbackEntries.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3">
                <p className="text-sm font-semibold text-[#111827]">{entry.interviewerName}</p>
                <p className="mt-1 text-sm text-[#4B5563]">Recommendation: {entry.recommendation}</p>
                <p className="mt-1 text-sm text-[#4B5563]">Comments: {entry.comments || '-'}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-[#6B7280]">No interview feedback available yet.</p>
        )}
      </div>
    </div>
  );
}
