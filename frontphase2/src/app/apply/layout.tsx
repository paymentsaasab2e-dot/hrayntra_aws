import React, { Suspense } from 'react';

export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <p className="text-slate-600">Loading application…</p>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
