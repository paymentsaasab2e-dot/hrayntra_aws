'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { usePageDrawerLifecycle } from '../../lib/pageDrawerEvents';
import { buildFileHref } from '../../utils/cloudinaryUrls';
import {
  splitDateTimeForDisplay,
  toDateTimeLocalInput,
  fromDateTimeLocalInput,
} from '../../utils/formatLeadDateTime';
import { formatDateDMY, formatDateTimeDMY } from '../../utils/dateDisplay';
import { FollowUpDateTimeField } from '../FollowUpDateTimeField';
import { formatFollowUpDisplay } from '../../utils/formatLeadDateTime';
import { clampDateTimeLocalToMin, getLocalDateTimeInputMinNow } from '../../utils/dateInputConstraints';
import { exportLeadAsPdf } from '../../utils/exportLeadPdf';
import { NAME_SALUTATION_OPTIONS, formatDirectorDisplay } from '../../constants/salutations';
import { MultiContactFields } from '../ui/MultiContactFields';
import {
  buildContactChannelsFromForm,
  contactListForForm,
  formatContactListMultiline,
  normalizeContactList,
  primaryContactValue,
} from '../../lib/contact-channels';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { requestConfirm, requestError } from '../../lib/appDialog';
import {
  Edit2,
  MoreVertical,
  Building2,
  User,
  Mail,
  Phone,
  Target,
  Calendar,
  PhoneCall,
  CalendarPlus,
  CalendarClock,
  UserPlus,
  XCircle,
  UserCog,
  Clock,
  Activity,
  StickyNote,
  Paperclip,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  Plus,
  Sparkles,
  AlertTriangle,
  Check,
  Trash2,
  Pin,
  Pencil,
  Upload,
  Download,
  Eye,
  FileText,
  X,
  MessageSquare,
  Link2,
  MapPin,
  Briefcase,
  Globe,
  Users,
  IndianRupee,
  Layers,
  Megaphone,
  Flag,
  GripVertical,
  Copy,
  ExternalLink,
} from 'lucide-react';
import type { DefaultLeadStatus, Lead, LeadStatus, LeadSource, LeadType, LeadNote, LeadNoteTag, Activity as LeadActivity } from '@/app/leads/types';
import { EntityAuditSummary } from '../table/TableAuditCell';
import { DrawerEntityChatTab } from './DrawerEntityChatTab';
import { extractAuditMeta } from '../../utils/auditMeta';
import { ImageWithFallback } from '../ImageWithFallback';
import { ScheduleMeetingForm } from '../ScheduleMeetingForm';
import { LeadFollowUpTabPanel } from './LeadFollowUpTabPanel';
import { NotesService } from '../NotesService';
import {
  apiAppendLeadStatus,
  apiCheckLeadDuplicate,
  apiCreateLead,
  apiGenerateLeadDetails,
  apiGetLeadPublicFormLink,
  type LeadAiChatMessage,
  apiGetLead,
  apiGetLeadActivities,
  apiGetLeadStatusCatalog,
  apiRemoveLeadStatus,
  apiUpdateLead,
  filesApiUpload,
  type CreateLeadData,
  type BackendActivity,
  type BackendLead,
} from '../../lib/api';
import { KycDocumentsField, KycDocumentsView } from '../documents/KycDocumentsField';
import { AgreementDocumentUpload } from '../documents/AgreementDocumentUpload';
import { AgreementTermsSection } from '../agreements/AgreementTermsSection';
import {
  agreementTermsApiPayload,
  agreementTermsFromRecord,
  emptyAgreementTerms,
  formatAgreementTermsSummary,
  type AgreementTermsFormValues,
} from '../../lib/agreementTerms';
import { DocumentUploadButton, useDocumentUploadFeedback } from '../import/documentUploadUi';
import { filterKycFiles, uploadKycDocuments } from '../../lib/kycDocuments';
import { useFiles } from '../../hooks/useFiles';
import { apiGetLeadAssignableMembers } from '../../lib/api';
import type { TeamMember } from '../../types/team';
import { LeadAssigneesMultiSelect } from './LeadAssigneesMultiSelect';
import { LeadAiChatDrawer } from '../leads/LeadAiChatDrawer';
import { EntityWorkspaceAlertsPanel } from '../ai/EntityWorkspaceAlertsPanel';
import type { LeadAiGeneratedPayload } from '@/lib/leadAiHelpers';
import {
  mergeAiCompanyLinks,
  mergeAiSourceFields,
  mergeAiTeamMembers,
  normalizeLeadDateTimeInput,
  resolveAiDirectorFields,
  resolveAiLocationFields,
} from '@/lib/leadAiHelpers';
import { ServicesNeededSelect } from '../forms/ServicesNeededSelect';
import { IndustryMultiSelect } from '../forms/IndustryMultiSelect';
import { formatIndustriesDisplay } from '../../lib/industryOptions';
import { DirectorContactFields } from '../forms/DirectorContactFields';
import { TeamMemberOptionalFields } from '../forms/TeamMemberOptionalFields';
import {
  isTeamMemberDetailLabel,
  mergeTeamMemberIntoOtherDetails,
  resolveTeamMemberList,
  normalizeTeamMemberList,
  primaryTeamMemberFromList,
  teamMemberHasAnyValue,
  teamMemberPayloadFromForm,
  type TeamMemberListItem,
} from '../../lib/teamMemberFormDetails';
import { formatServicesNeededDisplay } from '../../lib/companyServices';
import { DrawerCloseButton } from './DrawerCloseButton';
import {
  AddLeadFieldLabel,
  AddLeadIconInput,
  AddLeadSectionCard,
  AddLeadSelectDropdown,
  ADD_LEAD_INPUT,
  ADD_LEAD_INPUT_WITH_ICON,
  useDrawerPortalDropdownPosition,
} from './drawerFormUi';
import { LeadSourceFields } from './LeadSourceFields';
import type { LocationSelection } from '../LocationAutocomplete';
import { CscLocationFields } from '../location/CscLocationFields';
import { getCountryByCodeOrName, inferLocationFromCityName } from '../../lib/cscData';
import { validatePhoneForCountry } from '../../lib/phoneByCountry';
import { WhatsAppIcon } from '../icons/WhatsAppIcon';

const CALL_OUTCOMES = ['Interested', 'Follow-up Required', 'No Answer', 'Wrong Number', 'Not Interested'];

function mergeLocationFields<
  T extends {
    location?: string;
    city?: string;
    country?: string;
    state?: string;
    latitude?: number;
    longitude?: number;
  },
>(prev: T, selection: LocationSelection): T {
  return {
    ...prev,
    location: selection.location,
    city: selection.city?.trim() ? selection.city : prev.city ?? '',
    country: selection.country?.trim() ? selection.country : prev.country ?? '',
    countryCode: selection.countryCode?.trim()
      ? selection.countryCode
      : (prev as { countryCode?: string }).countryCode ?? '',
    state: selection.state?.trim() ? selection.state : prev.state ?? '',
    latitude: selection.latitude,
    longitude: selection.longitude,
  };
}

const DEFAULT_LEAD_STATUSES: DefaultLeadStatus[] = ['New', 'Contacted', 'Qualified', 'Converted', 'Lost'];
const DEFAULT_LEAD_STATUS_SET = new Set(DEFAULT_LEAD_STATUSES.map((status) => status.toLowerCase()));

const STATUS_STYLES: Record<DefaultLeadStatus, string> = {
  New: 'bg-blue-50 text-blue-700 border-blue-100',
  Contacted: 'bg-yellow-50 text-yellow-700 border-yellow-100',
  Qualified: 'bg-purple-50 text-purple-700 border-purple-100',
  Converted: 'bg-green-50 text-green-700 border-green-100',
  Lost: 'bg-gray-50 text-gray-700 border-gray-100',
};

function isDefaultLeadStatus(status: string | null | undefined): status is DefaultLeadStatus {
  return DEFAULT_LEAD_STATUSES.includes(String(status || '').trim() as DefaultLeadStatus);
}

function mergeLeadStatusOptions(
  savedStatuses: string[] | null | undefined,
  currentStatus: string | null | undefined,
) {
  const seen = new Set<string>();
  const merged: string[] = [];
  const push = (value: string | null | undefined) => {
    const normalized = String(value || '').trim();
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(normalized);
  };

  DEFAULT_LEAD_STATUSES.forEach(push);
  (savedStatuses || []).forEach(push);
  push(currentStatus);

  return merged;
}

const NOTE_TAG_OPTIONS: (LeadNoteTag | 'All')[] = ['All', 'HR', 'Finance', 'Contract', 'Feedback'];

const NOTE_TAG_STYLES: Record<LeadNoteTag, string> = {
  HR: 'bg-blue-100 text-blue-700 border-blue-200',
  Finance: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Contract: 'bg-amber-100 text-amber-700 border-amber-200',
  Feedback: 'bg-violet-100 text-violet-700 border-violet-200',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_DOMAIN_REGEX = /^[a-zA-Z]{2,}$/;
const KNOWN_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'rediffmail.com',
  'mail.com',
  'live.com',
];

