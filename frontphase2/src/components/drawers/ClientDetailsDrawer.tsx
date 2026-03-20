'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MoreVertical,
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
  Archive,
  Trash2,
  Globe,
  MapPin,
  Calendar,
  Clock,
  TrendingUp,
  Heart,
  CalendarPlus,
  FileCheck,
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
  User,
  ArrowRight,
  UserCheck,
  Shield,
  Download,
  Send,
  DollarSign,
  FilePlus,
  Pin,
  Pencil,
  Receipt,
  GripVertical,
  Plus,
  Bell,
} from 'lucide-react';
import type { Client, ClientStage, ClientHealthStatus, ClientContact, ClientJob, JobStatus, ClientPipelineCandidate, PipelineStageName, ClientPlacement, PlacementStatus, ClientInvoice, InvoiceStatus, ClientActivityItem, ActivityFilterType, ClientNote, NoteTag, ClientFile, ClientFileType } from '@/app/client/types';
import { ImageWithFallback } from '../ImageWithFallback';
import { useFiles } from '../../hooks/useFiles';
import { ScheduleMeetingForm } from '../ScheduleMeetingForm';
import { NotesService } from '../NotesService';
import { apiUpdateClient, apiCreateClient, apiGetUsers, apiCreateJob, apiGetJobs, apiGetContacts, apiCreateContact, apiFetch, apiGetClientActivities, apiGetClientScheduledMeetings, apiCreateScheduledMeeting, apiUpdateScheduledMeeting, apiDeleteScheduledMeeting, type BackendUser, type CreateJobData, type BackendJob, type BackendContact, type CreateContactData, type BackendClient, type ScheduledMeeting } from '../../lib/api';

