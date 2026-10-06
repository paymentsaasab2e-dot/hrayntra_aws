'use client';


import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLeadDetailsDrawer } from '../../hooks/useLeadDetailsDrawer';

import { createPortal } from 'react-dom';

import { usePageDrawerLifecycle } from '../../lib/pageDrawerEvents';

import { useDrawerBodyScrollLock } from '../../hooks/useDrawerBodyScrollLock';

import { buildFileHref } from '../../utils/cloudinaryUrls';

import { splitDateTimeForDisplay, toDateTimeLocalInput, fromDateTimeLocalInput } from '../../utils/formatLeadDateTime';

import { formatDateDMY, formatDateTimeDMY } from '../../utils/dateDisplay';

import { FollowUpDateTimeField } from '../FollowUpDateTimeField';

import { buildFollowUpStatusRemark, LeadFollowUpScheduler } from '../LeadFollowUpScheduler';

import { formatFollowUpDisplay } from '../../utils/formatLeadDateTime';

import { businessValueInputValue, normalizeBusinessValueForSave, sanitizeBusinessValueInput } from '../../lib/businessValue';

import { NAME_SALUTATION_OPTIONS, formatDirectorDisplay } from '../../constants/salutations';

import { MultiContactFields } from '../ui/MultiContactFields';

import { buildContactChannelsFromForm, contactListForForm, formatContactListMultiline, normalizeContactList, primaryContactValue } from '../../lib/contact-channels';

import { motion, AnimatePresence } from 'motion/react';

import { toast } from 'sonner';

import { requestConfirm, requestError, requestWarning } from '../../lib/appDialog';

import { ArrowLeft, ArrowRight, Edit2, Building2, User, Mail, Phone, Target, Calendar, PhoneCall, CalendarPlus, CalendarClock, UserPlus, XCircle, UserCog, Clock, Activity, StickyNote, Paperclip, ChevronDown, ChevronRight, LayoutGrid, Plus, Sparkles, Lock, AlertTriangle, Check, Trash2, Upload, Download, Eye, FileText, X, MessageSquare, Link2, MapPin, Briefcase, Globe, Users, IndianRupee, Layers, Megaphone, Flag, Gift, PartyPopper } from 'lucide-react';

import type { Lead, LeadStatus, LeadSource, LeadNoteTag, Activity as LeadActivity } from '@/app/leads/types';

import { EntityAuditSummary } from '../table/TableAuditCell';

import { DrawerEntityChatTab } from './DrawerEntityChatTab';

import { extractAuditMeta } from '../../utils/auditMeta';

import { ImageWithFallback } from '../ImageWithFallback';

import { ScheduleMeetingForm } from '../ScheduleMeetingForm';

import { LeadFollowUpTabPanel } from './LeadFollowUpTabPanel';

import { emptyHqGrantLeadTrialValues, HqGrantLeadTrialModal, uniqueLeadEmails, type HqGrantLeadTrialValues } from '../hq/HqGrantLeadTrialModal';

import { NotesService } from '../NotesService';

import { HqLeadRemarksPanel } from '../hq/HqLeadRemarksPanel';

import { apiAppendLeadStatus, apiCheckLeadDuplicate, apiCreateLead, apiGenerateLeadDetails, type LeadAiChatMessage, apiGetLeadActivities, apiGetLeadStatusCatalog, apiRemoveLeadStatus, apiUpdateLead, apiHqListTeam, apiHqGrantLeadTrial, filesApiUpload, type CreateLeadData, type BackendActivity, type BackendLead } from '../../lib/api';

import { KycDocumentsField } from '../documents/KycDocumentsField';

import { AgreementDocumentUpload } from '../documents/AgreementDocumentUpload';

import { AgreementTermsSection } from '../agreements/AgreementTermsSection';

import { agreementTermsApiPayload, agreementTermsFromRecord, emptyAgreementTerms, mergeExtractedAgreementTerms, type AgreementTermsFormValues } from '../../lib/agreementTerms';

import { DocumentUploadButton, useDocumentUploadFeedback } from '../import/documentUploadUi';

import { filterKycFiles, uploadKycDocuments } from '../../lib/kycDocuments';

import { useFiles } from '../../hooks/useFiles';

import { apiGetLeadAssignableMembers } from '../../lib/api';

import { getAllTeamMembersForAssign } from '../../lib/api/teamApi';

import type { TeamMember } from '../../types/team';

import { LeadAssigneesMultiSelect } from './LeadAssigneesMultiSelect';

import { assigneeCompanyId, formatAssigneeDisplayName } from '../../lib/assigneeDisplay';

