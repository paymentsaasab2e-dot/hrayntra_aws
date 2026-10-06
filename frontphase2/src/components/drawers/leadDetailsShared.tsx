'use client';

import type { AppIcon } from '@/types/appIcon';
import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { splitDateTimeForDisplay } from '../../utils/formatLeadDateTime';
import { formatDateDMY } from '../../utils/dateDisplay';
import { cleanDisplayText } from '../../lib/sanitizeMojibake';
import { normalizeContactList, primaryContactValue } from '../../lib/contact-channels';
import { motion } from 'motion/react';
import { ChevronDown, Check, Trash2, GripVertical } from 'lucide-react';
import type { DefaultLeadStatus, Lead, LeadStatus, LeadSource, LeadType, LeadNoteTag } from '@/app/leads/types';
import { apiCreateLead, apiUpdateLead, type CreateLeadData, type BackendLead } from '../../lib/api';
import { type AgreementTermsFormValues } from '../../lib/agreementTerms';
import { type DirectorListItem } from '../../lib/directorFormDetails';
import { normalizeTeamMemberList, primaryTeamMemberFromList, type TeamMemberListItem } from '../../lib/teamMemberFormDetails';
import { type LeadOccasionFormValues } from '../../lib/leadOccasionDetails';
import { DetailsModalShell } from './DetailsModalShell';
import { AddLeadFieldLabel, useDrawerPortalDropdownPosition } from './drawerFormUi';
import { DrawerLinkActions, splitDisplayUrls } from './DrawerLinkActions';
import type { LocationSelection } from '../LocationAutocomplete';
import { validatePhoneForCountry } from '../../lib/phoneByCountry';

export const CALL_OUTCOMES = ['Interested', 'Follow-up Required', 'No Answer', 'Wrong Number', 'Not Interested'];

export function preferLeadSearchLocation(previous: string | undefined, incoming: string | undefined): string {
  const next = String(incoming || '').trim();
  const prev = String(previous || '').trim();
  return next || prev;
}

export function mergeLocationFields<
  T extends {
    location?: string;
    city?: string;
    country?: string;
    state?: string;
    latitude?: number | null;
    longitude?: number | null;
    countryCode?: string;
  },
>(prev: T, selection: LocationSelection): T {
  return {
    ...prev,
    location: preferLeadSearchLocation(prev.location, selection.location),
    city: selection.city ?? '',
    country: selection.country ?? '',
    countryCode: selection.countryCode ?? '',
    state: selection.state ?? '',
    latitude: selection.latitude,
    longitude: selection.longitude,
  };
}

export const DEFAULT_LEAD_STATUSES: DefaultLeadStatus[] = ['New', 'Contacted', 'Qualified', 'Converted', 'Lost'];

export const DEFAULT_LEAD_STATUS_SET = new Set(DEFAULT_LEAD_STATUSES.map((status) => status.toLowerCase()));

export const HQ_ONLY_LEAD_STATUSES = ['Demo', 'Trial'] as const;

export const HQ_ONLY_LEAD_STATUS_SET = new Set(HQ_ONLY_LEAD_STATUSES.map((status) => status.toLowerCase()));

export const STATUS_STYLES: Record<DefaultLeadStatus, string> = {
  New: 'bg-blue-50 text-blue-700 border-blue-100',
  Contacted: 'bg-yellow-50 text-yellow-700 border-yellow-100',
  Qualified: 'bg-purple-50 text-purple-700 border-purple-100',
  Converted: 'bg-green-50 text-green-700 border-green-100',
  Lost: 'bg-gray-50 text-gray-700 border-gray-100',
};

export function leadStatusChipClass(status: string | null | undefined): string {
  const key = String(status || '').trim();
  if (STATUS_STYLES[key as DefaultLeadStatus]) return STATUS_STYLES[key as DefaultLeadStatus];
  if (key.toLowerCase() === 'demo') return 'bg-orange-50 text-orange-800 border-orange-200';
  if (key.toLowerCase() === 'trial') return 'bg-teal-50 text-teal-800 border-teal-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

export function prettyDemoNoteValue(value: string): string {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  const slot = trimmed.match(/^\[demo-slot:([^\]|]+)\|([^\]]+)\]$/i);
  if (slot) {
    const dmy = formatDateDMY(slot[1].trim());
    return [dmy || slot[1].trim(), slot[2].trim()].filter(Boolean).join(', ');
  }
  const booked = trimmed.match(/^(\d{4}-\d{2}-\d{2})(?:\s+at\s+|\s+)(.+)$/i);
  if (booked) {
    const dmy = formatDateDMY(booked[1]);
    return [dmy || booked[1], booked[2].trim()].filter(Boolean).join(', ');
  }
  return trimmed;
}

