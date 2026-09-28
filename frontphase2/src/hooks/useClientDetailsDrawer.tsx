'use client';

import { ClientOverviewTab } from '../components/drawers/clientTabs/Overview';
import { ClientContactsTab } from '../components/drawers/clientTabs/Contacts';
import { ClientJobsTab } from '../components/drawers/clientTabs/Jobs';
import { ClientPlacementsTab } from '../components/drawers/clientTabs/Placements';
import { ClientBillingTab } from '../components/drawers/clientTabs/Billing';
import { ClientActivityTab } from '../components/drawers/clientTabs/Activity';
import { ClientNotesTab } from '../components/drawers/clientTabs/Notes';
import { ClientFilesTab } from '../components/drawers/clientTabs/Files';
import { ClientScheduleTab } from '../components/drawers/clientTabs/Schedule';
import { ClientChatTab } from '../components/drawers/clientTabs/Chat';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { usePageDrawerLifecycle } from '../lib/pageDrawerEvents';
import { useDrawerBodyScrollLock } from './useDrawerBodyScrollLock';
import { useDrawerUnsavedGuard } from './useDrawerUnsavedGuard';
import { useClientPageFieldVisibility } from './useClientPageFieldVisibility';
import { buildFileHref } from '../utils/cloudinaryUrls';
import { formatDateDMY, formatTime12hEnGb } from '../utils/dateDisplay';
import { formatDirectorDisplay } from '../constants/salutations';
import { DirectorContactFields } from '../components/forms/DirectorContactFields';
import { WhatsAppIcon } from '../components/icons/WhatsAppIcon';
import { LeadAssigneesMultiSelect } from '../components/drawers/LeadAssigneesMultiSelect';
import { formatAssigneeDisplayName } from '../lib/assigneeDisplay';
import { cleanDisplayText } from '../lib/sanitizeMojibake';
import { businessValueInputValue, normalizeBusinessValueForSave, sanitizeBusinessValueInput } from '../lib/businessValue';
import { visibleContactEmail, visiblePreferredChannel } from '../lib/contactEmail';
import { dedupeVisibleContacts } from '../lib/clientContactDedupe';
import { ServicesNeededSelect } from '../components/forms/ServicesNeededSelect';
import { IndustryMultiSelect } from '../components/forms/IndustryMultiSelect';
import { TeamMemberOptionalFields } from '../components/forms/TeamMemberOptionalFields';
import { LeadOccasionFields } from '../components/forms/LeadOccasionFields';
import { buildLeadOccasionContactOptions, emptyLeadOccasionForm, mergeOccasionIntoOtherDetails, readLeadOccasionFromOtherDetails } from '../lib/leadOccasionDetails';
import { mergeTeamMemberIntoOtherDetails, normalizeTeamMemberList, primaryTeamMemberFromList, teamMemberHasAnyValue, teamMemberPayloadFromForm, type TeamMemberListItem } from '../lib/teamMemberFormDetails';
import { directorFromOtherDetails, mergeDirectorIntoOtherDetails } from '../lib/clientDirectorDetails';
import { normalizeDirectorList, resolveDirectorList } from '../lib/directorFormDetails';
import { directorNameFromContact, isClientTeamMemberContact, resolveDirectorBackendContact } from '../lib/clientContactRoles';
import { formatIndustriesDisplay } from '../lib/industryOptions';
import { type LocationSelection } from '../components/LocationAutocomplete';
import { CscLocationFields } from '../components/location/CscLocationFields';
import { LeadLocationFields } from '../components/location/LeadLocationFields';
import { AddLeadFieldLabel } from '../components/drawers/drawerFormUi';
import { KycDocumentsField, KycDocumentsView } from '../components/documents/KycDocumentsField';
import { AgreementDocumentUpload } from '../components/documents/AgreementDocumentUpload';
import { AgreementTermsSection } from '../components/agreements/AgreementTermsSection';
import { AGREEMENT_LEVEL_OPTIONS, agreementTermsApiPayload, agreementTermsFromRecord, emptyAgreementTerms, filledAgreementTermKeys, formatAgreementTermsSummary, mergeExtractedAgreementTerms, type AgreementTermsFormValues } from '../lib/agreementTerms';
import type { AgreementLevelCatalogProps } from '../components/agreements/AgreementTermsSection';
import { emptyPostServiceKycForm, type PostServiceKycAttachmentFieldKey, postServiceKycFormApiPayload, postServiceKycFormFromRecord, type PostServiceKycFormValues } from '../lib/clientKycForm';
import { DocumentUploadButton, useDocumentUploadFeedback } from '../components/import/documentUploadUi';
import { filterKycFiles, uploadKycDocuments } from '../lib/kycDocuments';
import { inferTimezoneDisplay } from '../utils/inferTimezone';
import { ClientTimezoneSelect } from '../components/clients/ClientTimezoneSelect';
import { CatalogOptionDropdown, mergeCatalogOptions } from '../components/forms/CatalogOptionDropdown';
import { clientStatusLabelToBackend, DEFAULT_CLIENT_PRIORITY_LABELS, DEFAULT_CLIENT_STATUS_LABELS, resolveClientStatusLabel } from '../lib/clientLifecycleStatus';
import { ClientPostServiceKycFormSection, ClientPostServiceKycSummary } from '../components/clients/ClientPostServiceKycSection';
import { buildContactChannelsFromForm, contactListForForm, formatContactListMultiline, normalizeContactList, primaryContactValue } from '../lib/contact-channels';
import type { TeamMember } from '../types/team';
import { motion, AnimatePresence } from 'motion/react';
import { Building2, Briefcase, MessageCircle, LayoutGrid, Users, Award, CreditCard, Activity, StickyNote, Paperclip, Edit2, UserPlus, FileText, Upload, Camera, Trash2, MapPin, Calendar, Clock, TrendingUp, Heart, CalendarPlus, FileCheck, CheckCircle, XCircle, ChevronDown, ChevronRight, Phone, Mail, X, Eye, Pause, Copy, BarChart3, AlertCircle, Sparkles, Lock, User, Send, UserCheck, Shield, Download, DollarSign, FilePlus, Pencil, Receipt, Plus, Bell, MessageSquare, Megaphone, Gift } from 'lucide-react';
import type { Client, ClientStage, ClientContact, ClientJob, JobStatus, ClientActivityItem, ActivityFilterType, NoteTag, ClientFileType } from '@/app/client/types';
import { EntityAuditSummary } from '../components/table/TableAuditCell';
import { DrawerEntityChatTab } from '../components/drawers/DrawerEntityChatTab';
import { extractAuditMeta } from '../utils/auditMeta';
import { ImageWithFallback } from '../components/ImageWithFallback';
import { useFiles } from './useFiles';
import { ScheduleMeetingForm } from '../components/ScheduleMeetingForm';
import { NotesService } from '../components/NotesService';
import { apiAppendAgreementLevel, apiAppendClientLeadStatus, apiAppendClientPriority, apiGenerateClientDetails, type LeadAiChatMessage, apiCreateClient, apiCreateContact, apiDeleteContact, apiDeleteScheduledMeeting, apiDetectContactDuplicates, apiFetch, apiGetClientActivities, apiGetAgreementLevelCatalog, apiGetClientLeadStatusCatalog, apiGetClientPriorityCatalog, apiRemoveAgreementLevel, apiRemoveClientLeadStatus, apiRemoveClientPriority, apiGetClientScheduledMeetings, apiGetClientAssignableMembers, apiGetContacts, apiGetJob, apiGetJobs, apiHqListTeam, apiHqUploadCompanyLogo, apiUpdateClient, apiSendClientToRecruitment, apiUpdateContact, apiUpdateJob, apiUpdateScheduledMeeting, filesApiUpload, type BackendUser, type BackendJob, type BackendContact, type CreateContactData, type BackendClient, type CreateClientData, type ScheduledMeeting, isOrgBillingNavEnabled, ORG_RECRUITMENT_CACHE_EVENT } from '../lib/api';
import { CrossDepartmentClientHandoff } from '../components/team/CrossDepartmentClientHandoff';
import { requestConfirm, requestError, requestSuccess, requestWarning } from '../lib/appDialog';
import { ClientAiChatDrawer } from '../components/clients/ClientAiChatDrawer';
import { AiCoinLockBadge, useAiCoinGate } from '../components/coins/AiCoinGate';
import { alertDrawerAnalysis, analyzeClientDrawer } from '@/lib/tenant-drawer-engine';
import { clientAiHasAgreementData, clientAiHasKycData, mergeClientAiKycForm, type ClientAiGeneratedPayload } from '@/lib/clientAiHelpers';
import { inferLocationFromCityName } from '../lib/cscData';
import { startAsyncLoad } from '../lib/asyncLoadGuard';
import { DrawerCloseButton } from '../components/drawers/DrawerCloseButton';
import { DetailsModalShell } from '../components/drawers/DetailsModalShell';
import { DrawerTabBar } from '../components/drawers/DrawerTabBar';
import { DrawerSectionCard, DRAWER_FORM_SCROLL_BG } from '../components/drawers/drawerFormUi';
import { JobDetailsDrawer, type JobForDrawer } from '../components/drawers/JobDetailsDrawer';
import { usePermissions } from './usePermissions';
import { toast } from 'sonner';
import { ACTIVITY_CATEGORY_BG, AddClientAiFlowProgress, CLIENT_TEAM_MEMBER_TAG, ClientAiRequiredField, ClientDetailsDrawerProps, ClientOverviewForm, DEFAULT_ADD_CLIENT_SECTIONS, FILE_TYPE_BADGE_STYLES, FieldRow, HEALTH_STYLES, INVOICE_STATUS_STYLES, JOB_STATUS_STYLES, PLACEMENT_STATUS_STYLES, POST_SERVICE_KYC_ATTACHMENT_FIELDS, PendingPostServiceKycFiles, appendPostServiceKycFiles, buildCompanyLinksFromClient, createEmptyPendingPostServiceKycFiles, curatedDynamicPairsForSave, enrichGeneratedClientFromPrompt, filterImportedDynamicOtherDetails, mapClientActivityCategory, mergeBackendClientRecord, mergeClientLocationSelection, normalizeClientAiDateInput, normalizeCompanyLinksForSave, postServiceKycFileRefFromEntityFile, removePostServiceKycStoredFile, resolveClientCityStateCountry, resolveClientTeamMembersForForm, resolvePrimaryAssignedToId, syncClientTeamMembers, validateClientAiEmail } from '../components/drawers/clientDetailsShared';