import { LeadAiChatDrawer } from '../leads/LeadAiChatDrawer';

import { AiCoinLockBadge, useAiCoinGate } from '../coins/AiCoinGate';

import { EntityWorkspaceAlertsPanel } from '../ai/EntityWorkspaceAlertsPanel';

import { alertDrawerAnalysis, analyzeLeadDrawer } from '@/lib/tenant-drawer-engine';

import type { LeadAiGeneratedPayload } from '@/lib/leadAiHelpers';

import { mergeAiCompanyLinks, mergeAiSourceFields, mergeAiTeamMembers, normalizeLeadDateTimeInput, resolveAiDirectorFields, resolveAiLocationFields } from '@/lib/leadAiHelpers';

import { ServicesNeededSelect } from '../forms/ServicesNeededSelect';

import { IndustryMultiSelect } from '../forms/IndustryMultiSelect';

import { formatIndustriesDisplay } from '../../lib/industryOptions';

import { DirectorContactFields } from '../forms/DirectorContactFields';

import { TeamMemberOptionalFields } from '../forms/TeamMemberOptionalFields';

import { isDirectorDetailLabel, mergeDirectorsIntoOtherDetails, normalizeDirectorList, resolveDirectorList } from '../../lib/directorFormDetails';

import { isTeamMemberDetailLabel, mergeTeamMemberIntoOtherDetails, resolveTeamMemberList, normalizeTeamMemberList, primaryTeamMemberFromList, teamMemberHasAnyValue, teamMemberPayloadFromForm } from '../../lib/teamMemberFormDetails';

import { buildLeadOccasionContactOptions, emptyLeadOccasionForm, formatOccasionPersonDisplay, isLeadOccasionDetailLabel, mergeOccasionIntoOtherDetails, readLeadOccasionFromOtherDetails } from '../../lib/leadOccasionDetails';

import { isInternalLeadOtherDetailLabel, withPreservedInternalOtherDetails } from '../../lib/leadInternalOtherDetails';

import { LeadOccasionFields } from '../forms/LeadOccasionFields';

import { DrawerCloseButton } from './DrawerCloseButton';

import { DetailsModalShell } from './DetailsModalShell';

import { DrawerTabBar } from './DrawerTabBar';

import { useDrawerUnsavedGuard } from '../../hooks/useDrawerUnsavedGuard';

import { AddLeadFieldLabel, AddLeadIconInput, AddLeadSectionCard, AddLeadSelectDropdown, ADD_LEAD_INPUT } from './drawerFormUi';

import { LeadSourceFields, formatLeadSourceDisplay } from './LeadSourceFields';

import { LeadLocationFields } from '../location/LeadLocationFields';

import { getCountryByCodeOrName, inferLocationFromCityName } from '../../lib/cscData';

import { startAsyncLoad } from '../../lib/asyncLoadGuard';

import { WhatsAppIcon } from '../icons/WhatsAppIcon';

import { HqProductLineSelectBoxes, hqProductLineLabels, type HqProductLine } from '../hq/HqProductLinePicker';

import { ADD_LEAD_DRAWER_WIDTH_KEY, AddLeadAiFlowProgress, AddLeadFormData, AddLeadWizardProgress, AddLeadWizardStep, CALL_OUTCOMES, DEFAULT_LEAD_STATUSES, FieldRow, FieldRowDateTime, LeadDetailsDrawerProps, LeadRequiredFieldErrors, LeadStatusDropdown, MarkLostFormData, OverviewField, OverviewFieldDateTime, TENANT_ADD_LEAD_WIZARD_STEPS, clampAddLeadDrawerWidth, getInitialAddLeadDrawerWidth, getLeadSourceDetailValue, getSourceFieldLabel, isDefaultLeadStatus, isLeadAlreadyConverted, isProtectedLeadStatus, leadConvertedAlertMessage, leadStatusChipClass, mergeLeadStatusOptions, mergeLocationFields, parseLeadDemoNotes, syncLeadTeamMembers, validateAddLeadWizardStep, validateLeadRequiredFields } from './leadDetailsShared';

export type { AssignLeadFormData } from './leadDetailsShared';

export type { MarkLostFormData } from './leadDetailsShared';

export type { AddLeadFormData } from './leadDetailsShared';

export function LeadDetailsDrawer(props: LeadDetailsDrawerProps) {
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
  const { drawerTree, leadPanelPortalReady } = useLeadDetailsDrawer(props);

if (!leadPanelPortalReady || typeof document === 'undefined') return null;
return createPortal(drawerTree, document.body);
}

