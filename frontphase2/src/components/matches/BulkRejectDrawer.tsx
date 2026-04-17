import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';

interface BulkRejectDrawerProps {
  isOpen: boolean;
  selectedCount: number;
  onClose: () => void;
  onSubmit: (payload: { reason: string; notes: string }) => Promise<void>;
}

const REASONS = [
  'Skill mismatch',
  'Salary expectation',
  'Experience mismatch',
  'Client requirement mismatch',
  'Other',
];

export default function BulkRejectDrawer({
  isOpen,
  selectedCount,
  onClose,
  onSubmit,
}: BulkRejectDrawerProps) {
  const [reason, setReason] = useState(REASONS[0]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setReason(REASONS[0]);
    setNotes('');
  }, [isOpen]);

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
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="fixed right-0 top-0 z-[100] flex h-full w-full flex-col bg-white shadow-2xl sm:max-w-[520px]"
          >
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Bulk Reject Matches</h3>
                <p className="mt-1 text-sm text-[#6B7280]">
                  Reject {selectedCount} selected candidate matches in one action.
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
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Selected Matches</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{selectedCount}</p>
              </div>

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
                  placeholder="Add rejection context for the selected matches..."
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
                    await onSubmit({ reason, notes });
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                disabled={isSubmitting}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Rejecting...' : 'Reject Matches'}
              </button>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
