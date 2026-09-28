'use client';

import { formatDateDMY } from '../../utils/dateDisplay';
import { cleanDisplayText } from '../../lib/sanitizeMojibake';
import { isLeadOccasionDetailLabel, type LeadOccasionFormValues } from '../../lib/leadOccasionDetails';
import { isTeamMemberDetailLabel, mergeTeamMembersWithContacts, normalizeTeamMemberList, primaryTeamMemberFromList, resolveTeamMemberList, teamMemberHasAnyValue, teamMembersFromOtherDetails, type TeamMemberListItem } from '../../lib/teamMemberFormDetails';
import { isDirectorDetailLabel } from '../../lib/clientDirectorDetails';
import { type DirectorListItem } from '../../lib/directorFormDetails';
import { isClientTeamMemberContact, isDirectorBackendContact } from '../../lib/clientContactRoles';
import { type LocationSelection } from '../LocationAutocomplete';
import { DrawerLinkActions, splitDisplayUrls } from './DrawerLinkActions';
import { agreementTermsFromRecord } from '../../lib/agreementTerms';
import { type PostServiceKycAttachmentFieldKey, type PostServiceKycFileRef, type PostServiceKycFormValues } from '../../lib/clientKycForm';
import { inferTimezoneDisplay } from '../../utils/inferTimezone';
import { Check } from 'lucide-react';
import type { Client, ClientHealthStatus, JobStatus, PipelineStageName, PlacementStatus, InvoiceStatus, ActivityFilterType, NoteTag, ClientFileType } from '@/app/client/types';
import { apiCreateClient, apiUpdateClient, type BackendContact, type BackendClient, type CreateClientData, type EntityFile } from '../../lib/api';

export const CLIENT_AI_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ClientAiRequiredField = 'companyName' | 'directorName' | 'email';

export function validateClientAiEmail(email: string) {
  const value = String(email || '').trim();
  if (!value) return { valid: false, message: 'Email is required' };
  if (!CLIENT_AI_EMAIL_REGEX.test(value)) return { valid: false, message: 'Invalid email format' };
  return { valid: true, message: '' };
}

export function extractEmailsFromPromptText(text: string): string[] {
  const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  return [...new Set(matches.map((value) => value.trim().toLowerCase()).filter(Boolean))];
}

