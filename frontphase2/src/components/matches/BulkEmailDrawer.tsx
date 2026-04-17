import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Mail, X } from 'lucide-react';
import type { MatchJob } from './types';

interface BulkEmailDrawerProps {
  isOpen: boolean;
  selectedCount: number;
  selectedJob: MatchJob | null;
  onClose: () => void;
  onSubmit: (payload: { subject: string; message: string }) => Promise<void>;
}

export default function BulkEmailDrawer({
  isOpen,
  selectedCount,
  selectedJob,
  onClose,
  onSubmit,
}: BulkEmailDrawerProps) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSubject(selectedJob ? `Candidate Submission: ${selectedJob.title}` : 'Candidate Submission');
    setMessage(
      selectedJob
        ? `Hello team,\n\nPlease review the selected candidate profiles for ${selectedJob.title}. I have included the shortlist for your feedback.\n\nRegards`
        : 'Hello team,\n\nPlease review the selected candidate profiles.\n\nRegards'
    );
  }, [isOpen, selectedJob]);

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
            className="fixed right-0 top-0 z-[100] flex h-full w-full flex-col bg-white shadow-2xl sm:max-w-[560px]"
          >
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Send Bulk Email</h3>
                <p className="mt-1 text-sm text-[#6B7280]">
                  Send a Resend-powered client email for {selectedCount} selected candidates.
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
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Selected</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{selectedCount} candidates</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Job</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {selectedJob ? `${selectedJob.title} • ${selectedJob.client}` : 'No job selected'}
                  </p>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">Email Subject</label>
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">Message</label>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={8}
                  className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-[#1D4ED8]">
                <div className="flex items-center gap-2 font-semibold">
                  <Mail size={16} />
                  Sent from backend via Resend
                </div>
                <p className="mt-1">
                  The backend will resolve the client contacts for the selected job and send the email using a reusable HTML template.
                </p>
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
                    await onSubmit({ subject, message });
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                disabled={isSubmitting}
                className="rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Sending...' : 'Send Email'}
              </button>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
