'use client';

import React from 'react';
import type {
  BillingSettingsSnapshot,
  InvoiceBankDetails,
  RecruitmentInvoiceData,
} from '../../types/recruitmentInvoice';
import { BillingCurrencyAmount } from '../billing/BillingCurrencyAmount';
import { INVOICE_FIELD_NOT_AVAILABLE } from '../../lib/placementInvoiceDisplay';

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30';
const labelClass = 'text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block';

type PlacementInvoiceEditableSidePanelProps = {
  invoice: RecruitmentInvoiceData;
  settings?: BillingSettingsSnapshot | null;
  loadingClient?: boolean;
  hasClient?: boolean;
  clientName?: string;
  onUpdate: (patch: Partial<RecruitmentInvoiceData>) => void;
  onTermsUserEdit?: () => void;
  onUpdateSellerBank: (patch: Partial<InvoiceBankDetails>) => void;
  onUpdateAgencySignatory: (patch: {
    name?: string;
    designation?: string;
    signatureImageUrl?: string;
  }) => void;
  previewCurrency: string;
  onPreviewCurrencyChange?: (currency: string) => void;
};

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  const missing = !value || value === INVOICE_FIELD_NOT_AVAILABLE;
  return (
    <div>
      <span className={labelClass}>{label}</span>
      <p
        className={`text-xs rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 ${
          missing ? 'italic text-slate-400' : 'text-slate-800'
        }`}
      >
        {value || INVOICE_FIELD_NOT_AVAILABLE}
      </p>
    </div>
  );
}

