'use client';



import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useClientDetailsDrawer } from '../../hooks/useClientDetailsDrawer';

import { createPortal } from 'react-dom';

import { usePageDrawerLifecycle } from '../../lib/pageDrawerEvents';

import { useDrawerBodyScrollLock } from '../../hooks/useDrawerBodyScrollLock';

import { useDrawerUnsavedGuard } from '../../hooks/useDrawerUnsavedGuard';

import { useClientPageFieldVisibility } from '../../hooks/useClientPageFieldVisibility';

import { buildFileHref } from '../../utils/cloudinaryUrls';

import { formatDateDMY, formatTime12hEnGb } from '../../utils/dateDisplay';

import { formatDirectorDisplay } from '../../constants/salutations';

import { DirectorContactFields } from '../forms/DirectorContactFields';

import { WhatsAppIcon } from '../icons/WhatsAppIcon';

import { LeadAssigneesMultiSelect } from './LeadAssigneesMultiSelect';

import { formatAssigneeDisplayName } from '../../lib/assigneeDisplay';

import { cleanDisplayText } from '../../lib/sanitizeMojibake';

import { businessValueInputValue, normalizeBusinessValueForSave, sanitizeBusinessValueInput } from '../../lib/businessValue';

import { visibleContactEmail, visiblePreferredChannel } from '../../lib/contactEmail';

import { dedupeVisibleContacts } from '../../lib/clientContactDedupe';

import { ServicesNeededSelect } from '../forms/ServicesNeededSelect';

import { IndustryMultiSelect } from '../forms/IndustryMultiSelect';

import { TeamMemberOptionalFields } from '../forms/TeamMemberOptionalFields';

import { LeadOccasionFields } from '../forms/LeadOccasionFields';

import { buildLeadOccasionContactOptions, emptyLeadOccasionForm, mergeOccasionIntoOtherDetails, readLeadOccasionFromOtherDetails } from '../../lib/leadOccasionDetails';

import { mergeTeamMemberIntoOtherDetails, normalizeTeamMemberList, primaryTeamMemberFromList, teamMemberHasAnyValue, teamMemberPayloadFromForm, type TeamMemberListItem } from '../../lib/teamMemberFormDetails';

import { directorFromOtherDetails, mergeDirectorIntoOtherDetails } from '../../lib/clientDirectorDetails';

import { normalizeDirectorList, resolveDirectorList } from '../../lib/directorFormDetails';

import { directorNameFromContact, isClientTeamMemberContact, resolveDirectorBackendContact } from '../../lib/clientContactRoles';

import { formatIndustriesDisplay } from '../../lib/industryOptions';

import { type LocationSelection } from '../LocationAutocomplete';

import { CscLocationFields } from '../location/CscLocationFields';

import { LeadLocationFields } from '../location/LeadLocationFields';

import { AddLeadFieldLabel } from './drawerFormUi';

import { KycDocumentsField, KycDocumentsView } from '../documents/KycDocumentsField';

import { AgreementDocumentUpload } from '../documents/AgreementDocumentUpload';

import { AgreementTermsSection } from '../agreements/AgreementTermsSection';

import { AGREEMENT_LEVEL_OPTIONS, agreementTermsApiPayload, agreementTermsFromRecord, emptyAgreementTerms, filledAgreementTermKeys, formatAgreementTermsSummary, mergeExtractedAgreementTerms, type AgreementTermsFormValues } from '../../lib/agreementTerms';

import type { AgreementLevelCatalogProps } from '../agreements/AgreementTermsSection';

import { emptyPostServiceKycForm, type PostServiceKycAttachmentFieldKey, postServiceKycFormApiPayload, postServiceKycFormFromRecord, type PostServiceKycFormValues } from '../../lib/clientKycForm';

import { DocumentUploadButton, useDocumentUploadFeedback } from '../import/documentUploadUi';

import { filterKycFiles, uploadKycDocuments } from '../../lib/kycDocuments';

