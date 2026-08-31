'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  composeInternationalPhone,
  digitsOnly,
  extractNationalNumber,
  getPhoneCountryRule,
  getPhoneDialOptions,
  getPhonePlaceholder,
  inferPhoneCountryFromNumber,
} from '../../lib/phoneByCountry';

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

function locationIsoCode(countryCode?: string, countryName?: string): string {
  return getPhoneCountryRule(countryCode, countryName)?.isoCode || '';
}

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
  const options = useMemo(() => getPhoneDialOptions(), []);
  const [selectedIso, setSelectedIso] = useState(() =>
    inferPhoneCountryFromNumber(value, locationIsoCode(countryCode, countryName)),
  );
  const userPickedRef = useRef(false);

  useEffect(() => {
    if (userPickedRef.current) return;
    if (digitsOnly(value)) {
      const fromNumber = inferPhoneCountryFromNumber(value, '');
      if (fromNumber) setSelectedIso(fromNumber);
      return;
    }
    const next = locationIsoCode(countryCode, countryName);
    if (next) setSelectedIso(next);
  }, [countryCode, countryName, value]);

  const rule = getPhoneCountryRule(selectedIso, '') || getPhoneCountryRule(countryCode, countryName);
  const dialCode = rule?.dialCode || '';
  const nationalNumber = extractNationalNumber(value, dialCode);
  const maxLength = rule?.nationalLength ?? 15;
  const placeholder = selectedIso
    ? getPhonePlaceholder(selectedIso, rule?.countryName)
    : 'Mobile number';

  const applyCountry = (iso: string) => {
    userPickedRef.current = true;
    setSelectedIso(iso);
    const nextRule = getPhoneCountryRule(iso, '');
    onChange(composeInternationalPhone(nextRule?.dialCode || '', nationalNumber));
  };

  const handleNationalChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, maxLength);
    onChange(composeInternationalPhone(dialCode, digits));
  };

  return (
    <div
      className={`flex min-w-0 w-full max-w-full overflow-hidden rounded-xl border bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 ${
        error ? 'border-red-300' : 'border-slate-200'
      } ${className}`}
    >
      <select
        value={selectedIso}
        disabled={disabled}
        onChange={(e) => applyCountry(e.target.value)}
        aria-label="Country code"
        title={rule ? `${rule.countryName} (${rule.dialCode})` : 'Choose country code'}
        className="w-[7.25rem] max-w-[46%] shrink-0 cursor-pointer rounded-l-xl border-0 border-r border-slate-200 bg-slate-50 px-1 py-2.5 text-[11px] font-semibold text-slate-700 outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="">Country</option>
        {options.map((option) => (
          <option key={option.isoCode} value={option.isoCode}>
            {option.countryName} ({option.dialCode})
          </option>
        ))}
      </select>
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
        className={`min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-0 ${inputClassName}`}
        size={1}
      />
    </div>
  );
}