export function parseLeadDemoNotes(notes: string | null | undefined): Array<{ label: string; value: string }> | null {
  const raw = String(notes || '').trim();
  if (!raw) return null;
  const looksLikeDemo =
    /booked demo:/i.test(raw) ||
    /employer demo request:|entrepreneur demo request:/i.test(raw) ||
    /\[demo-slot:/i.test(raw) ||
    /preferred demo:/i.test(raw);
  if (!looksLikeDemo) return null;
  const rows = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf(':');
      if (idx <= 0) return { label: 'Note', value: prettyDemoNoteValue(line) };
      return {
        label: line.slice(0, idx).trim(),
        value: prettyDemoNoteValue(line.slice(idx + 1).trim()),
      };
    })
    .filter((row) => row.value && row.value !== '—');
  return rows.length ? rows : null;
}

export function isDefaultLeadStatus(status: string | null | undefined): status is DefaultLeadStatus {
  return DEFAULT_LEAD_STATUSES.includes(String(status || '').trim() as DefaultLeadStatus);
}

export function isProtectedLeadStatus(status: string | null | undefined, hqMode = false): boolean {
  const key = String(status || '').trim().toLowerCase();
  if (DEFAULT_LEAD_STATUS_SET.has(key)) return true;
  return hqMode && HQ_ONLY_LEAD_STATUS_SET.has(key);
}

export function mergeLeadStatusOptions(
  savedStatuses: string[] | null | undefined,
  currentStatus: string | null | undefined,
  { hqMode = false, includeHqOnlyStatuses }: { hqMode?: boolean; includeHqOnlyStatuses?: boolean } = {},
) {
  const injectHqOnly = includeHqOnlyStatuses ?? hqMode;
  const currentKey = String(currentStatus || '').trim().toLowerCase();
  const seen = new Set<string>();
  const merged: string[] = [];
  const push = (value: string | null | undefined) => {
    const normalized = String(value || '').trim();
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    // Never surface HQ-only Demo/Trial on tenant Phase 2 dropdowns (except the current value).
    if (!hqMode && HQ_ONLY_LEAD_STATUS_SET.has(key) && key !== currentKey) return;
    seen.add(key);
    merged.push(normalized);
  };

  if (injectHqOnly) {
    push('New');
    HQ_ONLY_LEAD_STATUSES.forEach(push);
  }
  DEFAULT_LEAD_STATUSES.forEach(push);
  (savedStatuses || []).forEach(push);
  push(currentStatus);

  return merged;
}

export const NOTE_TAG_OPTIONS: (LeadNoteTag | 'All')[] = ['All', 'HR', 'Finance', 'Contract', 'Feedback'];

export const NOTE_TAG_STYLES: Record<LeadNoteTag, string> = {
  HR: 'bg-blue-100 text-blue-700 border-blue-200',
  Finance: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Contract: 'bg-amber-100 text-amber-700 border-amber-200',
  Feedback: 'bg-violet-100 text-violet-700 border-violet-200',
};

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const EMAIL_DOMAIN_REGEX = /^[a-zA-Z]{2,}$/;

export const KNOWN_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'rediffmail.com',
  'mail.com',
  'live.com',
];

export function levenshtein(a: string, b: string) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array(n + 1)
      .fill(0)
      .map((_, j) => (j === 0 ? i : 0))
  );

  for (let j = 0; j <= n; j += 1) dp[0][j] = j;
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }

  return dp[m][n];
}

export function validateEmail(email: string) {
  const value = String(email || '').trim();

  if (!EMAIL_REGEX.test(value)) {
    return { valid: false, message: 'Invalid email format' };
  }

  const domain = value.split('@')[1]?.toLowerCase() || '';
  if (!domain || !EMAIL_DOMAIN_REGEX.test(domain.replace(/\./g, ''))) {
    return { valid: false, message: 'Invalid email format' };
  }

  if (!KNOWN_DOMAINS.includes(domain)) {
    let best: string | null = null;
    let bestDist = Infinity;

    for (const known of KNOWN_DOMAINS) {
      const dist = levenshtein(domain, known);
      if (dist < bestDist) {
        bestDist = dist;
        best = known;
      }
    }

    if (bestDist <= 3 && best) {
      return { valid: false, message: `Did you mean @${best}?` };
    }
  }

  return { valid: true, message: 'Valid email' };
}

