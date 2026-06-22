'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { Placement } from '../../../types/placement';
import { DrawerFormShell } from '../../drawers/DrawerFormShell';
import {
  DrawerFieldLabel,
  DrawerSectionCard,
  DRAWER_FORM_INPUT,
} from '../../drawers/drawerFormUi';

interface MarkFailedDrawerProps {
  isOpen: boolean;
  placement: Placement | null;
  mode: 'FAILED' | 'NO_SHOW';
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (payload: { reason: string; notes?: string; status: 'FAILED' | 'NO_SHOW' | 'WITHDRAWN' }) => Promise<void>;
}

const reasonOptions = [
  'Candidate withdrew',
  'Offer declined',
  'No show on joining date',
  'Client cancelled',
  'Other',
];

export function MarkFailedDrawer({
  isOpen,
  placement,
  mode,
  isSubmitting,
  onClose,
  onSubmit,
}: MarkFailedDrawerProps) {
  const [reason, setReason] = useState(reasonOptions[0]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReason(mode === 'NO_SHOW' ? 'No show on joining date' : reasonOptions[0]);
      setNotes('');
    }
  }, [isOpen, mode]);

  if (!placement) return null;

  return (
    <DrawerFormShell
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'NO_SHOW' ? 'Mark as No Show' : 'Mark as Failed'}
      subtitle={`Update the placement outcome for ${placement.candidate.firstName} ${placement.candidate.lastName}.`}
      headerIcon={AlertTriangle}
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
            onClick={async () => {
              await onSubmit({
                reason,
                notes,
                status: reason === 'Candidate withdrew' ? 'WITHDRAWN' : mode,
              });
            }}
            className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Saving...' : mode === 'NO_SHOW' ? 'Confirm No Show' : 'Mark as Failed'}
          </button>
        </>
      }
    >
      <DrawerSectionCard title="Outcome Details" subtitle="Reason and optional notes" icon={AlertTriangle} accent="rose">
        <div className="space-y-4">
          <div>
            <DrawerFieldLabel label="Reason" required />
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className={DRAWER_FORM_INPUT}
            >
              {reasonOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <DrawerFieldLabel label="Notes" />
            <textarea
              rows={4}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className={`${DRAWER_FORM_INPUT} min-h-[100px] resize-y py-3`}
            />
          </div>
        </div>
      </DrawerSectionCard>
    </DrawerFormShell>
  );
}