import { inferTimezoneDisplay } from '../../utils/inferTimezone';

import { ClientTimezoneSelect } from '../clients/ClientTimezoneSelect';

import { CatalogOptionDropdown, mergeCatalogOptions } from '../forms/CatalogOptionDropdown';

import { clientStatusLabelToBackend, DEFAULT_CLIENT_PRIORITY_LABELS, DEFAULT_CLIENT_STATUS_LABELS, resolveClientStatusLabel } from '../../lib/clientLifecycleStatus';

import { ClientPostServiceKycFormSection, ClientPostServiceKycSummary } from '../clients/ClientPostServiceKycSection';

import { buildContactChannelsFromForm, contactListForForm, formatContactListMultiline, normalizeContactList, primaryContactValue } from '../../lib/contact-channels';

import type { TeamMember } from '../../types/team';

import { motion, AnimatePresence } from 'motion/react';

import { Building2, Briefcase, MessageCircle, LayoutGrid, Users, Award, CreditCard, Activity, StickyNote, Paperclip, Edit2, UserPlus, FileText, Upload, Camera, Trash2, MapPin, Calendar, Clock, TrendingUp, Heart, CalendarPlus, FileCheck, CheckCircle, XCircle, ChevronDown, ChevronRight, Phone, Mail, X, Eye, Pause, Copy, BarChart3, AlertCircle, Sparkles, Lock, User, Send, UserCheck, Shield, Download, DollarSign, FilePlus, Pencil, Receipt, Plus, Bell, MessageSquare, Megaphone, Gift } from 'lucide-react';

import type { Client, ClientStage, ClientContact, ClientJob, JobStatus, ClientActivityItem, ActivityFilterType, NoteTag, ClientFileType } from '@/app/client/types';

import { EntityAuditSummary } from '../table/TableAuditCell';

import { DrawerEntityChatTab } from './DrawerEntityChatTab';

import { extractAuditMeta } from '../../utils/auditMeta';

import { ImageWithFallback } from '../ImageWithFallback';

import { useFiles } from '../../hooks/useFiles';

import { ScheduleMeetingForm } from '../ScheduleMeetingForm';

import { NotesService } from '../NotesService';

import { apiAppendAgreementLevel, apiAppendClientLeadStatus, apiAppendClientPriority, apiGenerateClientDetails, type LeadAiChatMessage, apiCreateClient, apiCreateContact, apiDeleteContact, apiDeleteScheduledMeeting, apiDetectContactDuplicates, apiFetch, apiGetClientActivities, apiGetAgreementLevelCatalog, apiGetClientLeadStatusCatalog, apiGetClientPriorityCatalog, apiRemoveAgreementLevel, apiRemoveClientLeadStatus, apiRemoveClientPriority, apiGetClientScheduledMeetings, apiGetClientAssignableMembers, apiGetContacts, apiGetJob, apiGetJobs, apiHqListTeam, apiHqUploadCompanyLogo, apiUpdateClient, apiSendClientToRecruitment, apiUpdateContact, apiUpdateJob, apiUpdateScheduledMeeting, filesApiUpload, type BackendUser, type BackendJob, type BackendContact, type CreateContactData, type BackendClient, type CreateClientData, type ScheduledMeeting, isOrgBillingNavEnabled, ORG_RECRUITMENT_CACHE_EVENT } from '../../lib/api';

import { CrossDepartmentClientHandoff } from '../team/CrossDepartmentClientHandoff';

import { requestConfirm, requestError, requestSuccess, requestWarning } from '../../lib/appDialog';

import { CreateJobDrawer } from './CreateJobDrawer';

import { ClientAiChatDrawer } from '../clients/ClientAiChatDrawer';

import { AiCoinLockBadge, useAiCoinGate } from '../coins/AiCoinGate';

import { alertDrawerAnalysis, analyzeClientDrawer } from '@/lib/tenant-drawer-engine';

