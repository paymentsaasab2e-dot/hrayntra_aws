'use client';

import React from 'react';
import { Clock3 } from 'lucide-react';
import { ClientHandoffForm } from './ClientHandoffForm';
import { useClientHandoffStatuses } from '../../hooks/useClientHandoffStatuses';
import { canInitiateClientHandoff } from '../../lib/clientHandoffStatus';

type Props = {
  clientId: string;
  clientName: string;
  onSent?: () => void;
};

export function CrossDepartmentClientHandoff({ clientId, clientName, onSent }: Props) {
  const { getStatusForClient, refresh } = useClientHandoffStatuses();
  const handoff = getStatusForClient(clientId);

  const handleSent = () => {
    void refresh();
    onSent?.();
  };

  if (handoff.status === 'pending') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
        <div className="flex items-start gap-2">
          <Clock3 className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Handoff pending approval</p>
            <p className="text-xs text-amber-800 mt-0.5">
              Your request is waiting for the receiving department head. You cannot send another handoff until it is
              accepted or rejected.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (handoff.status === 'accepted') {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
        <p className="text-sm font-semibold text-emerald-900">Client handed off</p>
        <p className="text-xs text-emerald-800 mt-0.5">
          This client was approved for handoff to another department.
        </p>
      </div>
    );
  }

  if (handoff.status === 'rejected') {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4">
          <p className="text-sm font-semibold text-rose-900">Handoff request rejected</p>
          <p className="text-xs text-rose-800 mt-0.5">
            {handoff.reviewNote?.trim() || 'The receiving department head rejected this handoff request.'}
          </p>
        </div>
        <ClientHandoffForm
          clientId={clientId}
          clientName={clientName}
          onSent={handleSent}
          showHeader
          hideWhenUnavailable
          submitLabel="Resend handoff request"
        />
      </div>
    );
  }

  if (!canInitiateClientHandoff(handoff)) {
    return null;
  }

  return (
    <ClientHandoffForm
      clientId={clientId}
      clientName={clientName}
      onSent={handleSent}
      showHeader
      hideWhenUnavailable
    />
  );
}
