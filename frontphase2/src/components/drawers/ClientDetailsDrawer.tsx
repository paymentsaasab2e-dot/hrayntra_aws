'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { usePageDrawerLifecycle } from '../../lib/pageDrawerEvents';
import { useDrawerUnsavedGuard } from '../../hooks/useDrawerUnsavedGuard';
import { useClientPageFieldVisibility } from '../../hooks/useClientPageFieldVisibility';
import { buildFileHref } from '../../utils/cloudinaryUrls';
import { formatDateDMY, formatTime12hEnGb } from '../../utils/dateDisplay';
import { formatDirectorDisplay } from '../../constants/salutations';
import { DirectorContactFields } from '../forms/DirectorContactFields';
import { WhatsAppIcon } from '../icons/WhatsAppIcon';
import { LeadAssigneesMultiSelect } from './LeadAssigneesMultiSelect';
import { useAssignableMembers } from '../../hooks/useAssignableMembers';
import { AssignCompanySelect } from '../assign/AssignCompanySelect';
import { ServicesNeededSelect } from '../forms/ServicesNeededSelect';
import { IndustryMultiSelect } from '../forms/IndustryMultiSelect';
import { TeamMemberOptionalFields } from '../forms/TeamMemberOptionalFields';
import { LeadOccasionFields } from '../forms/LeadOccasionFields';
import {
  buildLeadOccasionContactOptions,
  emptyLeadOccasionForm,
  isLeadOccasionDetailLabel,
  mergeOccasionIntoOtherDetails,
  readLeadOccasionFromOtherDetails,
  type LeadOccasionFormValues,
} from '../../lib/leadOccasionDetails';
import {
  isTeamMemberDetailLabel,
  mergeTeamMemberIntoOtherDetails,
  mergeTeamMembersWithContacts,
  normalizeTeamMemberList,
  primaryTeamMemberFromList,
  resolveTeamMemberList,
  teamMemberHasAnyValue,
  teamMemberPayloadFromForm,
  teamMembersFromOtherDetails,
  type TeamMemberListItem,
} from '../../lib/teamMemberFormDetails';
import {
  directorFromOtherDetails,
  isDirectorDetailLabel,
  mergeDirectorIntoOtherDetails,
} from '../../lib/clientDirectorDetails';
import {
  directorNameFromContact,
  isClientTeamMemberContact,
  isDirectorBackendContact,
  resolveDirectorBackendContact,
} from '../../lib/clientContactRoles';
import { formatServicesNeededDisplay } from '../../lib/companyServices';
import { formatIndustriesDisplay } from '../../lib/industryOptions';
import { type LocationSelection } from '../LocationAutocomplete';
import { CscLocationFields } from '../location/CscLocationFields';
import { LeadLocationFields } from '../location/LeadLocationFields';
import { AddLeadFieldLabel } from './drawerFormUi';
import { KycDocumentsField, KycDocumentsView } from '../documents/KycDocumentsField';
import { AgreementDocumentUpload } from '../documents/AgreementDocumentUpload';
import { AgreementTermsSection } from '../agreements/AgreementTermsSection';
import {
  AGREEMENT_LEVEL_OPTIONS,
  agreementTermsApiPayload,
  agreementTermsFromRecord,
  emptyAgreementTerms,
  filledAgreementTermKeys,
  formatAgreementTermsSummary,
  mergeExtractedAgreementTerms,
  type AgreementTermsFormValues,
} from '../../lib/agreementTerms';
import type { AgreementLevelCatalogProps } from '../agreements/AgreementTermsSection';
import {
  emptyPostServiceKycForm,
  type PostServiceKycAttachmentFieldKey,
  type PostServiceKycFileRef,
  postServiceKycFormApiPayload,
  postServiceKycFormFromRecord,
  type PostServiceKycFormValues,
} from '../../lib/clientKycForm';
import { DocumentUploadButton, useDocumentUploadFeedback } from '../import/documentUploadUi';
import { filterKycFiles, uploadKycDocuments } from '../../lib/kycDocuments';
import { inferTimezoneDisplay, type LocationTimezoneInput } from '../../utils/inferTimezone';
import { ClientTimezoneSelect } from '../clients/ClientTimezoneSelect';
import { CatalogOptionDropdown, mergeCatalogOptions } from '../forms/CatalogOptionDropdown';
import {
  clientStatusLabelToBackend,
  DEFAULT_CLIENT_PRIORITY_LABELS,
  DEFAULT_CLIENT_STATUS_LABELS,
  resolveClientStatusLabel,
} from '../../lib/clientLifecycleStatus';
import {
  ClientPostServiceKycFormSection,
  ClientPostServiceKycSummary,
} from '../clients/ClientPostServiceKycSection';
import {
  buildContactChannelsFromForm,
  contactListForForm,
  formatContactListMultiline,
  normalizeContactList,
  primaryContactValue,
} from '../../lib/contact-channels';
import type { TeamMember } from '../../types/team';
import { motion, AnimatePresence } from 'motion/react';
import {
  Building2,
  Briefcase,
  MessageCircle,
  LayoutGrid,
  Users,
  GitBranch,
  Award,
  CreditCard,
  Activity,
  StickyNote,
  Paperclip,
  Edit2,
  UserPlus,
  FileText,
  Upload,
  Camera,
  Trash2,
  Globe,
  MapPin,
  Calendar,
  Clock,
  TrendingUp,
  Heart,
  CalendarPlus,
  FileCheck,
  Check,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Phone,
  Mail,
  X,
  Eye,
  Pause,
  Copy,
  BarChart3,
  AlertCircle,
  Sparkles,
  Lock,
  User,
  ArrowRight,
  Send,
  UserCheck,
  Shield,
  Download,
  DollarSign,
  FilePlus,
  Pin,
  Pencil,
  Receipt,
  Plus,
  Bell,
  MessageSquare,
  Megaphone,
  Gift,
} from 'lucide-react';
import type { Client, ClientStage, ClientHealthStatus, ClientContact, ClientJob, JobStatus, ClientPipelineCandidate, PipelineStageName, ClientPlacement, PlacementStatus, ClientInvoice, InvoiceStatus, ClientActivityItem, ActivityFilterType, ClientNote, NoteTag, ClientFile, ClientFileType } from '@/app/client/types';
import { EntityAuditSummary } from '../table/TableAuditCell';
import { DrawerEntityChatTab } from './DrawerEntityChatTab';
import { extractAuditMeta } from '../../utils/auditMeta';
import { ImageWithFallback } from '../ImageWithFallback';
import { useFiles } from '../../hooks/useFiles';
import { ScheduleMeetingForm } from '../ScheduleMeetingForm';
import { NotesService } from '../NotesService';
import {
  apiAppendAgreementLevel,
  apiAppendClientLeadStatus,
  apiAppendClientPriority,
  apiGenerateClientDetails,
  type LeadAiChatMessage,
  apiCreateClient,
  apiCreateContact,
  apiCreateScheduledMeeting,
  apiDeleteContact,
  apiDeleteScheduledMeeting,
  apiDetectContactDuplicates,
  apiFetch,
  apiGetClientActivities,
  apiGetAgreementLevelCatalog,
  apiGetClientLeadStatusCatalog,
  apiGetClientPriorityCatalog,
  apiRemoveAgreementLevel,
  apiRemoveClientLeadStatus,
  apiRemoveClientPriority,
  apiGetClientScheduledMeetings,
  apiGetClientAssignableMembers,
  apiGetContacts,
  apiGetJob,
  apiGetJobs,
  apiHqListTeam,
  apiHqUploadCompanyLogo,
  apiUpdateClient,
  apiSendClientToRecruitment,
  apiUpdateContact,
  apiUpdateJob,
  apiUpdateScheduledMeeting,
  filesApiUpload,
  type BackendUser,
  type BackendJob,
  type BackendContact,
  type CreateContactData,
  type BackendClient,
  type CreateClientData,
  type EntityFile,
  type ScheduledMeeting,
  isOrgBillingNavEnabled,
  ORG_RECRUITMENT_CACHE_EVENT,
} from '../../lib/api';
import { CrossDepartmentClientHandoff } from '../team/CrossDepartmentClientHandoff';
import { requestConfirm, requestError, requestSuccess, requestWarning } from '../../lib/appDialog';
import { CreateJobDrawer } from './CreateJobDrawer';
import { ClientAiChatDrawer } from '../clients/ClientAiChatDrawer';
import { AiCoinLockBadge, useAiCoinGate } from '../coins/AiCoinGate';
import {
  alertDrawerAnalysis,
  analyzeClientDrawer,
} from '@/lib/tenant-drawer-engine';
import {
  clientAiHasAgreementData,
  clientAiHasKycData,
  mergeClientAiKycForm,
  type ClientAiGeneratedPayload,
} from '@/lib/clientAiHelpers';
import { inferLocationFromCityName } from '../../lib/cscData';
import { DrawerCloseButton } from './DrawerCloseButton';
import { DrawerTabBar } from './DrawerTabBar';
import {
  DrawerFieldLabel,
  DrawerSectionCard,
  DRAWER_FORM_SCROLL_BG,
  DRAWER_FORM_INPUT,
} from './drawerFormUi';
import { JobDetailsDrawer, type JobForDrawer } from './JobDetailsDrawer';
import { usePermissions } from '../../hooks/usePermissions';
import { toast } from 'sonner';

const CLIENT_AI_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ClientAiRequiredField = 'companyName' | 'directorName' | 'email';

function validateClientAiEmail(email: string) {
  const value = String(email || '').trim();
  if (!value) return { valid: false, message: 'Email is required' };
  if (!CLIENT_AI_EMAIL_REGEX.test(value)) return { valid: false, message: 'Invalid email format' };
  return { valid: true, message: '' };
}

function extractEmailsFromPromptText(text: string): string[] {
  const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  return [...new Set(matches.map((value) => value.trim().toLowerCase()).filter(Boolean))];
}

function extractLabeledPromptValue(text: string, labels: string[]): string {
  for (const label of labels) {
    const pattern = new RegExp(`^\\s*${label}\\s*[:\\-–]\\s*(.+)$`, 'im');
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return '';
}

function parseDirectorNameFromContactLine(line: string): string {
  let name = line.trim();
  name = name.replace(/^(contact|contact person|director|primary contact)\s*[:–-]\s*/i, '');
  const commaIdx = name.indexOf(',');
  if (commaIdx > 0) name = name.slice(0, commaIdx).trim();
  name = name.replace(/^(mr|mrs|ms|miss|dr|prof)\.?\s+/i, '').trim();
  return name;
}

function enrichGeneratedClientFromPrompt<T extends { email?: string; phone?: string; directorName?: string; companyName?: string; otherDetails?: Array<{ label: string; value: string }> }>(
  generated: T,
  prompt: string,
): T {
  const promptEmails = extractEmailsFromPromptText(prompt);
  const labeledEmail = extractLabeledPromptValue(prompt, ['email', 'e-mail']);
  const emailFromOtherDetails = Array.isArray(generated.otherDetails)
    ? generated.otherDetails
        .map((row) => {
          const label = String(row.label || '').toLowerCase();
          const value = String(row.value || '').trim();
          if (label.includes('email') && value.includes('@')) return value;
          return extractEmailsFromPromptText(value)[0] || '';
        })
        .find(Boolean)
    : '';

  const email =
    String(generated.email || '').trim() ||
    labeledEmail ||
    emailFromOtherDetails ||
    promptEmails[0] ||
    '';

  const phone =
    String(generated.phone || '').trim() ||
    extractLabeledPromptValue(prompt, ['phone', 'mobile', 'tel', 'telephone']) ||
    '';

  let directorName = String(generated.directorName || '').trim();
  if (!directorName) {
    const contactLine = extractLabeledPromptValue(prompt, [
      'contact',
      'contact person',
      'director',
      'primary contact',
    ]);
    if (contactLine) directorName = parseDirectorNameFromContactLine(contactLine);
  }

  let companyName = String(generated.companyName || '').trim();
  if (!companyName) {
    const firstLine = prompt
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line && !line.includes('@') && !/^(phone|email|contact|location)\s*:/i.test(line));
    if (firstLine) companyName = firstLine;
  }

  return {
    ...generated,
    email,
    phone: phone || generated.phone,
    directorName: directorName || generated.directorName,
    companyName: companyName || generated.companyName,
  };
}

function normalizeClientAiDateInput(value: string) {
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
}

const HEALTH_STYLES: Record<ClientHealthStatus, { bg: string; text: string; label: string }> = {
  Good: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Good' },
  'Needs attention': { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Needs attention' },
  'At risk': { bg: 'bg-red-50', text: 'text-red-700', label: 'At risk' },
};

const FieldRow = ({
  label,
  value,
  href,
  blankWhenEmpty = false,
  multiline = false,
}: {
  label: string;
  value: string;
  href?: boolean;
  blankWhenEmpty?: boolean;
  multiline?: boolean;
}) => (
  <div className="min-w-0">
    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
    <p
      className={`mt-0.5 text-sm font-medium text-slate-900 ${href ? 'text-blue-600 hover:underline cursor-pointer' : ''} ${multiline ? 'whitespace-pre-line' : ''} ${!multiline ? 'break-words' : ''}`}
    >
      {value || (blankWhenEmpty ? '' : '—')}
    </p>
  </div>
);

function resolvePrimaryAssignedToId(form: {
  assignedToId?: string;
  assignedToIds?: string[];
}): string | undefined {
  const single = String(form.assignedToId || '').trim();
  if (single) return single;
  return form.assignedToIds?.[0] || undefined;
}

function assignedToSelectionFromId(userId: string): { assignedToId: string; assignedToIds: string[] } {
  const id = String(userId || '').trim();
  return {
    assignedToId: id,
    assignedToIds: id ? [id] : [],
  };
}

function curatedDynamicPairsForSave(rows: Array<{ label: string; value: string }>): Array<{ label: string; value: string }> | undefined {
  const curated = rows
    .map((row) => ({
      label: String(row.label ?? '').trim(),
      value: String(row.value ?? '').trim(),
    }))
    .filter((row) => row.label && row.value);
  return curated.length ? curated : undefined;
}

function filterImportedDynamicOtherDetails(
  details?: Array<{ label: string; value: string }> | null,
): Array<{ label: string; value: string }> {
  if (!Array.isArray(details)) return [];
  return details
    .filter(
      (item) =>
        !isTeamMemberDetailLabel(item?.label) &&
        !isDirectorDetailLabel(item?.label) &&
        !isLeadOccasionDetailLabel(item?.label),
    )
    .map((item) => ({
      label: String(item.label ?? '').trim(),
      value: String(item.value ?? ''),
    }));
}

function isLinkedInCompanyUrl(url: string): boolean {
  return /linkedin\.com/i.test(String(url || '').trim());
}

function buildCompanyLinksFromClient(record: {
  website?: string | null;
  linkedin?: string | null;
}): string[] {
  const links = [record.website, record.linkedin].map((v) => String(v || '').trim()).filter(Boolean);
  return links.length ? links : [''];
}

function normalizeCompanyLinksForSave(links: string[], fallbackWebsite = ''): {
  website: string | undefined;
  linkedin: string | undefined;
} {
  const cleaned = (links.length ? links : [fallbackWebsite]).map((link) => String(link || '').trim()).filter(Boolean);
  const linkedin = cleaned.find(isLinkedInCompanyUrl);
  const website = cleaned.find((link) => !isLinkedInCompanyUrl(link));
  return {
    website: website || cleaned[0] || undefined,
    linkedin: linkedin || undefined,
  };
}

function resolveClientCityStateCountry(source: {
  city?: string | null;
  state?: string | null;
  country?: string | null;
  hiringLocations?: string | null;
  location?: string | null;
}): { city: string; state: string; country: string } {
  const city = String(source.city || '').trim();
  const state = String(source.state || '').trim();
  const country = String(source.country || '').trim();
  if (city || state || country) {
    return { city, state, country };
  }
  const locationSource = String(source.hiringLocations || source.location || '').trim();
  const parts = locationSource.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 3) {
    return { city: parts[0], state: parts[1], country: parts[parts.length - 1] };
  }
  if (parts.length === 2) {
    return { city: parts[0], state: '', country: parts[1] };
  }
  if (parts.length === 1) {
    return { city: parts[0], state: '', country: '' };
  }
  return { city: '', state: '', country: '' };
}

function mergeBackendClientRecord(existing: Client, backend: BackendClient): Client {
  const statusMap: Record<string, Client['stage']> = {
    ACTIVE: 'Active',
    PROSPECT: 'Active',
    ON_HOLD: 'On Hold',
    INACTIVE: 'Inactive',
  };
  const locationFields = resolveClientCityStateCountry(backend);
  return {
    ...existing,
    name: backend.companyName || existing.name,
    industry: backend.industry || existing.industry || 'Not specified',
    location: backend.location || existing.location || 'Not specified',
    companySize: backend.companySize || existing.companySize,
    hiringLocations: backend.hiringLocations || existing.hiringLocations,
    servicesNeeded: backend.servicesNeeded || existing.servicesNeeded,
    expectedBusinessValue: backend.expectedBusinessValue || existing.expectedBusinessValue,
    leadStatus: backend.leadStatus || existing.leadStatus,
    leadStatusValue: backend.leadStatus || existing.leadStatusValue,
    website: backend.website || existing.website,
    linkedin: backend.linkedin || existing.linkedin,
    timezone: backend.timezone || existing.timezone,
    clientSince: backend.clientSince ? formatDateDMY(backend.clientSince) : existing.clientSince,
    priority: (backend.priority as Client['priority']) || existing.priority,
    sla: backend.sla || existing.sla,
    stage: statusMap[backend.status] || existing.stage,
    owner: backend.assignedTo
      ? { name: backend.assignedTo.name, avatar: backend.assignedTo.avatar || '' }
      : existing.owner,
    emails: backend.emails?.length ? backend.emails : existing.emails,
    phones: backend.phones?.length ? backend.phones : existing.phones,
    city: locationFields.city || existing.city,
    state: backend.state || locationFields.state || existing.state,
    country: locationFields.country || existing.country,
    latitude: typeof backend.latitude === 'number' ? backend.latitude : existing.latitude,
    longitude: typeof backend.longitude === 'number' ? backend.longitude : existing.longitude,
    directorSalutation: backend.directorSalutation || existing.directorSalutation,
    teamMemberDesignation: backend.teamMemberDesignation || existing.teamMemberDesignation,
    teamMemberEmail: backend.teamMemberEmail || existing.teamMemberEmail,
    teamMemberPhone: backend.teamMemberPhone || existing.teamMemberPhone,
    logo: backend.logo || existing.logo,
    agreementsFileName: backend.agreementsFileName || existing.agreementsFileName,
    agreementsFileUrl: backend.agreementsFileUrl || existing.agreementsFileUrl,
    agreementsUploadedAt: backend.agreementsUploadedAt || existing.agreementsUploadedAt,
    postServiceKycForm: backend.postServiceKycForm || existing.postServiceKycForm,
    otherDetails: Array.isArray(backend.otherDetails) ? backend.otherDetails : existing.otherDetails,
    ...(() => {
      const terms = agreementTermsFromRecord(backend);
      const parsedReplacement = terms.agreementFreeReplacementValue.trim()
        ? Number.parseInt(terms.agreementFreeReplacementValue, 10)
        : NaN;
      return {
        agreementLevel: terms.agreementLevel || existing.agreementLevel,
        agreementServiceChargePercent:
          terms.agreementServiceChargePercent || existing.agreementServiceChargePercent,
        agreementContractValidity: terms.agreementContractValidity || existing.agreementContractValidity,
        agreementContractStartDate: terms.agreementContractStartDate || existing.agreementContractStartDate,
        agreementContractEndDate: terms.agreementContractEndDate || existing.agreementContractEndDate,
        agreementTimePeriod: terms.agreementTimePeriod || existing.agreementTimePeriod,
        agreementAdvancePaymentPercent:
          terms.agreementAdvancePaymentPercent || existing.agreementAdvancePaymentPercent,
        agreementFreeReplacementValue: Number.isFinite(parsedReplacement)
          ? parsedReplacement
          : existing.agreementFreeReplacementValue,
        agreementFreeReplacementUnit:
          terms.agreementFreeReplacementUnit === 'DAYS' || terms.agreementFreeReplacementUnit === 'MONTHS'
            ? terms.agreementFreeReplacementUnit
            : existing.agreementFreeReplacementUnit,
      };
    })(),
  };
}

type ClientOverviewForm = {
  companyName: string;
  logo: string;
  industry: string;
  companySize: string;
  website: string;
  linkedin: string;
  location: string;
  city: string;
  country: string;
  countryCode: string;
  directorName: string;
  contactEmail: string;
  contactPhone: string;
  contactEmails: string[];
  contactPhones: string[];
  hiringLocations: string;
  timezone: string;
  priority: string;
  servicesNeeded: string;
  expectedBusinessValue: string;
  nextFollowUpDue: string;
  sla: string;
  status: 'ACTIVE' | 'PROSPECT' | 'ON_HOLD' | 'INACTIVE';
  assignedToId: string;
  companyLinks: string[];
  directorSalutation: string;
  designation: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
  leadStatusValue: string;
  assignedToIds: string[];
  agreementsFileName: string;
  agreementsFileUrl: string;
  agreementsUploadedAt: string;
  agreementLevel: string;
  agreementServiceChargePercent: string;
  agreementContractValidity: string;
  agreementContractStartDate: string;
  agreementContractEndDate: string;
  agreementTimePeriod: string;
  agreementAdvancePaymentPercent: string;
  agreementFreeReplacementValue: string;
  agreementFreeReplacementUnit: 'MONTHS' | 'DAYS' | '';
  teamMemberDesignation: string;
  teamMemberEmail: string;
  teamMemberPhone: string;
  teamMembers: TeamMemberListItem[];
  /** Custom / Excel-imported rows only (team-member rows are stripped and rebuilt on save). */
  dynamicOtherDetails: Array<{ label: string; value: string }>;
  postServiceKycForm: PostServiceKycFormValues;
  emailNotAvailable?: boolean;
  phoneNotAvailable?: boolean;
  /** Same event rows as Add Lead → Other (stored in otherDetails). */
  occasions: LeadOccasionFormValues;
};

const DEFAULT_ADD_CLIENT_SECTIONS = {
  company: true,
  location: true,
  contacts: true,
  qualification: true,
  other: true,
};

