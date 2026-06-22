'use client';

import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { Placement } from '../../../types/placement';
import { DrawerFormShell } from '../../drawers/DrawerFormShell';
import {
  DrawerFieldLabel,
  DrawerSectionCard,
  DRAWER_FORM_INPUT,
} from '../../drawers/drawerFormUi';

interface RequestReplacementDrawerProps {
  isOpen: boolean;
  placement: Placement | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (payload: { reason?: string; expectedReplacementDate?: string }) => Promise<void>;
}

export function RequestReplacementDrawer({
  isOpen,
  placement,
  isSubmitting,
  onClose,
  onSubmit,
}: RequestReplacementDrawerProps) {
  const [reason, setReason] = useState('');
  const [expectedReplacementDate, setExpectedReplacementDate] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setExpectedReplacementDate('');
    }
  }, [isOpen]);

  if (!placement) return null;

  return (
    <DrawerFormShell
      isOpen={isOpen}
      onClose={onClose}
      title="Request Replacement"
      subtitle={`Start replacement for ${placement.candidate.firstName} ${placement.candidate.lastName}.`}
      headerIcon={RefreshCw}
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
                reason: reason || undefined,
                expectedReplacementDate: expectedReplacementDate || undefined,
              });
            }}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Saving...' : 'Request Replacement'}
          </button>
        </>
      }
    >
      <DrawerSectionCard title="Replacement Request" subtitle="Reason and expected timeline" icon={RefreshCw} accent="violet">
        <div className="space-y-4">
          <div>
            <DrawerFieldLabel label="Reason" />
            <textarea
              rows={4}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className={`${DRAWER_FORM_INPUT} min-h-[100px] resize-y py-3`}
            />
          </div>

          <div>
            <DrawerFieldLabel label="Expected Replacement Date" />
            <input
              type="date"
              value={expectedReplacementDate}
              onChange={(event) => setExpectedReplacementDate(event.target.value)}
              className={DRAWER_FORM_INPUT}
            />
          </div>
        </div>
      </DrawerSectionCard>
    </DrawerFormShell>
  );
}