function levenshtein(a: string, b: string) {
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

function validateEmail(email: string) {
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

type LeadRequiredFieldErrors = Partial<{
  companyName: string;
  email: string;
  phone: string;
}>;

function validateLeadRequiredFields(form: {
  companyName?: string;
  contactPerson?: string;
  email?: string;
  emails?: string[];
  phone?: string;
  phones?: string[];
  country?: string;
  countryCode?: string;
}, options?: { skipPhoneValidation?: boolean }): LeadRequiredFieldErrors {
  const errors: LeadRequiredFieldErrors = {};
  const companyName = String(form.companyName || '').trim();
  const email = primaryContactValue(normalizeContactList(form.emails, form.email));
  const phone = primaryContactValue(normalizeContactList(form.phones, form.phone));

  if (!companyName) errors.companyName = 'Company is required';
  if (!email) {
    errors.email = 'Email is required';
  } else {
    const result = validateEmail(email);
    if (!result.valid) {
      errors.email = result.message;
    }
  }

  if (phone && !options?.skipPhoneValidation) {
    const phoneResult = validatePhoneForCountry(phone, form.countryCode, form.country);
    if (!phoneResult.valid) {
      errors.phone = phoneResult.message || 'Enter a valid mobile number';
    }
  }

  return errors;
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
  designation?: string;
  email: string;
  phone?: string;
  emails: string[];
  phones: string[];
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
};

function syncLeadTeamMembers(
  members?: Array<TeamMemberListItem | null | undefined> | null,
) {
  const teamMembers = normalizeTeamMemberList(members);
  return {
    teamMembers,
    ...primaryTeamMemberFromList(teamMembers),
  };
}

const getSourceFieldLabel = (source?: LeadSource) => {
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
    default:
      return 'Source Detail';
  }
};

interface LeadDetailsDrawerProps {
  lead: Lead | null;
  /** When true, drawer opens in "Add Lead" mode (no lead selected) */
  addLeadMode?: boolean;
  /** Controls whether the drawer should immediately open in edit mode */
  initialMode?: 'view' | 'edit';
  onClose: () => void;
  /** Called when user submits the Add Lead form */
  onAddLead?: (data: AddLeadFormData, createdLead?: BackendLead) => void;
  /**
   * Optional create path (e.g. public intake form). When set, replaces `apiCreateLead`
   * and skips authenticated duplicate-check / file uploads that need a CRM session.
   */
  createLeadOverride?: (data: CreateLeadData) => Promise<BackendLead | undefined | null>;
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

function isLeadAlreadyConverted(lead: Lead | null | undefined): boolean {
  return Boolean(lead && (lead.status === 'Converted' || lead.convertedToClientId));
}

function leadConvertedAlertMessage(lead: Lead | null | undefined): string {
  const clientLabel = lead?.convertedClientName ? ` (${lead.convertedClientName})` : '';
  return `This lead has already been converted to a client${clientLabel}. A duplicate client will not be created.`;
}

const ADD_LEAD_DRAWER_WIDTH_KEY = 'hrayntra.addLeadDrawerWidth';
const ADD_LEAD_DRAWER_MIN_WIDTH = 520;
const ADD_LEAD_DRAWER_MAX_WIDTH_RATIO = 0.9;
const ADD_LEAD_DRAWER_DEFAULT_WIDTH = 768;

function getAddLeadDrawerMaxWidth(viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280) {
  return Math.round(viewportWidth * ADD_LEAD_DRAWER_MAX_WIDTH_RATIO);
}

function clampAddLeadDrawerWidth(width: number, viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280) {
  return Math.min(
    getAddLeadDrawerMaxWidth(viewportWidth),
    Math.max(ADD_LEAD_DRAWER_MIN_WIDTH, Math.round(width)),
  );
}

function getInitialAddLeadDrawerWidth(): number {
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

const FieldRow = ({
  label,
  value,
  href,
  multiline,
}: {
  label: string;
  value: string;
  href?: boolean;
  multiline?: boolean;
}) => (
  <div className="flex flex-col gap-0.5 py-2 border-b border-slate-100 last:border-0">
    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
    {value ? (
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

const FieldRowDateTime = ({ label, value }: { label: string; value: string | null | undefined }) => {
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

function OverviewField({
  label,
  icon,
  iconClassName = 'text-slate-400',
  required,
  value,
  href,
  multiline,
}: {
  label: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  iconClassName?: string;
  required?: boolean;
  value: string;
  href?: boolean;
  multiline?: boolean;
}) {
  const displayValue = String(value || '').trim();
  return (
    <div>
      <AddLeadFieldLabel label={label} icon={icon} iconClassName={iconClassName} required={required} />
      {displayValue ? (
        <p
          className={`text-sm font-medium text-slate-900 ${href ? 'text-blue-600' : ''} ${
            multiline ? 'whitespace-pre-line' : ''
          }`}
        >
          {displayValue}
        </p>
      ) : (
        <p className="text-sm text-slate-400">—</p>
      )}
    </div>
  );
}

function getLeadSourceDetailValue(lead: Lead | null | undefined): string {
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
    default:
      return '';
  }
}

function OverviewFieldDateTime({
  label,
  icon,
  iconClassName = 'text-slate-400',
  value,
}: {
  label: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  iconClassName?: string;
  value: string | null | undefined;
}) {
  const parts = splitDateTimeForDisplay(value);
  return (
    <div>
      <AddLeadFieldLabel label={label} icon={icon} iconClassName={iconClassName} />
      {parts ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Date</p>
            <p className="text-sm font-medium text-slate-900">{parts.date}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Time</p>
            <p className="text-sm font-medium text-slate-900">{parts.time}</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-400">—</p>
      )}
    </div>
  );
}

const LeadStatusDropdown = ({
  value,
  options,
  onSelect,
  onDelete,
  deleting,
  preferUpward = false,
}: {
  value: string;
  options: string[];
  onSelect: (status: string) => void;
  onDelete: (status: string) => void;
  deleting: boolean;
  preferUpward?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const closeMenu = useCallback(() => setOpen(false), []);
  const { triggerRef, menuRef, menuPosition } = useDrawerPortalDropdownPosition(open, preferUpward, closeMenu);

  const menu =
    open && menuPosition && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-[80] max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white shadow-2xl"
            style={{
              left: menuPosition.left,
              width: menuPosition.width,
              ...(menuPosition.placement === 'top'
                ? { bottom: menuPosition.bottom }
                : { top: menuPosition.top }),
            }}
          >
            {options.map((status) => {
              const isDefault = DEFAULT_LEAD_STATUS_SET.has(String(status || '').toLowerCase());
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

export function LeadDetailsDrawer({
  lead,
  addLeadMode = false,
  initialMode = 'view',
  onClose,
  onAddLead,
  createLeadOverride,
  onUpdateLead,
  onConvert,
  onMarkLost,
  onAssignLead,
  onDeleteLead,
  onDuplicateLead,
  onOpenExistingLead,
}: LeadDetailsDrawerProps) {
  usePageDrawerLifecycle(Boolean(lead) || addLeadMode);
  const isPublicIntakeMode = Boolean(createLeadOverride);
  const [activeTab, setActiveTab] = useState<'overview' | 'activities' | 'notes' | 'files' | 'chat' | 'followup' | 'add'>(
    'overview'
  );
  const [leadFilesTypeFilter, setLeadFilesTypeFilter] = useState<'All' | 'Contract' | 'Proposal' | 'Other'>('All');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    files: leadFiles,
    loading: filesLoading,
    uploading: filesUploading,
    uploadSuccess: filesUploadSuccess,
    uploadPercent: filesUploadPercent,
    error: filesError,
    uploadFile,
    deleteFile,
  } = useFiles('lead', lead?.id);

  useEffect(() => {
    if (addLeadMode) setActiveTab('add');
  }, [addLeadMode]);

  const [publicLeadFormLink, setPublicLeadFormLink] = useState('');
  const [publicLeadFormTenant, setPublicLeadFormTenant] = useState('');
  const [publicLeadFormLinkLoading, setPublicLeadFormLinkLoading] = useState(false);
  const [publicLeadFormLinkCopied, setPublicLeadFormLinkCopied] = useState(false);

  useEffect(() => {
    if (!addLeadMode || isPublicIntakeMode) {
      setPublicLeadFormLink('');
      setPublicLeadFormTenant('');
      setPublicLeadFormLinkCopied(false);
      return;
    }
    let cancelled = false;
    setPublicLeadFormLinkLoading(true);
    apiGetLeadPublicFormLink()
      .then((res) => {
        if (!cancelled) {
          const payload =
            (res as { data?: { formUrl?: string; tenantDbName?: string | null } })?.data ?? res;
          const data = payload as { formUrl?: string; tenantDbName?: string | null };
          setPublicLeadFormLink(data.formUrl || '');
          setPublicLeadFormTenant(String(data.tenantDbName || '').trim());
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPublicLeadFormLink('');
          setPublicLeadFormTenant('');
        }
      })
      .finally(() => {
        if (!cancelled) setPublicLeadFormLinkLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [addLeadMode, isPublicIntakeMode]);

  useEffect(() => {
    if (addLeadMode || !lead) return;
    if (isLeadAlreadyConverted(lead)) {
      setOverviewEditMode(false);
      setOverviewEditErrors({});
      return;
    }
    if (initialMode === 'edit') {
      startOverviewEdit();
      return;
    }
    setOverviewEditMode(false);
    setOverviewEditErrors({});
  }, [addLeadMode, initialMode, lead?.id, lead?.status, lead?.convertedToClientId]);

  const [addLeadForm, setAddLeadForm] = useState<AddLeadFormData>({
    ...emptyAgreementTerms(),
    // Company Information
    companyName: '',
    industry: '',
    companySize: '',
    website: '',
    linkedIn: '',
    location: '',
    // Contact Person
    directorSalutation: '',
    contactPerson: '',
    designation: '',
    email: '',
    phone: '',
    emails: [''],
    phones: [''],
    country: '',
    countryCode: '',
    city: '',
    state: '',
    latitude: null,
    longitude: null,
    // Lead Details
    type: 'Company',
    source: 'Website',
    campaignName: '',
    campaignLink: '',
    referralName: '',
    sourceWebsiteUrl: '',
    sourceLinkedInUrl: '',
    sourceEmail: '',
    otherDetails: [],
    teamMemberDesignation: '',
    teamMemberEmail: '',
    teamMemberPhone: '',
    teamMembers: normalizeTeamMemberList(),
    assignedToName: '',
    assignedToId: '',
    assignedToIds: [],
    status: 'New',
    priority: 'Medium',
    interestedNeeds: '',
    notes: '',
    lastFollowUp: '',
    nextFollowUp: '',
    followUpType: 'Call',
    followUpNotes: '',
  });
  const [addLeadStatusIsCustom, setAddLeadStatusIsCustom] = useState(false);
  const [leadStatusCatalog, setLeadStatusCatalog] = useState<string[]>(DEFAULT_LEAD_STATUSES);
  const [showAddLeadStatusInput, setShowAddLeadStatusInput] = useState(false);
  const [newLeadStatusValue, setNewLeadStatusValue] = useState('');
  const [savingLeadStatus, setSavingLeadStatus] = useState(false);
  const [deletingLeadStatus, setDeletingLeadStatus] = useState(false);
  const [addLeadErrors, setAddLeadErrors] = useState<LeadRequiredFieldErrors>({});
  const [addLeadDrawerWidth, setAddLeadDrawerWidth] = useState(getInitialAddLeadDrawerWidth);
  const addLeadDrawerResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const addLeadDrawerWidthRef = useRef(addLeadDrawerWidth);

  useEffect(() => {
    addLeadDrawerWidthRef.current = addLeadDrawerWidth;
  }, [addLeadDrawerWidth]);

  /** Pending Agreements & Terms file selected in the Add Lead form (uploaded after the lead is created). */
  const [pendingAddLeadAgreementsFile, setPendingAddLeadAgreementsFile] = useState<File | null>(null);
  const [pendingAddLeadKycFiles, setPendingAddLeadKycFiles] = useState<File[]>([]);
  const [pendingAddLeadTeamMemberKycFiles, setPendingAddLeadTeamMemberKycFiles] = useState<File[]>([]);
  const addLeadAgreementsInputRef = useRef<HTMLInputElement | null>(null);
  /** Pending Agreements & Terms file selected in the Overview edit form (uploaded immediately on save). */
  const [pendingOverviewAgreementsFile, setPendingOverviewAgreementsFile] = useState<File | null>(null);
  const [pendingOverviewKycFiles, setPendingOverviewKycFiles] = useState<File[]>([]);
  const [pendingOverviewTeamMemberKycFiles, setPendingOverviewTeamMemberKycFiles] = useState<File[]>([]);
  const overviewAgreementsInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingAgreements, setUploadingAgreements] = useState(false);
  const [uploadingKyc, setUploadingKyc] = useState(false);
  const agreementsUploadFeedback = useDocumentUploadFeedback(uploadingAgreements);
  const kycUploadFeedback = useDocumentUploadFeedback(uploadingKyc);

  const leadFilesEntityId = addLeadMode ? null : lead?.id;
  const {
    files: leadEntityFiles,
    deleteFile: deleteLeadFile,
    refresh: refetchLeadFiles,
  } = useFiles('lead', leadFilesEntityId);
  const leadKycFiles = React.useMemo(() => filterKycFiles(leadEntityFiles), [leadEntityFiles]);
  const uploadsBase = React.useMemo(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';
    return apiBase.replace(/\/api\/v1\/?$/, '');
  }, []);

  // Fetch recruiters from backend
  const [recruiters, setRecruiters] = useState<TeamMember[]>([]);
  const [loadingRecruiters, setLoadingRecruiters] = useState(false);
  
  useEffect(() => {
    const fetchRecruiters = async () => {
      // Only fetch when drawer is open (either addLeadMode or lead exists)
      if (!addLeadMode && !lead) return;
      // Public intake form has no CRM session — skip assignable-members call.
      if (isPublicIntakeMode) {
        setRecruiters([]);
        setLoadingRecruiters(false);
        return;
      }
      
      setLoadingRecruiters(true);
      try {
        const response = await apiGetLeadAssignableMembers();
        const members = Array.isArray(response.data) ? response.data : [];
        setRecruiters(
          members.map((member) => ({
            id: member.id,
            firstName: member.firstName,
            lastName: member.lastName,
            name:
              member.name ||
              `${member.firstName || ''} ${member.lastName || ''}`.trim() ||
              member.email ||
              'User',
            email: member.email || '',
            role: member.role
              ? {
                  id: member.role.id,
                  roleName: member.role.roleName || '',
                  color: member.role.color,
                }
              : undefined,
            department: member.department
              ? { id: member.department.id, name: member.department.name || '' }
              : undefined,
            status: 'ACTIVE' as const,
          })),
        );
      } catch (error: any) {
        console.error('Failed to fetch recruiters:', error);
        setRecruiters([]);
      } finally {
        setLoadingRecruiters(false);
      }
    };
    
    fetchRecruiters();
  }, [addLeadMode, lead, isPublicIntakeMode]);

  useEffect(() => {
    if (!addLeadMode && !lead) return;

    if (isPublicIntakeMode) {
      setLeadStatusCatalog(mergeLeadStatusOptions(DEFAULT_LEAD_STATUSES, lead?.status ?? addLeadForm.status));
      return;
    }

    let cancelled = false;
    const fetchLeadStatusCatalog = async () => {
      try {
        const response = await apiGetLeadStatusCatalog();
        if (cancelled) return;
        setLeadStatusCatalog(mergeLeadStatusOptions(response?.data?.statuses, lead?.status ?? addLeadForm.status));
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to load lead statuses:', error);
        setLeadStatusCatalog(mergeLeadStatusOptions(DEFAULT_LEAD_STATUSES, lead?.status ?? addLeadForm.status));
      }
    };

    fetchLeadStatusCatalog();
    return () => {
      cancelled = true;
    };
  }, [addLeadMode, lead?.id, isPublicIntakeMode]);

  const resetLeadAiAssistant = () => {
    setLeadAiChatOpen(false);
    setLeadAiChatHistory([]);
    setAllowDuplicateCreate(false);
    setPendingDuplicate(null);
    setShowDuplicateNotification(false);
  };

  const beginAddLeadDrawerResize = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    addLeadDrawerResizeRef.current = {
      startX: event.clientX,
      startWidth: addLeadDrawerWidthRef.current,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!addLeadDrawerResizeRef.current) return;
      const deltaX = addLeadDrawerResizeRef.current.startX - moveEvent.clientX;
      const nextWidth = clampAddLeadDrawerWidth(
        addLeadDrawerResizeRef.current.startWidth + deltaX,
      );
      setAddLeadDrawerWidth(nextWidth);
    };

    const handleMouseUp = () => {
      addLeadDrawerResizeRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      setAddLeadDrawerWidth((current) => {
        const clamped = clampAddLeadDrawerWidth(current);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(ADD_LEAD_DRAWER_WIDTH_KEY, String(clamped));
        }
        return clamped;
      });
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, []);

  useEffect(() => {
    const handleWindowResize = () => {
      setAddLeadDrawerWidth((current) => clampAddLeadDrawerWidth(current));
    };

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);

  const resetAddLeadForm = () => {
    setAddLeadStatusIsCustom(false);
    setAddLeadForm({
      ...emptyAgreementTerms(),
      companyName: '',
      industry: '',
      companySize: '',
      website: '',
      linkedIn: '',
      location: '',
      directorSalutation: '',
      contactPerson: '',
      designation: '',
    email: '',
    phone: '',
    emails: [''],
    phones: [''],
    country: '',
    countryCode: '',
    city: '',
    state: '',
    latitude: null,
    longitude: null,
    type: 'Company',
    source: 'Website',
    campaignName: '',
    campaignLink: '',
    referralName: '',
    sourceWebsiteUrl: '',
    sourceLinkedInUrl: '',
    sourceEmail: '',
    otherDetails: [],
    teamMemberDesignation: '',
    teamMemberEmail: '',
    teamMemberPhone: '',
    teamMembers: normalizeTeamMemberList(),
      assignedToName: '',
      assignedToId: '',
      assignedToIds: [],
      status: 'New',
      priority: 'Medium',
      interestedNeeds: '',
      notes: '',
      lastFollowUp: '',
      nextFollowUp: '',
      followUpType: 'Call',
      followUpNotes: '',
    });
    setAddLeadErrors({});
    setPendingAddLeadAgreementsFile(null);
    setPendingAddLeadKycFiles([]);
    setPendingAddLeadTeamMemberKycFiles([]);
    if (addLeadAgreementsInputRef.current) addLeadAgreementsInputRef.current.value = '';
    resetLeadAiAssistant();
  };

  const applyGeneratedLeadToForm = (
    form: AddLeadFormData,
    generated: Awaited<ReturnType<typeof apiGenerateLeadDetails>>['data'],
  ): AddLeadFormData => {
    const linkFields = mergeAiCompanyLinks(generated, form.website);
    const sourceFields = mergeAiSourceFields(generated, form, linkFields);
    const locationFields = resolveAiLocationFields(generated, form);
    const directorFields = resolveAiDirectorFields(generated, form);
    const teamMembers = mergeAiTeamMembers(form.teamMembers, generated);
    const syncedTeam = syncLeadTeamMembers(teamMembers);

    return {
    ...form,
    companyName: generated.companyName || form.companyName,
    directorSalutation: directorFields.directorSalutation || form.directorSalutation,
    contactPerson: directorFields.contactPerson || form.contactPerson,
    designation: generated.designation || form.designation,
    email: generated.email || form.email,
    phone: generated.phone || form.phone,
    emails: contactListForForm(
      (generated as { emails?: string[] }).emails,
      generated.email || form.email,
    ),
    phones: contactListForForm(
      (generated as { phones?: string[] }).phones,
      generated.phone || form.phone,
    ),
    type: generated.type || form.type,
    source: generated.source || form.source,
    status: generated.status || form.status,
    priority: generated.priority || form.priority,
    interestedNeeds: generated.interestedNeeds || form.interestedNeeds,
    notes: generated.expectedBusinessValue || generated.notes || form.notes,
    industry: generated.industry || form.industry,
    companySize: generated.companySize || form.companySize,
    website: linkFields.website,
    linkedIn: linkFields.linkedIn || form.linkedIn,
    location: locationFields.location,
    country: locationFields.country,
    city: locationFields.city,
    state: locationFields.state,
    countryCode: locationFields.countryCode,
    latitude: locationFields.latitude,
    longitude: locationFields.longitude,
    campaignName: sourceFields.campaignName || generated.campaignName || form.campaignName,
    campaignLink: sourceFields.campaignLink || generated.campaignLink || form.campaignLink,
    referralName: sourceFields.referralName || generated.referralName || form.referralName,
    sourceWebsiteUrl: sourceFields.sourceWebsiteUrl,
    sourceLinkedInUrl: sourceFields.sourceLinkedInUrl,
    sourceEmail: sourceFields.sourceEmail,
    otherDetails: Array.isArray(generated.otherDetails) ? generated.otherDetails : form.otherDetails,
    lastFollowUp: normalizeLeadDateTimeInput(generated.lastFollowUp || form.lastFollowUp),
    nextFollowUp: normalizeLeadDateTimeInput(generated.nextFollowUp || form.nextFollowUp),
    assignedToId: generated.assignedToId || form.assignedToId,
    assignedToName:
      (generated as { assignedToName?: string }).assignedToName?.trim() || form.assignedToName,
    ...syncedTeam,
  };
  };

  const normalizeLeadDateInput = (value: string) => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return '';

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
      const [, month, day, year] = slashMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    return trimmed;
  };


  const handleApplyLeadAiGenerated = useCallback(
    (generated: LeadAiGeneratedPayload) => {
      let nextFormState = applyGeneratedLeadToForm(
        addLeadForm,
        generated as Awaited<ReturnType<typeof apiGenerateLeadDetails>>['data'],
      );

      const assigneeName = String(generated.assignedToName || '').trim().toLowerCase();
      if (assigneeName && recruiters.length > 0) {
        const match = recruiters.find((member) => {
          const full = `${member.firstName || ''} ${member.lastName || ''}`.trim().toLowerCase();
          const email = String(member.email || '').trim().toLowerCase();
          return full === assigneeName || full.includes(assigneeName) || assigneeName.includes(full) || email === assigneeName;
        });
        if (match) {
          nextFormState = {
            ...nextFormState,
            assignedToId: match.id,
            assignedToIds: [match.id],
            assignedToName: `${match.firstName || ''} ${match.lastName || ''}`.trim(),
          };
        }
      }

      setAddLeadForm(nextFormState);
      setAddLeadErrors({});
    },
    [addLeadForm, recruiters],
  );

  const DEFAULT_ADD_LEAD_SECTIONS = {
    company: false,
    contact: false,
    leadDetails: false,
  };
  const [addLeadSectionsOpen, setAddLeadSectionsOpen] = useState(DEFAULT_ADD_LEAD_SECTIONS);
  const [leadAiChatOpen, setLeadAiChatOpen] = useState(false);
  const [leadAiChatHistory, setLeadAiChatHistory] = useState<LeadAiChatMessage[]>([]);
  const [allowDuplicateCreate, setAllowDuplicateCreate] = useState(false);
  const [pendingDuplicate, setPendingDuplicate] = useState<{
    leadId?: string;
    matchedBy?: string[];
    existing?: {
      id: string;
      companyName?: string | null;
      contactPerson?: string | null;
      email?: string | null;
      phone?: string | null;
      ownerName?: string | null;
      createdAt?: string;
    };
  } | null>(null);

  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const DEFAULT_LEAD_OVERVIEW_SECTIONS: Record<string, boolean> = {
    company: false,
    contact: false,
    leadDetails: false,
  };
  const [overviewOpen, setOverviewOpen] = useState<Record<string, boolean>>(
    DEFAULT_LEAD_OVERVIEW_SECTIONS,
  );

  useEffect(() => {
    if (!lead && !addLeadMode) return;
    setOverviewOpen(DEFAULT_LEAD_OVERVIEW_SECTIONS);
    setAddLeadSectionsOpen(DEFAULT_ADD_LEAD_SECTIONS);
  }, [lead?.id, addLeadMode]);
  const [overviewEditMode, setOverviewEditMode] = useState(false);
  const [overviewEditErrors, setOverviewEditErrors] = useState<LeadRequiredFieldErrors>({});
  const [savingOverviewEdit, setSavingOverviewEdit] = useState(false);
  const [overviewEditForm, setOverviewEditForm] = useState({
    companyName: '',
    industry: '',
    companySize: '',
    website: '',
    linkedIn: '',
    location: '',
    directorSalutation: '',
    contactPerson: '',
    designation: '',
    email: '',
    phone: '',
    emails: [''] as string[],
    phones: [''] as string[],
    country: '',
    countryCode: '',
    city: '',
    state: '',
    latitude: null as number | null,
    longitude: null as number | null,
    source: '' as LeadSource | '',
    campaignName: '',
    campaignLink: '',
    referralName: '',
    sourceWebsiteUrl: '',
    sourceLinkedInUrl: '',
    sourceEmail: '',
    dynamicOtherDetails: [] as Array<{ label: string; value: string }>,
    leadOwner: '',
    assignedToId: '',
    assignedToIds: [] as string[],
    status: 'New' as LeadStatus,
    priority: 'Medium' as 'High' | 'Medium' | 'Low',
    interestedNeeds: '',
    notes: '',
    createdDate: '',
    lastFollowUp: '',
    nextFollowUp: '',
    followUpType: 'Call',
    agreementsFileName: '' as string,
    agreementsFileUrl: '' as string,
    agreementsUploadedAt: '' as string,
    teamMemberDesignation: '',
    teamMemberEmail: '',
    teamMemberPhone: '',
    teamMembers: normalizeTeamMemberList(),
  });
  const [overviewStatusIsCustom, setOverviewStatusIsCustom] = useState(false);
  const [activityFilter, setActivityFilter] = useState<'all' | 'calls' | 'messages' | 'emails'>('all');
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [showLogCallForm, setShowLogCallForm] = useState(false);
  const [logCallForm, setLogCallForm] = useState({
    callType: 'Outgoing' as 'Outgoing' | 'Incoming',
    durationMinutes: 0,
    durationSeconds: 0,
    outcome: '',
    notes: '',
    nextFollowUp: '',
    followUpType: 'Call',
  });
  const [outcomeDropdownOpen, setOutcomeDropdownOpen] = useState(false);
  const [showSendWhatsAppForm, setShowSendWhatsAppForm] = useState(false);
  const [whatsAppForm, setWhatsAppForm] = useState({
    template: '',
    message: '',
  });
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);
  const [showScheduleFollowUpForm, setShowScheduleFollowUpForm] = useState(false);
  const [scheduleFollowUpForm, setScheduleFollowUpForm] = useState({
    followUpType: '',
    date: '',
    time: '',
    reminder: '',
    notes: '',
  });
  const [followUpTypeDropdownOpen, setFollowUpTypeDropdownOpen] = useState(false);
  const [reminderDropdownOpen, setReminderDropdownOpen] = useState(false);
  const [showConvertToClientForm, setShowConvertToClientForm] = useState(false);
  const companyLinks = (() => {
    const parsed = (addLeadForm.website ?? '').split('\n');
    return parsed.length > 0 ? parsed : [''];
  })();

  const updateCompanyLink = (index: number, value: string) => {
    setAddLeadForm((prev) => {
      const links = (prev.website ?? '').split('\n');
      while (links.length <= index) links.push('');
      links[index] = value;
      return { ...prev, website: links.join('\n') };
    });
  };

  const addCompanyLinkField = () => {
    setAddLeadForm((prev) => ({
      ...prev,
      website: prev.website ? `${prev.website}\n` : '\n',
    }));
  };

  const removeCompanyLinkField = (index: number) => {
    setAddLeadForm((prev) => {
      const links = (prev.website ?? '').split('\n');
      const nextLinks = links.filter((_, currentIndex) => currentIndex !== index);
      return {
        ...prev,
        website: nextLinks.length > 0 ? nextLinks.join('\n') : '',
      };
    });
  };

  const [convertToClientForm, setConvertToClientForm] = useState({
    companyName: '',
    primaryContact: '',
    email: '',
    phone: '',
    industry: '',
    companySize: '',
    accountManager: '',
    createJobRequirement: false,
  });
  const [industryDropdownOpen, setIndustryDropdownOpen] = useState(false);
  const [companySizeDropdownOpen, setCompanySizeDropdownOpen] = useState(false);
  const [accountManagerDropdownOpen, setAccountManagerDropdownOpen] = useState(false);

  const WHATSAPP_TEMPLATES = ['Introduction', 'Meeting Request', 'Follow-up Reminder', 'Proposal Shared'];
  const FOLLOW_UP_TYPES = ['Call', 'WhatsApp', 'Email', 'Meet', 'Video Call', 'Other'];
  const REMINDER_OPTIONS = ['10 minutes before', '30 minutes before', '1 hour before', '1 day before'];
  const INDUSTRIES = ['Technology', 'Healthcare', 'Finance', 'Manufacturing', 'Retail', 'Other'];
  const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '500+'];
  const ACCOUNT_MANAGERS = ['Alex Thompson', 'Sarah Chen', 'Michael Ross'];
  const LOST_REASONS = ['Not Interested', 'Budget Issue', 'Competitor Selected', 'Wrong Contact', 'No Response', 'Other'];
  
  // Color mapping for role colors
  const roleColorMap: Record<string, string> = {
    purple: 'bg-purple-100 text-purple-700',
    blue: 'bg-blue-100 text-blue-700',
    teal: 'bg-teal-100 text-teal-700',
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    orange: 'bg-orange-100 text-orange-700',
    gray: 'bg-gray-100 text-gray-600',
  };

  const [showAssignLeadForm, setShowAssignLeadForm] = useState(false);
  const [assignLeadForm, setAssignLeadForm] = useState<{
    assignTo: string;
    assignTos: string[];
    priority: 'High' | 'Medium' | 'Low';
    notifyUser: boolean;
  }>({
    assignTo: '',
    assignTos: [],
    priority: 'Medium',
    notifyUser: true,
  });
  const [showMarkLostForm, setShowMarkLostForm] = useState(false);
  const [markLostForm, setMarkLostForm] = useState<MarkLostFormData>({ lostReason: '', notes: '' });
  const [lostReasonDropdownOpen, setLostReasonDropdownOpen] = useState(false);
  const [showDuplicateNotification, setShowDuplicateNotification] = useState(false);
  const [showDeleteLeadForm, setShowDeleteLeadForm] = useState(false);
  const [showMergeLeadsForm, setShowMergeLeadsForm] = useState(false);
  const MERGE_FIELDS = ['company', 'phone', 'email', 'notes', 'leadOwner'] as const;
  const [mergeLeadsForm, setMergeLeadsForm] = useState<{
    existingLead: { company: string; phone: string; email: string; notes: string; leadOwner: string };
    newLead: { company: string; phone: string; email: string; notes: string; leadOwner: string };
    keep: Record<(typeof MERGE_FIELDS)[number], 'existing' | 'new'>;
  }>({
    existingLead: { company: '', phone: '', email: '', notes: '', leadOwner: '' },
    newLead: { company: '', phone: '', email: '', notes: '', leadOwner: '' },
    keep: { company: 'new', phone: 'new', email: 'new', notes: 'new', leadOwner: 'new' },
  });

  const [notesTagFilter, setNotesTagFilter] = useState<LeadNoteTag | 'All'>('All');
  const [pinnedNoteIds, setPinnedNoteIds] = useState<Set<string>>(new Set());

  // ── 3-dot menu actions ─────────────────────────────────────────────
  const handleExportLead = () => {
    if (!lead) {
      toast.error('No lead selected to export');
      return;
    }
    try {
      exportLeadAsPdf(lead);
      toast.success('Opening Print dialog – choose “Save as PDF” to export.');
    } catch (err: any) {
      console.error('Failed to export lead:', err);
      toast.error(err?.message || 'Failed to export lead');
    }
  };

  /**
   * Duplicate the current lead by re-posting its core fields as a new
   * record. Tagged in the company name so users can tell the copy apart.
   */
  const handleDuplicateLead = async () => {
    if (!lead) return;
    try {
      const payload: CreateLeadData = {
        companyName: `${lead.companyName || 'Lead'} (Copy)`,
        type: lead.type,
        source: lead.source,
        contactPerson: lead.contactPerson,
        directorName: lead.directorName,
        directorSalutation: lead.directorSalutation,
        email: lead.email,
        phone: lead.phone,
        status: 'New',
        priority: lead.priority,
        interestedNeeds: lead.interestedNeeds,
        servicesNeeded: lead.servicesNeeded,
        notes: lead.notes,
        expectedBusinessValue: lead.expectedBusinessValue,
        industry: lead.industry,
        sector: lead.sector,
        companySize: lead.companySize,
        teamName: lead.teamName,
        website: lead.website,
        linkedIn: lead.linkedIn,
        location: lead.location,
        designation: lead.designation,
        country: lead.country,
        city: lead.city,
        campaignName: lead.campaignName,
        campaignLink: lead.campaignLink,
        referralName: lead.referralName,
        sourceWebsiteUrl: lead.sourceWebsiteUrl,
        sourceLinkedInUrl: lead.sourceLinkedInUrl,
        sourceEmail: lead.sourceEmail,
        otherDetails: lead.otherDetails,
        assignedToId: lead.assignedToId,
        assignedToIds: Array.isArray(lead.assignedToIds) && lead.assignedToIds.length > 0
          ? lead.assignedToIds
          : undefined,
      } as CreateLeadData;

      const response = await apiCreateLead(payload);
      const newLead = response?.data;
      toast.success(`Duplicated as “${newLead?.companyName || payload.companyName}”`);
      if (newLead) {
        onDuplicateLead?.(newLead);
      }
      // Refresh the parent list so the copy shows up immediately.
      onUpdateLead?.();
      setMoreMenuOpen(false);
    } catch (err: any) {
      console.error('Failed to duplicate lead:', err);
      toast.error(err?.message || 'Failed to duplicate lead');
    }
  };

  // Fetch activities when lead changes or activities tab is opened
  useEffect(() => {
    const fetchActivities = async () => {
      // Early return if conditions not met
      if (!lead?.id || activeTab !== 'activities') {
        return;
      }

      // Check if user is authenticated before making API call
      if (typeof window === 'undefined') {
        return; // Server-side rendering, skip
      }

      const token = localStorage.getItem('accessToken');
      if (!token) {
        // No token, skip API call to prevent authentication errors
        console.warn('[LeadDetailsDrawer] No access token found. Skipping activities fetch.');
        setActivities([]);
        setLoadingActivities(false);
        return;
      }

      try {
        setLoadingActivities(true);
        const response = await apiGetLeadActivities(lead.id);
        const backendActivities = Array.isArray(response.data) ? response.data : [];
        
        // Map backend activities to frontend format
        const mappedActivities: LeadActivity[] = backendActivities.map((activity: BackendActivity) => {
          // Determine activity type based on action
          let type: 'Call' | 'Email' | 'Meeting' | 'Message' = 'Message';
          const actionLower = activity.action.toLowerCase();
          const descLower = (activity.description || '').toLowerCase();
          
          if (actionLower.includes('call') || descLower.includes('call')) {
            type = 'Call';
          } else if (actionLower.includes('email') || descLower.includes('email')) {
            type = 'Email';
          } else if (actionLower.includes('meeting') || descLower.includes('meeting')) {
            type = 'Meeting';
          } else if (actionLower.includes('follow-up') || descLower.includes('follow-up') || descLower.includes('follow up')) {
            // Follow-ups are displayed as Meeting type with calendar icon
            type = 'Meeting';
          }

          // Format date (DD/MM/YYYY + time for activity log)
          const formattedDate = formatDateTimeDMY(activity.createdAt);

          // Extract follow-up details from description if it's a follow-up activity
          let description = activity.description || activity.action;
          let title = activity.action;
          
          // If this is a follow-up activity, enhance the display
          if (description.toLowerCase().includes('follow-up') || description.toLowerCase().includes('follow up')) {
            title = 'Follow-up Scheduled';
            // Keep the full description which includes type, date, time, and notes
          }

          return {
            id: activity.id,
            type,
            date: formattedDate,
            description,
            title,
            user: {
              name: activity.performedBy.name,
              avatar: activity.performedBy.avatar || '',
            },
          };
        });

        setActivities(mappedActivities);
      } catch (err: any) {
        console.error('[LeadDetailsDrawer] Failed to fetch activities:', err);
        // If it's an auth error, the apiFetch will handle redirect
        // Just set empty activities to prevent UI errors
        setActivities([]);
      } finally {
        setLoadingActivities(false);
      }
    };

    fetchActivities();
  }, [lead?.id, activeTab]);

  const openMergeLeadsForm = () => {
    setShowDuplicateNotification(false);
    const existing = {
      company: 'TechNova Solutions',
      phone: '+1 (555) 123-4567',
      email: 'd.miller@technova.com',
      notes: 'Initial inquiry from LinkedIn.',
      leadOwner: 'Alex Thompson',
    };
    const newLead = {
      company: lead?.companyName ?? '',
      phone: lead?.phone ?? '',
      email: lead?.email ?? '',
      notes: lead?.notes ?? '',
      leadOwner: lead?.assignedTo?.name ?? '',
    };
    setMergeLeadsForm({
      existingLead: existing,
      newLead: newLead,
      keep: { company: 'new', phone: 'new', email: 'new', notes: 'new', leadOwner: 'new' },
    });
    setShowMergeLeadsForm(true);
  };

  const openMarkLostForm = () => {
    setMarkLostForm({ lostReason: '', notes: '' });
    setShowMarkLostForm(true);
  };

  const openAssignLeadForm = () => {
    const existingIds = Array.isArray(lead?.assignedToIds) && lead!.assignedToIds!.length > 0
      ? lead!.assignedToIds!
      : (lead?.assignedTo?.id ? [lead.assignedTo.id] : []);
    setAssignLeadForm({
      assignTo: existingIds[0] ?? '',
      assignTos: existingIds,
      priority: lead?.priority ?? 'Medium',
      notifyUser: true,
    });
    setShowAssignLeadForm(true);
  };

  const openConvertToClientForm = () => {
    if (isLeadAlreadyConverted(lead)) {
      void requestError(leadConvertedAlertMessage(lead));
      return;
    }
    setConvertToClientForm({
      companyName: lead?.companyName ?? '',
      primaryContact: lead?.directorName || lead?.contactPerson || '',
      email: lead?.email ?? '',
      phone: lead?.phone ?? '',
      industry: lead?.industry ?? '',
      companySize: lead?.companySize ?? '',
      accountManager: lead?.assignedTo?.name ?? '',
      createJobRequirement: false,
    });
    setShowConvertToClientForm(true);
  };

  const toggleOverviewSection = (key: string) => {
    setOverviewOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAddLeadSection = (key: 'company' | 'contact' | 'leadDetails') => {
    setAddLeadSectionsOpen((prev) => {
      const newState = { ...prev };
      newState[key] = !prev[key];
      return newState;
    });
  };

  const startOverviewEdit = () => {
    if (!lead) return;
    if (isLeadAlreadyConverted(lead)) {
      void requestError(
        `This lead has already been converted to a client${
          lead.convertedClientName ? ` (${lead.convertedClientName})` : ''
        }. Converted leads are view-only and cannot be edited.`,
      );
      setOverviewEditMode(false);
      return;
    }
    setOverviewEditErrors({});
    setOverviewStatusIsCustom(!isDefaultLeadStatus(lead.status));
    setOverviewEditForm({
      companyName: lead.companyName,
      industry: lead.industry ?? '',
      companySize: lead.companySize ?? '',
      website: lead.website ?? '',
      linkedIn: lead.linkedIn ?? '',
      location: lead.location ?? '',
      directorSalutation: lead.directorSalutation ?? '',
      contactPerson: lead.contactPerson,
      designation: lead.designation ?? '',
      email: lead.email,
      phone: lead.phone,
      emails: contactListForForm(lead.emails, lead.email),
      phones: contactListForForm(lead.phones, lead.phone),
      country: lead.country ?? '',
      countryCode: getCountryByCodeOrName(undefined, lead.country ?? '')?.isoCode ?? '',
      city: lead.city ?? '',
      state:
        lead.state?.trim() ||
        inferLocationFromCityName(lead.city ?? '', { country: lead.country ?? '' })?.state ||
        '',
      latitude: typeof lead.latitude === 'number' ? lead.latitude : null,
      longitude: typeof lead.longitude === 'number' ? lead.longitude : null,
      source: lead.source,
      campaignName: lead.campaignName ?? '',
      campaignLink: lead.campaignLink ?? '',
      referralName: lead.referralName ?? '',
      sourceWebsiteUrl: lead.sourceWebsiteUrl ?? '',
      sourceLinkedInUrl: lead.sourceLinkedInUrl ?? '',
      sourceEmail: lead.sourceEmail ?? '',
      ...(() => {
        const teamMembers = resolveTeamMemberList(lead);
        const dynamicOtherDetails = Array.isArray(lead.otherDetails)
          ? lead.otherDetails
              .filter((item) => !isTeamMemberDetailLabel(item.label))
              .map((item) => ({
                label: String(item.label || '').trim(),
                value: String(item.value || ''),
              }))
          : [];
        return {
          dynamicOtherDetails,
          ...syncLeadTeamMembers(teamMembers),
        };
      })(),
      leadOwner: lead.assignedTo?.name ?? '',
      assignedToId: lead.assignedTo?.id ?? '',
      assignedToIds: Array.isArray(lead.assignedToIds) && lead.assignedToIds.length > 0
        ? lead.assignedToIds
        : (lead.assignedTo?.id ? [lead.assignedTo.id] : []),
      status: lead.status,
      priority: lead.priority ?? 'Medium',
      interestedNeeds: lead.interestedNeeds ?? '',
      notes: lead.notes ?? '',
      createdDate: lead.createdDate ?? '',
      lastFollowUp: lead.lastFollowUp,
      nextFollowUp: lead.nextFollowUp ?? '',
      followUpType: 'Call',
      agreementsFileName: lead.agreementsFileName ?? '',
      agreementsFileUrl: lead.agreementsFileUrl ?? '',
      agreementsUploadedAt: lead.agreementsUploadedAt ?? '',
      ...agreementTermsFromRecord(lead),
    });
    setPendingOverviewAgreementsFile(null);
    setPendingOverviewKycFiles([]);
    setPendingOverviewTeamMemberKycFiles([]);
    if (overviewAgreementsInputRef.current) overviewAgreementsInputRef.current.value = '';
    setLeadStatusCatalog((current) => mergeLeadStatusOptions(current, lead.status));
    setOverviewEditMode(true);
  };

  const cancelOverviewEdit = () => {
    setOverviewEditMode(false);
    setOverviewEditErrors({});
    setPendingOverviewAgreementsFile(null);
    setPendingOverviewKycFiles([]);
    setPendingOverviewTeamMemberKycFiles([]);
    if (overviewAgreementsInputRef.current) overviewAgreementsInputRef.current.value = '';
  };

  const addLeadStatusOptions = React.useMemo(
    () => mergeLeadStatusOptions(leadStatusCatalog, addLeadForm.status),
    [leadStatusCatalog, addLeadForm.status],
  );
  const overviewLeadStatusOptions = React.useMemo(
    () => mergeLeadStatusOptions(leadStatusCatalog, overviewEditForm.status),
    [leadStatusCatalog, overviewEditForm.status],
  );

  const addLeadStatusOption = async (onSelect: (status: string) => void) => {
    const status = String(newLeadStatusValue || '').trim();
    if (!status) {
      toast.error('Enter a status name first.');
      return;
    }

    setSavingLeadStatus(true);
    try {
      const response = await apiAppendLeadStatus(status);
      const nextOptions = mergeLeadStatusOptions(response?.data?.statuses, status);
      setLeadStatusCatalog(nextOptions);
      onSelect(status);
      setNewLeadStatusValue('');
      setShowAddLeadStatusInput(false);
      setAddLeadStatusIsCustom(false);
      setOverviewStatusIsCustom(false);
      toast.success(`Status "${status}" added.`);
    } catch (error) {
      requestError(error, 'Failed to add status');
    } finally {
      setSavingLeadStatus(false);
    }
  };

  const deleteLeadStatusOption = async (status: string, onSelect: (status: string) => void) => {
    const normalized = String(status || '').trim();
    if (!normalized) return;
    if (DEFAULT_LEAD_STATUS_SET.has(normalized.toLowerCase())) {
      toast.error('Default statuses cannot be deleted.');
      return;
    }
    const confirmed = await requestConfirm(`Delete status "${normalized}"?`, {
      title: 'Delete status',
      tone: 'warning',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });
    if (!confirmed) return;

    setDeletingLeadStatus(true);
    try {
      const response = await apiRemoveLeadStatus(normalized);
      const nextOptions = mergeLeadStatusOptions(response?.data?.statuses, 'New');
      setLeadStatusCatalog(nextOptions);
      onSelect('New');
      toast.success(`Status "${normalized}" deleted.`);
    } catch (error) {
      requestError(error, 'Failed to delete status');
    } finally {
      setDeletingLeadStatus(false);
    }
  };

  const saveOverviewEdit = async () => {
    if (!lead) return;
    if (isLeadAlreadyConverted(lead)) {
      void requestError(
        `This lead has already been converted to a client${
          lead.convertedClientName ? ` (${lead.convertedClientName})` : ''
        }. Converted leads are view-only and cannot be edited.`,
      );
      setOverviewEditMode(false);
      return;
    }
    if (overviewStatusIsCustom && !String(overviewEditForm.status || '').trim()) {
      toast.error('Enter a custom status before saving.');
      return;
    }

    const nextErrors = validateLeadRequiredFields(overviewEditForm, {
      // Existing lead phones may predate stricter country rules — don't block save.
      skipPhoneValidation: true,
    });
    setOverviewEditErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      const firstError = Object.values(nextErrors)[0];
      toast.error(firstError || 'Please fix the highlighted fields before saving.');
      return;
    }

    const previousNextFollowUp = lead.nextFollowUp || '';
    const nextFollowUpValue = String(overviewEditForm.nextFollowUp || '').trim();
    const followUpChanged =
      Boolean(nextFollowUpValue) && nextFollowUpValue !== String(previousNextFollowUp || '').trim();
    
    try {
      setSavingOverviewEdit(true);
      const updateData: Partial<CreateLeadData> = {
        companyName: overviewEditForm.companyName,
        contactPerson: overviewEditForm.contactPerson.trim() || undefined,
        directorName: overviewEditForm.contactPerson.trim() || undefined,
        directorSalutation: overviewEditForm.directorSalutation?.trim() || null,
        ...buildContactChannelsFromForm(
          overviewEditForm.emails,
          overviewEditForm.phones,
          overviewEditForm.email,
          overviewEditForm.phone,
        ),
        industry: overviewEditForm.industry || undefined,
        website: overviewEditForm.website || undefined,
        linkedIn: overviewEditForm.linkedIn || undefined,
        location: overviewEditForm.location || undefined,
        state: overviewEditForm.state || undefined,
        latitude: typeof overviewEditForm.latitude === 'number' ? overviewEditForm.latitude : undefined,
        longitude: typeof overviewEditForm.longitude === 'number' ? overviewEditForm.longitude : undefined,
        designation: overviewEditForm.designation || undefined,
        country: overviewEditForm.country || undefined,
        city: overviewEditForm.city || undefined,
        source: overviewEditForm.source || undefined,
        campaignName: overviewEditForm.campaignName || undefined,
        campaignLink: overviewEditForm.campaignLink || undefined,
        referralName: overviewEditForm.referralName || undefined,
        sourceWebsiteUrl: overviewEditForm.sourceWebsiteUrl || undefined,
        sourceLinkedInUrl: overviewEditForm.sourceLinkedInUrl || undefined,
        sourceEmail: overviewEditForm.sourceEmail || undefined,
        ...teamMemberPayloadFromForm(
          primaryTeamMemberFromList(overviewEditForm.teamMembers),
        ),
        otherDetails: mergeTeamMemberIntoOtherDetails(
          overviewEditForm.dynamicOtherDetails
            .map((item) => ({
              label: String(item.label || '').trim(),
              value: String(item.value || '').trim(),
            }))
            .filter((item) => item.label && item.value),
          overviewEditForm.teamMembers,
        ),
        status: String(overviewEditForm.status || 'New').trim() || 'New',
        priority: overviewEditForm.priority,
        assignedToId: overviewEditForm.assignedToIds?.[0] || overviewEditForm.assignedToId || undefined,
        assignedToIds: overviewEditForm.assignedToIds && overviewEditForm.assignedToIds.length > 0
          ? overviewEditForm.assignedToIds
          : undefined,
        interestedNeeds: overviewEditForm.interestedNeeds || undefined,
        notes: overviewEditForm.notes || undefined,
        lastFollowUp: overviewEditForm.lastFollowUp || undefined,
        nextFollowUp: nextFollowUpValue || '',
        ...(followUpChanged
          ? {
              statusRemark: `Follow-up scheduled: ${overviewEditForm.followUpType || 'General'}`,
            }
          : {}),
        ...agreementTermsApiPayload(overviewEditForm),
        agreementsFileName: overviewEditForm.agreementsFileName || undefined,
        agreementsFileUrl: overviewEditForm.agreementsFileUrl || undefined,
        agreementsUploadedAt: overviewEditForm.agreementsUploadedAt || undefined,
      };

      const pendingOverviewLeadKyc = [...pendingOverviewKycFiles];
      if (pendingOverviewLeadKyc.length > 0) {
        try {
          setUploadingKyc(true);
          await uploadKycDocuments('lead', lead.id, pendingOverviewLeadKyc);
          await refetchLeadFiles();
          kycUploadFeedback.markSuccess(
            pendingOverviewLeadKyc.length === 1
              ? pendingOverviewLeadKyc[0].name
              : `${pendingOverviewLeadKyc.length} documents`
          );
        } catch (uploadError: any) {
          console.error('Failed to upload lead KYC documents:', uploadError);
          kycUploadFeedback.markError(uploadError.message || 'Failed to upload KYC documents');
          void requestError(uploadError.message || 'Failed to upload KYC documents');
        } finally {
          setUploadingKyc(false);
        }
      }

      if (pendingOverviewAgreementsFile) {
        try {
          setUploadingAgreements(true);
          const uploadResponse = await filesApiUpload(
            'lead',
            lead.id,
            pendingOverviewAgreementsFile,
            'AGREEMENT',
          );
          const agreementUrl = uploadResponse.data?.fileUrl;
          const agreementName =
            uploadResponse.data?.fileName || pendingOverviewAgreementsFile.name;
          if (agreementUrl) {
            updateData.agreementsFileName = agreementName;
            updateData.agreementsFileUrl = agreementUrl;
            updateData.agreementsUploadedAt = new Date().toISOString();
          }
        } catch (uploadError: any) {
          console.error('Failed to upload lead agreement:', uploadError);
          void requestError(uploadError.message || 'Failed to upload agreements file');
        } finally {
          setUploadingAgreements(false);
        }
      }

      const updatedLeadResponse = await apiUpdateLead(lead.id, updateData);
      const savedLead =
        (updatedLeadResponse as { data?: BackendLead })?.data ||
        (updatedLeadResponse as unknown as BackendLead);
      setPendingOverviewAgreementsFile(null);
      setPendingOverviewKycFiles([]);
      setPendingOverviewTeamMemberKycFiles([]);
      setOverviewEditMode(false);
      setOverviewEditErrors({});
      toast.success('Lead saved successfully');
      onUpdateLead?.(savedLead);
    } catch (error: any) {
      console.error('Failed to update lead:', error);
      void requestError(error.message || 'Failed to update lead');
    } finally {
      setSavingOverviewEdit(false);
    }
  };

  const isCreateLeadDisabled = useMemo(() => {
    const primaryEmail = primaryContactValue(
      normalizeContactList(addLeadForm.emails, addLeadForm.email),
    );
    return (
      !addLeadForm.companyName.trim() ||
      !addLeadForm.contactPerson.trim() ||
      !primaryEmail ||
      !validateEmail(primaryEmail).valid
    );
  }, [addLeadForm]);

  const handleSubmitAddLead = useCallback(async (options?: { skipDuplicateCheck?: boolean }) => {
    const nextErrors = validateLeadRequiredFields(addLeadForm);
    setAddLeadErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    if (addLeadStatusIsCustom && !String(addLeadForm.status || '').trim()) {
      toast.error('Enter a custom status before creating the lead.');
      return;
    }

    try {
      if (!createLeadOverride && !options?.skipDuplicateCheck && !allowDuplicateCreate) {
        const primaryEmail = primaryContactValue(
          normalizeContactList(addLeadForm.emails, addLeadForm.email),
        );
        const duplicateResponse = await apiCheckLeadDuplicate({
          email: primaryEmail || undefined,
          phone: addLeadForm.phone?.trim() || undefined,
          companyName: addLeadForm.companyName.trim(),
          contactPerson: addLeadForm.contactPerson.trim() || undefined,
        });
        if (duplicateResponse.data?.duplicate) {
          setPendingDuplicate(duplicateResponse.data);
          setShowDuplicateNotification(true);
          return;
        }
      }

      const companyLinks = (addLeadForm.website ?? '')
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean);

      const createData: CreateLeadData = {
        companyName: addLeadForm.companyName.trim(),
        sector: addLeadForm.industry?.trim() || undefined,
        industry: addLeadForm.industry?.trim() || undefined,
        website: addLeadForm.website?.trim() || undefined,
        companyLinks: companyLinks.length ? companyLinks : undefined,
        linkedIn: addLeadForm.linkedIn?.trim() || undefined,
        location: addLeadForm.location?.trim() || undefined,
        directorName: addLeadForm.contactPerson.trim(),
        contactPerson: addLeadForm.contactPerson.trim(),
        directorSalutation: addLeadForm.directorSalutation?.trim() || undefined,
        designation: addLeadForm.designation?.trim() || undefined,
        ...buildContactChannelsFromForm(
          addLeadForm.emails,
          addLeadForm.phones,
          addLeadForm.email,
          addLeadForm.phone,
        ),
        country: addLeadForm.country?.trim() || undefined,
        city: addLeadForm.city?.trim() || undefined,
        state: addLeadForm.state?.trim() || undefined,
        latitude: typeof addLeadForm.latitude === 'number' ? addLeadForm.latitude : undefined,
        longitude: typeof addLeadForm.longitude === 'number' ? addLeadForm.longitude : undefined,
        type: addLeadForm.type || 'Company',
        source: addLeadForm.source || 'Website',
        campaignName: addLeadForm.campaignName?.trim() || undefined,
        campaignLink: addLeadForm.campaignLink?.trim() || undefined,
        referralName: addLeadForm.referralName?.trim() || undefined,
        sourceWebsiteUrl: addLeadForm.sourceWebsiteUrl?.trim() || undefined,
        sourceLinkedInUrl: addLeadForm.sourceLinkedInUrl?.trim() || undefined,
        sourceEmail: addLeadForm.sourceEmail?.trim() || undefined,
        ...teamMemberPayloadFromForm(
          primaryTeamMemberFromList(addLeadForm.teamMembers),
        ),
        otherDetails: mergeTeamMemberIntoOtherDetails(
          addLeadForm.otherDetails,
          addLeadForm.teamMembers,
        ),
        status: addLeadForm.status || 'New',
        priority: addLeadForm.priority || 'Medium',
        servicesNeeded: addLeadForm.interestedNeeds?.trim() || undefined,
        interestedNeeds: addLeadForm.interestedNeeds?.trim() || undefined,
        expectedBusinessValue: addLeadForm.notes?.trim() || undefined,
        notes: addLeadForm.notes?.trim() || undefined,
        lastFollowUp: addLeadForm.lastFollowUp || undefined,
        nextFollowUp: addLeadForm.nextFollowUp || undefined,
        statusRemark: addLeadForm.nextFollowUp
          ? [
              `Follow-up scheduled: ${addLeadForm.followUpType || 'General'}`,
              addLeadForm.followUpNotes?.trim()
                ? `Notes: ${addLeadForm.followUpNotes.trim()}`
                : null,
            ]
              .filter(Boolean)
              .join('. ')
          : undefined,
        assignedToId: addLeadForm.assignedToId || undefined,
        ...agreementTermsApiPayload(addLeadForm),
      };

      let createdLead: BackendLead | undefined | null = null;
      if (createLeadOverride) {
        createdLead = (await createLeadOverride(createData)) || null;
      } else {
        const createdLeadResponse = await apiCreateLead(createData);
        createdLead = createdLeadResponse?.data;
      }

      if (!createLeadOverride && createdLead?.id && pendingAddLeadAgreementsFile) {
        try {
          setUploadingAgreements(true);
          const uploadResponse = await filesApiUpload(
            'lead',
            createdLead.id,
            pendingAddLeadAgreementsFile,
            'AGREEMENT',
          );
          const agreementUrl = uploadResponse.data?.fileUrl;
          const agreementName = uploadResponse.data?.fileName || pendingAddLeadAgreementsFile.name;
          if (agreementUrl) {
            const patched = await apiUpdateLead(createdLead.id, {
              agreementsFileName: agreementName,
              agreementsFileUrl: agreementUrl,
              agreementsUploadedAt: new Date().toISOString(),
            });
            createdLead = patched?.data || {
              ...createdLead,
              agreementsFileName: agreementName,
              agreementsFileUrl: agreementUrl,
              agreementsUploadedAt: new Date().toISOString(),
            };
          }
        } catch (uploadError: any) {
          console.error('Failed to upload lead agreement:', uploadError);
          void requestError(uploadError.message || 'Failed to upload agreements file');
        } finally {
          setUploadingAgreements(false);
        }
      }

      const pendingLeadKyc = [...pendingAddLeadKycFiles];
      if (!createLeadOverride && createdLead?.id && pendingLeadKyc.length > 0) {
        try {
          setUploadingKyc(true);
          await uploadKycDocuments('lead', createdLead.id, pendingLeadKyc);
        } catch (uploadError: any) {
          console.error('Failed to upload lead KYC documents:', uploadError);
          void requestError(uploadError.message || 'Failed to upload KYC documents');
        } finally {
          setUploadingKyc(false);
        }
      }

      setPendingAddLeadAgreementsFile(null);
      setPendingAddLeadKycFiles([]);
      setPendingAddLeadTeamMemberKycFiles([]);
      if (addLeadAgreementsInputRef.current) addLeadAgreementsInputRef.current.value = '';

      onAddLead?.(addLeadForm, createdLead || undefined);
      resetAddLeadForm();
    } catch (error: any) {
      console.error('Failed to create lead:', error);
      void requestError(error.message || 'Failed to create lead');
    }
  }, [
    addLeadForm,
    addLeadStatusIsCustom,
    allowDuplicateCreate,
    createLeadOverride,
    onAddLead,
    pendingAddLeadAgreementsFile,
    pendingAddLeadKycFiles,
  ]);

  const tabs = addLeadMode
    ? [{ id: 'add' as const, label: 'Add Lead', icon: UserPlus }]
    : [
        { id: 'overview' as const, label: 'Overview', icon: LayoutGrid },
        { id: 'followup' as const, label: 'Follow-up', icon: CalendarClock },
        { id: 'activities' as const, label: 'Activities', icon: Activity },
        { id: 'notes' as const, label: 'Remarks', icon: StickyNote },
        { id: 'chat' as const, label: 'Chat', icon: MessageSquare },
        { id: 'files' as const, label: 'Files', icon: Paperclip },
      ];

  const drawerPanelClass =
    'fixed right-0 top-0 z-[56] flex h-full flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl pointer-events-auto';

  return (
    <AnimatePresence>
      {(lead || addLeadMode) && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={leadAiChatOpen ? undefined : onClose}
            className={`fixed inset-0 z-50 ${
              addLeadMode && leadAiChatOpen
                ? 'pointer-events-none bg-slate-900/10'
                : addLeadMode
                  ? 'pointer-events-auto bg-slate-900/40 backdrop-blur-[2px]'
                  : 'pointer-events-auto bg-slate-900/40 backdrop-blur-[2px]'
            }`}
          />
          <motion.div
            key="panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={drawerPanelClass}
            style={{ width: addLeadDrawerWidth }}
          >
          <div className="relative flex h-full min-h-0 flex-col">
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize lead drawer"
              title="Drag to resize drawer"
              onMouseDown={beginAddLeadDrawerResize}
              className="group absolute left-0 top-0 z-20 flex h-full w-3 -translate-x-1/2 cursor-col-resize items-center justify-center hover:bg-blue-500/5 active:bg-blue-500/10"
            >
              <div className="flex h-14 w-4 items-center justify-center rounded-full border border-slate-200/80 bg-white shadow-sm transition-colors group-hover:border-blue-200 group-hover:bg-blue-50 group-active:border-blue-300">
                <GripVertical
                  size={12}
                  className="text-slate-400 transition-colors group-hover:text-blue-500 group-active:text-blue-600"
                  aria-hidden
                />
              </div>
            </div>
          {/* Header */}
          <div
            className={`flex shrink-0 items-start justify-between gap-3 border-b border-blue-100/70 bg-gradient-to-r from-blue-50/95 via-indigo-50/50 to-white px-6 py-5`}
          >
            <div className="flex-1 min-w-0 flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25">
                <Building2 size={20} />
              </div>
              <div className="min-w-0">
                {addLeadMode ? (
                  <>
                    <h2 className="text-lg font-bold tracking-tight text-slate-900">Add Lead</h2>
                    <p className="mt-0.5 text-xs text-slate-500">Create a new lead and capture company details</p>
                  </>
                ) : (
                  <>
                    <h2 className="text-lg font-bold text-slate-900 truncate">{lead!.companyName}</h2>
                    <span
                      className={`inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        STATUS_STYLES[lead!.status as DefaultLeadStatus] || 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {lead!.status}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {!addLeadMode &&
              activeTab === 'overview' &&
              !overviewEditMode &&
              !isLeadAlreadyConverted(lead) ? (
                <button
                  type="button"
                  onClick={startOverviewEdit}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Edit Lead"
                >
                  <Edit2 size={18} />
                </button>
              ) : null}
              {!addLeadMode &&
              activeTab === 'overview' &&
              overviewEditMode &&
              !isLeadAlreadyConverted(lead) ? (
                <>
                  <button
                    type="button"
                    onClick={cancelOverviewEdit}
                    className="px-3 py-1.5 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveOverviewEdit()}
                    disabled={savingOverviewEdit || uploadingAgreements || uploadingKyc}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingOverviewEdit ? 'Saving…' : 'Save'}
                  </button>
                </>
              ) : null}
              {addLeadMode ? (
                <>
                  {!isPublicIntakeMode ? (
                    <button
                      type="button"
                      onClick={() => setLeadAiChatOpen(true)}
                      className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100"
                    >
                      <Sparkles size={14} />
                      Create with AI
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void handleSubmitAddLead()}
                    disabled={isCreateLeadDisabled || uploadingAgreements || uploadingKyc}
                    className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus size={14} />
                    Create Lead
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <DrawerCloseButton onClick={onClose} />
              )}
              {!addLeadMode ? (
              <div className="relative">
                <button
                  onClick={() => setMoreMenuOpen((v) => !v)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  title="More actions"
                >
                  <MoreVertical size={18} />
                </button>
                {moreMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setMoreMenuOpen(false)}
                      aria-hidden
                    />
                    <div className="absolute right-0 top-full mt-1 w-48 py-2 bg-white rounded-xl border border-slate-200 shadow-lg z-20">
                      <button
                        type="button"
                        onClick={() => { setMoreMenuOpen(false); handleExportLead(); }}
                        className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      >
                        Export PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => { setMoreMenuOpen(false); void handleDuplicateLead(); }}
                        className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      >
                        Duplicate
                      </button>
                      <button
                        type="button"
                        onClick={() => { setMoreMenuOpen(false); setShowDeleteLeadForm(true); }}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
              ) : null}
            </div>
          </div>

          {addLeadMode && !isPublicIntakeMode && (
            <div className="shrink-0 border-b border-blue-100 bg-blue-50/70 px-6 py-3">
              <div className="flex items-start gap-2">
                <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-blue-900">Shareable lead form link</p>
                  <p className="mt-0.5 text-[11px] text-blue-800/80">
                    Anyone with this link can fill the same lead details. Submissions appear on Leads
                    for this tenant only
                    {publicLeadFormTenant ? (
                      <>
                        {' '}
                        (<span className="font-mono">{publicLeadFormTenant}</span>)
                      </>
                    ) : null}
                    .
                  </p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      readOnly
                      value={
                        publicLeadFormLinkLoading
                          ? 'Loading link…'
                          : publicLeadFormLink || 'Link unavailable'
                      }
                      className="h-8 min-w-0 flex-1 truncate rounded-md border border-blue-200 bg-white px-2 font-mono text-[11px] text-slate-700"
                      aria-label="Public lead form URL"
                    />
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        disabled={!publicLeadFormLink || publicLeadFormLinkLoading}
                        onClick={async () => {
                          if (!publicLeadFormLink) return;
                          try {
                            await navigator.clipboard.writeText(publicLeadFormLink);
                            setPublicLeadFormLinkCopied(true);
                            window.setTimeout(() => setPublicLeadFormLinkCopied(false), 2000);
                          } catch {
                            /* ignore */
                          }
                        }}
                        className="inline-flex h-8 items-center gap-1 rounded-md border border-blue-300 bg-white px-2.5 text-[11px] font-medium text-blue-800 hover:bg-blue-50 disabled:opacity-50"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        {publicLeadFormLinkCopied ? 'Copied' : 'Copy'}
                      </button>
                      <a
                        href={publicLeadFormLink || undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex h-8 items-center gap-1 rounded-md border border-blue-300 bg-white px-2.5 text-[11px] font-medium text-blue-800 hover:bg-blue-50 ${
                          !publicLeadFormLink ? 'pointer-events-none opacity-50' : ''
                        }`}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tabs — hidden in add mode (header already shows Add Lead) */}
          {!addLeadMode ? (
          <div className="shrink-0 border-b border-slate-200 bg-slate-50/80 px-5 pt-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-1">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium rounded-t-lg transition-all duration-200 ${
                        isActive
                          ? 'bg-white text-blue-600 border-b-2 border-blue-600 -mb-px shadow-sm'
                          : 'border-b-2 border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/60 active:bg-white/80'
                      }`}
                    >
                      <Icon size={16} className={isActive ? 'text-blue-600' : 'text-slate-400'} strokeWidth={isActive ? 2.25 : 1.5} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          ) : null}

          {/* Tab content */}
          <div className="relative flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 via-[#f8fafc] to-blue-50/30">
            <div className="px-6 py-5">
              {showDeleteLeadForm ? (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 mb-4">
                    <button
                      type="button"
                      onClick={() => setShowDeleteLeadForm(false)}
                      className="p-2 -ml-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Back"
                    >
                      <ChevronRight size={20} className="rotate-180" />
                    </button>
                    <h2 className="text-lg font-bold text-slate-900">Delete Lead</h2>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                    <p className="text-sm font-medium text-slate-800 mb-1">Are you sure you want to delete this lead?</p>
                    <p className="text-sm text-slate-500">This action cannot be undone.</p>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowDeleteLeadForm(false)}
                      className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (lead) onDeleteLead?.(lead.id);
                        setShowDeleteLeadForm(false);
                        onClose();
                      }}
                      className="px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 shadow-sm transition-colors flex items-center gap-2"
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </div>
                </div>
              ) : showMergeLeadsForm ? (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 mb-4">
                    <button
                      type="button"
                      onClick={() => { setShowMergeLeadsForm(false); setActiveTab('overview'); }}
                      className="p-2 -ml-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Back to Overview"
                    >
                      <ChevronRight size={20} className="rotate-180" />
                    </button>
                    <h2 className="text-lg font-bold text-slate-900">Merge Leads</h2>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    {/* Two-column comparison */}
                    <div className="grid grid-cols-2 divide-x divide-slate-200">
                      <div className="p-5">
                        <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Existing Lead</h4>
                        <div className="space-y-0">
                          <div className="flex flex-col gap-0.5 py-2 border-b border-slate-100">
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Company</p>
                            <p className="text-sm font-medium text-slate-900 truncate">{mergeLeadsForm.existingLead.company || '—'}</p>
                          </div>
                          <div className="flex flex-col gap-0.5 py-2 border-b border-slate-100">
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Phone</p>
                            <p className="text-sm font-medium text-slate-900 truncate">{mergeLeadsForm.existingLead.phone || '—'}</p>
                          </div>
                          <div className="flex flex-col gap-0.5 py-2 border-b border-slate-100">
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Email</p>
                            <p className="text-sm font-medium text-slate-900 truncate">{mergeLeadsForm.existingLead.email || '—'}</p>
                          </div>
                          <div className="flex flex-col gap-0.5 py-2 border-b border-slate-100">
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Notes</p>
                            <p className="text-sm font-medium text-slate-900 line-clamp-2">{mergeLeadsForm.existingLead.notes || '—'}</p>
                          </div>
                          <div className="flex flex-col gap-0.5 py-2">
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Lead Owner</p>
                            <p className="text-sm font-medium text-slate-900 truncate">{mergeLeadsForm.existingLead.leadOwner || '—'}</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-5">
                        <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">New Lead</h4>
                        <div className="space-y-0">
                          <div className="flex flex-col gap-0.5 py-2 border-b border-slate-100">
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Company</p>
                            <p className="text-sm font-medium text-slate-900 truncate">{mergeLeadsForm.newLead.company || '—'}</p>
                          </div>
                          <div className="flex flex-col gap-0.5 py-2 border-b border-slate-100">
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Phone</p>
                            <p className="text-sm font-medium text-slate-900 truncate">{mergeLeadsForm.newLead.phone || '—'}</p>
                          </div>
                          <div className="flex flex-col gap-0.5 py-2 border-b border-slate-100">
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Email</p>
                            <p className="text-sm font-medium text-slate-900 truncate">{mergeLeadsForm.newLead.email || '—'}</p>
                          </div>
                          <div className="flex flex-col gap-0.5 py-2 border-b border-slate-100">
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Notes</p>
                            <p className="text-sm font-medium text-slate-900 line-clamp-2">{mergeLeadsForm.newLead.notes || '—'}</p>
                          </div>
                          <div className="flex flex-col gap-0.5 py-2">
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Lead Owner</p>
                            <p className="text-sm font-medium text-slate-900 truncate">{mergeLeadsForm.newLead.leadOwner || '—'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Choose fields to keep */}
                    <div className="border-t border-slate-200 bg-slate-50/50 px-5 py-4">
                      <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Choose fields to keep</h4>
                      <div className="space-y-3">
                        {MERGE_FIELDS.map((field) => (
                          <div key={field} className="flex items-center justify-between gap-4">
                            <span className="text-sm font-medium text-slate-700 capitalize">{field === 'leadOwner' ? 'Lead Owner' : field}</span>
                            <div className="flex gap-4">
                              <button
                                type="button"
                                onClick={() => setMergeLeadsForm((p) => ({ ...p, keep: { ...p.keep, [field]: 'existing' } }))}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 text-sm transition-colors"
                              >
                                <span
                                  className={`w-4 h-4 flex items-center justify-center rounded border shrink-0 transition-colors ${
                                    mergeLeadsForm.keep[field] === 'existing'
                                      ? 'border-blue-500 bg-blue-50 text-blue-600'
                                      : 'border-slate-200 bg-white'
                                  }`}
                                >
                                  {mergeLeadsForm.keep[field] === 'existing' && <Check size={12} strokeWidth={2.5} />}
                                </span>
                                Existing
                              </button>
                              <button
                                type="button"
                                onClick={() => setMergeLeadsForm((p) => ({ ...p, keep: { ...p.keep, [field]: 'new' } }))}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 text-sm transition-colors"
                              >
                                <span
                                  className={`w-4 h-4 flex items-center justify-center rounded border shrink-0 transition-colors ${
                                    mergeLeadsForm.keep[field] === 'new'
                                      ? 'border-blue-500 bg-blue-50 text-blue-600'
                                      : 'border-slate-200 bg-white'
                                  }`}
                                >
                                  {mergeLeadsForm.keep[field] === 'new' && <Check size={12} strokeWidth={2.5} />}
                                </span>
                                New
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowMergeLeadsForm(false)}
                      className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowMergeLeadsForm(false); setActiveTab('overview'); }}
                      className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-sm transition-colors flex items-center gap-2"
                    >
                      Merge Leads
                    </button>
                  </div>
                </div>
              ) : showLogCallForm ? (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 mb-4">
                    <button
                      type="button"
                      onClick={() => { setShowLogCallForm(false); setActiveTab('overview'); }}
                      className="p-2 -ml-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Back to Overview"
                    >
                      <ChevronRight size={20} className="rotate-180" />
                    </button>
                    <h2 className="text-lg font-bold text-slate-900">Log Call</h2>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Call Type</label>
                      <div className="flex gap-6">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="callType"
                            checked={logCallForm.callType === 'Outgoing'}
                            onChange={() => setLogCallForm((p) => ({ ...p, callType: 'Outgoing' }))}
                            className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                          />
                          <span className="text-sm text-slate-700">Outgoing</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="callType"
                            checked={logCallForm.callType === 'Incoming'}
                            onChange={() => setLogCallForm((p) => ({ ...p, callType: 'Incoming' }))}
                            className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                          />
                          <span className="text-sm text-slate-700">Incoming</span>
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Call Duration</label>
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <input
                            id="log-call-duration-min"
                            type="number"
                            min={0}
                            max={999}
                            value={logCallForm.durationMinutes === 0 ? '' : logCallForm.durationMinutes}
                            onChange={(e) => setLogCallForm((p) => ({ ...p, durationMinutes: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                            placeholder="0"
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <span className="block text-[11px] text-slate-400 mt-1">Minutes</span>
                        </div>
                        <div className="flex-1">
                          <input
                            id="log-call-duration-sec"
                            type="number"
                            min={0}
                            max={59}
                            value={logCallForm.durationSeconds === 0 ? '' : logCallForm.durationSeconds}
                            onChange={(e) => setLogCallForm((p) => ({ ...p, durationSeconds: Math.min(59, Math.max(0, parseInt(e.target.value, 10) || 0)) }))}
                            placeholder="0"
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <span className="block text-[11px] text-slate-400 mt-1">Seconds</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Call Outcome</label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setOutcomeDropdownOpen((v) => !v)}
                          className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-left text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                          <span className={logCallForm.outcome ? 'text-slate-900' : 'text-slate-400'}>
                            {logCallForm.outcome || 'Select outcome'}
                          </span>
                          <ChevronDown size={16} className="text-slate-400" />
                        </button>
                        {outcomeDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setOutcomeDropdownOpen(false)} aria-hidden />
                            <ul className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg max-h-48 overflow-y-auto">
                              {CALL_OUTCOMES.map((opt) => (
                                <li key={opt}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setLogCallForm((p) => ({ ...p, outcome: opt }));
                                      setOutcomeDropdownOpen(false);
                                    }}
                                    className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${logCallForm.outcome === opt ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                                  >
                                    {opt}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    </div>
                    <div>
                      <label htmlFor="log-call-notes" className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
                      <textarea
                        id="log-call-notes"
                        rows={4}
                        value={logCallForm.notes}
                        onChange={(e) => setLogCallForm((p) => ({ ...p, notes: e.target.value }))}
                        placeholder="Add notes about the call..."
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                      />
                    </div>
                    <div>
                      <FollowUpDateTimeField
                        label="Next Follow-up Date & Time"
                        value={logCallForm.nextFollowUp}
                        onChange={(iso) => setLogCallForm((p) => ({ ...p, nextFollowUp: iso }))}
                        followUpType={logCallForm.followUpType || 'Call'}
                        onFollowUpTypeChange={(type) =>
                          setLogCallForm((p) => ({ ...p, followUpType: type }))
                        }
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowLogCallForm(false)}
                      className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowLogCallForm(false);
                        setLogCallForm({ callType: 'Outgoing', durationMinutes: 0, durationSeconds: 0, outcome: '', notes: '', nextFollowUp: '', followUpType: 'Call' });
                      }}
                      className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-sm transition-colors"
                    >
                      Save Call Log
                    </button>
                  </div>
                </div>
              ) : showSendWhatsAppForm ? (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 mb-4">
                    <button
                      type="button"
                      onClick={() => { setShowSendWhatsAppForm(false); setActiveTab('overview'); }}
                      className="p-2 -ml-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Back to Overview"
                    >
                      <ChevronRight size={20} className="rotate-180" />
                    </button>
                    <h2 className="text-lg font-bold text-slate-900">Send WhatsApp Message</h2>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Recipient</label>
                      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700">
                        <WhatsAppIcon size={18} className="text-emerald-600 shrink-0" />
                        <span>{lead?.phone || '—'}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">Auto-filled from lead contact</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Template</label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setTemplateDropdownOpen((v) => !v)}
                          className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-left text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                          <span className={whatsAppForm.template ? 'text-slate-900' : 'text-slate-400'}>
                            {whatsAppForm.template || 'Select Template'}
                          </span>
                          <ChevronDown size={16} className="text-slate-400" />
                        </button>
                        {templateDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setTemplateDropdownOpen(false)} aria-hidden />
                            <ul className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg max-h-48 overflow-y-auto">
                              {WHATSAPP_TEMPLATES.map((name) => (
                                <li key={name}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setWhatsAppForm((p) => ({ ...p, template: name }));
                                      setTemplateDropdownOpen(false);
                                    }}
                                    className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${whatsAppForm.template === name ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                                  >
                                    {name}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    </div>
                    <div>
                      <label htmlFor="whatsapp-message" className="block text-sm font-medium text-slate-700 mb-2">Message Editor</label>
                      <textarea
                        id="whatsapp-message"
                        rows={5}
                        value={whatsAppForm.message}
                        onChange={(e) => setWhatsAppForm((p) => ({ ...p, message: e.target.value }))}
                        placeholder="Type your message... Use {{name}} for contact name."
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">Variables: {'{{name}}'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Attachments</label>
                      <button
                        type="button"
                        className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500 hover:border-slate-300 hover:bg-slate-50 transition-colors"
                      >
                        <Paperclip size={18} className="text-slate-400" />
                        Upload File
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowSendWhatsAppForm(false)}
                      className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSendWhatsAppForm(false);
                        setWhatsAppForm({ template: '', message: '' });
                      }}
                      className="px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 shadow-sm transition-colors flex items-center gap-2"
                    >
                      <WhatsAppIcon size={16} />
                      Send Message
                    </button>
                  </div>
                </div>
              ) : showScheduleFollowUpForm ? (
                <ScheduleMeetingForm
                  entityType="lead"
                  entityId={lead?.id || ''}
                  showBackButton={true}
                  onBack={() => {
                    setShowScheduleFollowUpForm(false);
                    setActiveTab('followup');
                  }}
                  title="Schedule Follow-up"
                  onSuccess={() => {
                    setShowScheduleFollowUpForm(false);
                    setActiveTab('followup');
                    onUpdateLead?.();
                  }}
                  onCancel={() => {
                    setShowScheduleFollowUpForm(false);
                    setActiveTab('followup');
                  }}
                />
              ) : showConvertToClientForm ? (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 mb-4">
                    <button
                      type="button"
                      onClick={() => { setShowConvertToClientForm(false); setActiveTab('overview'); }}
                      className="p-2 -ml-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Back to Overview"
                    >
                      <ChevronRight size={20} className="rotate-180" />
                    </button>
                    <h2 className="text-lg font-bold text-slate-900">Convert Lead to Client</h2>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
                    <div>
                      <label htmlFor="convert-company" className="block text-sm font-medium text-slate-700 mb-2">Company Name</label>
                      <input
                        id="convert-company"
                        type="text"
                        value={convertToClientForm.companyName}
                        onChange={(e) => setConvertToClientForm((p) => ({ ...p, companyName: e.target.value }))}
                        placeholder="Company name"
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="convert-contact" className="block text-sm font-medium text-slate-700 mb-2">Director Name</label>
                      <input
                        id="convert-contact"
                        type="text"
                        value={convertToClientForm.primaryContact}
                        onChange={(e) => setConvertToClientForm((p) => ({ ...p, primaryContact: e.target.value }))}
                        placeholder="Primary contact name"
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="convert-email" className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                      <input
                        id="convert-email"
                        type="email"
                        value={convertToClientForm.email}
                        onChange={(e) => setConvertToClientForm((p) => ({ ...p, email: e.target.value }))}
                        placeholder="email@company.com"
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="convert-phone" className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
                      <input
                        id="convert-phone"
                        type="text"
                        value={convertToClientForm.phone}
                        onChange={(e) => setConvertToClientForm((p) => ({ ...p, phone: e.target.value }))}
                        placeholder="Phone number"
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Industry</label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => { setIndustryDropdownOpen((v) => !v); setCompanySizeDropdownOpen(false); setAccountManagerDropdownOpen(false); }}
                          className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-left text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                          <span className={convertToClientForm.industry ? 'text-slate-900' : 'text-slate-400'}>
                            {convertToClientForm.industry || 'Select industry'}
                          </span>
                          <ChevronDown size={16} className="text-slate-400" />
                        </button>
                        {industryDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setIndustryDropdownOpen(false)} aria-hidden />
                            <ul className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg max-h-48 overflow-y-auto">
                              {INDUSTRIES.map((name) => (
                                <li key={name}>
                                  <button
                                    type="button"
                                    onClick={() => { setConvertToClientForm((p) => ({ ...p, industry: name })); setIndustryDropdownOpen(false); }}
                                    className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${convertToClientForm.industry === name ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                                  >
                                    {name}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Company Size</label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => { setCompanySizeDropdownOpen((v) => !v); setIndustryDropdownOpen(false); setAccountManagerDropdownOpen(false); }}
                          className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-left text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                          <span className={convertToClientForm.companySize ? 'text-slate-900' : 'text-slate-400'}>
                            {convertToClientForm.companySize || 'Select company size'}
                          </span>
                          <ChevronDown size={16} className="text-slate-400" />
                        </button>
                        {companySizeDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setCompanySizeDropdownOpen(false)} aria-hidden />
                            <ul className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg max-h-48 overflow-y-auto">
                              {COMPANY_SIZES.map((size) => (
                                <li key={size}>
                                  <button
                                    type="button"
                                    onClick={() => { setConvertToClientForm((p) => ({ ...p, companySize: size })); setCompanySizeDropdownOpen(false); }}
                                    className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${convertToClientForm.companySize === size ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                                  >
                                    {size}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Assign Account Manager</label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => { setAccountManagerDropdownOpen((v) => !v); setIndustryDropdownOpen(false); setCompanySizeDropdownOpen(false); }}
                          className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-left text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                          <span className={convertToClientForm.accountManager ? 'text-slate-900' : 'text-slate-400'}>
                            {convertToClientForm.accountManager || 'Select account manager'}
                          </span>
                          <ChevronDown size={16} className="text-slate-400" />
                        </button>
                        {accountManagerDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setAccountManagerDropdownOpen(false)} aria-hidden />
                            <ul className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg max-h-48 overflow-y-auto">
                              {ACCOUNT_MANAGERS.map((name) => (
                                <li key={name}>
                                  <button
                                    type="button"
                                    onClick={() => { setConvertToClientForm((p) => ({ ...p, accountManager: name })); setAccountManagerDropdownOpen(false); }}
                                    className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${convertToClientForm.accountManager === name ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                                  >
                                    {name}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 pt-2">
                      <input
                        id="convert-create-job"
                        type="checkbox"
                        checked={convertToClientForm.createJobRequirement}
                        onChange={(e) => setConvertToClientForm((p) => ({ ...p, createJobRequirement: e.target.checked }))}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor="convert-create-job" className="text-sm font-medium text-slate-700 cursor-pointer">
                        Create Job Requirement
                      </label>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowConvertToClientForm(false)}
                      className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (isLeadAlreadyConverted(lead)) {
                          void requestError(leadConvertedAlertMessage(lead));
                          return;
                        }
                        if (lead) onConvert?.(lead.id, convertToClientForm);
                        setShowConvertToClientForm(false);
                        onClose();
                      }}
                      className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-sm transition-colors flex items-center gap-2"
                    >
                      <UserPlus size={16} />
                      Convert Lead
                    </button>
                  </div>
                </div>
              ) : showAssignLeadForm ? (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 mb-4">
                    <button
                      type="button"
                      onClick={() => { setShowAssignLeadForm(false); setActiveTab('overview'); }}
                      className="p-2 -ml-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Back to Overview"
                    >
                      <ChevronRight size={20} className="rotate-180" />
                    </button>
                    <h2 className="text-lg font-bold text-slate-900">Assign Lead</h2>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Assign To</label>
                      <LeadAssigneesMultiSelect
                        members={recruiters}
                        value={assignLeadForm.assignTos}
                        loading={loadingRecruiters}
                        onChange={(ids) => {
                          setAssignLeadForm((p) => ({
                            ...p,
                            assignTos: ids,
                            assignTo: ids[0] ?? '',
                          }));
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Priority</label>
                      <div className="flex flex-col gap-2">
                        {(['High', 'Medium', 'Low'] as const).map((p) => (
                          <label key={p} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="assign-priority"
                              checked={assignLeadForm.priority === p}
                              onChange={() => setAssignLeadForm((prev) => ({ ...prev, priority: p }))}
                              className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-slate-700">{p}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 pt-2">
                      <input
                        id="assign-notify-user"
                        type="checkbox"
                        checked={assignLeadForm.notifyUser}
                        onChange={(e) => setAssignLeadForm((p) => ({ ...p, notifyUser: e.target.checked }))}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor="assign-notify-user" className="text-sm font-medium text-slate-700 cursor-pointer">
                        Notify User
                      </label>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowAssignLeadForm(false)}
                      className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (lead) onAssignLead?.(lead.id, assignLeadForm);
                        setShowAssignLeadForm(false);
                        onClose();
                      }}
                      className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-sm transition-colors flex items-center gap-2"
                    >
                      <UserCog size={16} />
                      Assign Lead
                    </button>
                  </div>
                </div>
              ) : showMarkLostForm ? (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 mb-4">
                    <button
                      type="button"
                      onClick={() => { setShowMarkLostForm(false); setActiveTab('overview'); }}
                      className="p-2 -ml-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Back to Overview"
                    >
                      <ChevronRight size={20} className="rotate-180" />
                    </button>
                    <h2 className="text-lg font-bold text-slate-900">Mark Lead as Lost</h2>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Lost Reason</label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setLostReasonDropdownOpen((v) => !v)}
                          className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-left text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                          <span className={markLostForm.lostReason ? 'text-slate-900' : 'text-slate-400'}>
                            {markLostForm.lostReason || 'Select reason'}
                          </span>
                          <ChevronDown size={16} className="text-slate-400" />
                        </button>
                        {lostReasonDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setLostReasonDropdownOpen(false)} aria-hidden />
                            <ul className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg max-h-48 overflow-y-auto">
                              {LOST_REASONS.map((reason) => (
                                <li key={reason}>
                                  <button
                                    type="button"
                                    onClick={() => { setMarkLostForm((p) => ({ ...p, lostReason: reason })); setLostReasonDropdownOpen(false); }}
                                    className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${markLostForm.lostReason === reason ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                                  >
                                    {reason}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    </div>
                    <div>
                      <label htmlFor="mark-lost-notes" className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
                      <textarea
                        id="mark-lost-notes"
                        value={markLostForm.notes}
                        onChange={(e) => setMarkLostForm((p) => ({ ...p, notes: e.target.value }))}
                        placeholder="Add notes (optional)"
                        rows={4}
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowMarkLostForm(false)}
                      className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (lead) onMarkLost?.(lead.id, markLostForm);
                        setShowMarkLostForm(false);
                        onClose();
                      }}
                      className="px-4 py-2.5 text-sm font-medium text-white bg-slate-600 rounded-xl hover:bg-slate-700 shadow-sm transition-colors flex items-center gap-2"
                    >
                      <XCircle size={16} />
                      Confirm Lost
                    </button>
                  </div>
                </div>
              ) : activeTab === 'add' ? (
                <div className="space-y-5">
                  <AddLeadSectionCard
                    title="Company Details"
                    subtitle="Organization name and online presence"
                    icon={Building2}
                    accent="blue"
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <AddLeadFieldLabel label="Company" icon={Building2} iconClassName="text-blue-500" required />
                        <AddLeadIconInput
                          icon={Building2}
                          iconClassName="text-blue-400"
                          value={addLeadForm.companyName}
                          onChange={(e) => setAddLeadForm((p) => ({ ...p, companyName: e.target.value }))}
                          placeholder="e.g. Acme Inc."
                        />
                      </div>
                      <div>
                        <div className="mb-1.5 flex items-center justify-between gap-3">
                          <AddLeadFieldLabel label="Company Links" icon={Link2} iconClassName="text-blue-500" />
                          <button
                            type="button"
                            onClick={addCompanyLinkField}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100"
                            aria-label="Add company link"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <div className="space-y-2">
                          {companyLinks.map((link, index) => (
                            <div key={`company-link-${index}`} className="flex items-center gap-2">
                              <AddLeadIconInput
                                icon={Globe}
                                iconClassName="text-blue-400"
                                value={link}
                                onChange={(e) => updateCompanyLink(index, e.target.value)}
                                placeholder="https://company.com or LinkedIn URL"
                              />
                              {companyLinks.length > 1 ? (
                                <button
                                  type="button"
                                  onClick={() => removeCompanyLinkField(index)}
                                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                                  aria-label={`Remove company link ${index + 1}`}
                                >
                                  <Trash2 size={16} />
                                </button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </AddLeadSectionCard>

                  <AddLeadSectionCard
                    title="Contacts"
                    subtitle="Director and team member details"
                    icon={Users}
                    accent="violet"
                  >
                    <div className="space-y-4">
                      <div className="rounded-xl border border-violet-100/80 bg-violet-50/30 p-3">
                        <DirectorContactFields
                          directorSalutation={addLeadForm.directorSalutation}
                          contactPerson={addLeadForm.contactPerson}
                          emails={addLeadForm.emails}
                          phones={addLeadForm.phones}
                          email={addLeadForm.email}
                          phone={addLeadForm.phone}
                          countryCode={addLeadForm.countryCode}
                          countryName={addLeadForm.country}
                          onDirectorSalutationChange={(value) =>
                            setAddLeadForm((p) => ({ ...p, directorSalutation: value }))
                          }
                          onContactPersonChange={(value) => {
                            setAddLeadForm((p) => ({ ...p, contactPerson: value }));
                            if (addLeadErrors.contactPerson) {
                              setAddLeadErrors((prev) => ({ ...prev, contactPerson: undefined }));
                            }
                          }}
                          onEmailsChange={(emails, primaryEmail) => {
                            setAddLeadForm((p) => ({ ...p, emails, email: primaryEmail }));
                            if (addLeadErrors.email) {
                              setAddLeadErrors((prev) => ({ ...prev, email: undefined }));
                            }
                          }}
                          onPhonesChange={(phones, primaryPhone) => {
                            setAddLeadForm((p) => ({ ...p, phones, phone: primaryPhone }));
                            if (addLeadErrors.phone) {
                              setAddLeadErrors((prev) => ({ ...prev, phone: undefined }));
                            }
                          }}
                          contactPersonError={addLeadErrors.contactPerson}
                          emailError={addLeadErrors.email}
                          phoneError={addLeadErrors.phone}
                          onContactPersonBlur={() => {
                            const nextErrors = validateLeadRequiredFields(addLeadForm);
                            setAddLeadErrors((prev) => ({
                              ...prev,
                              contactPerson: nextErrors.contactPerson,
                            }));
                          }}
                        />
                      </div>
                      <div className="rounded-xl border border-violet-100/80 bg-violet-50/20 p-3">
                        <TeamMemberOptionalFields
                          requireTeamName={false}
                          countryCode={addLeadForm.countryCode}
                          countryName={addLeadForm.country}
                          members={addLeadForm.teamMembers}
                          onChange={(teamMembers) =>
                            setAddLeadForm((p) => ({ ...p, ...syncLeadTeamMembers(teamMembers) }))
                          }
                        />
                      </div>
                    </div>
                  </AddLeadSectionCard>

                  <AddLeadSectionCard
                    title="Location & Industry"
                    subtitle="Where the company operates"
                    icon={MapPin}
                    accent="emerald"
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <CscLocationFields
                          location={addLeadForm.location ?? ''}
                          city={addLeadForm.city ?? ''}
                          state={addLeadForm.state ?? ''}
                          country={addLeadForm.country ?? ''}
                          countryCode={addLeadForm.countryCode ?? ''}
                          latitude={addLeadForm.latitude ?? null}
                          longitude={addLeadForm.longitude ?? null}
                          showDetectedHint={false}
                          onLocationChange={(next) => setAddLeadForm((p) => ({ ...p, location: next }))}
                          onSelect={(s) => setAddLeadForm((p) => mergeLocationFields(p, s))}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <AddLeadFieldLabel label="Industry" icon={Briefcase} iconClassName="text-emerald-500" />
                        <IndustryMultiSelect
                          value={addLeadForm.industry ?? ''}
                          onChange={(industry) => setAddLeadForm((p) => ({ ...p, industry }))}
                          companyName={addLeadForm.companyName ?? ''}
                          placeholder="Type an industry (e.g. technology, healthcare)"
                        />
                        <p className="mt-1 text-[11px] text-slate-400">
                          Select one or more industries. Press Enter to add a custom industry.
                        </p>
                      </div>
                    </div>
                  </AddLeadSectionCard>

                  <AddLeadSectionCard
                    title="Source & Qualification"
                    subtitle="How you found this lead and its stage"
                    icon={Megaphone}
                    accent="amber"
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <LeadSourceFields
                          form={addLeadForm}
                          onChange={(patch) => setAddLeadForm((p) => ({ ...p, ...patch }))}
                        />
                      </div>
                      <div>
                        <div className="mb-1.5 flex items-center justify-between gap-3">
                          <AddLeadFieldLabel label="Status" icon={Flag} iconClassName="text-amber-500" />
                          <button
                            type="button"
                            onClick={() => {
                              setShowAddLeadStatusInput((prev) => !prev);
                              setNewLeadStatusValue('');
                            }}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Add status
                          </button>
                        </div>
                        <LeadStatusDropdown
                          value={addLeadForm.status ?? 'New'}
                          options={addLeadStatusOptions}
                          deleting={deletingLeadStatus}
                          preferUpward
                          onSelect={(status) => setAddLeadForm((p) => ({ ...p, status: status as LeadStatus }))}
                          onDelete={(status) =>
                            deleteLeadStatusOption(status, (nextStatus) =>
                              setAddLeadForm((p) => ({ ...p, status: nextStatus as LeadStatus })),
                            )
                          }
                        />
                        {showAddLeadStatusInput ? (
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              value={newLeadStatusValue}
                              onChange={(e) => setNewLeadStatusValue(e.target.value)}
                              className={ADD_LEAD_INPUT}
                              placeholder="Enter new status"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                addLeadStatusOption((status) =>
                                  setAddLeadForm((p) => ({ ...p, status: status as LeadStatus })),
                                )
                              }
                              disabled={savingLeadStatus}
                              className="rounded-xl bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {savingLeadStatus ? 'Adding...' : 'Add'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowAddLeadStatusInput(false);
                                setNewLeadStatusValue('');
                              }}
                              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : null}
                      </div>
                      <div>
                        <AddLeadFieldLabel label="Interest Level" icon={Target} iconClassName="text-amber-500" />
                        <AddLeadSelectDropdown
                          value={addLeadForm.priority ?? 'Medium'}
                          preferUpward
                          leadingIcon={Target}
                          leadingIconClassName="text-amber-400"
                          triggerClassName={`${ADD_LEAD_INPUT} flex w-full items-center justify-between text-left`}
                          options={[
                            { value: 'High', label: 'High' },
                            { value: 'Medium', label: 'Medium' },
                            { value: 'Low', label: 'Low' },
                          ]}
                          onChange={(priority) =>
                            setAddLeadForm((p) => ({
                              ...p,
                              priority: priority as 'High' | 'Medium' | 'Low',
                            }))
                          }
                        />
                      </div>
                    </div>
                  </AddLeadSectionCard>

                  <AddLeadSectionCard
                    title="Follow-up & Assignment"
                    subtitle="Schedule the first follow-up and assign an owner"
                    icon={Calendar}
                    accent="sky"
                  >
                    <div className="space-y-4">
                      <FollowUpDateTimeField
                        value={addLeadForm.nextFollowUp ?? ''}
                        onChange={(iso) => setAddLeadForm((p) => ({ ...p, nextFollowUp: iso }))}
                        followUpType={addLeadForm.followUpType || 'Call'}
                        onFollowUpTypeChange={(type) =>
                          setAddLeadForm((p) => ({ ...p, followUpType: type }))
                        }
                      />
                      <div>
                        <AddLeadFieldLabel label="Follow-up notes" icon={StickyNote} iconClassName="text-sky-500" />
                        <textarea
                          value={addLeadForm.followUpNotes ?? ''}
                          onChange={(e) =>
                            setAddLeadForm((p) => ({ ...p, followUpNotes: e.target.value }))
                          }
                          rows={2}
                          className={`${ADD_LEAD_INPUT} resize-none`}
                          placeholder="What should be discussed on this follow-up?"
                        />
                      </div>
                      <div>
                        <AddLeadFieldLabel label="Assigned To" icon={UserCog} iconClassName="text-sky-500" />
                        <LeadAssigneesMultiSelect
                          members={recruiters}
                          value={
                            addLeadForm.assignedToIds ??
                            (addLeadForm.assignedToId ? [addLeadForm.assignedToId] : [])
                          }
                          loading={loadingRecruiters}
                          onChange={(ids) => {
                            const primary = ids[0] ? recruiters.find((r) => r.id === ids[0]) : undefined;
                            setAddLeadForm((p) => ({
                              ...p,
                              assignedToIds: ids,
                              assignedToId: ids[0] ?? '',
                              assignedToName: primary
                                ? `${primary.firstName} ${primary.lastName}`
                                : '',
                            }));
                          }}
                        />
                      </div>
                    </div>
                  </AddLeadSectionCard>

                  <AddLeadSectionCard
                    title="Business Opportunity"
                    subtitle="Services and expected value"
                    icon={IndianRupee}
                    accent="rose"
                  >
                    <div className="space-y-4">
                      <div>
                        <AddLeadFieldLabel label="Services Needed" icon={Layers} iconClassName="text-rose-500" />
                        <ServicesNeededSelect
                          value={addLeadForm.interestedNeeds ?? ''}
                          onChange={(interestedNeeds) =>
                            setAddLeadForm((p) => ({ ...p, interestedNeeds }))
                          }
                          industry={addLeadForm.industry ?? ''}
                        />
                      </div>
                      <div>
                        <AddLeadFieldLabel
                          label="Expected Business Value"
                          icon={IndianRupee}
                          iconClassName="text-rose-500"
                        />
                        <textarea
                          value={addLeadForm.notes ?? ''}
                          onChange={(e) => setAddLeadForm((p) => ({ ...p, notes: e.target.value }))}
                          rows={3}
                          className={`${ADD_LEAD_INPUT} resize-none`}
                          placeholder="e.g. Potential annual business of ₹15,00,000"
                        />
                      </div>
                      {Array.isArray(addLeadForm.otherDetails) && addLeadForm.otherDetails.length ? (
                        <div>
                          <AddLeadFieldLabel label="Other Details" icon={FileText} iconClassName="text-rose-500" />
                          <div className="space-y-2 rounded-xl border border-rose-100 bg-rose-50/40 px-4 py-3">
                            {addLeadForm.otherDetails.map((item, index) => (
                              <div key={`${item.label}-${index}`} className="text-sm">
                                <span className="font-semibold text-slate-900">{item.label}:</span>{' '}
                                <span className="text-slate-600">{item.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </AddLeadSectionCard>

                  <div className="hidden">
                  {/* Section 1 — Company Information */}
                  <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleAddLeadSection('company')}
                      className="w-full p-5 flex items-center justify-between gap-2 text-left hover:bg-slate-50/50 transition-colors"
                    >
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <Building2 size={14} className="text-slate-400" />
                        Company Information
                      </h4>
                      {addLeadSectionsOpen.company ? (
                        <ChevronDown size={18} className="text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight size={18} className="text-slate-400 shrink-0" />
                      )}
                    </button>
                    {addLeadSectionsOpen.company && (
                      <div className="px-5 pb-5 pt-0 border-t border-slate-100 space-y-4">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Company *</label>
                          <input
                            value={addLeadForm.companyName}
                            onChange={(e) => setAddLeadForm((p) => ({ ...p, companyName: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="e.g. Acme Inc."
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Industry</label>
                          <IndustryMultiSelect
                            value={addLeadForm.industry ?? ''}
                            onChange={(industry) => setAddLeadForm((p) => ({ ...p, industry }))}
                            companyName={addLeadForm.companyName ?? ''}
                            placeholder="Type an industry (e.g. technology, healthcare)"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Company Links</label>
                          <input
                            value={addLeadForm.website ?? ''}
                            onChange={(e) => setAddLeadForm((p) => ({ ...p, website: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="https://company.com or LinkedIn URL"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Location</label>
                          <input
                            value={addLeadForm.location ?? ''}
                            onChange={(e) => setAddLeadForm((p) => ({ ...p, location: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="e.g. Downtown Office"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">City</label>
                          <input
                            value={addLeadForm.city ?? ''}
                            onChange={(e) => setAddLeadForm((p) => ({ ...p, city: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="e.g. San Francisco"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Country</label>
                          <input
                            value={addLeadForm.country ?? ''}
                            onChange={(e) => setAddLeadForm((p) => ({ ...p, country: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="e.g. United States"
                          />
                        </div>
                      </div>
                    )}
                  </section>

                  {/* Section 2 — Contact Person */}
                  <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleAddLeadSection('contact')}
                      className="w-full p-5 flex items-center justify-between gap-2 text-left hover:bg-slate-50/50 transition-colors"
                    >
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <User size={14} className="text-slate-400" />
                        Contact
                      </h4>
                      {addLeadSectionsOpen.contact ? (
                        <ChevronDown size={18} className="text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight size={18} className="text-slate-400 shrink-0" />
                      )}
                    </button>
                    {addLeadSectionsOpen.contact && (
                      <div className="px-5 pb-5 pt-0 border-t border-slate-100 space-y-4">
                        <DirectorContactFields
                          directorSalutation={addLeadForm.directorSalutation}
                          contactPerson={addLeadForm.contactPerson}
                          emails={addLeadForm.emails}
                          phones={addLeadForm.phones}
                          email={addLeadForm.email}
                          phone={addLeadForm.phone}
                          countryCode={addLeadForm.countryCode}
                          countryName={addLeadForm.country}
                          onDirectorSalutationChange={(value) =>
                            setAddLeadForm((p) => ({ ...p, directorSalutation: value }))
                          }
                          onContactPersonChange={(value) => {
                            setAddLeadForm((p) => ({ ...p, contactPerson: value }));
                            if (addLeadErrors.contactPerson) {
                              setAddLeadErrors((prev) => ({ ...prev, contactPerson: undefined }));
                            }
                          }}
                          onEmailsChange={(emails, primaryEmail) => {
                            setAddLeadForm((p) => ({ ...p, emails, email: primaryEmail }));
                            if (addLeadErrors.email) {
                              setAddLeadErrors((prev) => ({ ...prev, email: undefined }));
                            }
                          }}
                          onPhonesChange={(phones, primaryPhone) => {
                            setAddLeadForm((p) => ({ ...p, phones, phone: primaryPhone }));
                            if (addLeadErrors.phone) {
                              setAddLeadErrors((prev) => ({ ...prev, phone: undefined }));
                            }
                          }}
                          contactPersonError={addLeadErrors.contactPerson}
                          emailError={addLeadErrors.email}
                          phoneError={addLeadErrors.phone}
                          onContactPersonBlur={() => {
                            const nextErrors = validateLeadRequiredFields(addLeadForm);
                            setAddLeadErrors((prev) => ({
                              ...prev,
                              contactPerson: nextErrors.contactPerson,
                            }));
                          }}
                        />
                        <TeamMemberOptionalFields
                          requireTeamName={false}
                          countryCode={addLeadForm.countryCode}
                          countryName={addLeadForm.country}
                          members={addLeadForm.teamMembers}
                          onChange={(teamMembers) =>
                            setAddLeadForm((p) => ({ ...p, ...syncLeadTeamMembers(teamMembers) }))
                          }
                        />
                      </div>
                    )}
                  </section>

                  {/* Section 3 — Lead Details */}
                  <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleAddLeadSection('leadDetails')}
                      className="w-full p-5 flex items-center justify-between gap-2 text-left hover:bg-slate-50/50 transition-colors"
                    >
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <Target size={14} className="text-slate-400" />
                        Lead Details
                      </h4>
                      {addLeadSectionsOpen.leadDetails ? (
                        <ChevronDown size={18} className="text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight size={18} className="text-slate-400 shrink-0" />
                      )}
                    </button>
                    {addLeadSectionsOpen.leadDetails && (
                      <div className="px-5 pb-5 pt-0 border-t border-slate-100 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="mb-1 flex items-center justify-between gap-3">
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</label>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowAddLeadStatusInput((prev) => !prev);
                                    setNewLeadStatusValue('');
                                  }}
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  Add status
                                </button>
                              </div>
                            </div>
                            <LeadStatusDropdown
                              value={addLeadForm.status ?? 'New'}
                              options={addLeadStatusOptions}
                              deleting={deletingLeadStatus}
                              onSelect={(status) => setAddLeadForm((p) => ({ ...p, status: status as LeadStatus }))}
                              onDelete={(status) =>
                                deleteLeadStatusOption(status, (nextStatus) =>
                                  setAddLeadForm((p) => ({ ...p, status: nextStatus as LeadStatus })),
                                )
                              }
                            />
                            {showAddLeadStatusInput ? (
                              <div className="mt-2 flex items-center gap-2">
                                <input
                                  value={newLeadStatusValue}
                                  onChange={(e) => setNewLeadStatusValue(e.target.value)}
                                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                  placeholder="Enter new status"
                                />
                                <button
                                  type="button"
                                  onClick={() => addLeadStatusOption((status) => setAddLeadForm((p) => ({ ...p, status: status as LeadStatus })))}
                                  disabled={savingLeadStatus}
                                  className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {savingLeadStatus ? 'Adding...' : 'Add'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowAddLeadStatusInput(false);
                                    setNewLeadStatusValue('');
                                  }}
                                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : null}
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Interest Level</label>
                            <select
                              value={addLeadForm.priority ?? 'Medium'}
                              onChange={(e) => setAddLeadForm((p) => ({ ...p, priority: e.target.value as 'High' | 'Medium' | 'Low' }))}
                              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                            >
                              <option value="High">High</option>
                              <option value="Medium">Medium</option>
                              <option value="Low">Low</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Services Needed</label>
                          <ServicesNeededSelect
                            value={addLeadForm.interestedNeeds ?? ''}
                            onChange={(interestedNeeds) => setAddLeadForm((p) => ({ ...p, interestedNeeds }))}
                            industry={addLeadForm.industry ?? ''}
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Expected Business Value</label>
                          <textarea
                            value={addLeadForm.notes ?? ''}
                            onChange={(e) => setAddLeadForm((p) => ({ ...p, notes: e.target.value }))}
                            rows={3}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                            placeholder="e.g. Potential annual business of $50,000"
                          />
                        </div>
                        <div>
                          <FollowUpDateTimeField
                            value={addLeadForm.nextFollowUp ?? ''}
                            onChange={(iso) => setAddLeadForm((p) => ({ ...p, nextFollowUp: iso }))}
                            followUpType={addLeadForm.followUpType || 'Call'}
                            onFollowUpTypeChange={(type) =>
                              setAddLeadForm((p) => ({ ...p, followUpType: type }))
                            }
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Assigned To</label>
                          <LeadAssigneesMultiSelect
                            members={recruiters}
                            value={addLeadForm.assignedToIds ?? (addLeadForm.assignedToId ? [addLeadForm.assignedToId] : [])}
                            loading={loadingRecruiters}
                            onChange={(ids) => {
                              const primary = ids[0] ? recruiters.find((r) => r.id === ids[0]) : undefined;
                              setAddLeadForm((p) => ({
                                ...p,
                                assignedToIds: ids,
                                assignedToId: ids[0] ?? '',
                                assignedToName: primary ? `${primary.firstName} ${primary.lastName}` : '',
                              }));
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </section>
                  </div>
                </div>
              ) : activeTab === 'overview' ? (
                <div className="space-y-5">
                      {isLeadAlreadyConverted(lead) ? (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900 shadow-sm">
                          <p className="font-semibold">Converted to client — view only</p>
                          <p className="mt-0.5 text-emerald-800/90">
                            This lead is linked to
                            {lead?.convertedClientName
                              ? ` “${lead.convertedClientName}”`
                              : ' a client'}
                            . Editing is disabled.
                          </p>
                        </div>
                      ) : null}
                      {!overviewEditMode ? (
                        <>
                          {lead?.id ? (
                            <>
                              <EntityWorkspaceAlertsPanel
                                entityType="LEAD"
                                entityId={lead.id}
                                entityLabel={lead.companyName || 'Lead'}
                              />
                            </>
                          ) : null}
                          <AddLeadSectionCard
                            title="Company Details"
                            subtitle="Organization name and online presence"
                            icon={Building2}
                            accent="blue"
                          >
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <OverviewField
                                label="Company"
                                icon={Building2}
                                iconClassName="text-blue-500"
                                required
                                value={lead?.companyName ?? ''}
                              />
                              <OverviewField
                                label="Company Links"
                                icon={Link2}
                                iconClassName="text-blue-500"
                                value={lead?.website ?? ''}
                                href={!!lead?.website}
                              />
                            </div>
                          </AddLeadSectionCard>

                          <AddLeadSectionCard
                            title="Contacts"
                            subtitle="Director and team member details"
                            icon={Users}
                            accent="violet"
                          >
                            <div className="space-y-4">
                              <div className="rounded-xl border border-violet-100/80 bg-violet-50/30 p-3">
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                  <OverviewField
                                    label="Director Name"
                                    icon={User}
                                    iconClassName="text-violet-500"
                                    value={formatDirectorDisplay(
                                      lead?.directorSalutation,
                                      lead?.directorName || lead?.contactPerson,
                                    )}
                                  />
                                  <OverviewField
                                    label="Email"
                                    icon={Mail}
                                    iconClassName="text-violet-500"
                                    required
                                    value={formatContactListMultiline(lead?.emails, lead?.email)}
                                    multiline
                                  />
                                  <OverviewField
                                    label="Mobile Number"
                                    icon={Phone}
                                    iconClassName="text-violet-500"
                                    value={formatContactListMultiline(lead?.phones, lead?.phone)}
                                    multiline
                                  />
                                </div>
                              </div>
                              {(() => {
                                const teamMembers = resolveTeamMemberList(lead).filter(teamMemberHasAnyValue);
                                if (teamMembers.length === 0) return null;
                                return (
                                  <div className="rounded-xl border border-violet-100/80 bg-violet-50/20 p-3 space-y-3">
                                    <AddLeadFieldLabel label="Team Member" icon={Users} iconClassName="text-violet-500" />
                                    {teamMembers.map((tm, index) => (
                                      <div
                                        key={`lead-team-member-${index}`}
                                        className="grid grid-cols-1 gap-4 rounded-xl border border-violet-100/60 bg-white/80 px-3 py-3 sm:grid-cols-3"
                                      >
                                        <OverviewField
                                          label="Name"
                                          value={formatDirectorDisplay(
                                            tm.teamMemberSalutation,
                                            tm.teamMemberName || tm.teamMemberDesignation,
                                          )}
                                        />
                                        <OverviewField
                                          label="Email"
                                          value={tm.teamMemberEmail ?? ''}
                                          href={!!tm.teamMemberEmail}
                                        />
                                        <OverviewField label="Mobile Number" value={tm.teamMemberPhone ?? ''} />
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}
                            </div>
                          </AddLeadSectionCard>

                          <AddLeadSectionCard
                            title="Location & Industry"
                            subtitle="Where the company operates"
                            icon={MapPin}
                            accent="emerald"
                          >
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <div className="sm:col-span-2">
                                <OverviewField label="Location" icon={MapPin} iconClassName="text-emerald-500" value={lead?.location ?? ''} />
                              </div>
                              <OverviewField label="City" icon={MapPin} iconClassName="text-emerald-500" value={lead?.city ?? ''} />
                              <OverviewField label="State" icon={MapPin} iconClassName="text-emerald-500" value={lead?.state ?? ''} />
                              <OverviewField label="Country" icon={Globe} iconClassName="text-emerald-500" value={lead?.country ?? ''} />
                              <OverviewField label="Industry" icon={Briefcase} iconClassName="text-emerald-500" value={formatIndustriesDisplay(lead?.industry ?? '')} />
                            </div>
                          </AddLeadSectionCard>

                          <AddLeadSectionCard
                            title="Source & Qualification"
                            subtitle="Lead origin and pipeline stage"
                            icon={Megaphone}
                            accent="amber"
                          >
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <OverviewField label="Source" icon={Megaphone} iconClassName="text-amber-500" value={lead?.source ?? ''} />
                              <OverviewField
                                label={getSourceFieldLabel(lead?.source)}
                                icon={Globe}
                                iconClassName="text-amber-500"
                                value={getLeadSourceDetailValue(lead)}
                                href={Boolean(getLeadSourceDetailValue(lead))}
                              />
                              <OverviewField label="Status" icon={Flag} iconClassName="text-amber-500" value={lead?.status ?? ''} />
                              <OverviewField label="Interest Level" icon={Target} iconClassName="text-amber-500" value={lead?.priority ?? ''} />
                            </div>
                          </AddLeadSectionCard>

                          <AddLeadSectionCard
                            title="Follow-up & Assignment"
                            subtitle="Schedule and owner"
                            icon={Calendar}
                            accent="sky"
                          >
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <OverviewFieldDateTime
                                label="Next Follow-up"
                                icon={Calendar}
                                iconClassName="text-sky-500"
                                value={lead?.nextFollowUp}
                              />
                              <OverviewField
                                label="Assigned To"
                                icon={UserCog}
                                iconClassName="text-sky-500"
                                value={
                                  Array.isArray(lead?.assignedToUsers) && lead!.assignedToUsers!.length > 0
                                    ? lead!.assignedToUsers!.map((u) => u.name).join(', ')
                                    : (lead?.assignedTo?.name ?? '')
                                }
                              />
                            </div>
                          </AddLeadSectionCard>

                          <AddLeadSectionCard
                            title="Business Opportunity"
                            subtitle="Services and expected value"
                            icon={IndianRupee}
                            accent="rose"
                          >
                            <div className="space-y-4">
                              <OverviewField label="Services Needed" icon={Layers} iconClassName="text-rose-500" value={lead?.interestedNeeds ?? ''} />
                              <OverviewField label="Expected Business Value" icon={IndianRupee} iconClassName="text-rose-500" value={lead?.notes ?? ''} multiline />
                              {Array.isArray(lead?.otherDetails) && lead.otherDetails.length ? (
                                <div>
                                  <AddLeadFieldLabel label="Other Details" icon={FileText} iconClassName="text-rose-500" />
                                  <div className="space-y-2 rounded-xl border border-rose-100 bg-rose-50/40 px-4 py-3">
                                    {lead.otherDetails.map((item, index) => (
                                      <div key={`${item.label}-${index}`} className="text-sm">
                                        <span className="font-semibold text-slate-900">{item.label}:</span>{' '}
                                        <span className="text-slate-600">{item.value}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </AddLeadSectionCard>
                        </>
                      ) : (
                        <div className="space-y-5">
                          <AddLeadSectionCard
                            title="Company Details"
                            subtitle="Organization name and online presence"
                            icon={Building2}
                            accent="blue"
                          >
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                              <AddLeadFieldLabel label="Company" icon={Building2} iconClassName="text-blue-500" required />
                              <input
                                value={overviewEditForm.companyName}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setOverviewEditForm((p) => ({ ...p, companyName: value }));
                                  if (overviewEditErrors.companyName) {
                                    setOverviewEditErrors((prev) => ({ ...prev, companyName: undefined }));
                                  }
                                }}
                                className={`${ADD_LEAD_INPUT} ${
                                  overviewEditErrors.companyName ? 'border-red-300' : 'border-slate-200'
                                }`}
                              />
                              {overviewEditErrors.companyName && (
                                <p className="mt-1 text-xs text-red-600">{overviewEditErrors.companyName}</p>
                              )}
                            </div>
                            <div>
                              <AddLeadFieldLabel label="Company Links" icon={Link2} iconClassName="text-blue-500" />
                              <input value={overviewEditForm.website} onChange={(e) => setOverviewEditForm((p) => ({ ...p, website: e.target.value }))} className={ADD_LEAD_INPUT} />
                            </div>
                            </div>
                          </AddLeadSectionCard>

                          <AddLeadSectionCard
                            title="Contacts"
                            subtitle="Director and team member details"
                            icon={Users}
                            accent="violet"
                          >
                            <div className="space-y-4">
                            <div className="rounded-xl border border-violet-100/80 bg-violet-50/30 p-3">
                              <DirectorContactFields
                                directorSalutation={overviewEditForm.directorSalutation}
                                contactPerson={overviewEditForm.contactPerson}
                                emails={overviewEditForm.emails}
                                phones={overviewEditForm.phones}
                                email={overviewEditForm.email}
                                phone={overviewEditForm.phone}
                                countryCode={overviewEditForm.countryCode}
                                countryName={overviewEditForm.country}
                                onDirectorSalutationChange={(value) =>
                                  setOverviewEditForm((p) => ({ ...p, directorSalutation: value }))
                                }
                                onContactPersonChange={(value) => {
                                  setOverviewEditForm((p) => ({ ...p, contactPerson: value }));
                                  if (overviewEditErrors.contactPerson) {
                                    setOverviewEditErrors((prev) => ({ ...prev, contactPerson: undefined }));
                                  }
                                }}
                                onEmailsChange={(emails, primaryEmail) => {
                                  setOverviewEditForm((p) => ({ ...p, emails, email: primaryEmail }));
                                  if (overviewEditErrors.email) {
                                    setOverviewEditErrors((prev) => ({ ...prev, email: undefined }));
                                  }
                                }}
                                onPhonesChange={(phones, primaryPhone) => {
                                  setOverviewEditForm((p) => ({ ...p, phones, phone: primaryPhone }));
                                  if (overviewEditErrors.phone) {
                                    setOverviewEditErrors((prev) => ({ ...prev, phone: undefined }));
                                  }
                                }}
                                contactPersonError={overviewEditErrors.contactPerson}
                                emailError={overviewEditErrors.email}
                                phoneError={overviewEditErrors.phone}
                              />
                            </div>
                            <div className="rounded-xl border border-violet-100/80 bg-violet-50/20 p-3">
                              <TeamMemberOptionalFields
                                requireTeamName={false}
                                countryCode={overviewEditForm.countryCode}
                                countryName={overviewEditForm.country}
                                members={overviewEditForm.teamMembers}
                                onChange={(teamMembers) =>
                                  setOverviewEditForm((p) => ({ ...p, ...syncLeadTeamMembers(teamMembers) }))
                                }
                              />
                            </div>
                            </div>
                          </AddLeadSectionCard>

                          <AddLeadSectionCard
                            title="Location & Industry"
                            subtitle="Where the company operates"
                            icon={MapPin}
                            accent="emerald"
                          >
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                            <CscLocationFields
                              location={overviewEditForm.location}
                              city={overviewEditForm.city}
                              state={overviewEditForm.state}
                              country={overviewEditForm.country}
                              countryCode={overviewEditForm.countryCode}
                              latitude={overviewEditForm.latitude}
                              longitude={overviewEditForm.longitude}
                              showDetectedHint={false}
                              onLocationChange={(next) => setOverviewEditForm((p) => ({ ...p, location: next }))}
                              onSelect={(s) => setOverviewEditForm((p) => mergeLocationFields(p, s))}
                            />
                            </div>
                            <div>
                              <AddLeadFieldLabel label="Industry" icon={Briefcase} iconClassName="text-emerald-500" />
                              <IndustryMultiSelect
                                value={overviewEditForm.industry ?? ''}
                                onChange={(industry) => setOverviewEditForm((p) => ({ ...p, industry }))}
                                companyName={overviewEditForm.companyName ?? ''}
                                placeholder="Type an industry (e.g. technology, healthcare)"
                              />
                            </div>
                            </div>
                          </AddLeadSectionCard>

                          <AddLeadSectionCard
                            title="Source & Qualification"
                            subtitle="How you found this lead and its stage"
                            icon={Megaphone}
                            accent="amber"
                          >
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                              <LeadSourceFields
                                form={overviewEditForm}
                                onChange={(patch) => setOverviewEditForm((p) => ({ ...p, ...patch }))}
                              />
                            </div>
                            <div>
                              <div className="mb-1.5 flex items-center justify-between gap-3">
                                <AddLeadFieldLabel label="Status" icon={Flag} iconClassName="text-amber-500" />
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowAddLeadStatusInput((prev) => !prev);
                                      setNewLeadStatusValue('');
                                    }}
                                    className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                    Add status
                                  </button>
                                </div>
                              </div>
                              <LeadStatusDropdown
                                value={overviewEditForm.status || 'New'}
                                options={overviewLeadStatusOptions}
                                deleting={deletingLeadStatus}
                                onSelect={(status) => setOverviewEditForm((p) => ({ ...p, status: status as LeadStatus }))}
                                onDelete={(status) =>
                                  deleteLeadStatusOption(status, (nextStatus) =>
                                    setOverviewEditForm((p) => ({ ...p, status: nextStatus as LeadStatus })),
                                  )
                                }
                              />
                              {showAddLeadStatusInput ? (
                                <div className="mt-2 flex items-center gap-2">
                                  <input
                                    value={newLeadStatusValue}
                                    onChange={(e) => setNewLeadStatusValue(e.target.value)}
                                    className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    placeholder="Enter new status"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => addLeadStatusOption((status) => setOverviewEditForm((p) => ({ ...p, status: status as LeadStatus })))}
                                    disabled={savingLeadStatus}
                                    className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {savingLeadStatus ? 'Adding...' : 'Add'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowAddLeadStatusInput(false);
                                      setNewLeadStatusValue('');
                                    }}
                                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : null}
                            </div>
                            <div>
                              <AddLeadFieldLabel label="Interest Level" icon={Target} iconClassName="text-amber-500" />
                              <select
                                value={overviewEditForm.priority}
                                onChange={(e) => setOverviewEditForm((p) => ({ ...p, priority: e.target.value as 'High' | 'Medium' | 'Low' }))}
                                className={`${ADD_LEAD_INPUT} bg-white`}
                              >
                                <option value="High">High</option>
                                <option value="Medium">Medium</option>
                                <option value="Low">Low</option>
                              </select>
                            </div>
                            </div>
                          </AddLeadSectionCard>

                          <AddLeadSectionCard
                            title="Follow-up & Assignment"
                            subtitle="Schedule and owner"
                            icon={Calendar}
                            accent="sky"
                          >
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                              <FollowUpDateTimeField
                                value={overviewEditForm.nextFollowUp}
                                onChange={(iso) => setOverviewEditForm((p) => ({ ...p, nextFollowUp: iso }))}
                                followUpType={overviewEditForm.followUpType || 'Call'}
                                onFollowUpTypeChange={(type) =>
                                  setOverviewEditForm((p) => ({ ...p, followUpType: type }))
                                }
                              />
                            </div>
                            <div>
                              <AddLeadFieldLabel label="Assigned To" icon={UserCog} iconClassName="text-sky-500" />
                              <LeadAssigneesMultiSelect
                                members={recruiters}
                                value={overviewEditForm.assignedToIds ?? (overviewEditForm.assignedToId ? [overviewEditForm.assignedToId] : [])}
                                loading={loadingRecruiters}
                                onChange={(ids) => {
                                  const primary = ids[0] ? recruiters.find((r) => r.id === ids[0]) : undefined;
                                  setOverviewEditForm((p) => ({
                                    ...p,
                                    assignedToIds: ids,
                                    assignedToId: ids[0] ?? '',
                                    leadOwner: primary ? `${primary.firstName} ${primary.lastName}` : '',
                                  }));
                                }}
                              />
                            </div>
                            </div>
                          </AddLeadSectionCard>

                          <AddLeadSectionCard
                            title="Business Opportunity"
                            subtitle="Services and expected value"
                            icon={IndianRupee}
                            accent="rose"
                          >
                            <div className="space-y-4">
                            <div>
                              <AddLeadFieldLabel label="Services Needed" icon={Layers} iconClassName="text-rose-500" />
                              <ServicesNeededSelect
                                value={overviewEditForm.interestedNeeds}
                                onChange={(interestedNeeds) => setOverviewEditForm((p) => ({ ...p, interestedNeeds }))}
                                industry={overviewEditForm.industry ?? ''}
                              />
                            </div>
                          <div>
                            <AddLeadFieldLabel label="Expected Business Value" icon={IndianRupee} iconClassName="text-rose-500" />
                            <textarea
                              value={overviewEditForm.notes}
                              onChange={(e) => setOverviewEditForm((p) => ({ ...p, notes: e.target.value }))}
                              rows={3}
                              className={`${ADD_LEAD_INPUT} resize-none`}
                            />
                          </div>
                          <div>
                            <AddLeadFieldLabel label="Other Details" icon={FileText} iconClassName="text-rose-500" />
                            <div className="rounded-xl border border-rose-100 bg-rose-50/40 px-4 py-4 space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Dynamic Fields</p>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOverviewEditForm((p) => ({
                                      ...p,
                                      dynamicOtherDetails: [...p.dynamicOtherDetails, { label: '', value: '' }],
                                    }))
                                  }
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                                >
                                  <Plus size={14} />
                                  Add field
                                </button>
                              </div>
                              {overviewEditForm.dynamicOtherDetails.length === 0 ? (
                                <p className="text-xs text-slate-500">
                                  No custom fields yet. Add a row or import from Excel; label and value are both required to save a field.
                                </p>
                              ) : (
                                <div className="space-y-2">
                                  {overviewEditForm.dynamicOtherDetails.map((row, idx) => (
                                    <div key={`lead-dyn-${idx}`} className="flex flex-wrap items-center gap-2">
                                      <input
                                        value={row.label}
                                        onChange={(e) => {
                                          const label = e.target.value;
                                          setOverviewEditForm((p) => ({
                                            ...p,
                                            dynamicOtherDetails: p.dynamicOtherDetails.map((r, i) =>
                                              i === idx ? { ...r, label } : r,
                                            ),
                                          }));
                                        }}
                                        placeholder="Field name"
                                        className="min-w-[8rem] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                      />
                                      <input
                                        value={row.value}
                                        onChange={(e) => {
                                          const value = e.target.value;
                                          setOverviewEditForm((p) => ({
                                            ...p,
                                            dynamicOtherDetails: p.dynamicOtherDetails.map((r, i) =>
                                              i === idx ? { ...r, value } : r,
                                            ),
                                          }));
                                        }}
                                        placeholder="Value"
                                        className="min-w-[8rem] flex-[2] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setOverviewEditForm((p) => ({
                                            ...p,
                                            dynamicOtherDetails: p.dynamicOtherDetails.filter((_, i) => i !== idx),
                                          }))
                                        }
                                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-600"
                                        aria-label="Remove dynamic field"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                            </div>
                          </AddLeadSectionCard>
                        </div>
                      )}

                  {!isLeadAlreadyConverted(lead) ? (
                  <AddLeadSectionCard
                    title="Quick Actions"
                    subtitle="Common lead workflows"
                    icon={Activity}
                    accent="indigo"
                  >
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        <button
                          type="button"
                          onClick={() => setShowLogCallForm(true)}
                          className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100 hover:border-slate-300 active:scale-[0.98] active:bg-slate-200 active:border-slate-300 transition-all duration-150"
                        >
                          <PhoneCall size={16} className="text-slate-600" />
                          Log Call
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowSendWhatsAppForm(true)}
                          className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100 hover:border-slate-300 active:scale-[0.98] active:bg-slate-200 active:border-slate-300 transition-all duration-150"
                        >
                          <WhatsAppIcon size={16} className="text-emerald-600" />
                          Send WhatsApp
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowScheduleFollowUpForm(false);
                            setActiveTab('followup');
                          }}
                          className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100 hover:border-slate-300 active:scale-[0.98] active:bg-slate-200 active:border-slate-300 transition-all duration-150"
                        >
                          <CalendarPlus size={16} className="text-slate-600" />
                          Schedule Follow-up
                        </button>
                        <button
                            type="button"
                            onClick={openConvertToClientForm}
                            className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100 hover:border-slate-300 active:scale-[0.98] active:bg-slate-200 active:border-slate-300 transition-all duration-150"
                          >
                            <UserPlus size={16} className="text-slate-600" />
                            Convert to Client
                          </button>
                        <button
                            type="button"
                            onClick={openMarkLostForm}
                            className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100 hover:border-slate-300 active:scale-[0.98] active:bg-slate-200 active:border-slate-300 transition-all duration-150"
                          >
                            <XCircle size={16} className="text-slate-600" />
                            Mark Lost
                          </button>
                        <button
                            type="button"
                            onClick={openAssignLeadForm}
                            className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100 hover:border-slate-300 active:scale-[0.98] active:bg-slate-200 active:border-slate-300 transition-all duration-150"
                          >
                            <UserCog size={16} className="text-slate-600" />
                            Assign Lead
                          </button>
                      </div>
                  </AddLeadSectionCard>
                  ) : null}
                  <div className="hidden">
                  {/* Section 1 — Company Information */}
                  <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleOverviewSection('company')}
                      className="w-full p-5 flex items-center justify-between gap-2 text-left hover:bg-slate-50/50 transition-colors"
                    >
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <Building2 size={14} className="text-slate-400" />
                        Company Information
                      </h4>
                      {overviewOpen.company ? (
                        <ChevronDown size={18} className="text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight size={18} className="text-slate-400 shrink-0" />
                      )}
                    </button>
                    {overviewOpen.company && (
                      <div className="px-5 pb-5 pt-0 border-t border-slate-100 space-y-0">
                        {!overviewEditMode ? (
                          <>
                            <FieldRow label="Company Name" value={lead?.companyName ?? ''} />
                            <FieldRow label="Industry" value={formatIndustriesDisplay(lead?.industry ?? '')} />
                            <FieldRow label="Company Size" value={lead?.companySize ?? ''} />
                            <FieldRow label="Website" value={lead?.website ?? ''} href={!!lead?.website} />
                            <FieldRow label="LinkedIn" value={lead?.linkedIn ?? ''} href={!!lead?.linkedIn} />
                            <FieldRow label="Location" value={lead?.location ?? ''} />
                          </>
                        ) : (
                          <div className="space-y-4 pt-2">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Company Name</label>
                              <input
                                value={overviewEditForm.companyName}
                                onChange={(e) => setOverviewEditForm((p) => ({ ...p, companyName: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Industry</label>
                              <IndustryMultiSelect
                                value={overviewEditForm.industry ?? ''}
                                onChange={(industry) => setOverviewEditForm((p) => ({ ...p, industry }))}
                                companyName={overviewEditForm.companyName ?? ''}
                                placeholder="Type an industry (e.g. technology, healthcare)"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Company Size</label>
                              <input
                                value={overviewEditForm.companySize}
                                onChange={(e) => setOverviewEditForm((p) => ({ ...p, companySize: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Website</label>
                              <input
                                value={overviewEditForm.website}
                                onChange={(e) => setOverviewEditForm((p) => ({ ...p, website: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">LinkedIn</label>
                              <input
                                value={overviewEditForm.linkedIn}
                                onChange={(e) => setOverviewEditForm((p) => ({ ...p, linkedIn: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              />
                            </div>
                            <CscLocationFields
                              location={overviewEditForm.location}
                              city={overviewEditForm.city}
                              state={overviewEditForm.state}
                              country={overviewEditForm.country}
                              countryCode={overviewEditForm.countryCode}
                              latitude={overviewEditForm.latitude}
                              longitude={overviewEditForm.longitude}
                              showDetectedHint={false}
                              onLocationChange={(next) => setOverviewEditForm((p) => ({ ...p, location: next }))}
                              onSelect={(s) => setOverviewEditForm((p) => mergeLocationFields(p, s))}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </section>

                  {/* Section 2 — Contact Person */}
                  <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleOverviewSection('contact')}
                      className="w-full p-5 flex items-center justify-between gap-2 text-left hover:bg-slate-50/50 transition-colors"
                    >
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <User size={14} className="text-slate-400" />
                        Contact Person
                      </h4>
                      {overviewOpen.contact ? (
                        <ChevronDown size={18} className="text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight size={18} className="text-slate-400 shrink-0" />
                      )}
                    </button>
                    {overviewOpen.contact && (
                      <div className="px-5 pb-5 pt-0 border-t border-slate-100 space-y-0">
                        {!overviewEditMode ? (
                          <>
                            <FieldRow label="Contact Name" value={formatDirectorDisplay(lead?.directorSalutation, lead?.contactPerson)} />
                            <FieldRow label="Designation" value={lead?.designation ?? ''} />
                            <FieldRow
                              label="Email"
                              value={formatContactListMultiline(lead?.emails, lead?.email)}
                              href
                              multiline
                            />
                            <FieldRow
                              label="Phone"
                              value={formatContactListMultiline(lead?.phones, lead?.phone)}
                              multiline
                            />
                            <FieldRow label="Country" value={lead?.country ?? ''} />
                            <FieldRow label="City" value={lead?.city ?? ''} />
                          </>
                        ) : (
                          <div className="space-y-4 pt-2">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Contact Name</label>
                              <div className="flex gap-2">
                                <select
                                  value={overviewEditForm.directorSalutation ?? ''}
                                  onChange={(e) =>
                                    setOverviewEditForm((p) => ({ ...p, directorSalutation: e.target.value }))
                                  }
                                  className="w-[5.75rem] shrink-0 rounded-xl border border-slate-200 px-2 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                  aria-label="Contact salutation"
                                >
                                  {NAME_SALUTATION_OPTIONS.map((opt) => (
                                    <option key={opt.value || 'none'} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  value={overviewEditForm.contactPerson}
                                  onChange={(e) => setOverviewEditForm((p) => ({ ...p, contactPerson: e.target.value }))}
                                  className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Designation</label>
                              <input
                                value={overviewEditForm.designation}
                                onChange={(e) => setOverviewEditForm((p) => ({ ...p, designation: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              />
                            </div>
                            <MultiContactFields
                              label="Email"
                              type="email"
                              values={overviewEditForm.emails}
                              onChange={(emails) => {
                                const primary = primaryContactValue(
                                  normalizeContactList(emails, overviewEditForm.email),
                                );
                                setOverviewEditForm((p) => ({ ...p, emails, email: primary }));
                              }}
                              placeholder="email@company.com"
                            />
                            <MultiContactFields
                              label="Phone"
                              type="tel"
                              values={overviewEditForm.phones}
                              onChange={(phones) => {
                                const primary = primaryContactValue(
                                  normalizeContactList(phones, overviewEditForm.phone),
                                );
                                setOverviewEditForm((p) => ({ ...p, phones, phone: primary }));
                              }}
                              placeholder="+1 (555) 000-0000"
                            />
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Country</label>
                              <input
                                value={overviewEditForm.country}
                                onChange={(e) => setOverviewEditForm((p) => ({ ...p, country: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">City</label>
                              <input
                                value={overviewEditForm.city}
                                onChange={(e) => setOverviewEditForm((p) => ({ ...p, city: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </section>

                  {/* Section 3 — Lead Details */}
                  <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleOverviewSection('leadDetails')}
                      className="w-full p-5 flex items-center justify-between gap-2 text-left hover:bg-slate-50/50 transition-colors"
                    >
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <Target size={14} className="text-slate-400" />
                        Lead Details
                      </h4>
                      {overviewOpen.leadDetails ? (
                        <ChevronDown size={18} className="text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight size={18} className="text-slate-400 shrink-0" />
                      )}
                    </button>
                    {overviewOpen.leadDetails && (
                      <div className="px-5 pb-5 pt-0 border-t border-slate-100 space-y-0">
                        {!overviewEditMode ? (
                          <>
                            <FieldRow label="Lead Source" value={lead?.source ?? ''} />
                            <FieldRow
                              label={getSourceFieldLabel(lead?.source)}
                              value={
                                lead?.source === 'Website'
                                  ? lead?.sourceWebsiteUrl ?? ''
                                  : lead?.source === 'LinkedIn'
                                    ? lead?.sourceLinkedInUrl ?? ''
                                    : lead?.source === 'Email'
                                      ? lead?.sourceEmail ?? ''
                                      : lead?.source === 'Referral'
                                        ? lead?.referralName ?? ''
                                        : `${lead?.campaignName ?? ''}${lead?.campaignLink ? ` (${lead.campaignLink})` : ''}`
                              }
                            />
                            <FieldRow label="Campaign Name" value={lead?.campaignName ?? ''} />
                            <FieldRow
                              label="Lead Owner"
                              value={
                                Array.isArray(lead?.assignedToUsers) && lead!.assignedToUsers!.length > 0
                                  ? lead!.assignedToUsers!.map((u) => u.name).join(', ')
                                  : (lead?.assignedTo?.name ?? '')
                              }
                            />
                            <FieldRow label="Lead Status" value={lead?.status ?? ''} />
                            <FieldRow label="Created Date" value={lead?.createdDate ?? ''} />
                            <FieldRowDateTime label="Last Contacted" value={lead?.lastFollowUp} />
                            <FieldRowDateTime label="Next Follow-up" value={lead?.nextFollowUp} />
                          </>
                        ) : (
                          <div className="space-y-4 pt-2">
                            <LeadSourceFields
                              form={overviewEditForm}
                              onChange={(patch) => setOverviewEditForm((p) => ({ ...p, ...patch }))}
                            />
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Lead Owner</label>
                              <input
                                value={overviewEditForm.leadOwner}
                                onChange={(e) => setOverviewEditForm((p) => ({ ...p, leadOwner: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <div className="mb-1 flex items-center justify-between gap-3">
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Lead Status</label>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowAddLeadStatusInput((prev) => !prev);
                                      setNewLeadStatusValue('');
                                    }}
                                    className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                    Add status
                                  </button>
                                </div>
                              </div>
                              <LeadStatusDropdown
                                value={overviewEditForm.status || 'New'}
                                options={overviewLeadStatusOptions}
                                deleting={deletingLeadStatus}
                                onSelect={(status) => setOverviewEditForm((p) => ({ ...p, status: status as LeadStatus }))}
                                onDelete={(status) =>
                                  deleteLeadStatusOption(status, (nextStatus) =>
                                    setOverviewEditForm((p) => ({ ...p, status: nextStatus as LeadStatus })),
                                  )
                                }
                              />
                              {showAddLeadStatusInput ? (
                                <div className="mt-2 flex items-center gap-2">
                                  <input
                                    value={newLeadStatusValue}
                                    onChange={(e) => setNewLeadStatusValue(e.target.value)}
                                    className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    placeholder="Enter new status"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => addLeadStatusOption((status) => setOverviewEditForm((p) => ({ ...p, status: status as LeadStatus })))}
                                    disabled={savingLeadStatus}
                                    className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {savingLeadStatus ? 'Adding...' : 'Add'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowAddLeadStatusInput(false);
                                      setNewLeadStatusValue('');
                                    }}
                                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : null}
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Created Date</label>
                              <input
                                type="datetime-local"
                                value={toDateTimeLocalInput(overviewEditForm.createdDate)}
                                onChange={(e) => setOverviewEditForm((p) => ({ ...p, createdDate: fromDateTimeLocalInput(e.target.value) }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Last Contacted</label>
                              <input
                                type="datetime-local"
                                value={toDateTimeLocalInput(overviewEditForm.lastFollowUp)}
                                onChange={(e) => setOverviewEditForm((p) => ({ ...p, lastFollowUp: fromDateTimeLocalInput(e.target.value) }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <FollowUpDateTimeField
                                label="Next Follow-up"
                                value={overviewEditForm.nextFollowUp}
                                onChange={(iso) => setOverviewEditForm((p) => ({ ...p, nextFollowUp: iso }))}
                                followUpType={overviewEditForm.followUpType || 'Call'}
                                onFollowUpTypeChange={(type) =>
                                  setOverviewEditForm((p) => ({ ...p, followUpType: type }))
                                }
                              />
                            </div>
                            <div className="md:col-span-2">
                              <AgreementTermsSection
                                values={overviewEditForm}
                                onChange={(patch) => setOverviewEditForm((p) => ({ ...p, ...patch }))}
                                disabled={uploadingKyc || uploadingAgreements}
                                uploadSlot={
                                  <>
                                    {overviewEditForm.agreementsFileUrl && !pendingOverviewAgreementsFile ? (
                                      <div className="mb-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900">
                                        <Paperclip size={14} className="shrink-0 text-slate-500" />
                                        <a
                                          href={overviewEditForm.agreementsFileUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="truncate flex-1 hover:underline"
                                        >
                                          {overviewEditForm.agreementsFileName || 'Agreement document'}
                                        </a>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setOverviewEditForm((p) => ({
                                              ...p,
                                              agreementsFileName: '',
                                              agreementsFileUrl: '',
                                              agreementsUploadedAt: '',
                                            }));
                                          }}
                                          className="shrink-0 rounded-lg p-1 text-red-500 hover:bg-red-50"
                                          aria-label="Remove agreement"
                                        >
                                          <X size={16} strokeWidth={2.25} />
                                        </button>
                                      </div>
                                    ) : null}
                                    <AgreementDocumentUpload
                                      description="Upload the signed agreement, MoU, or terms document for this lead. PDF, DOC, DOCX up to 10MB."
                                      pendingFile={pendingOverviewAgreementsFile}
                                      onPendingFileChange={(file) => {
                                        setPendingOverviewAgreementsFile(file);
                                        if (file) {
                                          setOverviewEditForm((p) => ({ ...p, agreementsFileName: file.name }));
                                        }
                                      }}
                                      currentTerms={overviewEditForm}
                                      onTermsExtracted={(terms) => setOverviewEditForm((p) => ({ ...p, ...terms }))}
                                      isUploading={uploadingAgreements}
                                      uploadSuccess={agreementsUploadFeedback.uploadSuccess}
                                      uploadPercent={agreementsUploadFeedback.uploadPercent}
                                      disabled={uploadingKyc}
                                    />
                                  </>
                                }
                              />
                            </div>
                            <div>
                              <KycDocumentsField
                                pendingFiles={pendingOverviewKycFiles}
                                onPendingFilesChange={setPendingOverviewKycFiles}
                                storedFiles={leadKycFiles}
                                onRemoveStored={async (fileId) => {
                                  await deleteLeadFile(fileId);
                                  await refetchLeadFiles();
                                }}
                                uploading={uploadingKyc}
                                uploadSuccess={kycUploadFeedback.uploadSuccess}
                                uploadPercent={kycUploadFeedback.uploadPercent}
                                disabled={uploadingAgreements}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </section>

                  </div>
                </div>
              ) : activeTab === 'followup' && lead?.id ? (
                isLeadAlreadyConverted(lead) ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900 shadow-sm">
                      <p className="font-semibold">Converted to client — view only</p>
                      <p className="mt-0.5 text-emerald-800/90">
                        Follow-ups can no longer be scheduled on this lead.
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
                        <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-slate-500">
                          Next follow-up
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">
                          {formatFollowUpDisplay(lead.nextFollowUp) || 'Not scheduled'}
                        </p>
                      </section>
                      <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
                        <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-slate-500">
                          Last contacted
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">
                          {formatFollowUpDisplay(lead.lastFollowUp) || '—'}
                        </p>
                      </section>
                    </div>
                  </div>
                ) : (
                  <LeadFollowUpTabPanel
                    leadId={lead.id}
                    nextFollowUp={lead.nextFollowUp}
                    lastFollowUp={lead.lastFollowUp}
                    onScheduled={() => {
                      onUpdateLead?.();
                    }}
                  />
                )
              ) : activeTab === 'activities' ? (
                <div className="space-y-6">
                  <EntityAuditSummary
                    audit={lead?.auditMeta ?? extractAuditMeta(lead as Record<string, unknown> | undefined)}
                  />
                  {/* Activity Filter — aligned with /leads table controls */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100">
                      <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                        Activity Filter
                      </h4>
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex gap-1 p-1 bg-slate-50 border border-slate-200 rounded-lg">
                          {[
                            { id: 'all' as const, label: 'All' },
                            { id: 'calls' as const, label: 'Calls' },
                            { id: 'messages' as const, label: 'WhatsApp' },
                            { id: 'emails' as const, label: 'Emails' },
                          ].map((f) => (
                            <button
                              key={f.id}
                              onClick={() => setActivityFilter(f.id)}
                              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-150 ${
                                activityFilter === f.id
                                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                                  : 'text-slate-500 hover:text-slate-700'
                              }`}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>
                        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors active:scale-[0.98]">
                          <Plus size={16} />
                          Add
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Timeline — consistent with leads page cards, internal scroll */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="px-5 py-4 border-b border-slate-100 shrink-0">
                      <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                        Timeline
                      </h4>
                    </div>
                    <div className="p-5 space-y-5 overflow-y-auto max-h-[50vh] min-h-0 custom-scrollbar">
                      {(() => {
                        const matchesFilter = (a: LeadActivity) => {
                          if (activityFilter === 'all') return true;
                          if (activityFilter === 'calls') return a.type === 'Call';
                          if (activityFilter === 'emails') return a.type === 'Email';
                          return a.type === 'Message' || a.type === 'Meeting';
                        };
                        // Use activities from state (fetched from API) instead of lead?.activities
                        const filtered = activities.filter(matchesFilter);
                        const hasItems = filtered.length > 0 || lead?.nextFollowUp;

                        return (
                          <>
                            {loadingActivities ? (
                              <p className="text-sm text-slate-500 py-8 text-center">Loading activities...</p>
                            ) : hasItems ? (
                              <div className="relative flex">
                                {/* Vertical line: runs full height through icon centers */}
                                <div className="absolute left-6 top-0 bottom-0 w-px bg-slate-200 z-0" />
                                <div className="flex flex-col gap-5 flex-1 min-w-0">
                                  {filtered.map((activity) => {
                                    const user = activity.user ?? lead?.assignedTo ?? { name: 'Unknown', avatar: '' };
                                    const title = activity.title ?? activity.type;
                                    const isCall = activity.type === 'Call';
                                    const isEmail = activity.type === 'Email';
                                    const isMessage = activity.type === 'Message';
                                    const isMeeting = activity.type === 'Meeting';
                                    const iconStyle = isCall
                                      ? 'bg-blue-600 text-white'
                                      : isEmail
                                        ? 'bg-amber-500 text-white'
                                        : isMessage
                                          ? 'bg-emerald-600 text-white'
                                          : isMeeting
                                            ? 'bg-violet-500 text-white'
                                            : 'bg-slate-600 text-white';
                                    return (
                                      <div key={activity.id} className="flex gap-4 items-start flex-shrink-0">
                                        {/* Timeline column: icon color by activity type */}
                                        <div className="w-12 flex justify-center shrink-0 relative z-10">
                                          <div
                                            className={`w-7 h-7 rounded-full border-2 border-white flex items-center justify-center shadow-sm ${iconStyle}`}
                                          >
                                            {isCall ? (
                                              <Phone size={14} />
                                            ) : isEmail ? (
                                              <Mail size={14} />
                                            ) : isMessage ? (
                                              <WhatsAppIcon size={14} />
                                            ) : isMeeting ? (
                                              <Calendar size={14} />
                                            ) : (
                                              <Calendar size={14} />
                                            )}
                                          </div>
                                        </div>
                                        {/* Card: full content, no overlap */}
                                        <div className="flex-1 min-w-0 bg-slate-50/80 rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition-colors">
                                          <div className="flex items-start justify-between gap-3 mb-2">
                                            <p className="text-sm font-semibold text-slate-900">{title}</p>
                                            <span className="text-[11px] font-medium text-slate-400 shrink-0">
                                              {activity.date}
                                            </span>
                                          </div>
                                          {activity.description && (
                                            <p className="text-sm text-slate-600 mb-3">{activity.description}</p>
                                          )}
                                          {(activity.outcome || activity.duration) && (
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-500 mb-2">
                                              {activity.outcome && (
                                                <span><span className="font-semibold text-slate-600">Outcome:</span> {activity.outcome}</span>
                                              )}
                                              {activity.duration && (
                                                <span><span className="font-semibold text-slate-600">Duration:</span> {activity.duration}</span>
                                              )}
                                            </div>
                                          )}
                                          {activity.notes && (
                                            <div className="mt-2 pt-2 border-t border-slate-200">
                                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Notes</p>
                                              <p className="text-sm text-slate-600">{activity.notes}</p>
                                            </div>
                                          )}
                                          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200">
                                            <ImageWithFallback
                                              src={user.avatar}
                                              alt={user.name}
                                              className="w-7 h-7 rounded-full object-cover ring-2 ring-white shadow-sm"
                                            />
                                            <span className="text-sm font-medium text-slate-700">{user.name}</span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {lead?.nextFollowUp && (() => {
                                    const parts = splitDateTimeForDisplay(lead.nextFollowUp);
                                    return (
                                      <div className="flex gap-4 items-start flex-shrink-0">
                                        <div className="w-12 flex justify-center shrink-0 relative z-10">
                                          <div className="w-7 h-7 rounded-full border-2 border-white bg-teal-500 text-white flex items-center justify-center shadow-sm">
                                            <Clock size={14} />
                                          </div>
                                        </div>
                                        <div className="flex-1 min-w-0 bg-teal-50 border border-teal-100 rounded-xl p-4">
                                          <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider">Next Follow-up</span>
                                          {parts ? (
                                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                              <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</p>
                                                <p className="text-sm font-semibold text-slate-900">{parts.date}</p>
                                              </div>
                                              <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Time</p>
                                                <p className="text-sm font-semibold text-slate-900">{parts.time}</p>
                                              </div>
                                            </div>
                                          ) : (
                                            <p className="text-sm font-semibold text-slate-900 mt-1">{lead.nextFollowUp}</p>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-slate-500 py-8">No activities match this filter.</p>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ) : activeTab === 'notes' ? (
                lead?.id ? (
                  <NotesService
                    entityType="lead"
                    entityId={lead.id}
                    availableTags={['Calls', 'WhatsApp', 'Emails']}
                    onNoteCreated={() => {
                      // Optionally refresh lead data or show notification
                    }}
                    onNoteUpdated={() => {
                      // Optionally refresh lead data or show notification
                    }}
                    onNoteDeleted={() => {
                      // Optionally refresh lead data or show notification
                    }}
                  />
                ) : (
                  <div className="py-8 text-center text-sm text-slate-500">
                    No lead selected
                  </div>
                )
              ) : activeTab === 'files' ? (
                (() => {
                  const LEAD_FILE_TYPE_OPTIONS = ['All', 'Contract', 'Proposal', 'Other'] as const;
                  const filteredFiles = leadFilesTypeFilter === 'All' ? leadFiles : leadFiles.filter((f) => f.fileType === leadFilesTypeFilter);
                  const uploadsBase = (typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1') : 'http://localhost:5001/api/v1').replace(/\/api\/v1\/?$/, '');
                  const toFileHref = (fileUrl?: string | null) => buildFileHref(fileUrl, uploadsBase);
                  const formatUploadDate = (d: string) => {
                    if (!d) return '—';
                    try {
                      return formatDateTimeDMY(d);
                    } catch {
                      return d;
                    }
                  };
                  const leadFileTypeStyles: Record<string, string> = {
                    Contract: 'bg-amber-100 text-amber-700 border-amber-200',
                    Proposal: 'bg-blue-100 text-blue-700 border-blue-200',
                    Other: 'bg-slate-100 text-slate-600 border-slate-200',
                  };
                  return (
                    <div className="space-y-4">
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <DocumentUploadButton
                            disabled={!lead?.id}
                            isUploading={filesUploading}
                            uploadSuccess={filesUploadSuccess}
                            uploadPercent={filesUploadPercent}
                            label="Upload File"
                            onFilesSelected={async (files) => {
                              await uploadFile(files[0], 'Other');
                            }}
                          />
                          <div className="flex flex-wrap items-center gap-2">
                            {LEAD_FILE_TYPE_OPTIONS.map((type) => (
                              <button
                                key={type}
                                type="button"
                                onClick={() => setLeadFilesTypeFilter(type)}
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors shrink-0 ${leadFilesTypeFilter === type ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                              >
                                {type}
                              </button>
                            ))}
                          </div>
                        </div>
                        {filesError && <p className="mt-2 text-sm text-red-600">{filesError}</p>}
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Files</h4>
                          <p className="text-xs text-slate-500">{filesLoading ? 'Loading…' : `${filteredFiles.length} files`}</p>
                        </div>
                        <div className="overflow-x-auto custom-scrollbar">
                          <table className="w-full text-left border-collapse min-w-[640px]">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">File name</th>
                                <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Type</th>
                                <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Uploaded by</th>
                                <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Upload date</th>
                                <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right w-32">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {filesLoading ? (
                                <tr>
                                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">Loading files…</td>
                                </tr>
                              ) : filteredFiles.length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">No files for this type.</td>
                                </tr>
                              ) : (
                                filteredFiles.map((file) => (
                                  <tr key={file.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="px-4 py-3">
                                      <p className="text-sm font-medium text-slate-900 truncate max-w-[200px]">{file.fileName}</p>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${leadFileTypeStyles[file.fileType] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                        <FileText size={14} className="text-slate-500 shrink-0" />
                                        {file.fileType}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-2 min-w-0">
                                        {file.uploadedBy?.avatar ? (
                                          <ImageWithFallback src={file.uploadedBy.avatar} alt={file.uploadedBy.name} className="w-6 h-6 rounded-full border border-slate-200 shrink-0" />
                                        ) : (
                                          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center shrink-0"><User size={12} className="text-slate-500" /></div>
                                        )}
                                        <span className="text-sm text-slate-600 truncate">{file.uploadedBy?.name ?? '—'}</span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-600">{formatUploadDate(file.uploadDate)}</td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center justify-end gap-1">
                                        {file.fileUrl && (
                                          <a href={toFileHref(file.fileUrl)} target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Download"><Download size={14} /></a>
                                        )}
                                        {file.fileUrl && (
                                          <a href={toFileHref(file.fileUrl)} target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Preview"><Eye size={14} /></a>
                                        )}
                                        <button type="button" onClick={() => deleteFile(file.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 size={14} /></button>
                                      </div>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : activeTab === 'chat' ? (
                <DrawerEntityChatTab
                  entityType="LEAD"
                  entityId={lead?.id}
                  entityLabel={lead?.companyName || lead?.contactName}
                  isActive={activeTab === 'chat'}
                  isOpen={Boolean(lead)}
                />
              ) : null}
            </div>
            </div>

          </div>
          </div>
        </motion.div>

        {addLeadMode ? (
          <LeadAiChatDrawer
            isOpen={leadAiChatOpen}
            onClose={() => setLeadAiChatOpen(false)}
            form={addLeadForm}
            onApplyGenerated={handleApplyLeadAiGenerated}
            onExpandSections={() =>
              setAddLeadSectionsOpen({ company: true, contact: true, leadDetails: true })
            }
            chatHistory={leadAiChatHistory}
            onChatHistoryChange={setLeadAiChatHistory}
            onCreateLead={() => void handleSubmitAddLead()}
            createDisabled={isCreateLeadDisabled || uploadingAgreements || uploadingKyc}
          />
        ) : null}

        {/* Duplicate lead notification — shown before create when duplicate-check matches */}
        <AnimatePresence>
          {showDuplicateNotification && pendingDuplicate ? (
            <motion.div
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 26, stiffness: 200 }}
              className="fixed bottom-8 right-8 z-[60] w-full max-w-sm"
            >
              <div className="rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/80">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                      <AlertTriangle size={16} className="text-amber-600" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 truncate">Possible duplicate lead found</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDuplicateNotification(false);
                      setPendingDuplicate(null);
                    }}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
                    aria-label="Dismiss"
                  >
                    <XCircle size={16} />
                  </button>
                </div>
                <div className="px-4 py-3 space-y-0 border-b border-slate-100">
                  <div className="flex flex-col gap-0.5 py-2 border-b border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Company</p>
                    <p className="text-xs font-medium text-slate-900 truncate">
                      {pendingDuplicate?.existing?.companyName || addLeadForm.companyName || '—'}
                    </p>
                  </div>
                  {pendingDuplicate?.existing?.contactPerson ? (
                    <div className="flex flex-col gap-0.5 py-2 border-b border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contact</p>
                      <p className="text-xs font-medium text-slate-900 truncate">
                        {pendingDuplicate.existing.contactPerson}
                      </p>
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-0.5 py-2 border-b border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Owner</p>
                    <p className="text-xs font-medium text-slate-900 truncate">
                      {pendingDuplicate?.existing?.ownerName || '—'}
                    </p>
                  </div>
                  <div className="flex flex-col gap-0.5 py-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Created</p>
                    <p className="text-xs font-medium text-slate-900">
                      {pendingDuplicate?.existing?.createdAt
                        ? formatDateDMY(pendingDuplicate.existing.createdAt)
                        : '—'}
                    </p>
                  </div>
                  {pendingDuplicate?.matchedBy?.length ? (
                    <p className="pt-2 text-[10px] text-slate-500">
                      Matched on: {pendingDuplicate.matchedBy.join(', ')}
                    </p>
                  ) : null}
                </div>
                <div className="p-4 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const existingId =
                        pendingDuplicate?.existing?.id || pendingDuplicate?.leadId;
                      setShowDuplicateNotification(false);
                      setPendingDuplicate(null);
                      if (existingId) {
                        onOpenExistingLead?.(existingId);
                      }
                    }}
                    className="w-full py-2 px-3 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors"
                  >
                    Open existing lead
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAllowDuplicateCreate(true);
                      setShowDuplicateNotification(false);
                      void handleSubmitAddLead({ skipDuplicateCheck: true });
                    }}
                    className="w-full py-2 px-3 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Create anyway
                  </button>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
}