const HEALTH_STYLES: Record<ClientHealthStatus, { bg: string; text: string; label: string }> = {
  Good: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Good' },
  'Needs attention': { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Needs attention' },
  'At risk': { bg: 'bg-red-50', text: 'text-red-700', label: 'At risk' },
};

const FieldRow = ({ label, value, href }: { label: string; value: string; href?: boolean }) => (
  <div className="flex flex-col gap-0.5 py-2 border-b border-slate-100 last:border-0">
    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
    <p className={`text-sm font-medium text-slate-900 ${href ? 'text-blue-600 hover:underline cursor-pointer truncate' : ''}`}>
      {value || '—'}
    </p>
  </div>
);

const STAGE_STYLES: Record<ClientStage, string> = {
  Active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Prospect: 'bg-blue-100 text-blue-700 border-blue-200',
  'On Hold': 'bg-amber-100 text-amber-700 border-amber-200',
  Inactive: 'bg-slate-100 text-slate-600 border-slate-200',
  'Hot Clients 🔥': 'bg-red-100 text-red-700 border-red-200',
};

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

const NOTE_TAG_STYLES: Record<NoteTag, string> = {
  HR: 'bg-blue-100 text-blue-700 border-blue-200',
  Finance: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Contract: 'bg-amber-100 text-amber-700 border-amber-200',
  Feedback: 'bg-violet-100 text-violet-700 border-violet-200',
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
  onClose: () => void;
  onAddJob?: (clientId: string) => void;
  onMessage?: (clientId: string) => void;
  onDelete?: (clientId: string) => void;
  onClientCreated?: () => void;
  onJobCreated?: () => void;
}

export function ClientDetailsDrawer({
  client,
  isAddMode: propIsAddMode = false,
  onClose,
  onAddJob,
  onMessage,
  onDelete,
  onClientCreated,
  onJobCreated,
}: ClientDetailsDrawerProps) {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'contacts' | 'jobs' | 'pipeline' | 'placements' | 'billing' | 'activity' | 'notes' | 'files' | 'schedule'
  >('overview');
  const [fullClientData, setFullClientData] = useState<Client | null>(client);
  
  // Fetch full client data when drawer opens to ensure all fields are available
  useEffect(() => {
    if (client?.id && !propIsAddMode) {
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
            // Map BackendClient to Client format
            const statusMap: Record<string, Client['stage']> = {
              'ACTIVE': 'Active',
              'PROSPECT': 'Prospect',
              'ON_HOLD': 'On Hold',
              'INACTIVE': 'Inactive',
            };
            const mappedClient: Client = {
              ...client,
              name: response.data.companyName,
              industry: response.data.industry || client.industry || 'Not specified',
              location: response.data.location || client.location || 'Not specified',
              companySize: response.data.companySize || client.companySize,
              hiringLocations: response.data.hiringLocations || client.hiringLocations,
              website: response.data.website || client.website,
              linkedin: response.data.linkedin || client.linkedin,
              timezone: response.data.timezone || client.timezone,
              clientSince: response.data.clientSince ? new Date(response.data.clientSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : client.clientSince,
              priority: response.data.priority as Client['priority'] || client.priority,
              sla: response.data.sla || client.sla,
              stage: statusMap[response.data.status] || client.stage,
            };
            
            // Log the mapped client data
            console.log('\n=== MAPPED CLIENT DATA (Frontend) ===');
            console.log(JSON.stringify({
              id: mappedClient.id,
              name: mappedClient.name,
              industry: mappedClient.industry,
              companySize: mappedClient.companySize,
              website: mappedClient.website,
              linkedin: mappedClient.linkedin,
              location: mappedClient.location,
              hiringLocations: mappedClient.hiringLocations,
              timezone: mappedClient.timezone,
              priority: mappedClient.priority,
              sla: mappedClient.sla,
            }, null, 2));
            
            setFullClientData(mappedClient);
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
  }, [client?.id, propIsAddMode]);
  
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState<Record<string, boolean>>({
    companySnapshot: false,
    contactPerson: false,
    relationship: false,
    performance: false,
    health: false,
  });
  const isAddMode = propIsAddMode;
  const [overviewEditMode, setOverviewEditMode] = useState(isAddMode);
  const [overviewEditForm, setOverviewEditForm] = useState({
    companyName: '',
    industry: '',
    companySize: '',
    website: '',
    linkedin: '',
    location: '',
    hiringLocations: '',
    timezone: '',
    priority: '',
    sla: '',
    status: 'PROSPECT' as 'ACTIVE' | 'PROSPECT' | 'ON_HOLD' | 'INACTIVE',
    assignedToId: '',
  });
  const [selectedContact, setSelectedContact] = useState<ClientContact | null>(null);
  const [showAddContactForm, setShowAddContactForm] = useState(false);
  const [addContactDeptOpen, setAddContactDeptOpen] = useState(false);
  const [users, setUsers] = useState<BackendUser[]>([]);
  const [assignedToDropdownOpen, setAssignedToDropdownOpen] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [stageDropdownOpen, setStageDropdownOpen] = useState(false);
  const [clientJobs, setClientJobs] = useState<ClientJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [clientContacts, setClientContacts] = useState<ClientContact[]>([]);
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

  const ADD_CONTACT_DEPARTMENTS = ['HR', 'Hiring Manager', 'Finance', 'Other'];

  const openAddContactForm = () => {
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
    setShowAddContactForm(true);
    setAddContactDeptOpen(false);
  };

  const [showAddJobForm, setShowAddJobForm] = useState(false);
  const [addJobPriorityOpen, setAddJobPriorityOpen] = useState(false);
  const [addJobHiringManagerOpen, setAddJobHiringManagerOpen] = useState(false);
  const [addJobForm, setAddJobForm] = useState({
    jobTitle: '',
    department: '',
    location: '',
    numberOfPositions: '',
    priority: '' as string,
    hiringManagerId: '' as string,
    expectedClosureDate: '',
    jobDescription: '',
    jdFileName: '',
  });

  const ADD_JOB_PRIORITIES = ['Low', 'Medium', 'High'];

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

  const openAddJobForm = () => {
    setAddJobForm({
      jobTitle: '',
      department: '',
      location: '',
      numberOfPositions: '',
      priority: '',
      hiringManagerId: '',
      expectedClosureDate: '',
      jobDescription: '',
      jdFileName: '',
    });
    setShowAddJobForm(true);
    setAddJobPriorityOpen(false);
    setAddJobHiringManagerOpen(false);
  };

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
  const { files: clientFiles, loading: filesLoading, uploading: filesUploading, error: filesError, uploadFile, deleteFile } = useFiles('client', client?.id);

  const [showChangeStageForm, setShowChangeStageForm] = useState(false);
  const [changeStageDropdownOpen, setChangeStageDropdownOpen] = useState(false);
  const [changeStageReasonDropdownOpen, setChangeStageReasonDropdownOpen] = useState(false);
  const [changeStageForm, setChangeStageForm] = useState<{ stage: ClientStage; reason: string }>({ stage: 'Active', reason: '' });

  const CLIENT_STAGES: ClientStage[] = ['Active', 'Prospect', 'On Hold', 'Inactive', 'Hot Clients 🔥'];
  const STAGE_REASONS = ['Hiring paused', 'No response', 'Contract ended', 'Payment issue', 'Other'];
  const needsReason = changeStageForm.stage === 'On Hold' || changeStageForm.stage === 'Inactive';

  const openChangeStageForm = () => {
    setMoreMenuOpen(false);
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
    setMoreMenuOpen(false);
    setShowArchiveClientForm(true);
  };

  const closeArchiveClientForm = () => setShowArchiveClientForm(false);

  const [showDeleteClientForm, setShowDeleteClientForm] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');

  const openDeleteClientForm = () => {
    setMoreMenuOpen(false);
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

  const startOverviewEdit = async () => {
    if (!client) return;
    
    // Fetch full client data from backend to get all fields including linkedin
    let fetchedClient: BackendClient | null = null;
    let assignedToId = '';
    try {
      const response = await apiFetch<BackendClient>(`/clients/${client.id}`, {
        method: 'GET',
        auth: true,
      });
      fetchedClient = response.data;
      assignedToId = fetchedClient?.assignedTo?.id || '';
    } catch (error) {
      console.error('Failed to fetch client details:', error);
      // Fallback: try to find user by name if available
      if (client.owner?.name && users.length > 0) {
        const matchedUser = users.find(u => u.name === client.owner?.name);
        if (matchedUser) {
          assignedToId = matchedUser.id;
        }
      }
    }
    
    // Use fetched client data if available, otherwise fall back to prop client
    const clientData = fetchedClient || client;
    
    const statusMap: Record<string, 'ACTIVE' | 'PROSPECT' | 'ON_HOLD' | 'INACTIVE'> = {
      'Active': 'ACTIVE',
      'Prospect': 'PROSPECT',
      'On Hold': 'ON_HOLD',
      'Inactive': 'INACTIVE',
      'Hot Clients 🔥': 'ACTIVE', // Hot Clients maps to ACTIVE status
    };
    
    // Map backend status to frontend stage if using fetched client
    let clientStage = client.stage;
    if (fetchedClient) {
      const reverseStatusMap: Record<string, Client['stage']> = {
        'ACTIVE': 'Active',
        'PROSPECT': 'Prospect',
        'ON_HOLD': 'On Hold',
        'INACTIVE': 'Inactive',
      };
      clientStage = reverseStatusMap[fetchedClient.status] || 'Prospect';
    }
    
    setOverviewEditForm({
      companyName: fetchedClient?.companyName || client.name || '',
      industry: fetchedClient?.industry || client.industry || '',
      companySize: fetchedClient?.companySize || client.companySize || '',
      website: fetchedClient?.website || client.website || '',
      linkedin: fetchedClient?.linkedin || client.linkedin || '',
      location: fetchedClient?.location || client.location || '',
      hiringLocations: fetchedClient?.hiringLocations || client.hiringLocations || '',
      timezone: fetchedClient?.timezone || client.timezone || '',
      priority: fetchedClient?.priority || client.priority || '',
      sla: fetchedClient?.sla || client.sla || '',
      status: statusMap[clientStage] || 'PROSPECT',
      assignedToId: assignedToId,
    });
    setOverviewEditMode(true);
    setMoreMenuOpen(false);
    // Open all sections for editing
    setOverviewOpen({
      companySnapshot: true,
      contactPerson: true,
      relationship: true,
      performance: true,
      health: true,
    });
  };

  const cancelOverviewEdit = () => {
    setOverviewEditMode(false);
  };

  const saveOverviewEdit = async () => {
    if (isAddMode) {
      // Create new client
      if (!overviewEditForm.companyName.trim()) {
        alert('Company name is required');
        return;
      }
      
      try {
        const createData = {
          companyName: overviewEditForm.companyName,
          industry: overviewEditForm.industry || undefined,
          companySize: overviewEditForm.companySize || undefined,
          website: overviewEditForm.website || undefined,
          linkedin: overviewEditForm.linkedin || undefined,
          location: overviewEditForm.location || undefined,
          hiringLocations: overviewEditForm.hiringLocations || undefined,
          timezone: overviewEditForm.timezone || undefined,
          priority: overviewEditForm.priority || undefined,
          sla: overviewEditForm.sla || undefined,
          status: overviewEditForm.status || 'PROSPECT',
          assignedToId: overviewEditForm.assignedToId || undefined,
        };

        await apiCreateClient(createData);
        onClientCreated?.();
        onClose();
      } catch (error: any) {
        console.error('Failed to create client:', error);
        alert(error.message || 'Failed to create client');
      }
    } else {
      // Update existing client
      if (!client) return;
      
      try {
        const updateData: any = {
          companyName: overviewEditForm.companyName,
        };
        
        // Only include fields that have values or are being cleared
        if (overviewEditForm.industry !== undefined) updateData.industry = overviewEditForm.industry || null;
        if (overviewEditForm.companySize !== undefined) updateData.companySize = overviewEditForm.companySize || null;
        if (overviewEditForm.website !== undefined) updateData.website = overviewEditForm.website || null;
        if (overviewEditForm.linkedin !== undefined) updateData.linkedin = overviewEditForm.linkedin || null;
        if (overviewEditForm.location !== undefined) updateData.location = overviewEditForm.location || null;
        if (overviewEditForm.hiringLocations !== undefined) updateData.hiringLocations = overviewEditForm.hiringLocations || null;
        if (overviewEditForm.timezone !== undefined) updateData.timezone = overviewEditForm.timezone || null;
        if (overviewEditForm.priority !== undefined) updateData.priority = overviewEditForm.priority || null;
        if (overviewEditForm.sla !== undefined) updateData.sla = overviewEditForm.sla || null;
        if (overviewEditForm.status !== undefined) updateData.status = overviewEditForm.status;
        if (overviewEditForm.assignedToId !== undefined) {
          updateData.assignedToId = overviewEditForm.assignedToId || null;
        }

        console.log('Updating client with data:', updateData);
        await apiUpdateClient(client.id, updateData);
        setOverviewEditMode(false);
        
        // Refresh activities if Activity tab is open
        if (activeTab === 'activity') {
          const response = await apiGetClientActivities(client.id);
          const activities = Array.isArray(response.data) ? response.data : [];
          
          const mappedActivities: ClientActivityItem[] = activities.map((activity: any) => {
            const categoryMap: Record<string, ActivityFilterType> = {
              'General': 'Jobs',
              'Jobs': 'Jobs',
              'Candidates': 'Candidates',
              'Interviews': 'Interviews',
              'Billing': 'Billing',
              'Notes': 'Notes',
              'Files': 'Files',
              'Contacts': 'Jobs',
            };

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
              dateDisplay = activityDate.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: activityDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
              });
            }
            
            const timeDisplay = activityDate.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit',
              hour12: true 
            });
            
            const timestamp = `${dateDisplay} at ${timeDisplay}`;

            return {
              id: activity.id,
              category: (categoryMap[activity.category] || 'Jobs') as Exclude<ActivityFilterType, 'All'>,
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
        alert(error.message || 'Failed to update client');
      }
    }
  };

  // Fetch users for assignment dropdown
  useEffect(() => {
    const fetchUsers = async () => {
      setLoadingUsers(true);
      try {
        const response = await apiGetUsers({ isActive: true, limit: 100 });
        const usersList = Array.isArray(response.data) 
          ? response.data 
          : (response.data as any)?.data || [];
        setUsers(usersList);
      } catch (error) {
        console.error('Failed to fetch users:', error);
        setUsers([]);
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, []);

  // Fetch client activities whenever client changes
  useEffect(() => {
    const fetchActivities = async () => {
      if (!client?.id) {
        setClientActivities([]);
        return;
      }

      setLoadingActivities(true);
      try {
        const response = await apiGetClientActivities(client.id);
        const activities = Array.isArray(response.data) ? response.data : [];
        
        // Map backend activities to frontend format
        const mappedActivities: ClientActivityItem[] = activities.map((activity: any) => {
            const categoryMap: Record<string, ActivityFilterType> = {
              'General': 'Jobs', // Map General to Jobs for filtering
              'Jobs': 'Jobs',
              'Candidates': 'Candidates',
              'Interviews': 'Interviews',
              'Billing': 'Billing',
              'Notes': 'Notes',
              'Files': 'Files',
              'Contacts': 'Jobs', // Map Contacts to Jobs for now
              'Placements': 'Jobs', // Map Placements to Jobs for now
              'Team': 'Jobs', // Map Team to Jobs for now
              'System': 'Jobs', // Map System to Jobs for now
            };

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
            dateDisplay = activityDate.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric', 
              year: activityDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
            });
          }
          
          const timeDisplay = activityDate.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
          });
          
          const timestamp = `${dateDisplay} at ${timeDisplay}`;

          return {
            id: activity.id,
            category: (categoryMap[activity.category] || 'Jobs') as Exclude<ActivityFilterType, 'All'>,
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
  }, [client?.id, activeTab]);

  // Fetch jobs for the client
  useEffect(() => {
    const fetchClientJobs = async () => {
      if (!client?.id) {
        setClientJobs([]);
        return;
      }

      setLoadingJobs(true);
      try {
        const response = await apiGetJobs({ clientId: client.id });
        const jobsList = Array.isArray(response.data) 
          ? response.data 
          : (response.data as any)?.data || (response.data as any)?.items || [];
        
        // Map BackendJob to ClientJob format
        const mappedJobs: ClientJob[] = jobsList.map((job: BackendJob) => {
          // Calculate if job is aging (older than 30 days)
          const createdAt = new Date(job.createdAt);
          const daysSinceCreation = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
          const isAging = daysSinceCreation > 30;

          // Map status from backend to frontend format
          const statusMap: Record<string, JobStatus> = {
            'OPEN': 'Open',
            'DRAFT': 'Open',
            'ON_HOLD': 'Paused',
            'CLOSED': 'Closed',
            'FILLED': 'Closed',
          };

          return {
            id: job.id,
            title: job.title,
            department: (job as any).department || 'Not specified',
            location: job.location || 'Not specified',
            hiringManager: (job as any).hiringManager || 'Not specified',
            openings: job.openings,
            pipelineStages: (job as any).pipelineStages || [],
            status: statusMap[job.status] || 'Open',
            createdDate: createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
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
    };

    fetchClientJobs();
  }, [client?.id]);

  // Fetch contacts for the client
  useEffect(() => {
    const fetchClientContacts = async () => {
      if (!client?.id) {
        setClientContacts([]);
        return;
      }

      setLoadingContacts(true);
      try {
        const response = await apiGetContacts({ clientId: client.id, type: 'CLIENT' });
        const contactsList = Array.isArray(response.data) 
          ? response.data 
          : (response.data as any)?.data || (response.data as any)?.items || [];
        
        // Map BackendContact to ClientContact format
        const mappedContacts: ClientContact[] = contactsList.map((contact: BackendContact) => {
          return {
            id: contact.id,
            name: `${contact.firstName} ${contact.lastName}`.trim(),
            designation: contact.designation || contact.title || '',
            department: (contact.department as ClientContact['department']) || 'Other',
            email: contact.email || '',
            phone: contact.phone || '',
            isPrimary: contact.isPrimary || false,
            lastContacted: contact.lastContacted 
              ? new Date(contact.lastContacted).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : 'Never',
            avatar: contact.avatar || undefined,
            preferredChannel: (contact.preferredChannel as ClientContact['preferredChannel']) || undefined,
            notes: contact.notes || undefined,
            activity: [], // Can be populated from activity logs if needed
          };
        });
        
        setClientContacts(mappedContacts);
      } catch (error) {
        console.error('Failed to fetch contacts:', error);
        setClientContacts([]);
      } finally {
        setLoadingContacts(false);
      }
    };

    fetchClientContacts();
  }, [client?.id]);

  // Fetch scheduled meetings when schedule tab is active or client changes
  useEffect(() => {
    const fetchScheduledMeetings = async () => {
      if (!client?.id || activeTab !== 'schedule') {
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
  }, [client?.id, activeTab]);

  // Reset form when entering add mode
  useEffect(() => {
    if (isAddMode) {
      // Reset form to empty values when opening in add mode
      setOverviewEditForm({
        companyName: '',
        industry: '',
        companySize: '',
        website: '',
        linkedin: '',
        location: '',
        hiringLocations: '',
        timezone: '',
        priority: '',
        sla: '',
        status: 'PROSPECT' as 'ACTIVE' | 'PROSPECT' | 'ON_HOLD' | 'INACTIVE',
        assignedToId: '',
      });
      // Set edit mode to true so form is visible
      setOverviewEditMode(true);
      // Open relevant sections
      setOverviewOpen({
        companySnapshot: true,
        relationship: true,
        performance: false,
        health: false,
      });
      // Set active tab to overview
      setActiveTab('overview');
    }
  }, [isAddMode]);

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: LayoutGrid },
    { id: 'contacts' as const, label: 'Contacts', icon: Users },
    { id: 'jobs' as const, label: 'Jobs', icon: Briefcase },
    { id: 'pipeline' as const, label: 'Pipeline', icon: GitBranch },
    { id: 'placements' as const, label: 'Placements', icon: Award },
    { id: 'billing' as const, label: 'Billing', icon: CreditCard },
    { id: 'activity' as const, label: 'Activity', icon: Activity },
    { id: 'schedule' as const, label: 'Schedule', icon: CalendarPlus },
    { id: 'notes' as const, label: 'Notes', icon: StickyNote },
    { id: 'files' as const, label: 'Files', icon: Paperclip },
  ];

  const revenue = client?.revenue ?? `$${(Number(client?.placements ?? 0) * 3.5).toFixed(1)}k`;

  // Don't render if no client and not in add mode
  if (!client && !isAddMode) {
    return null;
  }

  return (
    <AnimatePresence mode="wait">
      {(client || isAddMode) && (
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
            onClick={(e) => e.stopPropagation()}
            className="fixed right-0 top-0 h-full w-1/2 bg-white shadow-2xl z-50 pointer-events-auto border-l border-slate-200 flex flex-col"
          >
            {/* Sticky Header */}
            <div className="shrink-0 bg-white border-b border-slate-200">
              <div className="p-5 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 flex items-center gap-3">
                  {!isAddMode && (
                  <div className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 flex-shrink-0 bg-white">
                      <ImageWithFallback src={client?.logo} alt={client?.name || ''} className="w-full h-full object-cover" />
                  </div>
                  )}
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-slate-900 truncate">
                      {isAddMode ? 'Add New Client' : client?.name}
                    </h2>
                    {!isAddMode && (
                      <div className="relative mt-2">
                        <button
                          type="button"
                          onClick={() => setStageDropdownOpen(!stageDropdownOpen)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${STAGE_STYLES[client?.stage || 'Prospect']} hover:opacity-80 transition-opacity`}
                        >
                          {client?.stage}
                          <ChevronDown size={12} className="opacity-60" />
                        </button>
                        {stageDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setStageDropdownOpen(false)} aria-hidden />
                            <ul className="absolute z-20 mt-1 left-0 rounded-xl border border-slate-200 bg-white py-1 shadow-lg min-w-[160px]">
                              {CLIENT_STAGES.map((stage) => (
                                <li key={stage}>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      setStageDropdownOpen(false);
                                      // Update stage immediately
                                      const statusMap: Record<string, 'ACTIVE' | 'PROSPECT' | 'ON_HOLD' | 'INACTIVE'> = {
                                        'Active': 'ACTIVE',
                                        'Prospect': 'PROSPECT',
                                        'On Hold': 'ON_HOLD',
                                        'Inactive': 'INACTIVE',
                                        'Hot Clients 🔥': 'ACTIVE',
                                      };
                                      try {
                                        await apiUpdateClient(client!.id, {
                                          status: statusMap[stage] || 'PROSPECT',
                                        });
                                        
                                        // Refresh activities if Activity tab is open
                                        if (activeTab === 'activity') {
                                          const response = await apiGetClientActivities(client!.id);
                                          const activities = Array.isArray(response.data) ? response.data : [];
                                          
                                          const mappedActivities: ClientActivityItem[] = activities.map((activity: any) => {
                                            const categoryMap: Record<string, ActivityFilterType> = {
                                              'General': 'Jobs',
                                              'Jobs': 'Jobs',
                                              'Candidates': 'Candidates',
                                              'Interviews': 'Interviews',
                                              'Billing': 'Billing',
                                              'Notes': 'Notes',
                                              'Files': 'Files',
                                              'Contacts': 'Jobs',
                                            };

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
                                              dateDisplay = activityDate.toLocaleDateString('en-US', { 
                                                month: 'short', 
                                                day: 'numeric', 
                                                year: activityDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
                                              });
                                            }
                                            
                                            const timeDisplay = activityDate.toLocaleTimeString('en-US', { 
                                              hour: 'numeric', 
                                              minute: '2-digit',
                                              hour12: true 
                                            });
                                            
                                            const timestamp = `${dateDisplay} at ${timeDisplay}`;

                                            return {
                                              id: activity.id,
                                              category: (categoryMap[activity.category] || 'Jobs') as Exclude<ActivityFilterType, 'All'>,
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
                                        
                                        // Refresh the page to show updated stage
                                        window.location.reload();
                                      } catch (error: any) {
                                        console.error('Failed to update client stage:', error);
                                        alert(error.message || 'Failed to update client stage');
                                      }
                                    }}
                                    className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 flex items-center gap-2 ${client?.stage === stage ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                                  >
                                    <span className={`inline-block w-2 h-2 rounded-full ${STAGE_STYLES[stage].split(' ')[0]}`} />
                                    {stage}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {isAddMode ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onClose()}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        aria-label="Close"
                        title="Close"
                      >
                        <X size={20} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onClose()}
                        className="px-3 py-1.5 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={saveOverviewEdit}
                        className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Create Client
                      </button>
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
                  <button
                    type="button"
                    onClick={() => { setActiveTab('jobs'); openAddJobForm(); }}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Add Job"
                  >
                    <Briefcase size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={openSendMessageForm}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Message Client"
                  >
                    <MessageCircle size={18} />
                  </button>
                  <div className="relative">
                    <button
                      type="button"
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
                        <div className="absolute right-0 top-full mt-1 w-52 py-2 bg-white rounded-xl border border-slate-200 shadow-lg z-20">
                          <button
                            type="button"
                            onClick={startOverviewEdit}
                            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                          >
                            <Edit2 size={16} /> Edit Client
                          </button>
                          <button className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                            <UserPlus size={16} /> Add Contact
                          </button>
                          <button className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                            <FileText size={16} /> Add Note
                          </button>
                          <button className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                            <Upload size={16} /> Upload File
                          </button>
                          <button
                            type="button"
                            onClick={openChangeStageForm}
                            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                          >
                            Change Stage
                          </button>
                          <button
                            type="button"
                            onClick={openArchiveClientForm}
                            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                          >
                            <Archive size={16} /> Archive Client
                          </button>
                          <button
                            type="button"
                            onClick={openDeleteClientForm}
                            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                          >
                            <Trash2 size={16} /> Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
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

            {/* Tabs */}
            {!isAddMode && (
            <div className="shrink-0 bg-slate-50/80 border-b border-slate-200 px-4 pt-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex gap-1 min-w-max">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium rounded-t-lg transition-all duration-200 whitespace-nowrap ${
                        isActive
                          ? 'bg-white text-blue-600 border-b-2 border-blue-600 -mb-px shadow-sm'
                          : 'border-b-2 border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/60'
                      }`}
                    >
                      <Icon size={14} className={isActive ? 'text-blue-600' : 'text-slate-400'} strokeWidth={isActive ? 2.25 : 1.5} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
            )}

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto bg-slate-50/30">
              <div className="p-5">
                {isAddMode ? (
                  <div className="space-y-4">
                    {/* Add Client Form - Same as Edit Form */}
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
                          <div className="space-y-4 pt-2">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Company Name *</label>
                              <input
                                type="text"
                                value={overviewEditForm.companyName}
                                onChange={(e) => setOverviewEditForm((p) => ({ ...p, companyName: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                placeholder="Enter company name"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Industry</label>
                              <input
                                type="text"
                                value={overviewEditForm.industry}
                                onChange={(e) => setOverviewEditForm((p) => ({ ...p, industry: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                placeholder="Enter industry"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Company Size</label>
                              <input
                                type="text"
                                value={overviewEditForm.companySize}
                                onChange={(e) => setOverviewEditForm((p) => ({ ...p, companySize: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                placeholder="e.g., 50-100"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Location</label>
                              <input
                                type="text"
                                value={overviewEditForm.location}
                                onChange={(e) => setOverviewEditForm((p) => ({ ...p, location: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                placeholder="Enter location"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Website</label>
                              <input
                                type="text"
                                value={overviewEditForm.website}
                                onChange={(e) => setOverviewEditForm((p) => ({ ...p, website: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                placeholder="https://example.com"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">LinkedIn</label>
                              <input
                                type="text"
                                value={overviewEditForm.linkedin}
                                onChange={(e) => setOverviewEditForm((p) => ({ ...p, linkedin: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                placeholder="LinkedIn URL"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Timezone</label>
                              <input
                                type="text"
                                value={overviewEditForm.timezone}
                                onChange={(e) => setOverviewEditForm((p) => ({ ...p, timezone: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                placeholder="e.g., PST (UTC-8)"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </section>

                    {/* 2. Relationship & Ownership Card */}
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
                          <div className="space-y-4 pt-2">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status</label>
                              <select
                                value={overviewEditForm.status}
                                onChange={(e) => setOverviewEditForm((p) => ({ ...p, status: e.target.value as 'ACTIVE' | 'PROSPECT' | 'ON_HOLD' | 'INACTIVE' }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              >
                                <option value="PROSPECT">Prospect</option>
                                <option value="ACTIVE">Active</option>
                                <option value="ON_HOLD">On Hold</option>
                                <option value="INACTIVE">Inactive</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Assigned To</label>
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => setAssignedToDropdownOpen(!assignedToDropdownOpen)}
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 flex items-center justify-between bg-white"
                                >
                                  <span className="flex items-center gap-2">
                                    {overviewEditForm.assignedToId ? (
                                      (() => {
                                        const selectedUser = users.find(u => u.id === overviewEditForm.assignedToId);
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
                                      {loadingUsers ? (
                                        <li className="px-4 py-2.5 text-sm text-slate-500 text-center">Loading users...</li>
                                      ) : users.length === 0 ? (
                                        <li className="px-4 py-2.5 text-sm text-slate-500 text-center">No users available</li>
                                      ) : (
                                        <>
                                          <li>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setOverviewEditForm((p) => ({ ...p, assignedToId: '' }));
                                                setAssignedToDropdownOpen(false);
                                              }}
                                              className={`w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${!overviewEditForm.assignedToId ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                                            >
                                              <span className="text-slate-400">Unassigned</span>
                                            </button>
                                          </li>
                                          {users.map((user) => (
                                            <li key={user.id}>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setOverviewEditForm((p) => ({ ...p, assignedToId: user.id }));
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
                                placeholder="High, Medium, Low"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">SLA / Response expectations</label>
                              <input
                                type="text"
                                value={overviewEditForm.sla}
                                onChange={(e) => setOverviewEditForm((p) => ({ ...p, sla: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                placeholder="e.g., 48h response"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </section>

                    {/* 3. Performance Metrics Card - Read-only info in add mode */}
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
                        <div className="px-5 pb-5 pt-0 border-t border-slate-100">
                          <p className="text-sm text-slate-500 italic pt-2">
                            Performance metrics will be available after the client is created and data is added.
                          </p>
                        </div>
                      )}
                    </section>

                    {/* 4. Client Health Card - Read-only info in add mode */}
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
                          <p className="text-sm text-slate-500 italic pt-2">
                            Client health status will be available after the client is created and activities are tracked.
                          </p>
                        </div>
                      )}
                    </section>
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
                          <MessageCircle size={16} />
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
                    <div className="space-y-4">
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
                          <FieldRow label="Company Name" value={fullClientData?.name || client?.name || '—'} />
                          <FieldRow label="Industry" value={fullClientData?.industry || client?.industry || '—'} />
                          <FieldRow label="Company size" value={fullClientData?.companySize || client?.companySize || '—'} />
                          <FieldRow label="Website" value={fullClientData?.website || client?.website || '—'} href={!!(fullClientData?.website || client?.website)} />
                          <FieldRow label="LinkedIn" value={fullClientData?.linkedin || client?.linkedin || '—'} href={!!(fullClientData?.linkedin || client?.linkedin)} />
                          <FieldRow label="Location" value={fullClientData?.location || client?.location || fullClientData?.hiringLocations || client?.hiringLocations || '—'} />
                          <FieldRow label="Locations / Hiring locations" value={fullClientData?.hiringLocations || client?.hiringLocations || fullClientData?.location || client?.location || 'Not specified'} />
                          <FieldRow label="Timezone" value={fullClientData?.timezone || client?.timezone || '—'} />
                          <FieldRow label="Client since" value={(() => {
                            const clientSince = fullClientData?.clientSince || client?.clientSince;
                            if (!clientSince) return '—';
                            if (typeof clientSince === 'string' && clientSince.includes('-')) {
                              return new Date(clientSince).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
                                <input
                                  type="text"
                                  value={overviewEditForm.industry}
                                  onChange={(e) => setOverviewEditForm((p) => ({ ...p, industry: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
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
                                <input
                                  type="text"
                                  value={overviewEditForm.timezone}
                                  onChange={(e) => setOverviewEditForm((p) => ({ ...p, timezone: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
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
                                  <FieldRow label="Contact Name" value={primaryContact.name || '—'} />
                                  <FieldRow label="Designation" value={primaryContact.designation || '—'} />
                                  <FieldRow label="Email" value={primaryContact.email || '—'} href={!!primaryContact.email} />
                                  <FieldRow label="Phone" value={primaryContact.phone || '—'} />
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
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Recruiter team</p>
                            <p className="text-sm font-medium text-slate-900">
                              {client.recruiterTeam?.length ? client.recruiterTeam.join(', ') : client.owner.name}
                            </p>
                          </div>
                          <FieldRow label="Client stage" value={client.stage} />
                          <FieldRow label="Priority" value={client.priority ?? '—'} />
                          <FieldRow label="SLA / Response expectations" value={client.sla ?? '—'} />
                                </>
                              )}
                            </>
                          ) : (
                            <div className="space-y-4 pt-2">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Assigned To</label>
                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={() => setAssignedToDropdownOpen(!assignedToDropdownOpen)}
                                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 flex items-center justify-between bg-white"
                                  >
                                    <span className="flex items-center gap-2">
                                      {overviewEditForm.assignedToId ? (
                                        (() => {
                                          const selectedUser = users.find(u => u.id === overviewEditForm.assignedToId);
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
                                        {loadingUsers ? (
                                          <li className="px-4 py-2.5 text-sm text-slate-500 text-center">Loading users...</li>
                                        ) : users.length === 0 ? (
                                          <li className="px-4 py-2.5 text-sm text-slate-500 text-center">No users available</li>
                                        ) : (
                                          <>
                                            <li>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setOverviewEditForm((p) => ({ ...p, assignedToId: '' }));
                                                  setAssignedToDropdownOpen(false);
                                                }}
                                                className={`w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${!overviewEditForm.assignedToId ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                                              >
                                                <span className="text-slate-400">Unassigned</span>
                                              </button>
                                            </li>
                                            {users.map((user) => (
                                              <li key={user.id}>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setOverviewEditForm((p) => ({ ...p, assignedToId: user.id }));
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
                            <p className="text-lg font-bold text-slate-900 mt-0.5">{client?.interviewsThisWeek ?? '—'}</p>
                          </div>
                          <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Placements this month</p>
                            <p className="text-lg font-bold text-slate-900 mt-0.5">{client?.placementsThisMonth ?? client?.placements ?? '—'}</p>
                          </div>
                          <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 col-span-2">
                            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Revenue generated</p>
                            <p className="text-lg font-bold text-emerald-800 mt-0.5">{client?.revenueGenerated ?? client?.revenue ?? '—'}</p>
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
                                  {status === 'Good' && '🟢 '}
                                  {status === 'Needs attention' && '🟡 '}
                                  {status === 'At risk' && '🔴 '}
                                  {s.label}
                                </span>
                              );
                            })()}
                          </div>
                          <FieldRow label="Last activity" value={client?.lastActivity ?? '—'} />
                          <FieldRow label="Next follow-up due" value={client?.nextFollowUpDue ?? '—'} />
                          <FieldRow label="Stale jobs count" value={client?.staleJobsCount != null ? String(client.staleJobsCount) : '—'} />
                          <FieldRow label="Pending invoices" value={client?.pendingInvoicesCount != null ? String(client.pendingInvoicesCount) : '—'} />
                          <FieldRow label="Average time-to-fill" value={client?.avgTimeToFill ?? '—'} />
                        </div>
                      )}
                    </section>

                    {/* 5. Quick Actions Strip — always visible, no dropdown */}
                    <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Quick actions</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => { setActiveTab('jobs'); openAddJobForm(); }}
                          className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100 hover:border-slate-300 active:scale-[0.98] transition-all"
                        >
                          <Briefcase size={16} className="text-slate-600" />
                          Add Job Requirement
                        </button>
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
                        <h2 className="text-lg font-bold text-slate-900">Add Contact</h2>
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
                          onClick={() => setShowAddContactForm(false)}
                          className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!client) return;
                            if (!addContactForm.fullName.trim()) {
                              alert('Full name is required');
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

                              await apiCreateContact(contactData);
                              setShowAddContactForm(false);
                              // Reset form
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
                              // Refresh contacts list immediately
                              if (client.id) {
                                const response = await apiGetContacts({ clientId: client.id, type: 'CLIENT' });
                                const contactsList = Array.isArray(response.data) 
                                  ? response.data 
                                  : (response.data as any)?.data || (response.data as any)?.items || [];
                                
                                const mappedContacts: ClientContact[] = contactsList.map((contact: BackendContact) => {
                                  return {
                                    id: contact.id,
                                    name: `${contact.firstName} ${contact.lastName}`.trim(),
                                    designation: contact.designation || contact.title || '',
                                    department: (contact.department as ClientContact['department']) || 'Other',
                                    email: contact.email || '',
                                    phone: contact.phone || '',
                                    isPrimary: contact.isPrimary || false,
                                    lastContacted: contact.lastContacted 
                                      ? new Date(contact.lastContacted).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                      : 'Never',
                                    avatar: contact.avatar || undefined,
                                    preferredChannel: (contact.preferredChannel as ClientContact['preferredChannel']) || undefined,
                                    notes: contact.notes || undefined,
                                    activity: [],
                                  };
                                });
                                setClientContacts(mappedContacts);
                              }
                            } catch (error: any) {
                              console.error('Failed to create contact:', error);
                              alert(error.message || 'Failed to create contact');
                            }
                          }}
                          className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors"
                        >
                          Save Contact
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
                                        <span className="text-[10px] font-bold">✓</span>
                                      </span>
                                    ) : (
                                      <span className="inline-block w-6 h-6 rounded-full border border-slate-200 bg-white" />
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-xs text-slate-500">{contact.lastContacted}</td>
                                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center justify-end gap-1">
                                      <button type="button" className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Call"><Phone size={14} /></button>
                                      <button type="button" className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="WhatsApp"><MessageCircle size={14} /></button>
                                      <button type="button" className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Email"><Mail size={14} /></button>
                                      <button type="button" className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="Edit"><Edit2 size={14} /></button>
                                      <button type="button" className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 size={14} /></button>
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
                                <p className="font-medium text-slate-900">{selectedContact.designation} · {selectedContact.department}</p>
                                <p className="text-slate-600">{selectedContact.email}</p>
                                <p className="text-slate-600">{selectedContact.phone}</p>
                              </div>
                            </div>
                            <div>
                              <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Preferred communication</h5>
                              <p className="text-sm font-medium text-slate-900">{selectedContact.preferredChannel ?? '—'}</p>
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
                                      <span className="text-slate-600"> — {a.summary}</span>
                                    </li>
                                  ))
                                )}
                              </ul>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  )
                ) : activeTab === 'jobs' ? (
                  showAddJobForm ? (
                    <div className="space-y-5">
                      <div className="flex items-center gap-3 mb-4">
                        <button
                          type="button"
                          onClick={() => setShowAddJobForm(false)}
                          className="p-2 -ml-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Back to Jobs"
                        >
                          <ChevronRight size={20} className="rotate-180" />
                        </button>
                        <h2 className="text-lg font-bold text-slate-900">Create Job</h2>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
                        <div>
                          <label htmlFor="add-job-title" className="block text-sm font-medium text-slate-700 mb-2">Job Title</label>
                          <input
                            id="add-job-title"
                            type="text"
                            value={addJobForm.jobTitle}
                            onChange={(e) => setAddJobForm((p) => ({ ...p, jobTitle: e.target.value }))}
                            placeholder="e.g. Senior Software Engineer"
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="add-job-department" className="block text-sm font-medium text-slate-700 mb-2">Department</label>
                            <input
                              id="add-job-department"
                              type="text"
                              value={addJobForm.department}
                              onChange={(e) => setAddJobForm((p) => ({ ...p, department: e.target.value }))}
                              placeholder="e.g. Engineering"
                              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                          </div>
                          <div>
                            <label htmlFor="add-job-location" className="block text-sm font-medium text-slate-700 mb-2">Location</label>
                            <input
                              id="add-job-location"
                              type="text"
                              value={addJobForm.location}
                              onChange={(e) => setAddJobForm((p) => ({ ...p, location: e.target.value }))}
                              placeholder="e.g. San Francisco, CA"
                              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="add-job-positions" className="block text-sm font-medium text-slate-700 mb-2">Number of Positions</label>
                            <input
                              id="add-job-positions"
                              type="number"
                              min={1}
                              value={addJobForm.numberOfPositions}
                              onChange={(e) => setAddJobForm((p) => ({ ...p, numberOfPositions: e.target.value }))}
                              placeholder="1"
                              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Priority</label>
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => { setAddJobPriorityOpen((v) => !v); setAddJobHiringManagerOpen(false); }}
                                className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-left text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              >
                                <span className={addJobForm.priority ? 'text-slate-900' : 'text-slate-400'}>{addJobForm.priority || 'Select priority'}</span>
                                <ChevronDown size={16} className="text-slate-400" />
                              </button>
                              {addJobPriorityOpen && (
                                <>
                                  <div className="fixed inset-0 z-10" onClick={() => setAddJobPriorityOpen(false)} aria-hidden />
                                  <ul className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                                    {ADD_JOB_PRIORITIES.map((p) => (
                                      <li key={p}>
                                        <button type="button" onClick={() => { setAddJobForm((prev) => ({ ...prev, priority: p })); setAddJobPriorityOpen(false); }} className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${addJobForm.priority === p ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}>{p}</button>
                                      </li>
                                    ))}
                                  </ul>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">Hiring Manager</label>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => { setAddJobHiringManagerOpen((v) => !v); setAddJobPriorityOpen(false); }}
                              className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-left text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            >
                              <span className={addJobForm.hiringManagerId ? 'text-slate-900' : 'text-slate-400'}>
                                {(client?.contacts ?? []).find((c) => c.id === addJobForm.hiringManagerId)?.name ?? 'Select from contacts'}
                              </span>
                              <ChevronDown size={16} className="text-slate-400" />
                            </button>
                            {addJobHiringManagerOpen && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setAddJobHiringManagerOpen(false)} aria-hidden />
                                <ul className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg max-h-48 overflow-y-auto">
                                  {(client?.contacts ?? []).map((c) => (
                                    <li key={c.id}>
                                      <button type="button" onClick={() => { setAddJobForm((prev) => ({ ...prev, hiringManagerId: c.id })); setAddJobHiringManagerOpen(false); }} className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${addJobForm.hiringManagerId === c.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}>{c.name} · {c.designation}</button>
                                    </li>
                                  ))}
                                  {(client?.contacts ?? []).length === 0 && (
                                    <li className="px-4 py-2.5 text-sm text-slate-500">No contacts</li>
                                  )}
                                </ul>
                              </>
                            )}
                          </div>
                        </div>
                        <div>
                          <label htmlFor="add-job-closure" className="block text-sm font-medium text-slate-700 mb-2">Expected Closure Date</label>
                          <input
                            id="add-job-closure"
                            type="date"
                            value={addJobForm.expectedClosureDate}
                            onChange={(e) => setAddJobForm((p) => ({ ...p, expectedClosureDate: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label htmlFor="add-job-description" className="block text-sm font-medium text-slate-700 mb-2">Job Description</label>
                          <textarea
                            id="add-job-description"
                            value={addJobForm.jobDescription}
                            onChange={(e) => setAddJobForm((p) => ({ ...p, jobDescription: e.target.value }))}
                            placeholder="Describe the role, requirements, and responsibilities..."
                            rows={4}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">Upload JD file</label>
                          <label className="relative flex rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-4 cursor-pointer hover:border-slate-300 hover:bg-slate-50/80 transition-colors">
                            <input
                              type="file"
                              accept=".pdf,.doc,.docx"
                              className="sr-only"
                              id="add-job-jd"
                              onChange={(e) => setAddJobForm((p) => ({ ...p, jdFileName: e.target.files?.[0]?.name ?? '' }))}
                            />
                            <div className="flex items-center justify-center gap-2 w-full">
                              <Upload size={18} className="text-slate-400 shrink-0" />
                              <span className="text-sm text-slate-500">{addJobForm.jdFileName || 'Click or drag file to upload'}</span>
                            </div>
                          </label>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <button type="button" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-xl hover:bg-slate-200 transition-colors">
                            <Sparkles size={16} className="text-amber-500" />
                            Enhance JD with AI
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-end gap-3">
                        <button type="button" onClick={() => setShowAddJobForm(false)} className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                          Cancel
                        </button>
                        <button 
                          type="button" 
                          onClick={async () => {
                            if (!client) return;
                            if (!addJobForm.jobTitle.trim()) {
                              alert('Job title is required');
                              return;
                            }
                            
                            try {
                              // Get hiring manager name from contact if hiringManagerId is set
                              const hiringManagerContact = client.contacts?.find(c => c.id === addJobForm.hiringManagerId);
                              const hiringManagerName = hiringManagerContact ? hiringManagerContact.name : undefined;
                              
                              const jobData: CreateJobData = {
                                title: addJobForm.jobTitle,
                                description: addJobForm.jobDescription || undefined,
                                location: addJobForm.location || undefined,
                                department: addJobForm.department || undefined,
                                openings: addJobForm.numberOfPositions ? parseInt(addJobForm.numberOfPositions) : 1,
                                clientId: client.id,
                                hiringManager: hiringManagerName,
                                hiringManagerId: addJobForm.hiringManagerId || undefined,
                                expectedClosureDate: addJobForm.expectedClosureDate || undefined,
                                status: 'OPEN', // Set to OPEN by default when creating from client drawer
                              };

                              await apiCreateJob(jobData);
                              setShowAddJobForm(false);
                              // Reset form
                              setAddJobForm({
                                jobTitle: '',
                                department: '',
                                location: '',
                                numberOfPositions: '',
                                priority: '',
                                hiringManagerId: '',
                                expectedClosureDate: '',
                                jobDescription: '',
                                jdFileName: '',
                              });
                              // Refresh jobs list immediately
                              if (client?.id) {
                                const response = await apiGetJobs({ clientId: client.id });
                                const jobsList = Array.isArray(response.data) 
                                  ? response.data 
                                  : (response.data as any)?.data || (response.data as any)?.items || [];
                                
                                const mappedJobs: ClientJob[] = jobsList.map((job: BackendJob) => {
                                  const createdAt = new Date(job.createdAt);
                                  const daysSinceCreation = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
                                  const isAging = daysSinceCreation > 30;
                                  const statusMap: Record<string, JobStatus> = {
                                    'OPEN': 'Open',
                                    'DRAFT': 'Open',
                                    'ON_HOLD': 'Paused',
                                    'CLOSED': 'Closed',
                                    'FILLED': 'Closed',
                                  };
                                  return {
                                    id: job.id,
                                    title: job.title,
                                    department: (job as any).department || 'Not specified',
                                    location: job.location || 'Not specified',
                                    hiringManager: (job as any).hiringManager || 'Not specified',
                                    openings: job.openings,
                                    pipelineStages: (job as any).pipelineStages || [],
                                    status: statusMap[job.status] || 'Open',
                                    createdDate: createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                                    isAging,
                                  };
                                });
                                setClientJobs(mappedJobs);
                              }
                              // Call callback to refresh client data
                              onJobCreated?.();
                            } catch (error: any) {
                              console.error('Failed to create job:', error);
                              alert(error.message || 'Failed to create job');
                            }
                          }}
                          className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors"
                        >
                          Create Job
                        </button>
                      </div>
                    </div>
                  ) : (
                  <div className="space-y-4">
                    {/* Jobs overview widgets */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                          <Briefcase size={20} className="text-blue-600" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Open Jobs</p>
                          <p className="text-lg font-bold text-slate-900">{clientJobs.filter((j) => j.status === 'Open').length || client?.openJobs || 0}</p>
                        </div>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                          <AlertCircle size={20} className="text-amber-600" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Aging Jobs</p>
                          <p className="text-lg font-bold text-slate-900">{clientJobs.filter((j) => j.isAging).length}</p>
                        </div>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <BarChart3 size={16} className="text-slate-400" />
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">By department</p>
                        </div>
                        <div className="space-y-1.5">
                          {(() => {
                            const byDept = clientJobs.reduce<Record<string, number>>((acc, j) => {
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
                          {clientJobs.length === 0 && (
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
                          onClick={openAddJobForm}
                          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
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
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Hiring manager</th>
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
                            ) : clientJobs.length === 0 ? (
                              <tr>
                                <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">
                                  No jobs yet. Click Add Job to create one.
                                </td>
                              </tr>
                            ) : (
                              clientJobs.map((job: ClientJob) => (
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
                                      {(job.pipelineStages ?? []).slice(0, 3).map((s) => (
                                        <span key={s.stage} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium">
                                          {s.stage}: {s.count}
                                        </span>
                                      ))}
                                      {(!job.pipelineStages || job.pipelineStages.length === 0) && <span className="text-xs text-slate-400">—</span>}
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
                                      <button type="button" className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View job"><Eye size={14} /></button>
                                      <button type="button" className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Add candidates"><UserPlus size={14} /></button>
                                      <button type="button" className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Pause job"><Pause size={14} /></button>
                                      <button type="button" className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="Duplicate job"><Copy size={14} /></button>
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
                  )
                ) : activeTab === 'pipeline' ? (() => {
                  const baseCandidates = client?.pipelineCandidates ?? [];
                  // Calculate stage counts from all candidates (no filtering)
                  const stageCounts = pipelineStages.reduce((acc, stage) => {
                    acc[stage.name] = baseCandidates.filter((c) => c.currentStage === stage.name).length;
                    return acc;
                  }, {} as Record<string, number>);

                  return (
                  <div className="space-y-4">
                    {/* Stage counts — similar to JobDetailsDrawer */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Stage counts</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {pipelineStages.slice(0, 4).map((stage) => (
                          <div key={stage.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">{stage.name}</p>
                            <p className="text-xl font-bold text-slate-900 mt-1">{stageCounts[stage.name] || 0}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Pipeline configuration — copied from JobDetailsDrawer */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-4 border-b border-slate-100">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pipeline configuration</h4>
                        <p className="text-xs text-slate-500 mt-0.5">Custom hiring pipeline for this client. Drag to reorder, add or remove stages, set SLA timers.</p>
                        <button
                          type="button"
                          onClick={handleAddStage}
                          className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-100 transition-colors"
                        >
                          <Plus size={14} /> Add stage
                        </button>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {pipelineStages.map((stage, index) => (
                          <div
                            key={stage.id}
                            draggable
                            onDragStart={() => setDraggedStageId(stage.id)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (!draggedStageId || draggedStageId === stage.id) return;
                              const from = pipelineStages.findIndex((s) => s.id === draggedStageId);
                              const to = index;
                              if (from >= 0 && to >= 0) handlePipelineReorder(from, to);
                              setDraggedStageId(null);
                            }}
                            onDragEnd={() => setDraggedStageId(null)}
                            className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-50/50 transition-colors ${draggedStageId === stage.id ? 'opacity-50' : ''}`}
                          >
                            <span className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600" aria-label="Drag to reorder">
                              <GripVertical size={18} />
                            </span>
                            <span className="text-sm font-medium text-slate-500 w-8 shrink-0">{index + 1}</span>
                            <input
                              type="text"
                              value={stage.name}
                              onChange={(e) => handleStageNameChange(stage.id, e.target.value)}
                              className="flex-1 min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              placeholder="Stage name"
                            />
                            <div className="flex items-center gap-1.5 shrink-0 w-28">
                              <Clock size={14} className="text-slate-400 shrink-0" />
                              <input
                                type="text"
                                value={stage.sla ?? ''}
                                onChange={(e) => handleStageSlaChange(stage.id, e.target.value)}
                                placeholder="e.g. 2 days"
                                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveStage(stage.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                              aria-label="Remove stage"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Kanban pipeline — horizontal scroll when needed, scrollbar hidden; scroll only inside each stage card */}
                    <div className="flex gap-4 pb-2 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                      {pipelineStages.map((stage) => {
                        const candidates = baseCandidates.filter((c) => c.currentStage === stage.name);
                        // Use default style if stage name matches PIPELINE_STAGES, otherwise use default
                        const stageName = stage.name as PipelineStageName;
                        const style = PIPELINE_STAGE_STYLES[stageName] || PIPELINE_STAGE_STYLES['Applied'];
                        return (
                          <div
                            key={stage.id}
                            className={`shrink-0 w-56 h-[420px] rounded-xl border-2 ${style.border} bg-slate-50/50 flex flex-col overflow-hidden`}
                          >
                            <div className={`shrink-0 px-3 py-2.5 border-b ${style.border} ${style.header}`}>
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-wider">{stage.name}</span>
                                <span className="text-xs font-bold rounded-full bg-white/80 px-1.5 py-0.5">{candidates.length}</span>
                              </div>
                            </div>
                            {/* Scroll only inside this stage card — candidates list */}
                            <div className="flex-1 min-h-0 p-2 overflow-y-auto overflow-x-hidden space-y-2">
                              {candidates.length === 0 ? (
                                <p className="text-xs text-slate-400 py-4 text-center">No candidates</p>
                              ) : (
                                candidates.map((c) => (
                                  <div
                                    key={c.id}
                                    className="bg-white rounded-lg border border-slate-200 shadow-sm p-2.5 hover:shadow-md transition-shadow"
                                  >
                                    <div className="flex items-start gap-2">
                                      <div className="w-9 h-9 rounded-full overflow-hidden border border-slate-200 shrink-0 bg-slate-100">
                                        {c.avatar ? (
                                          <ImageWithFallback src={c.avatar} alt={c.name} className="w-full h-full object-cover" />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center text-slate-400"><User size={16} /></div>
                                        )}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-slate-900 truncate">{c.name}</p>
                                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                          {c.matchScore != null && (
                                            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1 rounded">{c.matchScore}%</span>
                                          )}
                                          <span className="text-[10px] text-slate-500">{c.nextActionDate}</span>
                                        </div>
                                        {c.status && (
                                          <p className="text-[10px] text-slate-500 truncate mt-0.5">{c.status}</p>
                                        )}
                                      </div>
                                    </div>
                                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-end gap-1">
                                      <button type="button" className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Open profile"><User size={12} /></button>
                                      <button type="button" className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors" title="Move stage"><ArrowRight size={12} /></button>
                                      <button type="button" className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors" title="Schedule interview"><Calendar size={12} /></button>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  );
                })() : activeTab === 'placements' ? (
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
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Recruiter</th>
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
                                      <button type="button" className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View placement"><Eye size={14} /></button>
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
                    {/* Finance summary cards — same soft card layout as Jobs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                          <TrendingUp size={20} className="text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total revenue</p>
                          <p className="text-lg font-bold text-slate-900">{client?.billingTotalRevenue ?? client?.revenue ?? '—'}</p>
                        </div>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                          <Clock size={20} className="text-amber-600" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Outstanding</p>
                          <p className="text-lg font-bold text-slate-900">{client?.billingOutstanding ?? '—'}</p>
                        </div>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                          <DollarSign size={20} className="text-blue-600" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Paid amount</p>
                          <p className="text-lg font-bold text-slate-900">{client?.billingPaid ?? '—'}</p>
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
                                      <button type="button" className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View invoice"><Eye size={14} /></button>
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
                    {/* Timeline filters — same soft card layout as Billing */}
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
                                          return date.toLocaleDateString('en-US', { 
                                            weekday: 'long',
                                            month: 'long', 
                                            day: 'numeric',
                                            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
                                          });
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
                      availableTags={['HR', 'Finance', 'Contract', 'Feedback']}
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
                  const uploadsBase = (typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1') : 'http://localhost:5000/api/v1').replace(/\/api\/v1\/?$/, '');
                  const toFileHref = (fileUrl?: string | null) => {
                    if (!fileUrl) return '#';
                    return /^https?:\/\//i.test(fileUrl) ? fileUrl : `${uploadsBase}${fileUrl}`;
                  };
                  const formatUploadDate = (d: string) => {
                    if (!d) return '—';
                    try {
                      const date = new Date(d);
                      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
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
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          try {
                            await uploadFile(f, 'Contract');
                            e.target.value = '';
                          } catch (_) {}
                        }
                      }}
                    />
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <button
                          type="button"
                          disabled={!client?.id || filesUploading}
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Upload size={16} />
                          {filesUploading ? 'Uploading…' : 'Upload File'}
                        </button>
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
                      {filesError && <p className="mt-2 text-sm text-red-600">{filesError}</p>}
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Files</h4>
                        <p className="text-xs text-slate-500">{filesLoading ? 'Loading…' : `${filteredFiles.length} files`}</p>
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
                                <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">Loading files…</td>
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
                                      <span className="text-sm text-slate-600 truncate">{file.uploadedBy?.name ?? '—'}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-600">{formatUploadDate(file.uploadDate)}</td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center justify-end gap-1">
                                      {file.fileUrl && (
                                        <a href={`${uploadsBase}${file.fileUrl}`} target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Download"><Download size={14} /></a>
                                      )}
                                      {file.fileUrl && (
                                        <a href={`${uploadsBase}${file.fileUrl}`} target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Preview"><Eye size={14} /></a>
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
                      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
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
                                          <span className="text-[11px] text-slate-400">·</span>
                                          <span className="text-[11px] text-slate-500">
                                            {new Date(meeting.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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
                                                  alert('Failed to update meeting status');
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
                                                if (!confirm('Are you sure you want to cancel this meeting?')) return;
                                                try {
                                                  await apiUpdateScheduledMeeting(client.id, meeting.id, { status: 'CANCELLED' });
                                                  const meetings = await apiGetClientScheduledMeetings(client.id);
                                                  setScheduledMeetings(meetings.data || []);
                                                } catch (error) {
                                                  console.error('Failed to cancel meeting:', error);
                                                  alert('Failed to cancel meeting');
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
                                            if (!confirm('Are you sure you want to delete this meeting?')) return;
                                            try {
                                              await apiDeleteScheduledMeeting(client.id, meeting.id);
                                              const meetings = await apiGetClientScheduledMeetings(client.id);
                                              setScheduledMeetings(meetings.data || []);
                                            } catch (error) {
                                              console.error('Failed to delete meeting:', error);
                                              alert('Failed to delete meeting');
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
                })() : null}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
