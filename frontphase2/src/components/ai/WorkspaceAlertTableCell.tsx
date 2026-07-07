'use client';

import React from 'react';
import type { AiWorkspaceBriefAlert } from '@/lib/apiAiWorkspaceBrief';

export function WorkspaceAlertTableHeader({ className = '' }: { className?: string }) {
  return <th className={`px-3 sm:px-4 py-2 ${className}`.trim()}>AI Alert</th>;
}

export function WorkspaceAlertTableCell({ alerts }: { alerts?: AiWorkspaceBriefAlert[] }) {
  const top = alerts?.[0];
  if (!top) {
    return <span className="text-[11px] text-slate-400">—</span>;
  }

  return (
    <div className="flex flex-col gap-0.5">
      <span
        className="inline-flex max-w-[11rem] items-center rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800 ring-1 ring-rose-200/80"
        title={top.detail || top.title}
      >
        {top.title}
      </span>
      {(alerts?.length ?? 0) > 1 ? (
        <span className="text-[10px] font-medium text-rose-600">+{alerts!.length - 1} more</span>
      ) : null}
    </div>
  );
}
