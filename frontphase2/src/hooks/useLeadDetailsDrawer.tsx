'use client';

import { LeadAddTab } from '../components/drawers/leadTabs/Add';
import { LeadOverviewTab } from '../components/drawers/leadTabs/Overview';
import { LeadActivitiesTab } from '../components/drawers/leadTabs/Activities';
import { LeadNotesTab } from '../components/drawers/leadTabs/Notes';
import { LeadFilesTab } from '../components/drawers/leadTabs/Files';
import { LeadChatTab } from '../components/drawers/leadTabs/Chat';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { usePageDrawerLifecycle } from '../lib/pageDrawerEvents';
import { useDrawerBodyScrollLock } from './useDrawerBodyScrollLock';
import { buildFileHref } from '../utils/cloudinaryUrls';
import { splitDateTimeForDisplay, toDateTimeLocalInput, fromDateTimeLocalInput } from '../utils/formatLeadDateTime';
import { formatDateDMY, formatDateTimeDMY } from '../utils/dateDisplay';
import { FollowUpDateTimeField } from '../components/FollowUpDateTimeField';
import { buildFollowUpStatusRemark, LeadFollowUpScheduler } from '../components/LeadFollowUpScheduler';
import { formatFollowUpDisplay } from '../utils/formatLeadDateTime';
import { businessValueInputValue, normalizeBusinessValueForSave, sanitizeBusinessValueInput } from '../lib/businessValue';
import { NAME_SALUTATION_OPTIONS, formatDirectorDisplay } from '../constants/salutations';
import { MultiContactFields } from '../components/ui/MultiContactFields';
import { buildContactChannelsFromForm, contactListForForm, formatContactListMultiline, normalizeContactList, primaryContactValue } from '../lib/contact-channels';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { requestConfirm, requestError, requestWarning } from '../lib/appDialog';
import { ArrowLeft, ArrowRight, Edit2, Building2, User, Mail, Phone, Target, Calendar, PhoneCall, CalendarPlus, CalendarClock, UserPlus, XCircle, UserCog, Clock, Activity, StickyNote, Paperclip, ChevronDown, ChevronRight, LayoutGrid, Plus, Sparkles, Lock, AlertTriangle, Check, Trash2, Upload, Download, Eye, FileText, X, MessageSquare, Link2, MapPin, Briefcase, Globe, Users, IndianRupee, Layers, Megaphone, Flag, Gift, PartyPopper } from 'lucide-react';
import type { Lead, LeadStatus, LeadSource, LeadNoteTag, Activity as LeadActivity } from '@/app/leads/types';
import { EntityAuditSummary } from '../components/table/TableAuditCell';
import { DrawerEntityChatTab } from '../components/drawers/DrawerEntityChatTab';
import { extractAuditMeta } from '../utils/auditMeta';
import { ImageWithFallback } from '../components/ImageWithFallback';
import { ScheduleMeetingForm } from '../components/ScheduleMeetingForm';
import { LeadFollowUpTabPanel } from '../components/drawers/LeadFollowUpTabPanel';
import { emptyHqGrantLeadTrialValues, HqGrantLeadTrialModal, uniqueLeadEmails, type HqGrantLeadTrialValues } from '../components/hq/HqGrantLeadTrialModal';
import { NotesService } from '../components/NotesService';
import { HqLeadRemarksPanel } from '../components/hq/HqLeadRemarksPanel';
import { apiAppendLeadStatus, apiCheckLeadDuplicate, apiCreateLead, apiGenerateLeadDetails, type LeadAiChatMessage, apiGetLeadActivities, apiGetLeadStatusCatalog, apiRemoveLeadStatus, apiUpdateLead, apiHqListTeam, apiHqGrantLeadTrial, filesApiUpload, type CreateLeadData, type BackendActivity, type BackendLead } from '../lib/api';
import { KycDocumentsField } from '../components/documents/KycDocumentsField';
import { AgreementDocumentUpload } from '../components/documents/AgreementDocumentUpload';
import { AgreementTermsSection } from '../components/agreements/AgreementTermsSection';
import { agreementTermsApiPayload, agreementTermsFromRecord, emptyAgreementTerms, mergeExtractedAgreementTerms, type AgreementTermsFormValues } from '../lib/agreementTerms';
import { DocumentUploadButton, useDocumentUploadFeedback } from '../components/import/documentUploadUi';
import { filterKycFiles, uploadKycDocuments } from '../lib/kycDocuments';
import { useFiles } from './useFiles';
import { apiGetLeadAssignableMembers } from '../lib/api';
import { getAllTeamMembersForAssign } from '../lib/api/teamApi';
import type { TeamMember } from '../types/team';
import { LeadAssigneesMultiSelect } from '../components/drawers/LeadAssigneesMultiSelect';
import { assigneeCompanyId, formatAssigneeDisplayName } from '../lib/assigneeDisplay';
import { LeadAiChatDrawer } from '../components/leads/LeadAiChatDrawer';
import { AiCoinLockBadge, useAiCoinGate } from '../components/coins/AiCoinGate';
import { EntityWorkspaceAlertsPanel } from '../components/ai/EntityWorkspaceAlertsPanel';
import { alertDrawerAnalysis, analyzeLeadDrawer } from '@/lib/tenant-drawer-engine';
import type { LeadAiGeneratedPayload } from '@/lib/leadAiHelpers';
import { mergeAiCompanyLinks, mergeAiSourceFields, mergeAiTeamMembers, normalizeLeadDateTimeInput, resolveAiDirectorFields, resolveAiLocationFields } from '@/lib/leadAiHelpers';
import { ServicesNeededSelect } from '../components/forms/ServicesNeededSelect';
import { IndustryMultiSelect } from '../components/forms/IndustryMultiSelect';
import { formatIndustriesDisplay } from '../lib/industryOptions';
import { DirectorContactFields } from '../components/forms/DirectorContactFields';
import { TeamMemberOptionalFields } from '../components/forms/TeamMemberOptionalFields';
import { isDirectorDetailLabel, mergeDirectorsIntoOtherDetails, normalizeDirectorList, resolveDirectorList } from '../lib/directorFormDetails';
import { isTeamMemberDetailLabel, mergeTeamMemberIntoOtherDetails, resolveTeamMemberList, normalizeTeamMemberList, primaryTeamMemberFromList, teamMemberHasAnyValue, teamMemberPayloadFromForm } from '../lib/teamMemberFormDetails';
import { buildLeadOccasionContactOptions, emptyLeadOccasionForm, formatOccasionPersonDisplay, isLeadOccasionDetailLabel, mergeOccasionIntoOtherDetails, readLeadOccasionFromOtherDetails } from '../lib/leadOccasionDetails';
import { isInternalLeadOtherDetailLabel, withPreservedInternalOtherDetails } from '../lib/leadInternalOtherDetails';
import { LeadOccasionFields } from '../components/forms/LeadOccasionFields';
import { DrawerCloseButton } from '../components/drawers/DrawerCloseButton';
import { DetailsModalShell } from '../components/drawers/DetailsModalShell';
import { DrawerTabBar } from '../components/drawers/DrawerTabBar';
import { useDrawerUnsavedGuard } from './useDrawerUnsavedGuard';
import { AddLeadFieldLabel, AddLeadIconInput, AddLeadSectionCard, AddLeadSelectDropdown, ADD_LEAD_INPUT } from '../components/drawers/drawerFormUi';
import { LeadSourceFields, formatLeadSourceDisplay } from '../components/drawers/LeadSourceFields';
import { LeadLocationFields } from '../components/location/LeadLocationFields';
import { getCountryByCodeOrName, inferLocationFromCityName } from '../lib/cscData';
import { startAsyncLoad } from '../lib/asyncLoadGuard';
import { WhatsAppIcon } from '../components/icons/WhatsAppIcon';
import { HqProductLineSelectBoxes, hqProductLineLabels, type HqProductLine } from '../components/hq/HqProductLinePicker';
import { ADD_LEAD_DRAWER_WIDTH_KEY, AddLeadAiFlowProgress, AddLeadFormData, AddLeadWizardProgress, AddLeadWizardStep, CALL_OUTCOMES, DEFAULT_LEAD_STATUSES, FieldRow, FieldRowDateTime, LeadDetailsDrawerProps, LeadRequiredFieldErrors, LeadStatusDropdown, MarkLostFormData, OverviewField, OverviewFieldDateTime, TENANT_ADD_LEAD_WIZARD_STEPS, clampAddLeadDrawerWidth, getInitialAddLeadDrawerWidth, getLeadSourceDetailValue, getSourceFieldLabel, isDefaultLeadStatus, isLeadAlreadyConverted, isProtectedLeadStatus, leadConvertedAlertMessage, leadStatusChipClass, mergeLeadStatusOptions, mergeLocationFields, parseLeadDemoNotes, syncLeadTeamMembers, validateAddLeadWizardStep, validateLeadRequiredFields } from '../components/drawers/leadDetailsShared';

export function useLeadDetailsDrawer(props: LeadDetailsDrawerProps) {
  const {
  lead,
  addLeadMode = false,
  initialOpenAiChat = false,
  initialMode = 'view',
  onClose,
  onAddLead,
  createLeadOverride,
  updateLeadOverride,
  hqMode = false,
  onUpdateLead,
  onConvert,
  onMarkLost,
  onAssignLead,
  onDeleteLead,
  onOpenExistingLead,
} = props;

usePageDrawerLifecycle(Boolean(lead) || addLeadMode);
const isHqOverrideMode = Boolean(hqMode) || (Boolean(updateLeadOverride) && !createLeadOverride);
const isPublicIntakeMode = Boolean(createLeadOverride) && !hqMode;
const drawerIsOpen = Boolean(lead) || addLeadMode;
const leadAiGate = useAiCoinGate('ai.lead_chat');
const [hqProductLine, setHqProductLine] = useState<HqProductLine[]>(['crm']);
const [activeTab, setActiveTab] = useState<'overview' | 'activities' | 'notes' | 'files' | 'chat' | 'followup' | 'add'>(
    'overview'
  );
const [leadFilesTypeFilter, setLeadFilesTypeFilter] = useState<'All' | 'Contract' | 'Proposal' | 'Other'>('All');
const fileInputRef = useRef<HTMLInputElement>(null);
const leadFilesEntityIdForHook =
    isHqOverrideMode || isPublicIntakeMode ? null : lead?.id;
const {
    files: leadFiles,
    loading: filesLoading,
    uploading: filesUploading,
    uploadSuccess: filesUploadSuccess,
    uploadPercent: filesUploadPercent,
    error: filesError,
    uploadFile,
    deleteFile,
  } = useFiles('lead', leadFilesEntityIdForHook);
useEffect(() => {
    if (addLeadMode) {
      setActiveTab('add');
      if (isHqOverrideMode) setHqProductLine(['crm']);
    }
  }, [addLeadMode, isHqOverrideMode]);
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
    directors: normalizeDirectorList(),
    designation: '',
    email: '',
    phone: '',
    emails: [''],
    phones: [''],
    emailNotAvailable: false,
    phoneNotAvailable: false,
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
    sourceOther: '',
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
    followUpContact: '',
    followUpMeetLink: '',
    followUpReminder: 'No reminder',
    followUpTimezone: 'Asia/Kolkata',
    followUpAttendeeIds: [],
    followUpPostponed: false,
    followUpPostponeReason: '',
    followUpPostponePreset: '',
    occasions: emptyLeadOccasionForm(),
  });
