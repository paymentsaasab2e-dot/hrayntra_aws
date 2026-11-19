'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';

/** Secondary actions stay in the header row so a scrolling bar does not clip them. */
export function HeaderMore({ children }: { children: React.ReactNode }) {
  return (
    <details className="group flex shrink-0 items-center">
      <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-1 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 [&::-webkit-details-marker]:hidden">
        More
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
      </summary>
      <div className="ml-1.5 flex items-center gap-1.5">{children}</div>
    </details>
  );
}
