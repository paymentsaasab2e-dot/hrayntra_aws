'use client';

import { PauseCircle } from 'lucide-react';

type Props = {
  open: boolean;
  pausedAt?: string | null;
};

export function TenantPausedModal({ open, pausedAt }: Props) {
  if (!open) return null;

  const pausedLabel = pausedAt
    ? new Date(pausedAt).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-2xl"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="tenant-paused-title"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
          <PauseCircle className="h-8 w-8 text-amber-600" />
        </div>
        <h2 id="tenant-paused-title" className="mt-4 text-xl font-bold text-slate-900">
          Workspace paused
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Your tenant workspace has been temporarily paused by Hryantra HQ. You cannot use the platform
          until operations are resumed.
        </p>
        {pausedLabel ? (
          <p className="mt-3 text-xs text-slate-500">Paused on {pausedLabel}</p>
        ) : null}
        <p className="mt-5 text-xs text-slate-500">
          Contact your account administrator or Hryantra support if you need help.
        </p>
      </div>
    </div>
  );
}