const [addLeadStatusIsCustom, setAddLeadStatusIsCustom] = useState(false);
const [leadStatusCatalog, setLeadStatusCatalog] = useState<string[]>(DEFAULT_LEAD_STATUSES);
const [showAddLeadStatusInput, setShowAddLeadStatusInput] = useState(false);
const [newLeadStatusValue, setNewLeadStatusValue] = useState('');
const [savingLeadStatus, setSavingLeadStatus] = useState(false);
const [deletingLeadStatus, setDeletingLeadStatus] = useState(false);
const [addLeadErrors, setAddLeadErrors] = useState<LeadRequiredFieldErrors>({});
const [hqTrialModalOpen, setHqTrialModalOpen] = useState(false);
const [hqTrialValues, setHqTrialValues] = useState<HqGrantLeadTrialValues>(emptyHqGrantLeadTrialValues());
const [hqTrialSubmitting, setHqTrialSubmitting] = useState(false);
const [pendingHqTrialGrant, setPendingHqTrialGrant] = useState<{
    email: string;
    trialDays?: number;
    note?: string;
    notifyEmails?: string[];
  } | null>(null);
const [addLeadDrawerWidth, setAddLeadDrawerWidth] = useState(getInitialAddLeadDrawerWidth);
const addLeadDrawerResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
const addLeadDrawerWidthRef = useRef(addLeadDrawerWidth);
useEffect(() => {
    addLeadDrawerWidthRef.current = addLeadDrawerWidth;
  }, [addLeadDrawerWidth]);
const [pendingAddLeadAgreementsFile, setPendingAddLeadAgreementsFile] = useState<File | null>(null);
const [pendingAddLeadKycFiles, setPendingAddLeadKycFiles] = useState<File[]>([]);
const [pendingAddLeadTeamMemberKycFiles, setPendingAddLeadTeamMemberKycFiles] = useState<File[]>([]);
const addLeadAgreementsInputRef = useRef<HTMLInputElement | null>(null);
const [pendingOverviewAgreementsFile, setPendingOverviewAgreementsFile] = useState<File | null>(null);
const applyExtractedLeadAgreementTerms = useCallback((terms: AgreementTermsFormValues) => {
    setOverviewEditForm((p: any) => ({ ...p, ...mergeExtractedAgreementTerms(p, terms) }));
  }, []);
const [pendingOverviewKycFiles, setPendingOverviewKycFiles] = useState<File[]>([]);
const [pendingOverviewTeamMemberKycFiles, setPendingOverviewTeamMemberKycFiles] = useState<File[]>([]);
const overviewAgreementsInputRef = useRef<HTMLInputElement | null>(null);
const [uploadingAgreements, setUploadingAgreements] = useState(false);
const [uploadingKyc, setUploadingKyc] = useState(false);
const agreementsUploadFeedback = useDocumentUploadFeedback(uploadingAgreements);
const kycUploadFeedback = useDocumentUploadFeedback(uploadingKyc);
const leadFilesEntityId =
    addLeadMode || isHqOverrideMode || isPublicIntakeMode ? null : lead?.id;
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
        // HQ leads assign only to HQ team members (HQ Mongo), never tenant Phase 2 users.
        if (hqMode || isHqOverrideMode) {
          const response = await apiHqListTeam();
          const members = Array.isArray(response.data?.members) ? response.data.members : [];
          setRecruiters(
            members
              .filter((member: any) => String(member.status || 'active').toLowerCase() !== 'inactive')
              .map((member: any) => {
                const name =
                  member.name ||
                  `${member.firstName || ''} ${member.lastName || ''}`.trim() ||
                  member.email ||
                  'HQ Member';
                const parts = name.split(/\s+/).filter(Boolean);
                return {
                  id: member.id,
                  firstName: member.firstName || parts[0] || '',
                  lastName: member.lastName || parts.slice(1).join(' ') || '',
                  name,
                  email: member.email || '',
                  role: {
                    id: member.roleId || member.role || 'hq-role',
                    roleName: member.role || 'Member',
                    color: member.roleColor || 'indigo',
                  },
                  department: member.department
                    ? { id: member.department, name: member.department }
                    : undefined,
                  status: 'ACTIVE' as const,
                };
              }) as TeamMember[],
          );
          return;
        }

        // Tenant Assigned To = all members Super Admin / HQ may assign, including
        // people in other companies created under Organization.
        const teamMembers = await getAllTeamMembersForAssign(undefined, 'Leads');
        const companyNames = new Set(
          (teamMembers || []).map((member: any) => member.orgUnit?.name).filter(Boolean),
        );
        const showCompany = companyNames.size > 1;
        let members: Array<{
          id: string;
          firstName?: string;
          lastName?: string;
          name?: string;
          email?: string;
          orgUnitId?: string;
          role?: { id?: string; roleName?: string; color?: string };
          department?: { id?: string; name?: string };
        }> = (teamMembers || [])
          .filter((member: any) => String(member.status || 'ACTIVE').toUpperCase() !== 'INACTIVE')
          .map((member: any) => {
            const baseName =
              `${member.firstName || ''} ${member.lastName || ''}`.trim() ||
              (member as TeamMember & { name?: string }).name ||
              member.email;
            const company = showCompany && member.orgUnit?.name ? ` · ${member.orgUnit.name}` : '';
            return {
              id: member.id,
              firstName: member.firstName,
              lastName: member.lastName,
              name: `${baseName}${company}`,
              email: member.email,
              role: member.role
                ? {
                    id: member.role.id,
                    roleName: member.role.roleName,
                    color: member.role.color,
                  }
                : undefined,
              department: member.department
                ? { id: member.department.id, name: member.department.name }
                : undefined,
            };
          });

        // Secondary: assignable-members API (now tenant-scoped on backend).
        if (members.length === 0) {
          try {
            const response = await apiGetLeadAssignableMembers();
            const raw = response?.data as unknown;
            members = Array.isArray(raw)
              ? raw
              : Array.isArray((raw as { data?: unknown })?.data)
                ? ((raw as { data: typeof members }).data as typeof members)
                : [];
          } catch (assignableError) {
            console.warn('Assignable members fallback failed:', assignableError);
          }
        }

        // Never show HQ platform roles in tenant Add Lead Assigned To.
        members = members.filter((member: any) => {
          const roleName = String(member.role?.roleName || '').trim().toLowerCase();
          if (!roleName) return true;
          return !(
            roleName.startsWith('hq ') ||
            roleName.includes('hq platform') ||
            roleName.includes('hq team')
          );
        });

        // Keep currently assigned people in the name lookup even if the company
        // picker has not loaded that organization's members yet.
        const currentAssignees = [
          ...(Array.isArray(lead?.assignedToUsers) ? lead.assignedToUsers : []),
          ...(lead?.assignedTo?.id ? [lead.assignedTo] : []),
        ];
        for (const user of currentAssignees) {
          if (!user?.id || members.some((member: any) => member.id === user.id)) continue;
          const named = formatAssigneeDisplayName(user) || user.name || user.email || '';
          const parts = String(named).split(/\s+/).filter(Boolean);
          members.push({
            id: user.id,
            firstName: (user as { firstName?: string }).firstName || parts[0] || '',
            lastName: (user as { lastName?: string }).lastName || parts.slice(1).join(' ') || '',
            name: named,
            email: user.email || '',
            orgUnitId: assigneeCompanyId(user as { assignCompanyId?: string; orgUnitId?: string }),
          });
        }

        setRecruiters(
          members.map((member: any) => {
            const name =
              formatAssigneeDisplayName(member) ||
              member.name ||
              `${member.firstName || ''} ${member.lastName || ''}`.trim() ||
              member.email ||
              'User';
            const parts = name.split(/\s+/).filter(Boolean);
            return {
              id: member.id,
              firstName: member.firstName || parts[0] || '',
              lastName: member.lastName || parts.slice(1).join(' ') || '',
              name,
              email: member.email || '',
              orgUnitId: (member as { orgUnitId?: string }).orgUnitId || undefined,
              role: member.role
                ? {
                    id: member.role.id || 'role',
                    roleName: member.role.roleName || '',
                    color: member.role.color,
                  }
                : undefined,
              department: member.department
                ? { id: member.department.id || 'dept', name: member.department.name || '' }
                : undefined,
              status: 'ACTIVE' as const,
            };
          }) as TeamMember[],
        );
      } catch (error: any) {
        const msg = String(error?.message || '').toLowerCase();
        const transientTimeout =
          /etimedout|timed out|querysrv etimeout|mongodb\.net/.test(msg) ||
          error?.kind === 'timeout' ||
          error?.retryable === true;
        if (transientTimeout) {
          console.warn('Recruiter list temporarily unavailable. Retrying on next drawer open.');
        } else {
          console.error('Failed to fetch recruiters:', error);
        }
        setRecruiters([]);
      } finally {
        setLoadingRecruiters(false);
      }
    };

    fetchRecruiters();
  }, [addLeadMode, lead, hqMode, isPublicIntakeMode, isHqOverrideMode]);
const hqAssignedToPlaceholder = isHqOverrideMode
    ? loadingRecruiters
      ? 'Loading HQ team…'
      : recruiters.length
        ? 'Select HQ team members'
        : 'No HQ team members yet — add them under Team'
    : undefined;
