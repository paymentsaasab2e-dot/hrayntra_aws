import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Sparkles, Star, X } from 'lucide-react';
import type { FeedbackPayload, Interview, Recommendation } from '../../types/interview.types';

interface FeedbackModalProps {
  isOpen: boolean;
  interview: Interview | null;
  onClose: () => void;
  onSubmit: (payload: FeedbackPayload) => Promise<void>;
}

const ratingFields = [
  ['technicalSkills', 'Technical Skills'],
  ['communication', 'Communication'],
  ['problemSolving', 'Problem Solving'],
  ['cultureFit', 'Culture Fit'],
  ['experienceMatch', 'Experience Match'],
] as const;

export function FeedbackModal({ isOpen, interview, onClose, onSubmit }: FeedbackModalProps) {
  const [ratings, setRatings] = useState({
    technicalSkills: 3,
    communication: 3,
    problemSolving: 3,
    cultureFit: 3,
    experienceMatch: 3,
    overallRating: 3,
  });
  const [strengths, setStrengths] = useState('');
  const [weaknesses, setWeaknesses] = useState('');
  const [comments, setComments] = useState('');
  const [recommendation, setRecommendation] = useState<Recommendation>('Hold');
  const [salaryFit, setSalaryFit] = useState(true);
  const [availableToJoin, setAvailableToJoin] = useState('30 days');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const calculatedAverage = useMemo(() => {
    const values = Object.entries(ratings)
      .filter(([key]) => key !== 'overallRating')
      .map(([, value]) => value);
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }, [ratings]);

  React.useEffect(() => {
    setRatings((current) => ({ ...current, overallRating: calculatedAverage }));
  }, [calculatedAverage]);

  React.useEffect(() => {
    if (isOpen) {
      setStrengths('');
      setWeaknesses('');
      setComments('');
      setRecommendation('Hold');
      setSalaryFit(true);
      setAvailableToJoin('30 days');
      setAiSummary('');
      setLoadingSummary(false);
    }
  }, [isOpen]);

  const generateSummary = () => {
    setLoadingSummary(true);
    window.setTimeout(() => {
      setAiSummary(
        `${interview?.candidate.name} shows ${recommendation.toLowerCase()} potential with notable strengths in ${strengths || 'communication and problem solving'}. ${
          weaknesses ? `Key concern: ${weaknesses}. ` : ''
        }Overall interviewer signal points to a ${recommendation.toLowerCase()} recommendation.`
      );
      setLoadingSummary(false);
    }, 1500);
  };

  return (
    <AnimatePresence>
      {isOpen && interview ? (
        <div className="fixed inset-0 z-[120]">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/50" />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="absolute right-0 top-0 z-10 flex h-full w-full flex-col bg-white shadow-2xl sm:max-w-[680px]"
          >
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-[#111827]">Submit Feedback</h3>
                <p className="text-sm text-[#6B7280]">{interview.candidate.name} • {interview.job.title} • {interview.round}</p>
              </div>
              <button type="button" onClick={onClose} className="rounded-lg p-2 text-[#6B7280] hover:bg-[#F3F4F6]"><X className="size-5" /></button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                {ratingFields.map(([field, label]) => (
                  <div key={field} className="rounded-xl border border-[#E5E7EB] p-4">
                    <div className="text-sm font-semibold text-[#111827]">{label}</div>
                    <div className="mt-3 flex gap-2">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => setRatings((current) => ({ ...current, [field]: index + 1 }))}
                          className="rounded-lg p-1"
                        >
                          <Star className={`size-5 ${index < ratings[field] ? 'fill-[#F59E0B] text-[#F59E0B]' : 'text-[#D1D5DB]'}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="rounded-xl border border-[#E5E7EB] p-4">
                  <div className="text-sm font-semibold text-[#111827]">Overall Rating</div>
                  <div className="mt-2 text-3xl font-bold text-[#2563EB]">{ratings.overallRating}/5</div>
                </div>
              </div>

              <div className="grid gap-4">
                <textarea value={strengths} onChange={(event) => setStrengths(event.target.value)} rows={3} placeholder="Strengths" className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#2563EB]" />
                <textarea value={weaknesses} onChange={(event) => setWeaknesses(event.target.value)} rows={3} placeholder="Weaknesses" className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#2563EB]" />
                <textarea value={comments} onChange={(event) => setComments(event.target.value)} rows={3} placeholder="Additional comments" className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#2563EB]" />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <div className="mb-2 text-sm font-semibold text-[#111827]">Recommendation</div>
                  <div className="flex gap-2">
                    {(['Pass', 'Reject', 'Hold'] as Recommendation[]).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setRecommendation(option)}
                        className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                          recommendation === option
                            ? option === 'Pass'
                              ? 'bg-green-50 text-[#16A34A]'
                              : option === 'Reject'
                              ? 'bg-red-50 text-[#DC2626]'
                              : 'bg-orange-50 text-[#F59E0B]'
                            : 'border border-[#E5E7EB] text-[#374151]'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="flex items-center gap-2 rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm text-[#374151]">
                  <input type="checkbox" checked={salaryFit} onChange={(event) => setSalaryFit(event.target.checked)} className="size-4 rounded border-[#D1D5DB] text-[#2563EB]" />
                  Salary Fit
                </label>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#111827]">Available to Join</label>
                <select value={availableToJoin} onChange={(event) => setAvailableToJoin(event.target.value)} className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#2563EB]">
                  {['Immediate', '15 days', '30 days', '60 days', '90 days'].map((option) => <option key={option}>{option}</option>)}
                </select>
              </div>

              <div className="rounded-xl border border-[#E5E7EB] p-4">
                <button type="button" onClick={generateSummary} className="inline-flex items-center gap-2 rounded-xl border border-[#E5E7EB] px-4 py-2 text-sm font-semibold text-[#111827]">
                  <Sparkles className="size-4 text-[#2563EB]" />
                  Generate AI Summary
                </button>
                {loadingSummary ? (
                  <div className="mt-4 animate-pulse rounded-xl bg-[#F3F4F6] p-4 text-sm text-[#9CA3AF]">Generating recruiter summary...</div>
                ) : aiSummary ? (
                  <div className="mt-4 rounded-xl bg-[#EFF6FF] p-4 text-sm leading-6 text-[#1D4ED8]">{aiSummary}</div>
                ) : null}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#E5E7EB] bg-white px-6 py-4">
              <button
                type="button"
                onClick={async () => {
                  setIsSubmitting(true);
                  try {
                    await onSubmit({ ratings, strengths, weaknesses, comments, recommendation, salaryFit, availableToJoin, aiSummary, saveAsDraft: true });
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                disabled={isSubmitting}
                className="rounded-xl border border-[#E5E7EB] px-4 py-2 text-sm font-semibold text-[#111827] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Saving...' : 'Save Draft'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  setIsSubmitting(true);
                  try {
                    await onSubmit({ ratings, strengths, weaknesses, comments, recommendation, salaryFit, availableToJoin, aiSummary });
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                disabled={isSubmitting}
                className="rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
