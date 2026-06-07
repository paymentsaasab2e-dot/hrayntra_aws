'use client';

import React from 'react';
import {
  AGREEMENT_LEVEL_OPTIONS,
  AGREEMENT_REPLACEMENT_UNIT_OPTIONS,
  DEFAULT_AGREEMENT_PAYMENT_TERMS,
  type AgreementTermsFormValues,
} from '../../lib/agreementTerms';

type Props = {
  values: AgreementTermsFormValues;
  onChange: (patch: Partial<AgreementTermsFormValues>) => void;
  uploadSlot: React.ReactNode;
  disabled?: boolean;
  readOnly?: boolean;
  showContractValidity?: boolean;
  /** Hide when the parent drawer already renders a section header (e.g. collapsible). */
  showTitle?: boolean;
};

const labelClass = 'block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1';
const inputClass =
  'w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500';

export function AgreementTermsSection({
  values,
  onChange,
  uploadSlot,
  disabled = false,
  readOnly = false,
  showContractValidity = false,
  showTitle = true,
}: Props) {
  const locked = disabled || readOnly;

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/40 p-4">
      {showTitle ? (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Agreements &amp; Terms</h4>
        </div>
      ) : null}

      <div>
        <span className={labelClass}>Upload agreement</span>
        {uploadSlot}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Level</label>
          <select
            value={values.agreementLevel}
            onChange={(e) => onChange({ agreementLevel: e.target.value })}
            disabled={locked}
            className={inputClass}
          >
            <option value="">Select level</option>
            {AGREEMENT_LEVEL_OPTIONS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Service charge (%)</label>
          <div className="relative">
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={values.agreementServiceChargePercent}
              onChange={(e) => onChange({ agreementServiceChargePercent: e.target.value })}
              disabled={locked}
              className={`${inputClass} pr-9`}
              placeholder="e.g. 8.5"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
              %
            </span>
          </div>
        </div>

        {showContractValidity ? (
          <>
            <div>
              <label className={labelClass}>Start date of the agreement</label>
              <input
                type="date"
                value={values.agreementContractStartDate}
                onChange={(e) => onChange({ agreementContractStartDate: e.target.value })}
                disabled={locked}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>End date of the agreement</label>
              <input
                type="date"
                value={values.agreementContractEndDate}
                onChange={(e) => onChange({ agreementContractEndDate: e.target.value })}
                disabled={locked}
                className={inputClass}
              />
            </div>
          </>
        ) : null}

        <div className="sm:col-span-2">
          <label className={labelClass}>Payment terms</label>
          <textarea
            rows={2}
            value={values.agreementTimePeriod}
            onChange={(e) => onChange({ agreementTimePeriod: e.target.value })}
            disabled={locked}
            className={`${inputClass} resize-y min-h-[4.5rem]`}
            placeholder={DEFAULT_AGREEMENT_PAYMENT_TERMS}
          />
          <p className="mt-1 text-[11px] text-slate-500">
            Typically: payment is made by the client after the candidate has joined.
          </p>
        </div>

        <div>
          <label className={labelClass}>Advance payment (%)</label>
          <div className="relative">
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={values.agreementAdvancePaymentPercent}
              onChange={(e) => onChange({ agreementAdvancePaymentPercent: e.target.value })}
              disabled={locked}
              className={`${inputClass} pr-9`}
              placeholder="e.g. 30"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
              %
            </span>
          </div>
        </div>

        <div>
          <label className={labelClass}>Free replacement</label>
          <input
            type="number"
            min={0}
            step={1}
            value={values.agreementFreeReplacementValue}
            onChange={(e) => onChange({ agreementFreeReplacementValue: e.target.value })}
            disabled={locked}
            className={inputClass}
            placeholder="e.g. 3"
          />
        </div>

        <div>
          <label className={labelClass}>Replacement period</label>
          <select
            value={values.agreementFreeReplacementUnit || 'MONTHS'}
            onChange={(e) =>
              onChange({
                agreementFreeReplacementUnit: e.target.value as AgreementTermsFormValues['agreementFreeReplacementUnit'],
              })
            }
            disabled={locked}
            className={inputClass}
          >
            {AGREEMENT_REPLACEMENT_UNIT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}