const leadAssignmentModule = isHqOverrideMode || hqMode ? undefined : 'Leads';
useEffect(() => {
    if (!addLeadMode && !lead) return;

    if (isPublicIntakeMode) {
      setLeadStatusCatalog(mergeLeadStatusOptions(DEFAULT_LEAD_STATUSES, lead?.status ?? addLeadForm.status));
      return;
    }

    // HQ statuses live outside tenant org catalog — seed with Demo + defaults only.
    if (isHqOverrideMode) {
      setLeadStatusCatalog(
        mergeLeadStatusOptions(DEFAULT_LEAD_STATUSES, lead?.status ?? addLeadForm.status, { hqMode: true }),
      );
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
  }, [addLeadMode, lead?.id, isPublicIntakeMode, isHqOverrideMode]);
const resetLeadAiAssistant = () => {
    setLeadAiChatOpen(false);
    setLeadAiChatHistory([]);
    setAddLeadAiFlowStage(null);
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
      setAddLeadDrawerWidth((current: any) => {
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
      setAddLeadDrawerWidth((current: any) => clampAddLeadDrawerWidth(current));
    };

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);
const resetAddLeadForm = () => {
    setAddLeadStatusIsCustom(false);
    setPendingHqTrialGrant(null);
    setHqTrialModalOpen(false);
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
      directors: normalizeDirectorList(),
      designation: '',
    email: '',
    phone: '',
    emails: [''],
    phones: [''],
    emailNotAvailable: false,
    phoneNotAvailable: false,
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
    sourceOther: '',
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
      followUpContact: '',
      followUpMeetLink: '',
      followUpReminder: 'No reminder',
      followUpTimezone: 'Asia/Kolkata',
      followUpAttendeeIds: [],
      followUpPostponed: false,
      followUpPostponeReason: '',
      followUpPostponePreset: '',
      occasions: emptyLeadOccasionForm(),
    });
    setAddLeadErrors({});
    setPendingAddLeadAgreementsFile(null);
    setPendingAddLeadKycFiles([]);
    setPendingAddLeadTeamMemberKycFiles([]);
    if (addLeadAgreementsInputRef.current) addLeadAgreementsInputRef.current.value = '';
    setAddLeadWizardStep(isHqOverrideMode ? 'workspace' : 'company');
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
    emailNotAvailable: !(
      generated.email ||
      form.email ||
      primaryContactValue(
        contactListForForm(
          (generated as { emails?: string[] }).emails,
          generated.email || form.email,
        ),
      )
    )
      ? form.emailNotAvailable
      : false,
    phoneNotAvailable: !(
      generated.phone ||
      form.phone ||
      primaryContactValue(
        contactListForForm(
          (generated as { phones?: string[] }).phones,
          generated.phone || form.phone,
        ),
      )
    )
      ? form.phoneNotAvailable
      : false,
    type: generated.type || form.type,
    source: generated.source || form.source,
    status: generated.status || form.status,
    priority: generated.priority || form.priority,
    interestedNeeds: generated.interestedNeeds || form.interestedNeeds,
    notes: businessValueInputValue(generated.expectedBusinessValue || generated.notes) || form.notes,
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
    sourceOther: sourceFields.sourceOther || generated.sourceOther || form.sourceOther,
    otherDetails: Array.isArray(generated.otherDetails) ? generated.otherDetails : form.otherDetails,
    lastFollowUp: normalizeLeadDateTimeInput(generated.lastFollowUp || form.lastFollowUp || ''),
    nextFollowUp: normalizeLeadDateTimeInput(generated.nextFollowUp || form.nextFollowUp || ''),
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
        const match = recruiters.find((member: any) => {
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
const [addLeadWizardStep, setAddLeadWizardStep] = useState<AddLeadWizardStep>('company');
const addLeadWizardSteps = useMemo((): AddLeadWizardStep[] => {
    return isHqOverrideMode ? ['workspace', ...TENANT_ADD_LEAD_WIZARD_STEPS] : TENANT_ADD_LEAD_WIZARD_STEPS;
  }, [isHqOverrideMode]);
const [leadAiChatOpen, setLeadAiChatOpen] = useState(false);
const [leadAiChatHistory, setLeadAiChatHistory] = useState<LeadAiChatMessage[]>([]);
const [addLeadAiFlowStage, setAddLeadAiFlowStage] = useState<'chat' | 'form' | null>(null);
const addLeadWizardStepIndex = addLeadWizardSteps.indexOf(addLeadWizardStep);
const isAddLeadWizardFirstStep = addLeadWizardStepIndex <= 0;
const canGoAddLeadWizardBack = !isAddLeadWizardFirstStep || addLeadAiFlowStage === 'form';
const isAddLeadWizardLastStep =
    addLeadWizardStepIndex >= 0 && addLeadWizardStepIndex === addLeadWizardSteps.length - 1;
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
    if (addLeadMode) {
      setAddLeadWizardStep(isHqOverrideMode ? 'workspace' : 'company');
      setHqProductLine(['crm']);
    }
  }, [lead?.id, addLeadMode, isHqOverrideMode]);
useEffect(() => {
    if (!addLeadMode || isPublicIntakeMode) {
      setLeadAiChatOpen(false);
      setAddLeadAiFlowStage(null);
      return;
    }
    if (initialOpenAiChat) {
      setLeadAiChatOpen(true);
      setAddLeadAiFlowStage('chat');
      return;
    }
    setLeadAiChatOpen(false);
    setAddLeadAiFlowStage(null);
  }, [addLeadMode, initialOpenAiChat, isPublicIntakeMode]);
const [overviewEditMode, setOverviewEditMode] = useState(false);
const [overviewEditErrors, setOverviewEditErrors] = useState<LeadRequiredFieldErrors>({});
const [savingOverviewEdit, setSavingOverviewEdit] = useState(false);
const { panelRef: leadDrawerPanelRef, requestClose: requestLeadDrawerClose, markClean: markLeadDrawerClean } =
    useDrawerUnsavedGuard<HTMLDivElement>({
      isOpen: drawerIsOpen,
      onClose,
      enabled: true,
    });
useEffect(() => {
    if (!drawerIsOpen || !lead?.id || addLeadMode || isHqOverrideMode || isPublicIntakeMode) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const analysis = analyzeLeadDrawer(lead as unknown as Record<string, unknown>);
        if (cancelled || !analysis) return;
        const result = await alertDrawerAnalysis(analysis);
        if (cancelled || result.action !== 'fill') return;
        if (result.focus === 'overdue' || result.focus === 'both') {
          setActiveTab('followup');
        } else {
          setActiveTab('overview');
          setOverviewEditMode(true);
        }
      })();
    }, 700);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [drawerIsOpen, lead?.id, addLeadMode, isHqOverrideMode, isPublicIntakeMode]);
const [leadPanelPortalReady, setLeadPanelPortalReady] = useState(false);
useEffect(() => {
    setLeadPanelPortalReady(true);
  }, []);
const [overviewEditForm, setOverviewEditForm] = useState({
    ...emptyAgreementTerms(),
    companyName: '',
    industry: '',
    companySize: '',
    website: '',
    linkedIn: '',
    location: '',
    directorSalutation: '',
    contactPerson: '',
    directors: normalizeDirectorList(),
    designation: '',
    email: '',
    phone: '',
    emails: [''] as string[],
    phones: [''] as string[],
    emailNotAvailable: false,
    phoneNotAvailable: false,
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
    sourceOther: '',
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
    followUpNotes: '',
    followUpContact: '',
    followUpMeetLink: '',
    followUpReminder: 'No reminder',
    followUpTimezone: 'Asia/Kolkata',
    followUpAttendeeIds: [] as string[],
    agreementsFileName: '' as string,
    agreementsFileUrl: '' as string,
    agreementsUploadedAt: '' as string,
    teamMemberDesignation: '',
    teamMemberEmail: '',
    teamMemberPhone: '',
    teamMembers: normalizeTeamMemberList(),
    occasions: emptyLeadOccasionForm(),
  });
const [overviewStatusIsCustom, setOverviewStatusIsCustom] = useState(false);
const [activityFilter, setActivityFilter] = useState<'all' | 'calls' | 'messages' | 'emails'>('all');
const [activities, setActivities] = useState<LeadActivity[]>([]);
const [loadingActivities, setLoadingActivities] = useState(false);
const [activityRefreshKey, setActivityRefreshKey] = useState(0);
const [savingCallLog, setSavingCallLog] = useState(false);
const [savingWhatsAppLog, setSavingWhatsAppLog] = useState(false);
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
    setAddLeadForm((prev: any) => {
      const links = (prev.website ?? '').split('\n');
      while (links.length <= index) links.push('');
      links[index] = value;
      return { ...prev, website: links.join('\n') };
    });
  };
const addCompanyLinkField = () => {
    setAddLeadForm((prev: any) => ({
      ...prev,
      website: prev.website ? `${prev.website}\n` : '\n',
    }));
  };
