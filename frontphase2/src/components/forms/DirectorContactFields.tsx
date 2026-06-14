'use client';

import React from 'react';
import { Mail, Phone, Plus, Trash2, User } from 'lucide-react';
import { NAME_SALUTATION_OPTIONS, applySalutationFromNameInput } from '../../constants/salutations';
import { ensureMinContactRows, normalizeContactList, primaryContactValue } from '../../lib/contact-channels';

const INPUT_CLASS =
  'rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';

export type DirectorContactFieldsProps = {
  directorSalutation?: string;
  contactPerson: string;
  emails: string[];
  phones: string[];
  email?: string;
  phone?: string;
  onDirectorSalutationChange: (value: string) => void;
  onContactPersonChange: (value: string) => void;
  onEmailsChange: (emails: string[], primaryEmail: string) => void;
  onPhonesChange: (phones: string[], primaryPhone: string) => void;
  contactPersonError?: string;
  emailError?: string;
  onContactPersonBlur?: () => void;
};

export function DirectorContactFields({
  directorSalutation = '',
  contactPerson,
  emails,
  phones,
  email = '',
  phone = '',
  onDirectorSalutationChange,
  onContactPersonChange,
  onEmailsChange,
  onPhonesChange,
  contactPersonError,
  emailError,
  onContactPersonBlur,
}: DirectorContactFieldsProps) {
  const emailRows = ensureMinContactRows(emails, 1);
  const phoneRows = ensureMinContactRows(phones, 1);
  const rowCount = Math.max(emailRows.length, phoneRows.length);

  const updateEmailRow = (index: number, value: string) => {
    const nextEmails = [...emailRows];
    while (nextEmails.length <= index) nextEmails.push('');
    nextEmails[index] = value;
    const primary = primaryContactValue(normalizeContactList(nextEmails, email));
    onEmailsChange(nextEmails, primary);
  };

  const updatePhoneRow = (index: number, value: string) => {
    const nextPhones = [...phoneRows];
    while (nextPhones.length <= index) nextPhones.push('');
    nextPhones[index] = value;
    const primary = primaryContactValue(normalizeContactList(nextPhones, phone));
    onPhonesChange(nextPhones, primary);
  };

  const addContactRow = () => {
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

  return (
    <div className="space-y-2">
      <div className="hidden sm:grid sm:grid-cols-[5.75rem_minmax(7rem,1fr)_minmax(8rem,1.2fr)_minmax(7rem,1fr)_2.5rem] sm:gap-2 sm:px-0">
        <span className="col-span-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-violet-500">
          <User size={12} />
          Director Name
        </span>
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-violet-500">
          <Mail size={12} />
          Email *
        </span>
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-violet-500">
          <Phone size={12} />
          Mobile Number
        </span>
        <span />
      </div>
      <div className="space-y-2">
        {Array.from({ length: rowCount }, (_, index) => (
          <div
            key={`director-contact-row-${index}`}
            className="flex flex-wrap items-center gap-2 sm:grid sm:grid-cols-[5.75rem_minmax(7rem,1fr)_minmax(8rem,1.2fr)_minmax(7rem,1fr)_2.5rem] sm:gap-2"
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
                />
              </>
            ) : (
              <div className="hidden sm:col-span-2 sm:block" aria-hidden />
            )}
            <input
              type="email"
              value={emailRows[index] ?? ''}
              onChange={(e) => updateEmailRow(index, e.target.value)}
              className={`min-w-[8rem] flex-[1.2] border px-3 sm:min-w-0 ${INPUT_CLASS} ${
                index === 0 && emailError ? 'border-red-300' : 'border-slate-200'
              }`}
              placeholder="Email"
            />
            <input
              type="tel"
              value={phoneRows[index] ?? ''}
              onChange={(e) => updatePhoneRow(index, e.target.value)}
              className={`min-w-[7rem] flex-1 border px-3 sm:min-w-0 ${INPUT_CLASS} border-slate-200`}
              placeholder="Mobile number"
            />
            {index === rowCount - 1 ? (
              <button
                type="button"
                onClick={addContactRow}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100"
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
      {contactPersonError ? <p className="text-xs text-red-600">{contactPersonError}</p> : null}
      {emailError ? <p className="text-xs text-red-600">{emailError}</p> : null}
    </div>
  );
}
