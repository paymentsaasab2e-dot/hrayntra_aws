'use client';

import React, { useState, useEffect, useRef } from 'react';
import { buildFileHref } from '../../utils/cloudinaryUrls';
import { splitDateTimeForDisplay } from '../../utils/formatLeadDateTime';
import { motion, AnimatePresence } from 'motion/react';
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
  MessageCircle,
  CalendarPlus,
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
  SendHorizontal,
  AlertTriangle,
  Copy,
  Check,
  Trash2,
  Pin,
  Pencil,
  Upload,
  Download,
  Eye,
  FileText,
} from 'lucide-react';
import type { Lead, LeadStatus, LeadSource, LeadType, LeadNote, LeadNoteTag, Activity as LeadActivity } from '@/app/leads/types';
import { ImageWithFallback } from '../ImageWithFallback';
import { ScheduleMeetingForm } from '../ScheduleMeetingForm';
import { NotesService } from '../NotesService';
import { apiCreateLead, apiUpdateLead, apiGetLead, apiGetLeadActivities, apiGenerateLeadDetails, type CreateLeadData, type BackendActivity } from '../../lib/api';
import { getTeamMembers } from '../../lib/api/teamApi';
import { useFiles } from '../../hooks/useFiles';
import type { TeamMember } from '../../types/team';

const CALL_OUTCOMES = ['Interested', 'Follow-up Required', 'No Answer', 'Wrong Number', 'Not Interested'];

const STATUS_STYLES: Record<LeadStatus, string> = {
  New: 'bg-blue-50 text-blue-700 border-blue-100',
  Contacted: 'bg-yellow-50 text-yellow-700 border-yellow-100',
  Qualified: 'bg-purple-50 text-purple-700 border-purple-100',
  Converted: 'bg-green-50 text-green-700 border-green-100',
  Lost: 'bg-gray-50 text-gray-700 border-gray-100',
};

const NOTE_TAG_OPTIONS: (LeadNoteTag | 'All')[] = ['All', 'HR', 'Finance', 'Contract', 'Feedback'];

const NOTE_TAG_STYLES: Record<LeadNoteTag, string> = {
  HR: 'bg-blue-100 text-blue-700 border-blue-200',
  Finance: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Contract: 'bg-amber-100 text-amber-700 border-amber-200',
  Feedback: 'bg-violet-100 text-violet-700 border-violet-200',
};

export type AssignLeadFormData = {
  assignTo: string;
  priority: 'High' | 'Medium' | 'Low';
  notifyUser: boolean;
};

export type MarkLostFormData = {
  lostReason: string;
  notes: string;
};

export type AddLeadFormData = {
  // Company Information Section
  companyName: string;
  industry?: string;
  companySize?: string;
  website?: string;
  linkedIn?: string;
  location?: string;
  // Contact Section
  contactPerson: string;
  designation?: string;
  email: string;
  phone?: string;
  country?: string;
  city?: string;
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
  assignedToName?: string;
  assignedToId?: string;
  status?: LeadStatus;
  priority?: 'High' | 'Medium' | 'Low';
  interestedNeeds?: string;
  notes?: string;
  lastFollowUp?: string;
  nextFollowUp?: string;
};

type LeadAiStep =
  | 'initial'
  | 'coreDetails'
  | 'followUpNotes'
  | 'interestValue'
  | 'done';

type LeadAiMessage = {
  id: string;
  role: 'ai' | 'user';
  content: string;
};

type LeadAiRequiredField =
  | 'companyName'
  | 'email'
  | 'phone'
  | 'location'
  | 'interestedNeeds';

const LEAD_AI_REQUIRED_FIELD_LABELS: Record<LeadAiRequiredField, string> = {
  companyName: 'Company',
  email: 'Email',
  phone: 'Phone',
  location: 'Location',
  interestedNeeds: 'Services Needed',
};

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
  onClose: () => void;
  /** Called when user submits the Add Lead form */
  onAddLead?: (data: AddLeadFormData) => void;
  onConvert?: (id: string) => void;
  onMarkLost?: (id: string, formData?: MarkLostFormData) => void;
  onAssignLead?: (id: string, formData: AssignLeadFormData) => void;
  onDeleteLead?: (id: string) => void;
}

