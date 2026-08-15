'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function ApprovalRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const q = new URLSearchParams();
    q.set('view', 'approvals');
    const tab = searchParams.get('tab');
    if (tab) q.set('tab', tab);
    router.replace(`/request?${q.toString()}`);
  }, [router, searchParams]);

  return <div className="p-6 text-sm text-slate-500">Opening approvals…</div>;
}

export default function RequestApprovalPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading…</div>}>
      <ApprovalRedirect />
    </Suspense>
  );
}
