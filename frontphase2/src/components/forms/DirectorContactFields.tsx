'use client';

import React, { useMemo } from 'react';
import { Check, Mail, Phone, Plus, Trash2, User } from 'lucide-react';
import { NAME_SALUTATION_OPTIONS, applySalutationFromNameInput } from '../../constants/salutations';
import { CountryDialPhoneInput } from './CountryDialPhoneInput';
import {
  contactChannelsFromDirectors,
  createEmptyDirector,
  normalizeDirectorList,
  type DirectorListItem,
} from '../../lib/directorFormDetails';

const INPUT_CLASS =
  'rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';

/** Shared with Team Member rows so prefix / name / email / mobile columns stay aligned. */
export const CONTACT_PERSON_ROW_GRID = 'contact-person-row';

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
  /** Full director list (name + email + phone per row). When set, Plus adds another director. */
  directors?: DirectorListItem[];
  onDirectorsChange?: (directors: DirectorListItem[]) => void;
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
  directors: directorsProp,
  onDirectorsChange,
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
  const directors = useMemo(() => {
    if (Array.isArray(directorsProp) && directorsProp.length > 0) {
      return normalizeDirectorList(directorsProp);
    }
    // Legacy: one director from name + first email/phone, then extra channel rows as name-less directors
    const emailRows = emails?.length ? emails : [email || ''];
    const phoneRows = phones?.length ? phones : [phone || ''];
    const rowCount = Math.max(1, emailRows.length, phoneRows.length);
    return normalizeDirectorList(
      Array.from({ length: rowCount }, (_, index) => ({
        salutation: index === 0 ? directorSalutation : '',
        name: index === 0 ? contactPerson : '',
        email: emailRows[index] || '',
        phone: phoneRows[index] || '',
      })),
    );
  }, [directorsProp, directorSalutation, contactPerson, emails, phones, email, phone]);

  const syncOut = (nextList: DirectorListItem[]) => {
    const next = normalizeDirectorList(nextList);
    onDirectorsChange?.(next);
    const primary = next[0] || createEmptyDirector();
    onDirectorSalutationChange(primary.salutation || '');
    onContactPersonChange(primary.name || '');
    const channels = contactChannelsFromDirectors(next);
    onEmailsChange(channels.emails, channels.email);
    onPhonesChange(channels.phones, channels.phone);
  };

  const updateDirector = (index: number, patch: Partial<DirectorListItem>) => {
    if (index === 0 && ((patch.email !== undefined && emailNotAvailable) || (patch.phone !== undefined && phoneNotAvailable))) {
      return;
    }
    const next = directors.map((director, directorIndex) =>
      directorIndex === index ? { ...director, ...patch } : director,
    );
    syncOut(next);
  };

  const addDirector = () => {
    if (emailNotAvailable && phoneNotAvailable) return;
    syncOut([...directors, createEmptyDirector()]);
  };

  const removeDirector = (index: number) => {
    const next = directors.filter((_, directorIndex) => directorIndex !== index);
    syncOut(next.length > 0 ? next : [createEmptyDirector()]);
  };

  const handleEmailNotAvailable = (checked: boolean) => {
    if (checked && phoneNotAvailable) return;
    onEmailNotAvailableChange?.(checked);
    if (checked) {
      const next = directors.map((director, index) =>
        index === 0 ? { ...director, email: '' } : director,
      );
      syncOut(next);
    }
  };

  const handlePhoneNotAvailable = (checked: boolean) => {
    if (checked && emailNotAvailable) return;
    onPhoneNotAvailableChange?.(checked);
    if (checked) {
      const next = directors.map((director, index) =>
        index === 0 ? { ...director, phone: '' } : director,
      );
      syncOut(next);
    }
  };

  return (
    <div className={boxed ? 'rounded-xl border border-slate-200 bg-slate-50 px-4 py-3' : undefined}>
      <div className="space-y-2">
        <div className="contact-person-row-header">
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
          {directors.map((director, index) => (
            <div key={director.id || `director-row-${index}`} className={CONTACT_PERSON_ROW_GRID}>
              <select
                value={director.salutation || ''}
                onChange={(e) => updateDirector(index, { salutation: e.target.value })}
                className={`w-[5.75rem] sm:w-full border bg-white px-2 ${INPUT_CLASS} ${
                  index === 0 && contactPersonError ? 'border-red-300' : 'border-slate-200'
                }`}
                aria-label={`Director ${index + 1} salutation`}
              >
                {NAME_SALUTATION_OPTIONS.map((opt) => (
                  <option key={opt.value || 'none'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <input
                value={director.name || ''}
                onChange={(e) => {
                  const { salutation, name, salutationChanged } = applySalutationFromNameInput(
                    director.salutation || '',
                    e.target.value,
                  );
                  updateDirector(index, {
                    ...(salutationChanged ? { salutation } : {}),
                    name,
                  });
                }}
                onBlur={index === 0 ? onContactPersonBlur : undefined}
                className={`w-full min-w-0 border px-3 ${INPUT_CLASS} ${
                  index === 0 && contactPersonError ? 'border-red-300' : 'border-slate-200'
                }`}
                placeholder={index === 0 ? 'Director name' : `Director ${index + 1} name`}
                size={1}
                required={index === 0}
              />
              <input
                type={index === 0 && emailNotAvailable ? 'text' : 'email'}
                value={index === 0 && emailNotAvailable ? 'Not available' : director.email || ''}
                onChange={(e) => updateDirector(index, { email: e.target.value })}
                disabled={index === 0 && emailNotAvailable}
                className={`w-full min-w-0 border px-3 ${INPUT_CLASS} ${
                  index === 0 && emailError ? 'border-red-300' : 'border-slate-200'
                } ${index === 0 && emailNotAvailable ? 'bg-slate-50 text-slate-500' : ''}`}
                placeholder="Email"
                size={1}
              />
              {index === 0 && phoneNotAvailable ? (
                <input
                  type="text"
                  value="Not available"
                  disabled
                  className={`w-full min-w-0 border px-3 ${INPUT_CLASS} border-slate-200 bg-slate-50 text-slate-500`}
                  aria-label="Mobile number not available"
                />
              ) : (
                <CountryDialPhoneInput
                  value={director.phone || ''}
                  onChange={(fullPhone) => updateDirector(index, { phone: fullPhone })}
                  countryCode={countryCode}
                  countryName={countryName}
                  error={index === 0 && Boolean(phoneError)}
                  disabled={index === 0 && phoneNotAvailable}
                  className="w-full"
                  aria-label={`Director ${index + 1} mobile number`}
                />
              )}
              <div className="flex shrink-0 items-center gap-2">
                {index === directors.length - 1 ? (
                  <button
                    type="button"
                    onClick={addDirector}
                    disabled={emailNotAvailable && phoneNotAvailable}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Add another director"
                    title="Add another director"
                  >
                    <Plus size={16} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => removeDirector(index)}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                    aria-label={`Remove director ${index + 1}`}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        {allowNotAvailable ? (
          <div className={`pt-1 ${CONTACT_PERSON_ROW_GRID}`}>
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
        <p className="text-[11px] text-slate-500">
          Use + to add another director with name, email, and mobile number.
        </p>
      </div>
    </div>
  );
}
