import React from 'react';
import type { InterviewFeedbackEntry } from '../../types/interview.types';

interface DrawerClientTabProps {
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

export function DrawerClientTab({ notes, feedbackEntries }: DrawerClientTabProps) {
  const clientTags = extractClientTags(notes);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#E5E7EB] p-4">
        <h3 className="text-sm font-semibold text-[#111827]">Client Feedback</h3>
        {clientTags.length ? (
          <div className="mt-2 space-y-2">
            {clientTags.map((tag, index) => (
              <div key={`${tag}-${index}`} className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-sm text-[#374151]">
                {tag}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-[#6B7280]">No client feedback received yet.</p>
        )}
      </div>

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