export function useClientDetailsDrawer(props: ClientDetailsDrawerProps) {
  const {
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
  stackClassName: _stackClassName = 'z-50',
} = props;

const drawerIsOpen = Boolean(client) || propIsAddMode;
const clientAiGate = useAiCoinGate('ai.client_chat');
const isHqOverrideMode = Boolean(createClientOverride || updateClientOverride);
usePageDrawerLifecycle(drawerIsOpen);
const { release: releaseClientBodyScrollLock } = useDrawerBodyScrollLock(drawerIsOpen);
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
    const bump = () => setOrgRecruitmentUiVersion((v: any) => v + 1);
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
useEffect(() => {
    if (!client?.id || propIsAddMode) return;

    const nextStatusLabel = resolveClientStatusLabel(client);

    setFullClientData((prev: any) => {
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

    setOverviewEditForm((prev: any) => {
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
    setAddClientSectionsOpen((prev: any) => ({ ...prev, [key]: !prev[key] }));
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
    directors: normalizeDirectorList(),
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
      const existingLinks = (form.companyLinks || []).map((l: any) => String(l || '').trim()).filter(Boolean);
      const companyLinks = websiteVal
        ? [websiteVal, ...existingLinks.filter((l: any) => l !== websiteVal)]
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
        directors: resolveDirectorList({
          directorSalutation: generated.directorSalutation || form.directorSalutation,
          directorName: generated.directorName || form.directorName,
          email: primaryEmail,
          phone: primaryPhone,
          emails: contactListForForm(g.emails, primaryEmail),
          phones: contactListForForm(g.phones, primaryPhone),
        }),
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
        expectedBusinessValue:
          businessValueInputValue(generated.expectedBusinessValue) || form.expectedBusinessValue,
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
      setOverviewEditForm((prev: any) => {
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
      setOverviewOpen((prev: any) => ({
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
      setPendingPostServiceKycFiles((prev: any) => ({ ...prev, [field]: files }));
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
      setRemovedPostServiceKycFileIds((prev: any) => (prev.includes(fileId) ? prev : [...prev, fileId]));
      setOverviewEditForm((prev: any) => ({
        ...prev,
        postServiceKycForm: removePostServiceKycStoredFile(prev.postServiceKycForm, field, fileId),
      }));
    },
    [],
  );
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
const [recruiters, setRecruiters] = useState<TeamMember[]>([]);
const [loadingUsers, setLoadingUsers] = useState(false);
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
      email: visibleContactEmail(contact.email),
      phone: contact.phone || '',
      isPrimary: contact.isPrimary || false,
      lastContacted: contact.lastContacted
        ? formatDateDMY(contact.lastContacted)
        : 'Never',
      avatar: contact.avatar || undefined,
      preferredChannel: (visiblePreferredChannel(contact.preferredChannel) || undefined) as ClientContact['preferredChannel'],
      notes:
        contact.notesText ||
        (Array.isArray(contact.notes)
          ? contact.notes.map((note: any) => note.note).filter(Boolean).join('\n') || undefined
          : undefined),
      activity: [],
    };
  }, []);
const refreshClientContacts = useCallback(async () => {
    if (!client?.id) {
      setClientContacts([]);
      setClientTeamMemberContacts([]);
      setLoadingContacts(false);
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
        email: visibleContactEmail(email),
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
      const mappedContacts: ClientContact[] = dedupeVisibleContacts(
        contactsList.map((contact: BackendContact) => mapBackendContactToClientContact(contact)),
      );
      setClientContacts(mappedContacts);
      setClientTeamMemberContacts(
        contactsList.filter((contact: BackendContact) => isClientTeamMemberContact(contact)),
      );

      setSelectedContact((prev: any) => {
        if (!prev) return prev;
        return mappedContacts.find((c: any) => c.id === prev.id) || null;
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
    const teamContactIds = new Set(clientTeamMemberContacts.map((contact: any) => contact.id));
    const reservedEmails = new Set(
      [
        normalizeEmail(primaryEmail),
        ...clientContacts
          .filter((contact: any) => !teamContactIds.has(contact.id))
          .map((contact: any) => normalizeEmail(contact.email)),
      ].filter(Boolean),
    );
    const seenTeamEmails = new Set<string>();
    let skippedDuplicateEmails = false;
    const normalizedMembers = rawMembers.filter((member: any) => {
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
        .map((member: any) => String(member.id || '').trim())
        .filter((id: any) => id && id !== resolvedDirectorContactId),
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
        return resolveDirectorBackendContact(contactsList)?.id
          || contactsList.find((contact: any) => {
            const sameName =
              `${contact.firstName || ''} ${contact.lastName || ''}`.trim().toLowerCase() ===
              options.directorName.trim().toLowerCase();
            const samePhone =
              String(contact.phone || '').replace(/\D/g, '').slice(-10) ===
              String(options.phone || '').replace(/\D/g, '').slice(-10);
            return sameName && (samePhone || !options.phone);
          })?.id;
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
      email: visibleContactEmail(contact.email),
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
    const email = visibleContactEmail(contact.email);
    if (!email) {
      void requestWarning('No email available for this contact.');
      return;
    }
    const subject = encodeURIComponent(`Hello ${contact.name || ''}`.trim());
    const body = encodeURIComponent(`Hi ${contact.name || ''},\n\n`);
    const mailto = `mailto:${email}?subject=${subject}&body=${body}`;
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
const canEditClient =
    isHqOverrideMode ||
    hasAnyPermission(
      defaultRecruitmentEnabled ? ['recruitment_clients_update'] : ['clients_update'],
    );
const canDeleteClient =
    Boolean(onDelete) &&
    (isHqOverrideMode ||
      hasAnyPermission(
        defaultRecruitmentEnabled ? ['recruitment_clients_delete'] : ['clients_delete'],
      ));
const canViewClientAgreements =
    isHqOverrideMode || hasAnyPermission(['agreements_read', 'agreements_manage']);
const canManageClientAgreements =
    isHqOverrideMode || hasAnyPermission(['agreements_manage']);
const addClientTabs = ADD_CLIENT_TABS.filter(
    (tab: any) => tab.id !== 'agreements' || canManageClientAgreements,
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
      const full = (res as any)?.data?.data || (res as any)?.data || res;
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

        const assigneeName =
          formatAssigneeDisplayName(full.assignedTo) ||
          full.assignedTo?.name ||
          mapped.recruiter;
        const enriched: JobForDrawer = {
          ...mapped,
          clientId: full.clientId || full.client?.id || client?.id || undefined,
          assignedToId: full.assignedToId || full.assignedTo?.id || null,
          recruiter: assigneeName,
          owner: assigneeName || mapped.owner,
          orgUnitId:
            full.orgUnitId ||
            full.assignedTo?.assignCompanyId ||
            full.assignedTo?.orgUnitId ||
            full.assignedTo?.orgUnit?.id ||
            undefined,
          hiringManager: full.hiringManager || mapped.hiringManager,
          hiringManagerId: full.hiringManagerId || null,
          managerId: full.managerId || full.manager?.id || null,
          managerName: full.manager?.name || undefined,
          supportingRecruiters: Array.isArray(full.supportingRecruiters)
            ? full.supportingRecruiters.map(String)
            : [],
        };

        setJobCandidatesForDrawer(candidates);
        setJobPipelineStagesForDrawer(full.pipelineStages ?? undefined);
        setSelectedJobForDrawer(enriched);
        // eslint-disable-next-line no-console
        console.log('opening JobDetailsDrawer for', enriched?.id, 'candidates', candidates.length);
        setJobDetailsOpen(true);
        return;
      }
    } catch (err) {
      // ignore and fallback to minimal mapped job
      // eslint-disable-next-line no-console
      console.warn('Failed to fetch full job details', err);
    }

    setSelectedJobForDrawer({
      ...mapped,
      clientId: client?.id || undefined,
    });
    // eslint-disable-next-line no-console
    console.log('opening JobDetailsDrawer for', mapped?.id);
    setJobDetailsOpen(true);
  };
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
    const next = pipelineStages.filter((s: any) => s.id !== id);
    setPipelineStages(next);
  };
const handleStageNameChange = (id: string, name: string) => {
    const next = pipelineStages.map((s: any) => (s.id === id ? { ...s, name } : s));
    setPipelineStages(next);
  };
const handleStageSlaChange = (id: string, sla: string) => {
    const next = pipelineStages.map((s: any) => (s.id === id ? { ...s, sla } : s));
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
    setSendMessageForm((prev: any) =>
      prev.contactIds.includes(contactId)
        ? { ...prev, contactIds: prev.contactIds.filter((id: any) => id !== contactId) }
        : { ...prev, contactIds: [...prev.contactIds, contactId] }
    );
  };
const toggleOverviewSection = (key: string) => {
    setOverviewOpen((prev: any) => ({ ...prev, [key]: !prev[key] }));
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
const markClientLogoRemoved = () => {
    if (pendingClientLogoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(pendingClientLogoPreview);
    }
    setPendingClientLogoFile(null);
    setPendingClientLogoPreview('');
    setOverviewEditForm((prev: any) => ({ ...prev, logo: '' }));
    setLogoRemoved(true);
  };
const syncClientLogoLocally = (logoUrl: string) => {
    setOverviewEditForm((prev: any) => ({ ...prev, logo: logoUrl }));
    setFullClientData((prev: any) => (prev ? { ...prev, logo: logoUrl } : prev));
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
      setOverviewEditForm((prev: any) => ({ ...prev, logo: previewUrl }));
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
        const matchedUser = users.find((u: any) => u.name === client.owner?.name);
        if (matchedUser) assignedToId = matchedUser.id;
      }
      fetchedContacts = clientContacts.length
        ? (clientContacts.map((c: any) => ({
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
          apiGetContacts({ clientId: client.id, type: 'CLIENT' }).catch((error: any) => {
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
          const matchedUser = users.find((u: any) => u.name === client.owner?.name);
          if (matchedUser) {
            assignedToId = matchedUser.id;
          }
        }
      }
    }
    
    // Push fresh contacts into state so view mode and Contacts tab stay in sync.
    if (fetchedContacts.length) {
      setClientContacts(dedupeVisibleContacts(fetchedContacts.map(mapBackendContactToClientContact)));
      setClientTeamMemberContacts(
        fetchedContacts.filter((contact: any) => isClientTeamMemberContact(contact)),
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
    const fetchedPrimaryEmail = visibleContactEmail(fetchedDirector?.email);
    const fetchedPrimaryPhone = fetchedDirector?.phone || '';

    const directorNameValue =
      fetchedPrimaryName || storedDirector.directorName || primaryClientContact?.name || '';
    const contactEmailValue = fetchedPrimaryEmail || primaryClientContactEmail;
    const contactPhoneValue = fetchedPrimaryPhone || primaryClientContactPhone;
    const otherDetailsForDirectors =
      (fetchedClient as BackendClient | null)?.otherDetails ?? client?.otherDetails ?? null;
    const contactEmailsForForm = contactListForForm(
      (fetchedClient as { emails?: string[] })?.emails || client?.emails,
      contactEmailValue,
    );
    const contactPhonesForForm = contactListForForm(
      (fetchedClient as { phones?: string[] })?.phones || client?.phones,
      contactPhoneValue,
    );
    const directorSalutationValue =
      fetchedClient?.directorSalutation ||
      client?.directorSalutation ||
      storedDirector.directorSalutation ||
      fetchedDirector?.salutation ||
      '';
    const directorsForForm = resolveDirectorList({
      directorSalutation: directorSalutationValue,
      directorName: directorNameValue,
      email: contactEmailValue,
      phone: contactPhoneValue,
      emails: contactEmailsForForm,
      phones: contactPhonesForForm,
      otherDetails: otherDetailsForDirectors,
    });
    
    const statusMap: Record<string, 'ACTIVE' | 'ON_HOLD' | 'INACTIVE'> = {
      'Active': 'ACTIVE',
      'On Hold': 'ON_HOLD',
      'Inactive': 'INACTIVE',
      'Hot Clients 🔥': 'ACTIVE',
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
      directors: directorsForForm,
      contactEmail: contactEmailValue,
      contactPhone: contactPhoneValue,
      contactEmails: contactEmailsForForm,
      contactPhones: contactPhonesForForm,
      hiringLocations: fetchedClient?.hiringLocations || client.hiringLocations || '',
      timezone: fetchedClient?.timezone || client.timezone || '',
      priority: fetchedClient?.priority || client.priority || '',
      servicesNeeded: fetchedClient?.servicesNeeded || client.servicesNeeded || '',
      expectedBusinessValue: businessValueInputValue(
        fetchedClient?.expectedBusinessValue || client.expectedBusinessValue || '',
      ),
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
      directorSalutation: directorSalutationValue,
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
          fetchedContacts.filter((contact: any) => isClientTeamMemberContact(contact)),
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
    setClientLeadStatusCatalog((current: any) =>
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
    setClientPriorityCatalog((current: any) =>
      mergeCatalogOptions(
        DEFAULT_CLIENT_PRIORITY_LABELS,
        current,
        fetchedClient?.priority || client.priority || overviewEditForm.priority,
      ),
    );
    setAgreementLevelCatalog((current: any) =>
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
          .map((link: any) => String(link || '').trim())
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
          expectedBusinessValue:
            normalizeBusinessValueForSave(overviewEditForm.expectedBusinessValue) || undefined,
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
              overviewEditForm.directors ||
                resolveDirectorList({
                  directorSalutation: overviewEditForm.directorSalutation,
                  directorName: overviewEditForm.directorName,
                  email: overviewEditForm.contactEmail,
                  phone: overviewEditForm.contactPhone,
                  emails: overviewEditForm.contactEmails,
                  phones: overviewEditForm.contactPhones,
                }),
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
          (sum: any, files: any) => sum + files.length,
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
          (sum: any, files: any) => sum + files.length,
          0,
        );
        let nextPostServiceKycForm = overviewEditForm.postServiceKycForm;
        const cleanedCompanyLinks = (overviewEditForm.companyLinks || [overviewEditForm.website || ''])
          .map((link: any) => String(link || '').trim())
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
        if (overviewEditForm.expectedBusinessValue !== undefined) {
          updateData.expectedBusinessValue =
            normalizeBusinessValueForSave(overviewEditForm.expectedBusinessValue) || null;
        }
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
            overviewEditForm.directors ||
              resolveDirectorList({
                directorSalutation: overviewEditForm.directorSalutation,
                directorName: overviewEditForm.directorName,
                email: overviewEditForm.contactEmail,
                phone: overviewEditForm.contactPhone,
                emails: overviewEditForm.contactEmails,
                phones: overviewEditForm.contactPhones,
              }),
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
useEffect(() => {
    const fetchUsers = async () => {
      setLoadingUsers(true);
      try {
        if (isHqOverrideMode) {
          const hqTeam = await apiHqListTeam();
          const members = hqTeam.data?.members ?? [];
          const mapped = members.map((member: any) => {
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
        const response = await apiGetClientAssignableMembers(undefined, {
          recruitment: defaultRecruitmentEnabled === true,
        });
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
          members.map((member: any) => ({
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
    const assignedId = String(overviewEditForm.assignedToId || '').trim();
    const ownerName =
      formatAssigneeDisplayName({
        id: assignedId,
        name: client?.owner?.name,
      }) || String(client?.owner?.name || '').trim();
    if (!assignedId || !ownerName) return;
    const parts = ownerName.split(/\s+/).filter(Boolean);
    setRecruiters((prev: any) => {
      if (prev.some((member: any) => member.id === assignedId)) return prev;
      return [
        ...prev,
        {
          id: assignedId,
          firstName: parts[0] || ownerName,
          lastName: parts.slice(1).join(' '),
          name: ownerName,
          email: '',
          status: 'ACTIVE',
        } as unknown as TeamMember,
      ];
    });
    setUsers((prev: any) => {
      if (prev.some((user: any) => user.id === assignedId)) return prev;
      return [...prev, { id: assignedId, name: ownerName, email: '' } as BackendUser];
    });
  }, [overviewEditForm.assignedToId, client?.owner?.name]);
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
      DEFAULT_CLIENT_STATUS_LABELS.some((option: any) => option.toLowerCase() === normalized.toLowerCase())
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
      DEFAULT_CLIENT_PRIORITY_LABELS.some((option: any) => option.toLowerCase() === normalized.toLowerCase())
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
      AGREEMENT_LEVEL_OPTIONS.some((option: any) => option.toLowerCase() === normalized.toLowerCase())
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
    setOverviewEditForm((p: any) => ({ ...p, ...mergeExtractedAgreementTerms(p, terms) }));
    if (terms.agreementLevel?.trim()) {
      setAgreementLevelCatalog((prev: any) => {
        const level = terms.agreementLevel.trim();
        if (prev.some((item: any) => item.toLowerCase() === level.toLowerCase())) return prev;
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
      setShowAddAgreementLevelInput((prev: any) => !prev);
      setNewAgreementLevelValue('');
    },
    onNewValueChange: setNewAgreementLevelValue,
    onAdd: () =>
      addAgreementLevelOption((nextLevel: any) =>
        setOverviewEditForm((p: any) => ({ ...p, agreementLevel: nextLevel })),
      ),
    onCancelAdd: () => {
      setShowAddAgreementLevelInput(false);
      setNewAgreementLevelValue('');
    },
    onDelete: (level: any) =>
      deleteAgreementLevelOption(level, (nextLevel: any) =>
        setOverviewEditForm((p: any) => ({ ...p, agreementLevel: nextLevel })),
      ),
  };
useEffect(() => {
    if (!client?.id) {
      setClientActivities([]);
      setLoadingActivities(false);
      return;
    }
    if (isHqOverrideMode) {
      setClientActivities([]);
      setLoadingActivities(false);
      return;
    }

    const load = startAsyncLoad(setLoadingActivities);
    const fetchActivities = async () => {
      try {
        const response = await apiGetClientActivities(client.id);
        if (!load.isActive()) return;
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
        if (load.isActive()) setClientActivities([]);
      } finally {
        load.finish();
      }
    };

    void fetchActivities();
    return () => {
      load.abort();
    };
  }, [client?.id, activeTab, isHqOverrideMode]);
const refreshClientJobs = useCallback(async () => {
    if (!client?.id) {
      setClientJobs([]);
      setLoadingJobs(false);
      return;
    }
    if (isHqOverrideMode) {
      setClientJobs([]);
      setLoadingJobs(false);
      return;
    }

    const load = startAsyncLoad(setLoadingJobs);
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

      if (load.isActive()) setClientJobs(mappedJobs);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
      if (load.isActive()) setClientJobs([]);
    } finally {
      load.finish();
    }
  }, [client?.id, isHqOverrideMode]);
useEffect(() => {
    void refreshClientJobs();
  }, [refreshClientJobs]);
useEffect(() => {
    void refreshClientContacts();
  }, [refreshClientContacts]);
useEffect(() => {
    if (!client?.id || activeTab !== 'schedule') {
      setLoadingMeetings(false);
      return;
    }
    if (isHqOverrideMode) {
      setScheduledMeetings([]);
      setLoadingMeetings(false);
      return;
    }

    const load = startAsyncLoad(setLoadingMeetings);
    const fetchScheduledMeetings = async () => {
      try {
        const meetings = await apiGetClientScheduledMeetings(client.id);
        if (!load.isActive()) return;
        setScheduledMeetings(meetings.data || []);
      } catch (error) {
        console.error('Failed to fetch scheduled meetings:', error);
        if (load.isActive()) setScheduledMeetings([]);
      } finally {
        load.finish();
      }
    };

    void fetchScheduledMeetings();
    return () => {
      load.abort();
    };
  }, [client?.id, activeTab, isHqOverrideMode]);
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
useEffect(() => {
    if (isAddMode) {
      timezoneManuallyEditedRef.current = false;
      // Reset form to empty values when opening in add mode
      setOverviewEditForm((prev: any) => ({
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
        directors: normalizeDirectorList(),
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

    if (initialMode === 'edit' && canEditClient) {
      startOverviewEdit();
      return;
    }

    setOverviewEditMode(false);
  }, [isAddMode, initialMode, client?.id, canEditClient]);
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
    let tabs = isOrgBillingNavEnabled() ? all : all.filter((t: any) => t.id !== 'billing');
    if (isHqOverrideMode) {
      tabs = tabs.filter((t: any) => t.id !== 'jobs' && t.id !== 'placements' && t.id !== 'billing');
    }
    return tabs;
  }, [orgRecruitmentUiVersion, isHqOverrideMode]);
const revenue = client?.revenue ?? `$${(Number(client?.placements ?? 0) * 3.5).toFixed(1)}k`;
const teamMemberContactIds = useMemo(
    () => new Set(clientTeamMemberContacts.map((contact: any) => contact.id)),
    [clientTeamMemberContacts],
  );
const primaryClientContact =
    clientContacts.find((contact: any) => contact.isPrimary && !teamMemberContactIds.has(contact.id)) ||
    clientContacts.find(
      (contact: any) =>
        !teamMemberContactIds.has(contact.id) &&
        String(contact.designation || '').trim().toLowerCase() === 'director',
    ) ||
    clientContacts.find((contact: any) => !teamMemberContactIds.has(contact.id)) ||
    null;
const primaryClientContactEmail = visibleContactEmail(primaryClientContact?.email);
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
const phaseOneJobs = clientJobs.filter((job: any) => job.status !== 'Paused');
const headerLogoSrc = getClientLogoSrc(
    logoRemoved
      ? ''
      : pendingClientLogoPreview ||
          fullClientData?.logo ||
          client?.logo ||
          '',
  );
const drawerTree = (
    <AnimatePresence onExitComplete={releaseClientBodyScrollLock}>
      {drawerIsOpen ? (
          <DetailsModalShell
            key={isAddMode ? 'add-client-drawer' : `client-drawer-${client?.id || 'detail'}`}
            panelRef={clientDrawerPanelRef}
            variant="main"
            onBackdropClick={() => void requestClientDrawerClose()}
            dialogTitleId="client-detail-modal-title"
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
                              void clientAiGate.confirmAndUnlock();
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
                      {activeTab === 'overview' && !overviewEditMode && canEditClient && (
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
                  {canDeleteClient ? (
                  <button
                    type="button"
                    onClick={openDeleteClientForm}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete Client"
                  >
                    <Trash2 size={18} />
                  </button>
                  ) : null}
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
                      {addClientTabs.map((tab: any) => {
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
                                    onChange={(e: any) => setOverviewEditForm((p: any) => ({ ...p, companyName: e.target.value }))}
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
                                        setOverviewEditForm((p: any) => ({ ...p, companyLinks: [...(p.companyLinks || ['']), ''] }))
                                      }
                                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100"
                                      aria-label="Add company link"
                                    >
                                      <Plus size={14} />
                                    </button>
                                  </div>
                                  <div className="space-y-2">
                                    {(overviewEditForm.companyLinks?.length ? overviewEditForm.companyLinks : ['']).map((link: any, index: any) => (
                                      <div key={`add-client-company-link-${index}`} className="flex items-center gap-2">
                                        <input
                                          value={link}
                                          onChange={(e: any) =>
                                            setOverviewEditForm((p: any) => {
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
                                              setOverviewEditForm((p: any) => {
                                                const next = (p.companyLinks?.length ? p.companyLinks : ['']).filter((_: any, i: any) => i !== index);
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
                            onLocationChange={(next: any) =>
                              setOverviewEditForm((p: any) => ({ ...p, location: next }))
                            }
                            onSelect={(s: LocationSelection) => {
                              timezoneManuallyEditedRef.current = false;
                              setOverviewEditForm((p: any) => mergeClientLocationSelection(p, s));
                            }}
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <AddLeadFieldLabel label="Industry" icon={Briefcase} iconClassName="text-emerald-500" />
                          <IndustryMultiSelect
                            value={overviewEditForm.industry ?? ''}
                            onChange={(industry: any) => setOverviewEditForm((p: any) => ({ ...p, industry }))}
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
                            onChange={(timezone: any) =>
                              setOverviewEditForm((p: any) => ({ ...p, timezone }))
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
                            directors={overviewEditForm.directors}
                            onDirectorsChange={(directors: any) =>
                              setOverviewEditForm((p: any) => ({
                                ...p,
                                directors: normalizeDirectorList(directors),
                              }))
                            }
                            emails={overviewEditForm.contactEmails}
                            phones={overviewEditForm.contactPhones}
                            email={overviewEditForm.contactEmail}
                            phone={overviewEditForm.contactPhone}
                            countryCode={overviewEditForm.countryCode}
                            countryName={overviewEditForm.country}
                            allowNotAvailable
                            emailNotAvailable={Boolean(overviewEditForm.emailNotAvailable)}
                            phoneNotAvailable={Boolean(overviewEditForm.phoneNotAvailable)}
                            onEmailNotAvailableChange={(emailNotAvailable: any) => {
                              setOverviewEditForm((p: any) => ({
                                ...p,
                                emailNotAvailable,
                                ...(emailNotAvailable ? { contactEmails: [''], contactEmail: '' } : {}),
                              }));
                            }}
                            onPhoneNotAvailableChange={(phoneNotAvailable: any) => {
                              setOverviewEditForm((p: any) => ({
                                ...p,
                                phoneNotAvailable,
                                ...(phoneNotAvailable ? { contactPhones: [''], contactPhone: '' } : {}),
                              }));
                            }}
                            onDirectorSalutationChange={(value: any) =>
                              setOverviewEditForm((p: any) => ({ ...p, directorSalutation: value }))
                            }
                            onContactPersonChange={(value: any) =>
                              setOverviewEditForm((p: any) => ({ ...p, directorName: value }))
                            }
                            onEmailsChange={(contactEmails: any, primaryEmail: any) => {
                              setOverviewEditForm((p: any) => ({
                                ...p,
                                contactEmails,
                                contactEmail: primaryEmail,
                                emailNotAvailable: primaryEmail.trim() ? false : p.emailNotAvailable,
                              }));
                            }}
                            onPhonesChange={(contactPhones: any, primaryPhone: any) => {
                              setOverviewEditForm((p: any) => ({
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
                            onChange={(teamMembers: any) =>
                              setOverviewEditForm((p: any) => ({ ...p, ...syncClientTeamMembers(teamMembers) }))
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
                                          setShowAddClientLeadStatusInput((prev: any) => !prev);
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
                                      onSelect={(status: any) =>
                                        setOverviewEditForm((p: any) => ({
                                          ...p,
                                          leadStatusValue: status,
                                          status: clientStatusLabelToBackend(status),
                                        }))
                                      }
                                      onDelete={(status: any) =>
                                        deleteClientLeadStatusOption(status, (nextStatus: any) =>
                                          setOverviewEditForm((p: any) => ({
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
                                          onChange={(e: any) => setNewClientLeadStatusValue(e.target.value)}
                                          className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                          placeholder="Enter new status"
                                        />
                                        <button
                                          type="button"
                                          onClick={() =>
                                            addClientLeadStatusOption((status: any) =>
                                              setOverviewEditForm((p: any) => ({
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
                                        setShowAddClientPriorityInput((prev: any) => !prev);
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
                                    onSelect={(priority: any) =>
                                      setOverviewEditForm((p: any) => ({ ...p, priority }))
                                    }
                                    onDelete={(priority: any) =>
                                      deleteClientPriorityOption(priority, (nextPriority: any) =>
                                        setOverviewEditForm((p: any) => ({ ...p, priority: nextPriority }))
                                      )
                                    }
                                  />
                                  {showAddClientPriorityInput ? (
                                    <div className="mt-2 flex items-center gap-2">
                                      <input
                                        value={newClientPriorityValue}
                                        onChange={(e: any) => setNewClientPriorityValue(e.target.value)}
                                        className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        placeholder="Enter new interest level"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          addClientPriorityOption((priority: any) =>
                                            setOverviewEditForm((p: any) => ({ ...p, priority }))
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
                                      assignmentModule={
                                        isHqOverrideMode
                                          ? undefined
                                          : defaultRecruitmentEnabled
                                            ? 'Recruitment Clients'
                                            : 'Clients'
                                      }
                                      onChange={(ids: any) => {
                                        setOverviewEditForm((p: any) => ({
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
                                  onChange={(servicesNeeded: any) => setOverviewEditForm((p: any) => ({ ...p, servicesNeeded }))}
                                  industry={overviewEditForm.industry ?? ''}
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Expected Business Value</label>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={overviewEditForm.expectedBusinessValue}
                                  onChange={(e: any) =>
                                    setOverviewEditForm((p: any) => ({
                                      ...p,
                                      expectedBusinessValue: sanitizeBusinessValueInput(e.target.value),
                                    }))
                                  }
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                  placeholder="e.g. 50000"
                                />
                              </div>
                              <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-4 space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Dynamic Fields</p>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setOverviewEditForm((p: any) => ({
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
                                    {overviewEditForm.dynamicOtherDetails.map((row: any, idx: any) => (
                                      <div key={`client-dyn-a-${idx}`} className="flex flex-wrap items-center gap-2">
                                        <input
                                          value={row.label}
                                          onChange={(e: any) => {
                                            const label = e.target.value;
                                            setOverviewEditForm((p: any) => ({
                                              ...p,
                                              dynamicOtherDetails: p.dynamicOtherDetails.map((r: any, i: any) =>
                                                i === idx ? { ...r, label } : r,
                                              ),
                                            }));
                                          }}
                                          placeholder="Field name"
                                          className="min-w-[8rem] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        />
                                        <input
                                          value={row.value}
                                          onChange={(e: any) => {
                                            const value = e.target.value;
                                            setOverviewEditForm((p: any) => ({
                                              ...p,
                                              dynamicOtherDetails: p.dynamicOtherDetails.map((r: any, i: any) =>
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
                                            setOverviewEditForm((p: any) => ({
                                              ...p,
                                              dynamicOtherDetails: p.dynamicOtherDetails.filter((_: any, i: any) => i !== idx),
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
                        onChange={(occasions: any) =>
                          setOverviewEditForm((p: any) => ({ ...p, occasions }))
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
                                onChange={(patch: any) => setOverviewEditForm((p: any) => ({ ...p, ...patch }))}
                                disabled={uploadingKyc || uploadingAgreements}
                                showContractValidity
                                showTitle={false}
                                levelCatalog={agreementLevelCatalogProps}
                                extractedKeys={extractedAgreementKeys}
                                uploadSlot={
                                  <AgreementDocumentUpload
                                    description=""
                                    pendingFile={pendingAgreementsFile}
                                    onPendingFileChange={(file: any) => {
                                      setPendingAgreementsFile(file);
                                      if (file) {
                                        setOverviewEditForm((p: any) => ({ ...p, agreementsFileName: file.name }));
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
                                onFormExtracted={(postServiceKycForm: any) =>
                                  setOverviewEditForm((p: any) => ({ ...p, postServiceKycForm }))
                                }
                              />
                              <ClientPostServiceKycFormSection
                                values={overviewEditForm.postServiceKycForm}
                                onChange={(postServiceKycForm: any) =>
                                  setOverviewEditForm((p: any) => ({ ...p, postServiceKycForm }))
                                }
                                disabled={uploadingKyc || uploadingAgreements}
                                uploadsBase={uploadsBase}
                                pendingFilesByField={pendingPostServiceKycFiles}
                                onPendingFilesChange={setPendingPostServiceKycFilesForField}
                                onRemoveStoredFile={removeStoredPostServiceKycFile}
                                onFormExtracted={(postServiceKycForm: any) =>
                                  setOverviewEditForm((p: any) => ({ ...p, postServiceKycForm }))
                                }
                              />
                    </DrawerSectionCard>
                    ) : null}

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          const idx = addClientTabs.findIndex((t: any) => t.id === addClientTab);
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
                            const idx = addClientTabs.findIndex((t: any) => t.id === addClientTab);
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
                              {(client.contacts ?? []).map((c: any) => (
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
                            onClick={() => setSendMessageTemplateOpen((v: any) => !v)}
                            className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-left text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          >
                            <span className={sendMessageForm.templateId ? 'text-slate-900' : 'text-slate-400'}>
                              {MESSAGE_TEMPLATES.find((t: any) => t.id === sendMessageForm.templateId)?.label ?? 'Select template'}
                            </span>
                            <ChevronDown size={16} className="text-slate-400 shrink-0" />
                          </button>
                          {sendMessageTemplateOpen && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setSendMessageTemplateOpen(false)} aria-hidden />
                              <ul className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                                {MESSAGE_TEMPLATES.map((t: any) => (
                                  <li key={t.id}>
                                    <button
                                      type="button"
                                      onClick={() => { setSendMessageForm((prev: any) => ({ ...prev, templateId: t.id })); setSendMessageTemplateOpen(false); }}
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
                          onChange={(e: any) => setSendMessageForm((prev: any) => ({ ...prev, message: e.target.value }))}
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
                            onChange={(e: any) => setSendMessageForm((prev: any) => ({ ...prev, attachmentNames: Array.from(e.target.files ?? []).map((f: any) => f.name).join(', ') }))}
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
                          onChange={(e: any) => setSendMessageForm((prev: any) => ({ ...prev, logAsActivity: e.target.checked }))}
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
                            onClick={() => { setChangeStageDropdownOpen((v: any) => !v); setChangeStageReasonDropdownOpen(false); }}
                            className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-left text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          >
                            <span className={changeStageForm.stage ? 'text-slate-900' : 'text-slate-400'}>{changeStageForm.stage}</span>
                            <ChevronDown size={16} className="text-slate-400 shrink-0" />
                          </button>
                          {changeStageDropdownOpen && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setChangeStageDropdownOpen(false)} aria-hidden />
                              <ul className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                                {CLIENT_STAGES.map((s: any) => (
                                  <li key={s}>
                                    <button
                                      type="button"
                                      onClick={() => { setChangeStageForm((prev: any) => ({ ...prev, stage: s, reason: s === 'On Hold' || s === 'Inactive' ? prev.reason : '' })); setChangeStageDropdownOpen(false); }}
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
                              onClick={() => { setChangeStageReasonDropdownOpen((v: any) => !v); setChangeStageDropdownOpen(false); }}
                              className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-left text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            >
                              <span className={changeStageForm.reason ? 'text-slate-900' : 'text-slate-400'}>{changeStageForm.reason || 'Select reason'}</span>
                              <ChevronDown size={16} className="text-slate-400 shrink-0" />
                            </button>
                            {changeStageReasonDropdownOpen && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setChangeStageReasonDropdownOpen(false)} aria-hidden />
                                <ul className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                                  {STAGE_REASONS.map((r: any) => (
                                    <li key={r}>
                                      <button
                                        type="button"
                                        onClick={() => { setChangeStageForm((prev: any) => ({ ...prev, reason: r })); setChangeStageReasonDropdownOpen(false); }}
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
                          onChange={(e: any) => setDeleteConfirmName(e.target.value)}
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
                ) : activeTab === 'overview' ? <ClientOverviewTab addClientLeadStatusOption={addClientLeadStatusOption} addClientPriorityOption={addClientPriorityOption} agreementLevelCatalogProps={agreementLevelCatalogProps} agreementsInputRef={agreementsInputRef} agreementsUploadFeedback={agreementsUploadFeedback} applyExtractedAgreementTerms={applyExtractedAgreementTerms} assignedToValue={assignedToValue} businessValue={businessValue} canCreateJob={canCreateJob} canManageClientAgreements={canManageClientAgreements} canViewClientAgreements={canViewClientAgreements} client={client} clientContacts={clientContacts} clientFieldVisibility={clientFieldVisibility} clientKycFiles={clientKycFiles} clientLeadStatusOptions={clientLeadStatusOptions} clientLogoInputRef={clientLogoInputRef} clientLogoPreview={clientLogoPreview} clientPriorityOptions={clientPriorityOptions} clientTeamMemberContacts={clientTeamMemberContacts} companyLinksValue={companyLinksValue} defaultRecruitmentEnabled={defaultRecruitmentEnabled} deleteClientLeadStatusOption={deleteClientLeadStatusOption} deleteClientPriorityOption={deleteClientPriorityOption} deleteFile={deleteFile} deletingClientLeadStatus={deletingClientLeadStatus} deletingClientPriority={deletingClientPriority} extractedAgreementKeys={extractedAgreementKeys} fullClientData={fullClientData} getClientLogoSrc={getClientLogoSrc} isAddMode={isAddMode} isHqOverrideMode={isHqOverrideMode} kycUploadFeedback={kycUploadFeedback} loadingRecruiters={loadingRecruiters} locationFields={locationFields} markClientLogoRemoved={markClientLogoRemoved} newClientLeadStatusValue={newClientLeadStatusValue} newClientPriorityValue={newClientPriorityValue} onSendToRecruitment={onSendToRecruitment} openCreateJobDrawer={openCreateJobDrawer} overviewEditForm={overviewEditForm} overviewEditMode={overviewEditMode} overviewOpen={overviewOpen} pendingAgreementsFile={pendingAgreementsFile} pendingKycFiles={pendingKycFiles} pendingPostServiceKycFiles={pendingPostServiceKycFiles} primaryClientContact={primaryClientContact} primaryClientContactEmail={primaryClientContactEmail} primaryClientContactPhone={primaryClientContactPhone} recruiters={recruiters} refetchClientFiles={refetchClientFiles} removeStoredPostServiceKycFile={removeStoredPostServiceKycFile} savingClientLeadStatus={savingClientLeadStatus} savingClientPriority={savingClientPriority} sendingToRecruitment={sendingToRecruitment} servicesNeededValue={servicesNeededValue} setActiveTab={setActiveTab} setNewClientLeadStatusValue={setNewClientLeadStatusValue} setNewClientPriorityValue={setNewClientPriorityValue} setOverviewEditForm={setOverviewEditForm} setPendingAgreementsFile={setPendingAgreementsFile} setPendingKycFiles={setPendingKycFiles} setPendingPostServiceKycFilesForField={setPendingPostServiceKycFilesForField} setScheduledMeetings={setScheduledMeetings} setShowAddClientLeadStatusInput={setShowAddClientLeadStatusInput} setShowAddClientPriorityInput={setShowAddClientPriorityInput} setShowScheduleMeetingForm={setShowScheduleMeetingForm} showAddClientLeadStatusInput={showAddClientLeadStatusInput} showAddClientPriorityInput={showAddClientPriorityInput} showScheduleMeetingForm={showScheduleMeetingForm} statusValue={statusValue} timezoneManuallyEditedRef={timezoneManuallyEditedRef} toggleOverviewSection={toggleOverviewSection} uploadingAgreements={uploadingAgreements} uploadingClientLogo={uploadingClientLogo} uploadingKyc={uploadingKyc} uploadsBase={uploadsBase} viewDynamicFields={viewDynamicFields} /> : activeTab === 'contacts' ? <ClientContactsTab ADD_CONTACT_DEPARTMENTS={ADD_CONTACT_DEPARTMENTS} addContactDeptOpen={addContactDeptOpen} addContactForm={addContactForm} client={client} clientContacts={clientContacts} contactToDelete={contactToDelete} deletingContact={deletingContact} editingContactId={editingContactId} handleDeleteContact={handleDeleteContact} handleEditContactClick={handleEditContactClick} handleEmailClick={handleEmailClick} handleWhatsAppClick={handleWhatsAppClick} loadingContacts={loadingContacts} openAddContactForm={openAddContactForm} refreshClientContacts={refreshClientContacts} resetContactForm={resetContactForm} selectedContact={selectedContact} setAddContactDeptOpen={setAddContactDeptOpen} setAddContactForm={setAddContactForm} setContactToDelete={setContactToDelete} setEditingContactId={setEditingContactId} setSelectedContact={setSelectedContact} setShowAddContactForm={setShowAddContactForm} showAddContactForm={showAddContactForm} /> : activeTab === 'jobs' ? <ClientJobsTab canCreateJob={canCreateJob} client={client} handlePauseJob={handlePauseJob} loadingJobs={loadingJobs} openCreateJobDrawer={openCreateJobDrawer} openDuplicateJobDrawer={openDuplicateJobDrawer} openJobDrawerFromClientJob={openJobDrawerFromClientJob} phaseOneJobs={phaseOneJobs} /> : activeTab === 'placements' ? <ClientPlacementsTab client={client} /> : activeTab === 'billing' ? <ClientBillingTab client={client} /> : activeTab === 'activity' ? <ClientActivityTab ACTIVITY_TIMELINE_FILTERS={ACTIVITY_TIMELINE_FILTERS} activityFilter={activityFilter} client={client} clientActivities={clientActivities} loadingActivities={loadingActivities} setActivityFilter={setActivityFilter} /> : activeTab === 'notes' ? <ClientNotesTab client={client} /> : activeTab === 'files' ? <ClientFilesTab FILE_TYPE_OPTIONS={FILE_TYPE_OPTIONS} client={client} clientFiles={clientFiles} deleteFile={deleteFile} filesError={filesError} filesLoading={filesLoading} filesTypeFilter={filesTypeFilter} filesUploadPercent={filesUploadPercent} filesUploadSuccess={filesUploadSuccess} filesUploading={filesUploading} isHqOverrideMode={isHqOverrideMode} setFilesTypeFilter={setFilesTypeFilter} uploadFile={uploadFile} /> : activeTab === 'schedule' ? <ClientScheduleTab client={client} loadingMeetings={loadingMeetings} meetingStatusFilter={meetingStatusFilter} scheduledMeetings={scheduledMeetings} setMeetingStatusFilter={setMeetingStatusFilter} setScheduledMeetings={setScheduledMeetings} setShowScheduleMeetingForm={setShowScheduleMeetingForm} showScheduleMeetingForm={showScheduleMeetingForm} /> : activeTab === 'chat' ? <ClientChatTab activeTab={activeTab} client={client} propIsAddMode={propIsAddMode} /> : null}
              </div>
              </div>

            </div>
              </>
            )}
            </DetailsModalShell>
      ) : null}
    </AnimatePresence>
  );

  return { clientPanelPortalReady, createJobDrawerOpen, drawerTree, duplicateFromJobId, jobCandidatesForDrawer, jobDetailsOpen, jobPipelineStagesForDrawer, pipelineStages, refreshClientJobs, selectedJobForDrawer, setClientActivities, setCreateJobDrawerOpen, setDuplicateFromJobId, setJobCandidatesForDrawer, setJobDetailsOpen, setSelectedJobForDrawer };
}