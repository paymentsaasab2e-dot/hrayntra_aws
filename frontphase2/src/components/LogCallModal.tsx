'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

const CALL_OUTCOMES = [
  'Interested',
  'Follow-up Required',
  'No Answer',
  'Wrong Number',
  'Not Interested',
] as const;

export interface LogCallFormData {
  callType: 'Outgoing' | 'Incoming';
  duration: string;
  outcome: string;
  notes: string;
  nextFollowUp: string;
}

interface LogCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (data: LogCallFormData) => void;
}

const defaultForm: LogCallFormData = {
  callType: 'Outgoing',
  duration: '00:00',
  outcome: '',
  notes: '',
  nextFollowUp: '',
};

export function LogCallModal({ isOpen, onClose, onSave }: LogCallModalProps) {
  const [form, setForm] = useState<LogCallFormData>(defaultForm);
  const [outcomeOpen, setOutcomeOpen] = useState(false);

  const handleClose = () => {
    setForm(defaultForm);
    setOutcomeOpen(false);
    onClose();
  };

  const handleSave = () => {
    onSave?.(form);
    handleClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="fixed left-1/2 top-1/2 z-[100] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white shadow-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">Log Call</h2>
              <button
                type="button"
                onClick={handleClose}
                className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-5">
              {/* Call Type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Call Type</label>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="callType"
                      checked={form.callType === 'Outgoing'}
                      onChange={() => setForm((p) => ({ ...p, callType: 'Outgoing' }))}
                      className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">Outgoing</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="callType"
                      checked={form.callType === 'Incoming'}
                      onChange={() => setForm((p) => ({ ...p, callType: 'Incoming' }))}
                      className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">Incoming</span>
                  </label>
                </div>
              </div>

              {/* Call Duration */}
              <div>
                <label htmlFor="duration" className="block text-sm font-medium text-slate-700 mb-2">
                  Call Duration
                </label>
                <input
                  id="duration"
                  type="time"
                  value={form.duration}
                  onChange={(e) => setForm((p) => ({ ...p, duration: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* Call Outcome */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Call Outcome</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setOutcomeOpen((v) => !v)}
                    className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-left text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <span className={form.outcome ? 'text-slate-900' : 'text-slate-400'}>
                      {form.outcome || 'Select outcome'}
                    </span>
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {outcomeOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setOutcomeOpen(false)} aria-hidden />
                      <ul className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg max-h-48 overflow-y-auto">
                        {CALL_OUTCOMES.map((opt) => (
                          <li key={opt}>
                            <button
                              type="button"
                              onClick={() => {
                                setForm((p) => ({ ...p, outcome: opt }));
                                setOutcomeOpen(false);
                              }}
                              className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${
                                form.outcome === opt ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
                              }`}
                            >
                              {opt}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-2">
                  Notes
                </label>
                <textarea
                  id="notes"
                  rows={4}
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Add notes about the call..."
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                />
              </div>

              {/* Next Follow-up */}
              <div>
                <label htmlFor="nextFollowUp" className="block text-sm font-medium text-slate-700 mb-2">
                  Next Follow-up
                </label>
                <input
                  id="nextFollowUp"
                  type="date"
                  value={form.nextFollowUp}
                  onChange={(e) => setForm((p) => ({ ...p, nextFollowUp: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 bg-slate-50/50 rounded-b-2xl">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-sm transition-colors"
              >
                Save Call Log
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
