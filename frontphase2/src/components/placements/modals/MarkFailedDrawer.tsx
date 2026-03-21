'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import type { Placement } from '../../../types/placement';

interface MarkFailedDrawerProps {
  isOpen: boolean;
  placement: Placement | null;
  mode: 'FAILED' | 'NO_SHOW';
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (payload: { reason: string; notes?: string; status: 'FAILED' | 'NO_SHOW' | 'WITHDRAWN' }) => Promise<void>;
}

const reasonOptions = [
  'Candidate withdrew',
  'Offer declined',
  'No show on joining date',
  'Client cancelled',
  'Other',
];

export function MarkFailedDrawer({
  isOpen,
  placement,
  mode,
  isSubmitting,
  onClose,
  onSubmit,
}: MarkFailedDrawerProps) {
  const [reason, setReason] = useState(reasonOptions[0]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReason(mode === 'NO_SHOW' ? 'No show on joining date' : reasonOptions[0]);
      setNotes('');
    }
  }, [isOpen, mode]);

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
            className="fixed right-0 top-0 z-[100] flex h-full w-full flex-col bg-white shadow-2xl sm:max-w-[520px]"
          >
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-[#111827]">
                  {mode === 'NO_SHOW' ? 'Mark as No Show' : 'Mark as Failed'}
                </h3>
                <p className="text-sm text-[#6B7280]">
                  Update the placement outcome for {placement.candidate.firstName} {placement.candidate.lastName}.
                </p>
              </div>
              <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#111827]">Reason*</label>
                <select
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="h-11 w-full rounded-xl border border-[#D1D5DB] px-3 text-sm outline-none focus:border-[#2563EB]"
                >
                  {reasonOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#111827]">Notes</label>
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="w-full rounded-xl border border-[#D1D5DB] px-3 py-3 text-sm outline-none focus:border-[#2563EB]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#E5E7EB] px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[#D1D5DB] px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={async () => {
                  await onSubmit({
                    reason,
                    notes,
                    status: reason === 'Candidate withdrew' ? 'WITHDRAWN' : mode,
                  });
                }}
                className="rounded-xl bg-[#DC2626] px-4 py-2 text-sm font-semibold text-white hover:bg-[#B91C1C] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Saving...' : mode === 'NO_SHOW' ? 'Confirm No Show' : 'Mark as Failed'}
              </button>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
