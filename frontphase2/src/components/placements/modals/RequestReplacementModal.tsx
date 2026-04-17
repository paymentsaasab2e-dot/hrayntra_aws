'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import type { Placement } from '../../../types/placement';

interface RequestReplacementDrawerProps {
  isOpen: boolean;
  placement: Placement | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (payload: { reason?: string; expectedReplacementDate?: string }) => Promise<void>;
}

export function RequestReplacementDrawer({
  isOpen,
  placement,
  isSubmitting,
  onClose,
  onSubmit,
}: RequestReplacementDrawerProps) {
  const [reason, setReason] = useState('');
  const [expectedReplacementDate, setExpectedReplacementDate] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setExpectedReplacementDate('');
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
            className="fixed right-0 top-0 z-[100] flex h-full w-full flex-col bg-white shadow-2xl sm:max-w-[520px]"
          >
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-[#111827]">Request Replacement</h3>
                <p className="text-sm text-[#6B7280]">
                  Start replacement for {placement.candidate.firstName} {placement.candidate.lastName}.
                </p>
              </div>
              <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#111827]">Reason</label>
                <textarea
                  rows={4}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="w-full rounded-xl border border-[#D1D5DB] px-3 py-3 text-sm outline-none focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#111827]">Expected Replacement Date</label>
                <input
                  type="date"
                  value={expectedReplacementDate}
                  onChange={(event) => setExpectedReplacementDate(event.target.value)}
                  className="h-11 w-full rounded-xl border border-[#D1D5DB] px-3 text-sm outline-none focus:border-[#2563EB]"
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
                    reason: reason || undefined,
                    expectedReplacementDate: expectedReplacementDate || undefined,
                  });
                }}
                className="rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Saving...' : 'Request Replacement'}
              </button>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
