'use client';

import React, { forwardRef } from 'react';
import type { BillingSettingsSnapshot, RecruitmentInvoiceData } from '../../types/recruitmentInvoice';
import { INVOICE_FIELD_NOT_AVAILABLE } from '../../lib/placementInvoiceDisplay';
import { convertAmount, formatCurrencyAmount } from '../../utils/currency';
import { amountToWords } from '../../utils/amountToWords';
import { formatDateDMY } from '../../utils/dateDisplay';

function formatMoney(amount: number, currency: string, fractionDigits = 2) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(amount || 0);
  } catch {
    return `${currency || 'USD'} ${(amount || 0).toFixed(fractionDigits)}`;
  }
}

function formatDateDisplay(iso?: string | null) {
  if (!iso) return '—';
  const formatted = formatDateDMY(iso);
  return formatted || iso;
}

function TermLine({ label, value }: { label: string; value: string }) {
  const missing = value === INVOICE_FIELD_NOT_AVAILABLE;
  return (
    <p className="font-sans text-xs">
      <span className="text-slate-500">{label}: </span>
      <span className={missing ? 'italic text-slate-400' : 'font-medium text-slate-800'}>{value}</span>
    </p>
  );
}

function BankBlock({
  title,
  bank,
}: {
  title: string;
  bank?: RecruitmentInvoiceData['sellerBank'] | null;
}) {
  const rows = bank
    ? [
        { label: 'Account name', value: bank.accountHolderName || INVOICE_FIELD_NOT_AVAILABLE },
        { label: 'Bank', value: bank.bankName || INVOICE_FIELD_NOT_AVAILABLE },
        { label: 'Account number', value: bank.accountNumber || INVOICE_FIELD_NOT_AVAILABLE },
        { label: 'SWIFT / IFSC', value: bank.swiftCode || INVOICE_FIELD_NOT_AVAILABLE },
      ]
    : [
        { label: 'Account name', value: INVOICE_FIELD_NOT_AVAILABLE },
        { label: 'Bank', value: INVOICE_FIELD_NOT_AVAILABLE },
        { label: 'Account number', value: INVOICE_FIELD_NOT_AVAILABLE },
        { label: 'SWIFT / IFSC', value: INVOICE_FIELD_NOT_AVAILABLE },
      ];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 font-sans space-y-1">
      <p className="font-bold text-slate-800 uppercase tracking-wider text-[10px] mb-1">{title}</p>
      {rows.map((row) => (
        <TermLine key={row.label} label={row.label} value={row.value} />
      ))}
      {bank?.bankAddress ? (
        <p className="text-xs text-slate-600 whitespace-pre-line pt-1">{bank.bankAddress}</p>
      ) : null}
    </div>
  );
}

function SignatureBlock({
  block,
}: {
  block: NonNullable<RecruitmentInvoiceData['clientSignatory']>;
}) {
  return (
    <div className="flex-1 min-w-[200px]">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-sans mb-1">
        {block.label}
      </p>
      <p
        className={`text-sm font-semibold ${
          block.name === INVOICE_FIELD_NOT_AVAILABLE ? 'italic text-slate-400' : 'text-slate-900'
        }`}
      >
        {block.name}
      </p>
      {block.designation ? (
        <p className="text-xs text-slate-600 mt-0.5">{block.designation}</p>
      ) : block.name !== INVOICE_FIELD_NOT_AVAILABLE ? (
        <p className="text-xs text-slate-400 italic mt-0.5">{INVOICE_FIELD_NOT_AVAILABLE}</p>
      ) : null}
      {block.signatureImageUrl ? (
        <img
          src={block.signatureImageUrl}
          alt={`${block.label} signature`}
          className="mt-3 max-h-14 object-contain object-left"
        />
      ) : (
        <div className="mt-8 h-14 border-b border-slate-400" />
      )}
      <p className="text-[10px] text-slate-500 font-sans mt-1">Authorized signature</p>
    </div>
  );
}

type RecruitmentInvoicePreviewProps = {
  invoice: RecruitmentInvoiceData;
  settings?: BillingSettingsSnapshot | null;
  compact?: boolean;
  /** When set, monetary amounts are converted from invoice currency for display (preview only). */
  displayCurrency?: string;
};

