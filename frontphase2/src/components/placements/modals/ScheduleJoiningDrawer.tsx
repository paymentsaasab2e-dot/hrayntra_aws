'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Loader2 } from 'lucide-react';
import type { Placement } from '../../../types/placement';
import type { ScheduleJoiningPayload } from '../../../types/placement';
import { apiGetClient, type BackendClient } from '../../../lib/api';
import { visibleContactEmail } from '../../../lib/contactEmail';
import { DrawerFormShell, DrawerFormCancelButton } from '../../drawers/DrawerFormShell';
import {
  DrawerFieldLabel,
  DrawerSectionCard,
  DRAWER_FORM_INPUT,
} from '../../drawers/drawerFormUi';

interface ScheduleJoiningDrawerProps {
  isOpen: boolean;
  placement: Placement | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (payload: ScheduleJoiningPayload) => Promise<void>;
}

const CUSTOM_EMAIL = '__custom__';

function collectClientEmails(
  client: BackendClient | Placement['client'] | null | undefined,
): string[] {
  if (!client) return [];
  const seen = new Set<string>();
  const add = (raw?: string | null) => {
    const email = visibleContactEmail(raw).toLowerCase();
    if (!email || !email.includes('@')) return;
    seen.add(visibleContactEmail(raw));
  };

  (client.emails || []).forEach(add);
  if ('teamMemberEmail' in client) add(client.teamMemberEmail);
  (client.contacts || []).forEach((contact) => add(contact?.email));

  return Array.from(seen);
}

