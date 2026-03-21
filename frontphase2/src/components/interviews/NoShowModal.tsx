import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import type { Interview, NoShowPayload } from '../../types/interview.types';

interface NoShowModalProps {
  isOpen: boolean;
  interview: Interview | null;
  onClose: () => void;
  onSubmit: (payload: NoShowPayload) => Promise<void>;
}

const reasons = ['Candidate Unreachable', 'Candidate Cancelled Last Minute', 'Other'];

export function NoShowModal({ isOpen, interview, onClose, onSubmit }: NoShowModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reason, setReason] = useState(reasons[0]);
  const [notes, setNotes] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      setReason(reasons[0]);
      setNotes('');
    }
  }, [isOpen]);

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
            className="absolute right-0 top-0 z-10 flex h-full w-full flex-col bg-white shadow-2xl sm:max-w-[500px]"
          >
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-[#111827]">Mark No Show</h3>
                <p className="text-sm text-[#6B7280]">{interview.candidate.name} • {interview.date} • {interview.time}</p>
              </div>
              <button type="button" onClick={onClose} className="rounded-lg p-2 text-[#6B7280] hover:bg-[#F3F4F6]"><X className="size-5" /></button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              <div className="space-y-2">
                <div className="text-sm font-semibold text-[#111827]">Reason</div>
                {reasons.map((item) => (
                  <label key={item} className="flex items-center gap-2 rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm text-[#374151]">
                    <input type="radio" checked={reason === item} onChange={() => setReason(item)} className="size-4 border-[#D1D5DB] text-[#2563EB]" />
                    {item}
                  </label>
                ))}
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#111827]">Notes</label>
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#2563EB]" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-[#E5E7EB] bg-white px-6 py-4">
              <button type="button" onClick={onClose} className="rounded-xl border border-[#E5E7EB] px-4 py-2 text-sm font-semibold text-[#111827]">Cancel</button>
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
                className="rounded-xl bg-[#DC2626] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Saving...' : 'Confirm No Show'}
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
