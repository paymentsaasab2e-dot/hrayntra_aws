import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { MatchCandidate } from './types';

interface DuplicateAlertProps {
  isOpen: boolean;
  candidate: MatchCandidate | null;
  previousSubmission: { date: string; status: string } | null;
  onClose: () => void;
  onViewHistory: () => void;
  onSubmitAnyway: () => void;
}

export default function DuplicateAlert({
  isOpen,
  candidate,
  previousSubmission,
  onClose,
  onViewHistory,
  onSubmitAnyway,
}: DuplicateAlertProps) {
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
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-amber-100 p-2 text-amber-700">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Candidate already submitted to this client
                  </h3>
                  <p className="mt-1 text-sm text-[#6B7280]">{candidate?.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 text-sm text-slate-700">
              <p>
                Previous submission date:{' '}
                <span className="font-semibold text-slate-900">{previousSubmission?.date || 'Unknown'}</span>
              </p>
              <p className="mt-2">
                Current status:{' '}
                <span className="font-semibold text-slate-900">{previousSubmission?.status || 'Submitted'}</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[#E5E7EB] px-6 py-4">
              <button
                type="button"
                onClick={onViewHistory}
                className="rounded-xl border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-slate-700"
              >
                View History
              </button>
              <button
                type="button"
                onClick={onSubmitAnyway}
                className="rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white"
              >
                Submit Anyway
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
