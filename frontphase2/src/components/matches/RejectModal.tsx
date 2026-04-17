import React, { useState } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { MatchCandidate } from './types';

interface RejectModalProps {
  isOpen: boolean;
  candidate: MatchCandidate | null;
  onClose: () => void;
  onReject: (payload: { reason: string; notes: string }) => Promise<void>;
}

const REASONS = [
  'Skill mismatch',
  'Salary expectation',
  'Experience mismatch',
  'Client requirement mismatch',
  'Other',
];

export default function RejectModal({ isOpen, candidate, onClose, onReject }: RejectModalProps) {
  const [reason, setReason] = useState(REASONS[0]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed left-1/2 top-1/2 z-[100] w-[95vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Reject Candidate Match</h3>
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

            <div className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">Reason</label>
                <select
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#2563EB]"
                >
                  {REASONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">Notes</label>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={5}
                  className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#2563EB]"
                  placeholder="Add rejection context..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#E5E7EB] px-6 py-4">
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
                    await onReject({ reason, notes });
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                disabled={isSubmitting}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