export function PlacementInvoiceEditableSidePanel({
  invoice,
  settings,
  loadingClient,
  hasClient,
  clientName,
  onUpdate,
  onTermsUserEdit,
  onUpdateSellerBank,
  onUpdateAgencySignatory,
  previewCurrency,
  onPreviewCurrencyChange,
}: PlacementInvoiceEditableSidePanelProps) {
  const legal = invoice.legalTerms;
  const buyerBank = invoice.buyerBank;
  const sellerBank = invoice.sellerBank;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-4 space-y-3">
        <div>
          <p className="text-xs font-semibold text-indigo-950">Terms &amp; conditions</p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Shown on invoice page 2{clientName ? ` · ${clientName}` : ''}. Edit as needed.
          </p>
        </div>
        {loadingClient ? (
          <p className="text-xs text-slate-500 animate-pulse">Loading from client agreement…</p>
        ) : (
          <textarea
            className={`${inputClass} min-h-[140px] font-mono text-xs leading-relaxed`}
            value={invoice.termsAndConditions || ''}
            onChange={(e) => {
              onTermsUserEdit?.();
              onUpdate({ termsAndConditions: e.target.value });
            }}
            placeholder={
              hasClient
                ? 'Agreement terms will appear here when the client loads…'
                : 'Select a job to load agreement terms'
            }
          />
        )}
      </div>

      {hasClient ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-800">Client agreement (read-only)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ReadOnlyRow label="Agreement level" value={legal?.agreementLevel || ''} />
            <ReadOnlyRow
              label="Commission % (agreement)"
              value={
                legal?.serviceChargePercent != null
                  ? `${legal.serviceChargePercent}%`
                  : ''
              }
            />
            <p className="text-[10px] text-slate-500 sm:col-span-2 -mt-1">
              Placement fee = offer salary × this % (synced to the Commission field above the line
              items).
            </p>
            <ReadOnlyRow label="Payment terms" value={legal?.paymentTerms || ''} />
            <ReadOnlyRow
              label="Advance payment"
              value={
                legal?.advancePaymentPercent != null && legal.advancePaymentPercent > 0
                  ? `${legal.advancePaymentPercent}%`
                  : ''
              }
            />
            <ReadOnlyRow
              label="Free replacement"
              value={legal?.freeReplacementText || ''}
            />
            <ReadOnlyRow
              label="Agreement validity"
              value={legal?.agreementValidNote || legal?.contractValidity || ''}
            />
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <p className="text-xs font-semibold text-slate-800">Client bank (from KYC)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ReadOnlyRow
            label="Account name"
            value={buyerBank?.accountHolderName || ''}
          />
          <ReadOnlyRow label="Bank" value={buyerBank?.bankName || ''} />
          <ReadOnlyRow label="Account number" value={buyerBank?.accountNumber || ''} />
          <ReadOnlyRow label="SWIFT / IFSC" value={buyerBank?.swiftCode || ''} />
        </div>
      </div>

      <div className="rounded-xl border border-emerald-100 bg-emerald-50/20 p-4 space-y-3">
        <div>
          <p className="text-xs font-semibold text-emerald-950">Agency bank account</p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Defaults from Billing Settings; editable for this invoice.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className={labelClass}>Account holder name</label>
            <input
              className={inputClass}
              value={sellerBank?.accountHolderName || ''}
              onChange={(e) => onUpdateSellerBank({ accountHolderName: e.target.value })}
            />
          </div>
          <div>
            <label className={labelClass}>Bank name</label>
            <input
              className={inputClass}
              value={sellerBank?.bankName || ''}
              onChange={(e) => onUpdateSellerBank({ bankName: e.target.value })}
            />
          </div>
          <div>
            <label className={labelClass}>Account number</label>
            <input
              className={inputClass}
              value={sellerBank?.accountNumber || ''}
              onChange={(e) => onUpdateSellerBank({ accountNumber: e.target.value })}
            />
          </div>
          <div>
            <label className={labelClass}>SWIFT / IFSC</label>
            <input
              className={inputClass}
              value={sellerBank?.swiftCode || ''}
              onChange={(e) => onUpdateSellerBank({ swiftCode: e.target.value })}
            />
          </div>
          <div>
            <label className={labelClass}>IBAN (optional)</label>
            <input
              className={inputClass}
              value={sellerBank?.iban || ''}
              onChange={(e) => onUpdateSellerBank({ iban: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Bank address (optional)</label>
            <textarea
              className={`${inputClass} min-h-[56px]`}
              value={sellerBank?.bankAddress || ''}
              onChange={(e) => onUpdateSellerBank({ bankAddress: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <p className="text-xs font-semibold text-slate-800">Signatures</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-500 mb-2">Client</p>
            <ReadOnlyRow label="Name" value={invoice.clientSignatory?.name || ''} />
            <div className="mt-2">
              <ReadOnlyRow
                label="Designation"
                value={invoice.clientSignatory?.designation || ''}
              />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase text-slate-500">Agency</p>
            <div>
              <label className={labelClass}>Authorized signatory</label>
              <input
                className={inputClass}
                value={invoice.agencySignatory?.name || ''}
                onChange={(e) => onUpdateAgencySignatory({ name: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Designation</label>
              <input
                className={inputClass}
                value={invoice.agencySignatory?.designation || ''}
                onChange={(e) => onUpdateAgencySignatory({ designation: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Signature image</label>
              {invoice.agencySignatory?.signatureImageUrl ? (
                <img
                  src={invoice.agencySignatory.signatureImageUrl}
                  alt="Agency signature"
                  className="mb-2 max-h-16 object-contain border border-slate-200 rounded bg-white p-1"
                />
              ) : (
                <p className="text-[10px] text-slate-400 mb-2 italic">
                  Upload in Billing → Settings, or choose a file below.
                </p>
              )}
              <input
                type="file"
                accept="image/*"
                className="text-xs w-full"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    const url = typeof reader.result === 'string' ? reader.result : '';
                    if (url) onUpdateAgencySignatory({ signatureImageUrl: url });
                  };
                  reader.readAsDataURL(file);
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Amount summary
          </p>
          <BillingCurrencyAmount
            amount={invoice.total}
            baseCurrency={invoice.currency}
            displayCurrency={previewCurrency}
            onDisplayCurrencyChange={onPreviewCurrencyChange}
          />
        </div>
        <div className="space-y-2 text-sm font-sans">
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-600">Subtotal</span>
            <BillingCurrencyAmount
              amount={invoice.subtotal}
              baseCurrency={invoice.currency}
              displayCurrency={previewCurrency}
              showSelector={false}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-600">
              {settings?.taxLabel || 'Tax'} ({invoice.taxRate}%)
            </span>
            <BillingCurrencyAmount
              amount={invoice.taxAmount}
              baseCurrency={invoice.currency}
              displayCurrency={previewCurrency}
              showSelector={false}
            />
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2">
            <span className="font-semibold text-slate-900">Total due</span>
            <BillingCurrencyAmount
              amount={invoice.total}
              baseCurrency={invoice.currency}
              displayCurrency={previewCurrency}
              showSelector={false}
              className="font-semibold"
            />
          </div>
        </div>
        <p className="text-[10px] text-slate-500">
          Invoice amounts are stored in {invoice.currency}. Selected currency updates the amount
          summary and live preview on the right (approximate FX rates).
        </p>
      </div>
    </div>
  );
}