export function extractLabeledPromptValue(text: string, labels: string[]): string {
  for (const label of labels) {
    const pattern = new RegExp(`^\\s*${label}\\s*[:\\-–]\\s*(.+)$`, 'im');
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return '';
}

export function parseDirectorNameFromContactLine(line: string): string {
  let name = line.trim();
  name = name.replace(/^(contact|contact person|director|primary contact)\s*[:–-]\s*/i, '');
  const commaIdx = name.indexOf(',');
  if (commaIdx > 0) name = name.slice(0, commaIdx).trim();
  name = name.replace(/^(mr|mrs|ms|miss|dr|prof)\.?\s+/i, '').trim();
  return name;
}

export function enrichGeneratedClientFromPrompt<T extends { email?: string; phone?: string; directorName?: string; companyName?: string; otherDetails?: Array<{ label: string; value: string }> }>(
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

export function normalizeClientAiDateInput(value: string) {
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

export const HEALTH_STYLES: Record<ClientHealthStatus, { bg: string; text: string; label: string }> = {
  Good: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Good' },
  'Needs attention': { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Needs attention' },
  'At risk': { bg: 'bg-red-50', text: 'text-red-700', label: 'At risk' },
};

export const FieldRow = ({
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
}) => {
  const urls = href ? splitDisplayUrls(value) : [];
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      {urls.length ? (
        <div className="mt-1 flex flex-col gap-1.5">
          {urls.map((url) => (
            <DrawerLinkActions key={url} url={url} shareTitle={label} />
          ))}
        </div>
      ) : (
        <p
          className={`mt-0.5 text-sm font-medium text-slate-900 ${href ? 'text-blue-600 hover:underline cursor-pointer' : ''} ${multiline ? 'whitespace-pre-line' : ''} ${!multiline ? 'break-words' : ''}`}
        >
          {cleanDisplayText(value, blankWhenEmpty ? '' : '—')}
        </p>
      )}
    </div>
  );
};

export function resolvePrimaryAssignedToId(form: {
  assignedToId?: string;
  assignedToIds?: string[];
}): string | undefined {
  const single = String(form.assignedToId || '').trim();
  if (single) return single;
  return form.assignedToIds?.[0] || undefined;
}

export function assignedToSelectionFromId(userId: string): { assignedToId: string; assignedToIds: string[] } {
  const id = String(userId || '').trim();
  return {
    assignedToId: id,
    assignedToIds: id ? [id] : [],
  };
}

export function curatedDynamicPairsForSave(rows: Array<{ label: string; value: string }>): Array<{ label: string; value: string }> | undefined {
  const curated = rows
    .map((row) => ({
      label: String(row.label ?? '').trim(),
      value: String(row.value ?? '').trim(),
    }))
    .filter((row) => row.label && row.value);
  return curated.length ? curated : undefined;
}

export function filterImportedDynamicOtherDetails(
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

export function isLinkedInCompanyUrl(url: string): boolean {
  return /linkedin\.com/i.test(String(url || '').trim());
}

export function buildCompanyLinksFromClient(record: {
  website?: string | null;
  linkedin?: string | null;
}): string[] {
  const links = [record.website, record.linkedin].map((v) => String(v || '').trim()).filter(Boolean);
  return links.length ? links : [''];
}

export function normalizeCompanyLinksForSave(links: string[], fallbackWebsite = ''): {
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

export function resolveClientCityStateCountry(source: {
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

export function mergeBackendClientRecord(existing: Client, backend: BackendClient): Client {
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

export type ClientOverviewForm = {
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
  /** Extra directors (name + email + phone). Primary is also mirrored in directorName/contactEmails/contactPhones. */
  directors: DirectorListItem[];
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

export const DEFAULT_ADD_CLIENT_SECTIONS = {
  company: true,
  location: true,
  contacts: true,
  qualification: true,
  other: true,
};

export function AddClientAiFlowProgress({ stage }: { stage: 'chat' | 'form' }) {
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

export const CLIENT_TEAM_MEMBER_TAG = 'TEAM_MEMBER';

export function extractTeamMembersFromContacts(contacts: BackendContact[]): TeamMemberListItem[] {
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

export function resolveClientTeamMembersForForm(
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

export const POST_SERVICE_KYC_ATTACHMENT_FIELDS: PostServiceKycAttachmentFieldKey[] = [
  'shareholderPassportCopyFiles',
  'generalManagerIdCardFiles',
  'companyDocumentFiles',
  'bankAccountProofFiles',
  'signatureFiles',
  'companyStampFiles',
];

export type PendingPostServiceKycFiles = Record<PostServiceKycAttachmentFieldKey, File[]>;

export function createEmptyPendingPostServiceKycFiles(): PendingPostServiceKycFiles {
  return {
    shareholderPassportCopyFiles: [],
    generalManagerIdCardFiles: [],
    companyDocumentFiles: [],
    bankAccountProofFiles: [],
    signatureFiles: [],
    companyStampFiles: [],
  };
}

export function postServiceKycFileRefFromEntityFile(file: EntityFile): PostServiceKycFileRef {
  return {
    id: file.id,
    fileName: file.fileName,
    fileType: file.fileType,
    fileUrl: file.fileUrl,
    uploadDate: file.uploadDate,
  };
}

export function appendPostServiceKycFiles(
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

export function removePostServiceKycStoredFile(
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

export function hasPendingPostServiceKycFiles(value: PendingPostServiceKycFiles) {
  return POST_SERVICE_KYC_ATTACHMENT_FIELDS.some((field) => value[field].length > 0);
}

export function syncClientTeamMembers(
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

export function mergeClientLocationSelection<T extends ClientOverviewForm>(
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

export const JOB_STATUS_STYLES: Record<JobStatus, string> = {
  Open: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Paused: 'bg-amber-100 text-amber-700 border-amber-200',
  Closed: 'bg-slate-100 text-slate-600 border-slate-200',
};

export const PIPELINE_STAGES: PipelineStageName[] = ['Applied', 'Screened', 'Interview', 'Offer', 'Joined'];

export const PIPELINE_STAGE_STYLES: Record<PipelineStageName, { header: string; border: string }> = {
  Applied: { header: 'bg-slate-100 text-slate-700 border-slate-200', border: 'border-slate-200' },
  Screened: { header: 'bg-blue-100 text-blue-700 border-blue-200', border: 'border-blue-200' },
  Interview: { header: 'bg-amber-100 text-amber-700 border-amber-200', border: 'border-amber-200' },
  Offer: { header: 'bg-emerald-100 text-emerald-700 border-emerald-200', border: 'border-emerald-200' },
  Joined: { header: 'bg-violet-100 text-violet-700 border-violet-200', border: 'border-violet-200' },
};

export const PLACEMENT_STATUS_STYLES: Record<PlacementStatus, string> = {
  'Pending Invoice': 'bg-amber-100 text-amber-700 border-amber-200',
  Invoiced: 'bg-blue-100 text-blue-700 border-blue-200',
  Paid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

export const INVOICE_STATUS_STYLES: Record<InvoiceStatus, string> = {
  Draft: 'bg-slate-100 text-slate-700 border-slate-200',
  Sent: 'bg-blue-100 text-blue-700 border-blue-200',
  Paid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Overdue: 'bg-red-100 text-red-700 border-red-200',
};

export const ACTIVITY_CATEGORY_BG: Record<Exclude<ActivityFilterType, 'All'>, string> = {
  Jobs: 'bg-blue-50',
  Candidates: 'bg-emerald-50',
  Interviews: 'bg-amber-50',
  Billing: 'bg-violet-50',
  Notes: 'bg-slate-100',
  Files: 'bg-slate-100',
};

export const mapClientActivityCategory = (activity: any): Exclude<ActivityFilterType, 'All'> => {
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

export const NOTE_TAG_STYLES: Record<NoteTag, string> = {
  HR: 'bg-blue-100 text-blue-700 border-blue-200',
  Finance: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Contract: 'bg-amber-100 text-amber-700 border-amber-200',
  Feedback: 'bg-violet-100 text-violet-700 border-violet-200',
};

export const splitCompanyLinks = (value: string) =>
  value
    .split(/\r?\n|\|/)
    .map((item) => item.trim())
    .filter(Boolean);

export const FILE_TYPE_BADGE_STYLES: Record<ClientFileType, string> = {
  NDA: 'bg-slate-100 text-slate-700 border-slate-200',
  Contract: 'bg-blue-100 text-blue-700 border-blue-200',
  SLA: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Policy: 'bg-amber-100 text-amber-700 border-amber-200',
  Invoice: 'bg-violet-100 text-violet-700 border-violet-200',
  'Job Brief': 'bg-indigo-100 text-indigo-700 border-indigo-200',
};

export interface ClientDetailsDrawerProps {
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
