'use client';

import React, { useMemo } from 'react';
import {
  Bell,
  Globe2,
  Link2,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Users,
} from 'lucide-react';
import { FollowUpDateTimeField, isOtherFollowUpType } from './FollowUpDateTimeField';
import { ClientTimezoneSelect } from './clients/ClientTimezoneSelect';
import { LeadAssigneesMultiSelect } from './drawers/LeadAssigneesMultiSelect';
import type { TeamMember } from '../types/team';

export const FOLLOW_UP_REMINDER_OPTIONS = [
  'No reminder',
  '10 minutes before',
  '30 minutes before',
  '1 hour before',
  '1 day before',
] as const;

export type LeadFollowUpScheduleFields = {
  nextFollowUp: string;
  followUpType: string;
  followUpContact?: string;
  followUpMeetLink?: string;
  followUpReminder?: string;
  followUpTimezone?: string;
  followUpAttendeeIds?: string[];
  followUpNotes?: string;
};

const TYPE_BUTTONS = [
  { id: 'Call', label: 'Call', hint: 'Phone call', icon: Phone, tone: 'emerald' },
  { id: 'WhatsApp', label: 'WhatsApp', hint: 'Chat message', icon: MessageCircle, tone: 'green' },
  { id: 'Email', label: 'Email', hint: 'Send email', icon: Mail, tone: 'sky' },
  { id: 'Meet', label: 'Meet', hint: 'Meeting link', icon: Users, tone: 'violet' },
  { id: 'Other', label: 'Other', hint: 'Custom type', icon: MoreHorizontal, tone: 'slate' },
] as const;

const TONE_SELECTED: Record<(typeof TYPE_BUTTONS)[number]['tone'], string> = {
  emerald: 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20 shadow-sm',
  green: 'border-green-500 bg-green-50 text-green-900 ring-2 ring-green-500/20 shadow-sm',
  sky: 'border-sky-500 bg-sky-50 text-sky-900 ring-2 ring-sky-500/20 shadow-sm',
  violet: 'border-violet-500 bg-violet-50 text-violet-900 ring-2 ring-violet-500/20 shadow-sm',
  slate: 'border-slate-500 bg-slate-100 text-slate-900 ring-2 ring-slate-400/20 shadow-sm',
};

const TONE_ICON: Record<(typeof TYPE_BUTTONS)[number]['tone'], string> = {
  emerald: 'bg-emerald-100 text-emerald-700',
  green: 'bg-green-100 text-green-700',
  sky: 'bg-sky-100 text-sky-700',
  violet: 'bg-violet-100 text-violet-700',
  slate: 'bg-slate-200 text-slate-700',
};

