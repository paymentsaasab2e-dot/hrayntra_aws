import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { MatchCandidate, MatchJob } from './types';

interface RecruiterOption {
  id: string;
  name: string;
}

interface PipelineModalProps {
  isOpen: boolean;
  candidate: MatchCandidate | null;
  jobs: MatchJob[];
  recruiters: RecruiterOption[];
  onClose: () => void;
  onSubmit: (payload: {
    jobId: string;
    stage: string;
    recruiterId: string;
    notes: string;
  }) => Promise<void>;
}

const STAGES = ['Applied', 'Screening', 'Shortlist', 'Interview', 'Offer', 'Hired'];

export default function PipelineModal({
  isOpen,
  candidate,
  jobs,
  recruiters,
  onClose,
  onSubmit,
}: PipelineModalProps) {
  const [jobId, setJobId] = useState('');
  const [stage, setStage] = useState('Applied');
  const [recruiterId, setRecruiterId] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setJobId(jobs[0]?.id || '');
    setStage('Applied');
    setRecruiterId(recruiters[0]?.id || '');
    setNotes('');
  }, [isOpen, jobs, recruiters]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-slate-900/40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="fixed right-0 top-0 z-[100] flex h-full w-full flex-col bg-white shadow-2xl sm:max-w-[520px]"
          >
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Add Candidate to Pipeline</h3>
                <p className="mt-1 text-sm text-[#6B7280]">{candidate?.name}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">Select Job</label>
                <select
                  value={jobId}
                  onChange={(event) => setJobId(event.target.value)}
                  className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#2563EB]"
                >
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title} • {job.client}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-700">Select Stage</label>
                <div className="flex flex-wrap gap-2">
                  {STAGES.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setStage(item)}
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                        stage === item
                          ? 'border-[#2563EB] bg-blue-50 text-[#2563EB]'
                          : 'border-[#E5E7EB] bg-white text-slate-600'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">Assign Recruiter</label>
                <select
                  value={recruiterId}
                  onChange={(event) => setRecruiterId(event.target.value)}
                  className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#2563EB]"
                >
                  {recruiters.map((recruiter) => (
                    <option key={recruiter.id} value={recruiter.id}>
                      {recruiter.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">Notes</label>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#2563EB]"
                  placeholder="Add context for the recruiter or pipeline move..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#E5E7EB] bg-white px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setIsSubmitting(true);
                  try {
                    await onSubmit({ jobId, stage, recruiterId, notes });
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                disabled={isSubmitting}
                className="rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Adding...' : 'Add'}
              </button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
