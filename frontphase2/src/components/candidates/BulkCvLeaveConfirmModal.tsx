'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle } from 'lucide-react';

export type BulkCvLeaveConfirmModalProps = {
  open: boolean;
  processed: number;
  total: number;
  /** e.g. "close this window" | "leave this page" */
  leaveActionLabel?: string;
  onStay: () => void;
  onStopAndLeave: () => void;
};

export function BulkCvLeaveConfirmModal({
  open,
  processed,
  total,
  leaveActionLabel = 'leave',
  onStay,
  onStopAndLeave,
}: BulkCvLeaveConfirmModalProps) {
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-cv-leave-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-amber-100 p-2.5 text-amber-700">
            <AlertCircle size={20} />
          </div>
          <div className="flex-1">
            <h3 id="bulk-cv-leave-title" className="text-lg font-semibold text-slate-900">
              Bulk CV parsing in progress
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              CVs are still being parsed and saved. If you {leaveActionLabel} now, parsing will stop and
              remaining files may not be processed.
            </p>
            {total > 0 ? (
              <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
                Processed {processed} of {total} so far
              </p>
            ) : null}
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onStay}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            No — keep parsing
          </button>
          <button
            type="button"
            onClick={onStopAndLeave}
            className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            Yes — stop &amp; {leaveActionLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