function uniqueNonEmpty(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = String(raw || '').trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

export function buildFollowUpStatusRemark(fields: LeadFollowUpScheduleFields): string {
  const type = String(fields.followUpType || 'General').trim() || 'General';
  const parts = [`Follow-up scheduled: ${type}`];
  if (fields.followUpContact?.trim()) {
    parts.push(`Contact: ${fields.followUpContact.trim()}`);
  }
  if (fields.followUpMeetLink?.trim()) {
    parts.push(`Meet link: ${fields.followUpMeetLink.trim()}`);
  }
  if (fields.followUpReminder?.trim() && fields.followUpReminder !== 'No reminder') {
    parts.push(`Reminder: ${fields.followUpReminder.trim()}`);
  }
  if (fields.followUpTimezone?.trim()) {
    parts.push(`Timezone: ${fields.followUpTimezone.trim()}`);
  }
  if (fields.followUpAttendeeIds?.length) {
    parts.push(`Attendees: ${fields.followUpAttendeeIds.length}`);
  }
  if (fields.followUpNotes?.trim()) {
    parts.push(`Notes: ${fields.followUpNotes.trim()}`);
  }
  return parts.join('. ');
}

type Props = {
  value: LeadFollowUpScheduleFields;
  onChange: (patch: Partial<LeadFollowUpScheduleFields>) => void;
  /** Available phone numbers to pick for Call / WhatsApp. */
  phoneOptions?: string[];
  /** Available emails to pick for Email. */
  emailOptions?: string[];
  teamMembers?: TeamMember[];
  loadingMembers?: boolean;
  /** Show follow-up notes textarea. Default true. */
  showNotes?: boolean;
  /** Show assigned owner multi-select separately — this only covers meet attendees. */
  className?: string;
  inputClassName?: string;
};

export function LeadFollowUpScheduler({
  value,
  onChange,
  phoneOptions = [],
  emailOptions = [],
  teamMembers = [],
  loadingMembers = false,
  showNotes = true,
  className = '',
  inputClassName = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20',
}: Props) {
  const followUpType = value.followUpType || 'Call';
  const otherSelected = isOtherFollowUpType(followUpType);
  const otherText =
    otherSelected && followUpType && followUpType !== 'Other' ? followUpType : '';

  const isCallLike = followUpType === 'Call' || followUpType === 'WhatsApp';
  const isEmail = followUpType === 'Email';
  const isMeetLike = followUpType === 'Meet';

  const phones = useMemo(() => uniqueNonEmpty(phoneOptions), [phoneOptions]);
  const emails = useMemo(() => uniqueNonEmpty(emailOptions), [emailOptions]);
  const contactChoices = isEmail ? emails : isCallLike ? phones : [];

  const contactLabel = isEmail
    ? 'Choose email'
    : followUpType === 'WhatsApp'
      ? 'Choose WhatsApp number'
      : 'Choose phone number';

  return (
    <div className={`space-y-4 ${className}`}>
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Follow-up via
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TYPE_BUTTONS.map((opt) => {
            const Icon = opt.icon;
            const selected = opt.id === 'Other' ? otherSelected : followUpType === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  if (opt.id === 'Other') {
                    onChange({
                      followUpType: otherText || 'Other',
                      followUpContact: '',
                      ...(isMeetLike
                        ? {}
                        : { followUpMeetLink: value.followUpMeetLink, followUpAttendeeIds: [] }),
                    });
                    return;
                  }
                  onChange({
                    followUpType: opt.id,
                    followUpContact: '',
                    ...(opt.id === 'Meet'
                      ? {}
                      : { followUpMeetLink: '', followUpAttendeeIds: [] }),
                  });
                }}
                className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition ${
                  selected
                    ? TONE_SELECTED[opt.tone]
                    : 'border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50/40'
                }`}
              >
                <span
                  className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    selected ? TONE_ICON[opt.tone] : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <Icon size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold leading-tight">{opt.label}</span>
                  <span className="block text-[10px] font-medium text-slate-500">{opt.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
        {otherSelected ? (
          <input
            type="text"
            value={otherText}
            onChange={(e) =>
              onChange({ followUpType: e.target.value.trim() ? e.target.value : 'Other' })
            }
            placeholder="e.g. LinkedIn, SMS, In-person visit…"
            className={`mt-2.5 ${inputClassName}`}
            autoFocus
          />
        ) : null}
      </div>

      {(isCallLike || isEmail) && (
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {contactLabel}
          </p>
          {contactChoices.length > 0 ? (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {contactChoices.map((item) => {
                const selected = (value.followUpContact || '') === item;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => onChange({ followUpContact: item })}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                      selected
                        ? 'border-sky-500 bg-sky-50 text-sky-800 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-sky-300'
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="mb-2 text-xs text-slate-500">
              No saved {isEmail ? 'emails' : 'numbers'} on this lead yet — enter one below.
            </p>
          )}
          <input
            type={isEmail ? 'email' : 'tel'}
            value={value.followUpContact || ''}
            onChange={(e) => onChange({ followUpContact: e.target.value })}
            placeholder={isEmail ? 'name@company.com' : '+91 98765 43210'}
            className={inputClassName}
          />
        </div>
      )}

      {isMeetLike ? (
        <div className="space-y-3 rounded-xl border border-violet-100 bg-violet-50/40 p-3.5">
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-700/80">
              <Link2 size={12} />
              Meet link
            </label>
            <input
              type="url"
              value={value.followUpMeetLink || ''}
              onChange={(e) => onChange({ followUpMeetLink: e.target.value })}
              placeholder="https://meet.google.com/… or Zoom / Teams link"
              className={inputClassName}
            />
          </div>
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-700/80">
              <Users size={12} />
              Who will join the meet
            </label>
            <LeadAssigneesMultiSelect
              members={teamMembers}
              value={value.followUpAttendeeIds || []}
              loading={loadingMembers}
              onChange={(ids) => onChange({ followUpAttendeeIds: ids })}
              placeholder="Select people who will join"
              ariaLabel="Meet attendees"
            />
          </div>
        </div>
      ) : null}

      <FollowUpDateTimeField
        value={value.nextFollowUp || ''}
        onChange={(iso) => onChange({ nextFollowUp: iso })}
        showFollowUpTypes={false}
        label="Date & time"
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <Bell size={12} />
            Reminder
          </label>
          <div className="flex flex-wrap gap-1.5">
            {FOLLOW_UP_REMINDER_OPTIONS.map((opt) => {
              const selected = (value.followUpReminder || 'No reminder') === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onChange({ followUpReminder: opt })}
                  className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition ${
                    selected
                      ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-amber-300'
                  }`}
                >
                  {opt === 'No reminder' ? 'None' : opt.replace(' before', '')}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
            The selected contact receives an email when scheduled and before the reminder time.
          </p>
        </div>
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <Globe2 size={12} />
            Timezone
          </label>
          <ClientTimezoneSelect
            value={value.followUpTimezone || ''}
            onChange={(followUpTimezone) => onChange({ followUpTimezone })}
            placeholder="Select timezone…"
            className={inputClassName}
          />
        </div>
      </div>

      {showNotes ? (
        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Follow-up notes
          </label>
          <textarea
            value={value.followUpNotes || ''}
            onChange={(e) => onChange({ followUpNotes: e.target.value })}
            rows={2}
            placeholder="What should be discussed on this follow-up?"
            className={`${inputClassName} resize-none`}
          />
        </div>
      ) : null}
    </div>
  );
}
