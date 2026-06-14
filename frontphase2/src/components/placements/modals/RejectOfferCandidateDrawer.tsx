'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import type { Placement } from '../../../types/placement';

interface RejectOfferCandidateDrawerProps {
  isOpen: boolean;
  placement: Placement | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (payload: { reason: string; feedback: string }) => Promise<void>;
}

export function RejectOfferCandidateDrawer({
  isOpen,
  placement,
  isSubmitting,
  onClose,
  onSubmit,
}: RejectOfferCandidateDrawerProps) {
  const [reason, setReason] = useState('Offer declined by recruiter');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReason('Offer declined by recruiter');
      setFeedback('');
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && placement ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-slate-900/40"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="fixed right-0 top-0 z-[100] flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-[#111827]">Reject candidate</h3>
                <p className="text-sm text-[#6B7280]">
                  {placement.candidate.firstName} {placement.candidate.lastName} · {placement.job.title}
                </p>
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
                <label className="mb-1.5 block text-sm font-medium text-[#111827]">Reason</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm"
                  placeholder="Reason for rejection"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#111827]">
                  Rejection notes <span className="text-red-600">*</span>
                </label>
                <textarea
                  value={feedback}
                  onChange={(event) => setFeedback(event.target.value)}
                  rows={5}
                  maxLength={2000}
                  placeholder="Share why this candidate is being rejected after declining the offer..."
                  className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm"
                />
                <p className="mt-1 text-xs text-[#6B7280]">{feedback.trim().length}/2000</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-[#E5E7EB] px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-xl border border-[#E5E7EB] px-4 py-2.5 text-sm font-semibold text-[#111827] hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting || !feedback.trim()}
                onClick={() => void onSubmit({ reason: reason.trim(), feedback: feedback.trim() })}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {isSubmitting ? 'Rejecting…' : 'Reject candidate'}
              </button>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