export type LeadRequiredFieldErrors = Partial<{
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  country: string;
  state: string;
}>;

export function validateLeadRequiredFields(form: {
  companyName?: string;
  contactPerson?: string;
  email?: string;
  emails?: string[];
  phone?: string;
  phones?: string[];
  country?: string;
  countryCode?: string;
  state?: string;
  emailNotAvailable?: boolean;
  phoneNotAvailable?: boolean;
}, options?: { skipPhoneValidation?: boolean }): LeadRequiredFieldErrors {
  const errors: LeadRequiredFieldErrors = {};
  const companyName = String(form.companyName || '').trim();
  const contactPerson = String(form.contactPerson || '').trim();
  const country = String(form.country || '').trim();
  const state = String(form.state || '').trim();
  const email = form.emailNotAvailable
    ? ''
    : primaryContactValue(normalizeContactList(form.emails, form.email));
  const phone = form.phoneNotAvailable
    ? ''
    : primaryContactValue(normalizeContactList(form.phones, form.phone));

  if (!companyName) errors.companyName = 'Company is required';
  if (!contactPerson) errors.contactPerson = 'Director name is required';

  if (form.emailNotAvailable && form.phoneNotAvailable) {
    errors.email = 'Email and mobile cannot both be marked not available';
    errors.phone = 'Provide email or mobile number (at least one)';
  } else {
    if (!form.emailNotAvailable && !email) {
      errors.email = 'Enter an email or mark Not available';
    } else if (email) {
      const result = validateEmail(email);
      if (!result.valid) {
        errors.email = result.message;
      }
    }
    if (!form.phoneNotAvailable && !phone) {
      errors.phone = 'Enter a mobile number or mark Not available';
    } else if (phone && !options?.skipPhoneValidation) {
      const phoneResult = validatePhoneForCountry(phone, form.countryCode, form.country);
      if (!phoneResult.valid) {
        errors.phone = phoneResult.message || 'Enter a valid mobile number';
      }
    }
  }

  return errors;
}

export type AddLeadWizardStep =
  | 'workspace'
  | 'company'
  | 'location'
  | 'contacts'
  | 'source'
  | 'followup'
  | 'business'
  | 'other';

export const TENANT_ADD_LEAD_WIZARD_STEPS: AddLeadWizardStep[] = [
  'company',
  'location',
  'contacts',
  'source',
  'followup',
  'business',
  'other',
];

export const ADD_LEAD_WIZARD_STEP_LABELS: Record<AddLeadWizardStep, string> = {
  workspace: 'Workspace',
  company: 'Company',
  location: 'Location',
  contacts: 'Contacts',
  source: 'Source',
  followup: 'Follow-up',
  business: 'Business',
  other: 'Other',
};

export function validateAddLeadWizardStep(
  step: AddLeadWizardStep,
  form: Parameters<typeof validateLeadRequiredFields>[0],
): LeadRequiredFieldErrors {
  switch (step) {
    case 'workspace':
      return {};
    case 'company':
      return String(form.companyName || '').trim()
        ? {}
        : { companyName: 'Company is required' };
    case 'location': {
      const errors: LeadRequiredFieldErrors = {};
      if (!String(form.country || '').trim()) errors.country = 'Country is required';
      if (!String(form.state || '').trim()) errors.state = 'State is required';
      return errors;
    }
    case 'contacts': {
      const all = validateLeadRequiredFields(form);
      const errors: LeadRequiredFieldErrors = {};
      if (all.contactPerson) errors.contactPerson = all.contactPerson;
      if (all.email) errors.email = all.email;
      if (all.phone) errors.phone = all.phone;
      return errors;
    }
    default:
      return {};
  }
}

