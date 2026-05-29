'use client';

import React, { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

function SessionTransferResult() {
  const searchParams = useSearchParams();
  const status = (searchParams.get('status') || 'unknown').toLowerCase();
  const message = searchParams.get('message') || '';

  const content = useMemo(() => {
    switch (status) {
      case 'approved':
        return {
          icon: <CheckCircle2 className="h-12 w-12 text-emerald-600" />,
          title: 'Approval Done',
          body:
            message ||
            'The new device may now complete sign-in. Your previous session has been ended.',
        };
      case 'rejected':
        return {
          icon: <XCircle className="h-12 w-12 text-rose-600" />,
          title: 'Login request rejected',
          body: message || 'The duplicate login attempt was declined. Your current session stays active.',
        };
      case 'expired':
        return {
          icon: <AlertCircle className="h-12 w-12 text-amber-600" />,
          title: 'Request expired',
          body: message || 'This login request is no longer valid. Ask the user to try signing in again.',
        };
      case 'already_resolved':
        return {
          icon: <CheckCircle2 className="h-12 w-12 text-emerald-600" />,
          title: 'Approval Done',
          body: message || 'This login request was already approved.',
        };
      default:
        return {
          icon: <AlertCircle className="h-12 w-12 text-slate-500" />,
          title: 'Unable to process request',
          body: message || 'The link may be invalid or expired.',
        };
    }
  }, [message, status]);

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg text-center">
        <div className="flex justify-center mb-4">{content.icon}</div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">{content.title}</h1>
        <p className="text-sm text-slate-600 mb-6">{content.body}</p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Go to login
        </Link>
      </div>
    </div>
  );
}

export default function SessionTransferPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-100 flex items-center justify-center text-sm text-slate-600">
          Loading…
        </div>
      }
    >
      <SessionTransferResult />
    </Suspense>
  );
}
