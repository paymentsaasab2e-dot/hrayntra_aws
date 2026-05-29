'use client';

import React from 'react';
import type { AuditMeta } from '../../types/audit';
import { formatAuditDate, formatAuditUserLabel } from '../../utils/auditMeta';

interface TableAuditCellProps {
  audit?: AuditMeta | null;
  className?: string;
}

export function TableAuditColumnHeader({ className = '' }: { className?: string }) {
  return (
    <th className={`px-3 py-2 sm:px-4 ${className}`.trim()}>Record log</th>
  );
}

export function TableAuditCell({ audit, className = '' }: TableAuditCellProps) {
  const createdDate = formatAuditDate(audit?.createdAt);
  const updatedDate = formatAuditDate(audit?.updatedAt);
  const createdBy = formatAuditUserLabel(audit?.createdBy);
  const updatedBy = formatAuditUserLabel(audit?.updatedBy);

  return (
    <td className={`px-3 py-2 sm:px-4 align-top ${className}`.trim()}>
      <div className="space-y-1.5 text-[10px] leading-snug text-slate-600 min-w-[9.5rem]">
        <div>
          <span className="font-semibold uppercase tracking-wide text-slate-400">Created</span>
          <p className="mt-0.5 text-slate-700">
            {createdDate}
            <span className="text-slate-400"> · </span>
            <span className="font-medium text-slate-800">{createdBy}</span>
          </p>
        </div>
        <div>
          <span className="font-semibold uppercase tracking-wide text-slate-400">Updated</span>
          <p className="mt-0.5 text-slate-700">
            {updatedDate}
            <span className="text-slate-400"> · </span>
            <span className="font-medium text-slate-800">{updatedBy}</span>
          </p>
        </div>
      </div>
    </td>
  );
}

interface EntityAuditSummaryProps {
  audit?: AuditMeta | null;
  className?: string;
}

/** Compact summary for drawer Activity tabs. */
export function EntityAuditSummary({ audit, className = '' }: EntityAuditSummaryProps) {
  if (!audit?.createdAt && !audit?.updatedAt) return null;

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700 ${className}`.trim()}
    >
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Record log</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <span className="text-[11px] font-semibold uppercase text-slate-400">Created</span>
          <p className="mt-0.5">
            {formatAuditDate(audit.createdAt)}
            <span className="text-slate-400"> · </span>
            <span className="font-medium text-slate-900">{formatAuditUserLabel(audit.createdBy)}</span>
          </p>
        </div>
        <div>
          <span className="text-[11px] font-semibold uppercase text-slate-400">Updated</span>
          <p className="mt-0.5">
            {formatAuditDate(audit.updatedAt)}
            <span className="text-slate-400"> · </span>
            <span className="font-medium text-slate-900">{formatAuditUserLabel(audit.updatedBy)}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
