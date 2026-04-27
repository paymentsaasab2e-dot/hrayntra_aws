import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, Check, CheckCircle2, X } from 'lucide-react';
import type { Interview } from '../../types/interview.types';

interface RejectCandidateModalProps {
  isOpen: boolean;
  interview: Interview | null;
  onClose: () => void;
  onReject: (payload: { reason: string; feedback: string; sendEmail: boolean }) => Promise<void> | void;
}

const REJECT_REASONS = [
  'Skill mismatch',
  'Salary too high',
  'Experience mismatch',
  'Client rejected',
  'Communication issue',
  'Other',
] as const;

const FEEDBACK_MAX_LENGTH = 100;

type Step = 'form' | 'confirm' | 'progress' | 'done';

export function RejectCandidateModal({ isOpen, interview, onClose, onReject }: RejectCandidateModalProps) {
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [errors, setErrors] = useState<{ reason?: string }>({});
  const [step, setStep] = useState<Step>('form');
  const [progressStep, setProgressStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setReason('');
      setFeedback('');
      setSendEmail(true);
      setErrors({});
      setStep('form');
      setProgressStep(0);
      setSubmitting(false);
    }
  }, [isOpen]);

  const feedbackLength = feedback.trim().length;
  const canProceed = Boolean(reason) && feedbackLength > 0;

  const validate = () => {
    const nextErrors: { reason?: string } = {};
    if (!reason) nextErrors.reason = 'Reject reason is required';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handlePrimaryReject = () => {
    if (!validate()) return;
    setStep('confirm');
  };

  const handleConfirmReject = async () => {
    setStep('progress');
    setSubmitting(true);
    try {
      for (let i = 1; i <= 4; i += 1) {
        setProgressStep(i);
        await new Promise((resolve) => window.setTimeout(resolve, 300));
      }
      await Promise.resolve(onReject({ reason, feedback: feedback.trim(), sendEmail }));
      setStep('done');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && interview ? (
        <>
          <motion.div
            className="fixed inset-0 z-[70] bg-slate-950/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center p-4"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
          >
            <div className="w-full max-w-[480px] rounded-3xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                    <AlertTriangle size={20} />
                  </span>
                  <h3 className="text-lg font-semibold text-slate-900">Reject Candidate</h3>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                >
                  <X size={18} />
                </button>
              </div>

              {step === 'form' ? (
                <>
                  <div className="space-y-5 px-5 py-5">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Reject Reason</label>
                      <select
                        value={reason}
                        onChange={(e) => {
                          setReason(e.target.value);
                          setErrors((prev) => ({ ...prev, reason: undefined }));
                        }}
                        className={`w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-slate-700 outline-none ${
                          errors.reason ? 'border-red-300' : 'border-slate-200'
                        } focus:border-red-400 focus:ring-2 focus:ring-red-100`}
                      >
                        <option value="">Select reason</option>
                        {REJECT_REASONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                      {errors.reason ? <p className="mt-1 text-xs text-red-600">{errors.reason}</p> : null}
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Feedback</label>
                      <textarea
                        value={feedback}
                        onChange={(e) => {
                          const nextValue = e.target.value.slice(0, FEEDBACK_MAX_LENGTH);
                          setFeedback(nextValue);
                        }}
                        rows={5}
                        placeholder="Add rejection notes..."
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                      />
                      <div className="mt-1 flex items-center justify-between gap-3">
                        <p className="text-xs text-slate-400">
                          {feedbackLength}/{FEEDBACK_MAX_LENGTH} chars
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800">Send rejection email</p>
                        <p className="text-xs text-slate-500">Notify the candidate automatically after rejection.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSendEmail((prev) => !prev)}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                          sendEmail ? 'bg-red-500' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                            sendEmail ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handlePrimaryReject}
                      disabled={!canProceed}
                      className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Reject Candidate
                    </button>
                  </div>
                </>
              ) : null}

              {step === 'confirm' ? (
                <>
                  <div className="space-y-4 px-5 py-6">
                    <p className="text-sm leading-6 text-slate-700">
                      You are about to reject <span className="font-semibold text-slate-900">{interview.candidate.name}</span>.
                    </p>
                    <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-slate-700">
                      <p>This will trigger:</p>
                      <ul className="mt-2 space-y-1 text-slate-600">
                        <li>Feedback stored</li>
                        <li>Candidate stage updated</li>
                        <li>AI Courses suggestions sent</li>
                        <li>{sendEmail ? 'Rejection email sent' : 'Rejection email skipped'}</li>
                      </ul>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
                    <button
                      type="button"
                      onClick={() => setStep('form')}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Go Back
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmReject}
                      className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                    >
                      Confirm Reject
                    </button>
                  </div>
                </>
              ) : null}

              {step === 'progress' ? (
                <div className="px-5 py-6">
                  <div className="space-y-4">
                    {['Feedback stored', 'Candidate stage updated', 'AI Courses suggestions sent', 'Rejection email sent'].map((label, index) => {
                      const done = progressStep > index + 1;
                      const active = progressStep === index + 1;
                      return (
                        <div
                          key={label}
                          className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${
                            done || active ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'
                          }`}
                        >
                          <span className={`text-sm ${done || active ? 'text-slate-800' : 'text-slate-500'}`}>{label}</span>
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white">
                            {done ? (
                              <Check size={15} className="text-emerald-600" />
                            ) : active ? (
                              <span className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
                            ) : (
                              <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {step === 'done' ? (
                <>
                  <div className="px-5 py-8 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                      <CheckCircle2 size={26} />
                    </div>
                    <h4 className="mt-4 text-lg font-semibold text-slate-900">Candidate rejected.</h4>
                    <p className="mt-2 text-sm text-slate-500">
                      The candidate has been rejected and the workflow is complete.
                    </p>
                  </div>
                  <div className="flex items-center justify-end border-t border-slate-200 px-5 py-4">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={submitting}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                    >
                      Close
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