export const RecruitmentInvoicePreview = forwardRef<HTMLDivElement, RecruitmentInvoicePreviewProps>(
  function RecruitmentInvoicePreview({ invoice, settings, compact, displayCurrency }, ref) {
    const taxLabel = settings?.taxLabel || 'Tax';
    const baseCurrency = (invoice.currency || 'USD').toUpperCase();
    const showCurrency = (displayCurrency || baseCurrency).toUpperCase();
    const isConvertedPreview = showCurrency !== baseCurrency;

    const displayAmount = (amount: number) =>
      isConvertedPreview
        ? convertAmount(amount, baseCurrency, showCurrency)
        : Number(amount || 0);

    const money = (amount: number) => formatMoney(displayAmount(amount), showCurrency);
    const sellerBank =
      invoice.sellerBank ||
      (settings?.bankName
        ? {
            bankName: settings.bankName,
            accountHolderName: settings.companyName,
            accountNumber: settings.accountNumber,
            swiftCode: settings.swiftCode,
          }
        : null);
    const clientSignatory = invoice.clientSignatory || {
      label: 'Client',
      name: INVOICE_FIELD_NOT_AVAILABLE,
    };
    const agencySignatory = invoice.agencySignatory || {
      label: 'Agency',
      name: settings?.companyName || INVOICE_FIELD_NOT_AVAILABLE,
      designation: 'For and on behalf of the agency',
    };

    return (
      <div
        ref={ref}
        className={`bg-white text-slate-800 ${compact ? 'text-[11px]' : 'text-sm'}`}
        style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
      >
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          {/* Page 1 — invoice summary */}
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
                {isConvertedPreview ? (
                  <p className="mt-1 text-[10px] text-indigo-600">
                    Preview in {showCurrency} · stored as {baseCurrency}
                  </p>
                ) : null}
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
                  {invoice.legalTerms?.agreementLevel ? (
                    <p className="text-xs mt-1">
                      <span className="text-slate-500">Agreement level:</span>{' '}
                      <span className="font-medium">{invoice.legalTerms.agreementLevel}</span>
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
                    <td className="py-2.5 px-2 text-right text-slate-600">{money(item.price)}</td>
                    <td className="py-2.5 pl-2 text-right font-medium text-slate-900">{money(item.total)}</td>
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
                  <span>{money(invoice.subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>
                    {taxLabel} ({invoice.taxRate}%)
                  </span>
                  <span>{money(invoice.taxAmount)}</span>
                </div>
                <div className="flex justify-between border-t-2 border-slate-800 pt-2 text-base font-bold text-slate-900">
                  <span>Total due</span>
                  <span>{money(invoice.total)}</span>
                </div>
              </div>
            </div>

            <p className="text-xs italic text-slate-600 border-t border-slate-100 pt-4">
              Amount in words:{' '}
              {amountToWords(displayAmount(invoice.total), showCurrency)}
              {isConvertedPreview ? (
                <span className="text-slate-400 not-italic">
                  {' '}
                  (invoice stored: {formatCurrencyAmount(invoice.total, baseCurrency)})
                </span>
              ) : null}
            </p>

            {invoice.notes ? (
              <div className="font-sans">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Notes</p>
                <p className="text-xs text-slate-600 whitespace-pre-line">{invoice.notes}</p>
              </div>
            ) : null}

            <p className="text-[10px] text-indigo-600 font-sans border-t border-dashed border-indigo-200 pt-3">
              Scroll down in preview for terms &amp; conditions, bank details, and signatures (page 2).
            </p>
          </div>

          {/* Page 2 — always shown for placement invoices */}
          <div
            className={`${compact ? 'p-4' : 'p-8'} space-y-6 border-t-2 border-slate-300 bg-slate-50/40`}
            style={{ breakBefore: 'page', pageBreakBefore: 'always' } as React.CSSProperties}
          >
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400 font-sans">
              Terms, payment &amp; authorization
            </p>

            <div className="rounded-lg border border-slate-200 bg-white p-4 font-sans">
              <p className="font-bold text-slate-900 uppercase tracking-wider text-[10px] mb-2">
                Terms &amp; conditions
              </p>
              {invoice.termsAndConditions?.trim() ? (
                <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                  {invoice.termsAndConditions}
                </p>
              ) : (
                <p className="text-xs text-slate-400 italic">{INVOICE_FIELD_NOT_AVAILABLE}</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4">
              <BankBlock title="Agency bank account" bank={sellerBank} />
            </div>

            <div className="flex flex-wrap gap-8 pt-4 border-t border-slate-200">
              <SignatureBlock block={clientSignatory} />
              <SignatureBlock block={agencySignatory} />
            </div>

            <p className="text-[10px] text-slate-500 font-sans italic">
              This invoice is issued under the recruitment services agreement between the parties. Retain a signed
              copy for your records.
            </p>
          </div>
        </div>
      </div>
    );
  },
);