const FieldRow = ({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: boolean;
}) => (
  <div className="flex flex-col gap-0.5 py-2 border-b border-slate-100 last:border-0">
    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
    {value ? (
      <p
        className={`text-sm font-medium text-slate-900 ${href ? 'text-blue-600 hover:underline cursor-pointer truncate' : ''}`}
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

export function LeadDetailsDrawer({
  lead,
  addLeadMode = false,
  onClose,
  onAddLead,
  onConvert,
  onMarkLost,
  onAssignLead,
  onDeleteLead,
}: LeadDetailsDrawerProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'activities' | 'notes' | 'files' | 'add'>(
    'overview'
  );
  const [leadFilesTypeFilter, setLeadFilesTypeFilter] = useState<'All' | 'Contract' | 'Proposal' | 'Other'>('All');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { files: leadFiles, loading: filesLoading, uploading: filesUploading, error: filesError, uploadFile, deleteFile } = useFiles('lead', lead?.id);

  useEffect(() => {
    if (addLeadMode) setActiveTab('add');
  }, [addLeadMode]);

  const [addLeadForm, setAddLeadForm] = useState<AddLeadFormData>({
    // Company Information
    companyName: '',
    industry: '',
    companySize: '',
    website: '',
    linkedIn: '',
    location: '',
    // Contact Person
    contactPerson: '',
    designation: '',
    email: '',
    phone: '',
    country: '',
    city: '',
    // Lead Details
    type: 'Company',
    source: 'Website',
    campaignName: '',
    campaignLink: '',
    referralName: '',
    sourceWebsiteUrl: '',
    sourceLinkedInUrl: '',
    sourceEmail: '',
    assignedToName: '',
    assignedToId: '',
    status: 'New',
    priority: 'Medium',
    interestedNeeds: '',
    notes: '',
    lastFollowUp: '',
    nextFollowUp: '',
  });
  
  // Fetch recruiters from backend
  const [recruiters, setRecruiters] = useState<TeamMember[]>([]);
  const [loadingRecruiters, setLoadingRecruiters] = useState(false);
  
  useEffect(() => {
    const fetchRecruiters = async () => {
      // Only fetch when drawer is open (either addLeadMode or lead exists)
      if (!addLeadMode && !lead) return;
      
      setLoadingRecruiters(true);
      try {
        const response = await getTeamMembers({ 
          status: 'ACTIVE',
        });
        
        // Debug: Log the response to see the structure
        console.log('Recruiters API Response:', response.data);
        
        // Filter to only show users with Recruiter or Senior Recruiter roles
        const recruiterRoles = ['Recruiter', 'Senior Recruiter'];
        const recruiterMembers = (response.data || []).map((member: any) => {
          // Normalize: ensure 'role' field exists (backend returns 'systemRole')
          if (member.systemRole && !member.role) {
            member.role = member.systemRole;
          }
          return member;
        }).filter((member: any) => {
          const role = member.role || member.systemRole;
          if (!role) {
            console.warn('Member has no role:', member.firstName, member.lastName);
            return false;
          }
          const isRecruiter = recruiterRoles.includes(role.roleName);
          if (isRecruiter) {
            console.log('Found recruiter:', member.firstName, member.lastName, 'Role:', role.roleName);
          }
          return isRecruiter;
        });
        
        console.log('Filtered Recruiters:', recruiterMembers);
        setRecruiters(recruiterMembers);
      } catch (error: any) {
        console.error('Failed to fetch recruiters:', error);
        setRecruiters([]);
      } finally {
        setLoadingRecruiters(false);
      }
    };
    
    fetchRecruiters();
  }, [addLeadMode, lead]);

  const pushLeadAiMessage = (role: LeadAiMessage['role'], content: string) => {
    setLeadAiMessages((prev) => [
      ...prev,
      {
        id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role,
        content,
      },
    ]);
  };

  const resetLeadAiConversation = () => {
    setLeadAiPrompt('');
    setLeadAiError('');
    setLeadAiStep('initial');
    setLeadAiSummaryReady(false);
    setLeadAiContext('');
    setLeadAiPendingFields([]);
    setLeadAiMessages([
      {
        id: 'lead-ai-welcome',
        role: 'ai',
        content:
          'Paste all lead details you have. If Company, Email, Phone, Location, or Services Needed are missing, I will ask only for those details. Once I have them, AI will optimize the data and create the lead directly.',
      },
    ]);
  };

  const openLeadAiDrawer = () => {
    setShowAiLeadDrawer(true);
    resetLeadAiConversation();
  };

  const finalizeLeadAiDrawer = () => {
    setShowAiLeadDrawer(false);
    setAddLeadSectionsOpen({
      company: true,
      contact: true,
      leadDetails: true,
    });
  };

  const buildLeadCreatePayload = (form: AddLeadFormData) => {
    const companyLinks = ((form.website ?? '').split('\n').map((item) => item.trim()).filter(Boolean));

    return {
      companyName: form.companyName.trim(),
      sector: form.industry?.trim() || undefined,
      industry: form.industry?.trim() || undefined,
      teamName: form.companySize?.trim() || undefined,
      companySize: form.companySize?.trim() || undefined,
      website: form.website?.trim() || undefined,
      companyLinks: companyLinks.length ? companyLinks : undefined,
      linkedIn: form.linkedIn?.trim() || undefined,
      location: form.location?.trim() || undefined,
      directorName: form.contactPerson.trim(),
      contactPerson: form.contactPerson.trim(),
      designation: form.designation?.trim() || undefined,
      email: form.email.trim(),
      phone: form.phone?.trim() || undefined,
      country: form.country?.trim() || undefined,
      city: form.city?.trim() || undefined,
      type: form.type || 'Company',
      source: form.source || 'Website',
      campaignName: form.campaignName?.trim() || undefined,
      campaignLink: form.campaignLink?.trim() || undefined,
      referralName: form.referralName?.trim() || undefined,
      sourceWebsiteUrl: form.sourceWebsiteUrl?.trim() || undefined,
      sourceLinkedInUrl: form.sourceLinkedInUrl?.trim() || undefined,
      sourceEmail: form.sourceEmail?.trim() || undefined,
      otherDetails: Array.isArray(form.otherDetails) && form.otherDetails.length ? form.otherDetails : undefined,
      status: form.status || 'New',
      priority: form.priority || 'Medium',
      servicesNeeded: form.interestedNeeds?.trim() || undefined,
      interestedNeeds: form.interestedNeeds?.trim() || undefined,
      expectedBusinessValue: form.notes?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
      lastFollowUp: form.lastFollowUp || undefined,
      nextFollowUp: form.nextFollowUp || undefined,
      assignedToId: form.assignedToId || undefined,
    };
  };

  const resetAddLeadForm = () => {
    setAddLeadForm({
      companyName: '',
      industry: '',
      companySize: '',
      website: '',
      linkedIn: '',
      location: '',
      contactPerson: '',
      designation: '',
      email: '',
      phone: '',
      country: '',
      city: '',
      type: 'Company',
      source: 'Website',
      campaignName: '',
      campaignLink: '',
      referralName: '',
      sourceWebsiteUrl: '',
      sourceLinkedInUrl: '',
      sourceEmail: '',
      otherDetails: [],
      assignedToName: '',
      assignedToId: '',
      status: 'New',
      priority: 'Medium',
      interestedNeeds: '',
      notes: '',
      lastFollowUp: '',
      nextFollowUp: '',
    });
  };

  const createLeadFromAiForm = async (form: AddLeadFormData) => {
    const createData = buildLeadCreatePayload(form);
    await apiCreateLead(createData);
    onAddLead?.(form);
    resetAddLeadForm();
    setShowAiLeadDrawer(false);
    onClose();
  };

  const getMissingLeadAiFields = (form: AddLeadFormData): LeadAiRequiredField[] => {
    const missing: LeadAiRequiredField[] = [];
    if (!form.companyName?.trim()) missing.push('companyName');
    if (!form.email?.trim()) missing.push('email');
    if (!form.phone?.trim()) missing.push('phone');
    if (!form.location?.trim()) missing.push('location');
    if (!form.interestedNeeds?.trim()) missing.push('interestedNeeds');
    return missing;
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


  const handleLeadAiGenerate = async () => {
    const input = leadAiPrompt.trim();
    if (!input) return;

    setLeadAiPrompt('');
    setLeadAiError('');
    pushLeadAiMessage('user', input);

    try {
      setLeadAiGenerating(true);
      setLeadAiStep('coreDetails');
      const combinedContext = [leadAiContext, input].filter(Boolean).join('\n');
      const response = await apiGenerateLeadDetails({
        prompt: combinedContext,
        currentForm: addLeadForm as unknown as Record<string, unknown>,
      });
      const generated = response.data;

      const nextFormState: AddLeadFormData = {
        ...addLeadForm,
        companyName: generated.companyName || addLeadForm.companyName,
        contactPerson: generated.contactPerson || addLeadForm.contactPerson,
        designation: generated.designation || addLeadForm.designation,
        email: generated.email || addLeadForm.email,
        phone: generated.phone || addLeadForm.phone,
        type: generated.type || addLeadForm.type,
        source: generated.source || addLeadForm.source,
        status: generated.status || addLeadForm.status,
        priority: generated.priority || addLeadForm.priority,
        interestedNeeds: generated.interestedNeeds || addLeadForm.interestedNeeds,
        notes: generated.notes || addLeadForm.notes,
        industry: generated.industry || addLeadForm.industry,
        companySize: generated.companySize || addLeadForm.companySize,
        website: generated.website || addLeadForm.website,
        linkedIn: generated.linkedIn || addLeadForm.linkedIn,
        location: generated.location || addLeadForm.location,
        country: generated.country || addLeadForm.country,
        city: generated.city || addLeadForm.city,
        campaignName: generated.campaignName || addLeadForm.campaignName,
        campaignLink: generated.campaignLink || addLeadForm.campaignLink,
        referralName: generated.referralName || addLeadForm.referralName,
        sourceWebsiteUrl: generated.sourceWebsiteUrl || addLeadForm.sourceWebsiteUrl,
        sourceLinkedInUrl: generated.sourceLinkedInUrl || addLeadForm.sourceLinkedInUrl,
        sourceEmail: generated.sourceEmail || addLeadForm.sourceEmail,
        otherDetails: Array.isArray(generated.otherDetails) ? generated.otherDetails : addLeadForm.otherDetails,
        lastFollowUp: normalizeLeadDateInput(generated.lastFollowUp || addLeadForm.lastFollowUp),
        nextFollowUp: normalizeLeadDateInput(generated.nextFollowUp || addLeadForm.nextFollowUp),
        assignedToId: generated.assignedToId || addLeadForm.assignedToId,
      };

      setAddLeadForm(nextFormState);
      setLeadAiContext(combinedContext);

      const missingFields = getMissingLeadAiFields(nextFormState);
      if (missingFields.length > 0) {
        setLeadAiPendingFields(missingFields);
        setLeadAiStep('followUpNotes');
        setLeadAiSummaryReady(false);
        pushLeadAiMessage(
          'ai',
          `I still need these details before I can create the lead: ${missingFields
            .map((field) => LEAD_AI_REQUIRED_FIELD_LABELS[field])
            .join(', ')}. Please send them in one message.`
        );
        return;
      }

      await createLeadFromAiForm(nextFormState);
      return;
    } catch (error: any) {
      console.error('Lead AI generation failed:', error);
      setLeadAiError(error?.message || 'Failed to generate lead details');
      setLeadAiStep('initial');
    } finally {
      setLeadAiGenerating(false);
    }
  };
  const [addLeadSectionsOpen, setAddLeadSectionsOpen] = useState({
    company: true,
    contact: true,
    leadDetails: true,
  });
  const [showAiLeadDrawer, setShowAiLeadDrawer] = useState(false);
  const [leadAiPrompt, setLeadAiPrompt] = useState('');
  const [, setLeadAiStep] = useState<LeadAiStep>('initial');
  const [leadAiMessages, setLeadAiMessages] = useState<LeadAiMessage[]>([]);
  const [leadAiError, setLeadAiError] = useState('');
  const [leadAiSummaryReady, setLeadAiSummaryReady] = useState(false);
  const [leadAiContext, setLeadAiContext] = useState('');
  const [leadAiPendingFields, setLeadAiPendingFields] = useState<LeadAiRequiredField[]>([]);
  const [leadAiGenerating, setLeadAiGenerating] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState<Record<string, boolean>>({
    company: false,
    contact: false,
    leadDetails: false,
  });
  const [overviewEditMode, setOverviewEditMode] = useState(false);
  const [overviewEditForm, setOverviewEditForm] = useState({
    companyName: '',
    industry: '',
    companySize: '',
    website: '',
    linkedIn: '',
    location: '',
    contactPerson: '',
    designation: '',
    email: '',
    phone: '',
    country: '',
    city: '',
    source: '' as LeadSource | '',
    campaignName: '',
    campaignLink: '',
    referralName: '',
    sourceWebsiteUrl: '',
    sourceLinkedInUrl: '',
    sourceEmail: '',
    otherDetailsText: '',
    leadOwner: '',
    assignedToId: '',
    status: 'New' as LeadStatus,
    priority: 'Medium' as 'High' | 'Medium' | 'Low',
    interestedNeeds: '',
    notes: '',
    createdDate: '',
    lastFollowUp: '',
    nextFollowUp: '',
  });
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
  const FOLLOW_UP_TYPES = ['Call', 'WhatsApp', 'Email', 'Meeting'];
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
  const [assignLeadForm, setAssignLeadForm] = useState({
    assignTo: '',
    priority: 'Medium' as 'High' | 'Medium' | 'Low',
    notifyUser: true,
  });
  const [assignToDropdownOpen, setAssignToDropdownOpen] = useState(false);
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

  useEffect(() => {
    if (!showDuplicateNotification) return;
    const t = setTimeout(() => setShowDuplicateNotification(false), 5000);
    return () => clearTimeout(t);
  }, [showDuplicateNotification]);

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

          // Format date
          const date = new Date(activity.createdAt);
          const formattedDate = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });

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
    setAssignLeadForm({
      assignTo: lead?.assignedTo?.name ?? '',
      priority: lead?.priority ?? 'Medium',
      notifyUser: true,
    });
    setShowAssignLeadForm(true);
  };

  const openConvertToClientForm = () => {
    setConvertToClientForm({
      companyName: lead?.companyName ?? '',
      primaryContact: lead?.contactPerson ?? '',
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
    setOverviewEditForm({
      companyName: lead.companyName,
      industry: lead.industry ?? '',
      companySize: lead.companySize ?? '',
      website: lead.website ?? '',
      linkedIn: lead.linkedIn ?? '',
      location: lead.location ?? '',
      contactPerson: lead.contactPerson,
      designation: lead.designation ?? '',
      email: lead.email,
      phone: lead.phone,
      country: lead.country ?? '',
      city: lead.city ?? '',
      source: lead.source,
      campaignName: lead.campaignName ?? '',
      campaignLink: lead.campaignLink ?? '',
      referralName: lead.referralName ?? '',
      sourceWebsiteUrl: lead.sourceWebsiteUrl ?? '',
      sourceLinkedInUrl: lead.sourceLinkedInUrl ?? '',
      sourceEmail: lead.sourceEmail ?? '',
      otherDetailsText: Array.isArray(lead.otherDetails)
        ? lead.otherDetails.map((item) => `${item.label}: ${item.value}`).join('\n')
        : '',
      leadOwner: lead.assignedTo?.name ?? '',
      assignedToId: lead.assignedTo?.id ?? '',
      status: lead.status,
      priority: lead.priority ?? 'Medium',
      interestedNeeds: lead.interestedNeeds ?? '',
      notes: lead.notes ?? '',
      createdDate: lead.createdDate ?? '',
      lastFollowUp: lead.lastFollowUp,
      nextFollowUp: lead.nextFollowUp ?? '',
    });
    setOverviewEditMode(true);
    setOverviewOpen({ company: true, contact: true, leadDetails: true });
  };

  const cancelOverviewEdit = () => {
    setOverviewEditMode(false);
  };

  const saveOverviewEdit = async () => {
    if (!lead) return;
    
    try {
      // Find assigned user ID from name (in a real app, you'd have a user lookup)
      // For now, we'll just update the fields we can
      const updateData: Partial<CreateLeadData> = {
        companyName: overviewEditForm.companyName,
        contactPerson: overviewEditForm.contactPerson,
        email: overviewEditForm.email,
        phone: overviewEditForm.phone,
        industry: overviewEditForm.industry || undefined,
        companySize: overviewEditForm.companySize || undefined,
        website: overviewEditForm.website || undefined,
        linkedIn: overviewEditForm.linkedIn || undefined,
        location: overviewEditForm.location || undefined,
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
        otherDetails: overviewEditForm.otherDetailsText
          ? overviewEditForm.otherDetailsText
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean)
              .map((line) => {
                const parts = line.split(':');
                return {
                  label: (parts.shift() || '').trim(),
                  value: parts.join(':').trim(),
                };
              })
              .filter((item) => item.label && item.value)
          : undefined,
        status: overviewEditForm.status,
        priority: overviewEditForm.priority,
        assignedToId: overviewEditForm.assignedToId || undefined,
        interestedNeeds: overviewEditForm.interestedNeeds || undefined,
        notes: overviewEditForm.notes || undefined,
        lastFollowUp: overviewEditForm.lastFollowUp || undefined,
        nextFollowUp: overviewEditForm.nextFollowUp || undefined,
      };

      await apiUpdateLead(lead.id, updateData);
      setOverviewEditMode(false);
      
      // Refresh the lead data by calling the parent's refresh handler if available
      // For now, we'll just close edit mode - the parent should refresh
      window.location.reload(); // Simple refresh - in production, use a proper state update
    } catch (error: any) {
      console.error('Failed to update lead:', error);
      alert(error.message || 'Failed to update lead');
    }
  };

  const tabs = addLeadMode
    ? [{ id: 'add' as const, label: 'Add Lead', icon: UserPlus }]
    : [
        { id: 'overview' as const, label: 'Overview', icon: LayoutGrid },
        { id: 'activities' as const, label: 'Activities', icon: Activity },
        { id: 'notes' as const, label: 'Notes', icon: StickyNote },
        { id: 'files' as const, label: 'Files', icon: Paperclip },
      ];

  return (
    <AnimatePresence>
      {(lead || addLeadMode) && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] pointer-events-auto"
          />
          <motion.div
            key="panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-1/2 bg-white shadow-2xl z-50 pointer-events-auto border-l border-slate-200 flex flex-col"
          >
          {/* Header */}
          <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-3 shrink-0 bg-white">
            <div className="flex-1 min-w-0 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <Building2 size={20} />
              </div>
              <div className="min-w-0">
                {addLeadMode ? (
                  <h2 className="text-lg font-bold text-slate-900">Add Lead</h2>
                ) : (
                  <>
                    <h2 className="text-lg font-bold text-slate-900 truncate">{lead!.companyName}</h2>
                    <span
                      className={`inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[lead!.status]}`}
                    >
                      {lead!.status}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {addLeadMode && (
                <button
                  type="button"
                  onClick={openLeadAiDrawer}
                  className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl border border-blue-400/40 bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_0_1px_rgba(96,165,250,0.18),0_10px_30px_rgba(37,99,235,0.32),0_0_24px_rgba(56,189,248,0.28)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_rgba(125,211,252,0.34),0_16px_38px_rgba(37,99,235,0.38),0_0_32px_rgba(34,211,238,0.38)]"
                >
                  <span className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.42),transparent_42%),linear-gradient(120deg,transparent_20%,rgba(255,255,255,0.2)_48%,transparent_78%)] opacity-80 transition-opacity duration-300 group-hover:opacity-100" />
                  <span className="absolute -left-10 top-0 h-full w-10 -skew-x-12 bg-white/20 blur-md transition-transform duration-700 group-hover:translate-x-[240px]" />
                  <span className="relative flex items-center gap-2">
                    <Sparkles size={16} className="drop-shadow-[0_0_10px_rgba(255,255,255,0.55)]" />
                    Generate With AI
                  </span>
                </button>
              )}
              {!addLeadMode && activeTab === 'overview' && !overviewEditMode && (
                <button
                  type="button"
                  onClick={startOverviewEdit}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Edit Lead"
                >
                  <Edit2 size={18} />
                </button>
              )}
              {!addLeadMode && activeTab === 'overview' && overviewEditMode && (
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
              {addLeadMode ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <XCircle size={20} />
                </button>
              ) : (
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
                      <button className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
                        Export
                      </button>
                      <button className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
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
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="shrink-0 bg-slate-50/80 border-b border-slate-200 px-5 pt-1">
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
              {!addLeadMode && (
              <button
                type="button"
                onClick={() => setShowDuplicateNotification(true)}
                className="p-2 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 border border-transparent hover:border-amber-200 transition-colors"
                title="Trigger duplicate notification (demo). Real triggers: Duplicate email, Duplicate phone, Duplicate company."
              >
                <Copy size={16} />
              </button>
              )}
            </div>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto bg-slate-50/30">
            <div className="p-5">
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
                      <label htmlFor="log-call-next" className="block text-sm font-medium text-slate-700 mb-2">Next Follow-up</label>
                      <input
                        id="log-call-next"
                        type="date"
                        value={logCallForm.nextFollowUp}
                        onChange={(e) => setLogCallForm((p) => ({ ...p, nextFollowUp: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
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
                        setLogCallForm({ callType: 'Outgoing', durationMinutes: 0, durationSeconds: 0, outcome: '', notes: '', nextFollowUp: '' });
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
                        <MessageCircle size={18} className="text-emerald-600 shrink-0" />
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
                      <MessageCircle size={16} />
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
                    setActiveTab('overview');
                  }}
                  title="Schedule Follow-up"
                  onSuccess={() => {
                    setShowScheduleFollowUpForm(false);
                    setActiveTab('overview');
                    // Refresh activities to show the new follow-up activity
                    if (activeTab === 'activities') {
                      setActiveTab('overview');
                      setTimeout(() => setActiveTab('activities'), 100);
                    }
                  }}
                  onCancel={() => {
                    setShowScheduleFollowUpForm(false);
                    setActiveTab('overview');
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
                      <label htmlFor="convert-contact" className="block text-sm font-medium text-slate-700 mb-2">Primary Contact</label>
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
                        if (lead) onConvert?.(lead.id);
                        setShowConvertToClientForm(false);
                        setActiveTab('overview');
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
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setAssignToDropdownOpen((v) => !v)}
                          className="w-full flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-left text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                          {assignLeadForm.assignTo ? (
                            (() => {
                              const r = recruiters.find((x) => x.id === assignLeadForm.assignTo);
                              return r ? (
                                <span className="flex items-center gap-2">
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${roleColorMap[(r.role || r.systemRole)?.color?.toLowerCase() || 'gray'] || 'bg-gray-100 text-gray-600'}`}>
                                    {r.firstName?.[0] || ''}{r.lastName?.[0] || ''}
                                  </div>
                                  <span className="text-slate-900">{r.firstName} {r.lastName}</span>
                                </span>
                              ) : (
                                <span className="text-slate-900">{assignLeadForm.assignTo}</span>
                              );
                            })()
                          ) : (
                            <span className="text-slate-400">Select recruiter</span>
                          )}
                          <ChevronDown size={16} className="text-slate-400" />
                        </button>
                        {assignToDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setAssignToDropdownOpen(false)} aria-hidden />
                            <ul className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg max-h-48 overflow-y-auto">
                              {recruiters.map((rec) => (
                                <li key={rec.id}>
                                  <button
                                    type="button"
                                    onClick={() => { setAssignLeadForm((p) => ({ ...p, assignTo: rec.id })); setAssignToDropdownOpen(false); }}
                                    className={`w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${assignLeadForm.assignTo === rec.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                                  >
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${roleColorMap[rec.role?.color?.toLowerCase() || 'gray'] || 'bg-gray-100 text-gray-600'}`}>
                                      {rec.firstName?.[0] || ''}{rec.lastName?.[0] || ''}
                                    </div>
                                    {rec.firstName} {rec.lastName}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
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
                        setActiveTab('overview');
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
                        setActiveTab('overview');
                      }}
                      className="px-4 py-2.5 text-sm font-medium text-white bg-slate-600 rounded-xl hover:bg-slate-700 shadow-sm transition-colors flex items-center gap-2"
                    >
                      <XCircle size={16} />
                      Confirm Lost
                    </button>
                  </div>
                </div>
              ) : activeTab === 'add' ? (
                <div className="space-y-4">
                  <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-100">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lead Information</h4>
                    </div>
                    <div className="p-5 space-y-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Company *</label>
                          <input value={addLeadForm.companyName} onChange={(e) => setAddLeadForm((p) => ({ ...p, companyName: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" placeholder="e.g. Acme Inc." />
                        </div>
                        <div>
                          <div className="mb-1 flex items-center justify-between gap-3">
                            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Company Links</label>
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
                                <input
                                  value={link}
                                  onChange={(e) => updateCompanyLink(index, e.target.value)}
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                  placeholder="https://company.com or LinkedIn URL"
                                />
                                {companyLinks.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeCompanyLinkField(index)}
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
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Director Name *</label>
                          <input value={addLeadForm.contactPerson} onChange={(e) => setAddLeadForm((p) => ({ ...p, contactPerson: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" placeholder="e.g. John Doe" />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Team Name</label>
                          <input value={addLeadForm.companySize ?? ''} onChange={(e) => setAddLeadForm((p) => ({ ...p, companySize: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" placeholder="e.g. Growth Team" />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Email *</label>
                          <input type="email" value={addLeadForm.email} onChange={(e) => setAddLeadForm((p) => ({ ...p, email: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" placeholder="email@company.com" />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Phone</label>
                          <input value={addLeadForm.phone ?? ''} onChange={(e) => setAddLeadForm((p) => ({ ...p, phone: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" placeholder="+1 (555) 000-0000" />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Location</label>
                          <input value={addLeadForm.location ?? ''} onChange={(e) => setAddLeadForm((p) => ({ ...p, location: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" placeholder="e.g. Downtown Office" />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">City</label>
                          <input value={addLeadForm.city ?? ''} onChange={(e) => setAddLeadForm((p) => ({ ...p, city: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" placeholder="e.g. San Francisco" />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Country</label>
                          <input value={addLeadForm.country ?? ''} onChange={(e) => setAddLeadForm((p) => ({ ...p, country: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" placeholder="e.g. United States" />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Sector</label>
                          <input value={addLeadForm.industry ?? ''} onChange={(e) => setAddLeadForm((p) => ({ ...p, industry: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" placeholder="e.g. Technology" />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status</label>
                          <select value={addLeadForm.status ?? 'New'} onChange={(e) => setAddLeadForm((p) => ({ ...p, status: e.target.value as LeadStatus }))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white">
                            <option value="New">New</option>
                            <option value="Contacted">Contacted</option>
                            <option value="Qualified">Qualified</option>
                            <option value="Converted">Converted</option>
                            <option value="Lost">Lost</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Interest Level</label>
                          <select value={addLeadForm.priority ?? 'Medium'} onChange={(e) => setAddLeadForm((p) => ({ ...p, priority: e.target.value as 'High' | 'Medium' | 'Low' }))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white">
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Next Follow-up Date</label>
                          <input type="date" value={addLeadForm.nextFollowUp ?? ''} onChange={(e) => setAddLeadForm((p) => ({ ...p, nextFollowUp: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Assigned To</label>
                          <select value={addLeadForm.assignedToId ?? ''} onChange={(e) => { const selectedRecruiter = recruiters.find(r => r.id === e.target.value); setAddLeadForm((p) => ({ ...p, assignedToId: e.target.value, assignedToName: selectedRecruiter ? `${selectedRecruiter.firstName} ${selectedRecruiter.lastName}` : '' })); }} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white" disabled={loadingRecruiters}>
                            <option value="">Select recruiter</option>
                            {recruiters.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.firstName} {r.lastName}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Services Needed</label>
                        <input value={addLeadForm.interestedNeeds ?? ''} onChange={(e) => setAddLeadForm((p) => ({ ...p, interestedNeeds: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" placeholder="e.g. Hiring support for engineering and sales" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Expected Business Value</label>
                        <textarea value={addLeadForm.notes ?? ''} onChange={(e) => setAddLeadForm((p) => ({ ...p, notes: e.target.value }))} rows={3} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none" placeholder="e.g. Potential annual business of $50,000" />
                      </div>
                      {Array.isArray(addLeadForm.otherDetails) && addLeadForm.otherDetails.length ? (
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Other Details</label>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-2">
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
                  </section>
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
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Sector</label>
                          <input
                            value={addLeadForm.industry ?? ''}
                            onChange={(e) => setAddLeadForm((p) => ({ ...p, industry: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="e.g. Technology"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Team Name</label>
                          <input
                            value={addLeadForm.companySize ?? ''}
                            onChange={(e) => setAddLeadForm((p) => ({ ...p, companySize: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="e.g. Growth Team"
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
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Director Name *</label>
                          <input
                            value={addLeadForm.contactPerson}
                            onChange={(e) => setAddLeadForm((p) => ({ ...p, contactPerson: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="e.g. John Doe"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Email *</label>
                          <input
                            type="email"
                            value={addLeadForm.email}
                            onChange={(e) => setAddLeadForm((p) => ({ ...p, email: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="email@company.com"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Phone</label>
                          <input
                            value={addLeadForm.phone ?? ''}
                            onChange={(e) => setAddLeadForm((p) => ({ ...p, phone: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="+1 (555) 000-0000"
                          />
                        </div>
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
                            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status</label>
                            <select
                              value={addLeadForm.status ?? 'New'}
                              onChange={(e) => setAddLeadForm((p) => ({ ...p, status: e.target.value as LeadStatus }))}
                              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                            >
                              <option value="New">New</option>
                              <option value="Contacted">Contacted</option>
                              <option value="Qualified">Qualified</option>
                              <option value="Converted">Converted</option>
                              <option value="Lost">Lost</option>
                            </select>
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
                          <input
                            value={addLeadForm.interestedNeeds ?? ''}
                            onChange={(e) => setAddLeadForm((p) => ({ ...p, interestedNeeds: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="e.g. Hiring support for engineering and sales"
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
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Next Follow-up Date</label>
                          <input
                            type="date"
                            value={addLeadForm.nextFollowUp ?? ''}
                            onChange={(e) => setAddLeadForm((p) => ({ ...p, nextFollowUp: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Assigned To</label>
                          <select
                            value={addLeadForm.assignedToId ?? ''}
                            onChange={(e) => {
                              const selectedRecruiter = recruiters.find(r => r.id === e.target.value);
                              setAddLeadForm((p) => ({ 
                                ...p, 
                                assignedToId: e.target.value,
                                assignedToName: selectedRecruiter ? `${selectedRecruiter.firstName} ${selectedRecruiter.lastName}` : ''
                              }));
                            }}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                            disabled={loadingRecruiters}
                          >
                            <option value="">Select recruiter</option>
                            {recruiters.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.firstName} {r.lastName}
                              </option>
                            ))}
                          </select>
                          {loadingRecruiters && (
                            <p className="text-xs text-slate-500 mt-1">Loading recruiters...</p>
                          )}
                        </div>
                      </div>
                    )}
                  </section>
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!addLeadForm.companyName.trim() || !addLeadForm.contactPerson.trim() || !addLeadForm.email.trim()) return;
                        
                        try {
                          const companyLinks = (addLeadForm.website ?? '')
                            .split('\n')
                            .map((item) => item.trim())
                            .filter(Boolean);

                          const createData: CreateLeadData = {
                            // Company Information
                            companyName: addLeadForm.companyName.trim(),
                            sector: addLeadForm.industry?.trim() || undefined,
                            industry: addLeadForm.industry?.trim() || undefined,
                            teamName: addLeadForm.companySize?.trim() || undefined,
                            companySize: addLeadForm.companySize?.trim() || undefined,
                            website: addLeadForm.website?.trim() || undefined,
                            companyLinks: companyLinks.length ? companyLinks : undefined,
                            linkedIn: addLeadForm.linkedIn?.trim() || undefined,
                            location: addLeadForm.location?.trim() || undefined,
                            // Contact Person
                            directorName: addLeadForm.contactPerson.trim(),
                            contactPerson: addLeadForm.contactPerson.trim(),
                            designation: addLeadForm.designation?.trim() || undefined,
                            email: addLeadForm.email.trim(),
                            phone: addLeadForm.phone?.trim() || undefined,
                            country: addLeadForm.country?.trim() || undefined,
                            city: addLeadForm.city?.trim() || undefined,
                            // Lead Details
                            type: addLeadForm.type || 'Company',
                            source: addLeadForm.source || 'Website',
                            campaignName: addLeadForm.campaignName?.trim() || undefined,
                            campaignLink: addLeadForm.campaignLink?.trim() || undefined,
                            referralName: addLeadForm.referralName?.trim() || undefined,
                            sourceWebsiteUrl: addLeadForm.sourceWebsiteUrl?.trim() || undefined,
                            sourceLinkedInUrl: addLeadForm.sourceLinkedInUrl?.trim() || undefined,
                            sourceEmail: addLeadForm.sourceEmail?.trim() || undefined,
                            otherDetails: Array.isArray(addLeadForm.otherDetails) && addLeadForm.otherDetails.length
                              ? addLeadForm.otherDetails
                              : undefined,
                            status: addLeadForm.status || 'New',
                            priority: addLeadForm.priority || 'Medium',
                            servicesNeeded: addLeadForm.interestedNeeds?.trim() || undefined,
                            interestedNeeds: addLeadForm.interestedNeeds?.trim() || undefined,
                            expectedBusinessValue: addLeadForm.notes?.trim() || undefined,
                            notes: addLeadForm.notes?.trim() || undefined,
                            lastFollowUp: addLeadForm.lastFollowUp || undefined,
                            nextFollowUp: addLeadForm.nextFollowUp || undefined,
                            assignedToId: addLeadForm.assignedToId || undefined,
                          };

                          await apiCreateLead(createData);
                          
                          // Call the parent handler to refresh the list
                          onAddLead?.(addLeadForm);
                          
                          // Reset form
                          setAddLeadForm({
                            companyName: '',
                            industry: '',
                            companySize: '',
                            website: '',
                            linkedIn: '',
                            location: '',
                            contactPerson: '',
                            designation: '',
                            email: '',
                            phone: '',
                            country: '',
                            city: '',
                            type: 'Company',
                            source: 'Website',
                            campaignName: '',
                            campaignLink: '',
                            referralName: '',
                            sourceWebsiteUrl: '',
                            sourceLinkedInUrl: '',
                            sourceEmail: '',
                            otherDetails: [],
                            assignedToName: '',
                            assignedToId: '',
                            status: 'New',
                            priority: 'Medium',
                            interestedNeeds: '',
                            notes: '',
                            lastFollowUp: '',
                            nextFollowUp: '',
                          });
                        } catch (error: any) {
                          console.error('Failed to create lead:', error);
                          alert(error.message || 'Failed to create lead');
                        }
                      }}
                      disabled={!addLeadForm.companyName.trim() || !addLeadForm.contactPerson.trim() || !addLeadForm.email.trim()}
                      className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                      <Plus size={16} />
                      Create Lead
                    </button>
                  </div>
                </div>
              ) : activeTab === 'overview' ? (
                <div className="space-y-4">
                  <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-100">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lead Information</h4>
                    </div>
                    <div className="p-5 space-y-4">
                      {!overviewEditMode ? (
                        <>
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div><FieldRow label="Company *" value={lead?.companyName ?? ''} /></div>
                            <div><FieldRow label="Company Links" value={lead?.website ?? ''} href={!!lead?.website} /></div>
                            <div><FieldRow label="Director Name *" value={lead?.contactPerson ?? ''} /></div>
                            <div><FieldRow label="Team Name" value={lead?.companySize ?? ''} /></div>
                            <div><FieldRow label="Email *" value={lead?.email ?? ''} href /></div>
                            <div><FieldRow label="Phone" value={lead?.phone ?? ''} /></div>
                            <div><FieldRow label="Location" value={lead?.location ?? ''} /></div>
                            <div><FieldRow label="City" value={lead?.city ?? ''} /></div>
                            <div><FieldRow label="Country" value={lead?.country ?? ''} /></div>
                            <div><FieldRow label="Sector" value={lead?.industry ?? ''} /></div>
                            <div><FieldRow label="Status" value={lead?.status ?? ''} /></div>
                            <div><FieldRow label="Interest Level" value={lead?.priority ?? ''} /></div>
                            <div><FieldRow label="Next Follow-up Date" value={lead?.nextFollowUp ?? ''} /></div>
                            <div><FieldRow label="Assigned To" value={lead?.assignedTo?.name ?? ''} /></div>
                          </div>
                          <div>
                            <FieldRow label="Services Needed" value={lead?.interestedNeeds ?? ''} />
                          </div>
                          <div>
                            <FieldRow label="Expected Business Value" value={lead?.notes ?? ''} />
                          </div>
                          {Array.isArray(lead?.otherDetails) && lead.otherDetails.length ? (
                            <div>
                              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Other Details</p>
                                <div className="space-y-2">
                                  {lead.otherDetails.map((item, index) => (
                                    <div key={`${item.label}-${index}`} className="text-sm">
                                      <span className="font-semibold text-slate-900">{item.label}:</span>{' '}
                                      <span className="text-slate-600">{item.value}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Company *</label>
                              <input value={overviewEditForm.companyName} onChange={(e) => setOverviewEditForm((p) => ({ ...p, companyName: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Company Links</label>
                              <input value={overviewEditForm.website} onChange={(e) => setOverviewEditForm((p) => ({ ...p, website: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Director Name *</label>
                              <input value={overviewEditForm.contactPerson} onChange={(e) => setOverviewEditForm((p) => ({ ...p, contactPerson: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Team Name</label>
                              <input value={overviewEditForm.companySize} onChange={(e) => setOverviewEditForm((p) => ({ ...p, companySize: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Email *</label>
                              <input type="email" value={overviewEditForm.email} onChange={(e) => setOverviewEditForm((p) => ({ ...p, email: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Phone</label>
                              <input value={overviewEditForm.phone} onChange={(e) => setOverviewEditForm((p) => ({ ...p, phone: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Location</label>
                              <input value={overviewEditForm.location} onChange={(e) => setOverviewEditForm((p) => ({ ...p, location: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">City</label>
                              <input value={overviewEditForm.city} onChange={(e) => setOverviewEditForm((p) => ({ ...p, city: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Country</label>
                              <input value={overviewEditForm.country} onChange={(e) => setOverviewEditForm((p) => ({ ...p, country: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Sector</label>
                              <input value={overviewEditForm.industry} onChange={(e) => setOverviewEditForm((p) => ({ ...p, industry: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status</label>
                              <select value={overviewEditForm.status} onChange={(e) => setOverviewEditForm((p) => ({ ...p, status: e.target.value as LeadStatus }))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white">
                                <option value="New">New</option>
                                <option value="Contacted">Contacted</option>
                                <option value="Qualified">Qualified</option>
                                <option value="Converted">Converted</option>
                                <option value="Lost">Lost</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Interest Level</label>
                              <select
                                value={overviewEditForm.priority}
                                onChange={(e) => setOverviewEditForm((p) => ({ ...p, priority: e.target.value as 'High' | 'Medium' | 'Low' }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                              >
                                <option value="High">High</option>
                                <option value="Medium">Medium</option>
                                <option value="Low">Low</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Next Follow-up Date</label>
                              <input value={overviewEditForm.nextFollowUp} onChange={(e) => setOverviewEditForm((p) => ({ ...p, nextFollowUp: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Assigned To</label>
                              <select
                                value={overviewEditForm.assignedToId}
                                onChange={(e) => {
                                  const selectedRecruiter = recruiters.find((r) => r.id === e.target.value);
                                  setOverviewEditForm((p) => ({
                                    ...p,
                                    assignedToId: e.target.value,
                                    leadOwner: selectedRecruiter ? `${selectedRecruiter.firstName} ${selectedRecruiter.lastName}` : '',
                                  }));
                                }}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                                disabled={loadingRecruiters}
                              >
                                <option value="">Select recruiter</option>
                                {recruiters.map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.firstName} {r.lastName}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Services Needed</label>
                              <textarea
                                value={overviewEditForm.interestedNeeds}
                                onChange={(e) => setOverviewEditForm((p) => ({ ...p, interestedNeeds: e.target.value }))}
                                rows={3}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                              />
                            </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Expected Business Value</label>
                            <textarea
                              value={overviewEditForm.notes}
                              onChange={(e) => setOverviewEditForm((p) => ({ ...p, notes: e.target.value }))}
                              rows={3}
                              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Other Details</label>
                            <textarea
                              value={overviewEditForm.otherDetailsText}
                              onChange={(e) => setOverviewEditForm((p) => ({ ...p, otherDetailsText: e.target.value }))}
                              rows={4}
                              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                              placeholder="One per line, for example: Budget: 50000"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </section>
                  <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-100">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quick Actions</h4>
                    </div>
                    <div className="p-5">
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
                          <MessageCircle size={16} className="text-slate-600" />
                          Send WhatsApp
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowScheduleFollowUpForm(true)}
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
                    </div>
                  </section>
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
                            <FieldRow label="Industry" value={lead?.industry ?? ''} />
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
                              <input
                                value={overviewEditForm.industry}
                                onChange={(e) => setOverviewEditForm((p) => ({ ...p, industry: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
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
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Location</label>
                              <input
                                value={overviewEditForm.location}
                                onChange={(e) => setOverviewEditForm((p) => ({ ...p, location: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              />
                            </div>
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
                            <FieldRow label="Contact Name" value={lead?.contactPerson ?? ''} />
                            <FieldRow label="Designation" value={lead?.designation ?? ''} />
                            <FieldRow label="Email" value={lead?.email ?? ''} href />
                            <FieldRow label="Phone" value={lead?.phone ?? ''} />
                            <FieldRow label="Country" value={lead?.country ?? ''} />
                            <FieldRow label="City" value={lead?.city ?? ''} />
                          </>
                        ) : (
                          <div className="space-y-4 pt-2">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Contact Name</label>
                              <input
                                value={overviewEditForm.contactPerson}
                                onChange={(e) => setOverviewEditForm((p) => ({ ...p, contactPerson: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Designation</label>
                              <input
                                value={overviewEditForm.designation}
                                onChange={(e) => setOverviewEditForm((p) => ({ ...p, designation: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Email</label>
                              <input
                                type="email"
                                value={overviewEditForm.email}
                                onChange={(e) => setOverviewEditForm((p) => ({ ...p, email: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Phone</label>
                              <input
                                value={overviewEditForm.phone}
                                onChange={(e) => setOverviewEditForm((p) => ({ ...p, phone: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              />
                            </div>
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
                            <FieldRow label="Lead Owner" value={lead?.assignedTo?.name ?? ''} />
                            <FieldRow label="Lead Status" value={lead?.status ?? ''} />
                            <FieldRow label="Created Date" value={lead?.createdDate ?? ''} />
                            <FieldRowDateTime label="Last Contacted" value={lead?.lastFollowUp} />
                            <FieldRowDateTime label="Next Follow-up" value={lead?.nextFollowUp} />
                          </>
                        ) : (
                          <div className="space-y-4 pt-2">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Lead Source</label>
                              <select
                                value={overviewEditForm.source}
                                onChange={(e) => {
                                  const source = e.target.value as LeadSource;
                                  setOverviewEditForm((p) => ({
                                    ...p,
                                    source,
                                    campaignName: source === 'Campaign' ? p.campaignName : '',
                                    campaignLink: source === 'Campaign' ? p.campaignLink : '',
                                    referralName: source === 'Referral' ? p.referralName : '',
                                    sourceWebsiteUrl: source === 'Website' ? p.sourceWebsiteUrl : '',
                                    sourceLinkedInUrl: source === 'LinkedIn' ? p.sourceLinkedInUrl : '',
                                    sourceEmail: source === 'Email' ? p.sourceEmail : '',
                                  }));
                                }}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                              >
                                {(['Website', 'LinkedIn', 'Email', 'Referral', 'Campaign'] as const).map((s) => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                            </div>
                            {overviewEditForm.source === 'Website' && (
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Website Link</label>
                                <input
                                  value={overviewEditForm.sourceWebsiteUrl}
                                  onChange={(e) => setOverviewEditForm((p) => ({ ...p, sourceWebsiteUrl: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                              </div>
                            )}
                            {overviewEditForm.source === 'LinkedIn' && (
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">LinkedIn URL</label>
                                <input
                                  value={overviewEditForm.sourceLinkedInUrl}
                                  onChange={(e) => setOverviewEditForm((p) => ({ ...p, sourceLinkedInUrl: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                              </div>
                            )}
                            {overviewEditForm.source === 'Email' && (
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Source Email</label>
                                <input
                                  type="email"
                                  value={overviewEditForm.sourceEmail}
                                  onChange={(e) => setOverviewEditForm((p) => ({ ...p, sourceEmail: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                              </div>
                            )}
                            {overviewEditForm.source === 'Referral' && (
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Referral Name</label>
                                <input
                                  value={overviewEditForm.referralName}
                                  onChange={(e) => setOverviewEditForm((p) => ({ ...p, referralName: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                              </div>
                            )}
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Campaign Name</label>
                              <input
                                value={overviewEditForm.campaignName}
                                onChange={(e) => setOverviewEditForm((p) => ({ ...p, campaignName: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              />
                            </div>
                            {overviewEditForm.source === 'Campaign' && (
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Campaign Link</label>
                                <input
                                  value={overviewEditForm.campaignLink}
                                  onChange={(e) => setOverviewEditForm((p) => ({ ...p, campaignLink: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                              </div>
                            )}
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Lead Owner</label>
                              <input
                                value={overviewEditForm.leadOwner}
                                onChange={(e) => setOverviewEditForm((p) => ({ ...p, leadOwner: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Lead Status</label>
                              <select
                                value={overviewEditForm.status}
                                onChange={(e) => setOverviewEditForm((p) => ({ ...p, status: e.target.value as LeadStatus }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                              >
                                {(['New', 'Contacted', 'Qualified', 'Converted', 'Lost'] as const).map((s) => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Created Date</label>
                              <input
                                value={overviewEditForm.createdDate}
                                onChange={(e) => setOverviewEditForm((p) => ({ ...p, createdDate: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Last Contacted</label>
                              <input
                                value={overviewEditForm.lastFollowUp}
                                onChange={(e) => setOverviewEditForm((p) => ({ ...p, lastFollowUp: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Next Follow-up</label>
                              <input
                                value={overviewEditForm.nextFollowUp}
                                onChange={(e) => setOverviewEditForm((p) => ({ ...p, nextFollowUp: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </section>

                  </div>
                </div>
              ) : activeTab === 'activities' ? (
                <div className="space-y-6">
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
                                              <MessageCircle size={14} />
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
                    availableTags={['HR', 'Finance', 'Contract', 'Feedback']}
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
                  const uploadsBase = (typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1') : 'http://localhost:5000/api/v1').replace(/\/api\/v1\/?$/, '');
                  const toFileHref = (fileUrl?: string | null) => buildFileHref(fileUrl, uploadsBase);
                  const formatUploadDate = (d: string) => {
                    if (!d) return '—';
                    try {
                      const date = new Date(d);
                      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
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
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            try {
                              await uploadFile(f, 'Other');
                              e.target.value = '';
                            } catch (_) {}
                          }
                        }}
                      />
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <button
                            type="button"
                            disabled={!lead?.id || filesUploading}
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Upload size={16} /> {filesUploading ? 'Uploading…' : 'Upload File'}
                          </button>
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
              ) : null}
            </div>
          </div>
        </motion.div>

        {/* Duplicate lead notification — fixed bottom-right of screen, auto-dismiss 5s. Triggers (for later): Duplicate email, Duplicate phone, Duplicate company. */}
        <AnimatePresence>
          <AnimatePresence>
            {showAiLeadDrawer && addLeadMode && (
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed right-0 top-0 z-[70] h-full w-1/2 bg-white shadow-2xl border-l border-slate-200 flex flex-col"
              >
                <div className="border-b border-slate-200 bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">AI Drawer</p>
                      <h3 className="mt-1 text-lg font-bold text-slate-900">Generate Company Lead With AI</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Share the lead details once. If key lead information is missing, the drawer will ask only for that. Then AI will optimize the data, fill the fields, and create the lead directly.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAiLeadDrawer(false)}
                      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                      aria-label="Close AI drawer"
                    >
                      <XCircle size={20} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-slate-50/40 p-5">
                  <div className="space-y-4">
                    {leadAiMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className="flex max-w-[92%] items-start gap-3">
                          {message.role === 'ai' ? (
                            <>
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white shadow-sm">
                                AI
                              </div>
                              <div className="max-w-[88%] rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                                {message.content}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="max-w-[88%] rounded-[22px] bg-blue-600 px-4 py-3 text-sm text-white shadow-sm">
                                {message.content}
                              </div>
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 shadow-sm">
                                You
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}

                    {leadAiError ? (
                      <div className="flex justify-start">
                        <div className="flex max-w-[92%] items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white shadow-sm">
                            AI
                          </div>
                          <div className="max-w-[88%] rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
                            {leadAiError}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {leadAiSummaryReady ? (
                      <div className="flex justify-start">
                        <div className="flex max-w-[92%] items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white shadow-sm">
                            AI
                          </div>
                          <div className="w-full max-w-[88%] rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Company</p>
                                <p className="mt-2 text-sm font-medium text-slate-900">{addLeadForm.companyName || '—'}</p>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Director Name</p>
                                <p className="mt-2 text-sm font-medium text-slate-900">{addLeadForm.contactPerson || '—'}</p>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Email</p>
                                <p className="mt-2 text-sm font-medium text-slate-900">{addLeadForm.email || '—'}</p>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Phone</p>
                                <p className="mt-2 text-sm font-medium text-slate-900">{addLeadForm.phone || '—'}</p>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Location</p>
                                <p className="mt-2 text-sm font-medium text-slate-900">{addLeadForm.location || '—'}</p>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Services Needed</p>
                                <p className="mt-2 text-sm font-medium text-slate-900">{addLeadForm.interestedNeeds || '—'}</p>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">City</p>
                                <p className="mt-2 text-sm font-medium text-slate-900">{addLeadForm.city || '—'}</p>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Country</p>
                                <p className="mt-2 text-sm font-medium text-slate-900">{addLeadForm.country || '—'}</p>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Sector</p>
                                <p className="mt-2 text-sm font-medium text-slate-900">{addLeadForm.industry || '—'}</p>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Interest Level</p>
                                <p className="mt-2 text-sm font-medium text-slate-900">{addLeadForm.priority || '—'}</p>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Next Follow-up</p>
                                <p className="mt-2 text-sm font-medium text-slate-900">{addLeadForm.nextFollowUp || '—'}</p>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Expected Business Value</p>
                                <p className="mt-2 text-sm font-medium text-slate-900">{addLeadForm.notes || '—'}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}

                  </div>
                </div>

                <div className="border-t border-slate-200 bg-white px-5 py-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={leadAiPrompt}
                      onChange={(e) => setLeadAiPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && !leadAiGenerating) {
                          e.preventDefault();
                          void handleLeadAiGenerate();
                        }
                      }}
                      placeholder="Paste all lead details here and AI will fill the form..."
                      className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      disabled={leadAiGenerating}
                    />
                    <button
                      type="button"
                      onClick={() => void handleLeadAiGenerate()}
                      className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-500 text-white transition-colors hover:bg-blue-600"
                      aria-label="Send lead prompt"
                      disabled={leadAiGenerating}
                    >
                      <SendHorizontal size={18} />
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-500">
                      {leadAiGenerating
                        ? 'AI is analyzing the lead and preparing creation...'
                        : leadAiPendingFields.length > 0
                          ? `Waiting for: ${leadAiPendingFields.map((field) => LEAD_AI_REQUIRED_FIELD_LABELS[field]).join(', ')}`
                          : 'Send one message and AI will create the lead after filling the required fields'}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAiLeadDrawer(false)}
                        className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        Close
                      </button>
                      {leadAiSummaryReady ? (
                        <button
                          type="button"
                          onClick={finalizeLeadAiDrawer}
                          className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                        >
                          Review Filled Lead
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {showDuplicateNotification && (
            <motion.div
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 26, stiffness: 200 }}
              className="fixed bottom-8 right-8 z-[60] w-full max-w-sm"
            >
              <div className="rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                {/* Header — warning accent */}
                <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/80">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                      <AlertTriangle size={16} className="text-amber-600" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 truncate">Possible Duplicate Found</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDuplicateNotification(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
                    aria-label="Dismiss"
                  >
                    <XCircle size={16} />
                  </button>
                </div>
                {/* Content */}
                <div className="px-4 py-3 space-y-0 border-b border-slate-100">
                  <div className="flex flex-col gap-0.5 py-2 border-b border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Company</p>
                    <p className="text-xs font-medium text-slate-900 truncate">{lead?.companyName ?? 'TechNova Solutions'}</p>
                  </div>
                  <div className="flex flex-col gap-0.5 py-2 border-b border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contact</p>
                    <p className="text-xs font-medium text-slate-900 truncate">{lead?.contactPerson ?? 'David Miller'}</p>
                  </div>
                  <div className="flex flex-col gap-0.5 py-2 border-b border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Created by</p>
                    <p className="text-xs font-medium text-slate-900 truncate">{lead?.assignedTo?.name ?? 'Alex Thompson'}</p>
                  </div>
                  <div className="flex flex-col gap-0.5 py-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</p>
                    <p className="text-xs font-medium text-slate-900">{lead?.createdDate ?? 'Jan 10 2026'}</p>
                  </div>
                </div>
                {/* Actions */}
                <div className="p-4 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDuplicateNotification(false)}
                    className="w-full py-2 px-3 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors"
                  >
                    View Existing
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={openMergeLeadsForm}
                      className="flex-1 py-2 px-3 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      Merge Leads
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDuplicateNotification(false)}
                      className="flex-1 py-2 px-3 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      Create Anyway
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
}
