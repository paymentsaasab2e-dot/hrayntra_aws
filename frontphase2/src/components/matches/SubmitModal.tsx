import React, { useEffect, useState } from 'react';
import { Paperclip, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { MatchCandidate, MatchJob } from './types';

interface SubmitModalProps {
  isOpen: boolean;
  candidate: MatchCandidate | null;
  selectedJob: MatchJob;
  onClose: () => void;
  onSubmit: (payload: { message: string; files: File[]; notifyClient: boolean }) => Promise<void>;
}

export default function SubmitModal({
  isOpen,
  candidate,
  selectedJob,
  onClose,
  onSubmit,
}: SubmitModalProps) {
  const [message, setMessage] = useState('');
  const [notifyClient, setNotifyClient] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !candidate) return;
    setMessage(
      `Hi team,\n\nSharing ${candidate.name} for ${selectedJob.title}. Strong fit on ${candidate.skills
        .slice(0, 3)
        .join(', ')} and ${candidate.experience} years of experience.\n\nRegards`
    );
    setNotifyClient(true);
    setFiles([]);
  }, [candidate, isOpen, selectedJob.title]);

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
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="fixed right-0 top-0 z-[100] flex h-full w-full flex-col bg-white shadow-2xl sm:max-w-[560px]"
          >
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Submit Candidate</h3>
                <p className="mt-1 text-sm text-[#6B7280]">
                  Share candidate details with the client for review.
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
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Candidate</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{candidate?.name}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Job</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{selectedJob.title}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Client</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{selectedJob.client}</p>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">Message</label>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={6}
                  className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">Attach Files</label>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[#E5E7EB] px-4 py-3">
                  <Paperclip size={16} className="text-slate-400" />
                  <span className="text-sm text-slate-600">Resume, Portfolio</span>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(event) => setFiles(Array.from(event.target.files || []))}
                  />
                </label>
                {files.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {files.map((file) => (
                      <span
                        key={file.name}
                        className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                      >
                        {file.name}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <label className="inline-flex items-center gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={notifyClient}
                  onChange={(event) => setNotifyClient(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#2563EB]"
                />
                Notify client after submission
              </label>
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
                    await onSubmit({ message, files, notifyClient });
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                disabled={isSubmitting}
                className="rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
