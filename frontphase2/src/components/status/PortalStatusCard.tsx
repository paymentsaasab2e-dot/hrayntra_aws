'use client';

import type { PortalStatusCopy } from '../../lib/portalStatusCopy';

export function PortalStatusCard({
  title,
  message,
  trigger,
}: PortalStatusCopy & { trigger?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {trigger ? (
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{trigger}</p>
      ) : null}
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{message}</p>
    </div>
  );
}
