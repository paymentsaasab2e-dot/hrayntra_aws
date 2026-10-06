'use client';

import { Suspense } from 'react';
import { CandidateListPage } from './CandidateListPage';

export const dynamic = 'force-dynamic';

export default function CandidatesPage() {
  return (
    <Suspense fallback={<div className="w-full min-h-screen bg-[#f8fafc] flex items-center justify-center">Loading...</div>}>
      <CandidateListPage />
    </Suspense>
  );
}
