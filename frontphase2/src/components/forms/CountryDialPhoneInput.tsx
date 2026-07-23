'use client';

import React, { useMemo } from 'react';
import {
  composeInternationalPhone,
  extractNationalNumber,
  getPhoneCountryRule,
  getPhonePlaceholder,
} from '../../lib/phoneByCountry';

const INPUT_CLASS =
  'rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';

export type CountryDialPhoneInputProps = {
  value: string;
  onChange: (fullPhone: string) => void;
  countryCode?: string;
  countryName?: string;
  error?: boolean;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
};

export function CountryDialPhoneInput({
  value,
  onChange,
  countryCode = '',
  countryName = '',
  error = false,
  className = '',
  inputClassName = '',
  disabled = false,
  id,
  'aria-label': ariaLabel = 'Mobile number',
}: CountryDialPhoneInputProps) {
  const rule = useMemo(
    () => getPhoneCountryRule(countryCode, countryName),
    [countryCode, countryName],
  );
  const dialCode = rule?.dialCode || '';
  const nationalNumber = extractNationalNumber(value, dialCode);
  const maxLength = rule?.nationalLength ?? 15;
  const placeholder = getPhonePlaceholder(countryCode, countryName);

  const handleNationalChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, maxLength);
    onChange(composeInternationalPhone(dialCode, digits));
  };

  return (
    <div
      className={`flex min-w-[7rem] flex-1 overflow-hidden rounded-xl border bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 sm:min-w-0 ${
        error ? 'border-red-300' : 'border-slate-200'
      } ${className}`}
    >
      {dialCode ? (
        <span
          className="inline-flex shrink-0 items-center border-r border-slate-200 bg-slate-50 px-2.5 text-sm font-semibold text-slate-700"
          title={rule?.countryName ? `${rule.countryName} dial code` : 'Country dial code'}
        >
          {dialCode}
        </span>
      ) : null}
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        disabled={disabled}
        value={nationalNumber}
        onChange={(e) => handleNationalChange(e.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={`min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-0 ${INPUT_CLASS} ${inputClassName}`}
      />
    </div>
  );
}
