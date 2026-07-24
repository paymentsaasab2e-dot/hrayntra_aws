'use client';

import React, { useEffect, useState } from 'react';
import { UserX } from 'lucide-react';
import type { Placement } from '../../../types/placement';
import { DrawerFormShell, DrawerFormCancelButton } from '../../drawers/DrawerFormShell';
import {
  DrawerFieldLabel,
  DrawerSectionCard,
  DRAWER_FORM_INPUT,
} from '../../drawers/drawerFormUi';

interface RejectOfferCandidateDrawerProps {
  isOpen: boolean;
  placement: Placement | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (payload: { reason: string; feedback: string }) => Promise<void>;
}

export function RejectOfferCandidateDrawer({
  isOpen,
  placement,
  isSubmitting,
  onClose,
  onSubmit,
}: RejectOfferCandidateDrawerProps) {
  const [reason, setReason] = useState('Offer declined by recruiter');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReason('Offer declined by recruiter');
      setFeedback('');
    }
  }, [isOpen]);

  if (!placement) return null;

  return (
    <DrawerFormShell
      isOpen={isOpen}
      onClose={onClose}
      title="Reject candidate"
      subtitle={`${placement.candidate.firstName} ${placement.candidate.lastName} · ${placement.job.title}`}
      headerIcon={UserX}
      panelClassName="fixed right-0 top-0 flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl"
      zBackdrop={90}
      zPanel={100}
      footer={
        <>
          <DrawerFormCancelButton className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50" />
          <button
            type="button"
            disabled={isSubmitting || !feedback.trim()}
            onClick={() => void onSubmit({ reason: reason.trim(), feedback: feedback.trim() })}
            className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
          >
            {isSubmitting ? 'Rejecting…' : 'Reject candidate'}
          </button>
        </>
      }
    >
      <DrawerSectionCard title="Rejection Details" subtitle="Reason and notes for the candidate record" icon={UserX} accent="rose">
        <div className="space-y-4">
          <div>
            <DrawerFieldLabel label="Reason" />
            <input
              type="text"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className={DRAWER_FORM_INPUT}
              placeholder="Reason for rejection"
            />
          </div>
          <div>
            <DrawerFieldLabel label="Rejection notes" required />
            <textarea
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              rows={5}
              maxLength={2000}
              placeholder="Share why this candidate is being rejected after declining the offer..."
              className={`${DRAWER_FORM_INPUT} min-h-[120px] resize-y py-3`}
            />
            <p className="mt-1 text-xs text-slate-500">{feedback.trim().length}/2000</p>
          </div>
        </div>
      </DrawerSectionCard>
    </DrawerFormShell>
  );
}