function AddClientAiFlowProgress({ stage }: { stage: 'chat' | 'form' }) {
  const steps = [
    { id: 'chat' as const, label: 'Chat with AI' },
    { id: 'form' as const, label: 'Review form' },
  ];
  const activeIndex = stage === 'chat' ? 0 : 1;

  return (
    <div className="shrink-0 px-5 pb-4">
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

const CLIENT_TEAM_MEMBER_TAG = 'TEAM_MEMBER';

function extractTeamMembersFromContacts(contacts: BackendContact[]): TeamMemberListItem[] {
  const members = contacts
    .filter(isClientTeamMemberContact)
    .map((contact) => {
      const joinedName = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim();
      const designation = String(contact.designation || '').trim();
      const looksLikeGeneratedName =
        /^Member\s+\d+$/i.test(String(contact.lastName || '').trim()) &&
        !String(contact.firstName || '').trim();
      // Prefer the contact's actual firstName/lastName (the value we persist from the drawer).
      // Only fall back to `designation` when the name looks like a system-generated placeholder
      // or is missing.
      let memberName = joinedName;
      if (looksLikeGeneratedName) {
        memberName = designation && designation !== 'Team Member' ? designation : joinedName || designation;
      } else if (!memberName || memberName === 'Team Member') {
        memberName = designation && designation !== 'Team Member' ? designation : memberName || designation || '';
      }

      return {
        id: contact.id,
        teamMemberSalutation: contact.salutation || '',
        teamMemberName: memberName,
        teamMemberDesignation: designation || memberName,
        teamMemberEmail: contact.email || '',
        teamMemberPhone: contact.phone || '',
      };
    });

  return normalizeTeamMemberList(members);
}

function resolveClientTeamMembersForForm(
  teamContacts: BackendContact[],
  clientRecord: Parameters<typeof resolveTeamMemberList>[0],
  directorContactId?: string | null,
): TeamMemberListItem[] {
  const fromStored = teamMembersFromOtherDetails(clientRecord?.otherDetails);
  const filteredTeamContacts = teamContacts.filter((contact) => {
    if (directorContactId && contact.id === directorContactId) return false;
    return !isDirectorBackendContact(contact);
  });
  const fromContacts = extractTeamMembersFromContacts(filteredTeamContacts);

  if (fromContacts.some(teamMemberHasAnyValue)) {
    return mergeTeamMembersWithContacts(fromContacts, fromStored);
  }

  return resolveTeamMemberList(clientRecord);
}

const POST_SERVICE_KYC_ATTACHMENT_FIELDS: PostServiceKycAttachmentFieldKey[] = [
  'shareholderPassportCopyFiles',
  'generalManagerIdCardFiles',
  'companyDocumentFiles',
  'bankAccountProofFiles',
  'signatureFiles',
  'companyStampFiles',
];

type PendingPostServiceKycFiles = Record<PostServiceKycAttachmentFieldKey, File[]>;

function createEmptyPendingPostServiceKycFiles(): PendingPostServiceKycFiles {
  return {
    shareholderPassportCopyFiles: [],
    generalManagerIdCardFiles: [],
    companyDocumentFiles: [],
    bankAccountProofFiles: [],
    signatureFiles: [],
    companyStampFiles: [],
  };
}

function postServiceKycFileRefFromEntityFile(file: EntityFile): PostServiceKycFileRef {
  return {
    id: file.id,
    fileName: file.fileName,
    fileType: file.fileType,
    fileUrl: file.fileUrl,
    uploadDate: file.uploadDate,
  };
}

function appendPostServiceKycFiles(
  form: PostServiceKycFormValues,
  field: PostServiceKycAttachmentFieldKey,
  files: PostServiceKycFileRef[],
): PostServiceKycFormValues {
  switch (field) {
    case 'signatureFiles':
      return {
        ...form,
        declaration: {
          ...form.declaration,
          signatureFiles: [...form.declaration.signatureFiles, ...files],
        },
      };
    case 'companyStampFiles':
      return {
        ...form,
        declaration: {
          ...form.declaration,
          companyStampFiles: [...form.declaration.companyStampFiles, ...files],
        },
      };
    case 'shareholderPassportCopyFiles':
      return {
        ...form,
        attachmentsChecklist: {
          ...form.attachmentsChecklist,
          shareholderPassportCopy: true,
          shareholderPassportCopyFiles: [...form.attachmentsChecklist.shareholderPassportCopyFiles, ...files],
        },
      };
    case 'generalManagerIdCardFiles':
      return {
        ...form,
        attachmentsChecklist: {
          ...form.attachmentsChecklist,
          generalManagerIdCard: true,
          generalManagerIdCardFiles: [...form.attachmentsChecklist.generalManagerIdCardFiles, ...files],
        },
      };
    case 'companyDocumentFiles':
      return {
        ...form,
        attachmentsChecklist: {
          ...form.attachmentsChecklist,
          companyDocument: true,
          companyDocumentFiles: [...form.attachmentsChecklist.companyDocumentFiles, ...files],
        },
      };
    case 'bankAccountProofFiles':
      return {
        ...form,
        attachmentsChecklist: {
          ...form.attachmentsChecklist,
          bankAccountProof: true,
          bankAccountProofFiles: [...form.attachmentsChecklist.bankAccountProofFiles, ...files],
        },
      };
    default:
      return form;
  }
}

function removePostServiceKycStoredFile(
  form: PostServiceKycFormValues,
  field: PostServiceKycAttachmentFieldKey,
  fileId: string,
): PostServiceKycFormValues {
  switch (field) {
    case 'signatureFiles':
      return {
        ...form,
        declaration: {
          ...form.declaration,
          signatureFiles: form.declaration.signatureFiles.filter((file) => file.id !== fileId),
        },
      };
    case 'companyStampFiles':
      return {
        ...form,
        declaration: {
          ...form.declaration,
          companyStampFiles: form.declaration.companyStampFiles.filter((file) => file.id !== fileId),
        },
      };
    case 'shareholderPassportCopyFiles':
      return {
        ...form,
        attachmentsChecklist: {
          ...form.attachmentsChecklist,
          shareholderPassportCopyFiles: form.attachmentsChecklist.shareholderPassportCopyFiles.filter((file) => file.id !== fileId),
        },
      };
    case 'generalManagerIdCardFiles':
      return {
        ...form,
        attachmentsChecklist: {
          ...form.attachmentsChecklist,
          generalManagerIdCardFiles: form.attachmentsChecklist.generalManagerIdCardFiles.filter((file) => file.id !== fileId),
        },
      };
    case 'companyDocumentFiles':
      return {
        ...form,
        attachmentsChecklist: {
          ...form.attachmentsChecklist,
          companyDocumentFiles: form.attachmentsChecklist.companyDocumentFiles.filter((file) => file.id !== fileId),
        },
      };
    case 'bankAccountProofFiles':
      return {
        ...form,
        attachmentsChecklist: {
          ...form.attachmentsChecklist,
          bankAccountProofFiles: form.attachmentsChecklist.bankAccountProofFiles.filter((file) => file.id !== fileId),
        },
      };
    default:
      return form;
  }
}

function hasPendingPostServiceKycFiles(value: PendingPostServiceKycFiles) {
  return POST_SERVICE_KYC_ATTACHMENT_FIELDS.some((field) => value[field].length > 0);
}

function syncClientTeamMembers(
  members?: Array<TeamMemberListItem | null | undefined> | null,
): Pick<ClientOverviewForm, 'teamMembers' | 'teamMemberDesignation' | 'teamMemberEmail' | 'teamMemberPhone'> {
  const teamMembers = normalizeTeamMemberList(members);
  const primary = primaryTeamMemberFromList(teamMembers);
  return {
    teamMembers,
    teamMemberDesignation: primary.teamMemberDesignation ?? '',
    teamMemberEmail: primary.teamMemberEmail ?? '',
    teamMemberPhone: primary.teamMemberPhone ?? '',
  };
}

function mergeClientLocationSelection<T extends ClientOverviewForm>(
  prev: T,
  selection: LocationSelection,
): T {
  const next: T = {
    ...prev,
    location: selection.location,
    city: selection.city?.trim() ? selection.city : prev.city ?? '',
    country: selection.country?.trim() ? selection.country : prev.country ?? '',
    countryCode: selection.countryCode?.trim() ? selection.countryCode : prev.countryCode ?? '',
    state: selection.state?.trim() ? selection.state : prev.state ?? '',
    latitude: selection.latitude,
    longitude: selection.longitude,
  };
  const autoTimezone = inferTimezoneDisplay({
    country: next.country,
    countryCode: next.countryCode,
    state: next.state,
    city: next.city,
    latitude: next.latitude,
    longitude: next.longitude,
  });
  if (autoTimezone) next.timezone = autoTimezone;
  return next;
}

const JOB_STATUS_STYLES: Record<JobStatus, string> = {
  Open: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Paused: 'bg-amber-100 text-amber-700 border-amber-200',
  Closed: 'bg-slate-100 text-slate-600 border-slate-200',
};

const PIPELINE_STAGES: PipelineStageName[] = ['Applied', 'Screened', 'Interview', 'Offer', 'Joined'];
const PIPELINE_STAGE_STYLES: Record<PipelineStageName, { header: string; border: string }> = {
  Applied: { header: 'bg-slate-100 text-slate-700 border-slate-200', border: 'border-slate-200' },
  Screened: { header: 'bg-blue-100 text-blue-700 border-blue-200', border: 'border-blue-200' },
  Interview: { header: 'bg-amber-100 text-amber-700 border-amber-200', border: 'border-amber-200' },
  Offer: { header: 'bg-emerald-100 text-emerald-700 border-emerald-200', border: 'border-emerald-200' },
  Joined: { header: 'bg-violet-100 text-violet-700 border-violet-200', border: 'border-violet-200' },
};

const PLACEMENT_STATUS_STYLES: Record<PlacementStatus, string> = {
  'Pending Invoice': 'bg-amber-100 text-amber-700 border-amber-200',
  Invoiced: 'bg-blue-100 text-blue-700 border-blue-200',
  Paid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const INVOICE_STATUS_STYLES: Record<InvoiceStatus, string> = {
  Draft: 'bg-slate-100 text-slate-700 border-slate-200',
  Sent: 'bg-blue-100 text-blue-700 border-blue-200',
  Paid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Overdue: 'bg-red-100 text-red-700 border-red-200',
};

const ACTIVITY_CATEGORY_BG: Record<Exclude<ActivityFilterType, 'All'>, string> = {
  Jobs: 'bg-blue-50',
  Candidates: 'bg-emerald-50',
  Interviews: 'bg-amber-50',
  Billing: 'bg-violet-50',
  Notes: 'bg-slate-100',
  Files: 'bg-slate-100',
};

const mapClientActivityCategory = (activity: any): Exclude<ActivityFilterType, 'All'> => {
  const rawCategory = String(activity?.category || '');
  const action = String(activity?.action || '').toLowerCase();
  const description = String(activity?.description || '').toLowerCase();

  if (rawCategory === 'Interviews') return 'Interviews';
  if (rawCategory === 'Candidates') return 'Candidates';
  if (rawCategory === 'Billing') return 'Billing';
  if (rawCategory === 'Notes') return 'Notes';
  if (rawCategory === 'Files') return 'Files';
  if (rawCategory === 'Jobs') return 'Jobs';

  if (action.includes('meeting') || description.includes('meeting')) {
    return 'Interviews';
  }

  if (action.includes('candidate') || description.includes('candidate')) {
    return 'Candidates';
  }

  return 'Jobs';
};

const NOTE_TAG_STYLES: Record<NoteTag, string> = {
  HR: 'bg-blue-100 text-blue-700 border-blue-200',
  Finance: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Contract: 'bg-amber-100 text-amber-700 border-amber-200',
  Feedback: 'bg-violet-100 text-violet-700 border-violet-200',
};

const splitCompanyLinks = (value: string) =>
  value
    .split(/\r?\n|\|/)
    .map((item) => item.trim())
    .filter(Boolean);

const normalizeDisplayValue = (value?: string | null, fallback = '-') => {
  if (!value) return fallback;
  const trimmed = String(value).trim();
  if (!trimmed || trimmed.includes('Ã') || trimmed.includes('â')) return fallback;
  return trimmed;
};

const FILE_TYPE_BADGE_STYLES: Record<ClientFileType, string> = {
  NDA: 'bg-slate-100 text-slate-700 border-slate-200',
  Contract: 'bg-blue-100 text-blue-700 border-blue-200',
  SLA: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Policy: 'bg-amber-100 text-amber-700 border-amber-200',
  Invoice: 'bg-violet-100 text-violet-700 border-violet-200',
  'Job Brief': 'bg-indigo-100 text-indigo-700 border-indigo-200',
};

interface ClientDetailsDrawerProps {
  client: Client | null;
  isAddMode?: boolean;
  /** When true and in add mode, opens the docked AI assistant on mount (from Clients page toggle). */
  initialOpenAiChat?: boolean;
  initialMode?: 'view' | 'edit';
  onClose: () => void;
  onAddJob?: (clientId: string) => void;
  onMessage?: (clientId: string) => void;
  onDelete?: (clientId: string) => void;
  /** Called after create (or logo refresh). Passes the created client when available. */
  onClientCreated?: (client?: BackendClient | null) => void;
  /** Keeps the clients table/list in sync after drawer saves (e.g. lead status). */
  onClientUpdated?: (patch: Partial<Client> & { id: string }) => void;
  onJobCreated?: () => void;
  /** When true, newly created clients are immediately available in Recruitment / Add Job. */
  defaultRecruitmentEnabled?: boolean;
  onSendToRecruitment?: (client: Client) => void;
  sendingToRecruitment?: boolean;
  /**
   * Optional create path (e.g. HQ clients). When set, replaces `apiCreateClient`
   * and skips tenant contact/file uploads that need a CRM session.
   */
  createClientOverride?: (data: CreateClientData) => Promise<BackendClient | undefined | null>;
  /**
   * Optional update path (e.g. HQ clients). When set, replaces `apiUpdateClient`
   * for overview saves and skips tenant contact sync / file uploads.
   */
  updateClientOverride?: (
    clientId: string,
    data: Record<string, unknown>,
  ) => Promise<BackendClient | undefined | null>;
  /** HQ company page — provision a tenant from this client/company. */
  onCreateTenant?: (clientId: string) => void;
  /**
   * Stacking class for backdrop + panel (e.g. `z-[100]` when opened above AI Job Creation).
   * Defaults to `z-50`.
   */
  stackClassName?: string;
}

export function ClientDetailsDrawer({
  client,
  isAddMode: propIsAddMode = false,
  initialOpenAiChat = false,
  initialMode = 'view',
  onClose,
  onAddJob,
  onMessage,
  onDelete,
  onClientCreated,
  onClientUpdated,
  onJobCreated,
  defaultRecruitmentEnabled = false,
  onSendToRecruitment,
  sendingToRecruitment = false,
  createClientOverride,
  updateClientOverride,
  onCreateTenant,
  stackClassName = 'z-50',
}: ClientDetailsDrawerProps) {
  const drawerIsOpen = Boolean(client) || propIsAddMode;
  const clientAiGate = useAiCoinGate('ai.client_chat');
  const isHqOverrideMode = Boolean(createClientOverride || updateClientOverride);
  const assignable = useAssignableMembers(!isHqOverrideMode, 'Clients');
  usePageDrawerLifecycle(drawerIsOpen);
  const [clientPanelPortalReady, setClientPanelPortalReady] = useState(false);
  useEffect(() => {
    setClientPanelPortalReady(true);
  }, []);
  const {
    panelRef: clientDrawerPanelRef,
    requestClose: requestClientDrawerClose,
    markClean: markClientDrawerClean,
  } = useDrawerUnsavedGuard<HTMLDivElement>({
    isOpen: drawerIsOpen,
    onClose,
  });
  const clientFieldVisibility = useClientPageFieldVisibility();
  const [activeTab, setActiveTab] = useState<
    'overview' | 'contacts' | 'jobs' | 'placements' | 'billing' | 'activity' | 'notes' | 'files' | 'schedule' | 'chat'
  >('overview');
  const [orgRecruitmentUiVersion, setOrgRecruitmentUiVersion] = useState(0);

  useEffect(() => {
    const bump = () => setOrgRecruitmentUiVersion((v) => v + 1);
    window.addEventListener(ORG_RECRUITMENT_CACHE_EVENT, bump);
    return () => window.removeEventListener(ORG_RECRUITMENT_CACHE_EVENT, bump);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (activeTab === 'billing' && !isOrgBillingNavEnabled()) {
      setActiveTab('overview');
    }
    if (
      isHqOverrideMode &&
      (activeTab === 'jobs' || activeTab === 'placements' || activeTab === 'billing')
    ) {
      setActiveTab('overview');
    }
  }, [activeTab, orgRecruitmentUiVersion, isHqOverrideMode]);
  const [fullClientData, setFullClientData] = useState<Client | null>(client);
  
  // Fetch full client data when drawer opens to ensure all fields are available
  useEffect(() => {
    if (client?.id && !propIsAddMode) {
      if (isHqOverrideMode) {
        setFullClientData(client);
        return;
      }
      const fetchFullClient = async () => {
        try {
          const response = await apiFetch<BackendClient>(`/clients/${client.id}`, {
            method: 'GET',
            auth: true,
          });
          
          // Log the fetched backend client data
          console.log('\n=== FETCHED BACKEND CLIENT DATA (Frontend) ===');
          console.log(JSON.stringify({
            id: response.data?.id,
            companyName: response.data?.companyName,
            industry: response.data?.industry,
            companySize: response.data?.companySize,
            servicesNeeded: response.data?.servicesNeeded,
            expectedBusinessValue: response.data?.expectedBusinessValue,
            leadStatus: response.data?.leadStatus,
            website: response.data?.website,
            linkedin: response.data?.linkedin,
            location: response.data?.location,
            hiringLocations: response.data?.hiringLocations,
            timezone: response.data?.timezone,
            priority: response.data?.priority,
            sla: response.data?.sla,
            clientSince: response.data?.clientSince,
          }, null, 2));
          
          if (response.data) {
            setFullClientData(mergeBackendClientRecord(client, response.data));
          }
        } catch (error) {
          console.error('Failed to fetch full client data:', error);
          // Keep using the prop client if fetch fails
          setFullClientData(client);
        }
      };
      fetchFullClient();
    } else {
      setFullClientData(client);
    }
  }, [client?.id, propIsAddMode, isHqOverrideMode, client]);

  // Keep drawer view/edit state aligned when the parent list updates (e.g. inline table status).
  useEffect(() => {
    if (!client?.id || propIsAddMode) return;

    const nextStatusLabel = resolveClientStatusLabel(client);

    setFullClientData((prev) => {
      if (!prev || prev.id !== client.id) {
        return client;
      }
      if (
        resolveClientStatusLabel(prev) === nextStatusLabel &&
        (prev.leadStatus || '') === (client.leadStatus || '')
      ) {
        return prev;
      }
      return {
        ...prev,
        stage: client.stage || prev.stage,
        leadStatus: client.leadStatus || prev.leadStatus,
        leadStatusValue: client.leadStatusValue || prev.leadStatusValue,
      };
    });

    setOverviewEditForm((prev) => {
      if (prev.leadStatusValue === nextStatusLabel) return prev;
      return {
        ...prev,
        leadStatusValue: nextStatusLabel,
        status: clientStatusLabelToBackend(nextStatusLabel),
      };
    });
  }, [client?.id, client?.leadStatus, client?.leadStatusValue, client?.stage, propIsAddMode]);

  const DEFAULT_CLIENT_OVERVIEW_SECTIONS: Record<string, boolean> = {
    leadInformation: true,
    other: true,
    agreementsTerms: false,
    kycForm: false,
    companySnapshot: false,
    contactPerson: false,
    relationship: false,
    performance: false,
    health: false,
  };
  const [overviewOpen, setOverviewOpen] = useState<Record<string, boolean>>(
    DEFAULT_CLIENT_OVERVIEW_SECTIONS,
  );
  const isAddMode = propIsAddMode;
  type AddClientTab = 'details' | 'agreements' | 'kyc';
  const ADD_CLIENT_TABS: Array<{
    id: AddClientTab;
    label: string;
    subtitle: string;
    icon: typeof Building2;
  }> = [
    {
      id: 'details',
      label: 'Client Information',
      subtitle: 'Company profile, contacts, and qualification',
      icon: Building2,
    },
    {
      id: 'agreements',
      label: 'Agreements & Terms',
      subtitle: 'Contract terms and agreement documents',
      icon: FileText,
    },
    {
      id: 'kyc',
      label: 'KYC Form',
      subtitle: 'Identity verification and compliance documents',
      icon: Shield,
    },
  ];
  const [addClientTab, setAddClientTab] = useState<AddClientTab>('details');
  const [addClientSectionsOpen, setAddClientSectionsOpen] = useState(DEFAULT_ADD_CLIENT_SECTIONS);
  const toggleAddClientSection = (key: keyof typeof DEFAULT_ADD_CLIENT_SECTIONS) => {
    setAddClientSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    if (!client && !isAddMode) return;
    setOverviewOpen(DEFAULT_CLIENT_OVERVIEW_SECTIONS);
    if (isAddMode) setAddClientTab('details');
  }, [client?.id, isAddMode]);

  const [overviewEditMode, setOverviewEditMode] = useState(isAddMode);
  const timezoneManuallyEditedRef = useRef(false);
  const [overviewEditForm, setOverviewEditForm] = useState<ClientOverviewForm>({
    companyName: '',
    logo: '',
    industry: '',
    companySize: '',
    website: '',
    linkedin: '',
    location: '',
    city: '',
    country: '',
    countryCode: '',
    directorName: '',
    contactEmail: '',
    contactPhone: '',
    contactEmails: [''],
    contactPhones: [''],
    hiringLocations: '',
    timezone: '',
    priority: '' as string,
    servicesNeeded: '',
    expectedBusinessValue: '',
    nextFollowUpDue: '',
    sla: '',
    status: 'ACTIVE' as 'ACTIVE' | 'ON_HOLD' | 'INACTIVE',
    assignedToId: '',
    // Add-Lead-mirroring fields so the Add Client form can share the same widgets.
    /** Multi-link list, mirrors AddLeadFormData. First slot doubles as the legacy `website`. */
    companyLinks: [''] as string[],
    directorSalutation: '' as string,
    designation: '' as string,
    state: '' as string,
    latitude: null as number | null,
    longitude: null as number | null,
    /** Client status label (Active/On Hold/Inactive + org custom). Stored on Client.leadStatus. */
    leadStatusValue: 'Active',
    /** Multi-assignee mirror, matches LeadAssigneesMultiSelect contract. */
    assignedToIds: [] as string[],
    // Agreements & Terms — primary contract/NDA shown on the client overview.
    agreementsFileName: '' as string,
    agreementsFileUrl: '' as string,
    agreementsUploadedAt: '' as string,
    ...emptyAgreementTerms(),
    teamMemberDesignation: '',
    teamMemberEmail: '',
    teamMemberPhone: '',
    teamMembers: normalizeTeamMemberList(),
    dynamicOtherDetails: [],
    postServiceKycForm: emptyPostServiceKycForm(),
    emailNotAvailable: false,
    phoneNotAvailable: false,
    occasions: emptyLeadOccasionForm(),
  });
  const [clientLeadStatusCatalog, setClientLeadStatusCatalog] = useState<string[]>([...DEFAULT_CLIENT_STATUS_LABELS]);
  const [showAddClientLeadStatusInput, setShowAddClientLeadStatusInput] = useState(false);
  const [newClientLeadStatusValue, setNewClientLeadStatusValue] = useState('');
  const [savingClientLeadStatus, setSavingClientLeadStatus] = useState(false);
  const [deletingClientLeadStatus, setDeletingClientLeadStatus] = useState(false);
  const [clientPriorityCatalog, setClientPriorityCatalog] = useState<string[]>([...DEFAULT_CLIENT_PRIORITY_LABELS]);
  const [showAddClientPriorityInput, setShowAddClientPriorityInput] = useState(false);
  const [newClientPriorityValue, setNewClientPriorityValue] = useState('');
  const [savingClientPriority, setSavingClientPriority] = useState(false);
  const [deletingClientPriority, setDeletingClientPriority] = useState(false);
  const [agreementLevelCatalog, setAgreementLevelCatalog] = useState<string[]>([...AGREEMENT_LEVEL_OPTIONS]);
  const [showAddAgreementLevelInput, setShowAddAgreementLevelInput] = useState(false);
  const [newAgreementLevelValue, setNewAgreementLevelValue] = useState('');
  const [savingAgreementLevel, setSavingAgreementLevel] = useState(false);
  const [deletingAgreementLevel, setDeletingAgreementLevel] = useState(false);
  const [extractedAgreementKeys, setExtractedAgreementKeys] = useState<
    Array<keyof AgreementTermsFormValues>
  >([]);
  const extractedAgreementTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clientLeadStatusOptions = useMemo(
    () => mergeCatalogOptions(DEFAULT_CLIENT_STATUS_LABELS, clientLeadStatusCatalog, overviewEditForm.leadStatusValue),
    [clientLeadStatusCatalog, overviewEditForm.leadStatusValue],
  );
  const clientPriorityOptions = useMemo(
    () => mergeCatalogOptions(DEFAULT_CLIENT_PRIORITY_LABELS, clientPriorityCatalog, overviewEditForm.priority),
    [clientPriorityCatalog, overviewEditForm.priority],
  );
  const agreementLevelOptions = useMemo(
    () =>
      mergeCatalogOptions(
        AGREEMENT_LEVEL_OPTIONS,
        agreementLevelCatalog,
        overviewEditForm.agreementLevel,
      ),
    [agreementLevelCatalog, overviewEditForm.agreementLevel],
  );
  const clientLogoInputRef = useRef<HTMLInputElement>(null);
  const agreementsInputRef = useRef<HTMLInputElement>(null);
  const [clientAiChatOpen, setClientAiChatOpen] = useState(false);
  const [clientAiChatHistory, setClientAiChatHistory] = useState<LeadAiChatMessage[]>([]);
  const [addClientAiFlowStage, setAddClientAiFlowStage] = useState<'chat' | 'form' | null>(null);

  const resetClientAiAssistant = useCallback(() => {
    setClientAiChatOpen(false);
    setClientAiChatHistory([]);
    setAddClientAiFlowStage(null);
  }, []);

  const getMissingClientAiFields = useCallback((form: ClientOverviewForm): ClientAiRequiredField[] => {
    const missing: ClientAiRequiredField[] = [];
    if (!form.companyName?.trim()) missing.push('companyName');
    if (!form.directorName?.trim()) missing.push('directorName');
    const email = form.emailNotAvailable
      ? ''
      : primaryContactValue(normalizeContactList(form.contactEmails, form.contactEmail));
    if (!email) {
      if (!form.emailNotAvailable) missing.push('email');
    } else if (!validateClientAiEmail(email).valid) {
      missing.push('email');
    }
    return missing;
  }, []);

  const applyGeneratedClientToForm = useCallback(
    (
      form: ClientOverviewForm,
      generated: NonNullable<Awaited<ReturnType<typeof apiGenerateClientDetails>>['data']>,
    ): ClientOverviewForm => {
      const websiteVal = generated.website?.trim() || '';
      const existingLinks = (form.companyLinks || []).map((l) => String(l || '').trim()).filter(Boolean);
      const companyLinks = websiteVal
        ? [websiteVal, ...existingLinks.filter((l) => l !== websiteVal)]
        : existingLinks.length
          ? existingLinks
          : [''];

      const assignedToId = generated.assignedToId?.trim() || form.assignedToId;
      const leadStatusValue = generated.leadStatus?.trim() || form.leadStatusValue;
      const nextCity = (generated.city || form.city || '').trim();
      const nextState = (() => {
        if (generated.state?.trim()) return generated.state.trim();
        if (form.state?.trim()) return form.state;
        if (!nextCity) return form.state;
        return (
          inferLocationFromCityName(nextCity, {
            country: generated.country || form.country,
            countryCode: form.countryCode,
            state: form.state,
          })?.state || form.state
        );
      })();
      const nextCountryCode = (() => {
        if (form.countryCode?.trim()) return form.countryCode;
        if (!nextCity) return form.countryCode;
        return (
          inferLocationFromCityName(nextCity, {
            country: generated.country || form.country,
            state: nextState,
          })?.countryCode || form.countryCode
        );
      })();
      const primaryEmail = generated.email || form.contactEmail;
      const primaryPhone = generated.phone || form.contactPhone;
      const g = generated as ClientAiGeneratedPayload;
      const teamMemberName = g.teamMemberName?.trim();
      const nextTeamMembers = (() => {
        if (!teamMemberName && !g.teamMemberEmail?.trim() && !g.teamMemberPhone?.trim()) {
          return form.teamMembers;
        }
        const existing = normalizeTeamMemberList(form.teamMembers);
        return normalizeTeamMemberList([
          ...existing,
          {
            teamMemberName: teamMemberName || '',
            teamMemberEmail: g.teamMemberEmail?.trim() || '',
            teamMemberPhone: g.teamMemberPhone?.trim() || '',
            teamMemberDesignation: g.teamMemberDesignation?.trim() || '',
            teamMemberSalutation: '',
          },
        ]);
      })();
      const replacementUnit = String(g.agreementFreeReplacementUnit || '').toUpperCase();
      const agreementFreeReplacementUnit =
        replacementUnit === 'DAYS' || replacementUnit === 'MONTHS'
          ? (replacementUnit as 'DAYS' | 'MONTHS')
          : form.agreementFreeReplacementUnit;

      return {
        ...form,
        companyName: generated.companyName || form.companyName,
        directorSalutation: generated.directorSalutation || form.directorSalutation,
        directorName: generated.directorName || form.directorName,
        designation: generated.designation || form.designation,
        contactEmail: primaryEmail,
        contactPhone: primaryPhone,
        contactEmails: contactListForForm(g.emails, primaryEmail),
        contactPhones: contactListForForm(g.phones, primaryPhone),
        industry: generated.industry || form.industry,
        companySize: generated.companySize || form.companySize,
        website: websiteVal || form.website,
        companyLinks,
        linkedin: generated.linkedIn || form.linkedin,
        location: generated.location || form.location,
        country: generated.country || form.country,
        countryCode: nextCountryCode,
        city: generated.city || form.city,
        state: nextState,
        hiringLocations:
          [nextCity, nextState, generated.country || form.country].filter(Boolean).join(', ') ||
          form.hiringLocations,
        timezone: generated.timezone || form.timezone,
        leadStatusValue,
        status: leadStatusValue ? clientStatusLabelToBackend(leadStatusValue) : form.status,
        priority: generated.priority || form.priority,
        servicesNeeded: generated.servicesNeeded || form.servicesNeeded,
        expectedBusinessValue: generated.expectedBusinessValue || form.expectedBusinessValue,
        nextFollowUpDue: normalizeClientAiDateInput(generated.nextFollowUpDue || form.nextFollowUpDue),
        assignedToId,
        assignedToIds: assignedToId ? [assignedToId] : form.assignedToIds,
        dynamicOtherDetails: Array.isArray(generated.otherDetails)
          ? filterImportedDynamicOtherDetails(generated.otherDetails)
          : form.dynamicOtherDetails,
        teamMembers: nextTeamMembers,
        agreementLevel: g.agreementLevel?.trim() || form.agreementLevel,
        agreementServiceChargePercent:
          g.agreementServiceChargePercent?.trim() || form.agreementServiceChargePercent,
        agreementContractStartDate:
          normalizeClientAiDateInput(g.agreementContractStartDate || form.agreementContractStartDate),
        agreementContractEndDate:
          normalizeClientAiDateInput(g.agreementContractEndDate || form.agreementContractEndDate),
        agreementTimePeriod: g.agreementTimePeriod?.trim() || form.agreementTimePeriod,
        agreementAdvancePaymentPercent:
          g.agreementAdvancePaymentPercent?.trim() || form.agreementAdvancePaymentPercent,
        agreementFreeReplacementValue:
          g.agreementFreeReplacementValue?.trim() || form.agreementFreeReplacementValue,
        agreementFreeReplacementUnit,
        postServiceKycForm: mergeClientAiKycForm(form.postServiceKycForm, g, {
          companyName: generated.companyName || form.companyName,
          directorName: generated.directorName || form.directorName,
          email: primaryEmail,
          phone: primaryPhone,
          website: websiteVal || form.website,
        }),
      };
    },
    [],
  );

  const patchOverviewWithAutoTimezone = useCallback(
    (patch: Partial<ClientOverviewForm>, options?: { forceTimezone?: boolean }) => {
      setOverviewEditForm((prev) => {
        const next = { ...prev, ...patch };
        if (!options?.forceTimezone && timezoneManuallyEditedRef.current) return next;
        const autoTimezone = inferTimezoneDisplay({
          country: next.country,
          countryCode: next.countryCode,
          state: next.state,
          city: next.city,
          latitude: next.latitude,
          longitude: next.longitude,
        });
        if (autoTimezone) next.timezone = autoTimezone;
        return next;
      });
    },
    [],
  );

  const handleApplyClientAiGenerated = useCallback(
    (generated: ClientAiGeneratedPayload, sourceText: string) => {
      const enriched = enrichGeneratedClientFromPrompt(generated, sourceText);
      const nextFormState = applyGeneratedClientToForm(
        overviewEditForm,
        enriched as NonNullable<Awaited<ReturnType<typeof apiGenerateClientDetails>>['data']>,
      );
      patchOverviewWithAutoTimezone(nextFormState, { forceTimezone: true });
      setAddClientSectionsOpen({
        company: true,
        location: true,
        contacts: true,
        qualification: true,
        other: true,
      });
      setOverviewOpen((prev) => ({
        ...prev,
        leadInformation: true,
        other: true,
        agreementsTerms: clientAiHasAgreementData(enriched) || prev.agreementsTerms,
        kycForm: clientAiHasKycData(enriched) || prev.kycForm,
      }));
      if (clientAiHasKycData(enriched)) setAddClientTab('kyc');
      else if (clientAiHasAgreementData(enriched)) setAddClientTab('agreements');
      else setAddClientTab('details');
    },
    [overviewEditForm, applyGeneratedClientToForm, patchOverviewWithAutoTimezone],
  );

  const isCreateClientDisabled = useMemo(() => {
    return getMissingClientAiFields(overviewEditForm).length > 0;
  }, [overviewEditForm, getMissingClientAiFields]);

  const [uploadingClientLogo, setUploadingClientLogo] = useState(false);
  /** Pending file selected while editing — uploaded after Save (Add) or immediately on Save (Edit). */
  const [pendingAgreementsFile, setPendingAgreementsFile] = useState<File | null>(null);
  const [pendingKycFiles, setPendingKycFiles] = useState<File[]>([]);
  const [pendingPostServiceKycFiles, setPendingPostServiceKycFiles] = useState<PendingPostServiceKycFiles>(
    () => createEmptyPendingPostServiceKycFiles(),
  );
  const [removedPostServiceKycFileIds, setRemovedPostServiceKycFileIds] = useState<string[]>([]);
  const [uploadingAgreements, setUploadingAgreements] = useState(false);
  const [uploadingKyc, setUploadingKyc] = useState(false);
  const agreementsUploadFeedback = useDocumentUploadFeedback(uploadingAgreements);
  const kycUploadFeedback = useDocumentUploadFeedback(uploadingKyc);
  const [pendingClientLogoFile, setPendingClientLogoFile] = useState<File | null>(null);
  const [pendingClientLogoPreview, setPendingClientLogoPreview] = useState('');
  const setPendingPostServiceKycFilesForField = useCallback(
    (field: PostServiceKycAttachmentFieldKey, files: File[]) => {
      setPendingPostServiceKycFiles((prev) => ({ ...prev, [field]: files }));
    },
    [],
  );
  const uploadPendingPostServiceKycFiles = useCallback(
    async (clientId: string, currentForm: PostServiceKycFormValues) => {
      let nextForm = currentForm;

      for (const field of POST_SERVICE_KYC_ATTACHMENT_FIELDS) {
        const files = pendingPostServiceKycFiles[field];
        if (!files.length) continue;
        const uploaded = await uploadKycDocuments('client', clientId, files);
        nextForm = appendPostServiceKycFiles(
          nextForm,
          field,
          uploaded.map(postServiceKycFileRefFromEntityFile),
        );
      }

      return nextForm;
    },
    [pendingPostServiceKycFiles],
  );
  const removeStoredPostServiceKycFile = useCallback(
    (field: PostServiceKycAttachmentFieldKey, fileId: string) => {
      setRemovedPostServiceKycFileIds((prev) => (prev.includes(fileId) ? prev : [...prev, fileId]));
      setOverviewEditForm((prev) => ({
        ...prev,
        postServiceKycForm: removePostServiceKycStoredFile(prev.postServiceKycForm, field, fileId),
      }));
    },
    [],
  );
  /** Tracks an explicit "Remove logo" intent so the preview hides the existing
   *  `client.logo` / `fullClientData.logo` until the user picks a new file or
   *  cancels the edit. Without this the preview falls back to the saved logo
   *  and the Remove button appears to do nothing. */
  const [logoRemoved, setLogoRemoved] = useState(false);
  const uploadsBase = (
    typeof window !== 'undefined'
      ? process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1'
      : 'http://localhost:5001/api/v1'
  ).replace(/\/api\/v1\/?$/, '');

  useEffect(() => {
    return () => {
      if (pendingClientLogoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(pendingClientLogoPreview);
      }
    };
  }, [pendingClientLogoPreview]);
  const [selectedContact, setSelectedContact] = useState<ClientContact | null>(null);
  const [showAddContactForm, setShowAddContactForm] = useState(false);
  const [addContactDeptOpen, setAddContactDeptOpen] = useState(false);
  const [users, setUsers] = useState<BackendUser[]>([]);
  /** Raw TeamMember list backing the Add-Lead-style multi-assignee picker on the Add Client form. */
  const [recruiters, setRecruiters] = useState<TeamMember[]>([]);
  const [assignedToDropdownOpen, setAssignedToDropdownOpen] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  /** Mirrors LeadDetailsDrawer.loadingRecruiters so the multi-select shows its spinner. */
  const loadingRecruiters = loadingUsers;
  const [clientJobs, setClientJobs] = useState<ClientJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [clientContacts, setClientContacts] = useState<ClientContact[]>([]);
  const [clientTeamMemberContacts, setClientTeamMemberContacts] = useState<BackendContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [addContactForm, setAddContactForm] = useState({
    fullName: '',
    designation: '',
    department: '' as string,
    email: '',
    phone: '',
    whatsAppSameAsPhone: true,
    isPrimary: false,
    notes: '',
  });
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [contactToDelete, setContactToDelete] = useState<ClientContact | null>(null);
  const [deletingContact, setDeletingContact] = useState(false);

  const ADD_CONTACT_DEPARTMENTS = ['HR', 'Hiring Manager', 'Finance', 'Other'];

  const resetContactForm = () => {
    setAddContactForm({
      fullName: '',
      designation: '',
      department: '',
      email: '',
      phone: '',
      whatsAppSameAsPhone: true,
      isPrimary: false,
      notes: '',
    });
  };

  const openAddContactForm = () => {
    setEditingContactId(null);
    resetContactForm();
    setShowAddContactForm(true);
    setAddContactDeptOpen(false);
  };

  const mapBackendContactToClientContact = useCallback((contact: BackendContact): ClientContact => {
    return {
      id: contact.id,
      name: `${contact.firstName} ${contact.lastName}`.trim(),
      designation: contact.designation || contact.title || '',
      department: (contact.department as ClientContact['department']) || 'Other',
      email: contact.email || '',
      phone: contact.phone || '',
      isPrimary: contact.isPrimary || false,
      lastContacted: contact.lastContacted
        ? formatDateDMY(contact.lastContacted)
        : 'Never',
      avatar: contact.avatar || undefined,
      preferredChannel: (contact.preferredChannel as ClientContact['preferredChannel']) || undefined,
      notes:
        contact.notesText ||
        (Array.isArray(contact.notes)
          ? contact.notes.map((note) => note.note).filter(Boolean).join('\n') || undefined
          : undefined),
      activity: [],
    };
  }, []);

  const refreshClientContacts = useCallback(async () => {
    if (!client?.id) {
      setClientContacts([]);
      setClientTeamMemberContacts([]);
      return;
    }

    // HQ companies have no tenant contacts collection — synthesize primary contact from row.
    if (isHqOverrideMode) {
      const director = directorFromOtherDetails(client.otherDetails);
      const name =
        director.directorName ||
        client.teamMemberDesignation ||
        client.name ||
        'Primary contact';
      const email =
        (Array.isArray(client.emails) && client.emails[0]) ||
        client.teamMemberEmail ||
        '';
      const phone =
        (Array.isArray(client.phones) && client.phones[0]) ||
        client.teamMemberPhone ||
        '';
      const synthetic: ClientContact = {
        id: `hq-primary-${client.id}`,
        name,
        designation: 'Director',
        department: 'Other',
        email: email && !String(email).includes('@placeholder.local') ? email : '',
        phone: phone || '',
        isPrimary: true,
        lastContacted: 'Never',
        activity: [],
      };
      setClientContacts(email || phone || director.directorName ? [synthetic] : []);
      setClientTeamMemberContacts([]);
      setLoadingContacts(false);
      return;
    }

    setLoadingContacts(true);
    try {
      const response = await apiGetContacts({ clientId: client.id, type: 'CLIENT' });
      const contactsList = Array.isArray(response.data)
        ? response.data
        : (response.data as any)?.data || (response.data as any)?.items || [];
      const mappedContacts: ClientContact[] = contactsList.map((contact: BackendContact) =>
        mapBackendContactToClientContact(contact)
      );
      setClientContacts(mappedContacts);
      setClientTeamMemberContacts(
        contactsList.filter((contact: BackendContact) => isClientTeamMemberContact(contact)),
      );

      setSelectedContact((prev) => {
        if (!prev) return prev;
        return mappedContacts.find((c) => c.id === prev.id) || null;
      });
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
      setClientContacts([]);
      setClientTeamMemberContacts([]);
    } finally {
      setLoadingContacts(false);
    }
  }, [client, isHqOverrideMode, mapBackendContactToClientContact]);

  const syncClientTeamMemberContacts = useCallback(async (
    clientId: string,
    ownerId: string | undefined,
    teamName: string,
    members: TeamMemberListItem[],
    primaryEmail?: string,
    directorContactId?: string,
  ) => {
    let resolvedDirectorContactId = directorContactId;
    if (!resolvedDirectorContactId) {
      try {
        const response = await apiGetContacts({ clientId, type: 'CLIENT' });
        const contactsList = Array.isArray(response.data)
          ? response.data
          : (response.data as { data?: BackendContact[]; items?: BackendContact[] })?.data
            || (response.data as { items?: BackendContact[] })?.items
            || [];
        resolvedDirectorContactId = resolveDirectorBackendContact(contactsList)?.id;
      } catch {
        resolvedDirectorContactId = undefined;
      }
    }

    const normalizeEmail = (value?: string | null) => String(value || '').trim().toLowerCase();
    const normalizedTeamName = String(teamName || '').trim();
    const rawMembers = normalizeTeamMemberList(members).filter(teamMemberHasAnyValue);
    const teamContactIds = new Set(clientTeamMemberContacts.map((contact) => contact.id));
    const reservedEmails = new Set(
      [
        normalizeEmail(primaryEmail),
        ...clientContacts
          .filter((contact) => !teamContactIds.has(contact.id))
          .map((contact) => normalizeEmail(contact.email)),
      ].filter(Boolean),
    );
    const seenTeamEmails = new Set<string>();
    let skippedDuplicateEmails = false;
    const normalizedMembers = rawMembers.filter((member) => {
      const email = normalizeEmail(member.teamMemberEmail);
      if (!email) return true;
      if (reservedEmails.has(email) || seenTeamEmails.has(email)) {
        skippedDuplicateEmails = true;
        return false;
      }
      seenTeamEmails.add(email);
      return true;
    });
    const keptIds = new Set(
      normalizedMembers
        .map((member) => String(member.id || '').trim())
        .filter((id) => id && id !== resolvedDirectorContactId),
    );

    for (const contact of clientTeamMemberContacts) {
      if (resolvedDirectorContactId && contact.id === resolvedDirectorContactId) continue;
      if (!keptIds.has(contact.id)) {
        await apiDeleteContact(contact.id);
      }
    }

    for (let index = 0; index < normalizedMembers.length; index += 1) {
      const member = normalizedMembers[index];
      const memberContactId =
        member.id && resolvedDirectorContactId && member.id === resolvedDirectorContactId
          ? undefined
          : member.id;
      const memberName = String(member.teamMemberName || '').trim()
        || String(member.teamMemberDesignation || '').trim();
      const [firstName = '', ...lastParts] = memberName.split(/\s+/).filter(Boolean);
      const payload: Partial<CreateContactData> = {
        salutation: member.teamMemberSalutation?.trim() || undefined,
        firstName: firstName || `Team Member ${index + 1}`,
        lastName: lastParts.join(' '),
        email: member.teamMemberEmail?.trim() || undefined,
        phone: member.teamMemberPhone?.trim() || undefined,
        designation: memberName || 'Team Member',
        companyId: clientId,
        ownerId: ownerId || undefined,
        isPrimary: false,
        contactType: 'CLIENT',
        department: 'Other',
        notes: normalizedTeamName ? `Team: ${normalizedTeamName}` : 'Team member',
        tags: [CLIENT_TEAM_MEMBER_TAG],
      };

      if (memberContactId) {
        await apiUpdateContact(memberContactId, payload);
      } else {
        const created = await apiCreateContact(payload as CreateContactData);
        if ((created as any)?.data?.duplicate || (created as any)?.duplicate) {
          skippedDuplicateEmails = true;
        }
      }
    }

    await refreshClientContacts();
    if (skippedDuplicateEmails) {
      void requestWarning('Skipped duplicate team member emails that already belong to another contact.');
    }
  }, [clientContacts, clientTeamMemberContacts, refreshClientContacts]);

  const syncPrimaryClientContact = useCallback(async (
    clientId: string,
    options: {
      contactId?: string;
      directorName: string;
      salutation?: string;
      email?: string;
      phone?: string;
      location?: string;
      ownerId?: string;
    },
  ) => {
    const normalizeEmail = (value?: string) => String(value || '').trim().toLowerCase();
    const email = normalizeEmail(options.email);
    const [firstName = '', ...lastParts] = options.directorName.trim().split(/\s+/).filter(Boolean);
    const payload: CreateContactData = {
      salutation: options.salutation?.trim() || undefined,
      firstName: firstName || 'Unknown',
      lastName: lastParts.join(' '),
      email: email || undefined,
      phone: options.phone?.trim() || undefined,
      location: options.location || undefined,
      designation: 'Director',
      companyId: clientId,
      ownerId: options.ownerId || undefined,
      isPrimary: true,
      contactType: 'CLIENT',
    };

    const updateExisting = async (contactId: string, includeEmail: boolean) => {
      await apiUpdateContact(contactId, {
        ...payload,
        email: includeEmail && email ? email : undefined,
      });
    };

    const resolveExistingContactId = async (): Promise<string | undefined> => {
      if (options.contactId) return options.contactId;
      try {
        const response = await apiGetContacts({ clientId, type: 'CLIENT' });
        const contactsList = Array.isArray(response.data)
          ? response.data
          : (response.data as { data?: BackendContact[]; items?: BackendContact[] })?.data
            || (response.data as { items?: BackendContact[] })?.items
            || [];
        return resolveDirectorBackendContact(contactsList)?.id;
      } catch {
        return undefined;
      }
    };

    const existingId = await resolveExistingContactId();
    if (existingId) {
      try {
        await updateExisting(existingId, true);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message.toLowerCase() : '';
        if (message.includes('email already exists')) {
          await updateExisting(existingId, false);
        } else {
          throw error;
        }
      }
      await refreshClientContacts();
      return;
    }

    if (!options.directorName.trim() && !email && !options.phone?.trim()) {
      return;
    }

    if (email) {
      try {
        const dupResponse = await apiDetectContactDuplicates(email);
        const duplicates = dupResponse.data?.duplicates || [];
        const emailMatch =
          duplicates.find((item: { match: string; contact: BackendContact }) => item.match === 'email')?.contact ||
          duplicates[0]?.contact;
        if (emailMatch) {
          if (String(emailMatch.companyId || '') === String(clientId)) {
            await updateExisting(emailMatch.id, true);
            await refreshClientContacts();
            return;
          }
          await apiCreateContact({
            ...payload,
            email: `client-${clientId}-director@placeholder.local`,
          });
          await refreshClientContacts();
          return;
        }
      } catch {
        /* fall through to create */
      }
    }

    try {
      await apiCreateContact(payload);
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string; data?: { existingContact?: { id?: string; companyId?: string | null } } };
      if (err.status === 409 && err.data?.existingContact) {
        const existing = err.data.existingContact;
        if (String(existing.companyId || '') === String(clientId) && existing.id) {
          await updateExisting(existing.id, true);
          await refreshClientContacts();
          return;
        }
        await apiCreateContact({
          ...payload,
          email: `client-${clientId}-director@placeholder.local`,
        });
        await refreshClientContacts();
        return;
      }
      const message = typeof err.message === 'string' ? err.message.toLowerCase() : '';
      if (message.includes('duplicate contact')) {
        await refreshClientContacts();
        return;
      }
      throw error;
    }
    await refreshClientContacts();
  }, [refreshClientContacts]);

  const handleEditContactClick = (contact: ClientContact) => {
    setEditingContactId(contact.id);
    setAddContactForm({
      fullName: contact.name || '',
      designation: contact.designation || '',
      department: contact.department || '',
      email: contact.email || '',
      phone: contact.phone || '',
      whatsAppSameAsPhone: true,
      isPrimary: Boolean(contact.isPrimary),
      notes: contact.notes || '',
    });
    setShowAddContactForm(true);
    setAddContactDeptOpen(false);
  };

  const handleWhatsAppClick = (contact: ClientContact) => {
    const digits = (contact.phone || '').replace(/\D/g, '');
    if (!digits) {
      void requestWarning('No phone number available for this contact.');
      return;
    }
    const url = `https://wa.me/${digits}?text=${encodeURIComponent(`Hi ${contact.name || ''}`.trim())}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleEmailClick = (contact: ClientContact) => {
    if (!contact.email) {
      void requestWarning('No email available for this contact.');
      return;
    }
    const subject = encodeURIComponent(`Hello ${contact.name || ''}`.trim());
    const body = encodeURIComponent(`Hi ${contact.name || ''},\n\n`);
    const mailto = `mailto:${contact.email}?subject=${subject}&body=${body}`;
    window.open(mailto, '_blank', 'noopener,noreferrer');
  };

  const handleDeleteContact = async () => {
    if (!contactToDelete) return;
    try {
      setDeletingContact(true);
      await apiDeleteContact(contactToDelete.id);
      setContactToDelete(null);
      await refreshClientContacts();
    } catch (error: any) {
      console.error('Failed to delete contact:', error);
      void requestError(error.message || 'Failed to delete contact');
    } finally {
      setDeletingContact(false);
    }
  };

  const [createJobDrawerOpen, setCreateJobDrawerOpen] = useState(false);
  const [duplicateFromJobId, setDuplicateFromJobId] = useState<string | null>(null);

  const [selectedJobForDrawer, setSelectedJobForDrawer] = useState<JobForDrawer | null>(null);
  const [jobDetailsOpen, setJobDetailsOpen] = useState(false);
  const [jobCandidatesForDrawer, setJobCandidatesForDrawer] = useState<any[]>([]);
  const [jobPipelineStagesForDrawer, setJobPipelineStagesForDrawer] = useState<any[] | undefined>(undefined);

  const { hasAnyPermission } = usePermissions();
  const canCreateJob = hasAnyPermission(['jobs_create', 'create_job']);
  const canViewClientAgreements =
    isHqOverrideMode || hasAnyPermission(['agreements_read', 'agreements_manage']);
  const canManageClientAgreements =
    isHqOverrideMode || hasAnyPermission(['agreements_manage']);
  const addClientTabs = ADD_CLIENT_TABS.filter(
    (tab) => tab.id !== 'agreements' || canManageClientAgreements,
  );

  useEffect(() => {
    if (addClientTab === 'agreements' && !canManageClientAgreements) {
      setAddClientTab('details');
    }
  }, [addClientTab, canManageClientAgreements]);

  const openCreateJobDrawer = async () => {
    if (!canCreateJob) {
      toast.error("You don't have permission to create jobs.");
      return;
    }
    if (client?.id && !client.recruitmentEnabled && !isHqOverrideMode) {
      try {
        await apiSendClientToRecruitment(client.id);
        onClientUpdated?.({ id: client.id, recruitmentEnabled: true });
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : 'Could not send this client to Recruitment.');
        return;
      }
    }
    setActiveTab('jobs');
    setDuplicateFromJobId(null);
    setCreateJobDrawerOpen(true);
  };

  const openDuplicateJobDrawer = (job: ClientJob) => {
    if (!canCreateJob) {
      toast.error("You don't have permission to create jobs.");
      return;
    }
    setActiveTab('jobs');
    setDuplicateFromJobId(String(job.id));
    setCreateJobDrawerOpen(true);
  };

  const handlePauseJob = async (job: ClientJob) => {
    if (!client?.id) return;
    try {
      await apiUpdateJob(String(job.id), {
        title: job.title,
        clientId: client.id,
        status: 'ON_HOLD',
      });
      await refreshClientJobs();
      void requestSuccess('Job paused successfully.');
    } catch (error: any) {
      console.error('Failed to pause job:', error);
      void requestError(error?.message || 'Failed to pause job');
    }
  };

  const openJobDrawerFromClientJob = async (job: ClientJob) => {
    const statusMap: Record<string, any> = {
      Open: 'Active',
      Paused: 'On Hold',
      Closed: 'Closed',
    };

    // eslint-disable-next-line no-console
    console.log('openJobDrawerFromClientJob mapping job', job);
    const mapped: JobForDrawer = {
      id: String(job.id),
      title: job.title,
      client: fullClientData?.name || client?.name || '',
      location: job.location || 'Not specified',
      status: (statusMap[job.status] || 'Active') as any,
      employmentType: (job as any).employmentType || undefined,
      salaryRange: (job as any).salaryRange || undefined,
      postedDate: job.createdDate || undefined,
      recruiter: job.hiringManager || undefined,
      hiringManager: job.hiringManager || undefined,
      applied: (job as any).applied || 0,
      interviewed: (job as any).interviewed || 0,
      offered: (job as any).offered || 0,
      joined: (job as any).joined || 0,
      openings: job.openings || 0,
      owner: job.hiringManager || '',
      createdDate: job.createdDate || '',
    };

    // Fetch full job details from API (to get candidates, pipeline, etc.)
    try {
      const res = await apiGetJob(String(job.id));
      const full = res.data;
      if (full) {
        // map matches -> JobCandidateItem
        const candidates = (full.matches || []).map((m: any) => ({
          id: m.candidate?.id || m.candidateId || String(m.id),
          candidateName: `${m.candidate?.firstName || ''} ${m.candidate?.lastName || ''}`.trim(),
          currentStage: (m.candidate?.stage || m.stage) || '',
          score: m.score ?? '',
          recruiter: m.recruiter?.name || m.candidate?.recruiter?.name || '',
          interviewStatus: m.interviewStatus || '',
          lastActivity: m.updatedAt || m.createdAt || '',
        }));

        setJobCandidatesForDrawer(candidates);
        setJobPipelineStagesForDrawer(full.pipelineStages ?? undefined);
        setSelectedJobForDrawer(mapped);
        // eslint-disable-next-line no-console
        console.log('opening JobDetailsDrawer for', mapped?.id, 'candidates', candidates.length);
        setJobDetailsOpen(true);
        return;
      }
    } catch (err) {
      // ignore and fallback to minimal mapped job
      // eslint-disable-next-line no-console
      console.warn('Failed to fetch full job details', err);
    }

    setSelectedJobForDrawer(mapped);
    // eslint-disable-next-line no-console
    console.log('opening JobDetailsDrawer for', mapped?.id);
    setJobDetailsOpen(true);
  };

  // Schedule Meeting / Follow-up state
  const [showScheduleMeetingForm, setShowScheduleMeetingForm] = useState(false);
  const [scheduleMeetingForm, setScheduleMeetingForm] = useState({
    meetingType: '',
    date: '',
    time: '',
    reminder: '',
    notes: '',
  });
  const [meetingTypeDropdownOpen, setMeetingTypeDropdownOpen] = useState(false);
  const [reminderDropdownOpen, setReminderDropdownOpen] = useState(false);
  const [scheduledMeetings, setScheduledMeetings] = useState<ScheduledMeeting[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [meetingStatusFilter, setMeetingStatusFilter] = useState<'All' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'>('All');
  
  const MEETING_TYPES = ['Call', 'WhatsApp', 'Email', 'Meeting', 'Follow-up'];
  const REMINDER_OPTIONS = ['10 minutes before', '30 minutes before', '1 hour before', '1 day before'];

  // Pipeline configuration state (similar to JobDetailsDrawer)
  interface ClientPipelineStage {
    id: string;
    name: string;
    sla?: string;
  }

  const DEFAULT_CLIENT_PIPELINE_STAGES: ClientPipelineStage[] = [
    { id: 's1', name: 'Applied', sla: '2 days' },
    { id: 's2', name: 'Screened', sla: '3 days' },
    { id: 's3', name: 'Interview', sla: '5 days' },
    { id: 's4', name: 'Offer', sla: '7 days' },
    { id: 's5', name: 'Joined', sla: '' },
  ];

  const [pipelineStages, setPipelineStages] = useState<ClientPipelineStage[]>(DEFAULT_CLIENT_PIPELINE_STAGES);
  const [draggedStageId, setDraggedStageId] = useState<string | null>(null);

  const handlePipelineReorder = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const next = [...pipelineStages];
    const [removed] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, removed);
    setPipelineStages(next);
  };

  const handleAddStage = () => {
    const next = [...pipelineStages, { id: `s-${Date.now()}`, name: 'New stage', sla: '' }];
    setPipelineStages(next);
  };

  const handleRemoveStage = (id: string) => {
    const next = pipelineStages.filter((s) => s.id !== id);
    setPipelineStages(next);
  };

  const handleStageNameChange = (id: string, name: string) => {
    const next = pipelineStages.map((s) => (s.id === id ? { ...s, name } : s));
    setPipelineStages(next);
  };

  const handleStageSlaChange = (id: string, sla: string) => {
    const next = pipelineStages.map((s) => (s.id === id ? { ...s, sla } : s));
    setPipelineStages(next);
  };

  const [activityFilter, setActivityFilter] = useState<ActivityFilterType>('All');
  const [clientActivities, setClientActivities] = useState<ClientActivityItem[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  const ACTIVITY_TIMELINE_FILTERS: ActivityFilterType[] = ['All', 'Jobs', 'Candidates', 'Interviews', 'Billing', 'Notes', 'Files'];

  const [notesTagFilter, setNotesTagFilter] = useState<NoteTag | 'All'>('All');
  const NOTE_TAG_OPTIONS: (NoteTag | 'All')[] = ['All', 'HR', 'Finance', 'Contract', 'Feedback'];
  const [pinnedNoteIds, setPinnedNoteIds] = useState<Set<string>>(new Set());

  const [filesTypeFilter, setFilesTypeFilter] = useState<ClientFileType | 'All'>('All');
  const FILE_TYPE_OPTIONS: (ClientFileType | 'All')[] = ['All', 'NDA', 'Contract', 'SLA', 'Policy', 'Invoice', 'Job Brief'];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    files: clientFiles,
    loading: filesLoading,
    uploading: filesUploading,
    uploadSuccess: filesUploadSuccess,
    uploadPercent: filesUploadPercent,
    error: filesError,
    uploadFile,
    deleteFile,
    refresh: refetchClientFiles,
  } = useFiles('client', isHqOverrideMode ? null : client?.id);
  const clientKycFiles = useMemo(() => filterKycFiles(clientFiles), [clientFiles]);

  const [showChangeStageForm, setShowChangeStageForm] = useState(false);
  const [changeStageDropdownOpen, setChangeStageDropdownOpen] = useState(false);
  const [changeStageReasonDropdownOpen, setChangeStageReasonDropdownOpen] = useState(false);
  const [changeStageForm, setChangeStageForm] = useState<{ stage: ClientStage; reason: string }>({ stage: 'Active', reason: '' });

  const CLIENT_STAGES: ClientStage[] = ['Active', 'On Hold', 'Inactive', 'Hot Clients 🔥'];
  const STAGE_REASONS = ['Hiring paused', 'No response', 'Contract ended', 'Payment issue', 'Other'];
  const needsReason = changeStageForm.stage === 'On Hold' || changeStageForm.stage === 'Inactive';

  const openChangeStageForm = () => {
    setChangeStageForm({ stage: client?.stage ?? 'Active', reason: '' });
    setChangeStageDropdownOpen(false);
    setChangeStageReasonDropdownOpen(false);
    setShowChangeStageForm(true);
  };

  const closeChangeStageForm = () => {
    setShowChangeStageForm(false);
    setChangeStageDropdownOpen(false);
    setChangeStageReasonDropdownOpen(false);
  };

  const [showArchiveClientForm, setShowArchiveClientForm] = useState(false);

  const openArchiveClientForm = () => {
    setShowArchiveClientForm(true);
  };

  const closeArchiveClientForm = () => setShowArchiveClientForm(false);

  const [showDeleteClientForm, setShowDeleteClientForm] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');

  const openDeleteClientForm = () => {
    setDeleteConfirmName('');
    setShowDeleteClientForm(true);
  };

  const closeDeleteClientForm = () => {
    setShowDeleteClientForm(false);
    setDeleteConfirmName('');
  };

  const deleteConfirmMatches = deleteConfirmName.trim() === (client?.name ?? '');

  const [showSendMessageForm, setShowSendMessageForm] = useState(false);
  const [sendMessageChannel, setSendMessageChannel] = useState<'Email' | 'WhatsApp'>('Email');
  const [sendMessageTemplateOpen, setSendMessageTemplateOpen] = useState(false);
  const [sendMessageForm, setSendMessageForm] = useState({
    contactIds: [] as string[],
    templateId: '',
    message: '',
    attachmentNames: '',
    logAsActivity: true,
  });
  const MESSAGE_TEMPLATES = [
    { id: 'follow-up', label: 'Follow-up' },
    { id: 'placement-confirm', label: 'Placement confirmation' },
    { id: 'invoice-reminder', label: 'Invoice reminder' },
    { id: 'custom', label: 'Custom' },
  ];

  const openSendMessageForm = () => {
    setSendMessageForm({
      contactIds: [],
      templateId: '',
      message: '',
      attachmentNames: '',
      logAsActivity: true,
    });
    setSendMessageChannel('Email');
    setSendMessageTemplateOpen(false);
    setShowSendMessageForm(true);
  };

  const closeSendMessageForm = () => {
    setShowSendMessageForm(false);
    setSendMessageTemplateOpen(false);
  };

  const toggleSendMessageContact = (contactId: string) => {
    setSendMessageForm((prev) =>
      prev.contactIds.includes(contactId)
        ? { ...prev, contactIds: prev.contactIds.filter((id) => id !== contactId) }
        : { ...prev, contactIds: [...prev.contactIds, contactId] }
    );
  };

  const toggleOverviewSection = (key: string) => {
    setOverviewOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const clientLogoPreview = pendingClientLogoPreview
    ? pendingClientLogoPreview
    : logoRemoved
      ? ''
      : overviewEditForm.logo ||
        // Prefer fullClientData over the (potentially stale) `client` prop when
        // it's loaded so an explicit logo removal isn't masked by the parent's
        // cached value.
        (fullClientData ? fullClientData.logo || '' : client?.logo || '');

  const getClientLogoSrc = (logoUrl: string) => {
    const trimmed = String(logoUrl || '').trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) return trimmed;
    return buildFileHref(trimmed, uploadsBase);
  };

  const resetClientLogoDraft = () => {
    setPendingClientLogoFile(null);
    setPendingClientLogoPreview('');
    setLogoRemoved(false);
  };

  /** User clicked "Remove" on the logo preview: drop any pending upload draft
   *  and flag the existing logo as removed so the fallback doesn't reshow it. */
  const markClientLogoRemoved = () => {
    if (pendingClientLogoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(pendingClientLogoPreview);
    }
    setPendingClientLogoFile(null);
    setPendingClientLogoPreview('');
    setOverviewEditForm((prev) => ({ ...prev, logo: '' }));
    setLogoRemoved(true);
  };

  const syncClientLogoLocally = (logoUrl: string) => {
    setOverviewEditForm((prev) => ({ ...prev, logo: logoUrl }));
    setFullClientData((prev) => (prev ? { ...prev, logo: logoUrl } : prev));
  };

  const handleClientLogoFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      void requestWarning('Please choose an image file (PNG, JPG, WebP, etc.)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      void requestWarning('Image must be 5MB or smaller.');
      return;
    }

    if (isAddMode || !client?.id) {
      const previewUrl = URL.createObjectURL(file);
      if (pendingClientLogoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(pendingClientLogoPreview);
      }
      setPendingClientLogoFile(file);
      setPendingClientLogoPreview(previewUrl);
      setOverviewEditForm((prev) => ({ ...prev, logo: previewUrl }));
      setLogoRemoved(false);
      return;
    }

    try {
      setUploadingClientLogo(true);
      let logoUrl = '';
      if (isHqOverrideMode) {
        const uploadResponse = await apiHqUploadCompanyLogo(client.id, file);
        logoUrl = String(uploadResponse.data?.logo || uploadResponse.data?.company?.logo || '').trim();
      } else {
        const uploadResponse = await filesApiUpload('client', client.id, file, 'LOGO');
        logoUrl = String(uploadResponse.data?.fileUrl || '').trim();
        if (logoUrl) {
          await apiUpdateClient(client.id, { logo: logoUrl });
        }
      }
      if (!logoUrl) {
        throw new Error('Upload succeeded but no image URL was returned.');
      }

      if (pendingClientLogoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(pendingClientLogoPreview);
      }
      setPendingClientLogoFile(null);
      setPendingClientLogoPreview('');
      syncClientLogoLocally(logoUrl);
      setLogoRemoved(false);
      onClientUpdated?.({ id: client.id, logo: logoUrl });
      toast.success('Client image updated');
    } catch (error: any) {
      console.error('Failed to upload client logo:', error);
      void requestError(error.message || 'Failed to upload client logo');
    } finally {
      setUploadingClientLogo(false);
    }
  };

  const startOverviewEdit = async () => {
    if (!client) return;
    
    // Fetch full client data AND latest contacts in parallel so the edit form
    // is always seeded with the freshest values. Reading `primaryClientContact`
    // straight from state can return stale/empty values if contacts haven't
    // finished loading by the time the user clicks Edit (or when the drawer
    // opens with `initialMode === 'edit'`), causing email/phone to render blank.
    // HQ override mode stores clients in headquarters DB — never hit tenant /clients/:id.
    let fetchedClient: BackendClient | null = null;
    let assignedToId = '';
    let fetchedContacts: BackendContact[] = [];
    if (isHqOverrideMode) {
      assignedToId = client.assignedToId || '';
      if (!assignedToId && client.owner?.name && users.length > 0) {
        const matchedUser = users.find((u) => u.name === client.owner?.name);
        if (matchedUser) assignedToId = matchedUser.id;
      }
      fetchedContacts = clientContacts.length
        ? (clientContacts.map((c) => ({
            id: c.id,
            firstName: c.name?.split(/\s+/)[0] || c.name || '',
            lastName: c.name?.split(/\s+/).slice(1).join(' ') || '',
            email: c.email || '',
            phone: c.phone || '',
            designation: c.designation || '',
            isPrimary: Boolean(c.isPrimary),
          })) as BackendContact[])
        : [];
    } else {
      try {
        const [clientRes, contactsRes] = await Promise.all([
          apiFetch<BackendClient>(`/clients/${client.id}`, {
            method: 'GET',
            auth: true,
          }),
          apiGetContacts({ clientId: client.id, type: 'CLIENT' }).catch((error) => {
            console.error('Failed to fetch contacts for edit form:', error);
            return null;
          }),
        ]);
        fetchedClient = clientRes.data;
        assignedToId = fetchedClient?.assignedTo?.id || '';
        if (contactsRes) {
          const raw = contactsRes.data as any;
          fetchedContacts = Array.isArray(raw)
            ? raw
            : raw?.data || raw?.items || [];
        }
      } catch (error) {
        console.error('Failed to fetch client details:', error);
        if (client.owner?.name && users.length > 0) {
          const matchedUser = users.find((u) => u.name === client.owner?.name);
          if (matchedUser) {
            assignedToId = matchedUser.id;
          }
        }
      }
    }
    
    // Push fresh contacts into state so view mode and Contacts tab stay in sync.
    if (fetchedContacts.length) {
      setClientContacts(fetchedContacts.map(mapBackendContactToClientContact));
      setClientTeamMemberContacts(
        fetchedContacts.filter((contact) => isClientTeamMemberContact(contact)),
      );
    } else if (!isHqOverrideMode) {
      setClientContacts([]);
      setClientTeamMemberContacts([]);
    }

    const fetchedDirector = resolveDirectorBackendContact(fetchedContacts);
    const storedDirector = directorFromOtherDetails(
      (fetchedClient as BackendClient | null)?.otherDetails ?? client?.otherDetails ?? null,
    );
    const fetchedPrimaryName = directorNameFromContact(fetchedDirector);
    const fetchedPrimaryEmailRaw = fetchedDirector?.email || '';
    const fetchedPrimaryEmail =
      fetchedPrimaryEmailRaw && !fetchedPrimaryEmailRaw.includes('@placeholder.local')
        ? fetchedPrimaryEmailRaw
        : '';
    const fetchedPrimaryPhone = fetchedDirector?.phone || '';

    const directorNameValue =
      fetchedPrimaryName || storedDirector.directorName || primaryClientContact?.name || '';
    const contactEmailValue = fetchedPrimaryEmail || primaryClientContactEmail;
    const contactPhoneValue = fetchedPrimaryPhone || primaryClientContactPhone;
    
    const statusMap: Record<string, 'ACTIVE' | 'ON_HOLD' | 'INACTIVE'> = {
      'Active': 'ACTIVE',
      'On Hold': 'ON_HOLD',
      'Inactive': 'INACTIVE',
      'Hot Clients ðŸ”¥': 'ACTIVE',
    };
    
    let clientStage = client.stage;
    if (fetchedClient) {
      const reverseStatusMap: Record<string, Client['stage']> = {
        'ACTIVE': 'Active',
        'PROSPECT': 'Active',
        'ON_HOLD': 'On Hold',
        'INACTIVE': 'Inactive',
      };
      clientStage = reverseStatusMap[fetchedClient.status] || 'Active';
    }
    
    timezoneManuallyEditedRef.current = false;
    const clientRecord = fetchedClient || client;
    const locationFields = resolveClientCityStateCountry(clientRecord);
    const resolvedStage = fetchedClient
      ? ({
          ACTIVE: 'Active',
          PROSPECT: 'Active',
          ON_HOLD: 'On Hold',
          INACTIVE: 'Inactive',
        }[fetchedClient.status] as Client['stage']) || clientStage
      : clientStage;
    setOverviewEditForm({
      companyName: fetchedClient?.companyName || client.name || '',
      logo: fetchedClient?.logo || client.logo || '',
      industry: fetchedClient?.industry || client.industry || '',
      companySize: fetchedClient?.companySize || client.companySize || '',
      website: fetchedClient?.website || client.website || '',
      linkedin: fetchedClient?.linkedin || client.linkedin || '',
      location: fetchedClient?.location || client.location || '',
      city: locationFields.city,
      country: locationFields.country,
      countryCode:
        (fetchedClient as { countryCode?: string } | null)?.countryCode ||
        (client as { countryCode?: string }).countryCode ||
        '',
      directorName: directorNameValue,
      contactEmail: contactEmailValue,
      contactPhone: contactPhoneValue,
      contactEmails: contactListForForm(
        (fetchedClient as { emails?: string[] })?.emails || client?.emails,
        contactEmailValue,
      ),
      contactPhones: contactListForForm(
        (fetchedClient as { phones?: string[] })?.phones || client?.phones,
        contactPhoneValue,
      ),
      hiringLocations: fetchedClient?.hiringLocations || client.hiringLocations || '',
      timezone: fetchedClient?.timezone || client.timezone || '',
      priority: fetchedClient?.priority || client.priority || '',
      servicesNeeded: fetchedClient?.servicesNeeded || client.servicesNeeded || '',
      expectedBusinessValue: fetchedClient?.expectedBusinessValue || client.expectedBusinessValue || '',
      nextFollowUpDue: normalizeClientAiDateInput(
        fetchedClient?.nextFollowUpDue || client?.nextFollowUpDue || '',
      ),
      sla: fetchedClient?.sla || client.sla || '',
      status: clientStatusLabelToBackend(
        resolveClientStatusLabel({
          leadStatus: fetchedClient?.leadStatus || client.leadStatus,
          leadStatusValue: fetchedClient?.leadStatus || client.leadStatusValue,
          stage: resolvedStage,
        }),
      ),
      assignedToId: assignedToId,
      companyLinks: buildCompanyLinksFromClient({
        website: fetchedClient?.website || client.website,
        linkedin: fetchedClient?.linkedin || client.linkedin,
      }),
      directorSalutation:
        fetchedClient?.directorSalutation ||
        client?.directorSalutation ||
        storedDirector.directorSalutation ||
        fetchedDirector?.salutation ||
        '',
      designation: fetchedDirector?.designation || client?.contacts?.[0]?.designation || '',
      state: fetchedClient?.state || client.state || locationFields.state,
      latitude: typeof fetchedClient?.latitude === 'number'
        ? fetchedClient.latitude
        : (typeof client.latitude === 'number' ? client.latitude : null),
      longitude: typeof fetchedClient?.longitude === 'number'
        ? fetchedClient.longitude
        : (typeof client.longitude === 'number' ? client.longitude : null),
      leadStatusValue: resolveClientStatusLabel({
        leadStatus: fetchedClient?.leadStatus || client.leadStatus,
        leadStatusValue: fetchedClient?.leadStatus || client.leadStatusValue,
        stage: resolvedStage,
      }),
      assignedToIds: assignedToId ? [assignedToId] : [],
      agreementsFileName: fetchedClient?.agreementsFileName || client.agreementsFileName || '',
      agreementsFileUrl: fetchedClient?.agreementsFileUrl || client.agreementsFileUrl || '',
      agreementsUploadedAt: fetchedClient?.agreementsUploadedAt || client.agreementsUploadedAt || '',
      ...agreementTermsFromRecord(fetchedClient || client),
      ...syncClientTeamMembers(
        resolveClientTeamMembersForForm(
          fetchedContacts.filter((contact) => isClientTeamMemberContact(contact)),
          fetchedClient || client,
          fetchedDirector?.id,
        ),
      ),
      postServiceKycForm: postServiceKycFormFromRecord(fetchedClient || client),
      dynamicOtherDetails: filterImportedDynamicOtherDetails(
        (fetchedClient as BackendClient | undefined)?.otherDetails ?? client.otherDetails ?? null,
      ),
      occasions: readLeadOccasionFromOtherDetails(
        (fetchedClient as BackendClient | undefined)?.otherDetails ?? client.otherDetails ?? null,
      ),
    });
    resetClientLogoDraft();
    setPendingAgreementsFile(null);
    setPendingKycFiles([]);
    setPendingPostServiceKycFiles(createEmptyPendingPostServiceKycFiles());
    setRemovedPostServiceKycFileIds([]);
    setClientLeadStatusCatalog((current) =>
      mergeCatalogOptions(
        DEFAULT_CLIENT_STATUS_LABELS,
        current,
        resolveClientStatusLabel({
          leadStatus: fetchedClient?.leadStatus || client.leadStatus,
          leadStatusValue: fetchedClient?.leadStatus || client.leadStatusValue,
          stage: resolvedStage,
        }),
      ),
    );
    setClientPriorityCatalog((current) =>
      mergeCatalogOptions(
        DEFAULT_CLIENT_PRIORITY_LABELS,
        current,
        fetchedClient?.priority || client.priority || overviewEditForm.priority,
      ),
    );
    setAgreementLevelCatalog((current) =>
      mergeCatalogOptions(
        AGREEMENT_LEVEL_OPTIONS,
        current,
        fetchedClient?.agreementLevel || client.agreementLevel || overviewEditForm.agreementLevel,
      ),
    );
    setOverviewEditMode(true);
  };

  const cancelOverviewEdit = () => {
    setOverviewEditMode(false);
    resetClientLogoDraft();
    setPendingAgreementsFile(null);
    setPendingKycFiles([]);
    setPendingPostServiceKycFiles(createEmptyPendingPostServiceKycFiles());
    setRemovedPostServiceKycFileIds([]);
  };

  const saveOverviewEdit = async () => {
    if (isAddMode) {
      // Create new client
      if (!overviewEditForm.companyName.trim()) {
        void requestWarning('Company name is required');
        return;
      }
      
      try {
        // The Add Client form (mirroring Add Lead) collects multi company links and
        // smart-location autofill metadata. Mirror Lead's create payload semantics here:
        // store the first link as the legacy `website`, keep the salutation/state/lat/lng
        // on the client row, and translate the funnel status into the Client.status enum.
        const cleanedCompanyLinks = (overviewEditForm.companyLinks || [overviewEditForm.website || ''])
          .map((link) => String(link || '').trim())
          .filter(Boolean);
        const { website: savedWebsite, linkedin: savedLinkedin } = normalizeCompanyLinksForSave(
          cleanedCompanyLinks,
          overviewEditForm.website,
        );
        const primaryWebsite = savedWebsite || overviewEditForm.website?.trim() || undefined;
        const primaryAssignedToId = resolvePrimaryAssignedToId(overviewEditForm);
        const mergedHiringLocations =
          [overviewEditForm.city, overviewEditForm.state, overviewEditForm.country].filter(Boolean).join(', ') ||
          overviewEditForm.hiringLocations?.trim() ||
          overviewEditForm.location?.trim() ||
          undefined;
        const contactChannels = buildContactChannelsFromForm(
          overviewEditForm.contactEmails,
          overviewEditForm.contactPhones,
          overviewEditForm.contactEmail,
          overviewEditForm.contactPhone,
        );
        const createData = {
          companyName: overviewEditForm.companyName,
          industry: overviewEditForm.industry || undefined,
          companySize: overviewEditForm.companySize || undefined,
          website: primaryWebsite,
          linkedin: savedLinkedin || overviewEditForm.linkedin || undefined,
          location: overviewEditForm.location || undefined,
          hiringLocations: mergedHiringLocations,
          timezone: overviewEditForm.timezone || undefined,
          priority: overviewEditForm.priority || undefined,
          servicesNeeded: overviewEditForm.servicesNeeded || undefined,
          expectedBusinessValue: overviewEditForm.expectedBusinessValue || undefined,
          nextFollowUpDue: overviewEditForm.nextFollowUpDue || undefined,
          sla: overviewEditForm.sla || undefined,
          status: clientStatusLabelToBackend(
            String(overviewEditForm.leadStatusValue || 'Active').trim() || 'Active',
          ),
          leadStatus: String(overviewEditForm.leadStatusValue || 'Active').trim() || 'Active',
          assignedToId: primaryAssignedToId,
          // Smart-location autofill metadata + salutation (mirror Add Lead).
          city: overviewEditForm.city || undefined,
          state: overviewEditForm.state || undefined,
          country: overviewEditForm.country || undefined,
          latitude: typeof overviewEditForm.latitude === 'number' ? overviewEditForm.latitude : undefined,
          longitude: typeof overviewEditForm.longitude === 'number' ? overviewEditForm.longitude : undefined,
          directorSalutation: overviewEditForm.directorSalutation || undefined,
          directorName: overviewEditForm.directorName || undefined,
          ...teamMemberPayloadFromForm(
            primaryTeamMemberFromList(overviewEditForm.teamMembers),
          ),
          otherDetails: mergeOccasionIntoOtherDetails(
            mergeDirectorIntoOtherDetails(
              mergeTeamMemberIntoOtherDetails(
                curatedDynamicPairsForSave(overviewEditForm.dynamicOtherDetails),
                overviewEditForm.teamMembers,
              ),
              {
                directorSalutation: overviewEditForm.directorSalutation,
                directorName: overviewEditForm.directorName,
              },
            ),
            overviewEditForm.occasions || emptyLeadOccasionForm(),
          ),
          email: contactChannels.email,
          phone: contactChannels.phone,
          emails: contactChannels.emails,
          phones: contactChannels.phones,
          ...(canManageClientAgreements ? agreementTermsApiPayload(overviewEditForm) : {}),
          ...postServiceKycFormApiPayload(overviewEditForm.postServiceKycForm),
          recruitmentEnabled: defaultRecruitmentEnabled === true,
        };

        let createdClientPayload: BackendClient | null | undefined = null;
        if (createClientOverride) {
          createdClientPayload = await createClientOverride(createData as CreateClientData);
        } else {
          const createdClient = await apiCreateClient(createData as CreateClientData);
          createdClientPayload = createdClient.data;
        }

        const createdClientId = createdClientPayload?.id;
        if (createdClientId && pendingClientLogoFile) {
          try {
            if (createClientOverride) {
              const uploadResponse = await apiHqUploadCompanyLogo(createdClientId, pendingClientLogoFile);
              const logoUrl = String(uploadResponse.data?.logo || uploadResponse.data?.company?.logo || '').trim();
              if (logoUrl && createdClientPayload) {
                createdClientPayload = { ...createdClientPayload, logo: logoUrl };
              }
            } else {
              const uploadResponse = await filesApiUpload('client', createdClientId, pendingClientLogoFile, 'LOGO');
              const logoUrl = uploadResponse.data?.fileUrl;
              if (logoUrl && createdClientPayload) {
                await apiUpdateClient(createdClientId, { logo: logoUrl });
                createdClientPayload = { ...createdClientPayload, logo: logoUrl };
              }
            }
          } catch (logoError) {
            console.error('Failed to upload new client logo:', logoError);
          }
        }

        // Primary contact — Add Client now collects director name/email/phone the same way
        // Add Lead does. Persist them as the client's primary Contact so the Contacts tab and
        // downstream automations see the same record.
        if (
          !createClientOverride &&
          createdClientId &&
          (overviewEditForm.directorName.trim() ||
            contactChannels.email ||
            contactChannels.phone)
        ) {
          try {
            await syncPrimaryClientContact(createdClientId, {
              directorName: overviewEditForm.directorName,
              salutation: overviewEditForm.directorSalutation || undefined,
              email: contactChannels.email || undefined,
              phone: contactChannels.phone || undefined,
              location:
                [overviewEditForm.city, overviewEditForm.country].filter(Boolean).join(', ') ||
                overviewEditForm.location ||
                undefined,
              ownerId: primaryAssignedToId,
            });
          } catch (contactError: unknown) {
            console.error('Failed to create primary contact for new client:', contactError);
            // Non-blocking — the client itself was created successfully.
          }
        }

        if (!createClientOverride && createdClientId) {
          await syncClientTeamMemberContacts(
            createdClientId,
            primaryAssignedToId || undefined,
            overviewEditForm.companyName,
            overviewEditForm.teamMembers,
            contactChannels.email || undefined,
            undefined,
          );
        }

        // Agreements & Terms — upload after creation so we have a client id to scope the file under.
        if (!createClientOverride && createdClientId && pendingAgreementsFile && canManageClientAgreements) {
          try {
            setUploadingAgreements(true);
            const uploadResponse = await filesApiUpload(
              'client',
              createdClientId,
              pendingAgreementsFile,
              'AGREEMENT'
            );
            const agreementUrl = uploadResponse.data?.fileUrl;
            const agreementName = uploadResponse.data?.fileName || pendingAgreementsFile.name;
            if (agreementUrl) {
              await apiUpdateClient(createdClientId, {
                agreementsFileName: agreementName,
                agreementsFileUrl: agreementUrl,
                agreementsUploadedAt: new Date().toISOString(),
              });
              agreementsUploadFeedback.markSuccess(pendingAgreementsFile.name);
            }
          } catch (uploadError: any) {
            console.error('Failed to upload client agreement:', uploadError);
            agreementsUploadFeedback.markError(uploadError.message || 'Failed to upload agreements file');
            void requestError(uploadError.message || 'Failed to upload agreements file');
          } finally {
            setUploadingAgreements(false);
          }
        }

        resetClientLogoDraft();
        setPendingAgreementsFile(null);
        const pendingClientKyc = [...pendingKycFiles];
        const pendingStructuredKycCount = Object.values(pendingPostServiceKycFiles).reduce(
          (sum, files) => sum + files.length,
          0,
        );
        if (
          !createClientOverride &&
          createdClientId &&
          (pendingClientKyc.length > 0 || pendingStructuredKycCount > 0)
        ) {
          try {
            setUploadingKyc(true);
            if (pendingClientKyc.length > 0) {
              await uploadKycDocuments('client', createdClientId, pendingClientKyc);
            }
            if (pendingStructuredKycCount > 0) {
              const nextPostServiceKycForm = await uploadPendingPostServiceKycFiles(
                createdClientId,
                overviewEditForm.postServiceKycForm,
              );
              await apiUpdateClient(
                createdClientId,
                postServiceKycFormApiPayload(nextPostServiceKycForm),
              );
            }
            kycUploadFeedback.markSuccess(
              pendingClientKyc.length + pendingStructuredKycCount === 1
                ? (pendingClientKyc[0]?.name ||
                  Object.values(pendingPostServiceKycFiles).flat()[0]?.name ||
                  '1 document')
                : `${pendingClientKyc.length + pendingStructuredKycCount} documents`
            );
          } catch (uploadError: any) {
            console.error('Failed to upload client KYC documents:', uploadError);
            kycUploadFeedback.markError(uploadError.message || 'Failed to upload KYC documents');
            void requestError(uploadError.message || 'Failed to upload KYC documents');
          } finally {
            setUploadingKyc(false);
          }
        }
        setPendingKycFiles([]);
        setPendingPostServiceKycFiles(createEmptyPendingPostServiceKycFiles());
        setRemovedPostServiceKycFileIds([]);
        resetClientAiAssistant();
        onClientCreated?.(createdClientPayload);
        markClientDrawerClean();
        onClose();
      } catch (error: any) {
        console.error('Failed to create client:', error);
        void requestError(error.message || 'Failed to create client');
      }
    } else {
      // Update existing client
      if (!client) return;
      
      try {
        const contactChannels = buildContactChannelsFromForm(
          overviewEditForm.contactEmails,
          overviewEditForm.contactPhones,
          overviewEditForm.contactEmail,
          overviewEditForm.contactPhone,
        );
        const pendingStructuredKycCount = Object.values(pendingPostServiceKycFiles).reduce(
          (sum, files) => sum + files.length,
          0,
        );
        let nextPostServiceKycForm = overviewEditForm.postServiceKycForm;
        const cleanedCompanyLinks = (overviewEditForm.companyLinks || [overviewEditForm.website || ''])
          .map((link) => String(link || '').trim())
          .filter(Boolean);
        const { website: savedWebsite, linkedin: savedLinkedin } = normalizeCompanyLinksForSave(
          cleanedCompanyLinks,
          overviewEditForm.website,
        );
        const primaryAssignedToId = resolvePrimaryAssignedToId(overviewEditForm);
        const updateData: any = {
          companyName: overviewEditForm.companyName,
          email: contactChannels.email,
          phone: contactChannels.phone,
          emails: contactChannels.emails,
          phones: contactChannels.phones,
        };
        
        // Only include fields that have values or are being cleared
        if (overviewEditForm.industry !== undefined) updateData.industry = overviewEditForm.industry || null;
        if (overviewEditForm.companySize !== undefined) updateData.companySize = overviewEditForm.companySize || null;
        if (overviewEditForm.website !== undefined || cleanedCompanyLinks.length) {
          updateData.website = savedWebsite || overviewEditForm.website || null;
        }
        if (overviewEditForm.linkedin !== undefined || cleanedCompanyLinks.length) {
          updateData.linkedin = savedLinkedin || overviewEditForm.linkedin || null;
        }
        if (overviewEditForm.location !== undefined) updateData.location = overviewEditForm.location || null;
        if (overviewEditForm.city !== undefined) updateData.city = overviewEditForm.city || null;
        if (overviewEditForm.state !== undefined) updateData.state = overviewEditForm.state || null;
        if (overviewEditForm.country !== undefined) updateData.country = overviewEditForm.country || null;
        if (overviewEditForm.countryCode !== undefined) updateData.countryCode = overviewEditForm.countryCode || null;
        if (overviewEditForm.latitude !== undefined) {
          updateData.latitude = typeof overviewEditForm.latitude === 'number' ? overviewEditForm.latitude : null;
        }
        if (overviewEditForm.longitude !== undefined) {
          updateData.longitude = typeof overviewEditForm.longitude === 'number' ? overviewEditForm.longitude : null;
        }
        if (overviewEditForm.directorSalutation !== undefined) {
          updateData.directorSalutation = overviewEditForm.directorSalutation || null;
        }
        if (overviewEditForm.directorName !== undefined) {
          updateData.directorName = overviewEditForm.directorName || null;
          updateData.primaryContactName = overviewEditForm.directorName || null;
        }
        const mergedHiringLocations = [overviewEditForm.city, overviewEditForm.state, overviewEditForm.country]
          .filter(Boolean)
          .join(', ');
        if (
          overviewEditForm.hiringLocations !== undefined ||
          overviewEditForm.city !== undefined ||
          overviewEditForm.state !== undefined ||
          overviewEditForm.country !== undefined
        ) {
          updateData.hiringLocations = mergedHiringLocations || overviewEditForm.hiringLocations || null;
        }
        if (overviewEditForm.timezone !== undefined) updateData.timezone = overviewEditForm.timezone || null;
        if (overviewEditForm.priority !== undefined) updateData.priority = overviewEditForm.priority || null;
        if (overviewEditForm.servicesNeeded !== undefined) updateData.servicesNeeded = overviewEditForm.servicesNeeded || null;
        if (overviewEditForm.expectedBusinessValue !== undefined) updateData.expectedBusinessValue = overviewEditForm.expectedBusinessValue || null;
        if (overviewEditForm.nextFollowUpDue !== undefined) updateData.nextFollowUpDue = overviewEditForm.nextFollowUpDue || null;
        if (overviewEditForm.sla !== undefined) updateData.sla = overviewEditForm.sla || null;
        if (overviewEditForm.leadStatusValue !== undefined) {
          const leadStatusValue = String(overviewEditForm.leadStatusValue || 'Active').trim() || 'Active';
          updateData.leadStatus = leadStatusValue;
          updateData.status = clientStatusLabelToBackend(leadStatusValue);
        } else if (overviewEditForm.status !== undefined) {
          updateData.status = overviewEditForm.status;
        }
        if (overviewEditForm.assignedToId !== undefined || overviewEditForm.assignedToIds !== undefined) {
          updateData.assignedToId = primaryAssignedToId || null;
        }
        if (isHqOverrideMode && pendingClientLogoFile) {
          try {
            setUploadingClientLogo(true);
            const uploadResponse = await apiHqUploadCompanyLogo(client.id, pendingClientLogoFile);
            const logoUrl = String(uploadResponse.data?.logo || uploadResponse.data?.company?.logo || '').trim();
            if (logoUrl) updateData.logo = logoUrl;
          } catch (logoError: any) {
            console.error('Failed to upload client logo:', logoError);
            void requestError(logoError?.message || 'Failed to upload client image');
          } finally {
            setUploadingClientLogo(false);
          }
        } else if (overviewEditForm.logo !== undefined) {
          const logo = String(overviewEditForm.logo || '').trim();
          if (logoRemoved || !logo) updateData.logo = null;
          else if (!logo.startsWith('blob:') && !logo.startsWith('data:')) updateData.logo = logo;
        }
        Object.assign(
          updateData,
          teamMemberPayloadFromForm(
            primaryTeamMemberFromList(overviewEditForm.teamMembers),
          ),
        );
        updateData.otherDetails = mergeOccasionIntoOtherDetails(
          mergeDirectorIntoOtherDetails(
            mergeTeamMemberIntoOtherDetails(
              curatedDynamicPairsForSave(overviewEditForm.dynamicOtherDetails),
              overviewEditForm.teamMembers,
            ),
            {
              directorSalutation: overviewEditForm.directorSalutation,
              directorName: overviewEditForm.directorName,
            },
          ),
          overviewEditForm.occasions || emptyLeadOccasionForm(),
        );

        // Agreements & Terms — upload the new file (if any) before patching the client so the
        // URL/filename land on the same update call as the rest of the overview fields.
        if (canManageClientAgreements && pendingAgreementsFile) {
          try {
            setUploadingAgreements(true);
            const uploadResponse = await filesApiUpload(
              'client',
              client.id,
              pendingAgreementsFile,
              'AGREEMENT'
            );
            const agreementUrl = uploadResponse.data?.fileUrl;
            const agreementName = uploadResponse.data?.fileName || pendingAgreementsFile.name;
            if (agreementUrl) {
              updateData.agreementsFileName = agreementName;
              updateData.agreementsFileUrl = agreementUrl;
              updateData.agreementsUploadedAt = new Date().toISOString();
              agreementsUploadFeedback.markSuccess(pendingAgreementsFile.name);
            }
          } catch (uploadError: any) {
            console.error('Failed to upload client agreement:', uploadError);
            agreementsUploadFeedback.markError(uploadError.message || 'Failed to upload agreements file');
            void requestError(uploadError.message || 'Failed to upload agreements file');
          } finally {
            setUploadingAgreements(false);
          }
        } else if (
          canManageClientAgreements &&
          overviewEditForm.agreementsFileUrl === '' &&
          overviewEditForm.agreementsFileName === ''
        ) {
          // Explicit removal of the existing agreement.
          updateData.agreementsFileName = null;
          updateData.agreementsFileUrl = null;
          updateData.agreementsUploadedAt = null;
        }

        if (canManageClientAgreements) {
          Object.assign(updateData, agreementTermsApiPayload(overviewEditForm));
        }
        if (pendingStructuredKycCount > 0) {
          try {
            setUploadingKyc(true);
            nextPostServiceKycForm = await uploadPendingPostServiceKycFiles(
              client.id,
              nextPostServiceKycForm,
            );
          } catch (uploadError: any) {
            console.error('Failed to upload client KYC form attachments:', uploadError);
            kycUploadFeedback.markError(uploadError.message || 'Failed to upload KYC documents');
            void requestError(uploadError.message || 'Failed to upload KYC documents');
          } finally {
            setUploadingKyc(false);
          }
        }
        Object.assign(updateData, postServiceKycFormApiPayload(nextPostServiceKycForm));

        console.log('Updating client with data:', updateData);
        if (updateClientOverride) {
          const updated = await updateClientOverride(client.id, updateData);
          if (updated) {
            const mapped = mergeBackendClientRecord(client, updated);
            setFullClientData(mapped);
            onClientUpdated?.({
              id: client.id,
              name: mapped.name,
              industry: mapped.industry,
              location: mapped.location,
              companySize: mapped.companySize,
              hiringLocations: mapped.hiringLocations,
              servicesNeeded: mapped.servicesNeeded,
              expectedBusinessValue: mapped.expectedBusinessValue,
              leadStatus: mapped.leadStatus,
              leadStatusValue: mapped.leadStatusValue,
              website: mapped.website,
              linkedin: mapped.linkedin,
              timezone: mapped.timezone,
              priority: mapped.priority,
              stage: mapped.stage,
              owner: mapped.owner,
              city: mapped.city,
              state: mapped.state,
              country: mapped.country,
              latitude: mapped.latitude,
              longitude: mapped.longitude,
              emails: mapped.emails,
              phones: mapped.phones,
              otherDetails: mapped.otherDetails,
              directorSalutation: mapped.directorSalutation,
            });
          }
          setOverviewEditMode(false);
          markClientDrawerClean();
          return;
        }
        await apiUpdateClient(client.id, updateData);
        await syncPrimaryClientContact(client.id, {
          contactId: primaryClientContact?.id,
          directorName: overviewEditForm.directorName,
          salutation: overviewEditForm.directorSalutation || undefined,
          email: contactChannels.email || undefined,
          phone: contactChannels.phone || undefined,
          location:
            [overviewEditForm.city, overviewEditForm.country].filter(Boolean).join(', ') ||
            overviewEditForm.location ||
            undefined,
          ownerId: primaryAssignedToId || undefined,
        });
        await syncClientTeamMemberContacts(
          client.id,
          primaryAssignedToId || undefined,
          overviewEditForm.companyName,
          overviewEditForm.teamMembers,
          contactChannels.email || undefined,
          primaryClientContact?.id,
        );
        try {
          const refreshed = await apiFetch<BackendClient>(`/clients/${client.id}`, {
            method: 'GET',
            auth: true,
          });
          if (refreshed.data) {
            const mapped = mergeBackendClientRecord(client, refreshed.data);
            setFullClientData(mapped);
            onClientUpdated?.({
              id: client.id,
              name: mapped.name,
              industry: mapped.industry,
              location: mapped.location,
              companySize: mapped.companySize,
              hiringLocations: mapped.hiringLocations,
              servicesNeeded: mapped.servicesNeeded,
              expectedBusinessValue: mapped.expectedBusinessValue,
              leadStatus: mapped.leadStatus,
              leadStatusValue: mapped.leadStatusValue,
              website: mapped.website,
              linkedin: mapped.linkedin,
              timezone: mapped.timezone,
              priority: mapped.priority,
              stage: mapped.stage,
              owner: mapped.owner,
              city: mapped.city,
              state: mapped.state,
              country: mapped.country,
              latitude: mapped.latitude,
              longitude: mapped.longitude,
              emails: mapped.emails,
              phones: mapped.phones,
              otherDetails: mapped.otherDetails,
              directorSalutation: mapped.directorSalutation,
              teamMemberDesignation: mapped.teamMemberDesignation,
              teamMemberEmail: mapped.teamMemberEmail,
              teamMemberPhone: mapped.teamMemberPhone,
              sla: mapped.sla,
              nextFollowUpDue: mapped.nextFollowUpDue,
              logo: mapped.logo,
              postServiceKycForm: mapped.postServiceKycForm,
              agreementsFileName: mapped.agreementsFileName,
              agreementsFileUrl: mapped.agreementsFileUrl,
              agreementsUploadedAt: mapped.agreementsUploadedAt,
              agreementLevel: mapped.agreementLevel,
              agreementServiceChargePercent: mapped.agreementServiceChargePercent,
              agreementContractValidity: mapped.agreementContractValidity,
              agreementContractStartDate: mapped.agreementContractStartDate,
              agreementContractEndDate: mapped.agreementContractEndDate,
              agreementTimePeriod: mapped.agreementTimePeriod,
              agreementAdvancePaymentPercent: mapped.agreementAdvancePaymentPercent,
              agreementFreeReplacementValue: mapped.agreementFreeReplacementValue,
              agreementFreeReplacementUnit: mapped.agreementFreeReplacementUnit,
            });
          }
        } catch (refreshError) {
          console.error('Failed to refresh client after save:', refreshError);
        }
        await refreshClientContacts();
        resetClientLogoDraft();
        setPendingAgreementsFile(null);
        const pendingClientKycUpdate = [...pendingKycFiles];
        if (
          !isHqOverrideMode &&
          (pendingClientKycUpdate.length > 0 || pendingStructuredKycCount > 0 || removedPostServiceKycFileIds.length > 0)
        ) {
          try {
            if (pendingClientKycUpdate.length > 0) {
              setUploadingKyc(true);
              await uploadKycDocuments('client', client.id, pendingClientKycUpdate);
            }
            for (const fileId of removedPostServiceKycFileIds) {
              await deleteFile(fileId);
            }
            await refetchClientFiles();
            if (pendingClientKycUpdate.length > 0 || pendingStructuredKycCount > 0) {
              kycUploadFeedback.markSuccess(
                pendingClientKycUpdate.length + pendingStructuredKycCount === 1
                  ? (pendingClientKycUpdate[0]?.name ||
                    Object.values(pendingPostServiceKycFiles).flat()[0]?.name ||
                    '1 document')
                  : `${pendingClientKycUpdate.length + pendingStructuredKycCount} documents`
              );
            }
          } catch (uploadError: any) {
            console.error('Failed to upload client KYC documents:', uploadError);
            kycUploadFeedback.markError(uploadError.message || 'Failed to upload KYC documents');
            void requestError(uploadError.message || 'Failed to upload KYC documents');
          } finally {
            if (pendingClientKycUpdate.length > 0) {
              setUploadingKyc(false);
            }
          }
        }
        setPendingKycFiles([]);
        setPendingPostServiceKycFiles(createEmptyPendingPostServiceKycFiles());
        setRemovedPostServiceKycFileIds([]);
        onClientCreated?.();
        setOverviewEditMode(false);
        
        // Refresh activities if Activity tab is open
        if (activeTab === 'activity') {
          const response = await apiGetClientActivities(client.id);
          const activities = Array.isArray(response.data) ? response.data : [];
          
          const mappedActivities: ClientActivityItem[] = activities.map((activity: any) => {
            const user = activity.performedBy || {};
            const userName = user.firstName && user.lastName 
              ? `${user.firstName} ${user.lastName}`.trim()
              : user.name || user.email || 'Unknown User';

            const activityDate = new Date(activity.createdAt);
            const now = new Date();
            const isToday = activityDate.toDateString() === now.toDateString();
            const isYesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toDateString() === activityDate.toDateString();
            
            let dateDisplay = '';
            if (isToday) {
              dateDisplay = 'Today';
            } else if (isYesterday) {
              dateDisplay = 'Yesterday';
            } else {
              dateDisplay = formatDateDMY(activityDate);
            }
            
            const timeDisplay = formatTime12hEnGb(activityDate);
            
            const timestamp = `${dateDisplay} at ${timeDisplay}`;

            return {
              id: activity.id,
              category: mapClientActivityCategory(activity),
              title: activity.action,
              description: activity.description,
              user: {
                name: userName,
                avatar: user.avatar || undefined,
              },
              timestamp: timestamp,
              timestampFull: activityDate.toISOString(),
              relatedType: activity.relatedType as any,
              relatedLabel: activity.relatedLabel,
              relatedId: activity.relatedId,
            };
          });

          setClientActivities(mappedActivities);
        }
        
        // Refresh the page to show updated data
        window.location.reload();
      } catch (error: any) {
        console.error('Failed to update client:', error);
        void requestError(error.message || 'Failed to update client');
      }
    }
  };

  // Fetch users for assignment dropdown
  useEffect(() => {
    const fetchUsers = async () => {
      setLoadingUsers(true);
      try {
        if (isHqOverrideMode) {
          const hqTeam = await apiHqListTeam();
          const members = hqTeam.data?.members ?? [];
          const mapped = members.map((member) => {
            const fullName = member.name || member.email || 'User';
            const nameParts = fullName.split(/\s+/).filter(Boolean);
            return {
              id: member.id,
              firstName: nameParts[0] || fullName,
              lastName: nameParts.slice(1).join(' '),
              name: fullName,
              email: member.email,
              role: member.role ? { roleName: member.role } : undefined,
            };
          });
          setRecruiters(mapped as unknown as TeamMember[]);
          setUsers(mapped as any);
          return;
        }
        const response = await apiGetClientAssignableMembers();
        const members = Array.isArray(response.data) ? response.data : [];
        const toTeamMember = (member: (typeof members)[number]) => {
          const fullName =
            member.name ||
            `${member.firstName || ''} ${member.lastName || ''}`.trim() ||
            member.email ||
            'User';
          const nameParts = fullName.split(/\s+/).filter(Boolean);
          return {
            id: member.id,
            firstName: member.firstName || nameParts[0] || fullName,
            lastName: member.lastName || nameParts.slice(1).join(' '),
            name: fullName,
            email: member.email,
            role: member.role,
          };
        };
        setRecruiters(members.map(toTeamMember) as unknown as TeamMember[]);
        setUsers(
          members.map((member) => ({
            id: member.id,
            name:
              member.name ||
              `${member.firstName || ''} ${member.lastName || ''}`.trim() ||
              member.email ||
              'User',
            email: member.email,
          })) as BackendUser[],
        );
      } catch (error) {
        console.error('Failed to fetch users:', error);
        setUsers([]);
        setRecruiters([]);
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, [isHqOverrideMode]);

  useEffect(() => {
    if (!propIsAddMode && !client) return;

    let cancelled = false;
    const fetchClientLeadStatusCatalog = async () => {
      if (isHqOverrideMode) {
        setClientLeadStatusCatalog(
          mergeCatalogOptions(
            DEFAULT_CLIENT_STATUS_LABELS,
            undefined,
            client?.leadStatusValue ?? overviewEditForm.leadStatusValue,
          ),
        );
        return;
      }
      try {
        const response = await apiGetClientLeadStatusCatalog();
        if (cancelled) return;
        setClientLeadStatusCatalog(
          mergeCatalogOptions(
            DEFAULT_CLIENT_STATUS_LABELS,
            response?.data?.statuses,
            client?.leadStatusValue ?? overviewEditForm.leadStatusValue,
          ),
        );
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to load client statuses:', error);
        setClientLeadStatusCatalog(
          mergeCatalogOptions(
            DEFAULT_CLIENT_STATUS_LABELS,
            undefined,
            client?.leadStatusValue ?? overviewEditForm.leadStatusValue,
          ),
        );
      }
    };

    const fetchClientPriorityCatalog = async () => {
      if (isHqOverrideMode) {
        setClientPriorityCatalog(
          mergeCatalogOptions(
            DEFAULT_CLIENT_PRIORITY_LABELS,
            undefined,
            client?.priority ?? overviewEditForm.priority,
          ),
        );
        return;
      }
      try {
        const response = await apiGetClientPriorityCatalog();
        if (cancelled) return;
        setClientPriorityCatalog(
          mergeCatalogOptions(
            DEFAULT_CLIENT_PRIORITY_LABELS,
            response?.data?.statuses,
            client?.priority ?? overviewEditForm.priority,
          ),
        );
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to load client interest levels:', error);
        setClientPriorityCatalog(
          mergeCatalogOptions(
            DEFAULT_CLIENT_PRIORITY_LABELS,
            undefined,
            client?.priority ?? overviewEditForm.priority,
          ),
        );
      }
    };

    const fetchAgreementLevelCatalog = async () => {
      if (isHqOverrideMode) {
        setAgreementLevelCatalog(
          mergeCatalogOptions(
            AGREEMENT_LEVEL_OPTIONS,
            undefined,
            client?.agreementLevel ?? overviewEditForm.agreementLevel,
          ),
        );
        return;
      }
      try {
        const response = await apiGetAgreementLevelCatalog();
        if (cancelled) return;
        setAgreementLevelCatalog(
          mergeCatalogOptions(
            AGREEMENT_LEVEL_OPTIONS,
            response?.data?.statuses,
            client?.agreementLevel ?? overviewEditForm.agreementLevel,
          ),
        );
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to load agreement levels:', error);
        setAgreementLevelCatalog(
          mergeCatalogOptions(
            AGREEMENT_LEVEL_OPTIONS,
            undefined,
            client?.agreementLevel ?? overviewEditForm.agreementLevel,
          ),
        );
      }
    };

    fetchClientLeadStatusCatalog();
    fetchClientPriorityCatalog();
    fetchAgreementLevelCatalog();
    return () => {
      cancelled = true;
    };
  }, [propIsAddMode, client?.id, isHqOverrideMode]);

  const addClientLeadStatusOption = async (onSelect: (status: string) => void) => {
    const status = String(newClientLeadStatusValue || '').trim();
    if (!status) {
      toast.error('Enter a status name first.');
      return;
    }

    setSavingClientLeadStatus(true);
    try {
      const response = await apiAppendClientLeadStatus(status);
      const nextOptions = mergeCatalogOptions(DEFAULT_CLIENT_STATUS_LABELS, response?.data?.statuses, status);
      setClientLeadStatusCatalog(nextOptions);
      onSelect(status);
      setNewClientLeadStatusValue('');
      setShowAddClientLeadStatusInput(false);
      toast.success(`Status "${status}" added.`);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('jobportal:client-catalog-changed'));
      }
    } catch (error) {
      void requestError((error as Error)?.message || 'Failed to add status');
    } finally {
      setSavingClientLeadStatus(false);
    }
  };

  const deleteClientLeadStatusOption = async (status: string, onSelect: (status: string) => void) => {
    const normalized = String(status || '').trim();
    if (
      !normalized ||
      DEFAULT_CLIENT_STATUS_LABELS.some((option) => option.toLowerCase() === normalized.toLowerCase())
    ) {
      return;
    }

    const confirmed = await requestConfirm(`Delete status "${normalized}"?`, {
      title: 'Delete status',
      tone: 'warning',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });
    if (!confirmed) return;

    setDeletingClientLeadStatus(true);
    try {
      const response = await apiRemoveClientLeadStatus(normalized);
      const fallback = 'Active';
      const nextOptions = mergeCatalogOptions(DEFAULT_CLIENT_STATUS_LABELS, response?.data?.statuses, fallback);
      setClientLeadStatusCatalog(nextOptions);
      onSelect(fallback);
      toast.success(`Status "${normalized}" deleted.`);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('jobportal:client-catalog-changed'));
      }
    } catch (error) {
      void requestError((error as Error)?.message || 'Failed to delete status');
    } finally {
      setDeletingClientLeadStatus(false);
    }
  };

  const addClientPriorityOption = async (onSelect: (priority: string) => void) => {
    const priority = String(newClientPriorityValue || '').trim();
    if (!priority) {
      toast.error('Enter an interest level first.');
      return;
    }

    setSavingClientPriority(true);
    try {
      const response = await apiAppendClientPriority(priority);
      const nextOptions = mergeCatalogOptions(DEFAULT_CLIENT_PRIORITY_LABELS, response?.data?.statuses, priority);
      setClientPriorityCatalog(nextOptions);
      onSelect(priority);
      setNewClientPriorityValue('');
      setShowAddClientPriorityInput(false);
      toast.success(`Interest level "${priority}" added.`);
    } catch (error) {
      void requestError((error as Error)?.message || 'Failed to add interest level');
    } finally {
      setSavingClientPriority(false);
    }
  };

  const deleteClientPriorityOption = async (priority: string, onSelect: (priority: string) => void) => {
    const normalized = String(priority || '').trim();
    if (
      !normalized ||
      DEFAULT_CLIENT_PRIORITY_LABELS.some((option) => option.toLowerCase() === normalized.toLowerCase())
    ) {
      return;
    }

    const confirmed = await requestConfirm(`Delete interest level "${normalized}"?`, {
      title: 'Delete interest level',
      tone: 'warning',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });
    if (!confirmed) return;

    setDeletingClientPriority(true);
    try {
      const response = await apiRemoveClientPriority(normalized);
      const fallback = 'Medium';
      const nextOptions = mergeCatalogOptions(DEFAULT_CLIENT_PRIORITY_LABELS, response?.data?.statuses, fallback);
      setClientPriorityCatalog(nextOptions);
      onSelect(fallback);
      toast.success(`Interest level "${normalized}" deleted.`);
    } catch (error) {
      void requestError((error as Error)?.message || 'Failed to delete interest level');
    } finally {
      setDeletingClientPriority(false);
    }
  };

  const addAgreementLevelOption = async (onSelect: (level: string) => void) => {
    const level = String(newAgreementLevelValue || '').trim();
    if (!level) {
      toast.error('Enter a level name first.');
      return;
    }

    setSavingAgreementLevel(true);
    try {
      const response = await apiAppendAgreementLevel(level);
      const nextOptions = mergeCatalogOptions(AGREEMENT_LEVEL_OPTIONS, response?.data?.statuses, level);
      setAgreementLevelCatalog(nextOptions);
      onSelect(level);
      setNewAgreementLevelValue('');
      setShowAddAgreementLevelInput(false);
      toast.success(`Level "${level}" added.`);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('jobportal:client-catalog-changed'));
      }
    } catch (error) {
      void requestError((error as Error)?.message || 'Failed to add level');
    } finally {
      setSavingAgreementLevel(false);
    }
  };

  const deleteAgreementLevelOption = async (level: string, onSelect: (level: string) => void) => {
    const normalized = String(level || '').trim();
    if (
      !normalized ||
      AGREEMENT_LEVEL_OPTIONS.some((option) => option.toLowerCase() === normalized.toLowerCase())
    ) {
      return;
    }

    const confirmed = await requestConfirm(`Delete level "${normalized}"?`, {
      title: 'Delete level',
      tone: 'warning',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });
    if (!confirmed) return;

    setDeletingAgreementLevel(true);
    try {
      const response = await apiRemoveAgreementLevel(normalized);
      const nextOptions = mergeCatalogOptions(AGREEMENT_LEVEL_OPTIONS, response?.data?.statuses);
      setAgreementLevelCatalog(nextOptions);
      onSelect('');
      toast.success(`Level "${normalized}" deleted.`);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('jobportal:client-catalog-changed'));
      }
    } catch (error) {
      void requestError((error as Error)?.message || 'Failed to delete level');
    } finally {
      setDeletingAgreementLevel(false);
    }
  };

  const applyExtractedAgreementTerms = useCallback((terms: AgreementTermsFormValues) => {
    const filled = filledAgreementTermKeys(terms);
    setOverviewEditForm((p) => ({ ...p, ...mergeExtractedAgreementTerms(p, terms) }));
    if (terms.agreementLevel?.trim()) {
      setAgreementLevelCatalog((prev) => {
        const level = terms.agreementLevel.trim();
        if (prev.some((item) => item.toLowerCase() === level.toLowerCase())) return prev;
        return [...prev, level];
      });
    }
    if (extractedAgreementTimerRef.current) {
      clearTimeout(extractedAgreementTimerRef.current);
    }
    setExtractedAgreementKeys(filled);
    extractedAgreementTimerRef.current = setTimeout(() => {
      setExtractedAgreementKeys([]);
      extractedAgreementTimerRef.current = null;
    }, 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (extractedAgreementTimerRef.current) {
        clearTimeout(extractedAgreementTimerRef.current);
      }
    };
  }, []);

  const agreementLevelCatalogProps: AgreementLevelCatalogProps = {
    options: agreementLevelOptions,
    defaultOptions: AGREEMENT_LEVEL_OPTIONS,
    deleting: deletingAgreementLevel,
    saving: savingAgreementLevel,
    showAddInput: showAddAgreementLevelInput,
    newValue: newAgreementLevelValue,
    onToggleAddInput: () => {
      setShowAddAgreementLevelInput((prev) => !prev);
      setNewAgreementLevelValue('');
    },
    onNewValueChange: setNewAgreementLevelValue,
    onAdd: () =>
      addAgreementLevelOption((nextLevel) =>
        setOverviewEditForm((p) => ({ ...p, agreementLevel: nextLevel })),
      ),
    onCancelAdd: () => {
      setShowAddAgreementLevelInput(false);
      setNewAgreementLevelValue('');
    },
    onDelete: (level) =>
      deleteAgreementLevelOption(level, (nextLevel) =>
        setOverviewEditForm((p) => ({ ...p, agreementLevel: nextLevel })),
      ),
  };

  // Fetch client activities whenever client changes
  useEffect(() => {
    const fetchActivities = async () => {
      if (!client?.id) {
        setClientActivities([]);
        return;
      }
      if (isHqOverrideMode) {
        setClientActivities([]);
        setLoadingActivities(false);
        return;
      }

      setLoadingActivities(true);
      try {
        const response = await apiGetClientActivities(client.id);
        const activities = Array.isArray(response.data) ? response.data : [];
        
        // Map backend activities to frontend format
        const mappedActivities: ClientActivityItem[] = activities.map((activity: any) => {
          const user = activity.performedBy || {};
          const userName = user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}`.trim()
            : user.name || user.email || 'Unknown User';

          // Format timestamp with date and time
          const activityDate = new Date(activity.createdAt);
          const now = new Date();
          const isToday = activityDate.toDateString() === now.toDateString();
          const isYesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toDateString() === activityDate.toDateString();
          
          let dateDisplay = '';
          if (isToday) {
            dateDisplay = 'Today';
          } else if (isYesterday) {
            dateDisplay = 'Yesterday';
          } else {
            dateDisplay = formatDateDMY(activityDate);
          }
          
          const timeDisplay = formatTime12hEnGb(activityDate);
          
          const timestamp = `${dateDisplay} at ${timeDisplay}`;

          return {
            id: activity.id,
            category: mapClientActivityCategory(activity),
            title: activity.action,
            description: activity.description,
            user: {
              name: userName,
              avatar: user.avatar || undefined,
            },
            timestamp: timestamp,
            timestampFull: activityDate.toISOString(), // For sorting
            relatedType: activity.relatedType as any,
            relatedLabel: activity.relatedLabel,
            relatedId: activity.relatedId,
          };
        });

        setClientActivities(mappedActivities);
      } catch (error) {
        console.error('Failed to fetch client activities:', error);
        setClientActivities([]);
      } finally {
        setLoadingActivities(false);
      }
    };

    fetchActivities();
  }, [client?.id, activeTab, isHqOverrideMode]);

  // Fetch jobs for the client (refetch after CreateJobDrawer saves)
  const refreshClientJobs = useCallback(async () => {
    if (!client?.id) {
      setClientJobs([]);
      return;
    }
    if (isHqOverrideMode) {
      setClientJobs([]);
      setLoadingJobs(false);
      return;
    }

    setLoadingJobs(true);
    try {
      const response = await apiGetJobs({ clientId: client.id });
      const jobsList = Array.isArray(response.data)
        ? response.data
        : (response.data as any)?.data || (response.data as any)?.items || [];

      const mappedJobs: ClientJob[] = jobsList.map((job: BackendJob) => {
        const createdAt = new Date(job.createdAt);
        const daysSinceCreation = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        const isAging = daysSinceCreation > 30;

        const statusMap: Record<string, JobStatus> = {
          OPEN: 'Open',
          DRAFT: 'Open',
          ON_HOLD: 'Paused',
          CLOSED: 'Closed',
          FILLED: 'Closed',
        };

        return {
          id: job.id,
          title: job.title,
          department: (job as any).department || 'Not specified',
          location: job.location || 'Not specified',
          hiringManager: job.assignedTo?.name || (job as any).hiringManager || '-',
          openings: job.openings,
          pipelineStages: (job as any).pipelineStages || [],
          status: statusMap[job.status] || 'Open',
          createdDate: formatDateDMY(createdAt),
          isAging,
        };
      });

      setClientJobs(mappedJobs);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
      setClientJobs([]);
    } finally {
      setLoadingJobs(false);
    }
  }, [client?.id, isHqOverrideMode]);

  useEffect(() => {
    void refreshClientJobs();
  }, [refreshClientJobs]);

  // Fetch contacts for the client
  useEffect(() => {
    void refreshClientContacts();
  }, [refreshClientContacts]);

  // Fetch scheduled meetings when schedule tab is active or client changes
  useEffect(() => {
    const fetchScheduledMeetings = async () => {
      if (!client?.id || activeTab !== 'schedule') {
        return;
      }
      if (isHqOverrideMode) {
        setScheduledMeetings([]);
        setLoadingMeetings(false);
        return;
      }

      setLoadingMeetings(true);
      try {
        const meetings = await apiGetClientScheduledMeetings(client.id);
        console.log('Fetched scheduled meetings response:', meetings);
        console.log('Meetings data:', meetings.data);
        setScheduledMeetings(meetings.data || []);
      } catch (error) {
        console.error('Failed to fetch scheduled meetings:', error);
        setScheduledMeetings([]);
      } finally {
        setLoadingMeetings(false);
      }
    };

    fetchScheduledMeetings();
  }, [client?.id, activeTab, isHqOverrideMode]);

  // Tenant drawer engine: missing mandatory fields + overdue meetings/follow-ups.
  useEffect(() => {
    if (!drawerIsOpen || !client?.id || propIsAddMode || isHqOverrideMode) return;
    let cancelled = false;

    const run = async () => {
      let meetings: ScheduledMeeting[] = scheduledMeetings;
      try {
        const res = await apiGetClientScheduledMeetings(client.id);
        meetings = res.data || [];
        if (!cancelled) setScheduledMeetings(meetings);
      } catch {
        // keep existing list
      }
      if (cancelled) return;

      const analysis = analyzeClientDrawer(
        client as unknown as Record<string, unknown>,
        meetings as unknown as Array<Record<string, unknown>>,
      );
      if (!analysis) return;
      const result = await alertDrawerAnalysis(analysis);
      if (cancelled || result.action !== 'fill') return;
      if (result.focus === 'overdue' || result.focus === 'both') {
        setActiveTab('schedule');
      } else {
        setActiveTab('overview');
        setOverviewEditMode(true);
      }
    };

    const timer = window.setTimeout(() => {
      void run();
    }, 800);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // Intentionally keyed on client id / open state — not every meetings refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerIsOpen, client?.id, propIsAddMode, isHqOverrideMode]);

  // Reset form when entering add mode
  useEffect(() => {
    if (isAddMode) {
      timezoneManuallyEditedRef.current = false;
      // Reset form to empty values when opening in add mode
      setOverviewEditForm((prev) => ({
        ...prev,
        companyName: '',
        logo: '',
        industry: '',
        companySize: '',
        website: '',
        linkedin: '',
        location: '',
        city: '',
        country: '',
        countryCode: '',
        directorName: '',
        contactEmail: '',
        contactPhone: '',
        contactEmails: [''],
        contactPhones: [''],
        hiringLocations: '',
        timezone: '',
        priority: '',
        sla: '',
        servicesNeeded: '',
        expectedBusinessValue: '',
        nextFollowUpDue: '',
        status: 'ACTIVE' as 'ACTIVE' | 'ON_HOLD' | 'INACTIVE',
        assignedToId: '',
        // Add-Lead-mirroring fields — reset to their Add-form defaults.
        companyLinks: [''],
        directorSalutation: '',
        designation: '',
        state: '',
        latitude: null,
        longitude: null,
        leadStatusValue: 'Active',
        assignedToIds: [],
        agreementsFileName: '',
        agreementsFileUrl: '',
        agreementsUploadedAt: '',
        ...emptyAgreementTerms(),
        ...syncClientTeamMembers(),
        postServiceKycForm: emptyPostServiceKycForm(),
        dynamicOtherDetails: [],
        emailNotAvailable: false,
        phoneNotAvailable: false,
        occasions: emptyLeadOccasionForm(),
      }));
      resetClientLogoDraft();
      setAddClientSectionsOpen(DEFAULT_ADD_CLIENT_SECTIONS);
      if (initialOpenAiChat) {
        setClientAiChatHistory([]);
        setClientAiChatOpen(true);
        setAddClientAiFlowStage('chat');
      } else {
        resetClientAiAssistant();
      }
      setPendingAgreementsFile(null);
      setPendingKycFiles([]);
      setPendingPostServiceKycFiles(createEmptyPendingPostServiceKycFiles());
      setRemovedPostServiceKycFileIds([]);
      // Set edit mode to true so form is visible
      setOverviewEditMode(true);
      // Set active tab to overview
      setActiveTab('overview');
      setAddClientTab('details');
    } else {
      // Normal view mode should not inherit edit mode from a prior add flow
      setOverviewEditMode(false);
      resetClientLogoDraft();
      resetClientAiAssistant();
    }
  }, [isAddMode, client?.id, initialOpenAiChat, resetClientAiAssistant]);

  useEffect(() => {
    if (isAddMode || !client?.id) return;

    if (initialMode === 'edit') {
      startOverviewEdit();
      return;
    }

    setOverviewEditMode(false);
  }, [isAddMode, initialMode, client?.id]);

  const primaryTabs = useMemo(() => {
    void orgRecruitmentUiVersion;
    const all = [
    { id: 'overview' as const, label: 'Overview', icon: LayoutGrid },
    { id: 'contacts' as const, label: 'Contacts', icon: Users },
    { id: 'jobs' as const, label: 'Jobs', icon: Briefcase },
    { id: 'placements' as const, label: 'Placements', icon: Award },
    { id: 'billing' as const, label: 'Billing', icon: CreditCard },
    { id: 'activity' as const, label: 'Activity', icon: Activity },
    { id: 'schedule' as const, label: 'Schedule', icon: CalendarPlus },
    { id: 'chat' as const, label: 'Chat', icon: MessageSquare },
    { id: 'notes' as const, label: 'Remarks', icon: StickyNote },
    { id: 'files' as const, label: 'Files', icon: Paperclip },
  ];
    let tabs = isOrgBillingNavEnabled() ? all : all.filter((t) => t.id !== 'billing');
    if (isHqOverrideMode) {
      tabs = tabs.filter((t) => t.id !== 'jobs' && t.id !== 'placements' && t.id !== 'billing');
    }
    return tabs;
  }, [orgRecruitmentUiVersion, isHqOverrideMode]);

  const revenue = client?.revenue ?? `$${(Number(client?.placements ?? 0) * 3.5).toFixed(1)}k`;
  const teamMemberContactIds = useMemo(
    () => new Set(clientTeamMemberContacts.map((contact) => contact.id)),
    [clientTeamMemberContacts],
  );
  const primaryClientContact =
    clientContacts.find((contact) => contact.isPrimary && !teamMemberContactIds.has(contact.id)) ||
    clientContacts.find(
      (contact) =>
        !teamMemberContactIds.has(contact.id) &&
        String(contact.designation || '').trim().toLowerCase() === 'director',
    ) ||
    clientContacts.find((contact) => !teamMemberContactIds.has(contact.id)) ||
    null;
  const primaryClientContactEmail = primaryClientContact?.email && !primaryClientContact.email.includes('@placeholder.local') ? primaryClientContact.email : '';
  const primaryClientContactPhone = primaryClientContact?.phone || '';
  const clientRecordForDisplay = fullClientData || client;
  const locationFields = resolveClientCityStateCountry(clientRecordForDisplay || {});
  const companyLinksValue = buildCompanyLinksFromClient({
    website: fullClientData?.website || client?.website,
    linkedin: fullClientData?.linkedin || client?.linkedin,
  })
    .filter(Boolean)
    .join(' | ');
  const statusValue = resolveClientStatusLabel({
    leadStatus: fullClientData?.leadStatus || client?.leadStatus,
    leadStatusValue: fullClientData?.leadStatusValue || client?.leadStatusValue,
    stage: fullClientData?.stage || client?.stage,
  });
  const businessValue = fullClientData?.expectedBusinessValue || client?.expectedBusinessValue || '';
  const servicesNeededValue = fullClientData?.servicesNeeded || client?.servicesNeeded || '';
  const assignedToValue = fullClientData?.owner?.name || client?.owner?.name || '';
  const viewDynamicFields = filterImportedDynamicOtherDetails(
    fullClientData?.otherDetails ?? client?.otherDetails ?? null,
  );
  const phaseOneJobs = clientJobs.filter((job) => job.status !== 'Paused');

  // Don't render if no client and not in add mode
  if (!client && !isAddMode) {
    return null;
  }

  const headerLogoSrc = getClientLogoSrc(
    logoRemoved
      ? ''
      : pendingClientLogoPreview ||
          fullClientData?.logo ||
          client?.logo ||
          '',
  );

  const drawerTree = (
    <AnimatePresence mode="wait">
      {(client || isAddMode) && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => void requestClientDrawerClose()}
            className={`fixed inset-0 ${isAddMode && addClientAiFlowStage === 'chat' ? 'z-[500]' : stackClassName} bg-slate-950/55 backdrop-blur-md pointer-events-auto`}
            data-drawer-skip-dirty="true"
          />
          <div
            className={`pointer-events-none fixed inset-0 ${
              isAddMode && addClientAiFlowStage === 'chat' ? 'z-[501]' : stackClassName
            } flex flex-col items-center justify-center gap-3 overflow-y-auto p-3 sm:gap-4 sm:p-6`}
          >
            <motion.div
              key="panel"
              ref={clientDrawerPanelRef}
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="client-detail-modal-title"
              className={`pointer-events-auto relative flex h-[min(92vh,920px)] w-full ${
                isAddMode && addClientAiFlowStage === 'chat' ? 'max-w-5xl' : 'max-w-6xl'
              } flex-col overflow-hidden ${
                isAddMode && addClientAiFlowStage
                  ? 'rounded-[28px] border-0 bg-white shadow-[0_40px_120px_-24px_rgba(15,23,42,0.45)] ring-1 ring-white/70'
                  : 'rounded-2xl border border-slate-200/80 bg-white shadow-2xl ring-1 ring-slate-900/5'
              }`}
            >
            {/* Sticky Header */}
            <div
              className={`shrink-0 ${
                isAddMode && addClientAiFlowStage
                  ? 'border-b border-indigo-100/70 bg-gradient-to-r from-indigo-50/95 via-violet-50/50 to-white'
                  : 'border-b border-slate-200 bg-white'
              }`}
            >
              <div className="p-5 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 flex items-center gap-3">
                  {isAddMode && addClientAiFlowStage ? (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30">
                      <Sparkles size={20} />
                    </div>
                  ) : null}
                  {!isAddMode && (
                  <>
                    <input
                      ref={clientLogoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleClientLogoFileChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => clientLogoInputRef.current?.click()}
                      disabled={uploadingClientLogo}
                      title={
                        headerLogoSrc
                          ? 'Change client image'
                          : 'Upload client image'
                      }
                      className="group relative w-12 h-12 rounded-xl overflow-hidden border border-slate-200 flex-shrink-0 bg-slate-50 disabled:cursor-default"
                    >
                      {headerLogoSrc ? (
                        <ImageWithFallback
                          src={headerLogoSrc}
                          alt={client?.name || ''}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-slate-300">
                          <Building2 size={22} />
                        </span>
                      )}
                      <span className="absolute inset-0 flex items-center justify-center bg-slate-900/45 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                        {uploadingClientLogo ? (
                          <span className="text-[10px] font-semibold text-white">…</span>
                        ) : (
                          <Camera size={16} className="text-white" />
                        )}
                      </span>
                    </button>
                  </>
                  )}
                  <div className="min-w-0">
                    <h2 id="client-detail-modal-title" className="text-lg font-bold tracking-tight text-slate-900 truncate">
                      {isAddMode ? 'Add New Client' : fullClientData?.name || client?.name}
                    </h2>
                    {isAddMode ? (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {addClientAiFlowStage === 'chat'
                          ? 'Step 1 — chat with AI to capture client details'
                          : addClientAiFlowStage === 'form'
                            ? 'Step 2 — review and edit the AI-filled form'
                            : 'Create a new client and capture company details'}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isAddMode ? (
                    <>
                      {addClientAiFlowStage !== 'chat' ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (clientAiGate.locked) {
                              clientAiGate.confirmAndUnlock();
                              return;
                            }
                            setClientAiChatOpen(true);
                            setAddClientAiFlowStage('chat');
                          }}
                          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                            clientAiGate.locked
                              ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                              : addClientAiFlowStage === 'form'
                                ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                                : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                          }`}
                          title={
                            clientAiGate.locked
                              ? `Locked — needs ${clientAiGate.cost} coins`
                              : addClientAiFlowStage === 'form'
                                ? 'Go back to AI chat'
                                : `Create with AI (${clientAiGate.cost} coins per chat message)`
                          }
                        >
                          {clientAiGate.locked ? <Lock size={14} /> : <Sparkles size={14} />}
                          {addClientAiFlowStage === 'form' ? 'Back to chat' : 'Create with AI'}
                          <AiCoinLockBadge featureId="ai.client_chat" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void requestClientDrawerClose()}
                        className="rounded-full border border-slate-200/90 bg-white/80 px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:bg-white hover:text-slate-900"
                      >
                        Cancel
                      </button>
                      {addClientAiFlowStage !== 'chat' ? (
                        <button
                          type="button"
                          onClick={saveOverviewEdit}
                          disabled={isCreateClientDisabled || uploadingAgreements || uploadingKyc}
                          className="rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Create Client
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <>
                      {activeTab === 'overview' && !overviewEditMode && (
                        <button
                          type="button"
                          onClick={startOverviewEdit}
                          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit Client"
                        >
                          <Edit2 size={18} />
                        </button>
                      )}
                      {isHqOverrideMode && onCreateTenant && client?.id && !overviewEditMode ? (
                        <button
                          type="button"
                          onClick={() => onCreateTenant(client.id)}
                          className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
                          title="Create tenant"
                        >
                          Create tenant
                        </button>
                      ) : null}
                      {activeTab === 'overview' && overviewEditMode && (
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
                            onClick={saveOverviewEdit}
                            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Save
                          </button>
                        </>
                      )}
                  {!isHqOverrideMode ? (
                    <>
                      <button
                        type="button"
                        onClick={() => { setActiveTab('jobs'); void openCreateJobDrawer(); }}
                        disabled={!canCreateJob}
                        className={`p-2 rounded-lg transition-colors ${
                          canCreateJob
                            ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                            : 'text-slate-300 cursor-not-allowed'
                        }`}
                        title={canCreateJob ? 'Add Job' : "You don't have permission to create jobs"}
                      >
                        <Briefcase size={18} />
                      </button>
                      {onSendToRecruitment ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (!client || sendingToRecruitment) return;
                            onSendToRecruitment(client);
                          }}
                          disabled={!client || sendingToRecruitment}
                          className={`p-2 rounded-lg transition-colors ${
                            client?.recruitmentEnabled
                              ? 'text-amber-500 hover:text-amber-700 hover:bg-amber-50'
                              : 'text-slate-400 hover:text-amber-700 hover:bg-amber-50'
                          }`}
                          title={
                            client?.recruitmentEnabled
                              ? 'Forward to more members in Recruitment'
                              : 'Send to Recruitment'
                          }
                        >
                          <Send size={18} />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={openSendMessageForm}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Message Client"
                      >
                        <MessageCircle size={18} />
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    onClick={openDeleteClientForm}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete Client"
                  >
                    <Trash2 size={18} />
                  </button>
                      <DrawerCloseButton onClick={() => void requestClientDrawerClose()} />
                    </>
                  )}
                </div>
              </div>
              {/* Quick stats chips */}
              {!isAddMode && (
              <div className="px-5 pb-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold">
                  <Briefcase size={14} className="text-slate-500" />
                    Open Jobs: {client?.openJobs || 0}
                </span>
                {client?.recruitmentEnabled ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 text-xs font-semibold">
                    <Send size={14} className="text-amber-600" />
                    In Recruitment
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold">
                  <Award size={14} className="text-indigo-500" />
                    Placements: {client?.placements || 0}
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold">
                  <CreditCard size={14} className="text-emerald-500" />
                  Revenue: {revenue}
                </span>
              </div>
              )}
            </div>

            {isAddMode && addClientAiFlowStage ? (
              <AddClientAiFlowProgress stage={addClientAiFlowStage} />
            ) : null}

            {isAddMode && addClientAiFlowStage === 'form' ? (
              <div className="mx-5 mb-3 shrink-0 flex items-start gap-3 rounded-2xl bg-gradient-to-r from-indigo-50 to-violet-50 px-4 py-3 ring-1 ring-indigo-100">
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
                  <Sparkles size={14} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-indigo-950">AI filled this client for you</p>
                  <p className="mt-0.5 text-xs text-indigo-800/80">
                    Review the form, upload logo/agreement/KYC files if needed, then create the client.
                  </p>
                </div>
              </div>
            ) : null}

            {isAddMode && addClientAiFlowStage === 'chat' ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <ClientAiChatDrawer
                  stageMode
                  isOpen
                  onClose={() => void requestClientDrawerClose()}
                  form={overviewEditForm as unknown as Record<string, unknown>}
                  onApplyGenerated={handleApplyClientAiGenerated}
                  onExpandSections={() => {
                    setAddClientSectionsOpen({
                      company: true,
                      location: true,
                      contacts: true,
                      qualification: true,
                      other: true,
                    });
                  }}
                  chatHistory={clientAiChatHistory}
                  onChatHistoryChange={setClientAiChatHistory}
                  onContinue={() => {
                    setAddClientAiFlowStage('form');
                    setClientAiChatOpen(false);
                    setAddClientSectionsOpen({
                      company: true,
                      location: true,
                      contacts: true,
                      qualification: true,
                      other: true,
                    });
                    setAddClientTab('details');
                  }}
                />
              </div>
            ) : (
              <>
            {/* Tabs */}
            {!isAddMode && (
              <DrawerTabBar
                ariaLabel="Client sections"
                tabs={primaryTabs}
                activeId={activeTab}
                onChange={setActiveTab}
              />
            )}

            {/* Tab content */}
            <div className="relative flex min-h-0 flex-1 flex-col">
              <div className={`flex-1 overflow-y-auto ${DRAWER_FORM_SCROLL_BG}`}>
              <div className="p-5">
                {isAddMode ? (
                  <div className="space-y-5">
                    <div className="rounded-2xl bg-slate-100/95 p-1.5 shadow-sm ring-1 ring-slate-200/80">
                    <div className={`grid grid-cols-1 gap-1 ${
                      addClientTabs.length >= 3 ? 'sm:grid-cols-3' : addClientTabs.length === 2 ? 'sm:grid-cols-2' : ''
                    }`}>
                      {addClientTabs.map((tab) => {
                          const Icon = tab.icon;
                          const active = addClientTab === tab.id;
                          return (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setAddClientTab(tab.id)}
                              className={`flex items-start gap-3 rounded-xl px-3 py-3 text-left transition-all duration-200 ${
                                active
                                  ? 'bg-white text-indigo-700 shadow-md shadow-indigo-500/10 ring-1 ring-indigo-100'
                                  : 'bg-white/70 text-slate-600 hover:bg-white hover:text-slate-900'
                              }`}
                            >
                              <span
                                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                  active ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                <Icon size={16} />
                              </span>
                              <span className="min-w-0">
                                <span className={`block text-sm font-semibold ${active ? 'text-indigo-800' : 'text-slate-900'}`}>
                                  {tab.label}
                                </span>
                                <span className={`mt-0.5 block text-[11px] leading-snug ${active ? 'text-indigo-600/80' : 'text-slate-500'}`}>
                                  {tab.subtitle}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {addClientTab === 'details' ? (
                    <div className="space-y-5">
                    <DrawerSectionCard
                      title="Company Details"
                      subtitle="Organization name, logo, and online presence"
                      icon={Building2}
                      accent="blue"
                      collapsible
                      open={addClientSectionsOpen.company}
                      onOpenChange={() => toggleAddClientSection('company')}
                    >
                              {/* Company Logo uploader — kept on Add Client even though Add Lead doesn't have one,
                                  so the client gets a logo immediately during onboarding. */}
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Company Logo</label>
                                <input
                                  ref={clientLogoInputRef}
                                  type="file"
                                  accept="image/*"
                                  onChange={handleClientLogoFileChange}
                                  className="hidden"
                                />
                                <div className="flex items-center gap-4">
                                  <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0">
                                    {clientLogoPreview ? (
                                      <ImageWithFallback
                                        src={getClientLogoSrc(clientLogoPreview)}
                                        alt="Client logo preview"
                                        className="w-full h-full object-cover block"
                                      />
                                    ) : (
                                      <Building2 size={24} className="text-slate-300" />
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => clientLogoInputRef.current?.click()}
                                      disabled={uploadingClientLogo}
                                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
                                    >
                                      <Upload size={16} />
                                      {uploadingClientLogo ? 'Uploading…' : clientLogoPreview ? 'Replace Logo' : 'Upload Logo'}
                                    </button>
                                    {clientLogoPreview && (
                                      <button
                                        type="button"
                                        onClick={markClientLogoRemoved}
                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                                      >
                                        <Trash2 size={16} />
                                        Remove
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <p className="mt-2 text-xs text-slate-500">PNG, JPG, or SVG. Recommended size 256×256 or larger.</p>
                              </div>
                              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Company *</label>
                                  <input
                                    value={overviewEditForm.companyName}
                                    onChange={(e) => setOverviewEditForm((p) => ({ ...p, companyName: e.target.value }))}
                                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    placeholder="e.g. Acme Inc."
                                  />
                                </div>
                                <div>
                                  <div className="mb-1 flex items-center justify-between gap-3">
                                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Company Links</label>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setOverviewEditForm((p) => ({ ...p, companyLinks: [...(p.companyLinks || ['']), ''] }))
                                      }
                                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100"
                                      aria-label="Add company link"
                                    >
                                      <Plus size={14} />
                                    </button>
                                  </div>
                                  <div className="space-y-2">
                                    {(overviewEditForm.companyLinks?.length ? overviewEditForm.companyLinks : ['']).map((link, index) => (
                                      <div key={`add-client-company-link-${index}`} className="flex items-center gap-2">
                                        <input
                                          value={link}
                                          onChange={(e) =>
                                            setOverviewEditForm((p) => {
                                              const next = [...(p.companyLinks?.length ? p.companyLinks : [''])];
                                              next[index] = e.target.value;
                                              return { ...p, companyLinks: next, website: next[0] || '' };
                                            })
                                          }
                                          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                          placeholder="https://company.com or LinkedIn URL"
                                        />
                                        {(overviewEditForm.companyLinks?.length ?? 0) > 1 && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setOverviewEditForm((p) => {
                                                const next = (p.companyLinks?.length ? p.companyLinks : ['']).filter((_, i) => i !== index);
                                                return {
                                                  ...p,
                                                  companyLinks: next.length ? next : [''],
                                                  website: (next[0] ?? '') || '',
                                                };
                                              })
                                            }
                                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-red-500"
                                            aria-label={`Remove company link ${index + 1}`}
                                          >
                                            <Trash2 size={16} />
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                    </DrawerSectionCard>

                    <DrawerSectionCard
                      title="Location & Industry"
                      subtitle="Where the company operates"
                      icon={MapPin}
                      accent="emerald"
                      collapsible
                      open={addClientSectionsOpen.location}
                      onOpenChange={() => toggleAddClientSection('location')}
                    >
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <LeadLocationFields
                            location={overviewEditForm.location ?? ''}
                            city={overviewEditForm.city}
                            state={overviewEditForm.state}
                            country={overviewEditForm.country}
                            countryCode={overviewEditForm.countryCode}
                            latitude={overviewEditForm.latitude}
                            longitude={overviewEditForm.longitude}
                            showDetectedHint={false}
                            deviceLocationMode="country-preview"
                            onLocationChange={(next) =>
                              setOverviewEditForm((p) => ({ ...p, location: next }))
                            }
                            onSelect={(s: LocationSelection) => {
                              timezoneManuallyEditedRef.current = false;
                              setOverviewEditForm((p) => mergeClientLocationSelection(p, s));
                            }}
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <AddLeadFieldLabel label="Industry" icon={Briefcase} iconClassName="text-emerald-500" />
                          <IndustryMultiSelect
                            value={overviewEditForm.industry ?? ''}
                            onChange={(industry) => setOverviewEditForm((p) => ({ ...p, industry }))}
                            companyName={overviewEditForm.companyName}
                            placeholder="Type an industry (e.g. technology, healthcare)"
                          />
                          <p className="mt-1 text-[11px] text-slate-400">
                            Select one or more industries. Press Enter to add a custom industry.
                          </p>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            <Clock size={12} className="text-slate-400" />
                            Timezone
                          </label>
                          <ClientTimezoneSelect
                            value={overviewEditForm.timezone}
                            onManualChange={() => {
                              timezoneManuallyEditedRef.current = true;
                            }}
                            onChange={(timezone) =>
                              setOverviewEditForm((p) => ({ ...p, timezone }))
                            }
                            placeholder="Select timezone…"
                          />
                        </div>
                      </div>
                    </DrawerSectionCard>

                    <DrawerSectionCard
                      title="Contacts"
                      subtitle="Director and team member details"
                      icon={Users}
                      accent="violet"
                      collapsible
                      open={addClientSectionsOpen.contacts}
                      onOpenChange={() => toggleAddClientSection('contacts')}
                    >
                      <div className="space-y-4">
                          <DirectorContactFields
                            directorSalutation={overviewEditForm.directorSalutation}
                            contactPerson={overviewEditForm.directorName}
                            emails={overviewEditForm.contactEmails}
                            phones={overviewEditForm.contactPhones}
                            email={overviewEditForm.contactEmail}
                            phone={overviewEditForm.contactPhone}
                            countryCode={overviewEditForm.countryCode}
                            countryName={overviewEditForm.country}
                            allowNotAvailable
                            emailNotAvailable={Boolean(overviewEditForm.emailNotAvailable)}
                            phoneNotAvailable={Boolean(overviewEditForm.phoneNotAvailable)}
                            onEmailNotAvailableChange={(emailNotAvailable) => {
                              setOverviewEditForm((p) => ({
                                ...p,
                                emailNotAvailable,
                                ...(emailNotAvailable ? { contactEmails: [''], contactEmail: '' } : {}),
                              }));
                            }}
                            onPhoneNotAvailableChange={(phoneNotAvailable) => {
                              setOverviewEditForm((p) => ({
                                ...p,
                                phoneNotAvailable,
                                ...(phoneNotAvailable ? { contactPhones: [''], contactPhone: '' } : {}),
                              }));
                            }}
                            onDirectorSalutationChange={(value) =>
                              setOverviewEditForm((p) => ({ ...p, directorSalutation: value }))
                            }
                            onContactPersonChange={(value) =>
                              setOverviewEditForm((p) => ({ ...p, directorName: value }))
                            }
                            onEmailsChange={(contactEmails, primaryEmail) => {
                              setOverviewEditForm((p) => ({
                                ...p,
                                contactEmails,
                                contactEmail: primaryEmail,
                                emailNotAvailable: primaryEmail.trim() ? false : p.emailNotAvailable,
                              }));
                            }}
                            onPhonesChange={(contactPhones, primaryPhone) => {
                              setOverviewEditForm((p) => ({
                                ...p,
                                contactPhones,
                                contactPhone: primaryPhone,
                                phoneNotAvailable: primaryPhone.trim() ? false : p.phoneNotAvailable,
                              }));
                            }}
                          />
                          <TeamMemberOptionalFields
                            requireTeamName={false}
                            countryCode={overviewEditForm.countryCode}
                            countryName={overviewEditForm.country}
                            members={overviewEditForm.teamMembers}
                            onChange={(teamMembers) =>
                              setOverviewEditForm((p) => ({ ...p, ...syncClientTeamMembers(teamMembers) }))
                            }
                          />
                      </div>
                    </DrawerSectionCard>

                    <DrawerSectionCard
                      title="Qualification & Services"
                      subtitle="Status, assignment, and business details"
                      icon={Megaphone}
                      accent="amber"
                      collapsible
                      open={addClientSectionsOpen.qualification}
                      onOpenChange={() => toggleAddClientSection('qualification')}
                    >
                              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                {clientFieldVisibility.status ? (
                                  <div>
                                    <div className="mb-1 flex items-center justify-between gap-3">
                                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</label>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setShowAddClientLeadStatusInput((prev) => !prev);
                                          setNewClientLeadStatusValue('');
                                        }}
                                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                                      >
                                        <Plus className="h-3.5 w-3.5" />
                                        Add status
                                      </button>
                                    </div>
                                    <CatalogOptionDropdown
                                      value={overviewEditForm.leadStatusValue || 'Active'}
                                      options={clientLeadStatusOptions}
                                      defaultOptions={DEFAULT_CLIENT_STATUS_LABELS}
                                      deleting={deletingClientLeadStatus}
                                      placeholder="Active"
                                      onSelect={(status) =>
                                        setOverviewEditForm((p) => ({
                                          ...p,
                                          leadStatusValue: status,
                                          status: clientStatusLabelToBackend(status),
                                        }))
                                      }
                                      onDelete={(status) =>
                                        deleteClientLeadStatusOption(status, (nextStatus) =>
                                          setOverviewEditForm((p) => ({
                                            ...p,
                                            leadStatusValue: nextStatus,
                                            status: clientStatusLabelToBackend(nextStatus),
                                          })),
                                        )
                                      }
                                    />
                                    {showAddClientLeadStatusInput ? (
                                      <div className="mt-2 flex items-center gap-2">
                                        <input
                                          value={newClientLeadStatusValue}
                                          onChange={(e) => setNewClientLeadStatusValue(e.target.value)}
                                          className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                          placeholder="Enter new status"
                                        />
                                        <button
                                          type="button"
                                          onClick={() =>
                                            addClientLeadStatusOption((status) =>
                                              setOverviewEditForm((p) => ({
                                                ...p,
                                                leadStatusValue: status,
                                                status: clientStatusLabelToBackend(status),
                                              }))
                                            )
                                          }
                                          disabled={savingClientLeadStatus}
                                          className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          {savingClientLeadStatus ? 'Adding...' : 'Add'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setShowAddClientLeadStatusInput(false);
                                            setNewClientLeadStatusValue('');
                                          }}
                                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    ) : null}
                                  </div>
                                ) : null}
                                {clientFieldVisibility.interestLevel ? (
                                  <div>
                                    <div className="mb-1 flex items-center justify-between gap-3">
                                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Interest Level</label>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setShowAddClientPriorityInput((prev) => !prev);
                                        setNewClientPriorityValue('');
                                      }}
                                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                      Add level
                                    </button>
                                  </div>
                                  <CatalogOptionDropdown
                                    value={overviewEditForm.priority || 'Medium'}
                                    options={clientPriorityOptions}
                                    defaultOptions={DEFAULT_CLIENT_PRIORITY_LABELS}
                                    deleting={deletingClientPriority}
                                    placeholder="Medium"
                                    onSelect={(priority) =>
                                      setOverviewEditForm((p) => ({ ...p, priority }))
                                    }
                                    onDelete={(priority) =>
                                      deleteClientPriorityOption(priority, (nextPriority) =>
                                        setOverviewEditForm((p) => ({ ...p, priority: nextPriority }))
                                      )
                                    }
                                  />
                                  {showAddClientPriorityInput ? (
                                    <div className="mt-2 flex items-center gap-2">
                                      <input
                                        value={newClientPriorityValue}
                                        onChange={(e) => setNewClientPriorityValue(e.target.value)}
                                        className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        placeholder="Enter new interest level"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          addClientPriorityOption((priority) =>
                                            setOverviewEditForm((p) => ({ ...p, priority }))
                                          )
                                        }
                                        disabled={savingClientPriority}
                                        className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        {savingClientPriority ? 'Adding...' : 'Add'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setShowAddClientPriorityInput(false);
                                          setNewClientPriorityValue('');
                                        }}
                                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : null}
                                  </div>
                                ) : null}
                                {clientFieldVisibility.assignedTo ? (
                                  <div className="sm:col-span-2">
                                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Assigned To</label>
                                    <LeadAssigneesMultiSelect
                                      members={recruiters}
                                      value={overviewEditForm.assignedToIds ?? (overviewEditForm.assignedToId ? [overviewEditForm.assignedToId] : [])}
                                      loading={loadingRecruiters}
                                      assignmentModule={isHqOverrideMode ? undefined : 'Clients'}
                                      onChange={(ids) => {
                                        setOverviewEditForm((p) => ({
                                          ...p,
                                          assignedToIds: ids,
                                          assignedToId: ids[0] ?? '',
                                        }));
                                      }}
                                    />
                                  </div>
                                ) : null}
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Services Needed</label>
                                <ServicesNeededSelect
                                  value={overviewEditForm.servicesNeeded}
                                  onChange={(servicesNeeded) => setOverviewEditForm((p) => ({ ...p, servicesNeeded }))}
                                  industry={overviewEditForm.industry ?? ''}
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Expected Business Value</label>
                                <textarea
                                  value={overviewEditForm.expectedBusinessValue}
                                  onChange={(e) => setOverviewEditForm((p) => ({ ...p, expectedBusinessValue: e.target.value }))}
                                  rows={3}
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                                  placeholder="e.g. Potential annual business of $50,000"
                                />
                              </div>
                              <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-4 space-y-3">
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
                                      <div key={`client-dyn-a-${idx}`} className="flex flex-wrap items-center gap-2">
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
                    </DrawerSectionCard>

                    <DrawerSectionCard
                      title="Other"
                      subtitle="Add events with name, date, reminder, and email"
                      icon={Gift}
                      accent="indigo"
                      collapsible
                      open={addClientSectionsOpen.other}
                      onOpenChange={() => toggleAddClientSection('other')}
                    >
                      <LeadOccasionFields
                        value={overviewEditForm.occasions || emptyLeadOccasionForm()}
                        contacts={buildLeadOccasionContactOptions({
                          directorName: overviewEditForm.directorName,
                          directorEmail: overviewEditForm.contactEmail,
                          directorEmails: overviewEditForm.contactEmails,
                          teamMembers: overviewEditForm.teamMembers,
                        })}
                        onChange={(occasions) =>
                          setOverviewEditForm((p) => ({ ...p, occasions }))
                        }
                      />
                    </DrawerSectionCard>
                    </div>
                    ) : null}

                    {addClientTab === 'agreements' ? (
                    <DrawerSectionCard
                      title="Agreements & Terms"
                      subtitle="Contract terms and agreement documents"
                      icon={FileText}
                      accent="indigo"
                      collapsible={false}
                      open
                    >
                              <AgreementTermsSection
                                values={overviewEditForm}
                                onChange={(patch) => setOverviewEditForm((p) => ({ ...p, ...patch }))}
                                disabled={uploadingKyc || uploadingAgreements}
                                showContractValidity
                                showTitle={false}
                                levelCatalog={agreementLevelCatalogProps}
                                extractedKeys={extractedAgreementKeys}
                                uploadSlot={
                                  <AgreementDocumentUpload
                                    description=""
                                    pendingFile={pendingAgreementsFile}
                                    onPendingFileChange={(file) => {
                                      setPendingAgreementsFile(file);
                                      if (file) {
                                        setOverviewEditForm((p) => ({ ...p, agreementsFileName: file.name }));
                                      }
                                    }}
                                    onTermsExtracted={applyExtractedAgreementTerms}
                                    isUploading={uploadingAgreements}
                                    uploadSuccess={agreementsUploadFeedback.uploadSuccess}
                                    uploadPercent={agreementsUploadFeedback.uploadPercent}
                                    disabled={uploadingKyc}
                                  />
                                }
                              />
                    </DrawerSectionCard>
                    ) : null}

                    {addClientTab === 'kyc' ? (
                    <DrawerSectionCard
                      title="KYC Form"
                      subtitle="Identity verification and compliance documents"
                      icon={Shield}
                      accent="emerald"
                      collapsible={false}
                      open
                    >
                              <KycDocumentsField
                                pendingFiles={pendingKycFiles}
                                onPendingFilesChange={setPendingKycFiles}
                                description=""
                                uploading={uploadingKyc}
                                uploadSuccess={kycUploadFeedback.uploadSuccess}
                                uploadPercent={kycUploadFeedback.uploadPercent}
                                disabled={uploadingAgreements}
                                currentForm={overviewEditForm.postServiceKycForm}
                                onFormExtracted={(postServiceKycForm) =>
                                  setOverviewEditForm((p) => ({ ...p, postServiceKycForm }))
                                }
                              />
                              <ClientPostServiceKycFormSection
                                values={overviewEditForm.postServiceKycForm}
                                onChange={(postServiceKycForm) =>
                                  setOverviewEditForm((p) => ({ ...p, postServiceKycForm }))
                                }
                                disabled={uploadingKyc || uploadingAgreements}
                                uploadsBase={uploadsBase}
                                pendingFilesByField={pendingPostServiceKycFiles}
                                onPendingFilesChange={setPendingPostServiceKycFilesForField}
                                onRemoveStoredFile={removeStoredPostServiceKycFile}
                                onFormExtracted={(postServiceKycForm) =>
                                  setOverviewEditForm((p) => ({ ...p, postServiceKycForm }))
                                }
                              />
                    </DrawerSectionCard>
                    ) : null}

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          const idx = addClientTabs.findIndex((t) => t.id === addClientTab);
                          if (idx > 0) setAddClientTab(addClientTabs[idx - 1]!.id);
                        }}
                        disabled={addClientTab === addClientTabs[0]?.id}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ChevronRight size={16} className="rotate-180" />
                        Back
                      </button>
                      {addClientTab !== addClientTabs[addClientTabs.length - 1]?.id ? (
                        <button
                          type="button"
                          onClick={() => {
                            const idx = addClientTabs.findIndex((t) => t.id === addClientTab);
                            if (idx >= 0 && idx < addClientTabs.length - 1) {
                              setAddClientTab(addClientTabs[idx + 1]!.id);
                            }
                          }}
                          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                        >
                          Next
                          <ChevronRight size={16} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void saveOverviewEdit()}
                          disabled={isCreateClientDisabled || uploadingAgreements || uploadingKyc}
                          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Create Client
                        </button>
                      )}
                    </div>
                  </div>
                ) : showSendMessageForm ? (
                  <div className="space-y-5">
                    <div className="flex items-center gap-3 mb-4">
                      <button
                        type="button"
                        onClick={closeSendMessageForm}
                        className="p-2 -ml-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Back"
                      >
                        <ChevronRight size={20} className="rotate-180" />
                      </button>
                      <h2 className="text-lg font-bold text-slate-900">Send Message</h2>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
                      {/* Channel tabs */}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSendMessageChannel('Email')}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${sendMessageChannel === 'Email' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                          <Mail size={16} />
                          Email
                        </button>
                        <button
                          type="button"
                          onClick={() => setSendMessageChannel('WhatsApp')}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${sendMessageChannel === 'WhatsApp' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                          <WhatsAppIcon size={16} />
                          WhatsApp
                        </button>
                      </div>
                      {/* Select contact(s) */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Select contact(s)</label>
                        <div className="rounded-xl border border-slate-200 bg-white max-h-40 overflow-y-auto">
                          {(!client || (client.contacts ?? []).length === 0) ? (
                            <p className="px-4 py-3 text-sm text-slate-500">No contacts</p>
                          ) : (
                            <ul className="py-1">
                              {(client.contacts ?? []).map((c) => (
                                <li key={c.id}>
                                  <label className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={sendMessageForm.contactIds.includes(c.id)}
                                      onChange={() => toggleSendMessageContact(c.id)}
                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                                    />
                                    <span className="text-sm font-medium text-slate-900">{c.name}</span>
                                    <span className="text-xs text-slate-500">{c.designation}</span>
                                  </label>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                      {/* Template selector */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Template</label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setSendMessageTemplateOpen((v) => !v)}
                            className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-left text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          >
                            <span className={sendMessageForm.templateId ? 'text-slate-900' : 'text-slate-400'}>
                              {MESSAGE_TEMPLATES.find((t) => t.id === sendMessageForm.templateId)?.label ?? 'Select template'}
                            </span>
                            <ChevronDown size={16} className="text-slate-400 shrink-0" />
                          </button>
                          {sendMessageTemplateOpen && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setSendMessageTemplateOpen(false)} aria-hidden />
                              <ul className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                                {MESSAGE_TEMPLATES.map((t) => (
                                  <li key={t.id}>
                                    <button
                                      type="button"
                                      onClick={() => { setSendMessageForm((prev) => ({ ...prev, templateId: t.id })); setSendMessageTemplateOpen(false); }}
                                      className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${sendMessageForm.templateId === t.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                                    >
                                      {t.label}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </>
                          )}
                        </div>
                      </div>
                      {/* Message editor */}
                      <div>
                        <label htmlFor="send-message-body" className="block text-sm font-medium text-slate-700 mb-2">Message</label>
                        <textarea
                          id="send-message-body"
                          value={sendMessageForm.message}
                          onChange={(e) => setSendMessageForm((prev) => ({ ...prev, message: e.target.value }))}
                          placeholder="Type your message..."
                          rows={5}
                          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y"
                        />
                      </div>
                      {/* Attachments */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Attachments</label>
                        <label className="relative flex rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-4 cursor-pointer hover:border-slate-300 hover:bg-slate-50/80 transition-colors">
                          <input
                            type="file"
                            multiple
                            className="sr-only"
                            onChange={(e) => setSendMessageForm((prev) => ({ ...prev, attachmentNames: Array.from(e.target.files ?? []).map((f) => f.name).join(', ') }))}
                          />
                          <div className="flex items-center justify-center gap-2 w-full">
                            <Paperclip size={18} className="text-slate-400 shrink-0" />
                            <span className="text-sm text-slate-500">{sendMessageForm.attachmentNames || 'Click or drag files to attach'}</span>
                          </div>
                        </label>
                      </div>
                      {/* Log as activity */}
                      <div className="flex items-center justify-between">
                        <label htmlFor="send-message-log-activity" className="text-sm font-medium text-slate-700">Log as activity</label>
                        <input
                          id="send-message-log-activity"
                          type="checkbox"
                          checked={sendMessageForm.logAsActivity}
                          onChange={(e) => setSendMessageForm((prev) => ({ ...prev, logAsActivity: e.target.checked }))}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={closeSendMessageForm}
                        className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => { closeSendMessageForm(); if (client) onMessage?.(client.id); }}
                        className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                ) : showChangeStageForm ? (
                  <div className="space-y-5">
                    <div className="flex items-center gap-3 mb-4">
                      <button
                        type="button"
                        onClick={closeChangeStageForm}
                        className="p-2 -ml-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Back"
                      >
                        <ChevronRight size={20} className="rotate-180" />
                      </button>
                      <h2 className="text-lg font-bold text-slate-900">Change Client Stage</h2>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Client Stage</label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => { setChangeStageDropdownOpen((v) => !v); setChangeStageReasonDropdownOpen(false); }}
                            className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-left text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          >
                            <span className={changeStageForm.stage ? 'text-slate-900' : 'text-slate-400'}>{changeStageForm.stage}</span>
                            <ChevronDown size={16} className="text-slate-400 shrink-0" />
                          </button>
                          {changeStageDropdownOpen && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setChangeStageDropdownOpen(false)} aria-hidden />
                              <ul className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                                {CLIENT_STAGES.map((s) => (
                                  <li key={s}>
                                    <button
                                      type="button"
                                      onClick={() => { setChangeStageForm((prev) => ({ ...prev, stage: s, reason: s === 'On Hold' || s === 'Inactive' ? prev.reason : '' })); setChangeStageDropdownOpen(false); }}
                                      className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${changeStageForm.stage === s ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                                    >
                                      {s}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </>
                          )}
                        </div>
                      </div>
                      {needsReason && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Reason <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => { setChangeStageReasonDropdownOpen((v) => !v); setChangeStageDropdownOpen(false); }}
                              className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-left text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            >
                              <span className={changeStageForm.reason ? 'text-slate-900' : 'text-slate-400'}>{changeStageForm.reason || 'Select reason'}</span>
                              <ChevronDown size={16} className="text-slate-400 shrink-0" />
                            </button>
                            {changeStageReasonDropdownOpen && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setChangeStageReasonDropdownOpen(false)} aria-hidden />
                                <ul className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                                  {STAGE_REASONS.map((r) => (
                                    <li key={r}>
                                      <button
                                        type="button"
                                        onClick={() => { setChangeStageForm((prev) => ({ ...prev, reason: r })); setChangeStageReasonDropdownOpen(false); }}
                                        className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${changeStageForm.reason === r ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                                      >
                                        {r}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={closeChangeStageForm}
                        className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={needsReason && !changeStageForm.reason}
                        onClick={closeChangeStageForm}
                        className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Update Stage
                      </button>
                    </div>
                  </div>
                ) : showArchiveClientForm ? (
                  <div className="space-y-5">
                    <div className="flex items-center gap-3 mb-4">
                      <button
                        type="button"
                        onClick={closeArchiveClientForm}
                        className="p-2 -ml-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Back"
                      >
                        <ChevronRight size={20} className="rotate-180" />
                      </button>
                      <h2 className="text-lg font-bold text-slate-900">Archive Client</h2>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                      <p className="text-sm text-slate-600 leading-relaxed">
                        Archiving will hide the client from active lists but retain historical data.
                      </p>
                    </div>
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={closeArchiveClientForm}
                        className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => { closeArchiveClientForm(); /* onArchive?.(client.id); */ }}
                        className="px-4 py-2.5 text-sm font-medium text-white bg-slate-600 rounded-xl hover:bg-slate-700 transition-colors"
                      >
                        Archive
                      </button>
                    </div>
                  </div>
                ) : showDeleteClientForm ? (
                  <div className="space-y-5">
                    <div className="flex items-center gap-3 mb-4">
                      <button
                        type="button"
                        onClick={closeDeleteClientForm}
                        className="p-2 -ml-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Back"
                      >
                        <ChevronRight size={20} className="rotate-180" />
                      </button>
                      <h2 className="text-lg font-bold text-slate-900">Delete Client</h2>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
                      <p className="text-sm text-slate-600 leading-relaxed">
                        This action permanently deletes the client and all associated records.
                      </p>
                      <div>
                        <label htmlFor="delete-confirm-name" className="block text-sm font-medium text-slate-700 mb-2">
                          Type the company name to confirm
                        </label>
                        <input
                          id="delete-confirm-name"
                          type="text"
                          value={deleteConfirmName}
                          onChange={(e) => setDeleteConfirmName(e.target.value)}
                          placeholder={client?.name || 'Client name'}
                          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={closeDeleteClientForm}
                        className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={!deleteConfirmMatches}
                        onClick={() => { closeDeleteClientForm(); if (client) onDelete?.(client.id); onClose(); }}
                        className="px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Delete Client
                      </button>
                    </div>
                  </div>
                ) : activeTab === 'overview' ? (
                  showScheduleMeetingForm ? (
                    <ScheduleMeetingForm
                      entityType="client"
                      entityId={client?.id || ''}
                      showBackButton={true}
                      onBack={() => setShowScheduleMeetingForm(false)}
                      onSuccess={async () => {
                        setShowScheduleMeetingForm(false);
                        // Refresh scheduled meetings list and switch to schedule tab
                        if (client?.id) {
                          try {
                            const meetings = await apiGetClientScheduledMeetings(client.id);
                            setScheduledMeetings(meetings.data || []);
                            setActiveTab('schedule');
                          } catch (error) {
                            console.error('Failed to refresh meetings:', error);
                          }
                        }
                      }}
                      onCancel={() => setShowScheduleMeetingForm(false)}
                    />
                  ) : (
                    <div className="space-y-5">
                      {!overviewEditMode ? (
                        <>
                          <DrawerSectionCard
                            title="Client Information"
                            subtitle="Company profile, contacts, and qualification"
                            icon={Building2}
                            accent="blue"
                            collapsible
                            open={overviewOpen.leadInformation}
                            onOpenChange={() => toggleOverviewSection('leadInformation')}
                          >
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <div><FieldRow label="Company *" value={fullClientData?.name || client?.name || ''} /></div>
                              <div><FieldRow label="Company Links" value={companyLinksValue} href={!!companyLinksValue} /></div>
                              <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                  <FieldRow
                                    label="Director Name"
                                    value={formatDirectorDisplay(
                                      fullClientData?.directorSalutation ||
                                        client?.directorSalutation ||
                                        directorFromOtherDetails(
                                          fullClientData?.otherDetails || client?.otherDetails,
                                        ).directorSalutation,
                                      primaryClientContact?.name ||
                                        directorFromOtherDetails(
                                          fullClientData?.otherDetails || client?.otherDetails,
                                        ).directorName ||
                                        '',
                                    )}
                                  />
                                  <FieldRow
                                    label="Email *"
                                    value={formatContactListMultiline(
                                      fullClientData?.emails || client?.emails,
                                      primaryClientContactEmail,
                                    )}
                                    href={!!primaryClientContactEmail}
                                    multiline
                                  />
                                  <FieldRow
                                    label="Mobile Number"
                                    value={formatContactListMultiline(
                                      fullClientData?.phones || client?.phones,
                                      primaryClientContactPhone,
                                    )}
                                    multiline
                                  />
                                </div>
                              </div>
                              {(() => {
                                const teamMembers = resolveClientTeamMembersForForm(
                                  clientTeamMemberContacts,
                                  fullClientData || client,
                                  primaryClientContact?.id,
                                ).filter(teamMemberHasAnyValue);
                                if (teamMembers.length === 0) return null;
                                return (
                                  <div className="sm:col-span-2 space-y-2">
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Team Member</p>
                                    {teamMembers.map((tm, index) => (
                                      <div
                                        key={tm.id || `client-team-member-${index}`}
                                        className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:grid-cols-3"
                                      >
                                        <FieldRow
                                          label="Name"
                                          value={formatDirectorDisplay(
                                            tm.teamMemberSalutation,
                                            tm.teamMemberName || tm.teamMemberDesignation,
                                          )}
                                        />
                                        <FieldRow label="Email" value={tm.teamMemberEmail ?? ''} href={!!tm.teamMemberEmail} />
                                        <FieldRow label="Mobile Number" value={tm.teamMemberPhone ?? ''} />
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}
                              <div><FieldRow label="Location" value={fullClientData?.location || client?.location || ''} /></div>
                              <div><FieldRow label="City" value={locationFields.city} /></div>
                              <div><FieldRow label="State" value={locationFields.state} /></div>
                              <div><FieldRow label="Country" value={locationFields.country} /></div>
                              <div><FieldRow label="Timezone" value={fullClientData?.timezone || client?.timezone || ''} /></div>
                              <div><FieldRow label="Industry" value={formatIndustriesDisplay(fullClientData?.industry || client?.industry || '')} /></div>
                              {clientFieldVisibility.status ? (
                                <div><FieldRow label="Status" value={statusValue} /></div>
                              ) : null}
                              {clientFieldVisibility.interestLevel ? (
                                <div><FieldRow label="Interest Level" value={fullClientData?.priority || client?.priority || ''} /></div>
                              ) : null}
                              {clientFieldVisibility.assignedTo ? (
                                <div><FieldRow label="Assigned To" value={assignedToValue} /></div>
                              ) : null}
                              <div><FieldRow label="Services Needed" value={servicesNeededValue} /></div>
                              <div><FieldRow label="Expected Business Value" value={businessValue} /></div>
                              {viewDynamicFields.length ? (
                                <div className="sm:col-span-2">
                                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Dynamic Fields</p>
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                      {viewDynamicFields.map((item, index) => (
                                        <div key={`${item.label}-${index}`} className="text-sm">
                                          <span className="font-semibold text-slate-900">{item.label}:</span>{' '}
                                          <span className="text-slate-600">{item.value}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </DrawerSectionCard>

                          {(() => {
                            const occasions = readLeadOccasionFromOtherDetails(
                              fullClientData?.otherDetails || client?.otherDetails,
                            );
                            const events = occasions.events || [];
                            if (events.length === 0) return null;
                            return (
                              <DrawerSectionCard
                                title="Other"
                                subtitle="Events with name, date, reminder, and email"
                                icon={Gift}
                                accent="indigo"
                                collapsible
                                open={overviewOpen.other !== false}
                                onOpenChange={() => toggleOverviewSection('other')}
                              >
                                <div className="space-y-2">
                                  {events.map((event, index) => (
                                    <div
                                      key={event.id || `client-event-view-${index}`}
                                      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                                    >
                                      <p className="font-semibold text-slate-900">
                                        {event.eventName?.trim() || `Event ${index + 1}`}
                                      </p>
                                      <p className="mt-1 text-xs text-slate-500">
                                        {[
                                          event.date?.trim(),
                                          event.reminder?.trim() && event.reminder !== 'No reminder'
                                            ? event.reminder
                                            : null,
                                          event.name?.trim(),
                                          event.email?.trim(),
                                        ]
                                          .filter(Boolean)
                                          .join(' · ') || 'No details'}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </DrawerSectionCard>
                            );
                          })()}

                          {canViewClientAgreements ? (
                          <DrawerSectionCard
                            title="Agreements & Terms"
                            subtitle="Contract terms and agreement documents"
                            icon={FileText}
                            accent="indigo"
                            collapsible
                            open={overviewOpen.agreementsTerms}
                            onOpenChange={() => toggleOverviewSection('agreementsTerms')}
                          >
                            {(fullClientData?.agreementsFileUrl ||
                              client?.agreementsFileUrl ||
                              formatAgreementTermsSummary(
                                agreementTermsFromRecord(fullClientData || client),
                              ).length > 0) ? (
                              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-2">
                                {fullClientData?.agreementsFileUrl || client?.agreementsFileUrl ? (
                                  <a
                                    href={String(fullClientData?.agreementsFileUrl || client?.agreementsFileUrl)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-sm text-slate-900 hover:underline"
                                  >
                                    <Paperclip size={14} className="text-slate-500" />
                                    <span className="truncate max-w-[280px]">
                                      {fullClientData?.agreementsFileName ||
                                        client?.agreementsFileName ||
                                        'Agreement document'}
                                    </span>
                                  </a>
                                ) : null}
                                {formatAgreementTermsSummary(
                                  agreementTermsFromRecord(fullClientData || client),
                                ).map((line) => (
                                  <p key={line} className="text-sm text-slate-700">
                                    {line}
                                  </p>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-slate-500">No agreement details added yet.</p>
                            )}
                          </DrawerSectionCard>
                          ) : null}

                          <DrawerSectionCard
                            title="KYC Form"
                            subtitle="Identity verification and compliance documents"
                            icon={Shield}
                            accent="emerald"
                            collapsible
                            open={overviewOpen.kycForm}
                            onOpenChange={() => toggleOverviewSection('kycForm')}
                          >
                            <KycDocumentsView files={clientKycFiles} uploadsBase={uploadsBase} />
                            <ClientPostServiceKycSummary
                              values={postServiceKycFormFromRecord(fullClientData || client)}
                              uploadsBase={uploadsBase}
                            />
                          </DrawerSectionCard>
                        </>
                      ) : (
                        <>
                          <DrawerSectionCard
                            title="Client Information"
                            subtitle="Company profile, contacts, and qualification"
                            icon={Building2}
                            accent="blue"
                            collapsible
                            open={overviewOpen.leadInformation}
                            onOpenChange={() => toggleOverviewSection('leadInformation')}
                          >
                            <div className="space-y-4">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                                  Client Image
                                </label>
                                <div className="flex items-center gap-4">
                                  <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0">
                                    {clientLogoPreview ? (
                                      <ImageWithFallback
                                        src={getClientLogoSrc(clientLogoPreview)}
                                        alt="Client logo preview"
                                        className="w-full h-full object-cover block"
                                      />
                                    ) : (
                                      <Building2 size={24} className="text-slate-300" />
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => clientLogoInputRef.current?.click()}
                                      disabled={uploadingClientLogo}
                                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
                                    >
                                      <Upload size={16} />
                                      {uploadingClientLogo
                                        ? 'Uploading…'
                                        : clientLogoPreview
                                          ? 'Replace Image'
                                          : 'Upload Image'}
                                    </button>
                                    {clientLogoPreview ? (
                                      <button
                                        type="button"
                                        onClick={markClientLogoRemoved}
                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                                      >
                                        <Trash2 size={16} />
                                        Remove
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                                <p className="mt-2 text-xs text-slate-500">
                                  PNG, JPG, or SVG. Recommended size 256×256 or larger.
                                </p>
                              </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Company *</label>
                                <input
                                  value={overviewEditForm.companyName}
                                  onChange={(e) => setOverviewEditForm((p) => ({ ...p, companyName: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                  placeholder="e.g. Acme Inc."
                                />
                              </div>
                              <div>
                                <div className="mb-1 flex items-center justify-between gap-3">
                                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Company Links</label>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setOverviewEditForm((p) => ({ ...p, companyLinks: [...(p.companyLinks || ['']), ''] }))
                                    }
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100"
                                    aria-label="Add company link"
                                  >
                                    <Plus size={14} />
                                  </button>
                                </div>
                                <div className="space-y-2">
                                  {(overviewEditForm.companyLinks?.length ? overviewEditForm.companyLinks : ['']).map((link, index) => (
                                    <div key={`client-company-link-${index}`} className="flex items-center gap-2">
                                      <input
                                        value={link}
                                        onChange={(e) =>
                                          setOverviewEditForm((p) => {
                                            const next = [...(p.companyLinks?.length ? p.companyLinks : [''])];
                                            next[index] = e.target.value;
                                            // Keep the first link mirrored into `website` so existing code paths still work.
                                            return { ...p, companyLinks: next, website: next[0] || '' };
                                          })
                                        }
                                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        placeholder="https://company.com or LinkedIn URL"
                                      />
                                      {(overviewEditForm.companyLinks?.length ?? 0) > 1 && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setOverviewEditForm((p) => {
                                              const next = (p.companyLinks?.length ? p.companyLinks : ['']).filter((_, i) => i !== index);
                                              return {
                                                ...p,
                                                companyLinks: next.length ? next : [''],
                                                website: (next[0] ?? '') || '',
                                              };
                                            })
                                          }
                                          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-red-500"
                                          aria-label={`Remove company link ${index + 1}`}
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="sm:col-span-2">
                                <DirectorContactFields
                                  boxed
                                  directorSalutation={overviewEditForm.directorSalutation}
                                  contactPerson={overviewEditForm.directorName}
                                  emails={overviewEditForm.contactEmails}
                                  phones={overviewEditForm.contactPhones}
                                  email={overviewEditForm.contactEmail}
                                  phone={overviewEditForm.contactPhone}
                                  countryCode={overviewEditForm.countryCode}
                                  countryName={overviewEditForm.country}
                                  onDirectorSalutationChange={(value) =>
                                    setOverviewEditForm((p) => ({ ...p, directorSalutation: value }))
                                  }
                                  onContactPersonChange={(value) =>
                                    setOverviewEditForm((p) => ({ ...p, directorName: value }))
                                  }
                                  onEmailsChange={(contactEmails, primaryEmail) => {
                                    setOverviewEditForm((p) => ({ ...p, contactEmails, contactEmail: primaryEmail }));
                                  }}
                                  onPhonesChange={(contactPhones, primaryPhone) => {
                                    setOverviewEditForm((p) => ({ ...p, contactPhones, contactPhone: primaryPhone }));
                                  }}
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <TeamMemberOptionalFields
                                  requireTeamName={false}
                                  countryCode={overviewEditForm.countryCode}
                                  countryName={overviewEditForm.country}
                                  members={overviewEditForm.teamMembers}
                                  onChange={(teamMembers) =>
                                    setOverviewEditForm((p) => ({ ...p, ...syncClientTeamMembers(teamMembers) }))
                                  }
                                />
                              </div>
                              <CscLocationFields
                                location={overviewEditForm.location ?? ''}
                                city={overviewEditForm.city}
                                state={overviewEditForm.state}
                                country={overviewEditForm.country}
                                countryCode={overviewEditForm.countryCode}
                                latitude={overviewEditForm.latitude}
                                longitude={overviewEditForm.longitude}
                                showDetectedHint={false}
                                onLocationChange={(next) =>
                                  setOverviewEditForm((p) => ({ ...p, location: next }))
                                }
                                onSelect={(s: LocationSelection) => {
                                  timezoneManuallyEditedRef.current = false;
                                  setOverviewEditForm((p) => mergeClientLocationSelection(p, s));
                                }}
                              />
                              <div>
                                <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                  <Clock size={12} className="text-slate-400" />
                                  Timezone
                                </label>
                                <ClientTimezoneSelect
                                  value={overviewEditForm.timezone}
                                  onManualChange={() => {
                                    timezoneManuallyEditedRef.current = true;
                                  }}
                                  onChange={(timezone) =>
                                    setOverviewEditForm((p) => ({ ...p, timezone }))
                                  }
                                  placeholder="Select timezone…"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Industry</label>
                                <IndustryMultiSelect
                                  value={overviewEditForm.industry ?? ''}
                                  onChange={(industry) => setOverviewEditForm((p) => ({ ...p, industry }))}
                                  companyName={overviewEditForm.companyName}
                                  placeholder="Type an industry (e.g. technology, healthcare)"
                                />
                              </div>
                              {clientFieldVisibility.status ? (
                                <div>
                                  <div className="mb-1 flex items-center justify-between gap-3">
                                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</label>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setShowAddClientLeadStatusInput((prev) => !prev);
                                        setNewClientLeadStatusValue('');
                                      }}
                                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                      Add status
                                    </button>
                                  </div>
                                  <CatalogOptionDropdown
                                    value={overviewEditForm.leadStatusValue || 'Active'}
                                    options={clientLeadStatusOptions}
                                    defaultOptions={DEFAULT_CLIENT_STATUS_LABELS}
                                    deleting={deletingClientLeadStatus}
                                    placeholder="Active"
                                    onSelect={(status) =>
                                      setOverviewEditForm((p) => ({
                                        ...p,
                                        leadStatusValue: status,
                                        status: clientStatusLabelToBackend(status),
                                      }))
                                    }
                                    onDelete={(status) =>
                                      deleteClientLeadStatusOption(status, (nextStatus) =>
                                        setOverviewEditForm((p) => ({
                                          ...p,
                                          leadStatusValue: nextStatus,
                                          status: clientStatusLabelToBackend(nextStatus),
                                        })),
                                      )
                                    }
                                  />
                                  {showAddClientLeadStatusInput ? (
                                    <div className="mt-2 flex items-center gap-2">
                                      <input
                                        value={newClientLeadStatusValue}
                                        onChange={(e) => setNewClientLeadStatusValue(e.target.value)}
                                        className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        placeholder="Enter new status"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          addClientLeadStatusOption((status) =>
                                            setOverviewEditForm((p) => ({
                                              ...p,
                                              leadStatusValue: status,
                                              status: clientStatusLabelToBackend(status),
                                            }))
                                          )
                                        }
                                        disabled={savingClientLeadStatus}
                                        className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        {savingClientLeadStatus ? 'Adding...' : 'Add'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setShowAddClientLeadStatusInput(false);
                                          setNewClientLeadStatusValue('');
                                        }}
                                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                              {clientFieldVisibility.interestLevel ? (
                                <div>
                                  <div className="mb-1 flex items-center justify-between gap-3">
                                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Interest Level</label>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setShowAddClientPriorityInput((prev) => !prev);
                                        setNewClientPriorityValue('');
                                      }}
                                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                      Add level
                                    </button>
                                  </div>
                                  <CatalogOptionDropdown
                                    value={overviewEditForm.priority || 'Medium'}
                                    options={clientPriorityOptions}
                                    defaultOptions={DEFAULT_CLIENT_PRIORITY_LABELS}
                                    deleting={deletingClientPriority}
                                    placeholder="Medium"
                                    onSelect={(priority) =>
                                      setOverviewEditForm((p) => ({ ...p, priority }))
                                    }
                                    onDelete={(priority) =>
                                      deleteClientPriorityOption(priority, (nextPriority) =>
                                        setOverviewEditForm((p) => ({ ...p, priority: nextPriority }))
                                      )
                                    }
                                  />
                                  {showAddClientPriorityInput ? (
                                    <div className="mt-2 flex items-center gap-2">
                                      <input
                                        value={newClientPriorityValue}
                                        onChange={(e) => setNewClientPriorityValue(e.target.value)}
                                        className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        placeholder="Enter new interest level"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          addClientPriorityOption((priority) =>
                                            setOverviewEditForm((p) => ({ ...p, priority }))
                                          )
                                        }
                                        disabled={savingClientPriority}
                                        className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        {savingClientPriority ? 'Adding...' : 'Add'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setShowAddClientPriorityInput(false);
                                          setNewClientPriorityValue('');
                                        }}
                                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                              {clientFieldVisibility.assignedTo ? (
                                <div className="sm:col-span-2">
                                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Assigned To</label>
                                  <LeadAssigneesMultiSelect
                                    members={recruiters}
                                    value={overviewEditForm.assignedToIds ?? (overviewEditForm.assignedToId ? [overviewEditForm.assignedToId] : [])}
                                    loading={loadingRecruiters}
                                    assignmentModule={isHqOverrideMode ? undefined : 'Clients'}
                                    onChange={(ids) => {
                                      setOverviewEditForm((p) => ({
                                        ...p,
                                        assignedToIds: ids,
                                        assignedToId: ids[0] ?? '',
                                      }));
                                    }}
                                  />
                                </div>
                              ) : null}
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Services Needed</label>
                                <ServicesNeededSelect
                                  value={overviewEditForm.servicesNeeded}
                                  onChange={(servicesNeeded) => setOverviewEditForm((p) => ({ ...p, servicesNeeded }))}
                                  industry={overviewEditForm.industry ?? ''}
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Expected Business Value</label>
                                <textarea
                                  value={overviewEditForm.expectedBusinessValue}
                                  onChange={(e) => setOverviewEditForm((p) => ({ ...p, expectedBusinessValue: e.target.value }))}
                                  rows={3}
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                                  placeholder="e.g. Potential annual business of $50,000"
                                />
                              </div>
                              <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-4 space-y-3">
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
                                      <div key={`client-dyn-b-${idx}`} className="flex flex-wrap items-center gap-2">
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
                          </DrawerSectionCard>

                          <DrawerSectionCard
                            title="Other"
                            subtitle="Add events with name, date, reminder, and email"
                            icon={Gift}
                            accent="indigo"
                            collapsible
                            open={overviewOpen.other !== false}
                            onOpenChange={() => toggleOverviewSection('other')}
                          >
                            <LeadOccasionFields
                              value={overviewEditForm.occasions || emptyLeadOccasionForm()}
                              contacts={buildLeadOccasionContactOptions({
                                directorName: overviewEditForm.directorName,
                                directorEmail: overviewEditForm.contactEmail,
                                directorEmails: overviewEditForm.contactEmails,
                                teamMembers: overviewEditForm.teamMembers,
                              })}
                              onChange={(occasions) =>
                                setOverviewEditForm((p) => ({ ...p, occasions }))
                              }
                            />
                          </DrawerSectionCard>

                          {canManageClientAgreements ? (
                          <DrawerSectionCard
                            title="Agreements & Terms"
                            subtitle="Contract terms and agreement documents"
                            icon={FileText}
                            accent="indigo"
                            collapsible
                            open={overviewOpen.agreementsTerms}
                            onOpenChange={() => toggleOverviewSection('agreementsTerms')}
                          >
                            <AgreementTermsSection
                              values={overviewEditForm}
                              onChange={(patch) => setOverviewEditForm((p) => ({ ...p, ...patch }))}
                              disabled={uploadingKyc || uploadingAgreements}
                              showContractValidity
                              levelCatalog={agreementLevelCatalogProps}
                              extractedKeys={extractedAgreementKeys}
                              uploadSlot={
                                <>
                                  {overviewEditForm.agreementsFileUrl && !pendingAgreementsFile ? (
                                    <div className="mb-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900">
                                      <Paperclip size={14} className="shrink-0 text-slate-500" />
                                      <a
                                        href={overviewEditForm.agreementsFileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="min-w-0 flex-1 truncate hover:underline"
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
                                          if (agreementsInputRef.current) agreementsInputRef.current.value = '';
                                        }}
                                        className="shrink-0 rounded-lg p-1 text-red-500 hover:bg-red-50"
                                        aria-label="Remove agreement"
                                      >
                                        <X size={16} strokeWidth={2.25} />
                                      </button>
                                    </div>
                                  ) : null}
                                  <AgreementDocumentUpload
                                    description=""
                                    pendingFile={pendingAgreementsFile}
                                    onPendingFileChange={(file) => {
                                      setPendingAgreementsFile(file);
                                      if (file) {
                                        setOverviewEditForm((p) => ({ ...p, agreementsFileName: file.name }));
                                      }
                                    }}
                                    currentTerms={overviewEditForm}
                                    onTermsExtracted={applyExtractedAgreementTerms}
                                    isUploading={uploadingAgreements}
                                    uploadSuccess={agreementsUploadFeedback.uploadSuccess}
                                    uploadPercent={agreementsUploadFeedback.uploadPercent}
                                    disabled={uploadingKyc}
                                  />
                                </>
                              }
                            />
                          </DrawerSectionCard>
                          ) : canViewClientAgreements ? (
                          <DrawerSectionCard
                            title="Agreements & Terms"
                            subtitle="Contract terms and agreement documents"
                            icon={FileText}
                            accent="indigo"
                            collapsible
                            open={overviewOpen.agreementsTerms}
                            onOpenChange={() => toggleOverviewSection('agreementsTerms')}
                          >
                            {(overviewEditForm.agreementsFileUrl ||
                              formatAgreementTermsSummary(overviewEditForm).length > 0) ? (
                              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-2">
                                {overviewEditForm.agreementsFileUrl ? (
                                  <a
                                    href={overviewEditForm.agreementsFileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-sm text-slate-900 hover:underline"
                                  >
                                    <Paperclip size={14} className="text-slate-500" />
                                    <span className="truncate max-w-[280px]">
                                      {overviewEditForm.agreementsFileName || 'Agreement document'}
                                    </span>
                                  </a>
                                ) : null}
                                {formatAgreementTermsSummary(overviewEditForm).map((line) => (
                                  <p key={line} className="text-sm text-slate-700">
                                    {line}
                                  </p>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-slate-500">No agreement details added yet.</p>
                            )}
                          </DrawerSectionCard>
                          ) : null}

                          <DrawerSectionCard
                            title="KYC Form"
                            subtitle="Identity verification and compliance documents"
                            icon={Shield}
                            accent="emerald"
                            collapsible
                            open={overviewOpen.kycForm}
                            onOpenChange={() => toggleOverviewSection('kycForm')}
                          >
                            <KycDocumentsField
                              pendingFiles={pendingKycFiles}
                              onPendingFilesChange={setPendingKycFiles}
                              description=""
                              storedFiles={clientKycFiles}
                              uploadsBase={uploadsBase}
                              onRemoveStored={async (fileId) => {
                                await deleteFile(fileId);
                                await refetchClientFiles();
                              }}
                              uploading={uploadingKyc}
                              uploadSuccess={kycUploadFeedback.uploadSuccess}
                              uploadPercent={kycUploadFeedback.uploadPercent}
                              disabled={uploadingAgreements}
                              currentForm={overviewEditForm.postServiceKycForm}
                              onFormExtracted={(postServiceKycForm) =>
                                setOverviewEditForm((p) => ({ ...p, postServiceKycForm }))
                              }
                            />
                            <ClientPostServiceKycFormSection
                              values={overviewEditForm.postServiceKycForm}
                              onChange={(postServiceKycForm) =>
                                setOverviewEditForm((p) => ({ ...p, postServiceKycForm }))
                              }
                              disabled={uploadingKyc || uploadingAgreements}
                              uploadsBase={uploadsBase}
                              pendingFilesByField={pendingPostServiceKycFiles}
                              onPendingFilesChange={setPendingPostServiceKycFilesForField}
                              onRemoveStoredFile={removeStoredPostServiceKycFile}
                              onFormExtracted={(postServiceKycForm) =>
                                setOverviewEditForm((p) => ({ ...p, postServiceKycForm }))
                              }
                            />
                          </DrawerSectionCard>
                        </>
                      )}
                    <div className="hidden">
                    {/* 1. Company Snapshot Card */}
                    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleOverviewSection('companySnapshot')}
                        className="w-full p-5 flex items-center justify-between gap-2 text-left hover:bg-slate-50/50 transition-colors"
                      >
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                          <Building2 size={14} className="text-slate-400" />
                          Company Snapshot
                        </h4>
                        {overviewOpen.companySnapshot ? (
                          <ChevronDown size={18} className="text-slate-400 shrink-0" />
                        ) : (
                          <ChevronRight size={18} className="text-slate-400 shrink-0" />
                        )}
                      </button>
                      {overviewOpen.companySnapshot && (
                        <div className="px-5 pb-5 pt-0 border-t border-slate-100">
                          {!overviewEditMode ? (
                            <>
                              {client && (
                                <>
                          <FieldRow label="Company Name" value={fullClientData?.name || client?.name || 'Ã¢â‚¬â€'} />
                          <FieldRow label="Industry" value={formatIndustriesDisplay(fullClientData?.industry || client?.industry || '') || '—'} />
                          <FieldRow label="Company size" value={fullClientData?.companySize || client?.companySize || 'Ã¢â‚¬â€'} />
                          <FieldRow label="Website" value={fullClientData?.website || client?.website || 'Ã¢â‚¬â€'} href={!!(fullClientData?.website || client?.website)} />
                          <FieldRow label="LinkedIn" value={fullClientData?.linkedin || client?.linkedin || 'Ã¢â‚¬â€'} href={!!(fullClientData?.linkedin || client?.linkedin)} />
                          <FieldRow label="Location" value={fullClientData?.location || client?.location || fullClientData?.hiringLocations || client?.hiringLocations || 'Ã¢â‚¬â€'} />
                          <FieldRow label="Locations / Hiring locations" value={fullClientData?.hiringLocations || client?.hiringLocations || fullClientData?.location || client?.location || 'Not specified'} />
                          <FieldRow label="Timezone" value={fullClientData?.timezone || client?.timezone || 'Ã¢â‚¬â€'} />
                          <FieldRow label="Client since" value={(() => {
                            const clientSince = fullClientData?.clientSince || client?.clientSince;
                            if (!clientSince) return 'Ã¢â‚¬â€';
                            if (typeof clientSince === 'string' && clientSince.includes('-')) {
                              return formatDateDMY(clientSince);
                            }
                            return clientSince;
                          })()} />
                                </>
                              )}
                            </>
                          ) : (
                            <div className="space-y-4 pt-2">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Company Name</label>
                                <input
                                  type="text"
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
                                  companyName={overviewEditForm.companyName}
                                  placeholder="Type an industry (e.g. technology, healthcare)"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Company Size</label>
                                <input
                                  type="text"
                                  value={overviewEditForm.companySize}
                                  onChange={(e) => setOverviewEditForm((p) => ({ ...p, companySize: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Location</label>
                                <input
                                  type="text"
                                  value={overviewEditForm.location}
                                  onChange={(e) => setOverviewEditForm((p) => ({ ...p, location: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                  placeholder="e.g., panvel, Raigad, India"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Hiring Locations</label>
                                <input
                                  type="text"
                                  value={overviewEditForm.hiringLocations || ''}
                                  onChange={(e) => setOverviewEditForm((p) => ({ ...p, hiringLocations: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                  placeholder="e.g., panvel, Raigad, India"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Website</label>
                                <input
                                  type="text"
                                  value={overviewEditForm.website}
                                  onChange={(e) => setOverviewEditForm((p) => ({ ...p, website: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">LinkedIn</label>
                                <input
                                  type="text"
                                  value={overviewEditForm.linkedin}
                                  onChange={(e) => setOverviewEditForm((p) => ({ ...p, linkedin: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Timezone</label>
                                <ClientTimezoneSelect
                                  value={overviewEditForm.timezone}
                                  onManualChange={() => {
                                    timezoneManuallyEditedRef.current = true;
                                  }}
                                  onChange={(timezone) =>
                                    setOverviewEditForm((p) => ({ ...p, timezone }))
                                  }
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </section>

                    {/* 2. Contact Person Card - Only show in overview mode when contacts exist */}
                    {!isAddMode && client && clientContacts.length > 0 && (
                      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <button
                          type="button"
                          onClick={() => toggleOverviewSection('contactPerson')}
                          className="w-full p-5 flex items-center justify-between gap-2 text-left hover:bg-slate-50/50 transition-colors"
                        >
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <User size={14} className="text-slate-400" />
                            Contact Person
                          </h4>
                          {overviewOpen.contactPerson ? (
                            <ChevronDown size={18} className="text-slate-400 shrink-0" />
                          ) : (
                            <ChevronRight size={18} className="text-slate-400 shrink-0" />
                          )}
                        </button>
                        {overviewOpen.contactPerson && (
                          <div className="px-5 pb-5 pt-0 border-t border-slate-100">
                            {(() => {
                              // Get primary contact (first contact or one marked as primary)
                              const primaryContact = clientContacts.find(c => c.isPrimary) || clientContacts[0];
                              if (!primaryContact) return null;
                              
                              return (
                                <>
                                  <FieldRow label="Contact Name" value={primaryContact.name || 'Ã¢â‚¬â€'} />
                                  <FieldRow label="Designation" value={primaryContact.designation || 'Ã¢â‚¬â€'} />
                                  <FieldRow label="Email" value={primaryContact.email || 'Ã¢â‚¬â€'} href={!!primaryContact.email} />
                                  <FieldRow label="Phone" value={primaryContact.phone || 'Ã¢â‚¬â€'} />
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </section>
                    )}

                    {/* 3. Relationship & Ownership Card */}
                    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleOverviewSection('relationship')}
                        className="w-full p-5 flex items-center justify-between gap-2 text-left hover:bg-slate-50/50 transition-colors"
                      >
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                          <Users size={14} className="text-slate-400" />
                          Relationship & Ownership
                        </h4>
                        {overviewOpen.relationship ? (
                          <ChevronDown size={18} className="text-slate-400 shrink-0" />
                        ) : (
                          <ChevronRight size={18} className="text-slate-400 shrink-0" />
                        )}
                      </button>
                      {overviewOpen.relationship && (
                        <div className="px-5 pb-5 pt-0 border-t border-slate-100">
                          {!overviewEditMode ? (
                            <>
                              {client && (
                                <>
                          <div className="flex flex-col gap-0.5 py-2 border-b border-slate-100">
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Account manager</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <ImageWithFallback src={client.owner.avatar} alt={client.owner.name} className="w-6 h-6 rounded-full border border-slate-200" />
                              <span className="text-sm font-medium text-slate-900">{client.owner.name}</span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-0.5 py-2 border-b border-slate-100">
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Team members</p>
                            <p className="text-sm font-medium text-slate-900">
                              {client.recruiterTeam?.length ? client.recruiterTeam.join(', ') : client.owner.name}
                            </p>
                          </div>
                          <FieldRow label="Client stage" value={client.stage} />
                          <FieldRow label="Priority" value={client.priority ?? 'Ã¢â‚¬â€'} />
                          <FieldRow label="SLA / Response expectations" value={client.sla ?? 'Ã¢â‚¬â€'} />
                          {client?.id ? (
                            <div className="mt-4">
                              <CrossDepartmentClientHandoff
                                clientId={client.id}
                                clientName={client.name || 'Client'}
                              />
                            </div>
                          ) : null}
                                </>
                              )}
                            </>
                          ) : (
                            <div className="space-y-4 pt-2">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Assigned To</label>
                                {assignable.canSelectCompany ? (
                                  <AssignCompanySelect
                                    companies={assignable.companies}
                                    value={assignable.companyId}
                                    onChange={(id) => {
                                      assignable.setCompanyId(id);
                                      setOverviewEditForm((p) => ({
                                        ...p,
                                        ...assignedToSelectionFromId(''),
                                      }));
                                    }}
                                    className="mb-2"
                                  />
                                ) : null}
                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={() => setAssignedToDropdownOpen(!assignedToDropdownOpen)}
                                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 flex items-center justify-between bg-white"
                                  >
                                    <span className="flex items-center gap-2">
                                      {overviewEditForm.assignedToId ? (
                                        (() => {
                                          const selectedUser = (assignable.canSelectCompany ? assignable.users : users).find(u => u.id === overviewEditForm.assignedToId);
                                          return selectedUser ? (
                                            <>
                                              {selectedUser.avatar ? (
                                                <img src={selectedUser.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                                              ) : (
                                                <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center">
                                                  <User size={12} className="text-slate-500" />
                                                </div>
                                              )}
                                              <span className="text-slate-900">{selectedUser.name}</span>
                                            </>
                                          ) : (
                                            <span className="text-slate-500">Select user</span>
                                          );
                                        })()
                                      ) : (
                                        <span className="text-slate-400">Select user</span>
                                      )}
                                    </span>
                                    <ChevronDown size={16} className="text-slate-400" />
                                  </button>
                                  {assignedToDropdownOpen && (
                                    <>
                                      <div className="fixed inset-0 z-10" onClick={() => setAssignedToDropdownOpen(false)} aria-hidden />
                                      <ul className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg max-h-48 overflow-y-auto">
                                        {assignable.canSelectCompany && !assignable.companyId ? (
                                          <li className="px-4 py-2.5 text-sm text-slate-500 text-center">Select a company to see members</li>
                                        ) : (assignable.canSelectCompany ? assignable.loading : loadingUsers) ? (
                                          <li className="px-4 py-2.5 text-sm text-slate-500 text-center">Loading users...</li>
                                        ) : (assignable.canSelectCompany ? assignable.users : users).length === 0 ? (
                                          <li className="px-4 py-2.5 text-sm text-slate-500 text-center">No users available</li>
                                        ) : (
                                          <>
                                            <li>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setOverviewEditForm((p) => ({
                                                    ...p,
                                                    ...assignedToSelectionFromId(''),
                                                  }));
                                                  setAssignedToDropdownOpen(false);
                                                }}
                                                className={`w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${!overviewEditForm.assignedToId ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                                              >
                                                <span className="text-slate-400">Unassigned</span>
                                              </button>
                                            </li>
                                            {(assignable.canSelectCompany ? assignable.users : users).map((user) => (
                                              <li key={user.id}>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setOverviewEditForm((p) => ({
                                                      ...p,
                                                      ...assignedToSelectionFromId(user.id),
                                                    }));
                                                    setAssignedToDropdownOpen(false);
                                                  }}
                                                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${overviewEditForm.assignedToId === user.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                                                >
                                                  {user.avatar ? (
                                                    <img src={user.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                                                  ) : (
                                                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
                                                      <User size={14} className="text-slate-500" />
                                                    </div>
                                                  )}
                                                  <div className="flex-1 min-w-0">
                                                    <div className="font-medium truncate">{user.name}</div>
                                                    {user.role && (
                                                      <div className="text-xs text-slate-500 truncate">{user.role}</div>
                                                    )}
                                                  </div>
                                                </button>
                                              </li>
                                            ))}
                                          </>
                                        )}
                                      </ul>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Priority</label>
                                <input
                                  type="text"
                                  value={overviewEditForm.priority}
                                  onChange={(e) => setOverviewEditForm((p) => ({ ...p, priority: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">SLA / Response expectations</label>
                                <input
                                  type="text"
                                  value={overviewEditForm.sla}
                                  onChange={(e) => setOverviewEditForm((p) => ({ ...p, sla: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </section>

                    {/* 3. Performance Metrics Cards */}
                    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleOverviewSection('performance')}
                        className="w-full p-5 flex items-center justify-between gap-2 text-left hover:bg-slate-50/50 transition-colors"
                      >
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                          <TrendingUp size={14} className="text-slate-400" />
                          Performance metrics
                        </h4>
                        {overviewOpen.performance ? (
                          <ChevronDown size={18} className="text-slate-400 shrink-0" />
                        ) : (
                          <ChevronRight size={18} className="text-slate-400 shrink-0" />
                        )}
                      </button>
                      {overviewOpen.performance && (
                        <div className="p-5 pt-0 border-t border-slate-100 grid grid-cols-2 gap-3">
                          <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Open jobs</p>
                            <p className="text-lg font-bold text-slate-900 mt-0.5">{client?.openJobs ?? 0}</p>
                          </div>
                          <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Candidates in progress</p>
                            <p className="text-lg font-bold text-slate-900 mt-0.5">{client?.candidatesInProgress ?? client?.activeCandidates ?? 0}</p>
                          </div>
                          <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Interviews this week</p>
                            <p className="text-lg font-bold text-slate-900 mt-0.5">{client?.interviewsThisWeek ?? 'Ã¢â‚¬â€'}</p>
                          </div>
                          <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Placements this month</p>
                            <p className="text-lg font-bold text-slate-900 mt-0.5">{client?.placementsThisMonth ?? client?.placements ?? 'Ã¢â‚¬â€'}</p>
                          </div>
                          <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 col-span-2">
                            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Revenue generated</p>
                            <p className="text-lg font-bold text-emerald-800 mt-0.5">{client?.revenueGenerated ?? client?.revenue ?? 'Ã¢â‚¬â€'}</p>
                          </div>
                        </div>
                      )}
                    </section>

                    {/* 4. Client Health Widget */}
                    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleOverviewSection('health')}
                        className="w-full p-5 flex items-center justify-between gap-2 text-left hover:bg-slate-50/50 transition-colors"
                      >
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                          <Heart size={14} className="text-slate-400" />
                          Client health
                        </h4>
                        {overviewOpen.health ? (
                          <ChevronDown size={18} className="text-slate-400 shrink-0" />
                        ) : (
                          <ChevronRight size={18} className="text-slate-400 shrink-0" />
                        )}
                      </button>
                      {overviewOpen.health && (
                        <div className="px-5 pb-5 pt-0 border-t border-slate-100">
                          <div className="flex items-center justify-between gap-3 py-3 border-b border-slate-100">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</span>
                            {(() => {
                              const status = client?.healthStatus ?? 'Good';
                              const s = HEALTH_STYLES[status];
                              return (
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${s.bg} ${s.text}`}>
                                  {status === 'Good' && 'Ã°Å¸Å¸Â¢ '}
                                  {status === 'Needs attention' && 'Ã°Å¸Å¸Â¡ '}
                                  {status === 'At risk' && 'Ã°Å¸â€Â´ '}
                                  {s.label}
                                </span>
                              );
                            })()}
                          </div>
                          <FieldRow label="Last activity" value={client?.lastActivity ?? 'Ã¢â‚¬â€'} />
                          <FieldRow label="Stale jobs count" value={client?.staleJobsCount != null ? String(client.staleJobsCount) : 'Ã¢â‚¬â€'} />
                          <FieldRow label="Pending invoices" value={client?.pendingInvoicesCount != null ? String(client.pendingInvoicesCount) : 'Ã¢â‚¬â€'} />
                          <FieldRow label="Average time-to-fill" value={client?.avgTimeToFill ?? 'Ã¢â‚¬â€'} />
                        </div>
                      )}
                    </section>

                    {/* 5. Quick Actions Strip Ã¢â‚¬â€ always visible, no dropdown */}
                    <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Quick actions</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => { setActiveTab('jobs'); void openCreateJobDrawer(); }}
                          disabled={!canCreateJob}
                          title={canCreateJob ? 'Add Job Requirement' : "You don't have permission to create jobs"}
                          className={`flex items-center justify-center gap-2 py-3 px-4 border rounded-xl text-sm font-medium shadow-sm active:scale-[0.98] transition-all ${
                            canCreateJob
                              ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                              : 'bg-slate-100/60 border-slate-200 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          <Briefcase size={16} className={canCreateJob ? 'text-slate-600' : 'text-slate-400'} />
                          Add Job Requirement
                        </button>
                        {onSendToRecruitment ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (!client || sendingToRecruitment) return;
                              onSendToRecruitment(client);
                            }}
                            disabled={!client || sendingToRecruitment}
                            className={`flex items-center justify-center gap-2 py-3 px-4 border rounded-xl text-sm font-medium shadow-sm active:scale-[0.98] transition-all ${
                              client?.recruitmentEnabled
                                ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-amber-50 hover:border-amber-200'
                            }`}
                            title={
                              client?.recruitmentEnabled
                                ? 'Forward to more members in Recruitment'
                                : 'Send this client to Recruitment'
                            }
                          >
                            <Send size={16} className={client?.recruitmentEnabled ? 'text-amber-600' : 'text-slate-600'} />
                            {client?.recruitmentEnabled ? 'Forward in Recruitment' : 'Send to Recruitment'}
                          </button>
                        ) : null}
                        <button type="button" className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100 hover:border-slate-300 active:scale-[0.98] transition-all">
                          <UserPlus size={16} className="text-slate-600" />
                          Add Contact
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setShowScheduleMeetingForm(true)}
                          className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100 hover:border-slate-300 active:scale-[0.98] transition-all"
                        >
                          <CalendarPlus size={16} className="text-slate-600" />
                          Schedule Meeting / Follow-up
                        </button>
                        <button type="button" className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100 hover:border-slate-300 active:scale-[0.98] transition-all">
                          <FileCheck size={16} className="text-slate-600" />
                          Upload Agreement / SLA
                        </button>
                      </div>
                    </section>
                    </div>
                    </div>
                  )
                ) : activeTab === 'contacts' ? (
                  showAddContactForm ? (
                    <div className="space-y-5">
                      <div className="flex items-center gap-3 mb-4">
                        <button
                          type="button"
                          onClick={() => setShowAddContactForm(false)}
                          className="p-2 -ml-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Back to Contacts"
                        >
                          <ChevronRight size={20} className="rotate-180" />
                        </button>
                        <h2 className="text-lg font-bold text-slate-900">{editingContactId ? 'Edit Contact' : 'Add Contact'}</h2>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
                        <div>
                          <label htmlFor="add-contact-name" className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                          <input
                            id="add-contact-name"
                            type="text"
                            value={addContactForm.fullName}
                            onChange={(e) => setAddContactForm((p) => ({ ...p, fullName: e.target.value }))}
                            placeholder="Full name"
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label htmlFor="add-contact-designation" className="block text-sm font-medium text-slate-700 mb-2">Designation</label>
                          <input
                            id="add-contact-designation"
                            type="text"
                            value={addContactForm.designation}
                            onChange={(e) => setAddContactForm((p) => ({ ...p, designation: e.target.value }))}
                            placeholder="e.g. Head of Talent"
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">Department</label>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setAddContactDeptOpen((v) => !v)}
                              className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-left text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            >
                              <span className={addContactForm.department ? 'text-slate-900' : 'text-slate-400'}>
                                {addContactForm.department || 'Select department'}
                              </span>
                              <ChevronDown size={16} className="text-slate-400" />
                            </button>
                            {addContactDeptOpen && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setAddContactDeptOpen(false)} aria-hidden />
                                <ul className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                                  {ADD_CONTACT_DEPARTMENTS.map((d) => (
                                    <li key={d}>
                                      <button
                                        type="button"
                                        onClick={() => { setAddContactForm((p) => ({ ...p, department: d })); setAddContactDeptOpen(false); }}
                                        className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${addContactForm.department === d ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                                      >
                                        {d}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              </>
                            )}
                          </div>
                        </div>
                        <div>
                          <label htmlFor="add-contact-email" className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                          <input
                            id="add-contact-email"
                            type="email"
                            value={addContactForm.email}
                            onChange={(e) => setAddContactForm((p) => ({ ...p, email: e.target.value }))}
                            placeholder="email@company.com"
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label htmlFor="add-contact-phone" className="block text-sm font-medium text-slate-700 mb-2">Phone Number</label>
                          <input
                            id="add-contact-phone"
                            type="tel"
                            value={addContactForm.phone}
                            onChange={(e) => setAddContactForm((p) => ({ ...p, phone: e.target.value }))}
                            placeholder="+1 (555) 000-0000"
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                        </div>
                        <div className="flex items-center gap-3">
                          <input
                            id="add-contact-whatsapp"
                            type="checkbox"
                            checked={addContactForm.whatsAppSameAsPhone}
                            onChange={(e) => setAddContactForm((p) => ({ ...p, whatsAppSameAsPhone: e.target.checked }))}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <label htmlFor="add-contact-whatsapp" className="text-sm font-medium text-slate-700 cursor-pointer">
                            WhatsApp same as phone
                          </label>
                        </div>
                        <div className="flex items-center gap-3">
                          <input
                            id="add-contact-primary"
                            type="checkbox"
                            checked={addContactForm.isPrimary}
                            onChange={(e) => setAddContactForm((p) => ({ ...p, isPrimary: e.target.checked }))}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <label htmlFor="add-contact-primary" className="text-sm font-medium text-slate-700 cursor-pointer">
                            Primary Contact
                          </label>
                        </div>
                        <div>
                          <label htmlFor="add-contact-notes" className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
                          <textarea
                            id="add-contact-notes"
                            value={addContactForm.notes}
                            onChange={(e) => setAddContactForm((p) => ({ ...p, notes: e.target.value }))}
                            placeholder="Add notes..."
                            rows={3}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddContactForm(false);
                            setEditingContactId(null);
                            resetContactForm();
                          }}
                          className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!client) return;
                            if (!addContactForm.fullName.trim()) {
                              void requestWarning('Full name is required');
                              return;
                            }
                             
                            try {
                              // Split fullName into firstName and lastName
                              const nameParts = addContactForm.fullName.trim().split(/\s+/);
                              const firstName = nameParts[0] || '';
                              const lastName = nameParts.slice(1).join(' ') || '';

                              const contactData: CreateContactData = {
                                firstName,
                                lastName,
                                email: addContactForm.email || undefined,
                                phone: addContactForm.phone || undefined,
                                designation: addContactForm.designation || undefined,
                                department: addContactForm.department || undefined,
                                clientId: client.id,
                                isPrimary: addContactForm.isPrimary,
                                notes: addContactForm.notes || undefined,
                                whatsAppSameAsPhone: addContactForm.whatsAppSameAsPhone,
                                preferredChannel: 'Email', // Default, can be enhanced later
                              };

                              if (editingContactId) {
                                await apiUpdateContact(editingContactId, contactData);
                              } else {
                                await apiCreateContact(contactData);
                              }
                              setShowAddContactForm(false);
                              setEditingContactId(null);
                              resetContactForm();
                              await refreshClientContacts();
                            } catch (error: any) {
                              console.error('Failed to save contact:', error);
                              void requestError(error.message || 'Failed to save contact');
                            }
                          }}
                          className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors"
                        >
                          {editingContactId ? 'Update Contact' : 'Save Contact'}
                        </button>
                      </div>
                    </div>
                  ) : (
                  <div className="relative flex gap-0 min-h-0">
                    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 min-w-0 flex flex-col ${selectedContact ? 'mr-4' : ''}`}>
                      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Contacts</h4>
                        <button
                          type="button"
                          onClick={openAddContactForm}
                          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <UserPlus size={16} />
                          Add Contact
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Name</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Department</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Email</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Phone</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">Primary</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Last contacted</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right w-32">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {loadingContacts ? (
                              <tr>
                                <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
                                  Loading contacts...
                                </td>
                              </tr>
                            ) : clientContacts.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
                                  No contacts yet. Click Add Contact to add one.
                                </td>
                              </tr>
                            ) : (
                              clientContacts.map((contact) => (
                                <tr
                                  key={contact.id}
                                  onClick={() => setSelectedContact(contact)}
                                  className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                                >
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                                        {contact.avatar ? (
                                          <img src={contact.avatar} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                          <span className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-400">
                                            {contact.name.charAt(0)}
                                          </span>
                                        )}
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium text-slate-900">{contact.name}</p>
                                        <p className="text-xs text-slate-500">{contact.designation}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-600">{contact.department}</td>
                                  <td className="px-4 py-3 text-sm text-slate-600 truncate max-w-[140px]">{contact.email}</td>
                                  <td className="px-4 py-3 text-sm text-slate-600">{contact.phone}</td>
                                  <td className="px-4 py-3 text-center">
                                    {contact.isPrimary ? (
                                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600" title="Primary contact">
                                        <span className="sr-only">Primary</span>
                                        <span className="text-[10px] font-bold">Ã¢Å“â€œ</span>
                                      </span>
                                    ) : (
                                      <span className="inline-block w-6 h-6 rounded-full border border-slate-200 bg-white" />
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-xs text-slate-500">{contact.lastContacted}</td>
                                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center justify-end gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleWhatsAppClick(contact)}
                                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                        title="WhatsApp"
                                      >
                                        <WhatsAppIcon size={14} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleEmailClick(contact)}
                                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                        title="Email"
                                      >
                                        <Mail size={14} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleEditContactClick(contact)}
                                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                        title="Edit"
                                      >
                                        <Edit2 size={14} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setContactToDelete(contact)}
                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Delete"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <AnimatePresence>
                      {selectedContact && (
                        <motion.div
                          initial={{ width: 0, opacity: 0 }}
                          animate={{ width: 320, opacity: 1 }}
                          exit={{ width: 0, opacity: 0 }}
                          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                          className="shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col"
                        >
                          <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                            <h4 className="text-sm font-bold text-slate-900 truncate">{selectedContact.name}</h4>
                            <button
                              type="button"
                              onClick={() => setSelectedContact(null)}
                              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                              aria-label="Close"
                            >
                              <X size={18} />
                            </button>
                          </div>
                          <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            <div>
                              <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Contact info</h5>
                              <div className="space-y-1 text-sm">
                                <p className="font-medium text-slate-900">{selectedContact.designation} Ã‚Â· {selectedContact.department}</p>
                                <p className="text-slate-600">{selectedContact.email}</p>
                                <p className="text-slate-600">{selectedContact.phone}</p>
                              </div>
                            </div>
                            <div>
                              <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Preferred communication</h5>
                              <p className="text-sm font-medium text-slate-900">{selectedContact.preferredChannel ?? 'Ã¢â‚¬â€'}</p>
                            </div>
                            <div>
                              <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Notes</h5>
                              <p className="text-sm text-slate-600 whitespace-pre-wrap">{selectedContact.notes || 'No notes.'}</p>
                            </div>
                            <div>
                              <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Activity</h5>
                              <ul className="space-y-2">
                                {(selectedContact.activity ?? []).length === 0 ? (
                                  <li className="text-sm text-slate-500">No activity yet.</li>
                                ) : (
                                  (selectedContact.activity ?? []).map((a, i) => (
                                    <li key={i} className="text-sm border-l-2 border-slate-200 pl-3 py-0.5">
                                      <span className="text-slate-500">{a.date}</span>
                                      <span className="font-medium text-slate-700"> {a.type}</span>
                                      <span className="text-slate-600"> Ã¢â‚¬â€ {a.summary}</span>
                                    </li>
                                  ))
                                )}
                              </ul>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {contactToDelete && (
                      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 p-4">
                        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
                          <h3 className="text-base font-bold text-slate-900">Delete Contact</h3>
                          <p className="mt-2 text-sm text-slate-600">
                            Are you sure you want to delete <span className="font-semibold text-slate-900">{contactToDelete.name}</span>?
                            This action cannot be undone.
                          </p>
                          <div className="mt-5 flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setContactToDelete(null)}
                              disabled={deletingContact}
                              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleDeleteContact}
                              disabled={deletingContact}
                              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                            >
                              {deletingContact ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  )
                ) : activeTab === 'jobs' ? (
                  <div className="space-y-4">
                    {/* Jobs overview widgets */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                          <Briefcase size={20} className="text-blue-600" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Open Jobs</p>
                          <p className="text-lg font-bold text-slate-900">{phaseOneJobs.filter((j) => j.status === 'Open').length || client?.openJobs || 0}</p>
                        </div>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                          <AlertCircle size={20} className="text-amber-600" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Aging Jobs</p>
                          <p className="text-lg font-bold text-slate-900">{phaseOneJobs.filter((j) => j.isAging).length}</p>
                        </div>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <BarChart3 size={16} className="text-slate-400" />
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">By department</p>
                        </div>
                        <div className="space-y-1.5">
                          {(() => {
                            const byDept = phaseOneJobs.reduce<Record<string, number>>((acc, j) => {
                              acc[j.department] = (acc[j.department] ?? 0) + 1;
                              return acc;
                            }, {});
                            const max = Math.max(...Object.values(byDept), 1);
                            return Object.entries(byDept).map(([dept, count]) => (
                              <div key={dept} className="flex items-center gap-2">
                                <span className="text-xs font-medium text-slate-600 w-20 truncate">{dept}</span>
                                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(count / max) * 100}%` }} />
                                </div>
                                <span className="text-xs font-bold text-slate-700 w-5">{count}</span>
                              </div>
                            ));
                          })()}
                          {phaseOneJobs.length === 0 && (
                            <p className="text-xs text-slate-500">No jobs</p>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Jobs table */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Jobs</h4>
                        <button
                          type="button"
                          onClick={() => void openCreateJobDrawer()}
                          disabled={!canCreateJob}
                          title={canCreateJob ? 'Add Job' : "You don't have permission to create jobs"}
                          className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                            canCreateJob
                              ? 'text-white bg-blue-600 hover:bg-blue-700'
                              : 'text-slate-400 bg-slate-100 cursor-not-allowed'
                          }`}
                        >
                          <Briefcase size={16} />
                          Add Job
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Job title</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Department</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Location</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Team Member</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">Openings</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pipeline</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Created</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right w-36">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {loadingJobs ? (
                              <tr>
                                <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">
                                  Loading jobs...
                                </td>
                              </tr>
                            ) : phaseOneJobs.length === 0 ? (
                              <tr>
                                <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">
                                  No jobs yet. Click Add Job to create one.
                                </td>
                              </tr>
                            ) : (
                              phaseOneJobs.map((job: ClientJob) => (
                                <tr key={job.id} className="hover:bg-slate-50/80 transition-colors">
                                  <td className="px-4 py-3">
                                    <p className="text-sm font-medium text-slate-900">{job.title}</p>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-600">{job.department}</td>
                                  <td className="px-4 py-3 text-sm text-slate-600">{job.location}</td>
                                  <td className="px-4 py-3 text-sm text-slate-600">{job.hiringManager}</td>
                                  <td className="px-4 py-3 text-center">
                                    <span className="inline-flex items-center justify-center min-w-[1.5rem] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                                      {job.openings}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex flex-wrap gap-1">
                                      {(job.pipelineStages ?? []).slice(0, 3).map((s, stageIndex) => (
                                        <span
                                          key={`${job.id || job.title}-${s.stage}-${stageIndex}`}
                                          className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium"
                                        >
                                          {s.stage}: {s.count}
                                        </span>
                                      ))}
                                      {(!job.pipelineStages || job.pipelineStages.length === 0) && <span className="text-xs text-slate-400">Ã¢â‚¬â€</span>}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${JOB_STATUS_STYLES[job.status]}`}>
                                      {job.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-xs text-slate-500">{job.createdDate}</td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center justify-end gap-1">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          // debug
                                          // eslint-disable-next-line no-console
                                          console.log('ClientDetailsDrawer: View job clicked', job?.id);
                                          openJobDrawerFromClientJob(job);
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                        title="Edit job"
                                      >
                                        <Pencil size={14} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          void handlePauseJob(job);
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                        title="Pause job"
                                      >
                                        <Pause size={14} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openDuplicateJobDrawer(job);
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                        title="Duplicate job"
                                      >
                                        <Copy size={14} />
                                      </button>
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
                ) : activeTab === 'placements' ? (
                  <div className="space-y-4">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Placements</h4>
                        <p className="text-xs text-slate-500">{(client?.placementList ?? []).length} placements</p>
                      </div>
                      <div className="overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                        <table className="w-full text-left border-collapse min-w-[900px]">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Candidate name</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Job / role</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Placement date</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Team Member</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Fee type</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Amount</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Warranty (days left)</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right w-40">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(!client?.placementList || client.placementList.length === 0) ? (
                              <tr>
                                <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">
                                  No placements yet.
                                </td>
                              </tr>
                            ) : (
                              (client.placementList ?? []).map((pl) => (
                                <tr key={pl.id} className="hover:bg-slate-50/80 transition-colors">
                                  <td className="px-4 py-3">
                                    <p className="text-sm font-medium text-slate-900">{pl.candidateName}</p>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-600">{pl.jobRole}</td>
                                  <td className="px-4 py-3 text-sm text-slate-600">{pl.placementDate}</td>
                                  <td className="px-4 py-3 text-sm text-slate-600">{pl.recruiter}</td>
                                  <td className="px-4 py-3">
                                    <span className="text-xs font-medium text-slate-600">{pl.feeType}</span>
                                  </td>
                                  <td className="px-4 py-3 text-sm font-medium text-slate-700">{pl.amount}</td>
                                  <td className="px-4 py-3">
                                    <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
                                      {pl.warrantyDaysLeft}d
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${PLACEMENT_STATUS_STYLES[pl.status]}`}>
                                      {pl.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center justify-end gap-1">
                                      <button type="button" className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Edit placement"><Pencil size={14} /></button>
                                      <button type="button" className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Generate invoice"><FileText size={14} /></button>
                                      <button type="button" className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors" title="Mark joined"><UserCheck size={14} /></button>
                                      <button type="button" className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Warranty claim"><Shield size={14} /></button>
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
                ) : activeTab === 'billing' ? (
                  <div className="space-y-4">
                    {/* Finance summary cards - same soft card layout as Jobs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                          <TrendingUp size={20} className="text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total revenue</p>
                          <p className="text-lg font-bold text-slate-900">{normalizeDisplayValue(client?.billingTotalRevenue ?? client?.revenue)}</p>
                        </div>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                          <Clock size={20} className="text-amber-600" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Outstanding</p>
                          <p className="text-lg font-bold text-slate-900">{normalizeDisplayValue(client?.billingOutstanding)}</p>
                        </div>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                          <DollarSign size={20} className="text-blue-600" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Paid amount</p>
                          <p className="text-lg font-bold text-slate-900">{normalizeDisplayValue(client?.billingPaid)}</p>
                        </div>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                          <AlertCircle size={20} className="text-red-600" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Overdue invoices</p>
                          <p className="text-lg font-bold text-slate-900">{client?.billingOverdueCount ?? 0}</p>
                        </div>
                      </div>
                    </div>
                    {/* Invoices table */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Invoices</h4>
                        <p className="text-xs text-slate-500">{(client?.invoiceList ?? []).length} invoices</p>
                      </div>
                      <div className="overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Invoice #</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Date</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Amount</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Due date</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right w-44">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(!client?.invoiceList || client.invoiceList.length === 0) ? (
                              <tr>
                                <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">
                                  No invoices yet.
                                </td>
                              </tr>
                            ) : (
                              (client?.invoiceList ?? []).map((inv) => (
                                <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                                  <td className="px-4 py-3">
                                    <p className="text-sm font-medium text-slate-900">{inv.invoiceNumber}</p>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-600">{inv.date}</td>
                                  <td className="px-4 py-3 text-sm font-medium text-slate-700">{inv.amount}</td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${INVOICE_STATUS_STYLES[inv.status]}`}>
                                      {inv.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-600">{inv.dueDate}</td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center justify-end gap-1">
                                      <button type="button" className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Edit invoice"><Pencil size={14} /></button>
                                      <button type="button" className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="Download PDF"><Download size={14} /></button>
                                      <button type="button" className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Send reminder"><Send size={14} /></button>
                                      <button type="button" className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Record payment"><DollarSign size={14} /></button>
                                      <button type="button" className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors" title="Add credit note"><FilePlus size={14} /></button>
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
                ) : activeTab === 'activity' ? (() => {
                  // Use fetched activities or fallback to client activityList
                  const allActivities = clientActivities.length > 0 ? clientActivities : (client?.activityList ?? []);
                  const activities = allActivities.filter(
                    (a) => activityFilter === 'All' || a.category === activityFilter
                  );
                  
                  // Sort activities by timestamp (newest first)
                  const sortedActivities = [...activities].sort((a, b) => {
                    const dateA = a.timestampFull ? new Date(a.timestampFull).getTime() : 0;
                    const dateB = b.timestampFull ? new Date(b.timestampFull).getTime() : 0;
                    return dateB - dateA;
                  });
                  
                  const CategoryIcon = ({ category }: { category: ClientActivityItem['category'] }) => {
                    switch (category) {
                      case 'Jobs': return <Briefcase size={16} className="text-blue-600" />;
                      case 'Candidates': return <User size={16} className="text-emerald-600" />;
                      case 'Interviews': return <Calendar size={16} className="text-amber-600" />;
                      case 'Billing': return <CreditCard size={16} className="text-violet-600" />;
                      case 'Notes': return <StickyNote size={16} className="text-slate-600" />;
                      case 'Files': return <Paperclip size={16} className="text-slate-600" />;
                      default: return <Activity size={16} className="text-slate-500" />;
                    }
                  };
                  return (
                  <div className="space-y-4">
                    <EntityAuditSummary
                      audit={client?.auditMeta ?? extractAuditMeta(client ? (client as unknown as Record<string, unknown>) : undefined)}
                    />
                    {/* Timeline filters - same soft card layout as Billing */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {ACTIVITY_TIMELINE_FILTERS.map((f) => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => setActivityFilter(f)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activityFilter === f ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Vertical timeline */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Activity timeline</h4>
                        <p className="text-xs text-slate-500">{sortedActivities.length} events</p>
                      </div>
                      <div className="p-4 max-h-[420px] overflow-y-auto">
                        {loadingActivities ? (
                          <div className="py-8 text-center">
                            <p className="text-sm text-slate-500">Loading activities...</p>
                          </div>
                        ) : sortedActivities.length === 0 ? (
                          <div className="py-8 text-center">
                            <Activity size={24} className="mx-auto text-slate-300 mb-2" />
                            <p className="text-sm text-slate-500">No activity for this filter.</p>
                          </div>
                        ) : (
                          <div className="relative border-l-2 border-slate-200 pl-6 space-y-0">
                            {sortedActivities.map((item: ClientActivityItem, idx: number) => {
                              // Group by date for better visualization
                              const prevItem = idx > 0 ? sortedActivities[idx - 1] : null;
                              const currentDate = item.timestampFull ? new Date(item.timestampFull).toDateString() : '';
                              const prevDate = prevItem?.timestampFull ? new Date(prevItem.timestampFull).toDateString() : '';
                              const showDateSeparator = idx === 0 || currentDate !== prevDate;
                              
                              return (
                                <div key={item.id}>
                                  {showDateSeparator && idx > 0 && (
                                    <div className="my-4 border-t border-slate-200"></div>
                                  )}
                                  {showDateSeparator && (
                                    <div className="mb-3 -ml-6">
                                      <span className="inline-block px-3 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full">
                                        {item.timestampFull ? (() => {
                                          const date = new Date(item.timestampFull);
                                          const now = new Date();
                                          const isToday = date.toDateString() === now.toDateString();
                                          const isYesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toDateString() === date.toDateString();
                                          
                                          if (isToday) return 'Today';
                                          if (isYesterday) return 'Yesterday';
                                          return formatDateDMY(date);
                                        })() : ''}
                                      </span>
                                    </div>
                                  )}
                                  <div className="relative pb-6 last:pb-0">
                                    {/* Timeline dot + icon */}
                                    <div className={`absolute -left-[1.625rem] top-0 w-8 h-8 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${ACTIVITY_CATEGORY_BG[item.category]}`}>
                                      <CategoryIcon category={item.category} />
                                    </div>
                                    {/* Event card */}
                                    <div className="bg-slate-50/80 rounded-xl border border-slate-200 p-3 hover:border-slate-300 transition-colors">
                                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                                      {item.description && <p className="text-xs text-slate-600 mt-1">{item.description}</p>}
                                      <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
                                        <div className="flex items-center gap-2 min-w-0">
                                          {item.user.avatar ? (
                                            <ImageWithFallback src={item.user.avatar} alt={item.user.name} className="w-6 h-6 rounded-full border border-slate-200 shrink-0" />
                                          ) : (
                                            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center shrink-0"><User size={12} className="text-slate-500" /></div>
                                          )}
                                          <span className="text-xs font-medium text-slate-700 truncate">{item.user.name}</span>
                                        </div>
                                        <span className="text-[11px] text-slate-500 shrink-0">{item.timestamp}</span>
                                      </div>
                                      {item.relatedLabel && (
                                        <button type="button" className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline">
                                          {item.relatedLabel}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })() : activeTab === 'notes' ? (
                  client?.id ? (
                    <NotesService
                      entityType="client"
                      entityId={client.id}
                      availableTags={['Calls', 'WhatsApp', 'Emails']}
                      onNoteCreated={() => {
                        // Optionally refresh client data or show notification
                      }}
                      onNoteUpdated={() => {
                        // Optionally refresh client data or show notification
                      }}
                      onNoteDeleted={() => {
                        // Optionally refresh client data or show notification
                      }}
                    />
                  ) : (
                    <div className="py-8 text-center text-sm text-slate-500">
                      No client selected
                    </div>
                  )
                ) : activeTab === 'files' ? (() => {
                  const filteredFiles = filesTypeFilter === 'All'
                    ? clientFiles
                    : clientFiles.filter((f) => f.fileType === filesTypeFilter);
                  const uploadsBase = (typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1') : 'http://localhost:5001/api/v1').replace(/\/api\/v1\/?$/, '');
                  const toFileHref = (fileUrl?: string | null) => buildFileHref(fileUrl, uploadsBase);
                  const formatUploadDate = (d: string) => {
                    if (!d) return '—';
                    try {
                      return formatDateDMY(d);
                    } catch {
                      return d;
                    }
                  };
                  const FileTypeIcon = ({ type }: { type: string }) => {
                    switch (type) {
                      case 'NDA': return <Shield size={14} className="text-slate-600 shrink-0" />;
                      case 'Contract': return <FileText size={14} className="text-blue-600 shrink-0" />;
                      case 'SLA': return <FileCheck size={14} className="text-emerald-600 shrink-0" />;
                      case 'Policy': return <FileText size={14} className="text-amber-600 shrink-0" />;
                      case 'Invoice': return <Receipt size={14} className="text-violet-600 shrink-0" />;
                      case 'Job Brief': return <Briefcase size={14} className="text-indigo-600 shrink-0" />;
                      default: return <Paperclip size={14} className="text-slate-500 shrink-0" />;
                    }
                  };
                  return (
                  <div className="space-y-4">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <DocumentUploadButton
                          disabled={!client?.id || isHqOverrideMode}
                          isUploading={filesUploading}
                          uploadSuccess={filesUploadSuccess}
                          uploadPercent={filesUploadPercent}
                          label="Upload File"
                          onFilesSelected={async (files) => {
                            await uploadFile(files[0], 'Contract');
                          }}
                        />
                        <div className="flex flex-wrap items-center gap-2 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                          {FILE_TYPE_OPTIONS.map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setFilesTypeFilter(type)}
                              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors shrink-0 ${filesTypeFilter === type ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >
                              {type}
                            </button>
                          ))}
                        </div>
                      </div>
                      {isHqOverrideMode && (
                        <p className="mt-2 text-sm text-slate-500">
                          File storage for HQ clients is not available yet.
                        </p>
                      )}
                      {filesError && <p className="mt-2 text-sm text-red-600">{filesError}</p>}
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Files</h4>
                        <p className="text-xs text-slate-500">{filesLoading ? 'LoadingÃ¢â‚¬Â¦' : `${filteredFiles.length} files`}</p>
                      </div>
                      <div className="overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
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
                                <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">Loading filesÃ¢â‚¬Â¦</td>
                              </tr>
                            ) : filteredFiles.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">
                                  No files for this type.
                                </td>
                              </tr>
                            ) : (
                              filteredFiles.map((file) => (
                                <tr key={file.id} className="hover:bg-slate-50/80 transition-colors">
                                  <td className="px-4 py-3">
                                    <p className="text-sm font-medium text-slate-900 truncate max-w-[200px]">{file.fileName}</p>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${FILE_TYPE_BADGE_STYLES[file.fileType as ClientFileType] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                      <FileTypeIcon type={file.fileType} />
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
                                      <span className="text-sm text-slate-600 truncate">{file.uploadedBy?.name ?? 'Ã¢â‚¬â€'}</span>
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
                })() : activeTab === 'schedule' ? (() => {
                  const filteredMeetings = meetingStatusFilter === 'All'
                    ? scheduledMeetings
                    : scheduledMeetings.filter((m) => m.status === meetingStatusFilter);
                  
                  const sortedMeetings = [...filteredMeetings].sort((a, b) => {
                    const dateA = new Date(a.scheduledAt).getTime();
                    const dateB = new Date(b.scheduledAt).getTime();
                    return dateA - dateB;
                  });

                  const formatDateTime = (dateString: string) => {
                    const date = new Date(dateString);
                    return {
                      date: formatDateDMY(date),
                      time: formatTime12hEnGb(date),
                    };
                  };

                  const getStatusBadgeStyle = (status: string) => {
                    switch (status) {
                      case 'SCHEDULED':
                        return 'bg-blue-100 text-blue-700 border-blue-200';
                      case 'COMPLETED':
                        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
                      case 'CANCELLED':
                        return 'bg-red-100 text-red-700 border-red-200';
                      case 'RESCHEDULED':
                        return 'bg-amber-100 text-amber-700 border-amber-200';
                      default:
                        return 'bg-slate-100 text-slate-700 border-slate-200';
                    }
                  };

                  return (
                    <div className="space-y-4">
                      {/* Top bar: Schedule Meeting button + status filters */}
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => setShowScheduleMeetingForm(true)}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <CalendarPlus size={16} />
                            Schedule Meeting / Follow-up
                          </button>
                          <div className="flex flex-wrap items-center gap-2 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                            {(['All', 'SCHEDULED', 'COMPLETED', 'CANCELLED'] as const).map((status) => (
                              <button
                                key={status}
                                type="button"
                                onClick={() => setMeetingStatusFilter(status)}
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors shrink-0 ${meetingStatusFilter === status ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                              >
                                {status}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Schedule Meeting Form */}
                      {showScheduleMeetingForm && (
                        <ScheduleMeetingForm
                          entityType="client"
                          entityId={client?.id || ''}
                          onSuccess={async () => {
                            setShowScheduleMeetingForm(false);
                            // Refresh scheduled meetings list
                            if (client?.id) {
                              try {
                                const meetings = await apiGetClientScheduledMeetings(client.id);
                                setScheduledMeetings(meetings.data || []);
                              } catch (error) {
                                console.error('Failed to refresh meetings:', error);
                              }
                            }
                          }}
                          onCancel={() => setShowScheduleMeetingForm(false)}
                        />
                      )}

                      {/* Meetings list */}
                      {!showScheduleMeetingForm && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Scheduled Meetings</h4>
                            <p className="text-xs text-slate-500">{filteredMeetings.length} {filteredMeetings.length === 1 ? 'meeting' : 'meetings'}</p>
                          </div>
                          <div className="p-4 max-h-[500px] overflow-y-auto space-y-3">
                            {loadingMeetings ? (
                              <div className="py-8 text-center text-sm text-slate-500">Loading meetings...</div>
                            ) : sortedMeetings.length === 0 ? (
                              <div className="py-8 text-center text-sm text-slate-500">
                                {meetingStatusFilter === 'All' 
                                  ? 'No scheduled meetings. Click "Schedule Meeting / Follow-up" to create one.'
                                  : `No ${meetingStatusFilter.toLowerCase()} meetings.`}
                              </div>
                            ) : (
                              sortedMeetings.map((meeting) => {
                                const { date, time } = formatDateTime(meeting.scheduledAt);
                                const scheduledByName = meeting.scheduledBy
                                  ? `${meeting.scheduledBy.firstName || ''} ${meeting.scheduledBy.lastName || ''}`.trim() || meeting.scheduledBy.email
                                  : 'Unknown';
                                
                                return (
                                  <div
                                    key={meeting.id}
                                    className="rounded-xl border border-slate-200 bg-slate-50/80 hover:border-slate-300 p-4 transition-colors"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                          <h5 className="text-sm font-semibold text-slate-900">{meeting.meetingType}</h5>
                                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium border ${getStatusBadgeStyle(meeting.status)}`}>
                                            {meeting.status}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-xs text-slate-600 mb-2">
                                          <span className="flex items-center gap-1">
                                            <Calendar size={12} className="text-slate-400" />
                                            {date}
                                          </span>
                                          <span className="flex items-center gap-1">
                                            <Clock size={12} className="text-slate-400" />
                                            {time}
                                          </span>
                                        </div>
                                        {meeting.reminder && (
                                          <div className="flex items-center gap-1 text-xs text-slate-500 mb-2">
                                            <Bell size={12} className="text-slate-400" />
                                            Reminder: {meeting.reminder}
                                          </div>
                                        )}
                                        {meeting.notes && (
                                          <p className="text-xs text-slate-600 mt-2 line-clamp-2">{meeting.notes}</p>
                                        )}
                                        <div className="flex items-center gap-2 mt-2">
                                          {meeting.scheduledBy?.avatar ? (
                                            <ImageWithFallback 
                                              src={meeting.scheduledBy.avatar} 
                                              alt={scheduledByName} 
                                              className="w-5 h-5 rounded-full border border-slate-200 shrink-0" 
                                            />
                                          ) : (
                                            <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                                              <User size={10} className="text-slate-500" />
                                            </div>
                                          )}
                                          <span className="text-[11px] font-medium text-slate-600">Scheduled by {scheduledByName}</span>
                                          <span className="text-[11px] text-slate-400">Ã‚Â·</span>
                                          <span className="text-[11px] text-slate-500">
                                            {formatDateDMY(meeting.createdAt)}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0">
                                        {meeting.status === 'SCHEDULED' && (
                                          <>
                                            <button
                                              type="button"
                                              onClick={async () => {
                                                if (!client?.id) return;
                                                try {
                                                  await apiUpdateScheduledMeeting(client.id, meeting.id, { status: 'COMPLETED' });
                                                  const meetings = await apiGetClientScheduledMeetings(client.id);
                                                  setScheduledMeetings(meetings.data || []);
                                                } catch (error) {
                                                  console.error('Failed to mark as completed:', error);
                                                  void requestError('Failed to update meeting status');
                                                }
                                              }}
                                              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                              title="Mark as completed"
                                            >
                                              <CheckCircle size={14} />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={async () => {
                                                if (!client?.id) return;
                                                if (!(await requestConfirm('Are you sure you want to cancel this meeting?'))) return;
                                                try {
                                                  await apiUpdateScheduledMeeting(client.id, meeting.id, { status: 'CANCELLED' });
                                                  const meetings = await apiGetClientScheduledMeetings(client.id);
                                                  setScheduledMeetings(meetings.data || []);
                                                } catch (error) {
                                                  console.error('Failed to cancel meeting:', error);
                                                  void requestError('Failed to cancel meeting');
                                                }
                                              }}
                                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                              title="Cancel"
                                            >
                                              <XCircle size={14} />
                                            </button>
                                          </>
                                        )}
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            if (!client?.id) return;
                                            if (!(await requestConfirm('Are you sure you want to delete this meeting?'))) return;
                                            try {
                                              await apiDeleteScheduledMeeting(client.id, meeting.id);
                                              const meetings = await apiGetClientScheduledMeetings(client.id);
                                              setScheduledMeetings(meetings.data || []);
                                            } catch (error) {
                                              console.error('Failed to delete meeting:', error);
                                              void requestError('Failed to delete meeting');
                                            }
                                          }}
                                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                          title="Delete"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })() : activeTab === 'chat' ? (
                  <DrawerEntityChatTab
                    entityType="CLIENT"
                    entityId={client?.id}
                    entityLabel={client?.name}
                    isActive={activeTab === 'chat'}
                    isOpen={Boolean(client) || propIsAddMode}
                  />
                ) : null}
              </div>
              </div>

            </div>
              </>
            )}
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {drawerIsOpen && clientPanelPortalReady && typeof document !== 'undefined'
        ? createPortal(drawerTree, document.body)
        : drawerTree}
    <CreateJobDrawer
      isOpen={createJobDrawerOpen}
      onClose={() => {
        setCreateJobDrawerOpen(false);
        setDuplicateFromJobId(null);
      }}
      defaultClientId={client?.id ?? null}
      duplicateFromJobId={duplicateFromJobId}
      onJobCreated={() => {
        setCreateJobDrawerOpen(false);
        setDuplicateFromJobId(null);
        void refreshClientJobs();
        if (client?.id) {
          void apiGetClientActivities(client.id)
            .then((response) => {
              const activities = Array.isArray(response.data) ? response.data : [];
              const mappedActivities: ClientActivityItem[] = activities.map((activity: any) => {
                const user = activity.performedBy || {};
                const userName = user.firstName && user.lastName
                  ? `${user.firstName} ${user.lastName}`.trim()
                  : user.name || user.email || 'Unknown User';

                const activityDate = new Date(activity.createdAt);
                const now = new Date();
                const isToday = activityDate.toDateString() === now.toDateString();
                const isYesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toDateString() === activityDate.toDateString();

                let dateDisplay = '';
                if (isToday) {
                  dateDisplay = 'Today';
                } else if (isYesterday) {
                  dateDisplay = 'Yesterday';
                } else {
                  dateDisplay = formatDateDMY(activityDate);
                }

                const timeDisplay = formatTime12hEnGb(activityDate);

                return {
                  id: activity.id,
                  category: mapClientActivityCategory(activity),
                  title: activity.action,
                  description: activity.description,
                  user: {
                    name: userName,
                    avatar: user.avatar || undefined,
                  },
                  timestamp: `${dateDisplay} at ${timeDisplay}`,
                  timestampFull: activityDate.toISOString(),
                  relatedType: activity.relatedType as any,
                  relatedLabel: activity.relatedLabel,
                  relatedId: activity.relatedId,
                };
              });
              setClientActivities(mappedActivities);
            })
            .catch((error) => {
              console.error('Failed to refresh client activities after job creation:', error);
            });
        }
        onJobCreated?.();
      }}
    />
    <JobDetailsDrawer
      isOpen={jobDetailsOpen}
      onClose={() => {
        setJobDetailsOpen(false);
        setSelectedJobForDrawer(null);
      }}
      job={selectedJobForDrawer}
      jobCandidates={jobCandidatesForDrawer}
      onJobCandidatesChange={setJobCandidatesForDrawer}
      pipelineStages={jobPipelineStagesForDrawer}
    />
    </>
  );
}
