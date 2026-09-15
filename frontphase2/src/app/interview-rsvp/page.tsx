'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import InterviewRsvpClient from '../../components/interviews/InterviewRsvpClient';

/** Public RSVP entry: /interview-rsvp?token=…&action=accept (mobile-Gmail safe). */
export default function InterviewRsvpQueryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading interview…
        </div>
      }
    >
      <InterviewRsvpClient />
    </Suspense>
  );
}
