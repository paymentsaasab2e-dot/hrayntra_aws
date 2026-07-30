'use client';

import React, { useEffect, useRef } from 'react';
import { Check, Mail, Phone, Plus, Trash2, User } from 'lucide-react';
import { NAME_SALUTATION_OPTIONS, applySalutationFromNameInput } from '../../constants/salutations';
import { ensureMinContactRows, normalizeContactList, primaryContactValue } from '../../lib/contact-channels';
import { remapPhonesToCountry } from '../../lib/phoneByCountry';
import { CountryDialPhoneInput } from './CountryDialPhoneInput';

const INPUT_CLASS =
  'rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';

function NotAvailableCheckbox({
  checked,
  onChange,
  label = 'Not available',
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-slate-500 select-none"
    >
      <span
        className={`relative inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
          checked
            ? 'border-blue-600 bg-blue-600'
            : 'border-slate-300 bg-white hover:border-blue-400'
        }`}
        aria-hidden
      >
        {checked ? <Check size={11} strokeWidth={3} className="text-white" /> : null}
      </span>
      {label}
    </button>
  );
}

export type DirectorContactFieldsProps = {
  directorSalutation?: string;
  contactPerson: string;
  emails: string[];
  phones: string[];
  email?: string;
  phone?: string;
  countryCode?: string;
  countryName?: string;
  onDirectorSalutationChange: (value: string) => void;
  onContactPersonChange: (value: string) => void;
  onEmailsChange: (emails: string[], primaryEmail: string) => void;
  onPhonesChange: (phones: string[], primaryPhone: string) => void;
  contactPersonError?: string;
  emailError?: string;
  phoneError?: string;
  onContactPersonBlur?: () => void;
  boxed?: boolean;
  /** When true, show “Not available” options for email and mobile. */
  allowNotAvailable?: boolean;
  emailNotAvailable?: boolean;
  phoneNotAvailable?: boolean;
  onEmailNotAvailableChange?: (notAvailable: boolean) => void;
  onPhoneNotAvailableChange?: (notAvailable: boolean) => void;
};

