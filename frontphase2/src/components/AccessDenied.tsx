'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Lock, ArrowLeft } from 'lucide-react';

export const AccessDenied: React.FC = () => {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] bg-white rounded-xl border border-slate-200 p-12">
      <div className="size-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
        <Lock className="size-8 text-slate-400" />
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Access Restricted</h2>
      <p className="text-sm text-slate-600 text-center max-w-md mb-6">
        You don't have permission to view this section. Contact your administrator if you need access.
      </p>
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
      >
        <ArrowLeft size={16} />
        Go back
      </button>
    </div>
  );
};