import { clientAiHasAgreementData, clientAiHasKycData, mergeClientAiKycForm, type ClientAiGeneratedPayload } from '@/lib/clientAiHelpers';

import { inferLocationFromCityName } from '../../lib/cscData';

import { startAsyncLoad } from '../../lib/asyncLoadGuard';

import { DrawerCloseButton } from './DrawerCloseButton';

import { DetailsModalShell } from './DetailsModalShell';

import { DrawerTabBar } from './DrawerTabBar';

import { DrawerSectionCard, DRAWER_FORM_SCROLL_BG } from './drawerFormUi';

import { JobDetailsDrawer, type JobForDrawer } from './JobDetailsDrawer';

import { usePermissions } from '../../hooks/usePermissions';

import { toast } from 'sonner';

import { ACTIVITY_CATEGORY_BG, AddClientAiFlowProgress, CLIENT_TEAM_MEMBER_TAG, ClientAiRequiredField, ClientDetailsDrawerProps, ClientOverviewForm, DEFAULT_ADD_CLIENT_SECTIONS, FILE_TYPE_BADGE_STYLES, FieldRow, HEALTH_STYLES, INVOICE_STATUS_STYLES, JOB_STATUS_STYLES, PLACEMENT_STATUS_STYLES, POST_SERVICE_KYC_ATTACHMENT_FIELDS, PendingPostServiceKycFiles, appendPostServiceKycFiles, buildCompanyLinksFromClient, createEmptyPendingPostServiceKycFiles, curatedDynamicPairsForSave, enrichGeneratedClientFromPrompt, filterImportedDynamicOtherDetails, mapClientActivityCategory, mergeBackendClientRecord, mergeClientLocationSelection, normalizeClientAiDateInput, normalizeCompanyLinksForSave, postServiceKycFileRefFromEntityFile, removePostServiceKycStoredFile, resolveClientCityStateCountry, resolveClientTeamMembersForForm, resolvePrimaryAssignedToId, syncClientTeamMembers, validateClientAiEmail } from './clientDetailsShared';

export function ClientDetailsDrawer(props: ClientDetailsDrawerProps) {
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
  const { clientPanelPortalReady, createJobDrawerOpen, drawerTree, duplicateFromJobId, jobCandidatesForDrawer, jobDetailsOpen, jobPipelineStagesForDrawer, pipelineStages, refreshClientJobs, selectedJobForDrawer, setClientActivities, setCreateJobDrawerOpen, setDuplicateFromJobId, setJobCandidatesForDrawer, setJobDetailsOpen, setSelectedJobForDrawer } = useClientDetailsDrawer(props);

return (
    <>
      {clientPanelPortalReady && typeof document !== 'undefined'
        ? createPortal(drawerTree, document.body)
        : null}
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
      onAssignmentUpdated={async (jobId) => {
        try {
          const res = await apiGetJob(jobId);
          const full = (res as any)?.data?.data || (res as any)?.data || res;
          if (!full) return;
          const assigneeName =
            formatAssigneeDisplayName(full.assignedTo) || full.assignedTo?.name || '';
          setSelectedJobForDrawer((prev) =>
            prev && prev.id === jobId
              ? {
                  ...prev,
                  clientId: full.clientId || full.client?.id || prev.clientId,
                  assignedToId: full.assignedToId || full.assignedTo?.id || null,
                  recruiter: assigneeName || prev.recruiter,
                  owner: assigneeName || prev.owner,
                  hiringManager: full.hiringManager || undefined,
                  hiringManagerId: full.hiringManagerId || null,
                  managerId: full.managerId || full.manager?.id || null,
                  supportingRecruiters: Array.isArray(full.supportingRecruiters)
                    ? full.supportingRecruiters.map(String)
                    : [],
                }
              : prev,
          );
          void refreshClientJobs();
        } catch (error) {
          console.warn('Failed to refresh job after assignment update', error);
        }
      }}
    />
    </>
  );
}

