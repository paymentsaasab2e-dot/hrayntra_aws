'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Calendar, X } from 'lucide-react';
import type { Placement } from '../../../types/placement';
import type { ScheduleJoiningPayload } from '../../../types/placement';

interface ScheduleJoiningDrawerProps {
  isOpen: boolean;
  placement: Placement | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (payload: ScheduleJoiningPayload) => Promise<void>;
}

export function ScheduleJoiningDrawer({
  isOpen,
  placement,
  isSubmitting,
  onClose,
  onSubmit,
}: ScheduleJoiningDrawerProps) {
  const [joiningDate, setJoiningDate] = useState('');
  const [reportingToName, setReportingToName] = useState('');
  const [reportingToTitle, setReportingToTitle] = useState('');
  const [reportingToEmail, setReportingToEmail] = useState('');
  const [joiningNotes, setJoiningNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !placement) return;
    const existing = placement.joiningDate ? String(placement.joiningDate).slice(0, 10) : '';
    setJoiningDate(existing);
    setReportingToName(placement.reportingToName || '');
    setReportingToTitle(placement.reportingToTitle || '');
    setReportingToEmail(placement.reportingToEmail || '');
    setJoiningNotes(placement.notes || '');
    setError('');
  }, [isOpen, placement]);

  const handleSubmit = async () => {
    if (!joiningDate) {
      setError('Joining date is required');
      return;
    }
    if (!reportingToName.trim()) {
      setError('Reporting contact name is required');
      return;
    }
    setError('');
    await onSubmit({
      joiningDate,
      reportingToName: reportingToName.trim(),
      reportingToTitle: reportingToTitle.trim() || undefined,
      reportingToEmail: reportingToEmail.trim() || undefined,
      joiningNotes: joiningNotes.trim() || undefined,
    });
  };

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
            className="fixed right-0 top-0 z-[100] flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-[#111827]">Schedule Joining</h3>
                <p className="text-sm text-[#6B7280]">
                  {placement.candidate.firstName} {placement.candidate.lastName} · {placement.job.title}
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
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#111827]">Joining date*</label>
                <input
                  type="date"
                  value={joiningDate}
                  onChange={(e) => setJoiningDate(e.target.value)}
                  className="h-11 w-full rounded-xl border border-[#D1D5DB] px-3 text-sm outline-none focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#111827]">Report to (name)*</label>
                <input
                  type="text"
                  value={reportingToName}
                  onChange={(e) => setReportingToName(e.target.value)}
                  placeholder="e.g. Priya Sharma"
                  className="h-11 w-full rounded-xl border border-[#D1D5DB] px-3 text-sm outline-none focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#111827]">Designation / role</label>
                <input
                  type="text"
                  value={reportingToTitle}
                  onChange={(e) => setReportingToTitle(e.target.value)}
                  placeholder="e.g. HR Manager"
                  className="h-11 w-full rounded-xl border border-[#D1D5DB] px-3 text-sm outline-none focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#111827]">Contact email</label>
                <input
                  type="email"
                  value={reportingToEmail}
                  onChange={(e) => setReportingToEmail(e.target.value)}
                  placeholder="hr@company.com"
                  className="h-11 w-full rounded-xl border border-[#D1D5DB] px-3 text-sm outline-none focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#111827]">Instructions for candidate</label>
                <textarea
                  rows={3}
                  value={joiningNotes}
                  onChange={(e) => setJoiningNotes(e.target.value)}
                  placeholder="Office address, documents to carry, reporting time…"
                  className="w-full rounded-xl border border-[#D1D5DB] px-3 py-3 text-sm outline-none focus:border-[#2563EB]"
                />
              </div>

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <p className="rounded-xl bg-blue-50 px-4 py-3 text-xs text-blue-900">
                An email with joining details is sent to the candidate. If you add a reporting contact email,
                that person receives a separate email with the candidate&apos;s profile and joining date.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#E5E7EB] px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[#D1D5DB] px-4 py-2.5 text-sm font-semibold text-[#374151] hover:bg-[#F9FAFB]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void handleSubmit()}
                className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-60"
              >
                <Calendar size={16} />
                {isSubmitting ? 'Saving…' : placement.status === 'JOINING_SCHEDULED' ? 'Update joining' : 'Schedule joining'}
              </button>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
