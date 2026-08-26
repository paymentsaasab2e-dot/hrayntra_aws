'use client';

import React, { forwardRef } from 'react';
import type { BillingSettingsSnapshot, RecruitmentInvoiceData } from '../../types/recruitmentInvoice';
import { INVOICE_FIELD_NOT_AVAILABLE } from '../../lib/placementInvoiceDisplay';
import { convertAmount, formatCurrencyAmount } from '../../utils/currency';
import { amountToWords } from '../../utils/amountToWords';
import { formatDateDMY } from '../../utils/dateDisplay';
import { resolveCustomColumnValue } from '../../lib/invoiceTemplates';

function formatMoney(amount: number, currency: string, fractionDigits = 0) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(amount || 0);
  } catch {
    return `${(amount || 0).toFixed(fractionDigits)}`;
  }
}

function formatDateDisplay(iso?: string | null) {
  if (!iso) return '—';
  const formatted = formatDateDMY(iso);
  return formatted || iso;
}

function formatRate(value?: number | null) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const n = Number(value);
  return `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}%`;
}

type RecruitmentInvoicePreviewProps = {
  invoice: RecruitmentInvoiceData;
  settings?: BillingSettingsSnapshot | null;
  compact?: boolean;
  /** When set, monetary amounts are converted from invoice currency for display (preview only). */
  displayCurrency?: string;
};

/**
 * SAASA-style recruitment invoice: logo left, firm name right, client + terms,
 * Description | Qty | Monthly Salary | Rate | Total, bank + stamp/sign, footer.
 */
