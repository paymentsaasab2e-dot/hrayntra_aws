'use client';

import React, { useMemo } from 'react';
import {
  Bell,
  CalendarClock,
  Globe2,
  Link2,
  Mail,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Users,
  Video,
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

export const FOLLOW_UP_POSTPONE_PRESETS = [
  { id: '1d', label: 'Tomorrow', days: 1 },
  { id: '2d', label: '+2 days', days: 2 },
  { id: '3d', label: '+3 days', days: 3 },
  { id: '7d', label: '+1 week', days: 7 },
  { id: '14d', label: '+2 weeks', days: 14 },
] as const;

/** Canonical Add Lead / follow-up activity types (stored on the lead + activity history). */
export const LEAD_FOLLOW_UP_ACTIVITY_TYPES = [
  'Call',
  'WhatsApp',
  'Email',
  'Online Meeting',
  'Personal Meeting',
  'Other',
] as const;

export type LeadFollowUpActivityType = (typeof LEAD_FOLLOW_UP_ACTIVITY_TYPES)[number];

export function isOnlineMeetFollowUpType(type?: string | null): boolean {
  const value = String(type || '').trim().toLowerCase();
  return value === 'online meeting' || value === 'meet';
}

export function isPersonalMeetFollowUpType(type?: string | null): boolean {
  return String(type || '').trim().toLowerCase() === 'personal meeting';
}

export type LeadFollowUpScheduleFields = {
  nextFollowUp: string;
  followUpType: string;
  followUpContact?: string;
  followUpMeetLink?: string;
  followUpReminder?: string;
  followUpTimezone?: string;
  followUpAttendeeIds?: string[];
  followUpNotes?: string;
  /** When true, follow-up is marked as postponed to the selected date. */
  followUpPostponed?: boolean;
  /** Why the follow-up was postponed. */
  followUpPostponeReason?: string;
  /** Active postpone preset id (for UI highlight). */
  followUpPostponePreset?: string;
};

/**
 * Postpone presets are relative to **today** (local calendar), not the current follow-up date.
 * e.g. Tomorrow = today+1, +2 weeks = today+14. Keeps time-of-day from `fromIso` when valid.
 */
export function computePostponedFollowUpIso(days: number, fromIso?: string | null): string {
  const offset = Math.max(1, Math.floor(Number(days) || 1));
  const now = new Date();

  let hours = 10;
  let minutes = 0;
  if (fromIso) {
    const source = new Date(fromIso);
    if (!Number.isNaN(source.getTime())) {
      hours = source.getHours();
      minutes = source.getMinutes();
    }
  }

  // Build from local Y/M/D so timezone does not shift the calendar day.
  const target = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + offset,
    hours,
    minutes,
    0,
    0,
  );

  if (target.getTime() <= Date.now()) {
    target.setHours(Math.max(hours, now.getHours() + 1), minutes, 0, 0);
    if (target.getTime() <= Date.now()) {
      target.setDate(target.getDate() + 1);
      target.setHours(hours, minutes, 0, 0);
    }
  }

  return target.toISOString();
}

const TYPE_BUTTONS = [
  { id: 'Call', label: 'Call', hint: 'Phone call', icon: Phone, tone: 'emerald' },
  { id: 'WhatsApp', label: 'WhatsApp', hint: 'Chat message', icon: MessageCircle, tone: 'green' },
  { id: 'Email', label: 'Email', hint: 'Send email', icon: Mail, tone: 'sky' },
  { id: 'Online Meeting', label: 'Online Meeting', hint: 'Video / meet link', icon: Video, tone: 'violet' },
  { id: 'Personal Meeting', label: 'Personal Meeting', hint: 'In-person visit', icon: MapPin, tone: 'amber' },
  { id: 'Other', label: 'Other', hint: 'Custom type', icon: MoreHorizontal, tone: 'slate' },
] as const;

const TONE_SELECTED: Record<(typeof TYPE_BUTTONS)[number]['tone'], string> = {
  emerald: 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20 shadow-sm',
  green: 'border-green-500 bg-green-50 text-green-900 ring-2 ring-green-500/20 shadow-sm',
  sky: 'border-sky-500 bg-sky-50 text-sky-900 ring-2 ring-sky-500/20 shadow-sm',
  violet: 'border-violet-500 bg-violet-50 text-violet-900 ring-2 ring-violet-500/20 shadow-sm',
  amber: 'border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-500/20 shadow-sm',
  slate: 'border-slate-500 bg-slate-100 text-slate-900 ring-2 ring-slate-400/20 shadow-sm',
};

