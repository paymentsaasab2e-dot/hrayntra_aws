'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, Upload } from 'lucide-react';
import type { Placement } from '../../../types/placement';
import { DrawerFormShell, DrawerFormCancelButton } from '../../drawers/DrawerFormShell';
import {
  DrawerFieldLabel,
  DrawerSectionCard,
  DRAWER_FORM_INPUT,
} from '../../drawers/drawerFormUi';

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

  if (!placement) return null;

  return (
    <DrawerFormShell
      isOpen={isOpen}
      onClose={onClose}
      title="Mark as Joined"
      subtitle={`Confirm joining for ${placement.candidate.firstName} ${placement.candidate.lastName}.`}
      headerIcon={CheckCircle2}
      zBackdrop={90}
      zPanel={100}
      footer={
        <>
          <DrawerFormCancelButton />
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
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Saving...' : 'Mark as Joined'}
          </button>
        </>
      }
    >
      <DrawerSectionCard title="Joining Confirmation" subtitle="Actual date, notes, and optional letter" icon={CheckCircle2} accent="emerald">
        <div className="space-y-4">
          <div>
            <DrawerFieldLabel label="Actual Joining Date" required />
            <input
              type="date"
              value={actualJoiningDate}
              onChange={(event) => setActualJoiningDate(event.target.value)}
              className={DRAWER_FORM_INPUT}
            />
            {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
          </div>

          <div>
            <DrawerFieldLabel label="Confirmation Note" />
            <textarea
              rows={4}
              value={confirmationNote}
              onChange={(event) => setConfirmationNote(event.target.value)}
              className={`${DRAWER_FORM_INPUT} min-h-[100px] resize-y py-3`}
            />
          </div>

          <div>
            <DrawerFieldLabel label="Upload Joining Letter (PDF)" />
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-200 px-4 py-4 transition-colors hover:bg-slate-50">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <Upload className="h-4 w-4" />
              </div>
              <div className="text-sm">
                <p className="font-medium text-slate-900">{joiningLetter?.name || 'Choose PDF file'}</p>
                <p className="text-slate-500">Optional joining confirmation letter</p>
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
      </DrawerSectionCard>
    </DrawerFormShell>
  );
}
