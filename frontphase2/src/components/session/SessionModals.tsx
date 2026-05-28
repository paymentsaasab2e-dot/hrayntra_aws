'use client';

import React from 'react';
import { Loader2, Monitor, ShieldAlert } from 'lucide-react';
import type { ActiveSessionView } from '@/lib/sessionAuth';

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose?: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/70 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <ShieldAlert size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          </div>
        </div>
        {children}
        {onClose ? (
          <button type="button" className="sr-only" onClick={onClose}>
            Close
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function DuplicateLoginModal({
  activeSession,
  loading,
  onYes,
  onNo,
}: {
  activeSession: ActiveSessionView | null;
  loading?: boolean;
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <ModalShell title="Duplicate Login Detected">
      <p className="mb-4 text-sm text-slate-600">
        This account is already active on another device or browser. Would you like to request access to this
        account?
      </p>
      {activeSession ? (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          <p className="font-semibold text-slate-800">Current active session</p>
          <p className="mt-1 whitespace-pre-line">{activeSession.deviceLabel || 'Unknown device'}</p>
        </div>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onNo}
          disabled={loading}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          No — Cancel
        </button>
        <button
          type="button"
          onClick={onYes}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
          Yes — Request Login
        </button>
      </div>
    </ModalShell>
  );
}

export function SessionTransferRequestModal({
  challenger,
  loading,
  onApprove,
  onReject,
}: {
  challenger: ActiveSessionView | null;
  loading?: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <ModalShell title="Duplicate Login Request Detected">
      <p className="mb-4 text-sm text-slate-600">
        Another device or browser is attempting to access your account. If this was not you, continue your
        current session. If you approve this request, your current session will be logged out and the new device
        will gain access.
      </p>
      {challenger ? (
        <div className="mb-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-slate-700">
          <Monitor className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div>
            <p className="font-semibold text-slate-800">New login attempt</p>
            <p className="mt-1 whitespace-pre-line">{challenger.deviceLabel || 'Unknown device'}</p>
          </div>
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onApprove}
          disabled={loading}
          className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
        >
          Logout &amp; Allow New Login
        </button>
        <button
          type="button"
          onClick={onReject}
          disabled={loading}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          Close / Reject
        </button>
      </div>
    </ModalShell>
  );
}

export function WaitingTransferModal({ message }: { message?: string }) {
  return (
    <ModalShell title="Waiting for approval">
      <p className="text-sm text-slate-600">
        {message ||
          'Your login request was sent to the active session. Please wait while the other device approves or rejects.'}
      </p>
      <div className="mt-4 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    </ModalShell>
  );
}

export function InactivityWarningModal({
  onContinue,
  onLogout,
}: {
  onContinue: () => void;
  onLogout: () => void;
}) {
  return (
    <ModalShell title="Session expiring soon">
      <p className="mb-4 text-sm text-slate-600">
        Your session is about to expire due to inactivity. Choose Continue Session to stay signed in, or Logout.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onContinue}
          className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Continue Session
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          Logout
        </button>
      </div>
    </ModalShell>
  );
}

export function SessionMessageModal({
  title,
  message,
  onClose,
}: {
  title: string;
  message: string;
  onClose: () => void;
}) {
  return (
    <ModalShell title={title} onClose={onClose}>
      <p className="mb-4 text-sm text-slate-600">{message}</p>
      <button
        type="button"
        onClick={onClose}
        className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
      >
        OK
      </button>
    </ModalShell>
  );
}
