import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import type { CancelInterviewPayload, Interview } from '../../types/interview.types';

interface CancelInterviewModalProps {
  isOpen: boolean;
  interview: Interview | null;
  onClose: () => void;
  onSubmit: (payload: CancelInterviewPayload) => Promise<void>;
}

const reasons = ['Candidate Withdrew', 'Client Cancelled', 'Scheduling Conflict', 'No Show', 'Other'];

export function CancelInterviewModal({ isOpen, interview, onClose, onSubmit }: CancelInterviewModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<CancelInterviewPayload>({
    reason: reasons[0],
    notes: '',
    notifyCandidate: true,
  });

  React.useEffect(() => {
    if (isOpen) {
      setForm({ reason: reasons[0], notes: '', notifyCandidate: true });
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
                <h3 className="text-lg font-semibold text-[#111827]">Cancel Interview</h3>
                <p className="text-sm text-[#6B7280]">{interview.candidate.name} • {interview.job.title}</p>
              </div>
              <button type="button" onClick={onClose} className="rounded-lg p-2 text-[#6B7280] hover:bg-[#F3F4F6]"><X className="size-5" /></button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#111827]">Reason</label>
                <select value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#2563EB]">
                  {reasons.map((reason) => <option key={reason}>{reason}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#111827]">Notes</label>
                <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={4} className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#2563EB]" />
              </div>
              <label className="flex items-center gap-2 rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm text-[#374151]">
                <input type="checkbox" checked={form.notifyCandidate} onChange={(event) => setForm((current) => ({ ...current, notifyCandidate: event.target.checked }))} className="size-4 rounded border-[#D1D5DB] text-[#2563EB]" />
                Notify Candidate
              </label>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-[#E5E7EB] bg-white px-6 py-4">
              <button type="button" onClick={onClose} className="rounded-xl border border-[#E5E7EB] px-4 py-2 text-sm font-semibold text-[#111827]">Go Back</button>
              <button
                type="button"
                onClick={async () => {
                  setIsSubmitting(true);
                  try {
                    await onSubmit(form);
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                disabled={isSubmitting}
                className="rounded-xl bg-[#DC2626] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Cancelling...' : 'Cancel Interview'}
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
