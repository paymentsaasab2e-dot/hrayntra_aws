'use client';

import React, { forwardRef } from 'react';
import type { BillingSettingsSnapshot, RecruitmentInvoiceData } from '../../types/recruitmentInvoice';
import { amountToWords } from '../../utils/amountToWords';

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  } catch {
    return `${currency || 'USD'} ${(amount || 0).toFixed(2)}`;
  }
}

function formatDateDisplay(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

type RecruitmentInvoicePreviewProps = {
  invoice: RecruitmentInvoiceData;
  settings?: BillingSettingsSnapshot | null;
  compact?: boolean;
};

export const RecruitmentInvoicePreview = forwardRef<HTMLDivElement, RecruitmentInvoicePreviewProps>(
  function RecruitmentInvoicePreview({ invoice, settings, compact }, ref) {
    const taxLabel = settings?.taxLabel || 'Tax';
    const bankName = settings?.bankName;
    const accountNumber = settings?.accountNumber;
    const swiftCode = settings?.swiftCode;
    const paymentTerms = settings?.defaultPaymentTerms;

    return (
      <div
        ref={ref}
        className={`bg-white text-slate-800 ${compact ? 'text-[11px]' : 'text-sm'}`}
        style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
      >
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className={`${compact ? 'p-4' : 'p-8'} space-y-6`}>
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400 font-sans">Recruitment invoice</p>
                <h1 className={`${compact ? 'text-2xl' : 'text-3xl'} font-bold text-slate-900 mt-1`}>
                  {invoice.seller.name || 'Invoice'}
                </h1>
                {invoice.seller.address ? (
                  <p className="mt-2 text-slate-600 max-w-xs font-sans text-xs leading-relaxed whitespace-pre-line">
                    {invoice.seller.address}
                    {[invoice.seller.city, invoice.seller.state, invoice.seller.country].filter(Boolean).length
                      ? `\n${[invoice.seller.city, invoice.seller.state, invoice.seller.country].filter(Boolean).join(', ')}`
                      : ''}
                  </p>
                ) : null}
                {(invoice.seller.email || invoice.seller.phone) && (
                  <p className="mt-1 text-xs text-slate-500 font-sans">
                    {[invoice.seller.email, invoice.seller.phone].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <div className="text-right font-sans">
                <p className="text-xs uppercase tracking-wider text-slate-400">Invoice</p>
                <p className="text-lg font-bold text-slate-900">{invoice.invoiceNo}</p>
                <p className="mt-2 text-xs text-slate-500">
                  Date: <span className="text-slate-800">{formatDateDisplay(invoice.invoiceDate)}</span>
                </p>
                <p className="text-xs text-slate-500">
                  Due: <span className="text-slate-800">{formatDateDisplay(invoice.dueDate)}</span>
                </p>
                <span
                  className={`inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    invoice.status === 'SENT'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {invoice.status}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 font-sans">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Bill to</p>
                <p className="font-semibold text-slate-900">{invoice.buyer.name || '—'}</p>
                {invoice.buyer.address ? (
                  <p className="text-xs text-slate-600 mt-1 whitespace-pre-line">{invoice.buyer.address}</p>
                ) : null}
                {(invoice.buyer.email || invoice.buyer.phone) && (
                  <p className="text-xs text-slate-500 mt-1">
                    {[invoice.buyer.email, invoice.buyer.phone].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              {invoice.placementSummary ? (
                <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Placement</p>
                  {invoice.placementSummary.candidateName ? (
                    <p className="text-xs">
                      <span className="text-slate-500">Candidate:</span>{' '}
                      <span className="font-medium">{invoice.placementSummary.candidateName}</span>
                    </p>
                  ) : null}
                  {invoice.placementSummary.jobTitle ? (
                    <p className="text-xs mt-1">
                      <span className="text-slate-500">Role:</span>{' '}
                      <span className="font-medium">{invoice.placementSummary.jobTitle}</span>
                    </p>
                  ) : null}
                  {invoice.placementSummary.clientName ? (
                    <p className="text-xs mt-1">
                      <span className="text-slate-500">Client:</span>{' '}
                      <span className="font-medium">{invoice.placementSummary.clientName}</span>
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <table className="w-full font-sans border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-800 text-left text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="py-2 pr-2">Description</th>
                  <th className="py-2 px-2 text-right w-16">Qty</th>
                  <th className="py-2 px-2 text-right w-24">Rate</th>
                  <th className="py-2 pl-2 text-right w-28">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((item, idx) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="py-2.5 pr-2 text-slate-800">{item.name || '—'}</td>
                    <td className="py-2.5 px-2 text-right text-slate-600">{item.quantity}</td>
                    <td className="py-2.5 px-2 text-right text-slate-600">
                      {formatMoney(item.price, invoice.currency)}
                    </td>
                    <td className="py-2.5 pl-2 text-right font-medium text-slate-900">
                      {formatMoney(item.total, invoice.currency)}
                    </td>
                  </tr>
                ))}
                {invoice.additionalCharges.map((charge, idx) => (
                  <tr key={`charge-${idx}`} className="border-b border-slate-100">
                    <td className="py-2.5 pr-2 text-slate-800">{charge.name}</td>
                    <td className="py-2.5 px-2 text-right text-slate-400">—</td>
                    <td className="py-2.5 px-2 text-right text-slate-400">—</td>
                    <td className="py-2.5 pl-2 text-right font-medium text-slate-900">
                      {formatMoney(charge.amount, invoice.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end font-sans">
              <div className="w-full max-w-xs space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>{formatMoney(invoice.subtotal, invoice.currency)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>
                    {taxLabel} ({invoice.taxRate}%)
                  </span>
                  <span>{formatMoney(invoice.taxAmount, invoice.currency)}</span>
                </div>
                <div className="flex justify-between border-t-2 border-slate-800 pt-2 text-base font-bold text-slate-900">
                  <span>Total due</span>
                  <span>{formatMoney(invoice.total, invoice.currency)}</span>
                </div>
              </div>
            </div>

            <p className="text-xs italic text-slate-600 border-t border-slate-100 pt-4">
              Amount in words: {amountToWords(invoice.total, invoice.currency)}
            </p>

            {invoice.notes ? (
              <div className="font-sans">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Notes</p>
                <p className="text-xs text-slate-600 whitespace-pre-line">{invoice.notes}</p>
              </div>
            ) : null}

            {(bankName || accountNumber || paymentTerms) && (
              <div className="rounded-lg bg-slate-50 border border-slate-100 p-4 font-sans text-xs text-slate-600 space-y-1">
                <p className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">Payment details</p>
                {paymentTerms ? <p>Terms: {paymentTerms}</p> : null}
                {bankName ? <p>Bank: {bankName}</p> : null}
                {accountNumber ? <p>Account: {accountNumber}</p> : null}
                {swiftCode ? <p>SWIFT / IFSC: {swiftCode}</p> : null}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },
);