const removeCompanyLinkField = (index: number) => {
    setAddLeadForm((prev: any) => {
      const links = (prev.website ?? '').split('\n');
      const nextLinks = links.filter((_: any, currentIndex: any) => currentIndex !== index);
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
const FOLLOW_UP_TYPES = ['Call', 'WhatsApp', 'Email', 'Online Meeting', 'Personal Meeting', 'Other'];
const REMINDER_OPTIONS = ['10 minutes before', '30 minutes before', '1 hour before', '1 day before'];
const INDUSTRIES = ['Technology', 'Healthcare', 'Finance', 'Manufacturing', 'Retail', 'Other'];
const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '500+'];
const ACCOUNT_MANAGERS = ['Alex Thompson', 'Sarah Chen', 'Michael Ross'];
const LOST_REASONS = ['Not Interested', 'Budget Issue', 'Competitor Selected', 'Wrong Contact', 'No Response', 'Other'];
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
const closeLeadDrawerDropdowns = useCallback(() => {
    setOutcomeDropdownOpen(false);
    setTemplateDropdownOpen(false);
    setFollowUpTypeDropdownOpen(false);
    setReminderDropdownOpen(false);
    setIndustryDropdownOpen(false);
    setCompanySizeDropdownOpen(false);
    setAccountManagerDropdownOpen(false);
    setLostReasonDropdownOpen(false);
  }, []);
const handleLeadDrawerClose = useCallback(() => {
    closeLeadDrawerDropdowns();
    void requestLeadDrawerClose();
  }, [closeLeadDrawerDropdowns, requestLeadDrawerClose]);
const { release: releaseLeadBodyScrollLock } = useDrawerBodyScrollLock(drawerIsOpen);
useEffect(() => {
    if (!drawerIsOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !leadAiChatOpen) {
        handleLeadDrawerClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [drawerIsOpen, leadAiChatOpen, handleLeadDrawerClose]);
const [showDuplicateNotification, setShowDuplicateNotification] = useState(false);
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
useEffect(() => {
    if (!lead?.id || activeTab !== 'activities') {
      setLoadingActivities(false);
      return;
    }

    if (typeof window === 'undefined') {
      setLoadingActivities(false);
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) {
      console.warn('[LeadDetailsDrawer] No access token found. Skipping activities fetch.');
      setActivities([]);
      setLoadingActivities(false);
      return;
    }

    if (isHqOverrideMode || isPublicIntakeMode) {
      setActivities([]);
      setLoadingActivities(false);
      return;
    }

    const load = startAsyncLoad(setLoadingActivities);
    const fetchActivities = async () => {
      try {
        const response = await apiGetLeadActivities(lead.id);
        if (!load.isActive()) return;
        const backendActivities = Array.isArray(response.data) ? response.data : [];
        
        // Map backend activities to frontend format
        const mappedActivities: LeadActivity[] = backendActivities.map((activity: BackendActivity) => {
          // Determine activity type based on action / follow-up channel
          let type: 'Call' | 'Email' | 'Meeting' | 'Message' = 'Message';
          const actionLower = activity.action.toLowerCase();
          const descLower = (activity.description || '').toLowerCase();
          const metaType = String(
            (activity.metadata as { type?: string; followUpType?: string } | null)?.type ||
              (activity.metadata as { type?: string; followUpType?: string } | null)?.followUpType ||
              '',
          ).trim();
          const scheduledTypeMatch =
            String(activity.description || '').match(
              /Follow-up\s+(?:scheduled|postponed):\s*([^.\n]+)/i,
            ) || null;
          const followUpTypeLabel = (scheduledTypeMatch?.[1] || metaType || '').trim();
          const followUpTypeLower = followUpTypeLabel.toLowerCase();

          if (
            followUpTypeLower.includes('whatsapp') ||
            actionLower.includes('whatsapp') ||
            descLower.includes('whatsapp')
          ) {
            type = 'Message';
          } else if (
            followUpTypeLower === 'call' ||
            actionLower.includes('call') ||
            (descLower.includes('call') && !descLower.includes('meeting'))
          ) {
            type = 'Call';
          } else if (
            followUpTypeLower === 'email' ||
            actionLower.includes('email') ||
            descLower.includes('email')
          ) {
            type = 'Email';
          } else if (
            followUpTypeLower.includes('meeting') ||
            followUpTypeLower === 'meet' ||
            actionLower.includes('meeting') ||
            descLower.includes('meeting') ||
            actionLower.includes('follow-up') ||
            descLower.includes('follow-up') ||
            descLower.includes('follow up')
          ) {
            type = 'Meeting';
          }

          // Format date (DD/MM/YYYY + time for activity log)
          const formattedDate = formatDateTimeDMY(activity.createdAt);

          // Extract follow-up details from description if it's a follow-up activity
          let description = activity.description || activity.action;
          let title = activity.action;
          
          // If this is a follow-up activity, enhance the display with the stored channel type
          if (
            description.toLowerCase().includes('follow-up') ||
            description.toLowerCase().includes('follow up')
          ) {
            title = followUpTypeLabel
              ? `Follow-up · ${followUpTypeLabel}`
              : 'Follow-up Scheduled';
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
        if (load.isActive()) setActivities([]);
      } finally {
        load.finish();
      }
    };

    void fetchActivities();
    return () => {
      load.abort();
    };
  }, [lead?.id, activeTab, isHqOverrideMode, isPublicIntakeMode, activityRefreshKey]);
const resetLogCallForm = () => {
    setLogCallForm({
      callType: 'Outgoing',
      durationMinutes: 0,
      durationSeconds: 0,
      outcome: '',
      notes: '',
      nextFollowUp: '',
      followUpType: 'Call',
    });
  };
const handleSaveCallLog = async () => {
    if (!lead?.id || updateLeadOverride) return;

    const durationParts: string[] = [];
    if (logCallForm.durationMinutes) durationParts.push(`${logCallForm.durationMinutes}m`);
    if (logCallForm.durationSeconds) durationParts.push(`${logCallForm.durationSeconds}s`);
    const durationLabel = durationParts.length ? durationParts.join(' ') : null;
    const statusRemark = [
      `${logCallForm.callType} call logged`,
      durationLabel ? `Duration: ${durationLabel}` : null,
      logCallForm.outcome ? `Outcome: ${logCallForm.outcome}` : null,
      logCallForm.notes?.trim() || null,
    ]
      .filter(Boolean)
      .join('. ');

    if (!statusRemark) {
      void requestError('Add notes or an outcome before saving the call log.');
      return;
    }

    try {
      setSavingCallLog(true);
      const updateData: Record<string, unknown> = {
        statusRemark,
        lastFollowUp: new Date().toISOString(),
      };
      if (logCallForm.nextFollowUp) {
        updateData.nextFollowUp = logCallForm.nextFollowUp;
        updateData.followUpSchedule = {
          type: logCallForm.followUpType || 'Call',
          notes: logCallForm.notes?.trim() || null,
        };
      }
      const response = await apiUpdateLead(lead.id, updateData as Partial<CreateLeadData>);
      const savedLead = (response as { data?: BackendLead })?.data;
      resetLogCallForm();
      setShowLogCallForm(false);
      setActiveTab('overview');
      setActivityRefreshKey((key: any) => key + 1);
      onUpdateLead?.(savedLead);
      toast.success('Call logged');
    } catch (error: any) {
      void requestError(error?.message || 'Failed to save call log');
    } finally {
      setSavingCallLog(false);
    }
  };
const handleSaveWhatsAppLog = async () => {
    if (!lead?.id || updateLeadOverride) return;
    const message = whatsAppForm.message?.trim();
    if (!message) {
      void requestError('Enter a message before saving.');
      return;
    }

    const statusRemark = [
      'WhatsApp message logged',
      whatsAppForm.template ? `Template: ${whatsAppForm.template}` : null,
      `Message: ${message}`,
    ]
      .filter(Boolean)
      .join('. ');

    try {
      setSavingWhatsAppLog(true);
      const response = await apiUpdateLead(lead.id, {
        statusRemark,
        lastFollowUp: new Date().toISOString(),
      });
      const savedLead = (response as { data?: BackendLead })?.data;
      setWhatsAppForm({ template: '', message: '' });
      setShowSendWhatsAppForm(false);
      setActiveTab('overview');
      setActivityRefreshKey((key: any) => key + 1);
      onUpdateLead?.(savedLead);
      toast.success('WhatsApp activity saved');
    } catch (error: any) {
      void requestError(error?.message || 'Failed to save WhatsApp activity');
    } finally {
      setSavingWhatsAppLog(false);
    }
  };
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
    setOverviewOpen((prev: any) => ({ ...prev, [key]: !prev[key] }));
  };
const toggleAddLeadSection = (key: 'company' | 'contact' | 'leadDetails') => {
    setAddLeadSectionsOpen((prev: any) => {
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
      directors: resolveDirectorList(lead),
      designation: lead.designation ?? '',
      email: lead.email,
      phone: lead.phone,
      emails: contactListForForm(lead.emails, lead.email),
      phones: contactListForForm(lead.phones, lead.phone),
      emailNotAvailable: !primaryContactValue(contactListForForm(lead.emails, lead.email)),
      phoneNotAvailable: !primaryContactValue(contactListForForm(lead.phones, lead.phone)),
      country: lead.country ?? '',
      countryCode: getCountryByCodeOrName(undefined, lead.country ?? '')?.isoCode ?? '',
      city: lead.city ?? '',
      state:
        lead.state?.trim() ||
        inferLocationFromCityName(lead.city ?? '', { country: lead.country ?? '' })?.state ||
        '',
      latitude: typeof lead.latitude === 'number' ? lead.latitude : null,
      longitude: typeof lead.longitude === 'number' ? lead.longitude : null,
      source: lead.source || '',
      campaignName: lead.campaignName ?? '',
      campaignLink: lead.campaignLink ?? '',
      referralName: lead.referralName ?? '',
      sourceWebsiteUrl: lead.sourceWebsiteUrl ?? '',
      sourceLinkedInUrl: lead.sourceLinkedInUrl ?? '',
      sourceEmail: lead.sourceEmail ?? '',
      sourceOther: lead.sourceOther ?? '',
      ...(() => {
        const teamMembers = resolveTeamMemberList(lead);
        const occasions = readLeadOccasionFromOtherDetails(lead.otherDetails);
        const dynamicOtherDetails = Array.isArray(lead.otherDetails)
          ? lead.otherDetails
              .filter(
                (item: any) =>
                  !isTeamMemberDetailLabel(item.label) &&
                  !isDirectorDetailLabel(item.label) &&
                  !isLeadOccasionDetailLabel(item.label) &&
                  !isInternalLeadOtherDetailLabel(item.label),
              )
              .map((item: any) => ({
                label: String(item.label || '').trim(),
                value: String(item.value || ''),
              }))
          : [];
        const syncedTeam = syncLeadTeamMembers(teamMembers);
        return {
          dynamicOtherDetails,
          ...syncedTeam,
          teamMemberDesignation: syncedTeam.teamMemberDesignation ?? '',
          teamMemberEmail: syncedTeam.teamMemberEmail ?? '',
          teamMemberPhone: syncedTeam.teamMemberPhone ?? '',
          occasions,
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
      notes: businessValueInputValue(
        (() => {
          const bv = String(lead.expectedBusinessValue || '').trim();
          if (
            bv &&
            !/booked demo:|employer demo request:|entrepreneur demo request:/i.test(bv)
          ) {
            return bv;
          }
          const note = String(lead.notes || '').trim();
          if (
            note &&
            !/booked demo:|employer demo request:|entrepreneur demo request:/i.test(note)
          ) {
            return note;
          }
          return '';
        })(),
      ),
      createdDate: lead.createdDate ?? '',
      lastFollowUp: lead.lastFollowUp ?? '',
      nextFollowUp: lead.nextFollowUp ?? '',
      followUpType: 'Call',
      followUpNotes: '',
      followUpContact: '',
      followUpMeetLink: '',
      followUpReminder: 'No reminder',
      followUpTimezone: 'Asia/Kolkata',
      followUpAttendeeIds: [],
      agreementsFileName: lead.agreementsFileName ?? '',
      agreementsFileUrl: lead.agreementsFileUrl ?? '',
      agreementsUploadedAt: lead.agreementsUploadedAt ?? '',
      ...agreementTermsFromRecord(lead),
    });
    setPendingOverviewAgreementsFile(null);
    setPendingOverviewKycFiles([]);
    setPendingOverviewTeamMemberKycFiles([]);
    if (overviewAgreementsInputRef.current) overviewAgreementsInputRef.current.value = '';
    setLeadStatusCatalog((current: any) => mergeLeadStatusOptions(current, lead.status, { hqMode: isHqOverrideMode }));
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
const addLeadHqStatusMode = hqMode || isHqOverrideMode;
const addLeadStatusOptions = React.useMemo(
    () =>
      mergeLeadStatusOptions(leadStatusCatalog, addLeadForm.status, {
        hqMode: addLeadHqStatusMode,
        includeHqOnlyStatuses: addLeadHqStatusMode,
      }),
    [leadStatusCatalog, addLeadForm.status, addLeadHqStatusMode],
  );
const overviewLeadStatusOptions = React.useMemo(
    () => mergeLeadStatusOptions(leadStatusCatalog, overviewEditForm.status, { hqMode: isHqOverrideMode }),
    [leadStatusCatalog, overviewEditForm.status, isHqOverrideMode],
  );
const resolveHqTrialGrantPayload = useCallback(() => {
    const emails = uniqueLeadEmails(hqTrialValues.emails, hqTrialValues.extraEmail);
    const selectedEmail = (hqTrialValues.selectedEmail || emails[0] || hqTrialValues.extraEmail).trim();
    if (!selectedEmail) return null;
    return {
      email: selectedEmail,
      trialDays: hqTrialValues.trialDays,
      note: hqTrialValues.note.trim() || undefined,
      notifyEmails: hqTrialValues.notifyOthers
        ? emails.filter((email: any) => email.toLowerCase() !== selectedEmail.toLowerCase())
        : undefined,
      emails,
    };
  }, [hqTrialValues]);
const handleHqStatusSelect = useCallback(
    (status: string, apply: (next: string) => void) => {
      if (!addLeadHqStatusMode) {
        apply(status);
        return;
      }
      if (String(status).toLowerCase() === 'trial') {
        const emails = addLeadMode
          ? uniqueLeadEmails(addLeadForm.emails, addLeadForm.email)
          : uniqueLeadEmails(overviewEditForm.emails, overviewEditForm.email, lead?.emails, lead?.email);
        setHqTrialValues(emptyHqGrantLeadTrialValues(emails));
        setHqTrialModalOpen(true);
        return;
      }
      if (String(status).toLowerCase() !== 'trial') {
        setPendingHqTrialGrant(null);
      }
      apply(status);
    },
    [
      addLeadForm.email,
      addLeadForm.emails,
      addLeadHqStatusMode,
      addLeadMode,
      lead?.email,
      lead?.emails,
      overviewEditForm.email,
      overviewEditForm.emails,
    ],
  );
const handleConfirmHqTrialGrant = useCallback(async () => {
    const payload = resolveHqTrialGrantPayload();
    if (!payload) {
      toast.error('Select or add an email for the trial account');
      return;
    }
    const { emails, ...grantBody } = payload;

    if (addLeadMode) {
      setPendingHqTrialGrant(grantBody);
      setAddLeadForm((prev: any) => ({
        ...prev,
        status: 'Trial' as LeadStatus,
        emails: uniqueLeadEmails(prev.emails, emails, grantBody.email),
        email: grantBody.email,
        emailNotAvailable: false,
      }));
      setHqTrialModalOpen(false);
      toast.success('Trial details saved. Create the lead to email the account.');
      return;
    }

    if (!lead?.id) {
      toast.error('Save this lead before granting a trial account');
      return;
    }

    setHqTrialSubmitting(true);
    try {
      const result = await apiHqGrantLeadTrial(lead.id, grantBody);
      const data = result.data;
      setOverviewEditForm((prev: any) => ({ ...prev, status: 'Trial' as LeadStatus }));
      setHqTrialModalOpen(false);
      if (data?.credentialEmailSent === false && data?.credentialEmailError) {
        toast.warning(data.message || 'Access granted, but credential email failed.');
      } else if (data?.alreadyProvisioned) {
        toast.success(data.message || 'Trial dates refreshed for existing tenant.');
      } else {
        toast.success(
          data?.credentialEmailSent
            ? `Trial account granted (${grantBody.trialDays} days). Credentials emailed to ${grantBody.email}.`
            : `Trial account granted (${grantBody.trialDays} days).`,
        );
      }
      onUpdateLead?.();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to grant trial account');
    } finally {
      setHqTrialSubmitting(false);
    }
  }, [addLeadMode, lead?.id, onUpdateLead, resolveHqTrialGrantPayload]);
const addLeadStatusOption = async (onSelect: (status: string) => void) => {
    const status = String(newLeadStatusValue || '').trim();
    if (!status) {
      toast.error('Enter a status name first.');
      return;
    }

    setSavingLeadStatus(true);
    try {
      if (isHqOverrideMode) {
        const nextOptions = mergeLeadStatusOptions(leadStatusCatalog, status, { hqMode: true });
        setLeadStatusCatalog(nextOptions);
        onSelect(status);
        setNewLeadStatusValue('');
        setShowAddLeadStatusInput(false);
        setAddLeadStatusIsCustom(false);
        setOverviewStatusIsCustom(false);
        toast.success(`Status "${status}" added.`);
        return;
      }
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
    if (isProtectedLeadStatus(normalized, addLeadHqStatusMode)) {
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
      if (isHqOverrideMode) {
        const fallback = 'New';
        const nextOptions = mergeLeadStatusOptions(
          leadStatusCatalog.filter((s: any) => s.toLowerCase() !== normalized.toLowerCase()),
          fallback,
          { hqMode: true },
        );
        setLeadStatusCatalog(nextOptions);
        onSelect(fallback);
        toast.success(`Status "${normalized}" deleted.`);
        return;
      }
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
        location: overviewEditForm.location?.trim() || undefined,
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
        sourceOther: overviewEditForm.source === 'Other' ? overviewEditForm.sourceOther?.trim() || undefined : undefined,
        ...teamMemberPayloadFromForm(
          primaryTeamMemberFromList(overviewEditForm.teamMembers),
        ),
        otherDetails: withPreservedInternalOtherDetails(
          mergeOccasionIntoOtherDetails(
            mergeDirectorsIntoOtherDetails(
              mergeTeamMemberIntoOtherDetails(
                overviewEditForm.dynamicOtherDetails
                  .map((item: any) => ({
                    label: String(item.label || '').trim(),
                    value: String(item.value || '').trim(),
                  }))
                  .filter((item: any) => item.label && item.value),
                overviewEditForm.teamMembers,
              ),
              overviewEditForm.directors || resolveDirectorList(overviewEditForm),
            ),
            overviewEditForm.occasions || emptyLeadOccasionForm(),
          ),
          lead?.otherDetails,
        ),
        status: String(overviewEditForm.status || 'New').trim() || 'New',
        priority: overviewEditForm.priority,
        assignedToId: overviewEditForm.assignedToIds?.[0] || overviewEditForm.assignedToId || undefined,
        assignedToIds: overviewEditForm.assignedToIds && overviewEditForm.assignedToIds.length > 0
          ? overviewEditForm.assignedToIds
          : undefined,
        assignedToName: overviewEditForm.leadOwner || undefined,
        ...(isHqOverrideMode ? { leadOwner: overviewEditForm.leadOwner || undefined } : {}),
        interestedNeeds: overviewEditForm.interestedNeeds || undefined,
        expectedBusinessValue: normalizeBusinessValueForSave(overviewEditForm.notes) || undefined,
        notes: normalizeBusinessValueForSave(overviewEditForm.notes) || undefined,
        lastFollowUp: overviewEditForm.lastFollowUp || undefined,
        nextFollowUp: nextFollowUpValue || '',
        ...(followUpChanged
          ? {
              statusRemark: buildFollowUpStatusRemark({
                nextFollowUp: nextFollowUpValue,
                followUpType: overviewEditForm.followUpType || 'General',
                followUpContact: overviewEditForm.followUpContact,
                followUpMeetLink: overviewEditForm.followUpMeetLink,
                followUpReminder: overviewEditForm.followUpReminder,
                followUpTimezone: overviewEditForm.followUpTimezone,
                followUpAttendeeIds: overviewEditForm.followUpAttendeeIds,
                followUpNotes: overviewEditForm.followUpNotes,
              }),
              followUpSchedule: {
                type: overviewEditForm.followUpType || 'General',
                contact: overviewEditForm.followUpContact,
                meetLink: overviewEditForm.followUpMeetLink,
                reminder: overviewEditForm.followUpReminder,
                timezone: overviewEditForm.followUpTimezone,
                attendeeIds: overviewEditForm.followUpAttendeeIds,
                notes: overviewEditForm.followUpNotes,
              },
            }
          : {}),
        ...agreementTermsApiPayload({ ...emptyAgreementTerms(), ...overviewEditForm }),
        agreementsFileName: overviewEditForm.agreementsFileName || undefined,
        agreementsFileUrl: overviewEditForm.agreementsFileUrl || undefined,
        agreementsUploadedAt: overviewEditForm.agreementsUploadedAt || undefined,
      };

      const pendingOverviewLeadKyc = [...pendingOverviewKycFiles];
      if (pendingOverviewLeadKyc.length > 0 && !isHqOverrideMode) {
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

      if (pendingOverviewAgreementsFile && !updateLeadOverride) {
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

      const updatedLeadResponse = updateLeadOverride
        ? { data: await updateLeadOverride(lead.id, updateData) }
        : await apiUpdateLead(lead.id, updateData);
      const savedLead =
        (updatedLeadResponse as { data?: BackendLead })?.data ||
        (updatedLeadResponse as unknown as BackendLead);
      setPendingOverviewAgreementsFile(null);
      setPendingOverviewKycFiles([]);
      setPendingOverviewTeamMemberKycFiles([]);
      setOverviewEditMode(false);
      setOverviewEditErrors({});
      toast.success('Lead saved successfully');
      onUpdateLead?.(savedLead || undefined);
    } catch (error: any) {
      console.error('Failed to update lead:', error);
      void requestError(error.message || 'Failed to update lead');
    } finally {
      setSavingOverviewEdit(false);
    }
  };
const isCreateLeadDisabled = useMemo(() => {
    const required = validateLeadRequiredFields(addLeadForm);
    return (
      Object.keys(required).length > 0 ||
      !String(addLeadForm.country || '').trim() ||
      !String(addLeadForm.state || '').trim()
    );
  }, [addLeadForm]);
const addLeadWizardStepErrors = useMemo(
    () => validateAddLeadWizardStep(addLeadWizardStep, addLeadForm),
    [addLeadWizardStep, addLeadForm],
  );
const isAddLeadWizardContinueDisabled =
    (addLeadWizardStep === 'workspace' && hqProductLine.length === 0) ||
    Object.keys(addLeadWizardStepErrors).length > 0;
const goAddLeadWizardNext = useCallback(() => {
    if (addLeadWizardStep === 'workspace' && hqProductLine.length === 0) {
      void requestWarning('Select at least one product line: CRM or Recruitment.');
      return;
    }
    const stepErrors = validateAddLeadWizardStep(addLeadWizardStep, addLeadForm);
    if (Object.keys(stepErrors).length > 0) {
      setAddLeadErrors(stepErrors);
      return;
    }
    setAddLeadErrors({});
    const idx = addLeadWizardSteps.indexOf(addLeadWizardStep);
    if (idx >= 0 && idx < addLeadWizardSteps.length - 1) {
      setAddLeadWizardStep(addLeadWizardSteps[idx + 1]!);
    }
  }, [addLeadForm, addLeadWizardStep, addLeadWizardSteps, hqProductLine]);
const goAddLeadWizardBack = useCallback(() => {
    const idx = addLeadWizardSteps.indexOf(addLeadWizardStep);
    if (idx > 0) {
      setAddLeadWizardStep(addLeadWizardSteps[idx - 1]!);
      return;
    }
    if (addLeadAiFlowStage === 'form') {
      setAddLeadAiFlowStage('chat');
      setLeadAiChatOpen(true);
    }
  }, [addLeadAiFlowStage, addLeadWizardStep, addLeadWizardSteps]);
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
    if (
      addLeadForm.followUpPostponed &&
      !String(addLeadForm.followUpPostponeReason || '').trim()
    ) {
      toast.error('Please enter a reason for postponing the follow-up.');
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
        .map((item: any) => item.trim())
        .filter(Boolean);

      const createData: CreateLeadData = {
        companyName: addLeadForm.companyName.trim(),
        sector: addLeadForm.industry?.trim() || undefined,
        industry: addLeadForm.industry?.trim() || undefined,
        website: addLeadForm.website?.trim() || undefined,
        companyLinks: companyLinks.length ? companyLinks : undefined,
        linkedIn: addLeadForm.linkedIn?.trim() || undefined,
        location:
          addLeadForm.location?.trim() ||
          [addLeadForm.city, addLeadForm.state, addLeadForm.country]
            .map((part: any) => String(part || '').trim())
            .filter(Boolean)
            .join(', ') ||
          undefined,
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
        sourceOther: addLeadForm.source === 'Other' ? addLeadForm.sourceOther?.trim() || undefined : undefined,
        ...teamMemberPayloadFromForm(
          primaryTeamMemberFromList(addLeadForm.teamMembers),
        ),
        otherDetails: mergeOccasionIntoOtherDetails(
          mergeDirectorsIntoOtherDetails(
            mergeTeamMemberIntoOtherDetails(
              addLeadForm.otherDetails,
              addLeadForm.teamMembers,
            ),
            addLeadForm.directors || resolveDirectorList(addLeadForm),
          ),
          addLeadForm.occasions || emptyLeadOccasionForm(),
        ),
        status: addLeadForm.status || 'New',
        priority: addLeadForm.priority || 'Medium',
        servicesNeeded: addLeadForm.interestedNeeds?.trim() || undefined,
        interestedNeeds: addLeadForm.interestedNeeds?.trim() || undefined,
        expectedBusinessValue: normalizeBusinessValueForSave(addLeadForm.notes) || undefined,
        notes: normalizeBusinessValueForSave(addLeadForm.notes) || undefined,
        lastFollowUp: addLeadForm.lastFollowUp || undefined,
        nextFollowUp: addLeadForm.nextFollowUp || undefined,
        statusRemark: addLeadForm.nextFollowUp
          ? buildFollowUpStatusRemark({
              nextFollowUp: addLeadForm.nextFollowUp,
              followUpType: addLeadForm.followUpType || 'General',
              followUpContact: addLeadForm.followUpContact,
              followUpMeetLink: addLeadForm.followUpMeetLink,
              followUpReminder: addLeadForm.followUpReminder,
              followUpTimezone: addLeadForm.followUpTimezone,
              followUpAttendeeIds: addLeadForm.followUpAttendeeIds,
              followUpNotes: addLeadForm.followUpNotes,
              followUpPostponed: addLeadForm.followUpPostponed,
              followUpPostponeReason: addLeadForm.followUpPostponeReason,
            })
          : undefined,
        followUpSchedule: addLeadForm.nextFollowUp
          ? {
              type: addLeadForm.followUpType || 'General',
              contact: addLeadForm.followUpContact,
              meetLink: addLeadForm.followUpMeetLink,
              reminder: addLeadForm.followUpReminder,
              timezone: addLeadForm.followUpTimezone,
              attendeeIds: addLeadForm.followUpAttendeeIds,
              notes: [
                addLeadForm.followUpPostponed ? 'Postponed' : null,
                addLeadForm.followUpPostponeReason?.trim()
                  ? `Postpone reason: ${addLeadForm.followUpPostponeReason.trim()}`
                  : null,
                addLeadForm.followUpNotes?.trim() || null,
              ]
                .filter(Boolean)
                .join('. ') || addLeadForm.followUpNotes,
              postponed: Boolean(addLeadForm.followUpPostponed),
              postponeReason: addLeadForm.followUpPostponeReason || undefined,
            }
          : undefined,
        assignedToId: addLeadForm.assignedToId || undefined,
        assignedToIds:
          addLeadForm.assignedToIds && addLeadForm.assignedToIds.length > 0
            ? addLeadForm.assignedToIds
            : addLeadForm.assignedToId
              ? [addLeadForm.assignedToId]
              : undefined,
        assignedToName: addLeadForm.assignedToName || undefined,
        ...agreementTermsApiPayload(addLeadForm),
        ...(options?.skipDuplicateCheck || allowDuplicateCreate ? { forceNew: true } : {}),
        ...(isHqOverrideMode
          ? {
              hqProductLine: hqProductLine.join(','),
              hqProductLines: hqProductLine,
              leadOwner: addLeadForm.assignedToName || undefined,
              interestedModules: [
                ...hqProductLineLabels(hqProductLine),
                ...(addLeadForm.interestedNeeds
                  ? String(addLeadForm.interestedNeeds)
                      .split(/[,|\n]/)
                      .map((s: any) => s.trim())
                      .filter(Boolean)
                  : []),
              ].filter((v: any, i: any, arr: any) => arr.indexOf(v) === i),
              formSchema: 'phase2',
            }
          : {}),
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

      if ((hqMode || isHqOverrideMode) && pendingHqTrialGrant && createdLead?.id) {
        try {
          const grantResult = await apiHqGrantLeadTrial(createdLead.id, pendingHqTrialGrant);
          const data = grantResult.data;
          if (data?.credentialEmailSent === false && data?.credentialEmailError) {
            toast.warning(data.message || 'Lead created. Trial access granted, but credential email failed.');
          } else {
            toast.success(
              data?.credentialEmailSent
                ? `Lead created and trial account emailed to ${pendingHqTrialGrant.email}.`
                : 'Lead created and trial account granted.',
            );
          }
        } catch (grantError: any) {
          toast.error(grantError?.message || 'Lead created, but the trial account could not be granted.');
        }
      }

      setPendingAddLeadAgreementsFile(null);
      setPendingAddLeadKycFiles([]);
      setPendingAddLeadTeamMemberKycFiles([]);
      if (addLeadAgreementsInputRef.current) addLeadAgreementsInputRef.current.value = '';

      onAddLead?.(addLeadForm, createdLead || undefined);
      markLeadDrawerClean();
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
    hqProductLine,
    isHqOverrideMode,
    hqMode,
    onAddLead,
    pendingAddLeadAgreementsFile,
    pendingAddLeadKycFiles,
    pendingHqTrialGrant,
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
const drawerTree = (
    <>
    <AnimatePresence onExitComplete={releaseLeadBodyScrollLock}>
      {drawerIsOpen ? (
          <DetailsModalShell
            key={addLeadMode ? 'add-lead-drawer' : `lead-drawer-${lead?.id || 'detail'}`}
            variant="main"
            dialogTitleId={addLeadMode ? 'add-lead-modal-title' : 'lead-detail-modal-title'}
            panelRef={leadDrawerPanelRef}
            onBackdropClick={() => void handleLeadDrawerClose()}
          >
          <div className="relative flex h-full min-h-0 flex-col">
          {/* Header */}
          <div
            className={`relative z-30 flex shrink-0 items-start justify-between gap-3 px-6 py-5 ${
              addLeadMode && addLeadAiFlowStage
                ? 'border-b border-indigo-100/70 bg-gradient-to-r from-indigo-50/95 via-violet-50/50 to-white'
                : addLeadMode
                  ? 'border-b border-blue-100/70 bg-gradient-to-r from-blue-50/95 via-indigo-50/50 to-white'
                  : 'border-b border-indigo-100/70 bg-gradient-to-r from-indigo-50/90 via-white to-sky-50/50 sm:px-8'
            }`}
          >
            <div className="flex-1 min-w-0 flex items-center gap-3">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg ${
                  addLeadMode && addLeadAiFlowStage
                    ? 'bg-gradient-to-br from-indigo-500 to-violet-600 shadow-indigo-500/30'
                    : addLeadMode
                      ? 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/25'
                      : 'bg-gradient-to-br from-indigo-500 via-blue-600 to-sky-500 shadow-indigo-500/25'
                }`}
              >
                {addLeadMode && addLeadAiFlowStage ? <Sparkles size={20} /> : <Building2 size={20} />}
              </div>
              <div className="min-w-0">
                {addLeadMode ? (
                  <>
                    <h2 id="add-lead-modal-title" className="text-lg font-bold tracking-tight text-slate-900">
                      Add Lead
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {addLeadAiFlowStage === 'chat'
                        ? 'Step 1 — chat with AI to capture lead details'
                        : addLeadAiFlowStage === 'form'
                          ? 'Step 2 — review and edit the AI-filled form'
                          : 'Create a new lead and capture company details'}
                    </p>
                  </>
                ) : (
                  <>
                    <h2 id="lead-detail-modal-title" className="text-xl font-bold text-slate-900 truncate">
                      {lead!.companyName}
                    </h2>
                    <p className="mt-0.5 text-sm text-slate-500 truncate">
                      {formatDirectorDisplay(lead!.directorSalutation, lead!.contactPerson) ||
                        lead!.contactPerson ||
                        'No contact assigned'}
                      {lead!.city || lead!.location
                        ? ` · ${[lead!.city, lead!.state].filter(Boolean).join(', ') || lead!.location}`
                        : ''}
                    </p>
                    <span
                      className={`mt-2 inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${leadStatusChipClass(
                        lead!.status,
                      )}`}
                    >
                      {lead!.status}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!addLeadMode &&
              activeTab === 'overview' &&
              !overviewEditMode &&
              !isLeadAlreadyConverted(lead) ? (
                <button
                  type="button"
                  onClick={startOverviewEdit}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                  title="Edit Lead"
                >
                  <Edit2 size={14} />
                  Edit
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
              {!addLeadMode && onDeleteLead && lead?.id && !isLeadAlreadyConverted(lead) ? (
                <button
                  type="button"
                  onClick={() => onDeleteLead(lead.id)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50"
                  title="Delete Lead"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              ) : null}
              {addLeadMode ? (
                <>
                  {!isPublicIntakeMode && addLeadAiFlowStage !== 'chat' ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (leadAiGate.locked) {
                          void leadAiGate.confirmAndUnlock();
                          return;
                        }
                        setLeadAiChatOpen(true);
                        setAddLeadAiFlowStage('chat');
                      }}
                      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors ${
                        leadAiGate.locked
                          ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                          : addLeadAiFlowStage === 'form'
                            ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                            : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                      }`}
                      title={
                        leadAiGate.locked
                          ? `Locked — needs ${leadAiGate.cost} coins`
                          : addLeadAiFlowStage === 'form'
                            ? 'Go back to AI chat'
                            : `Create with AI (${leadAiGate.cost} coins per chat message)`
                      }
                    >
                      {leadAiGate.locked ? <Lock size={14} /> : <Sparkles size={14} />}
                      {addLeadAiFlowStage === 'form' ? 'Back to chat' : 'Create with AI'}
                      <AiCoinLockBadge featureId="ai.lead_chat" />
                    </button>
                  ) : null}
                  {addLeadAiFlowStage ? (
                    <button
                      type="button"
                      onClick={() => void handleLeadDrawerClose()}
                      className="rounded-full border border-slate-200/90 bg-white/80 px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:bg-white hover:text-slate-900"
                    >
                      Cancel
                    </button>
                  ) : (
                    <DrawerCloseButton onClick={() => void handleLeadDrawerClose()} />
                  )}
                </>
              ) : (
                <DrawerCloseButton onClick={() => void handleLeadDrawerClose()} />
              )}
            </div>
          </div>

          {addLeadMode && addLeadAiFlowStage ? (
            <AddLeadAiFlowProgress stage={addLeadAiFlowStage} />
          ) : null}

          {addLeadMode && addLeadAiFlowStage !== 'chat' ? (
            <AddLeadWizardProgress steps={addLeadWizardSteps} currentStep={addLeadWizardStep} />
          ) : null}

          {addLeadMode && addLeadAiFlowStage === 'chat' ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <LeadAiChatDrawer
                stageMode
                isOpen
                onClose={() => void handleLeadDrawerClose()}
                form={addLeadForm}
                onApplyGenerated={handleApplyLeadAiGenerated}
                onExpandSections={() =>
                  setAddLeadSectionsOpen({ company: true, contact: true, leadDetails: true })
                }
                chatHistory={leadAiChatHistory}
                onChatHistoryChange={setLeadAiChatHistory}
                onContinue={() => {
                  setAddLeadAiFlowStage('form');
                  setLeadAiChatOpen(false);
                  setAddLeadSectionsOpen({ company: true, contact: true, leadDetails: true });
                  setAddLeadWizardStep(isHqOverrideMode ? 'workspace' : 'company');
                }}
              />
            </div>
          ) : null}

          {addLeadMode && addLeadAiFlowStage === 'form' ? (
            <div className="mx-6 mb-3 shrink-0 flex items-start gap-3 rounded-2xl bg-gradient-to-r from-indigo-50 to-violet-50 px-4 py-3 ring-1 ring-indigo-100">
              <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
                <Sparkles size={14} />
              </span>
              <div>
                <p className="text-sm font-semibold text-indigo-950">AI filled this lead for you</p>
                <p className="mt-0.5 text-xs text-indigo-800/80">
                  Review each step, edit anything that looks off, then create the lead.
                </p>
              </div>
            </div>
          ) : null}

          {/* Tabs — hidden in add mode (header already shows Add Lead) */}
          {!addLeadMode && addLeadAiFlowStage !== 'chat' ? (
            <DrawerTabBar
              ariaLabel="Lead sections"
              tabs={tabs}
              activeId={activeTab}
              onChange={setActiveTab}
            />
          ) : null}

          {/* Tab content */}
          {addLeadAiFlowStage !== 'chat' ? (
          <div className="relative flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 via-[#f8fafc] to-blue-50/30">
            <div className="px-6 py-5">
              {showMergeLeadsForm ? (
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
                        {MERGE_FIELDS.map((field: any) => (
                          <div key={field} className="flex items-center justify-between gap-4">
                            <span className="text-sm font-medium text-slate-700 capitalize">{field === 'leadOwner' ? 'Lead Owner' : field}</span>
                            <div className="flex gap-4">
                              <button
                                type="button"
                                onClick={() => setMergeLeadsForm((p: any) => ({ ...p, keep: { ...p.keep, [field]: 'existing' } }))}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 text-sm transition-colors"
                              >
                                <span
                                  className={`w-4 h-4 flex items-center justify-center rounded border shrink-0 transition-colors ${
                                    mergeLeadsForm.keep[field as keyof typeof mergeLeadsForm.keep] === 'existing'
                                      ? 'border-blue-500 bg-blue-50 text-blue-600'
                                      : 'border-slate-200 bg-white'
                                  }`}
                                >
                                  {mergeLeadsForm.keep[field as keyof typeof mergeLeadsForm.keep] === 'existing' && <Check size={12} strokeWidth={2.5} />}
                                </span>
                                Existing
                              </button>
                              <button
                                type="button"
                                onClick={() => setMergeLeadsForm((p: any) => ({ ...p, keep: { ...p.keep, [field]: 'new' } }))}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 text-sm transition-colors"
                              >
                                <span
                                  className={`w-4 h-4 flex items-center justify-center rounded border shrink-0 transition-colors ${
                                    mergeLeadsForm.keep[field as keyof typeof mergeLeadsForm.keep] === 'new'
                                      ? 'border-blue-500 bg-blue-50 text-blue-600'
                                      : 'border-slate-200 bg-white'
                                  }`}
                                >
                                  {mergeLeadsForm.keep[field as keyof typeof mergeLeadsForm.keep] === 'new' && <Check size={12} strokeWidth={2.5} />}
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
                            onChange={() => setLogCallForm((p: any) => ({ ...p, callType: 'Outgoing' }))}
                            className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                          />
                          <span className="text-sm text-slate-700">Outgoing</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="callType"
                            checked={logCallForm.callType === 'Incoming'}
                            onChange={() => setLogCallForm((p: any) => ({ ...p, callType: 'Incoming' }))}
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
                            onChange={(e: any) => setLogCallForm((p: any) => ({ ...p, durationMinutes: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
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
                            onChange={(e: any) => setLogCallForm((p: any) => ({ ...p, durationSeconds: Math.min(59, Math.max(0, parseInt(e.target.value, 10) || 0)) }))}
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
                          onClick={() => setOutcomeDropdownOpen((v: any) => !v)}
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
                              {CALL_OUTCOMES.map((opt: any) => (
                                <li key={opt}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setLogCallForm((p: any) => ({ ...p, outcome: opt }));
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
                        onChange={(e: any) => setLogCallForm((p: any) => ({ ...p, notes: e.target.value }))}
                        placeholder="Add notes about the call..."
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                      />
                    </div>
                    <div>
                      <FollowUpDateTimeField
                        label="Next Follow-up Date & Time"
                        value={logCallForm.nextFollowUp}
                        onChange={(iso: any) => setLogCallForm((p: any) => ({ ...p, nextFollowUp: iso }))}
                        followUpType={logCallForm.followUpType || 'Call'}
                        onFollowUpTypeChange={(type: any) =>
                          setLogCallForm((p: any) => ({ ...p, followUpType: type }))
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
                      onClick={() => void handleSaveCallLog()}
                      disabled={savingCallLog}
                      className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {savingCallLog ? 'Saving...' : 'Save Call Log'}
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
                          onClick={() => setTemplateDropdownOpen((v: any) => !v)}
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
                              {WHATSAPP_TEMPLATES.map((name: any) => (
                                <li key={name}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setWhatsAppForm((p: any) => ({ ...p, template: name }));
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
                        onChange={(e: any) => setWhatsAppForm((p: any) => ({ ...p, message: e.target.value }))}
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
                      onClick={() => void handleSaveWhatsAppLog()}
                      disabled={savingWhatsAppLog}
                      className="px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 shadow-sm transition-colors flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <WhatsAppIcon size={16} />
                      {savingWhatsAppLog ? 'Saving...' : 'Save activity'}
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
                        onChange={(e: any) => setConvertToClientForm((p: any) => ({ ...p, companyName: e.target.value }))}
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
                        onChange={(e: any) => setConvertToClientForm((p: any) => ({ ...p, primaryContact: e.target.value }))}
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
                        onChange={(e: any) => setConvertToClientForm((p: any) => ({ ...p, email: e.target.value }))}
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
                        onChange={(e: any) => setConvertToClientForm((p: any) => ({ ...p, phone: e.target.value }))}
                        placeholder="Phone number"
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Industry</label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => { setIndustryDropdownOpen((v: any) => !v); setCompanySizeDropdownOpen(false); setAccountManagerDropdownOpen(false); }}
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
                              {INDUSTRIES.map((name: any) => (
                                <li key={name}>
                                  <button
                                    type="button"
                                    onClick={() => { setConvertToClientForm((p: any) => ({ ...p, industry: name })); setIndustryDropdownOpen(false); }}
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
                          onClick={() => { setCompanySizeDropdownOpen((v: any) => !v); setIndustryDropdownOpen(false); setAccountManagerDropdownOpen(false); }}
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
                              {COMPANY_SIZES.map((size: any) => (
                                <li key={size}>
                                  <button
                                    type="button"
                                    onClick={() => { setConvertToClientForm((p: any) => ({ ...p, companySize: size })); setCompanySizeDropdownOpen(false); }}
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
                          onClick={() => { setAccountManagerDropdownOpen((v: any) => !v); setIndustryDropdownOpen(false); setCompanySizeDropdownOpen(false); }}
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
                              {ACCOUNT_MANAGERS.map((name: any) => (
                                <li key={name}>
                                  <button
                                    type="button"
                                    onClick={() => { setConvertToClientForm((p: any) => ({ ...p, accountManager: name })); setAccountManagerDropdownOpen(false); }}
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
                        onChange={(e: any) => setConvertToClientForm((p: any) => ({ ...p, createJobRequirement: e.target.checked }))}
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
                        assignmentModule={leadAssignmentModule}
                        placeholder={hqAssignedToPlaceholder}
                        onChange={(ids: any) => {
                          setAssignLeadForm((p: any) => ({
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
                        {(['High', 'Medium', 'Low'] as const).map((p: any) => (
                          <label key={p} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="assign-priority"
                              checked={assignLeadForm.priority === p}
                              onChange={() => setAssignLeadForm((prev: any) => ({ ...prev, priority: p }))}
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
                        onChange={(e: any) => setAssignLeadForm((p: any) => ({ ...p, notifyUser: e.target.checked }))}
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
                          onClick={() => setLostReasonDropdownOpen((v: any) => !v)}
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
                              {LOST_REASONS.map((reason: any) => (
                                <li key={reason}>
                                  <button
                                    type="button"
                                    onClick={() => { setMarkLostForm((p: any) => ({ ...p, lostReason: reason })); setLostReasonDropdownOpen(false); }}
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
                        onChange={(e: any) => setMarkLostForm((p: any) => ({ ...p, notes: e.target.value }))}
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
              ) : activeTab === 'add' ? <LeadAddTab addCompanyLinkField={addCompanyLinkField} addLeadErrors={addLeadErrors} addLeadForm={addLeadForm} addLeadHqStatusMode={addLeadHqStatusMode} addLeadSectionsOpen={addLeadSectionsOpen} addLeadStatusOption={addLeadStatusOption} addLeadStatusOptions={addLeadStatusOptions} addLeadWizardStep={addLeadWizardStep} addLeadWizardStepErrors={addLeadWizardStepErrors} companyLinks={companyLinks} deleteLeadStatusOption={deleteLeadStatusOption} deletingLeadStatus={deletingLeadStatus} handleHqStatusSelect={handleHqStatusSelect} hqAssignedToPlaceholder={hqAssignedToPlaceholder} hqProductLine={hqProductLine} isHqOverrideMode={isHqOverrideMode} leadAssignmentModule={leadAssignmentModule} loadingRecruiters={loadingRecruiters} newLeadStatusValue={newLeadStatusValue} recruiters={recruiters} removeCompanyLinkField={removeCompanyLinkField} savingLeadStatus={savingLeadStatus} setAddLeadErrors={setAddLeadErrors} setAddLeadForm={setAddLeadForm} setHqProductLine={setHqProductLine} setNewLeadStatusValue={setNewLeadStatusValue} setShowAddLeadStatusInput={setShowAddLeadStatusInput} showAddLeadStatusInput={showAddLeadStatusInput} toggleAddLeadSection={toggleAddLeadSection} updateCompanyLink={updateCompanyLink} /> : activeTab === 'overview' ? <LeadOverviewTab addLeadStatusOption={addLeadStatusOption} agreementsUploadFeedback={agreementsUploadFeedback} applyExtractedLeadAgreementTerms={applyExtractedLeadAgreementTerms} deleteLeadFile={deleteLeadFile} deleteLeadStatusOption={deleteLeadStatusOption} deletingLeadStatus={deletingLeadStatus} handleHqStatusSelect={handleHqStatusSelect} hqAssignedToPlaceholder={hqAssignedToPlaceholder} isHqOverrideMode={isHqOverrideMode} kycUploadFeedback={kycUploadFeedback} lead={lead} leadAssignmentModule={leadAssignmentModule} leadKycFiles={leadKycFiles} loadingRecruiters={loadingRecruiters} newLeadStatusValue={newLeadStatusValue} openAssignLeadForm={openAssignLeadForm} openConvertToClientForm={openConvertToClientForm} openMarkLostForm={openMarkLostForm} overviewEditErrors={overviewEditErrors} overviewEditForm={overviewEditForm} overviewEditMode={overviewEditMode} overviewLeadStatusOptions={overviewLeadStatusOptions} overviewOpen={overviewOpen} pendingOverviewAgreementsFile={pendingOverviewAgreementsFile} pendingOverviewKycFiles={pendingOverviewKycFiles} recruiters={recruiters} refetchLeadFiles={refetchLeadFiles} savingLeadStatus={savingLeadStatus} setActiveTab={setActiveTab} setNewLeadStatusValue={setNewLeadStatusValue} setOverviewEditErrors={setOverviewEditErrors} setOverviewEditForm={setOverviewEditForm} setPendingOverviewAgreementsFile={setPendingOverviewAgreementsFile} setPendingOverviewKycFiles={setPendingOverviewKycFiles} setShowAddLeadStatusInput={setShowAddLeadStatusInput} setShowLogCallForm={setShowLogCallForm} setShowScheduleFollowUpForm={setShowScheduleFollowUpForm} setShowSendWhatsAppForm={setShowSendWhatsAppForm} showAddLeadStatusInput={showAddLeadStatusInput} toggleOverviewSection={toggleOverviewSection} uploadingAgreements={uploadingAgreements} uploadingKyc={uploadingKyc} /> : activeTab === 'followup' && lead?.id ? (
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
                    otherDetails={lead.otherDetails}
                    hqMode={isHqOverrideMode}
                    hqFollowUps={lead.hqFollowUps}
                    onScheduled={() => {
                      onUpdateLead?.();
                    }}
                    onCompleted={() => {
                      onUpdateLead?.();
                    }}
                  />
                )
              ) : activeTab === 'activities' ? <LeadActivitiesTab activities={activities} activityFilter={activityFilter} lead={lead} loadingActivities={loadingActivities} setActiveTab={setActiveTab} setActivityFilter={setActivityFilter} setShowLogCallForm={setShowLogCallForm} /> : activeTab === 'notes' ? <LeadNotesTab isHqOverrideMode={isHqOverrideMode} lead={lead} onUpdateLead={onUpdateLead} /> : activeTab === 'files' ? <LeadFilesTab deleteFile={deleteFile} filesError={filesError} filesLoading={filesLoading} filesUploadPercent={filesUploadPercent} filesUploadSuccess={filesUploadSuccess} filesUploading={filesUploading} isHqOverrideMode={isHqOverrideMode} lead={lead} leadFiles={leadFiles} leadFilesTypeFilter={leadFilesTypeFilter} setLeadFilesTypeFilter={setLeadFilesTypeFilter} uploadFile={uploadFile} /> : activeTab === 'chat' ? <LeadChatTab activeTab={activeTab} lead={lead} /> : null}
            </div>
            </div>
          </div>
          ) : null}

          {addLeadMode && addLeadAiFlowStage !== 'chat' ? (
            <div className="relative z-30 shrink-0 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur-sm">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent" />
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={goAddLeadWizardBack}
                  disabled={!canGoAddLeadWizardBack}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {isAddLeadWizardFirstStep && addLeadAiFlowStage === 'form' ? 'Back to chat' : 'Back'}
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleLeadDrawerClose()}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  {isAddLeadWizardLastStep ? (
                    <button
                      type="button"
                      onClick={() => void handleSubmitAddLead()}
                      disabled={isCreateLeadDisabled || uploadingAgreements || uploadingKyc}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Plus size={14} />
                      Create Lead
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={goAddLeadWizardNext}
                      disabled={isAddLeadWizardContinueDisabled}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Continue
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          </div>
          </DetailsModalShell>
      ) : null}
    </AnimatePresence>

        {/* Duplicate lead notification — shown before create when duplicate-check matches */}
        <AnimatePresence>
          {showDuplicateNotification && pendingDuplicate ? (
            <motion.div
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 26, stiffness: 200 }}
              className={`fixed bottom-8 z-[520] w-full max-w-sm ${addLeadMode ? 'left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-8' : 'right-8'}`}
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
        <HqGrantLeadTrialModal
          open={hqTrialModalOpen}
          name={addLeadMode ? addLeadForm.contactPerson : lead?.contactPerson}
          company={addLeadMode ? addLeadForm.companyName : lead?.companyName}
          values={hqTrialValues}
          submitting={hqTrialSubmitting}
          confirmLabel={addLeadMode ? 'Save trial details' : 'Grant trial account'}
          onChange={(patch: any) => setHqTrialValues((prev: any) => ({ ...prev, ...patch }))}
          onCancel={() => {
            if (hqTrialSubmitting) return;
            setHqTrialModalOpen(false);
          }}
          onConfirm={() => void handleConfirmHqTrialGrant()}
        />
    </>
  );

  return { drawerTree, leadPanelPortalReady };
}