const TONE_ICON: Record<(typeof TYPE_BUTTONS)[number]['tone'], string> = {
  emerald: 'bg-emerald-100 text-emerald-700',
  green: 'bg-green-100 text-green-700',
  sky: 'bg-sky-100 text-sky-700',
  violet: 'bg-violet-100 text-violet-700',
  amber: 'bg-amber-100 text-amber-700',
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
  const parts = [
    fields.followUpPostponed
      ? `Follow-up postponed: ${type}`
      : `Follow-up scheduled: ${type}`,
  ];
  if (fields.followUpPostponeReason?.trim()) {
    parts.push(`Postpone reason: ${fields.followUpPostponeReason.trim()}`);
  }
  if (fields.followUpContact?.trim()) {
    parts.push(
      isPersonalMeetFollowUpType(type)
        ? `Location: ${fields.followUpContact.trim()}`
        : `Contact: ${fields.followUpContact.trim()}`,
    );
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
  /** Show postpone controls. Default true. */
  showPostpone?: boolean;
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
  showPostpone = true,
  className = '',
  inputClassName = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20',
}: Props) {
  const followUpTypeRaw = value.followUpType || 'Call';
  const followUpType =
    followUpTypeRaw === 'Meet' ? 'Online Meeting' : followUpTypeRaw;
  const otherSelected = isOtherFollowUpType(followUpTypeRaw);
  const otherText =
    otherSelected && followUpType && followUpType !== 'Other' ? followUpType : '';

  const isCallLike = followUpType === 'Call' || followUpType === 'WhatsApp';
  const isEmail = followUpType === 'Email';
  const isMeetLike = isOnlineMeetFollowUpType(followUpType);
  const isPersonalMeeting = isPersonalMeetFollowUpType(followUpType);
  const isPostponed = Boolean(value.followUpPostponed);

  const phones = useMemo(() => uniqueNonEmpty(phoneOptions), [phoneOptions]);
  const emails = useMemo(() => uniqueNonEmpty(emailOptions), [emailOptions]);
  const contactChoices = isEmail ? emails : isCallLike ? phones : [];

  const contactLabel = isEmail
    ? 'Choose email'
    : followUpType === 'WhatsApp'
      ? 'Choose WhatsApp number'
      : 'Choose phone number';

  const applyPostponePreset = (presetId: string, days: number) => {
    onChange({
      followUpPostponed: true,
      followUpPostponePreset: presetId,
      nextFollowUp: computePostponedFollowUpIso(days, value.nextFollowUp),
    });
  };

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
                    ...(opt.id === 'Online Meeting'
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
            placeholder="e.g. LinkedIn, SMS…"
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

      {isPersonalMeeting ? (
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <MapPin size={12} />
            Meeting location
          </label>
          <input
            type="text"
            value={value.followUpContact || ''}
            onChange={(e) => onChange({ followUpContact: e.target.value })}
            placeholder="e.g. Client office, Cafe, HQ conference room…"
            className={inputClassName}
          />
        </div>
      ) : null}

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
              assignmentModule="Leads"
              onChange={(ids) => onChange({ followUpAttendeeIds: ids })}
              placeholder="Select people who will join"
              ariaLabel="Meet attendees"
            />
          </div>
        </div>
      ) : null}

      <FollowUpDateTimeField
        value={value.nextFollowUp || ''}
        onChange={(iso) =>
          onChange({
            nextFollowUp: iso,
            ...(isPostponed ? { followUpPostponePreset: 'custom' } : {}),
          })
        }
        showFollowUpTypes={false}
        label={isPostponed ? 'Postponed date & time' : 'Date & time'}
      />

      {showPostpone ? (
        <div
          className={`rounded-xl border p-3.5 ${
            isPostponed
              ? 'border-amber-200 bg-amber-50/50'
              : 'border-slate-200 bg-slate-50/60'
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-700/90">
                <CalendarClock size={12} />
                Postpone follow-up
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Push this follow-up later and keep a reason for the team.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (isPostponed) {
                  onChange({
                    followUpPostponed: false,
                    followUpPostponeReason: '',
                    followUpPostponePreset: '',
                  });
                  return;
                }
                onChange({
                  followUpPostponed: true,
                  followUpPostponePreset: '1d',
                  nextFollowUp: computePostponedFollowUpIso(1, value.nextFollowUp),
                });
              }}
              className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
                isPostponed
                  ? 'bg-amber-600 text-white shadow-sm hover:bg-amber-700'
                  : 'border border-amber-300 bg-white text-amber-800 hover:bg-amber-50'
              }`}
            >
              {isPostponed ? 'Postponed' : 'Mark postponed'}
            </button>
          </div>

          {isPostponed ? (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {FOLLOW_UP_POSTPONE_PRESETS.map((preset) => {
                  const selected = value.followUpPostponePreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPostponePreset(preset.id, preset.days)}
                      className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition ${
                        selected
                          ? 'border-amber-500 bg-amber-100 text-amber-900 shadow-sm'
                          : 'border-amber-200/80 bg-white text-slate-600 hover:border-amber-400'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-amber-700/80">
                  Postpone reason <span className="text-rose-600">*</span>
                </label>
                <textarea
                  value={value.followUpPostponeReason || ''}
                  onChange={(e) => onChange({ followUpPostponeReason: e.target.value })}
                  rows={2}
                  required
                  aria-required="true"
                  placeholder="e.g. Client asked to reconnect next week…"
                  className={`${inputClassName} resize-none`}
                />
                {!String(value.followUpPostponeReason || '').trim() ? (
                  <p className="mt-1 text-[11px] font-medium text-amber-700">
                    Reason is required when postponing.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

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
