import React, { Suspense } from 'react';

/** Full-width page without app sidebar (CV Parser / demo AI overview). */
export default function DemoAiLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
          <p className="text-sm text-slate-600">Loading…</p>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