export function ScheduleJoiningDrawer({
  isOpen,
  placement,
  isSubmitting,
  onClose,
  onSubmit,
}: ScheduleJoiningDrawerProps) {
  const [joiningDate, setJoiningDate] = useState('');
  const [reportingToName, setReportingToName] = useState('');
  const [reportingToTitle, setReportingToTitle] = useState('');
  const [reportingToEmail, setReportingToEmail] = useState('');
  const [useCustomEmail, setUseCustomEmail] = useState(false);
  const [joiningNotes, setJoiningNotes] = useState('');
  const [error, setError] = useState('');
  const [clientEmails, setClientEmails] = useState<string[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);

  useEffect(() => {
    if (!isOpen || !placement) return;
    const existing = placement.joiningDate ? String(placement.joiningDate).slice(0, 10) : '';
    setJoiningDate(existing);
    setReportingToName(placement.reportingToName || '');
    setReportingToTitle(placement.reportingToTitle || '');
    setReportingToEmail(placement.reportingToEmail || '');
    setJoiningNotes(placement.notes || '');
    setError('');

    const seeded = collectClientEmails(placement.client);
    setClientEmails(seeded);
    const existingEmail = String(placement.reportingToEmail || '').trim();
    setUseCustomEmail(Boolean(existingEmail && !seeded.includes(existingEmail)));
  }, [isOpen, placement?.id]);

  useEffect(() => {
    if (!isOpen || !placement?.clientId) return;

    let cancelled = false;
    const clientId = placement.clientId;
    const existingEmail = String(placement.reportingToEmail || '').trim();
    const fallbackClient = placement.client;
    setLoadingEmails(true);

    (async () => {
      try {
        const res = await apiGetClient(clientId);
        if (cancelled) return;
        const client = (res?.data || res) as BackendClient;
        const emails = collectClientEmails(client);
        setClientEmails(emails);

        if (existingEmail) {
          setUseCustomEmail(!emails.includes(existingEmail));
        } else if (emails.length === 1) {
          setReportingToEmail(emails[0]);
          setUseCustomEmail(false);
        } else {
          setUseCustomEmail(false);
        }
      } catch {
        if (!cancelled) {
          setClientEmails((prev) => (prev.length ? prev : collectClientEmails(fallbackClient)));
        }
      } finally {
        if (!cancelled) setLoadingEmails(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, placement?.id, placement?.clientId]);

  const emailSelectValue = useMemo(() => {
    if (useCustomEmail) return CUSTOM_EMAIL;
    if (reportingToEmail && clientEmails.includes(reportingToEmail)) return reportingToEmail;
    return '';
  }, [useCustomEmail, reportingToEmail, clientEmails]);

  const handleSubmit = async () => {
    if (!joiningDate) {
      setError('Joining date is required');
      return;
    }
    if (!reportingToName.trim()) {
      setError('Reporting contact name is required');
      return;
    }
    setError('');
    try {
      await onSubmit({
        joiningDate,
        reportingToName: reportingToName.trim(),
        reportingToTitle: reportingToTitle.trim() || undefined,
        reportingToEmail: reportingToEmail.trim() || undefined,
        joiningNotes: joiningNotes.trim() || undefined,
      });
      // Parent closes on success; do not call onClose here (avoids races).
    } catch {
      // Keep the popup open so the user can fix and retry; parent shows the error toast.
    }
  };

  if (!placement) return null;

  return (
    <DrawerFormShell
      isOpen={isOpen}
      onClose={onClose}
      title="Schedule Joining"
      subtitle={`${placement.candidate.firstName} ${placement.candidate.lastName} · ${placement.job.title}`}
      headerIcon={Calendar}
      panelClassName="fixed right-0 top-0 flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-2xl"
      zBackdrop={90}
      zPanel={100}
      footer={
        <>
          <DrawerFormCancelButton />
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void handleSubmit()}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            <Calendar size={16} />
            {isSubmitting ? 'Saving…' : placement.status === 'JOINING_SCHEDULED' ? 'Update joining' : 'Schedule joining'}
          </button>
        </>
      }
    >
      <DrawerSectionCard title="Joining Details" subtitle="Date, reporting contact, and instructions" icon={Calendar} accent="blue">
        <div className="space-y-4">
          <div>
            <DrawerFieldLabel label="Joining date" required />
            <input
              type="date"
              value={joiningDate}
              onChange={(e) => setJoiningDate(e.target.value)}
              className={DRAWER_FORM_INPUT}
            />
          </div>

          <div>
            <DrawerFieldLabel label="Report to (name)" required />
            <input
              type="text"
              value={reportingToName}
              onChange={(e) => setReportingToName(e.target.value)}
              placeholder="e.g. Priya Sharma"
              className={DRAWER_FORM_INPUT}
            />
          </div>

          <div>
            <DrawerFieldLabel label="Designation / role" />
            <input
              type="text"
              value={reportingToTitle}
              onChange={(e) => setReportingToTitle(e.target.value)}
              placeholder="e.g. HR Manager"
              className={DRAWER_FORM_INPUT}
            />
          </div>

          <div>
            <DrawerFieldLabel label="Contact email" />
            <div className="relative">
              <select
                value={emailSelectValue}
                disabled={loadingEmails}
                onChange={(e) => {
                  const next = e.target.value;
                  if (next === CUSTOM_EMAIL) {
                    setUseCustomEmail(true);
                    if (clientEmails.includes(reportingToEmail)) setReportingToEmail('');
                    return;
                  }
                  setUseCustomEmail(false);
                  setReportingToEmail(next);
                }}
                className={DRAWER_FORM_INPUT}
              >
                <option value="">
                  {loadingEmails
                    ? 'Loading client emails…'
                    : clientEmails.length
                      ? 'Select client email…'
                      : 'No client emails found'}
                </option>
                {clientEmails.map((email) => (
                  <option key={email} value={email}>
                    {email}
                  </option>
                ))}
                <option value={CUSTOM_EMAIL}>Other (type manually)</option>
              </select>
              {loadingEmails ? (
                <Loader2 className="pointer-events-none absolute right-8 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
              ) : null}
            </div>
            {useCustomEmail ? (
              <input
                type="email"
                value={reportingToEmail}
                onChange={(e) => setReportingToEmail(e.target.value)}
                placeholder="hr@company.com"
                className={`${DRAWER_FORM_INPUT} mt-2`}
              />
            ) : null}
            {!loadingEmails && !clientEmails.length ? (
              <p className="mt-1.5 text-xs text-slate-500">
                No emails on this client yet — choose Other to type one, or add emails on the client profile.
              </p>
            ) : null}
          </div>

          <div>
            <DrawerFieldLabel label="Instructions for candidate" />
            <textarea
              rows={3}
              value={joiningNotes}
              onChange={(e) => setJoiningNotes(e.target.value)}
              placeholder="Office address, documents to carry, reporting time…"
              className={`${DRAWER_FORM_INPUT} min-h-[88px] resize-y py-3`}
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <p className="rounded-xl bg-blue-50 px-4 py-3 text-xs text-blue-900">
            An email with joining details is sent to the candidate. If you add a reporting contact email,
            that person receives a separate email with the candidate&apos;s profile and joining date.
          </p>
        </div>
      </DrawerSectionCard>
    </DrawerFormShell>
  );
}
