import React from 'react';
import { Star } from 'lucide-react';
import type { InterviewFeedbackEntry } from '../../types/interview.types';

interface DrawerFeedbackTabProps {
  feedbackEntries: InterviewFeedbackEntry[];
  onOpenFeedback: () => void;
}

const metricLabels: Array<keyof InterviewFeedbackEntry['ratings']> = [
  'technicalSkills',
  'communication',
  'problemSolving',
  'cultureFit',
  'experienceMatch',
  'overallRating',
];

export function DrawerFeedbackTab({ feedbackEntries, onOpenFeedback }: DrawerFeedbackTabProps) {
  if (!feedbackEntries.length) {
    return (
      <div className="rounded-xl border border-dashed border-[#D1D5DB] bg-[#F9FAFB] p-8 text-center">
        <div className="text-lg font-semibold text-[#111827]">No feedback submitted yet</div>
        <p className="mt-2 text-sm text-[#6B7280]">Collect interviewer ratings, comments, and recommendations here.</p>
        <button
          type="button"
          onClick={onOpenFeedback}
          className="mt-4 rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white"
        >
          Submit Feedback
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {feedbackEntries.map((entry) => (
        <div key={entry.id} className="rounded-xl border border-[#E5E7EB] p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-[#111827]">{entry.interviewerName}</div>
              <div className="text-xs text-[#6B7280]">{entry.submittedAt}</div>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                entry.recommendation === 'Pass'
                  ? 'bg-green-50 text-[#16A34A]'
                  : entry.recommendation === 'Reject'
                  ? 'bg-red-50 text-[#DC2626]'
                  : 'bg-orange-50 text-[#F59E0B]'
              }`}
            >
              {entry.recommendation}
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {metricLabels.map((metric) => (
              <div key={metric} className="rounded-xl bg-[#F9FAFB] p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6B7280]">
                  {metric.replace(/([A-Z])/g, ' $1')}
                </div>
                <div className="mt-2 flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star
                      key={index}
                      className={`size-4 ${index < entry.ratings[metric] ? 'fill-[#F59E0B] text-[#F59E0B]' : 'text-[#D1D5DB]'}`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3">
            <div className="rounded-xl bg-[#F9FAFB] p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6B7280]">Strengths</div>
              <p className="mt-2 text-sm text-[#374151]">{entry.strengths}</p>
            </div>
            <div className="rounded-xl bg-[#F9FAFB] p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6B7280]">Weaknesses</div>
              <p className="mt-2 text-sm text-[#374151]">{entry.weaknesses}</p>
            </div>
            <div className="rounded-xl bg-[#F9FAFB] p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6B7280]">Comments</div>
              <p className="mt-2 text-sm text-[#374151]">{entry.comments}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
