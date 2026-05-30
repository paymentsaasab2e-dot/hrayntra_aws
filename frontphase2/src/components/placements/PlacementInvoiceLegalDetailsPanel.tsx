'use client';

import React from 'react';
import type { BillingSettingsSnapshot, RecruitmentInvoiceData } from '../../types/recruitmentInvoice';
import { buildPlacementInvoiceAgreementRows } from '../../lib/placementInvoiceDisplay';

type PlacementInvoiceLegalDetailsPanelProps = {
  invoice: RecruitmentInvoiceData | null;
  settings?: BillingSettingsSnapshot | null;
  clientName?: string;
  loading?: boolean;
  hasClient?: boolean;
};

export function PlacementInvoiceLegalDetailsPanel({
  invoice,
  settings,
  clientName,
  loading,
  hasClient,
}: PlacementInvoiceLegalDetailsPanelProps) {
  if (!hasClient) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
        <p className="text-xs font-semibold text-slate-700">Terms, payment &amp; KYC</p>
        <p className="mt-1 text-xs text-slate-500">
          Select a job or placement to load agreement terms, bank details, and signatories from the
          client record.
        </p>
      </div>
    );
  }

  const rows = buildPlacementInvoiceAgreementRows(invoice, settings);
  const missingCount = rows.filter((r) => r.missing).length;

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-indigo-950">Terms, payment &amp; KYC</p>
          <p className="text-[11px] text-slate-600 mt-0.5">
            From client agreement &amp; post-service KYC
            {clientName ? ` — ${clientName}` : ''}
          </p>
        </div>
        {!loading && invoice ? (
          <span
            className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded ${
              missingCount > 0
                ? 'bg-amber-100 text-amber-800'
                : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            {missingCount > 0 ? `${missingCount} not on file` : 'Complete'}
          </span>
        ) : null}
      </div>

      {loading ? (
        <p className="text-xs text-slate-500 animate-pulse">Loading client agreement &amp; KYC…</p>
      ) : (
        <>
          <p className="text-[10px] text-slate-500">
            Shown on invoice page 2 (preview below). Missing fields appear as &quot;Not available&quot;.
          </p>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
            {rows.map((row) => (
              <div key={row.label} className="min-w-0">
                <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500 truncate">
                  {row.label}
                </dt>
                <dd
                  className={`text-xs mt-0.5 break-words ${
                    row.missing ? 'italic text-slate-400' : 'font-medium text-slate-800'
                  }`}
                >
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </div>
  );
}