export const RecruitmentInvoicePreview = forwardRef<HTMLDivElement, RecruitmentInvoicePreviewProps>(
  function RecruitmentInvoicePreview({ invoice, settings, compact, displayCurrency }, ref) {
    const baseCurrency = (invoice.currency || settings?.defaultCurrency || 'USD').toUpperCase();
    const showCurrency = (displayCurrency || baseCurrency).toUpperCase();
    const isConvertedPreview = showCurrency !== baseCurrency;
    const style = settings?.invoiceTemplateStyle === 'classic' ? 'classic' : 'saasa';

    const displayAmount = (amount: number) =>
      isConvertedPreview
        ? convertAmount(amount, baseCurrency, showCurrency)
        : Number(amount || 0);

    const money = (amount: number, digits = 0) => formatMoney(displayAmount(amount), showCurrency, digits);
    const sellerBank =
      invoice.sellerBank ||
      (settings?.bankName
        ? {
            bankName: settings.bankName,
            accountHolderName: settings.accountHolderName || settings.companyName,
            accountNumber: settings.accountNumber,
            iban: settings.iban,
            swiftCode: settings.swiftCode,
            bankAddress: settings.bankAddress,
          }
        : null);

    const agencySignatory = invoice.agencySignatory || {
      label: 'Agency',
      name: settings?.authorizedSignatoryName || settings?.companyName || INVOICE_FIELD_NOT_AVAILABLE,
      designation: settings?.authorizedSignatoryDesignation || 'Authorized Signatory',
      signatureImageUrl: settings?.agencySignatureUrl || undefined,
    };

    const showLogo = settings?.showLogo !== false && Boolean(settings?.agencyLogoUrl);
    const showStamp = settings?.showStamp !== false && Boolean(settings?.agencyStampUrl);
    const showSignature =
      settings?.showSignature !== false && Boolean(agencySignatory.signatureImageUrl);

    const companyName = invoice.seller.name || settings?.companyName || 'Invoice';
    const locationLine =
      settings?.companyLocationLine ||
      [invoice.seller.city, invoice.seller.country].filter(Boolean).join(', ') ||
      '';
    const termsText =
      invoice.termsAndConditions?.trim() ||
      settings?.defaultTermsAndConditions?.trim() ||
      '';
    const footerLine =
      settings?.companyFooterLine ||
      [
        invoice.seller.address,
        invoice.seller.email,
        settings?.companyWebsite,
        invoice.seller.phone,
      ]
        .filter(Boolean)
        .join(' | ');

    const rateFallback = invoice.legalTerms?.serviceChargePercent ?? null;
    const joiningDate = invoice.placementSummary?.joiningDate;
    const customColumns = invoice.customColumns || [];

    if (style === 'classic') {
      return (
        <div
          ref={ref}
          className={`bg-white text-slate-800 font-sans ${compact ? 'text-[11px] p-4' : 'text-sm p-8'}`}
        >
          <h1 className="text-2xl font-bold">{companyName}</h1>
          <p className="text-slate-500">Invoice {invoice.invoiceNo}</p>
          <p className="mt-4 font-semibold">{invoice.buyer.name}</p>
          <table className="mt-6 w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-300 text-left text-xs uppercase text-slate-500">
                <th className="py-2">Description</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems.map((item, idx) => (
                <tr key={idx} className="border-b border-slate-100">
                  <td className="py-2">{item.name}</td>
                  <td className="py-2 text-right">{money(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 font-bold text-right">
            Total {showCurrency} {money(invoice.total)}
          </p>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={`bg-white text-slate-900 ${compact ? 'text-[10px]' : 'text-[12px]'}`}
        style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
      >
        <div className={`${compact ? 'p-4' : 'px-10 py-8'} space-y-5`}>
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0 flex-1">
              {showLogo ? (
                <img
                  src={settings!.agencyLogoUrl!}
                  alt="Company logo"
                  className={`${compact ? 'max-h-14' : 'max-h-20'} max-w-[220px] object-contain object-left`}
                />
              ) : (
                <p
                  className={`${compact ? 'text-xl' : 'text-2xl'} font-black tracking-tight text-slate-900`}
                >
                  {companyName.split(/\s+/)[0] || 'LOGO'}
                </p>
              )}
              {settings?.companyTagline ? (
                <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-orange-600">
                  {settings.companyTagline}
                </p>
              ) : null}
              <div className="mt-3 space-y-0.5">
                <p className="font-bold text-slate-800">{companyName}</p>
                {locationLine ? <p className="text-slate-600">{locationLine}</p> : null}
              </div>
            </div>

            <div className="shrink-0 text-right">
              <p
                className={`${compact ? 'text-sm' : 'text-base'} font-bold uppercase tracking-wide text-slate-900`}
              >
                {companyName}
              </p>
              <p
                className={`${compact ? 'text-xl' : 'text-2xl'} mt-1 font-black tracking-wide text-slate-900`}
              >
                INVOICE
              </p>
              <div className="mt-3 space-y-1 text-left sm:text-right">
                <p>
                  <span className="font-bold">INVOICE NO.</span>{' '}
                  <span className="font-semibold">{invoice.invoiceNo}</span>
                </p>
                <p>
                  <span className="font-bold">DATE</span>{' '}
                  <span>{formatDateDisplay(invoice.invoiceDate)}</span>
                </p>
                {isConvertedPreview ? (
                  <p className="text-[9px] text-indigo-600">
                    Preview in {showCurrency} · stored as {baseCurrency}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <p className="font-bold text-slate-900">Client Name</p>
              <p className="mt-1 font-semibold text-slate-800">{invoice.buyer.name || '—'}</p>
              {invoice.buyer.address ? (
                <p className="mt-1 whitespace-pre-line text-slate-600">{invoice.buyer.address}</p>
              ) : null}
              {[invoice.buyer.city, invoice.buyer.state, invoice.buyer.country].filter(Boolean).length ? (
                <p className="text-slate-600">
                  {[invoice.buyer.city, invoice.buyer.state, invoice.buyer.country]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              ) : null}
            </div>
            <div>
              <p className="font-bold text-slate-900">Terms &amp; Conditions</p>
              {termsText ? (
                <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-slate-700">
                  {termsText
                    .split(/\n+/)
                    .map((line) => line.replace(/^\d+\.\s*/, '').trim())
                    .filter(Boolean)
                    .map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                </ol>
              ) : (
                <p className="mt-1 italic text-slate-400">{INVOICE_FIELD_NOT_AVAILABLE}</p>
              )}
            </div>
          </div>

          <div>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-y border-slate-800 text-left text-[11px] font-bold uppercase tracking-wide">
                  <th className="py-2 pr-2 font-bold">Description</th>
                  <th className="w-12 py-2 px-1 text-center font-bold">Qty</th>
                  <th className="w-28 py-2 px-1 text-right font-bold">
                    Monthly Salary
                    <span className="block text-[9px] font-semibold normal-case tracking-normal text-slate-500">
                      in {showCurrency}
                    </span>
                  </th>
                  <th className="w-16 py-2 px-1 text-right font-bold">Rate</th>
                  {customColumns.map((col) => (
                    <th key={col.id} className="w-20 py-2 px-1 text-right font-bold">
                      {col.name}
                    </th>
                  ))}
                  <th className="w-28 py-2 pl-1 text-right font-bold">
                    Total
                    <span className="block text-[9px] font-semibold normal-case tracking-normal text-slate-500">
                      in {showCurrency}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((item, idx) => {
                  const rate = item.ratePercent ?? rateFallback;
                  const salary = item.monthlySalary;
                  return (
                    <tr key={idx} className="align-top">
                      <td className="py-3 pr-2 leading-snug text-slate-800">
                        {item.name || '—'}
                        {joiningDate && !String(item.name || '').toLowerCase().includes('doj') ? (
                          <span className="block text-slate-500">
                            DOJ- {formatDateDisplay(joiningDate)}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 px-1 text-center text-slate-700">{item.quantity || 1}</td>
                      <td className="py-3 px-1 text-right text-slate-700">
                        {salary != null && Number.isFinite(Number(salary))
                          ? money(Number(salary))
                          : '—'}
                      </td>
                      <td className="py-3 px-1 text-right text-slate-700">{formatRate(rate)}</td>
                      {customColumns.map((col) => {
                        const resolved = resolveCustomColumnValue(
                          col,
                          item,
                          item.extraValues?.[col.id],
                        );
                        return (
                          <td key={col.id} className="py-3 px-1 text-right text-slate-700">
                            {col.formula === 'text' || col.formula === 'manual'
                              ? resolved.display
                              : resolved.numeric != null
                                ? money(resolved.numeric, 2)
                                : resolved.display}
                          </td>
                        );
                      })}
                      <td className="py-3 pl-1 text-right font-semibold text-slate-900">
                        {money(item.total)}
                      </td>
                    </tr>
                  );
                })}
                {invoice.additionalCharges.map((charge, idx) => (
                  <tr key={`c-${idx}`} className="align-top">
                    <td className="py-2 pr-2 text-slate-800">{charge.name}</td>
                    <td className="py-2 px-1 text-center text-slate-400">—</td>
                    <td className="py-2 px-1 text-right text-slate-400">—</td>
                    <td className="py-2 px-1 text-right text-slate-400">—</td>
                    {customColumns.map((col) => (
                      <td key={col.id} className="py-2 px-1 text-right text-slate-400">
                        —
                      </td>
                    ))}
                    <td className="py-2 pl-1 text-right font-semibold">{money(charge.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-slate-800" />
          </div>

          <div className="space-y-1 text-right">
            <p className="font-bold text-slate-900">
              Total amount in {showCurrency} {money(invoice.total)}
            </p>
            <p className="text-slate-700">
              Amount in Words - {amountToWords(displayAmount(invoice.total), showCurrency)}
            </p>
            {invoice.taxAmount > 0 ? (
              <p className="text-[10px] text-slate-500">
                Includes {settings?.taxLabel || 'Tax'} ({invoice.taxRate}%):{' '}
                {money(invoice.taxAmount, 2)}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-8 pt-2 sm:grid-cols-2">
            <div>
              <p className="font-bold text-slate-900">Bank Details</p>
              <div className="mt-2 space-y-1 text-slate-700">
                <p>
                  <span className="font-semibold">Bank Name -</span>{' '}
                  {sellerBank?.bankName || INVOICE_FIELD_NOT_AVAILABLE}
                </p>
                <p>
                  <span className="font-semibold">Account Name -</span>{' '}
                  {sellerBank?.accountHolderName ||
                    settings?.companyName ||
                    INVOICE_FIELD_NOT_AVAILABLE}
                </p>
                <p>
                  <span className="font-semibold">Account Number -</span>{' '}
                  {sellerBank?.accountNumber || INVOICE_FIELD_NOT_AVAILABLE}
                </p>
                <p>
                  <span className="font-semibold">IBAN -</span>{' '}
                  {sellerBank?.iban || INVOICE_FIELD_NOT_AVAILABLE}
                </p>
                <p>
                  <span className="font-semibold">BIC CODE -</span>{' '}
                  {sellerBank?.swiftCode || INVOICE_FIELD_NOT_AVAILABLE}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center justify-end text-center">
              <div className="relative flex min-h-[100px] w-full max-w-[200px] flex-col items-center justify-center">
                {showStamp ? (
                  <img
                    src={settings!.agencyStampUrl!}
                    alt="Company stamp"
                    className="absolute inset-0 m-auto max-h-28 max-w-[180px] object-contain opacity-90"
                  />
                ) : null}
                {showSignature ? (
                  <img
                    src={agencySignatory.signatureImageUrl!}
                    alt="Authorized signature"
                    className="relative z-10 max-h-16 max-w-[160px] object-contain"
                  />
                ) : !showStamp ? (
                  <div className="h-16 w-40 border-b border-slate-400" />
                ) : null}
              </div>
              <p className="mt-2 font-semibold text-slate-800">Authorized Signatory</p>
              {agencySignatory.name && agencySignatory.name !== INVOICE_FIELD_NOT_AVAILABLE ? (
                <p className="text-[10px] text-slate-500">{agencySignatory.name}</p>
              ) : null}
            </div>
          </div>

          {footerLine ? (
            <p className="border-t border-slate-200 pt-4 text-center text-[9px] leading-relaxed text-slate-500">
              {footerLine}
            </p>
          ) : null}
        </div>
      </div>
    );
  },
);
