'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Upload, X } from 'lucide-react';
import type { Placement } from '../../../types/placement';

interface MarkJoinedDrawerProps {
  isOpen: boolean;
  placement: Placement | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (payload: { actualJoiningDate: string; confirmationNote?: string }, joiningLetter?: File | null) => Promise<void>;
}

export function MarkJoinedDrawer({ isOpen, placement, isSubmitting, onClose, onSubmit }: MarkJoinedDrawerProps) {
  const [actualJoiningDate, setActualJoiningDate] = useState('');
  const [confirmationNote, setConfirmationNote] = useState('');
  const [joiningLetter, setJoiningLetter] = useState<File | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setActualJoiningDate(new Date().toISOString().slice(0, 10));
      setConfirmationNote('');
      setJoiningLetter(null);
      setError('');
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
                <h3 className="text-lg font-semibold text-[#111827]">Mark as Joined</h3>
                <p className="text-sm text-[#6B7280]">
                  Confirm joining for {placement.candidate.firstName} {placement.candidate.lastName}.
                </p>
              </div>
              <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#111827]">Actual Joining Date*</label>
                <input
                  type="date"
                  value={actualJoiningDate}
                  onChange={(event) => setActualJoiningDate(event.target.value)}
                  className="h-11 w-full rounded-xl border border-[#D1D5DB] px-3 text-sm outline-none focus:border-[#2563EB]"
                />
                {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#111827]">Confirmation Note</label>
                <textarea
                  rows={4}
                  value={confirmationNote}
                  onChange={(event) => setConfirmationNote(event.target.value)}
                  className="w-full rounded-xl border border-[#D1D5DB] px-3 py-3 text-sm outline-none focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#111827]">Upload Joining Letter (PDF)</label>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[#D1D5DB] px-4 py-4 hover:bg-slate-50">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    <Upload className="h-4 w-4" />
                  </div>
                  <div className="text-sm">
                    <p className="font-medium text-[#111827]">{joiningLetter?.name || 'Choose PDF file'}</p>
                    <p className="text-[#6B7280]">Optional joining confirmation letter</p>
                  </div>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(event) => setJoiningLetter(event.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
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
                  if (!actualJoiningDate) {
                    setError('Joining date is required');
                    return;
                  }
                  await onSubmit({ actualJoiningDate, confirmationNote }, joiningLetter);
                }}
                className="rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Saving...' : 'Mark as Joined'}
              </button>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