export function AddLeadAiFlowProgress({ stage }: { stage: 'chat' | 'form' }) {
  const steps = [
    { id: 'chat' as const, label: 'Chat with AI' },
    { id: 'form' as const, label: 'Review form' },
  ];
  const activeIndex = stage === 'chat' ? 0 : 1;

  return (
    <div className="shrink-0 px-6 pb-4">
      <div className="flex items-center gap-1 rounded-2xl bg-white/80 p-1 shadow-[0_8px_24px_-16px_rgba(79,70,229,0.45)] ring-1 ring-indigo-100/80">
        {steps.map((step, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex;
          return (
            <div
              key={step.id}
              className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                active
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25'
                  : done
                    ? 'text-indigo-700'
                    : 'text-slate-400'
              }`}
            >
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  active ? 'bg-white/20 text-white' : done ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'
                }`}
              >
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className="truncate">{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AddLeadWizardProgress({
  steps,
  currentStep,
}: {
  steps: AddLeadWizardStep[];
  currentStep: AddLeadWizardStep;
}) {
  const stepIndex = Math.max(0, steps.indexOf(currentStep));

  return (
    <div className="shrink-0 border-b border-blue-100/80 bg-white/90 px-6 py-4">
      <div className="flex items-center gap-1.5">
        {steps.map((step, i) => {
          const done = i < stepIndex;
          const active = i === stepIndex;
          return (
            <div key={step} className="flex min-w-0 flex-1 items-center gap-1.5">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-bold transition-all ${
                  done
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                    : active
                      ? 'bg-blue-600 text-white ring-4 ring-blue-500/20'
                      : 'bg-slate-100 text-slate-400 ring-1 ring-slate-200'
                }`}
                title={ADD_LEAD_WIZARD_STEP_LABELS[step]}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              {i < steps.length - 1 ? (
                <div
                  className={`h-1 min-w-[6px] flex-1 rounded-full ${
                    done
                      ? 'bg-blue-600'
                      : active
                        ? 'bg-gradient-to-r from-blue-600 to-slate-200'
                        : 'bg-slate-200'
                  }`}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-slate-400">
        Step {stepIndex + 1} of {steps.length} · {ADD_LEAD_WIZARD_STEP_LABELS[currentStep]}
      </p>
    </div>
  );
}

export type AssignLeadFormData = {
  /** Legacy single-assignee — kept for backwards compatibility (primary owner). */
  assignTo: string;
  /** Multi-assignee — full list of user ids to assign. First entry is the primary owner. */
  assignTos?: string[];
  priority: 'High' | 'Medium' | 'Low';
  notifyUser: boolean;
};

export type MarkLostFormData = {
  lostReason: string;
  notes: string;
};

export type AddLeadFormData = AgreementTermsFormValues & {
  /** Agreements & Terms — single signed document uploaded against the lead. */
  agreementsFile?: File | null;
  agreementsFileName?: string;
  agreementsFileUrl?: string;
  agreementsUploadedAt?: string;
  // Company Information Section
  companyName: string;
  industry?: string;
  companySize?: string;
  website?: string;
  linkedIn?: string;
  location?: string;
  // Contact Section
  directorSalutation?: string;
  contactPerson: string;
  /** Extra directors (name + email + phone). Primary is also mirrored in contactPerson/emails/phones. */
  directors: DirectorListItem[];
  designation?: string;
  email: string;
  phone?: string;
  emails: string[];
  phones: string[];
  /** When true, email may be empty (marked not available). */
  emailNotAvailable?: boolean;
  /** When true, phone may be empty (marked not available). */
  phoneNotAvailable?: boolean;
  country?: string;
  countryCode?: string;
  city?: string;
  /** Smart-location autofill metadata (OSM/Nominatim). */
  state?: string;
  latitude?: number | null;
  longitude?: number | null;
  // Lead Details Section
  type?: LeadType;
  source?: LeadSource;
  campaignName?: string;
  campaignLink?: string;
  referralName?: string;
  sourceWebsiteUrl?: string;
  sourceLinkedInUrl?: string;
  sourceEmail?: string;
  sourceOther?: string;
  otherDetails?: Array<{ label: string; value: string }>;
  teamMemberDesignation?: string;
  teamMemberEmail?: string;
  teamMemberPhone?: string;
  teamMembers: TeamMemberListItem[];
  assignedToName?: string;
  assignedToId?: string;
  /** Multi-assignee ids — primary owner is the first entry. */
  assignedToIds?: string[];
  status?: LeadStatus;
  priority?: 'High' | 'Medium' | 'Low';
  interestedNeeds?: string;
  notes?: string;
  lastFollowUp?: string;
  nextFollowUp?: string;
  /** Optional follow-up type when scheduling on create (Call, Email, …). */
  followUpType?: string;
  /** Optional notes stored with the initial next follow-up. */
  followUpNotes?: string;
  followUpContact?: string;
  followUpMeetLink?: string;
  followUpReminder?: string;
  followUpTimezone?: string;
  followUpAttendeeIds?: string[];
  /** Mark initial follow-up as postponed with a later date. */
  followUpPostponed?: boolean;
  followUpPostponeReason?: string;
  followUpPostponePreset?: string;
  occasions?: LeadOccasionFormValues;
};

export function syncLeadTeamMembers(
  members?: Array<TeamMemberListItem | null | undefined> | null,
) {
  const teamMembers = normalizeTeamMemberList(members);
  return {
    teamMembers,
    ...primaryTeamMemberFromList(teamMembers),
  };
}

export const getSourceFieldLabel = (source?: LeadSource | null) => {
  switch (source) {
    case 'Website':
      return 'Website Link';
    case 'LinkedIn':
      return 'LinkedIn URL';
    case 'Email':
      return 'Source Email';
    case 'Referral':
      return 'Referral Name';
    case 'Campaign':
      return 'Campaign Name / Link';
    case 'Other':
      return 'Custom source';
    default:
      return 'Source Detail';
  }
};

export interface LeadDetailsDrawerProps {
  lead: Lead | null;
  /** When true, drawer opens in "Add Lead" mode (no lead selected) */
  addLeadMode?: boolean;
  /** When true with addLeadMode, open the Create with AI chat panel on mount */
  initialOpenAiChat?: boolean;
  /** Controls whether the drawer should immediately open in edit mode */
  initialMode?: 'view' | 'edit';
  onClose: () => void;
  /** Called when user submits the Add Lead form */
  onAddLead?: (data: AddLeadFormData, createdLead?: BackendLead) => void;
  /**
   * Optional create path (e.g. public intake form / HQ). When set, replaces `apiCreateLead`
   * and skips authenticated duplicate-check / file uploads that need a CRM session.
   */
  createLeadOverride?: (data: CreateLeadData) => Promise<BackendLead | undefined | null>;
  /**
   * Optional update path (e.g. HQ leads). When set, replaces `apiUpdateLead` for overview saves.
   */
  updateLeadOverride?: (
    leadId: string,
    data: Record<string, unknown>,
  ) => Promise<BackendLead | undefined | null>;
  /** HQ /hq/leads — adds Demo and Trial to the Add Lead status dropdown only. */
  hqMode?: boolean;
  onUpdateLead?: (updatedLead?: BackendLead) => void;
  onConvert?: (id: string, form: {
    companyName: string;
    primaryContact: string;
    email: string;
    phone: string;
    industry: string;
    companySize: string;
    accountManager: string;
    createJobRequirement: boolean;
  }) => void;
  onMarkLost?: (id: string, formData?: MarkLostFormData) => void;
  onAssignLead?: (id: string, formData: AssignLeadFormData) => void;
  onDeleteLead?: (id: string) => void;
  /** Optional: parent-level handler invoked after a successful duplicate. */
  onDuplicateLead?: (newLead: BackendLead) => void;
  /** Open an existing lead from duplicate-check (e.g. switch drawer to that lead). */
  onOpenExistingLead?: (leadId: string) => void;
}

export function isLeadAlreadyConverted(lead: Lead | null | undefined): boolean {
  return Boolean(lead && (lead.status === 'Converted' || lead.convertedToClientId));
}

export function leadConvertedAlertMessage(lead: Lead | null | undefined): string {
  const clientLabel = lead?.convertedClientName ? ` (${lead.convertedClientName})` : '';
  return `This lead has already been converted to a client${clientLabel}. A duplicate client will not be created.`;
}

export const ADD_LEAD_DRAWER_WIDTH_KEY = 'hrayntra.addLeadDrawerWidth';

export const ADD_LEAD_DRAWER_MIN_WIDTH = 520;

export const ADD_LEAD_DRAWER_MAX_WIDTH_RATIO = 0.9;

export const ADD_LEAD_DRAWER_DEFAULT_WIDTH = 768;

export function getAddLeadDrawerMaxWidth(viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280) {
  return Math.round(viewportWidth * ADD_LEAD_DRAWER_MAX_WIDTH_RATIO);
}

export function clampAddLeadDrawerWidth(width: number, viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280) {
  const maxW = Math.min(getAddLeadDrawerMaxWidth(viewportWidth), viewportWidth);
  const minW = Math.min(ADD_LEAD_DRAWER_MIN_WIDTH, viewportWidth);
  return Math.min(maxW, Math.max(minW, Math.round(width)));
}

export function getInitialAddLeadDrawerWidth(): number {
  if (typeof window === 'undefined') return ADD_LEAD_DRAWER_DEFAULT_WIDTH;

  const stored = window.localStorage.getItem(ADD_LEAD_DRAWER_WIDTH_KEY);
  if (stored) {
    const parsed = Number(stored);
    if (Number.isFinite(parsed)) {
      return clampAddLeadDrawerWidth(parsed);
    }
  }

  return clampAddLeadDrawerWidth(Math.min(Math.round(window.innerWidth * 0.64), ADD_LEAD_DRAWER_DEFAULT_WIDTH));
}

export function LeadDetailsPanelShell({
  mode,
  panelRef,
  drawerWidth,
  onBeginResize,
  children,
  dialogTitleId = 'lead-details-modal-title',
  onBackdropClick,
}: {
  mode: 'modal' | 'drawer';
  panelRef: React.RefObject<HTMLDivElement | null>;
  drawerWidth: number;
  onBeginResize: (event: React.MouseEvent<HTMLDivElement>) => void;
  children: React.ReactNode;
  dialogTitleId?: string;
  size?: 'md' | 'lg';
  sidePanel?: React.ReactNode;
  modernAi?: boolean;
  onBackdropClick?: () => void;
}) {
  if (mode === 'modal') {
    return (
      <DetailsModalShell
        panelRef={panelRef}
        variant="main"
        dialogTitleId={dialogTitleId}
        onBackdropClick={onBackdropClick}
      >
        {children}
      </DetailsModalShell>
    );
  }

  return (
    <motion.div
      key="panel"
      ref={panelRef as React.Ref<HTMLDivElement>}
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="pointer-events-auto fixed right-0 top-0 z-[56] flex h-full flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl"
      style={{ width: drawerWidth, maxWidth: '100vw' }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize lead drawer"
        title="Drag to resize drawer"
        onMouseDown={onBeginResize}
        className="group absolute left-0 top-0 z-20 hidden h-full w-3 -translate-x-1/2 cursor-col-resize items-center justify-center hover:bg-blue-500/5 active:bg-blue-500/10 sm:flex"
      >
        <div className="flex h-14 w-4 items-center justify-center rounded-full border border-slate-200/80 bg-white shadow-sm transition-colors group-hover:border-blue-200 group-hover:bg-blue-50 group-active:border-blue-300">
          <GripVertical
            size={12}
            className="text-slate-400 transition-colors group-hover:text-blue-500 group-active:text-blue-600"
            aria-hidden
          />
        </div>
      </div>
      {children}
    </motion.div>
  );
}

export const FieldRow = ({
  label,
  value,
  href,
  multiline,
}: {
  label: string;
  value: string;
  href?: boolean;
  multiline?: boolean;
}) => {
  const urls = href ? splitDisplayUrls(value) : [];
  return (
    <div className="flex flex-col gap-0.5 py-2 border-b border-slate-100 last:border-0">
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      {urls.length ? (
        <div className="flex flex-col gap-1.5">
          {urls.map((url) => (
            <DrawerLinkActions key={url} url={url} shareTitle={label} />
          ))}
        </div>
      ) : value ? (
        <p
          className={`text-sm font-medium text-slate-900 ${href ? 'text-blue-600 hover:underline cursor-pointer' : ''} ${multiline ? 'whitespace-pre-line' : 'truncate'}`}
        >
          {value}
        </p>
      ) : (
        <div className="h-5" />
      )}
    </div>
  );
};

export const FieldRowDateTime = ({ label, value }: { label: string; value: string | null | undefined }) => {
  const parts = splitDateTimeForDisplay(value);
  return (
    <div className="flex flex-col gap-1 py-2 border-b border-slate-100 last:border-0">
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      {parts ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Date</p>
            <p className="text-sm font-medium text-slate-900">{parts.date}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Time</p>
            <p className="text-sm font-medium text-slate-900">{parts.time}</p>
          </div>
        </div>
      ) : (
        <div className="h-5" />
      )}
    </div>
  );
};

export function OverviewField({
  label,
  icon,
  iconClassName = 'text-slate-400',
  required,
  value,
  href,
  multiline,
}: {
  label: string;
  icon?: AppIcon;
  iconClassName?: string;
  required?: boolean;
  value: string;
  href?: boolean;
  multiline?: boolean;
}) {
  const displayValue = cleanDisplayText(value, '');
  const urls = href ? splitDisplayUrls(displayValue) : [];
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3.5 py-3">
      <AddLeadFieldLabel label={label} icon={icon} iconClassName={iconClassName} required={required} />
      {urls.length ? (
        <div className="mt-1 flex flex-col gap-1.5">
          {urls.map((url) => (
            <DrawerLinkActions key={url} url={url} shareTitle={label} />
          ))}
        </div>
      ) : displayValue ? (
        <p className={`text-sm font-semibold text-slate-900 ${multiline ? 'whitespace-pre-line' : ''}`}>
          {displayValue}
        </p>
      ) : (
        <p className="text-sm text-slate-400">—</p>
      )}
    </div>
  );
}

export function getLeadSourceDetailValue(lead: Lead | null | undefined): string {
  if (!lead) return '';
  switch (lead.source) {
    case 'Website':
      return lead.sourceWebsiteUrl ?? lead.website ?? '';
    case 'LinkedIn':
      return lead.sourceLinkedInUrl ?? lead.linkedIn ?? '';
    case 'Email':
      return lead.sourceEmail ?? lead.email ?? '';
    case 'Referral':
      return lead.referralName ?? '';
    case 'Campaign':
      return [lead.campaignName, lead.campaignLink].filter(Boolean).join(' · ');
    case 'Other':
      return lead.sourceOther ?? '';
    default:
      return '';
  }
}

export function OverviewFieldDateTime({
  label,
  icon,
  iconClassName = 'text-slate-400',
  value,
}: {
  label: string;
  icon?: AppIcon;
  iconClassName?: string;
  value: string | null | undefined;
}) {
  const parts = splitDateTimeForDisplay(value);
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3.5 py-3">
      <AddLeadFieldLabel label={label} icon={icon} iconClassName={iconClassName} />
      {parts ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Date</p>
            <p className="text-sm font-semibold text-slate-900">{parts.date}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Time</p>
            <p className="text-sm font-semibold text-slate-900">{parts.time}</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-400">—</p>
      )}
    </div>
  );
}

export const LeadStatusDropdown = ({
  value,
  options,
  onSelect,
  onDelete,
  deleting,
  preferUpward = false,
  hqMode = false,
}: {
  value: string;
  options: string[];
  onSelect: (status: string) => void;
  onDelete: (status: string) => void;
  deleting: boolean;
  preferUpward?: boolean;
  hqMode?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const closeMenu = useCallback(() => setOpen(false), []);
  const { triggerRef, menuRef, menuPosition } = useDrawerPortalDropdownPosition(open, preferUpward, closeMenu);

  const menu =
    open && menuPosition && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-[1200] max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white shadow-2xl"
            style={{
              left: menuPosition.left,
              width: menuPosition.width,
              ...(menuPosition.placement === 'top'
                ? { bottom: menuPosition.bottom }
                : { top: menuPosition.top }),
            }}
          >
            {options.map((status) => {
              const isDefault = isProtectedLeadStatus(status, hqMode);
              const isActive = String(value || '') === String(status || '');
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => {
                    onSelect(status);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${
                    isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <span>{status}</span>
                  {!isDefault ? (
                    <span
                      role="button"
                      aria-label={`Delete ${status}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(status);
                      }}
                      className={`inline-flex items-center rounded p-1 text-rose-500 hover:bg-rose-50 hover:text-rose-600 ${
                        deleting ? 'pointer-events-none opacity-50' : ''
                      }`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-left text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
      >
        <span>{value || 'New'}</span>
        <ChevronDown
          size={16}
          className={`text-slate-500 transition-transform ${open && menuPosition?.placement === 'top' ? 'rotate-180' : ''}`}
        />
      </button>
      {menu}
    </div>
  );
};
