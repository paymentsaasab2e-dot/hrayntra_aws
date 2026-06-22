'use client';

import React, { useEffect, useState } from 'react';
import { Calendar } from 'lucide-react';
import type { Placement } from '../../../types/placement';
import type { ScheduleJoiningPayload } from '../../../types/placement';
import { DrawerFormShell } from '../../drawers/DrawerFormShell';
import {
  DrawerFieldLabel,
  DrawerSectionCard,
  DRAWER_FORM_INPUT,
} from '../../drawers/drawerFormUi';

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

  if (!placement) return null;

  return (
    <DrawerFormShell
      isOpen={isOpen}
      onClose={onClose}
      title="Schedule Joining"
      subtitle={`${placement.candidate.firstName} ${placement.candidate.lastName} · ${placement.job.title}`}
      headerIcon={Calendar}
      panelClassName="fixed right-0 top-0 flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-2xl"
      zBackdrop={90}
      zPanel={100}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void handleSubmit()}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            <Calendar size={16} />
            {isSubmitting ? 'Saving…' : placement.status === 'JOINING_SCHEDULED' ? 'Update joining' : 'Schedule joining'}
          </button>
        </>
      }
    >
      <DrawerSectionCard title="Joining Details" subtitle="Date, reporting contact, and instructions" icon={Calendar} accent="blue">
        <div className="space-y-4">
          <div>
            <DrawerFieldLabel label="Joining date" required />
            <input
              type="date"
              value={joiningDate}
              onChange={(e) => setJoiningDate(e.target.value)}
              className={DRAWER_FORM_INPUT}
            />
          </div>

          <div>
            <DrawerFieldLabel label="Report to (name)" required />
            <input
              type="text"
              value={reportingToName}
              onChange={(e) => setReportingToName(e.target.value)}
              placeholder="e.g. Priya Sharma"
              className={DRAWER_FORM_INPUT}
            />
          </div>

          <div>
            <DrawerFieldLabel label="Designation / role" />
            <input
              type="text"
              value={reportingToTitle}
              onChange={(e) => setReportingToTitle(e.target.value)}
              placeholder="e.g. HR Manager"
              className={DRAWER_FORM_INPUT}
            />
          </div>

          <div>
            <DrawerFieldLabel label="Contact email" />
            <input
              type="email"
              value={reportingToEmail}
              onChange={(e) => setReportingToEmail(e.target.value)}
              placeholder="hr@company.com"
              className={DRAWER_FORM_INPUT}
            />
          </div>

          <div>
            <DrawerFieldLabel label="Instructions for candidate" />
            <textarea
              rows={3}
              value={joiningNotes}
              onChange={(e) => setJoiningNotes(e.target.value)}
              placeholder="Office address, documents to carry, reporting time…"
              className={`${DRAWER_FORM_INPUT} min-h-[88px] resize-y py-3`}
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <p className="rounded-xl bg-blue-50 px-4 py-3 text-xs text-blue-900">
            An email with joining details is sent to the candidate. If you add a reporting contact email,
            that person receives a separate email with the candidate&apos;s profile and joining date.
          </p>
        </div>
      </DrawerSectionCard>
    </DrawerFormShell>
  );
}
