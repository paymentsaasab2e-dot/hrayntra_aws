'use client';

import React, { useState } from 'react';
import { KeyRound } from 'lucide-react';

export type HqGrantLeadTrialValues = {
  emails: string[];
  selectedEmail: string;
  extraEmail: string;
  notifyOthers: boolean;
  trialDays: number;
  note: string;
};

export function uniqueLeadEmails(...lists: Array<string | string[] | null | undefined>): string[] {
  const out: string[] = [];
  for (const list of lists) {
    const items = Array.isArray(list) ? list : list ? [list] : [];
    for (const item of items) {
      const email = String(item || '').trim();
      if (!email) continue;
      if (!out.some((existing) => existing.toLowerCase() === email.toLowerCase())) {
        out.push(email);
      }
    }
  }
  return out;
}

export function emptyHqGrantLeadTrialValues(emails: string[] = []): HqGrantLeadTrialValues {
  const list = uniqueLeadEmails(emails);
  return {
    emails: list,
    selectedEmail: list[0] || '',
    extraEmail: '',
    notifyOthers: list.length > 1,
    trialDays: 5,
    note: '',
  };
}

export function HqGrantLeadTrialModal({
  open,
  name,
  company,
  values,
  submitting = false,
  confirmLabel = 'Grant trial account',
  onChange,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  name?: string;
  company?: string;
  values: HqGrantLeadTrialValues;
  submitting?: boolean;
  confirmLabel?: string;
  onChange: (patch: Partial<HqGrantLeadTrialValues>) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [emailError, setEmailError] = useState('');

  if (!open) return null;

  const addExtraEmail = () => {
    const extra = values.extraEmail.trim();
    if (!extra) {
      setEmailError('Enter an email to add');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(extra)) {
      setEmailError('Enter a valid email');
      return;
    }
    const emails = uniqueLeadEmails(values.emails, extra);
    setEmailError('');
    onChange({
      emails,
      extraEmail: '',
      selectedEmail: values.selectedEmail || extra,
    });
  };

  return (
    <div className="fixed inset-0 z-[1210] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="hq-grant-trial-title"
        className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-200"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
            <KeyRound className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 id="hq-grant-trial-title" className="text-lg font-bold text-slate-900">
              Grant trial account
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Send try-free login credentials to{' '}
              <span className="font-medium text-slate-700">{name || 'this client'}</span>
              {company ? ` · ${company}` : ''}. Status becomes Trial after you grant access.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Emails</p>
          {values.emails.length > 0 ? (
            <div className="mt-1.5 space-y-1.5 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
              {values.emails.map((email) => (
                <label
                  key={email}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-800 hover:bg-white"
                >
                  <input
                    type="radio"
                    name="hq-trial-email"
                    checked={values.selectedEmail.toLowerCase() === email.toLowerCase()}
                    onChange={() => onChange({ selectedEmail: email })}
                    className="h-4 w-4 accent-teal-600"
                  />
                  <span className="truncate">{email}</span>
                  {values.selectedEmail.toLowerCase() === email.toLowerCase() ? (
                    <span className="ml-auto rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-teal-700">
                      Account
                    </span>
                  ) : null}
                </label>
              ))}
            </div>
          ) : (
            <p className="mt-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              No email on this lead yet. Add one below.
            </p>
          )}
          <div className="mt-2 flex gap-2">
            <input
              type="email"
              value={values.extraEmail}
              onChange={(e) => {
                setEmailError('');
                onChange({ extraEmail: e.target.value });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addExtraEmail();
                }
              }}
              placeholder="Add another email"
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
            />
            <button
              type="button"
              onClick={addExtraEmail}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Add
            </button>
          </div>
          {emailError ? <p className="mt-1 text-xs font-medium text-rose-600">{emailError}</p> : null}
          {values.emails.length > 1 ? (
            <label className="mt-2 flex items-start gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={values.notifyOthers}
                onChange={(e) => onChange({ notifyOthers: e.target.checked })}
                className="mt-0.5 h-4 w-4 accent-teal-600"
              />
              Also send the same login details to the other emails
            </label>
          ) : null}
        </div>

        <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Trial days
          <input
            type="number"
            min={1}
            max={365}
            value={values.trialDays}
            onChange={(e) => onChange({ trialDays: Math.max(1, Math.min(365, Number(e.target.value) || 5)) })}
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
          />
        </label>

        <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Note (optional)
          <textarea
            value={values.note}
            onChange={(e) => onChange({ note: e.target.value })}
            rows={3}
            placeholder="Internal note for this trial grant"
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
          />
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={onCancel}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting || !values.selectedEmail.trim()}
            onClick={onConfirm}
            className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {submitting ? 'Granting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