export function DirectorContactFields({
  directorSalutation = '',
  contactPerson,
  emails,
  phones,
  email = '',
  phone = '',
  countryCode = '',
  countryName = '',
  onDirectorSalutationChange,
  onContactPersonChange,
  onEmailsChange,
  onPhonesChange,
  contactPersonError,
  emailError,
  phoneError,
  onContactPersonBlur,
  boxed = false,
  allowNotAvailable = false,
  emailNotAvailable = false,
  phoneNotAvailable = false,
  onEmailNotAvailableChange,
  onPhoneNotAvailableChange,
}: DirectorContactFieldsProps) {
  const emailRows = ensureMinContactRows(emails, 1);
  const phoneRows = ensureMinContactRows(phones, 1);
  const rowCount = Math.max(emailRows.length, phoneRows.length);
  const lastCountryKeyRef = useRef(`${countryCode}|${countryName}`);
  const phonesRef = useRef(phoneRows);
  const phoneRef = useRef(phone);
  phonesRef.current = phoneRows;
  phoneRef.current = phone;

  useEffect(() => {
    const key = `${countryCode}|${countryName}`;
    if (key === lastCountryKeyRef.current) return;
    lastCountryKeyRef.current = key;
    if (!countryCode && !countryName) return;
    if (phoneNotAvailable) return;
    const currentPhones = phonesRef.current;
    const remapped = remapPhonesToCountry(currentPhones, countryCode, countryName);
    const changed = remapped.some((value, index) => value !== (currentPhones[index] ?? ''));
    if (!changed) return;
    onPhonesChange(remapped, primaryContactValue(normalizeContactList(remapped, phoneRef.current)));
  }, [countryCode, countryName, onPhonesChange, phoneNotAvailable]);

  const updateEmailRow = (index: number, value: string) => {
    if (emailNotAvailable) return;
    const nextEmails = [...emailRows];
    while (nextEmails.length <= index) nextEmails.push('');
    nextEmails[index] = value;
    const primary = primaryContactValue(normalizeContactList(nextEmails, email));
    onEmailsChange(nextEmails, primary);
  };

  const updatePhoneRow = (index: number, value: string) => {
    if (phoneNotAvailable) return;
    const nextPhones = [...phoneRows];
    while (nextPhones.length <= index) nextPhones.push('');
    nextPhones[index] = value;
    const primary = primaryContactValue(normalizeContactList(nextPhones, phone));
    onPhonesChange(nextPhones, primary);
  };

  const addContactRow = () => {
    if (emailNotAvailable && phoneNotAvailable) return;
    onEmailsChange([...emailRows, ''], email);
    onPhonesChange([...phoneRows, ''], phone);
  };

  const removeContactRow = (index: number) => {
    const nextEmails = emailRows.filter((_, rowIndex) => rowIndex !== index);
    const nextPhones = phoneRows.filter((_, rowIndex) => rowIndex !== index);
    onEmailsChange(
      nextEmails.length > 0 ? nextEmails : [''],
      primaryContactValue(normalizeContactList(nextEmails, email)),
    );
    onPhonesChange(
      nextPhones.length > 0 ? nextPhones : [''],
      primaryContactValue(normalizeContactList(nextPhones, phone)),
    );
  };

  const handleEmailNotAvailable = (checked: boolean) => {
    if (checked && phoneNotAvailable) return;
    onEmailNotAvailableChange?.(checked);
  };

  const handlePhoneNotAvailable = (checked: boolean) => {
    if (checked && emailNotAvailable) return;
    onPhoneNotAvailableChange?.(checked);
  };

  return (
    <div className={boxed ? 'rounded-xl border border-slate-200 bg-slate-50 px-4 py-3' : undefined}>
      <div className="space-y-2">
      <div className="hidden sm:grid sm:grid-cols-[5.75rem_minmax(7rem,1fr)_minmax(8rem,1.2fr)_minmax(9rem,1.15fr)_2.5rem] sm:gap-2 sm:px-0">
        <span className="col-span-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          <User size={12} />
          Director Name <span className="text-red-500">*</span>
        </span>
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          <Mail size={12} />
          Email <span className="text-red-500">*</span>
        </span>
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          <Phone size={12} />
          Mobile Number <span className="text-red-500">*</span>
        </span>
        <span />
      </div>
      <div className="space-y-2">
        {Array.from({ length: rowCount }, (_, index) => (
          <div
            key={`director-contact-row-${index}`}
            className="flex flex-wrap items-center gap-2 sm:grid sm:grid-cols-[5.75rem_minmax(7rem,1fr)_minmax(8rem,1.2fr)_minmax(9rem,1.15fr)_2.5rem] sm:gap-2"
          >
            {index === 0 ? (
              <>
                <select
                  value={directorSalutation}
                  onChange={(e) => onDirectorSalutationChange(e.target.value)}
                  className={`w-[5.75rem] shrink-0 border bg-white px-2 ${INPUT_CLASS} ${
                    contactPersonError ? 'border-red-300' : 'border-slate-200'
                  }`}
                  aria-label="Director salutation"
                >
                  {NAME_SALUTATION_OPTIONS.map((opt) => (
                    <option key={opt.value || 'none'} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <input
                  value={contactPerson}
                  onChange={(e) => {
                    const { salutation, name, salutationChanged } = applySalutationFromNameInput(
                      directorSalutation,
                      e.target.value,
                    );
                    if (salutationChanged) onDirectorSalutationChange(salutation);
                    onContactPersonChange(name);
                  }}
                  onBlur={onContactPersonBlur}
                  className={`min-w-[7rem] flex-1 border px-3 sm:min-w-0 ${INPUT_CLASS} ${
                    contactPersonError ? 'border-red-300' : 'border-slate-200'
                  }`}
                  placeholder="Director name"
                  required
                />
              </>
            ) : (
              <div className="hidden sm:col-span-2 sm:block" aria-hidden />
            )}
            <input
              type={emailNotAvailable ? 'text' : 'email'}
              value={emailNotAvailable ? 'Not available' : (emailRows[index] ?? '')}
              onChange={(e) => updateEmailRow(index, e.target.value)}
              disabled={emailNotAvailable || (index > 0 && emailNotAvailable)}
              className={`min-w-[8rem] flex-[1.2] border px-3 sm:min-w-0 ${INPUT_CLASS} ${
                index === 0 && emailError ? 'border-red-300' : 'border-slate-200'
              } ${emailNotAvailable ? 'bg-slate-50 text-slate-500' : ''}`}
              placeholder="Email"
            />
            {phoneNotAvailable && index === 0 ? (
              <input
                type="text"
                value="Not available"
                disabled
                className={`min-w-[9rem] flex-[1.15] border px-3 sm:min-w-0 ${INPUT_CLASS} border-slate-200 bg-slate-50 text-slate-500`}
                aria-label="Mobile number not available"
              />
            ) : (
              <CountryDialPhoneInput
                value={phoneRows[index] ?? ''}
                onChange={(fullPhone) => updatePhoneRow(index, fullPhone)}
                countryCode={countryCode}
                countryName={countryName}
                error={index === 0 && Boolean(phoneError)}
                disabled={phoneNotAvailable}
                aria-label={`Mobile number ${index + 1}`}
              />
            )}
            {index === rowCount - 1 ? (
              <button
                type="button"
                onClick={addContactRow}
                disabled={emailNotAvailable && phoneNotAvailable}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Add email or mobile number"
              >
                <Plus size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => removeContactRow(index)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                aria-label={`Remove contact row ${index + 1}`}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
      {allowNotAvailable ? (
        <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1 sm:grid sm:grid-cols-[5.75rem_minmax(7rem,1fr)_minmax(8rem,1.2fr)_minmax(9rem,1.15fr)_2.5rem] sm:gap-2">
          <div className="hidden sm:col-span-2 sm:block" aria-hidden />
          <NotAvailableCheckbox
            checked={emailNotAvailable}
            onChange={handleEmailNotAvailable}
            label={phoneNotAvailable ? 'Not available (keep mobile)' : 'Not available'}
          />
          <NotAvailableCheckbox
            checked={phoneNotAvailable}
            onChange={handlePhoneNotAvailable}
            label={emailNotAvailable ? 'Not available (keep email)' : 'Not available'}
          />
          <span />
        </div>
      ) : null}
      {contactPersonError ? <p className="text-xs text-red-600">{contactPersonError}</p> : null}
      {emailError ? <p className="text-xs text-red-600">{emailError}</p> : null}
      {phoneError && phoneError !== emailError ? (
        <p className="text-xs text-red-600">{phoneError}</p>
      ) : null}
      {!countryCode && !countryName && !phoneNotAvailable ? (
        <p className="text-[11px] text-slate-400">
          Select a country in Location to auto-fill the dial code and number length.
        </p>
      ) : null}
      </div>
    </div>
  );
}
