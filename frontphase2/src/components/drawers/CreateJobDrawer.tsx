'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  ChevronDown,
  ChevronUp,
  Plus,
  Check,
  Upload,
  Info,
  Linkedin,
  Twitter,
  Facebook,
  ExternalLink,
  AlertCircle,
  User,
  SendHorizontal,
} from 'lucide-react';
import { RichTextEditor } from '../RichTextEditor';
import {
  apiCreateJob,
  apiUpdateJob,
  apiGetJob,
  apiGetClients,
  apiGetContacts,
  apiGenerateJobDescription,
  apiUploadJobFile,
  filesApiUpload,
  apiPublishSocialJob,
  apiGetSocialStatus,
  type CreateJobData,
  type BackendClient,
  type BackendUser,
} from '../../lib/api';
import { getAllTeamMembersForAssign, teamMembersToBackendUsers } from '../../lib/api/teamApi';
import { WhatsAppIcon } from '../icons/WhatsAppIcon';
import { LinkedInConnect } from '../LinkedInConnect';
import { LinkedInPostPreview } from '../LinkedInPostPreview';
import { useLinkedIn } from '../../hooks/useLinkedIn';
import { requestError, requestInfo, requestWarning } from '../../lib/appDialog';
import { clampDateTimeLocalToMin, getLocalDateTimeInputMinNow } from '../../utils/dateInputConstraints';
import { CreateJobDetailsForm, type CreateJobDetailsFormData } from './CreateJobDetailsForm';
import { normalizeJobSalaryCurrency } from '../../constants/jobSalary';
import { getCachedOrgDefaultCurrency } from '../../lib/api';
import { CreateJobEntryOptions } from './CreateJobEntryOptions';
import { DocumentUploadButton, useDocumentUploadFeedback } from '../import/documentUploadUi';

type ApplicationLogoOption = 'account' | 'company' | 'none' | 'custom';

export type ScreeningQuestionType = 'short_text' | 'yes_no' | 'single_choice' | 'slider';

export interface ScreeningQuestion {
  id: string;
  type: ScreeningQuestionType;
  label: string;
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  minLabel?: string;
  maxLabel?: string;
}

const SCREENING_TYPE_OPTIONS: { value: ScreeningQuestionType; label: string; hint: string }[] = [
  { value: 'short_text', label: 'Short text', hint: 'Open answer (single line)' },
  { value: 'yes_no', label: 'Yes / No', hint: 'Two-option toggle' },
  { value: 'single_choice', label: 'Multiple choice', hint: 'Pick one from your options' },
  { value: 'slider', label: 'Proficiency slider', hint: 'Slider scale (e.g. Beginner → Expert)' },
];

function generateScreeningQuestionId() {
  return `q_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

/** Parse a stored question. Legacy plain strings become a `short_text` question. */
function parseScreeningQuestion(raw: string | ScreeningQuestion | null | undefined): ScreeningQuestion | null {
  if (!raw) return null;
  if (typeof raw === 'object' && raw !== null && typeof (raw as ScreeningQuestion).label === 'string') {
    const obj = raw as ScreeningQuestion;
    return {
      id: obj.id || generateScreeningQuestionId(),
      type: (obj.type as ScreeningQuestionType) || 'short_text',
      label: obj.label,
      required: !!obj.required,
      options: Array.isArray(obj.options) ? obj.options.map((s) => String(s)) : undefined,
      min: typeof obj.min === 'number' ? obj.min : undefined,
      max: typeof obj.max === 'number' ? obj.max : undefined,
      step: typeof obj.step === 'number' ? obj.step : undefined,
      minLabel: typeof obj.minLabel === 'string' ? obj.minLabel : undefined,
      maxLabel: typeof obj.maxLabel === 'string' ? obj.maxLabel : undefined,
    };
  }
  const text = String(raw).trim();
  if (!text) return null;
  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && typeof parsed.label === 'string') {
        return parseScreeningQuestion(parsed);
      }
    } catch {
      /* fall through to plain-text */
    }
  }
  return { id: generateScreeningQuestionId(), type: 'short_text', label: text };
}

function parseScreeningQuestionList(raw: unknown): ScreeningQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => parseScreeningQuestion(entry as string | ScreeningQuestion))
    .filter((q): q is ScreeningQuestion => Boolean(q && q.label));
}

/** Convert an editor question to the on-disk JSON-string form expected by the backend `String[]` column. */
function serializeScreeningQuestion(q: ScreeningQuestion): string {
  const payload: ScreeningQuestion = {
    id: q.id || generateScreeningQuestionId(),
    type: q.type,
    label: q.label.trim(),
    required: !!q.required,
  };
  if (q.type === 'single_choice') {
    payload.options = (q.options || []).map((s) => s.trim()).filter(Boolean);
  } else if (q.type === 'slider') {
    payload.min = typeof q.min === 'number' ? q.min : 0;
    payload.max = typeof q.max === 'number' ? q.max : 100;
    payload.step = typeof q.step === 'number' && q.step > 0 ? q.step : 1;
    payload.minLabel = (q.minLabel || 'Beginner').trim();
    payload.maxLabel = (q.maxLabel || 'Expert').trim();
  }
  return JSON.stringify(payload);
}

function makeShortTextScreeningQuestion(label: string): ScreeningQuestion {
  return {
    id: generateScreeningQuestionId(),
    type: 'short_text',
    label: label.trim(),
    required: false,
  };
}

export interface CreateJobDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onJobCreated?: () => void;
  jobId?: string;
  duplicateFromJobId?: string | null;
  onJobUpdated?: () => void;
  /** When opening “Add job” from a client, pre-select this client (company) in the form */
  defaultClientId?: string | null;
}

interface AccordionSection {
  id: 'details' | 'application' | 'publish';
  label: string;
  isOpen: boolean;
}

interface AiDescriptionSection {
  heading: string;
  paragraphs: string[];
  items: string[];
}

interface AiChatMessage {
  id: string;
  role: 'ai' | 'user';
  content: string;
}

interface AiDraftData {
  originalPrompt: string;
  jobTitle: string;
  openings: string;
  companyId: string;
  location: string;
  salary: string;
  qualification: string;
  workMode: string;
}

export function CreateJobDrawer({
  isOpen,
  onClose,
  onJobCreated,
  jobId,
  duplicateFromJobId = null,
  onJobUpdated,
  defaultClientId = null,
}: CreateJobDrawerProps) {
  const isEditMode = !!jobId;
  const isDuplicateMode = !jobId && !!duplicateFromJobId;
  const [loading, setLoading] = useState(false);
  const [loadingJob, setLoadingJob] = useState(false);
  const [clients, setClients] = useState<BackendClient[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [users, setUsers] = useState<BackendUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [isExtractingJd, setIsExtractingJd] = useState(false);
  const [showAiPromptBox, setShowAiPromptBox] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiDrawerError, setAiDrawerError] = useState('');
  const [aiDetectedRole, setAiDetectedRole] = useState('');
  const [aiGeneratedDescription, setAiGeneratedDescription] = useState('');
  const [aiGeneratedQualification, setAiGeneratedQualification] = useState('');
  const [aiGeneratedSpecialization, setAiGeneratedSpecialization] = useState('');
  const [aiGeneratedQuestions, setAiGeneratedQuestions] = useState<string[]>([]);
  const [aiQuestionStep, setAiQuestionStep] = useState<'initial' | 'openings' | 'company' | 'location' | 'salary' | 'qualification' | 'done'>('initial');
  const [aiMessages, setAiMessages] = useState<AiChatMessage[]>([]);
  const aiConversationEndRef = useRef<HTMLDivElement | null>(null);
  const [aiDraftData, setAiDraftData] = useState<AiDraftData>({
    originalPrompt: '',
    jobTitle: '',
    openings: '',
    companyId: '',
    location: '',
    salary: '',
    qualification: '',
    workMode: '',
  });
  const [linkedInPostText, setLinkedInPostText] = useState('');
  const [showLinkedInSuccess, setShowLinkedInSuccess] = useState(false);
  const [linkedInPostUrl, setLinkedInPostUrl] = useState<string | null>(null);

  // LinkedIn integration hook
  const linkedIn = useLinkedIn();

  // Accordion state
  const [accordions, setAccordions] = useState<AccordionSection[]>([
    { id: 'details', label: 'Job Details', isOpen: true },
    { id: 'application', label: 'Job Application Form', isOpen: false },
    { id: 'publish', label: 'Publish & Share', isOpen: false },
  ]);

  // Form state - Section 1: Job Details
  const [formData, setFormData] = useState({
    // Job Details
    nationality: '',
    jobTitle: '',
    priority: 'Medium',
    numberOfOpenings: '1',
    companyId: '',
    contactPersonId: '',
    contactPersonName: '',
    industryType: '',
    employmentType: '',
    targetHireDate: '',
    videoMediaLink: '',
    forecastRevenue: '',
    managerId: '',
    languages: [] as { language: string; proficiency: string }[],
    /** Assigned recruiter / owner (User id) */
    assignedToId: '',
    
    // Job Description
    jobDescriptionHtml: '',
    jobLocation: '',
    jobType: 'Part Time',
    jobLocationType: '',
    salaryInput: '',
    jobSummary: '',
    keyResponsibilitiesText: '',
    qualificationsExperienceText: '',
    compensationBenefitsText: '',
    minExperience: '',
    maxExperience: '',
    payRangeMin: '',
    payRangeMax: '',
    salaryType: 'Annual Salary',
    currency: normalizeJobSalaryCurrency(getCachedOrgDefaultCurrency()),
    minSalary: '',
    maxSalary: '',
    educationalQualification: '',
    educationalSpecialization: '',
    skills: [] as string[],
    locality: '',
    city: '',
    state: '',
    country: '',
    postalCode: '',
    fullAddress: '',
    
    // Job Application Form
    enableApplicationForm: false,
    logoOption: 'account' as ApplicationLogoOption,
    applicationLogoUrl: '',
    applicationQuestions: [] as ScreeningQuestion[],
    noteForCandidates: '',
    
    // Publish & Share
    linkedInEnabled: false,
    linkedInConnected: false,
    linkedInAccount: null as { name: string; avatar?: string; id: string } | null,
    linkedInPostAs: 'personal' as 'personal' | string,
    linkedInJobTitle: '',
    linkedInDescription: '',
    linkedInApplyMethod: 'linkedin' as 'linkedin' | 'external',
    linkedInExternalUrl: '',
    linkedInWorkplaceType: 'On-site' as 'On-site' | 'Remote' | 'Hybrid',
    linkedInEmploymentType: 'Full-time' as 'Full-time' | 'Part-time' | 'Contract' | 'Temporary' | 'Volunteer' | 'Internship' | 'Other',
    linkedInSeniorityLevel: 'Entry level' as 'Internship' | 'Entry level' | 'Associate' | 'Mid-Senior' | 'Director' | 'Executive',
    linkedInJobFunctions: [] as string[],
    linkedInIndustries: [] as string[],
    linkedInExpiryDate: '',
    
    twitterEnabled: false,
    twitterConnected: false,
    twitterTweetText: '',
    twitterIncludeLogo: true,
    twitterScheduleDate: '',
    
    facebookEnabled: false,
    facebookConnected: false,
    facebookPageId: '',
    facebookCaption: '',
    
    whatsappEnabled: false,
    whatsappPhoneNumber: '',
    whatsappTemplate: '',
    whatsappRecipients: [] as string[],
  });

  const [skillInput, setSkillInput] = useState('');
  // JD file upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [existingOtherDocName, setExistingOtherDocName] = useState('');
  const [uploadingApplicationLogo, setUploadingApplicationLogo] = useState(false);
  const logoUploadFeedback = useDocumentUploadFeedback(uploadingApplicationLogo);
  const applicationLogoInputRef = useRef<HTMLInputElement>(null);
  const [dropdownsOpen, setDropdownsOpen] = useState({
    company: false,
    contact: false,
    manager: false,
    recruiter: false,
    jobType: false,
    locationType: false,
    minExperience: false,
    maxExperience: false,
    salaryType: false,
    currency: false,
    qualification: false,
    linkedInPostAs: false,
    linkedInWorkplaceType: false,
    linkedInEmploymentType: false,
    linkedInSeniorityLevel: false,
    linkedInJobFunctions: false,
    linkedInIndustries: false,
    applicationQuestions: false,
  });

  // Reset form when switching between add and edit modes
  useEffect(() => {
    if (!isOpen) {
      // Reset form when drawer closes
      setFormData({
        nationality: '',
        jobTitle: '',
        priority: 'Medium',
        numberOfOpenings: '1',
        companyId: '',
        contactPersonId: '',
        contactPersonName: '',
        industryType: '',
        employmentType: '',
        targetHireDate: '',
        videoMediaLink: '',
        forecastRevenue: '',
        managerId: '',
        languages: [],
        assignedToId: '',
        jobDescriptionHtml: '',
        jobLocation: '',
        jobType: 'Part Time',
        jobLocationType: '',
        salaryInput: '',
        jobSummary: '',
        keyResponsibilitiesText: '',
        qualificationsExperienceText: '',
        compensationBenefitsText: '',
        minExperience: '',
        maxExperience: '',
        payRangeMin: '',
        payRangeMax: '',
        salaryType: 'Annual Salary',
        currency: normalizeJobSalaryCurrency(getCachedOrgDefaultCurrency()),
        minSalary: '',
        maxSalary: '',
        educationalQualification: '',
        educationalSpecialization: '',
        skills: [],
        locality: '',
        city: '',
        state: '',
        country: '',
        postalCode: '',
        fullAddress: '',
        enableApplicationForm: false,
        logoOption: 'account',
        applicationLogoUrl: '',
        applicationQuestions: [],
        noteForCandidates: '',
        linkedInEnabled: false,
        linkedInConnected: false,
        linkedInAccount: null,
        linkedInPostAs: 'personal',
        linkedInJobTitle: '',
        linkedInDescription: '',
        linkedInApplyMethod: 'linkedin',
        linkedInExternalUrl: '',
        linkedInWorkplaceType: 'On-site',
        linkedInEmploymentType: 'Full-time',
        linkedInSeniorityLevel: 'Entry level',
        linkedInJobFunctions: [],
        linkedInIndustries: [],
        linkedInExpiryDate: '',
        twitterEnabled: false,
        twitterConnected: false,
        twitterTweetText: '',
        twitterIncludeLogo: true,
        twitterScheduleDate: '',
        facebookEnabled: false,
        facebookConnected: false,
        facebookPageId: '',
        facebookCaption: '',
        whatsappEnabled: false,
        whatsappPhoneNumber: '',
        whatsappTemplate: '',
        whatsappRecipients: [],
      });
      setSkillInput('');
      setUploadedFile(null);
      setExistingOtherDocName('');
      setContacts([]);
      setShowAiPromptBox(false);
      setAiPrompt('');
      setAiDrawerError('');
      setAiDetectedRole('');
      setAiGeneratedDescription('');
      setAiGeneratedQualification('');
      setAiGeneratedSpecialization('');
      setAiGeneratedQuestions([]);
      setAiQuestionStep('initial');
      setAiMessages([]);
      setAiDraftData({
        originalPrompt: '',
        jobTitle: '',
        openings: '',
        companyId: '',
        location: '',
        salary: '',
        qualification: '',
        workMode: '',
      });
    }
  }, [isOpen]);

  // Pre-select client when opened from Client drawer (add mode only)
  useEffect(() => {
    if (!isOpen || jobId || duplicateFromJobId) return;
    if (defaultClientId) {
      setFormData((prev) => ({ ...prev, companyId: defaultClientId }));
    }
  }, [isOpen, defaultClientId, jobId, duplicateFromJobId]);

  useEffect(() => {
    if (!isOpen || !formData.companyId) {
      setContacts([]);
      return;
    }

    let cancelled = false;
    const loadContacts = async () => {
      try {
        setLoadingContacts(true);
        const response = await apiGetContacts({ clientId: formData.companyId });
        const raw = (response as { data?: unknown }).data;
        const list = Array.isArray(raw)
          ? raw
          : raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown }).data)
            ? (raw as { data: unknown[] }).data
            : [];
        if (cancelled) return;
        setContacts(
          list.map((item: { id?: string; firstName?: string; lastName?: string; name?: string }) => {
            const name =
              [item.firstName, item.lastName].filter(Boolean).join(' ').trim() ||
              String(item.name || '').trim() ||
              'Contact';
            return { id: String(item.id || ''), name };
          }).filter((c) => c.id)
        );
      } catch {
        if (!cancelled) setContacts([]);
      } finally {
        if (!cancelled) setLoadingContacts(false);
      }
    };

    void loadContacts();
    return () => {
      cancelled = true;
    };
  }, [isOpen, formData.companyId]);

  // Load data on mount
  useEffect(() => {
    if (isOpen) {
      const loadData = async () => {
        await Promise.all([loadClients(), loadUsers(), loadSocialStatus()]);
        if (jobId || duplicateFromJobId) {
          await loadJobData(jobId || duplicateFromJobId || undefined);
        }
      };
      loadData();
    }
  }, [isOpen, jobId, duplicateFromJobId]);

  const loadSocialStatus = async () => {
    try {
      const response = await apiGetSocialStatus();
      setFormData(prev => ({
        ...prev,
        twitterConnected: response.data.twitter.connected,
        facebookConnected: response.data.facebook.connected,
      }));
    } catch (err) {
      console.error('Failed to load social status:', err);
    }
  };

  // Auto-populate social fields when Job Title/Company changes
  useEffect(() => {
    if (formData.jobTitle && formData.companyId) {
      const company = clients.find(c => c.id === formData.companyId);
      const companyName = company?.companyName || '';
      
      // Auto-fill LinkedIn Job Title
      if (!formData.linkedInJobTitle) {
        setFormData(prev => ({ ...prev, linkedInJobTitle: prev.jobTitle }));
      }
      
      // Generate LinkedIn post text
      const applyUrl = formData.linkedInExternalUrl || `https://yourcompany.com/apply/${formData.jobTitle.replace(/\s+/g, '-').toLowerCase()}`;
      const locationText = formData.city || formData.fullAddress || '';
      const linkedInText = `We're hiring a ${formData.jobTitle} at ${companyName}!\n\n${formData.jobDescriptionHtml ? formData.jobDescriptionHtml.replace(/<[^>]*>/g, '').substring(0, 200) + '...' : ''}\n\n${locationText ? `Location: ${locationText}\n\n` : ''}Apply here: ${applyUrl}\n\n#hiring #jobs #careers`;
      if (!linkedInPostText || linkedInPostText.length < linkedInText.length) {
        setLinkedInPostText(linkedInText.substring(0, 700));
      }
      
      // Generate tweet text
      const tweetText = `We're hiring a ${formData.jobTitle} at ${companyName}! Apply here: [application URL] #hiring`;
      if (!formData.twitterTweetText) {
        setFormData(prev => ({ ...prev, twitterTweetText: tweetText.substring(0, 280) }));
      }
      
      // Generate Facebook caption
      const fbCaption = `Join our team! We're looking for a ${formData.jobTitle} at ${companyName}. ${formData.jobDescriptionHtml ? 'Learn more and apply today!' : ''}`;
      if (!formData.facebookCaption) {
        setFormData(prev => ({ ...prev, facebookCaption: fbCaption }));
      }
    }
  }, [formData.jobTitle, formData.companyId, formData.jobDescriptionHtml, formData.city, formData.fullAddress, clients]);

  // Auto-populate LinkedIn Description from rich text editor
  useEffect(() => {
    if (formData.jobDescriptionHtml && formData.linkedInEnabled) {
      // Strip HTML and limit to 2000 chars
      const text = formData.jobDescriptionHtml.replace(/<[^>]*>/g, '').trim();
      const limited = text.substring(0, 2000);
      if (!formData.linkedInDescription || formData.linkedInDescription.length < limited.length) {
        setFormData(prev => ({ ...prev, linkedInDescription: limited }));
      }
    }
  }, [formData.jobDescriptionHtml, formData.linkedInEnabled]);

  const toggleAccordion = (id: AccordionSection['id']) => {
    setAccordions(prev => prev.map(acc => 
      acc.id === id ? { ...acc, isOpen: !acc.isOpen } : acc
    ));
  };

  const stripHtml = (value: string) =>
    value
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<li>/gi, '- ')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

  const getSectionTextFromHtml = (html: string, sectionTitle: string) => {
    if (!html || typeof window === 'undefined') return '';
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const headings = Array.from(doc.querySelectorAll('h3, h4'));
      const heading = headings.find((node) =>
        (node.textContent || '').trim().toLowerCase().includes(sectionTitle.toLowerCase())
      );
      if (!heading) return '';

      const chunks: string[] = [];
      let cursor = heading.nextElementSibling;
      while (cursor && !['H3', 'H4'].includes(cursor.tagName)) {
        const text = (cursor.textContent || '').trim();
        if (text) chunks.push(text);
        cursor = cursor.nextElementSibling;
      }
      return chunks.join('\n');
    } catch {
      return '';
    }
  };

  const loadJobData = async (sourceJobId?: string) => {
    const targetJobId = sourceJobId || jobId || duplicateFromJobId || undefined;
    if (!targetJobId) return;
    try {
      setLoadingJob(true);
      const response = await apiGetJob(targetJobId);
      // Handle different response structures
      const job = response.data || (response as any);
      
      if (!job) {
        throw new Error('Job data not found');
      }
      
      const salary = job.salary || {};
      const salaryType = salary.type || 'Annual Salary';
      const currency = normalizeJobSalaryCurrency(salary.currency || getCachedOrgDefaultCurrency());
      let minSalary = salary.min != null ? String(salary.min) : '';
      let maxSalary = salary.max != null ? String(salary.max) : '';
      if (!minSalary && !maxSalary && typeof salary.amount === 'string') {
        const m = salary.amount.match(/^\s*(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*$/);
        if (m) {
          minSalary = m[1];
          maxSalary = m[2];
        } else {
          const single = salary.amount.match(/^\s*(\d+(?:\.\d+)?)\s*$/);
          if (single) minSalary = single[1];
        }
      }
      
      // Parse experience - format: "2-8" or "2" or "2-"
      const experienceRequired = job.experienceRequired || '';
      let minExperience = '0 Year';
      let maxExperience = '';
      if (experienceRequired) {
        // Handle formats: "2-8", "2", "2-", "2-8 Years", etc.
        const cleanExp = experienceRequired.trim();
        // Match: "2-8" -> min=2, max=8
        // Match: "2" -> min=2, max=undefined
        // Match: "2-" -> min=2, max=undefined
        const expMatch = cleanExp.match(/^(\d+)(?:-(\d+))?/);
        if (expMatch && expMatch[1]) {
          const min = parseInt(expMatch[1]);
          const max = expMatch[2] ? parseInt(expMatch[2]) : null;
          
          // Map to dropdown options exactly
          if (min === 0) minExperience = '0 Year';
          else if (min === 1) minExperience = '1 Year';
          else if (min >= 2 && min <= 4) minExperience = `${min} Years`;
          else if (min >= 5) minExperience = '5+ Years';
          
          if (max !== null) {
            if (max === 1) maxExperience = '1 Year';
            else if (max >= 2 && max <= 4) maxExperience = `${max} Years`;
            else if (max === 5) maxExperience = '5 Years';
            else if (max === 8) maxExperience = '8 Years';
            else if (max >= 10) maxExperience = '10+ Years';
            else maxExperience = `${max} Years`; // Fallback
          }
        }
      }
      
      // Map job type
      const mapJobTypeFromBackend = (type: string): string => {
        const t = type?.toUpperCase() || '';
        if (t.includes('FULL_TIME') || t.includes('FULL')) return 'Full Time';
        if (t.includes('PART_TIME') || t.includes('PART')) return 'Part Time';
        if (t.includes('CONTRACT')) return 'Contract';
        if (t.includes('INTERN')) return 'Internship';
        return 'Part Time';
      };
      
      // Parse location - try to extract city, state, country, locality, postalCode
      const location = job.location || '';
      // Try to parse location string (format might vary)
      const locationParts = location.split(',').map((p: string) => p.trim()).filter(p => p);
      let city = '';
      let state = '';
      let country = '';
      let locality = '';
      let postalCode = '';
      
      // Try to extract from distributionPlatforms first (if stored there)
      let fullAddress = '';
      if (job.distributionPlatforms && typeof job.distributionPlatforms === 'object') {
        const distPlatforms = job.distributionPlatforms as any;
        city = distPlatforms.city || '';
        state = distPlatforms.state || '';
        country = distPlatforms.country || '';
        locality = distPlatforms.locality || '';
        postalCode = distPlatforms.postalCode || '';
        fullAddress = distPlatforms.fullAddress || '';
      }
      
      // If not in distributionPlatforms, try to parse from location string
      // Common patterns: 
      // "City, State, Country"
      // "Locality, City, State, Country"
      // "City, State, Country, PostalCode"
      if (!city && locationParts.length > 0) {
        if (locationParts.length >= 5) {
          // Format: Locality, City, State, Country, PostalCode
          locality = locationParts[0] || '';
          city = locationParts[1] || '';
          state = locationParts[2] || '';
          country = locationParts[3] || '';
          postalCode = locationParts[4] || '';
        } else if (locationParts.length === 4) {
          // Could be: Locality, City, State, Country OR City, State, Country, PostalCode
          // Check if last part looks like postal code (numbers)
          if (/^\d+/.test(locationParts[3])) {
            city = locationParts[0] || '';
            state = locationParts[1] || '';
            country = locationParts[2] || '';
            postalCode = locationParts[3] || '';
          } else {
            locality = locationParts[0] || '';
            city = locationParts[1] || '';
            state = locationParts[2] || '';
            country = locationParts[3] || '';
          }
        } else if (locationParts.length === 3) {
          // Format: City, State, Country
          city = locationParts[0] || '';
          state = locationParts[1] || '';
          country = locationParts[2] || '';
        } else if (locationParts.length === 2) {
          city = locationParts[0] || '';
          state = locationParts[1] || '';
        } else if (locationParts.length === 1) {
          city = locationParts[0] || '';
        }
      }
      
      // Parse education field - might contain both qualification and specialization
      // Format could be: "Qualification - Specialization" or just "Qualification"
      const education = job.education || '';
      let educationalQualification = education;
      let educationalSpecialization = '';
      if (education.includes(' - ')) {
        const eduParts = education.split(' - ').map((p: string) => p.trim());
        educationalQualification = eduParts[0] || '';
        educationalSpecialization = eduParts[1] || '';
      } else if (education.includes(',')) {
        const eduParts = education.split(',').map((p: string) => p.trim());
        educationalQualification = eduParts[0] || '';
        educationalSpecialization = eduParts[1] || '';
      }
      
      // Get JD file name if available
      const jdFileName = job.jdFileName || '';
      setExistingOtherDocName(jdFileName);

      const plainDescription = stripHtml(job.description || '');
      const responsibilitiesText =
        Array.isArray(job.keyResponsibilities) && job.keyResponsibilities.length
          ? job.keyResponsibilities.join('\n')
          : getSectionTextFromHtml(job.description || '', 'key responsibilities');
      const qualificationsText =
        Array.isArray(job.requirements) && job.requirements.length
          ? job.requirements.join('\n')
          : getSectionTextFromHtml(job.description || '', 'requirements') ||
            getSectionTextFromHtml(job.description || '', 'qualifications');
      const benefitsText =
        Array.isArray(job.benefits) && job.benefits.length
          ? job.benefits.join('\n')
          : getSectionTextFromHtml(job.description || '', 'benefits') ||
            getSectionTextFromHtml(job.description || '', 'compensation');
      const salarySummary =
        salary?.amount
          ? String(salary.amount)
          : salary?.min || salary?.max
            ? `${salary.min ? `${salary.min}` : ''}${salary.max ? ` - ${salary.max}` : ''}`.trim()
            : '';

      // Application form logo: stored value is either preset (account|company|none) or a Cloudinary URL
      const rawAppLogo = String((job as { applicationFormLogo?: string }).applicationFormLogo || '').trim();
      let parsedLogoOption: ApplicationLogoOption = 'account';
      let parsedApplicationLogoUrl = '';
      if (/^https?:\/\//i.test(rawAppLogo)) {
        parsedLogoOption = 'custom';
        parsedApplicationLogoUrl = rawAppLogo;
      } else if (rawAppLogo === 'company' || rawAppLogo === 'none' || rawAppLogo === 'account') {
        parsedLogoOption = rawAppLogo;
      }
      
      const jobExtras = job as {
        nationality?: string;
        country?: string;
        state?: string;
        city?: string;
        priority?: string;
        jobCategory?: string;
        forecastRevenue?: string;
        videoMediaLink?: string;
        languages?: { language?: string; proficiency?: string }[];
        managerId?: string;
        hiringManager?: string;
        hiringManagerId?: string;
        expectedClosureDate?: string;
      };

      const targetHireDate = jobExtras.expectedClosureDate
        ? String(jobExtras.expectedClosureDate).split('T')[0]
        : '';

      setFormData(prev => ({
        ...prev,
        nationality: jobExtras.nationality || '',
        jobTitle: isDuplicateMode ? `${job.title || ''} Copy` : (job.title || ''),
        priority: jobExtras.priority || 'Medium',
        companyId: job.clientId || '',
        contactPersonId: jobExtras.hiringManagerId || '',
        contactPersonName: jobExtras.hiringManager || '',
        numberOfOpenings: String(job.openings || 1),
        country: jobExtras.country || country,
        state: jobExtras.state || state,
        city: jobExtras.city || city,
        industryType: jobExtras.jobCategory || '',
        employmentType: mapJobTypeFromBackend(job.type),
        targetHireDate,
        videoMediaLink: jobExtras.videoMediaLink || '',
        forecastRevenue: jobExtras.forecastRevenue || '',
        managerId: jobExtras.managerId || '',
        languages: Array.isArray(jobExtras.languages)
          ? jobExtras.languages
              .map((row) => ({
                language: String(row.language || '').trim(),
                proficiency: String(row.proficiency || 'Conversational').trim(),
              }))
              .filter((row) => row.language)
          : [],
        jobDescriptionHtml: job.description || '',
        jobLocation: location,
        jobType: mapJobTypeFromBackend(job.type),
        jobLocationType: job.jobLocationType || '',
        salaryInput: salarySummary,
        jobSummary: job.overview || plainDescription,
        keyResponsibilitiesText: responsibilitiesText,
        qualificationsExperienceText: qualificationsText,
        compensationBenefitsText: benefitsText,
        minExperience,
        maxExperience,
        payRangeMin: minSalary,
        payRangeMax: maxSalary,
        salaryType,
        currency,
        minSalary,
        maxSalary,
        educationalQualification,
        educationalSpecialization,
        skills: job.skills || [],
        locality,
        city,
        state,
        country,
        postalCode,
        fullAddress: fullAddress || location,
        enableApplicationForm: job.applicationFormEnabled || false,
        logoOption: parsedLogoOption,
        applicationLogoUrl: parsedApplicationLogoUrl,
        applicationQuestions: parseScreeningQuestionList(job.applicationFormQuestions),
        noteForCandidates: job.applicationFormNote || '',
        assignedToId:
          (job as { assignedToId?: string }).assignedToId || (job as { assignedTo?: { id: string } }).assignedTo?.id || '',
      }));
      
      // Set JD file name if available (for display purposes)
      if (jdFileName) {
        // Note: We can't restore the actual file, but we can show the filename
        // The user would need to re-upload if they want to change it
      }
    } catch (error) {
      console.error('Failed to load job data:', error);
      void requestError('Failed to load job data. Please try again.');
    } finally {
      setLoadingJob(false);
    }
  };

  const loadClients = async () => {
    try {
      setLoadingClients(true);
      const response = await apiGetClients({});
      let backendClients: BackendClient[] = [];
      if (response.data) {
        if (Array.isArray(response.data)) {
          backendClients = response.data;
        } else if (response.data && Array.isArray(response.data.data)) {
          backendClients = response.data.data;
        } else if (response.data && 'items' in response.data && Array.isArray((response.data as any).items)) {
          backendClients = (response.data as any).items;
        }
      }
      setClients(backendClients);
    } catch (err) {
      console.error('Failed to load clients:', err);
    } finally {
      setLoadingClients(false);
    }
  };

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      const members = await getAllTeamMembersForAssign();
      setUsers(teamMembersToBackendUsers(members));
    } catch (err) {
      console.error('Failed to load users:', err);
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const inferRoleFromPrompt = (prompt: string) => {
    const cleanPrompt = prompt.trim().replace(/\s+/g, ' ');
    if (!cleanPrompt) return '';

    const patterns = [
      /(?:create|generate|write|make)\s+(?:a\s+)?job(?:\s+description|\s+jd)?\s+(?:for|of)\s+(?:an?\s+|the\s+)?(.+)/i,
      /(?:for|of)\s+(?:an?\s+|the\s+)?([a-z][a-z\s/&-]{2,})$/i,
      /^(?:an?\s+|the\s+)?([a-z][a-z\s/&-]{2,})$/i,
    ];

    for (const pattern of patterns) {
      const match = cleanPrompt.match(pattern);
      if (match?.[1]) {
        return match[1].trim().replace(/[.!,]$/, '');
      }
    }

    return '';
  };

  const normalizeJobType = (value?: string) => {
    const normalized = String(value || '').toLowerCase();
    if (normalized.includes('part')) return 'Part Time';
    if (normalized.includes('contract')) return 'Contract';
    if (normalized.includes('intern')) return 'Internship';
    return 'Full Time';
  };

  const normalizeMinExperience = (value?: number) => {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return '0 Year';
    if (num === 1) return '1 Year';
    if (num >= 2 && num <= 4) return `${num} Years`;
    return '5+ Years';
  };

  const normalizeMaxExperience = (value?: number) => {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return '';
    if (num === 1) return '1 Year';
    if (num >= 2 && num <= 4) return `${num} Years`;
    if (num <= 5) return '5 Years';
    if (num <= 8) return '8 Years';
    return '10+ Years';
  };

  const normalizeQualification = (value?: string) => {
    const normalized = String(value || '').toLowerCase();
    if (normalized.includes('master') && normalized.includes('engineering')) return 'Master of Engineering';
    if (normalized.includes('bachelor') && normalized.includes('engineering')) return 'Bachelor of Engineering';
    if (normalized.includes('master') && normalized.includes('science')) return 'Master of Science';
    if (normalized.includes('bachelor') && normalized.includes('science')) return 'Bachelor of Science';
    if (normalized.includes('mba')) return 'MBA';
    if (normalized.includes('diploma')) return 'Diploma';
    return '';
  };

  const inferWorkModeFromPrompt = (prompt: string) => {
    const normalized = prompt.toLowerCase();
    if (normalized.includes('remote')) return 'Remote';
    if (normalized.includes('hybrid')) return 'Hybrid';
    if (normalized.includes('on-site') || normalized.includes('onsite')) return 'On-site';
    return '';
  };

  const pushAiMessage = (content: string) => {
    setAiMessages((prev) => [
      ...prev,
      {
        id: `ai-${Date.now()}-${prev.length}`,
        role: 'ai',
        content,
      },
    ]);
  };

  const scrollAiConversationToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      aiConversationEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
  }, []);

  const pushUserMessage = (content: string) => {
    setAiMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}-${prev.length}`,
        role: 'user',
        content,
      },
    ]);
  };

  const resetAiConversation = () => {
    setAiPrompt('');
    setAiDrawerError('');
    setAiDetectedRole('');
    setAiGeneratedDescription('');
    setAiGeneratedQualification('');
    setAiGeneratedSpecialization('');
    setAiGeneratedQuestions([]);
    setAiQuestionStep('initial');
    setAiDraftData({
      originalPrompt: '',
      jobTitle: '',
      openings: '',
      companyId: '',
      location: '',
      salary: '',
      qualification: '',
      workMode: '',
    });
    setAiMessages([
      {
        id: 'ai-welcome',
        role: 'ai',
        content:
          'Tell me which job you want to create. Example: "create job for Finance Analyst". I will then ask for openings, company, location, salary, and qualification.',
      },
    ]);
  };

  useEffect(() => {
    if (!showAiPromptBox) return;
    if (!aiMessages.length && !aiGeneratedDescription && !aiDrawerError && !aiGenerating) return;
    scrollAiConversationToBottom();
  }, [
    showAiPromptBox,
    aiMessages,
    aiGeneratedDescription,
    aiDrawerError,
    aiGenerating,
    aiQuestionStep,
    scrollAiConversationToBottom,
  ]);

  const parseAiDescriptionSections = (html: string) => {
    const fallback = {
      title: aiDetectedRole || formData.jobTitle || '',
      intro: [] as string[],
      sections: [] as AiDescriptionSection[],
    };

    if (!html || typeof window === 'undefined') {
      return fallback;
    }

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const bodyChildren = Array.from(doc.body.children);
      let title = '';
      const intro: string[] = [];
      const sections: AiDescriptionSection[] = [];
      let currentSection: AiDescriptionSection | null = null;

      for (const node of bodyChildren) {
        const tag = node.tagName.toLowerCase();
        const text = node.textContent?.trim() || '';
        if (!text) continue;

        if (!title && ['h1', 'h2'].includes(tag)) {
          title = text;
          continue;
        }

        if (tag === 'p') {
          if (!currentSection) {
            intro.push(text);
          } else {
            currentSection.paragraphs.push(text);
          }
          continue;
        }

        if (['h3', 'h4'].includes(tag)) {
          currentSection = { heading: text, paragraphs: [], items: [] };
          sections.push(currentSection);
          continue;
        }

        if (tag === 'ul' || tag === 'ol') {
          const items = Array.from(node.querySelectorAll('li'))
            .map((item) => item.textContent?.trim() || '')
            .filter(Boolean);
          if (!currentSection) {
            currentSection = { heading: 'Highlights', paragraphs: [], items: [] };
            sections.push(currentSection);
          }
          currentSection.items.push(...items);
        }
      }

      return {
        title: title || aiDetectedRole || formData.jobTitle || '',
        intro,
        sections,
      };
    } catch {
      return fallback;
    }
  };

  const aiDescriptionView = useMemo(
    () => parseAiDescriptionSections(aiGeneratedDescription),
    [aiGeneratedDescription, aiDetectedRole, formData.jobTitle]
  );

  const getJobSummaryFromAiDescription = (parsedDescription: {
    intro: string[];
    sections: AiDescriptionSection[];
  }) => {
    const introSummary = parsedDescription.intro.join('\n\n').trim();
    if (introSummary) return introSummary;

    const overviewSection = parsedDescription.sections.find((section) =>
      section.heading.toLowerCase().includes('overview')
    );
    if (!overviewSection) return '';

    return [...overviewSection.paragraphs, ...overviewSection.items].join('\n\n').trim();
  };

  const handleAiAssist = async (customPrompt?: string, draftOverrides?: Partial<AiDraftData>) => {
    const inferredRole = inferRoleFromPrompt(customPrompt || '');
    const effectiveRole = draftOverrides?.jobTitle || formData.jobTitle.trim() || inferredRole;
    const effectiveWorkMode =
      draftOverrides?.workMode || inferWorkModeFromPrompt(customPrompt || '') || formData.jobLocationType;

    setAiDrawerError('');
    setAiDetectedRole(effectiveRole);
    setAiGeneratedDescription('');
    setAiGeneratedQualification('');
    setAiGeneratedSpecialization('');
    setAiGeneratedQuestions([]);

    if (!effectiveRole) {
      setAiDrawerError('Enter a job title or describe the role in the prompt, like "create job for Finance Analyst".');
      return;
    }

    setAiGenerating(true);
    try {
      const company = clients.find(c => c.id === formData.companyId);
      const companyName = company?.companyName || '';

      const experience =
        formData.maxExperience && formData.maxExperience.trim()
          ? `${formData.minExperience} to ${formData.maxExperience}`
          : formData.minExperience;

      const response = await apiGenerateJobDescription({
        jobTitle: effectiveRole,
        company:
          (draftOverrides?.companyId
            ? clients.find((client) => client.id === draftOverrides.companyId)?.companyName
            : companyName) || undefined,
        jobType: formData.jobType || undefined,
        locationType: effectiveWorkMode || undefined,
        experience: experience || undefined,
        skills: formData.skills,
        customPrompt: customPrompt?.trim() || undefined,
      });
      const generated = response.data;
      const resolvedTitle = generated?.title?.trim() || effectiveRole;
      const generatedHtml = generated?.html?.trim() || '';
      const generatedSkills = Array.isArray(generated?.skills)
        ? Array.from(new Set(generated.skills.map((skill) => String(skill).trim()).filter(Boolean)))
        : [];
      const generatedQuestions = Array.isArray(generated?.screeningQuestions)
        ? Array.from(new Set(generated.screeningQuestions.map((question) => String(question).trim()).filter(Boolean)))
        : [];
      const qualification = normalizeQualification(generated?.educationalQualification);
      const specialization = String(generated?.educationalSpecialization || '').trim();
      const parsedDescription = parseAiDescriptionSections(generatedHtml);
      const summaryText = getJobSummaryFromAiDescription(parsedDescription);
      const findSection = (needle: string) =>
        parsedDescription.sections.find((section) =>
          section.heading.toLowerCase().includes(needle.toLowerCase())
        );
      const responsibilitiesText = findSection('key responsibilities')?.items.join('\n') || '';
      const qualificationsText = [
        ...((findSection('requirements')?.items || [])),
        ...((findSection('qualifications')?.items || [])),
      ].join('\n');
      const benefitsText = [
        ...((findSection('benefits')?.items || [])),
        ...((findSection('compensation')?.items || [])),
      ].join('\n');

      setAiDetectedRole(resolvedTitle);
      setAiGeneratedDescription(generatedHtml);
      setAiGeneratedQualification(qualification);
      setAiGeneratedSpecialization(specialization);
      setAiGeneratedQuestions(generatedQuestions);
      setFormData((prev) => ({
        ...prev,
        jobTitle: resolvedTitle || prev.jobTitle,
        jobDescriptionHtml: generatedHtml || prev.jobDescriptionHtml,
        numberOfOpenings: draftOverrides?.openings || prev.numberOfOpenings,
        companyId: draftOverrides?.companyId || prev.companyId,
        jobLocation: draftOverrides?.location || prev.jobLocation,
        salaryInput: draftOverrides?.salary || prev.salaryInput,
        jobSummary: summaryText || prev.jobSummary,
        keyResponsibilitiesText: responsibilitiesText || prev.keyResponsibilitiesText,
        qualificationsExperienceText: qualificationsText || prev.qualificationsExperienceText,
        compensationBenefitsText: benefitsText || prev.compensationBenefitsText,
        jobType: normalizeJobType(generated?.jobType || prev.jobType),
        jobLocationType: effectiveWorkMode || prev.jobLocationType,
        minExperience: normalizeMinExperience(generated?.minExperience),
        maxExperience: normalizeMaxExperience(generated?.maxExperience),
        educationalQualification:
          qualification || normalizeQualification(draftOverrides?.qualification) || prev.educationalQualification,
        educationalSpecialization: specialization || prev.educationalSpecialization,
        skills: generatedSkills.length ? generatedSkills : prev.skills,
        enableApplicationForm: generatedQuestions.length ? true : prev.enableApplicationForm,
        applicationQuestions: generatedQuestions.length
          ? generatedQuestions.map((label: string) => makeShortTextScreeningQuestion(label))
          : prev.applicationQuestions,
      }));
    } catch (error: any) {
      console.error('AI Assist failed:', error);
      setAiDrawerError(error.message || 'Failed to generate job description');
    } finally {
      setAiGenerating(false);
    }
  };

  const openAiPromptBox = () => {
    setShowAiPromptBox(true);
    resetAiConversation();
  };

  const readFileAsText = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });

  const handleJdFromFile = async (file: File) => {
    if (!file) return;

    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      void requestWarning('Job description file must be smaller than 5MB.');
      return;
    }

    setUploadedFile(file);
    setExistingOtherDocName(file.name);

    let jdText = '';
    const isPlainText =
      file.type.startsWith('text/') || /\.(txt|md)$/i.test(file.name);

    try {
      if (isPlainText) {
        jdText = (await readFileAsText(file)).trim();
      } else {
        jdText = (await readFileAsText(file).catch(() => '')).trim();
      }
    } catch {
      void requestError('Could not read the uploaded file.');
      return;
    }

    if (!jdText) {
      void requestWarning(
        'Could not extract text from this file. Upload a .txt job description or use Generate JD with AI.'
      );
      return;
    }

    setIsExtractingJd(true);
    try {
      await handleAiAssist(
        [
          'Extract structured job posting data from the job description below.',
          'Infer job title, skills, experience range, qualifications, responsibilities, benefits, and workplace details.',
          'Return a polished HTML job description and normalized fields.',
          '',
          jdText.slice(0, 14000),
        ].join('\n')
      );
      setAccordions((prev) =>
        prev.map((section) => ({
          ...section,
          isOpen: section.id === 'details',
        }))
      );
      void requestInfo('AI extracted job details from your JD. Review the fields below.');
    } finally {
      setIsExtractingJd(false);
    }
  };

  const handleFinalizeAiJob = () => {
    setAccordions((prev) =>
      prev.map((section) => ({
        ...section,
        isOpen: section.id === 'details',
      }))
    );
    setShowAiPromptBox(false);
  };

  const handleAiCompanySelect = (companyId: string) => {
    if (!companyId) return;
    const companyName = clients.find((client) => client.id === companyId)?.companyName || 'Selected company';

    setAiDraftData((prev) => ({
      ...prev,
      companyId,
    }));
    pushUserMessage(companyName);
    pushAiMessage('What is the job location?');
    setAiQuestionStep('location');
  };

  const handleGenerateFromPromptBox = async () => {
    const input = aiPrompt.trim();
    if (!input) return;

    setAiPrompt('');
    setAiDrawerError('');

    if (aiQuestionStep === 'company') {
      pushUserMessage(input);
      pushAiMessage('Please choose the company from the selector below.');
      return;
    }

    pushUserMessage(input);

    if (aiQuestionStep === 'initial') {
      const inferredRole = inferRoleFromPrompt(input) || input;
      const inferredWorkMode = inferWorkModeFromPrompt(input);

      setAiDetectedRole(inferredRole);
      setAiDraftData((prev) => ({
        ...prev,
        originalPrompt: input,
        jobTitle: inferredRole,
        workMode: inferredWorkMode,
      }));
      pushAiMessage(`How many positions do you want to open for ${inferredRole}?`);
      setAiQuestionStep('openings');
      return;
    }

    if (aiQuestionStep === 'openings') {
      const openingsMatch = input.match(/\d+/);
      if (!openingsMatch) {
        pushAiMessage('Please tell me the number of openings, for example 2 or 5.');
        return;
      }

      setAiDraftData((prev) => ({
        ...prev,
        openings: openingsMatch[0],
      }));
      pushAiMessage('Select which company this job is for.');
      setAiQuestionStep('company');
      return;
    }

    if (aiQuestionStep === 'location') {
      setAiDraftData((prev) => ({
        ...prev,
        location: input,
      }));
      pushAiMessage('What is the expected salary for the candidate?');
      setAiQuestionStep('salary');
      return;
    }

    if (aiQuestionStep === 'salary') {
      setAiDraftData((prev) => ({
        ...prev,
        salary: input,
      }));
      pushAiMessage('Which qualification is required for this role?');
      setAiQuestionStep('qualification');
      return;
    }

    if (aiQuestionStep === 'qualification') {
      const finalDraft = {
        ...aiDraftData,
        qualification: input,
      };

      setAiDraftData(finalDraft);
      pushAiMessage('Thanks. I have what I need. I am creating the job details and JD now.');

      const companyName =
        clients.find((client) => client.id === finalDraft.companyId)?.companyName || '';

      const finalPrompt = [
        finalDraft.originalPrompt,
        `Role: ${finalDraft.jobTitle}.`,
        `Openings: ${finalDraft.openings}.`,
        companyName ? `Company: ${companyName}.` : '',
        finalDraft.location ? `Location: ${finalDraft.location}.` : '',
        finalDraft.salary ? `Expected salary: ${finalDraft.salary}.` : '',
        finalDraft.qualification ? `Qualification required: ${finalDraft.qualification}.` : '',
        finalDraft.workMode ? `Work mode: ${finalDraft.workMode}.` : '',
        'Generate Job Title, Number Of Openings, Company, Location, Work mode, Salary, Job Summary, Key Responsibilities, Qualifications and Experience, and Compensation & Benefits.',
      ]
        .filter(Boolean)
        .join(' ');

      await handleAiAssist(finalPrompt, finalDraft);
      pushAiMessage('Done. I filled the job fields and created the JD for this role.');
      setAiQuestionStep('done');
      return;
    }

    if (aiQuestionStep === 'done') {
      resetAiConversation();
      setAiPrompt(input);
    }
  };

  const handleConnectLinkedIn = async () => {
    try {
      await linkedIn.connect();
    } catch (error) {
      console.error('Failed to connect LinkedIn:', error);
    }
  };

  const handleSaveJob = async () => {
    // Validate required fields
    if (!formData.jobTitle.trim()) {
      void requestWarning('Job Title is required');
      return;
    }
    if (!formData.companyId) {
      void requestWarning('Company is required');
      return;
    }
    if (!formData.numberOfOpenings) {
      void requestWarning('Number of Openings is required');
      return;
    }
    if (!formData.country.trim()) {
      void requestWarning('Country is required');
      return;
    }
    if (!formData.targetHireDate) {
      void requestWarning('Target Hire Date is required');
      return;
    }

    try {
      setLoading(true);
      
      // Map UI form values to API payload
      const parsedMinExp = parseInt(String(formData.minExperience).replace(/\D/g, ''), 10);
      const parsedMaxExp = parseInt(String(formData.maxExperience).replace(/\D/g, ''), 10);
      const payMin = formData.payRangeMin !== '' ? Number(formData.payRangeMin) : formData.minSalary !== '' ? Number(formData.minSalary) : NaN;
      const payMax = formData.payRangeMax !== '' ? Number(formData.payRangeMax) : formData.maxSalary !== '' ? Number(formData.maxSalary) : NaN;

      const locationParts = [formData.city, formData.state, formData.country].map((v) => v?.trim()).filter(Boolean);
      const composedLocation = locationParts.join(', ') || formData.jobLocation || undefined;

      // Map UI job type to backend enum
      const mapJobType = (value: string): CreateJobData['type'] => {
        const v = value.toLowerCase();
        if (v.includes('full')) return 'FULL_TIME';
        if (v.includes('part')) return 'PART_TIME';
        if (v.includes('contract')) return 'CONTRACT';
        if (v.includes('intern')) return 'INTERNSHIP';
        return 'FULL_TIME';
      };

      const toList = (value: string) =>
        value
          .split('\n')
          .map((item) => item.replace(/^[\-\u2022]\s*/, '').trim())
          .filter(Boolean);

      const keyResponsibilities = toList(formData.keyResponsibilitiesText);
      const qualifications = toList(formData.qualificationsExperienceText);
      const benefits = toList(formData.compensationBenefitsText);
      const composedDescription = [
        `<h2>${formData.jobTitle.trim()}</h2>`,
        formData.jobSummary.trim() ? `<p>${formData.jobSummary.trim()}</p>` : '',
        keyResponsibilities.length
          ? `<h3>Key Responsibilities</h3><ul>${keyResponsibilities.map((item) => `<li>${item}</li>`).join('')}</ul>`
          : '',
        qualifications.length
          ? `<h3>Qualifications and Experience</h3><ul>${qualifications.map((item) => `<li>${item}</li>`).join('')}</ul>`
          : '',
        benefits.length
          ? `<h3>Compensation & Benefits</h3><ul>${benefits.map((item) => `<li>${item}</li>`).join('')}</ul>`
          : '',
      ]
        .filter(Boolean)
        .join('');

      const applicationFormLogoStored =
        formData.logoOption === 'custom' && formData.applicationLogoUrl.trim()
          ? formData.applicationLogoUrl.trim()
          : ['account', 'company', 'none'].includes(formData.logoOption)
            ? formData.logoOption
            : formData.logoOption === 'custom'
              ? 'none'
              : 'account';

      const jobData: CreateJobData = {
        title: formData.jobTitle,
        description: formData.jobDescriptionHtml.trim() || composedDescription,
        overview: formData.jobSummary || undefined,
        clientId: formData.companyId,
        openings: parseInt(formData.numberOfOpenings) || 1,
        // Core job fields
        type: mapJobType(formData.employmentType || formData.jobType),
        status: 'OPEN',
        location: composedLocation,
        requirements: qualifications,
        skills: formData.skills,
        priority: formData.priority || undefined,
        nationality: formData.nationality.trim() || undefined,
        country: formData.country.trim() || undefined,
        state: formData.state.trim() || undefined,
        city: formData.city.trim() || undefined,
        forecastRevenue: formData.forecastRevenue.trim() || undefined,
        videoMediaLink: formData.videoMediaLink.trim() || undefined,
        languages: formData.languages
          .map((row) => ({
            language: row.language.trim(),
            proficiency: row.proficiency.trim(),
          }))
          .filter((row) => row.language),
        managerId: formData.managerId || undefined,
        hiringManager: formData.contactPersonName.trim() || undefined,
        hiringManagerId: formData.contactPersonId || undefined,
        jobCategory: formData.industryType.trim() || undefined,
        expectedClosureDate: formData.targetHireDate || undefined,
        keyResponsibilities,
        experienceRequired:
          Number.isFinite(parsedMinExp) || Number.isFinite(parsedMaxExp)
            ? `${Number.isFinite(parsedMinExp) ? parsedMinExp : ''}${Number.isFinite(parsedMaxExp) ? `-${parsedMaxExp}` : ''}`.trim()
            : undefined,
        // Combine qualification and specialization for education field
        education: formData.educationalQualification 
          ? (formData.educationalSpecialization 
              ? `${formData.educationalQualification} - ${formData.educationalSpecialization}`
              : formData.educationalQualification)
          : undefined,
        salary: (() => {
          const hasMin = Number.isFinite(payMin);
          const hasMax = Number.isFinite(payMax);
          if (!hasMin && !hasMax && !formData.salaryInput) return undefined;
          return {
            min: hasMin ? payMin : undefined,
            max: hasMax ? payMax : undefined,
            currency: normalizeJobSalaryCurrency(formData.currency) || undefined,
            type: formData.salaryType || undefined,
            amount: formData.salaryInput || undefined,
          };
        })(),
        benefits,
        jobLocationType: formData.jobLocationType || undefined,
        workMode: formData.jobLocationType || undefined,
        applicationFormEnabled: formData.enableApplicationForm,
        applicationFormLogo: applicationFormLogoStored,
        applicationFormQuestions: formData.applicationQuestions
          .filter((q) => q.label.trim().length > 0)
          .map((q) => serializeScreeningQuestion(q)),
        applicationFormNote: formData.noteForCandidates.trim() ? formData.noteForCandidates.trim() : undefined,
        // Store JD file name if file was uploaded
        jdFileName: uploadedFile?.name || undefined,
        assignedToId: isEditMode
          ? formData.assignedToId
            ? formData.assignedToId
            : null
          : formData.assignedToId || undefined,
      };

      let createdJobId: string | undefined;
      if (isEditMode && jobId) {
        await apiUpdateJob(jobId, jobData);
        createdJobId = jobId;
        onJobUpdated?.();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('jobportal:jobs-changed'));
        }
      } else {
        const response = await apiCreateJob(jobData);
        createdJobId = (response as any).data?.id || (response as any).data?.data?.id || (response as any).id;
        onJobCreated?.();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('jobportal:jobs-changed'));
        }
      }

      // Post to social media if enabled
      const socialPosts: string[] = [];
      const platformsToPublish = {
        linkedin: formData.linkedInEnabled && linkedIn.isConnected,
        twitter: formData.twitterEnabled && formData.twitterConnected,
        facebook: formData.facebookEnabled && formData.facebookConnected,
      };

      if (Object.values(platformsToPublish).some(Boolean) && createdJobId) {
        try {
          const company = clients.find(c => c.id === formData.companyId);
          const companyName = company?.companyName || '';
          const applyUrl = formData.linkedInExternalUrl || `${window.location.origin}/jobs/${createdJobId}/apply`;
          
          const result = await apiPublishSocialJob({
            jobId: createdJobId,
            title: formData.jobTitle,
            companyName,
            description: formData.jobDescriptionHtml ? formData.jobDescriptionHtml.replace(/<[^>]*>/g, '') : undefined,
            applyUrl,
            location: formData.city || formData.fullAddress || undefined,
            platforms: platformsToPublish,
            linkedinPostText: linkedInPostText,
            twitterPostText: formData.twitterTweetText,
            facebookPostText: formData.facebookCaption,
          });

          if (platformsToPublish.linkedin && (result as any).data?.linkedin?.success) {
            socialPosts.push('LinkedIn');
            setLinkedInPostUrl((result as any).data.linkedin.linkedinPostUrl);
            setShowLinkedInSuccess(true);
            setTimeout(() => setShowLinkedInSuccess(false), 5000);
          }
          if (platformsToPublish.twitter) socialPosts.push('Twitter');
          if (platformsToPublish.facebook) socialPosts.push('Facebook');
        } catch (error: any) {
          console.error('Social publishing failed:', error);
        }
      }

      // Upload file if one was selected
      if (uploadedFile && createdJobId) {
        try {
          setUploadingFile(true);
          await apiUploadJobFile(createdJobId, uploadedFile, 'Other');
          console.log('Job description file uploaded successfully');
        } catch (error: any) {
          console.error('Failed to upload file:', error);
          // Don't block job save - file upload is optional
          void requestWarning(`Job saved successfully, but file upload failed: ${error.message}`);
        } finally {
          setUploadingFile(false);
          setUploadedFile(null);
        }
      }

      if (socialPosts.length > 0) {
        // Success message will be shown via toast/UI
        if (linkedInPostUrl) {
          // Show success toast with link
          console.log(`Job posted to LinkedIn: ${linkedInPostUrl}`);
        }
      }
      
      onClose();
    } catch (error: any) {
      console.error('Failed to save job:', error);
      void requestError(error.message || 'Failed to save job');
    } finally {
      setLoading(false);
    }
  };

  const addSkill = () => {
    if (skillInput.trim()) {
      setFormData(prev => ({ ...prev, skills: [...prev.skills, skillInput.trim()] }));
      setSkillInput('');
    }
  };

  const removeSkill = (index: number) => {
    setFormData(prev => ({ ...prev, skills: prev.skills.filter((_, i) => i !== index) }));
  };

  const handleApplicationLogoFileChange = async (
    source: React.ChangeEvent<HTMLInputElement> | File
  ) => {
    const file = source instanceof File ? source : source.target.files?.[0];
    if (!(source instanceof File) && source.target) source.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      void requestWarning('Please choose an image file (PNG, JPG, WebP, etc.)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      void requestWarning('Image must be 5MB or smaller.');
      return;
    }

    const target =
      isEditMode && jobId
        ? ({ entity: 'job' as const, id: jobId })
        : formData.companyId
          ? ({ entity: 'client' as const, id: formData.companyId })
          : null;

    if (!target) {
      void requestWarning('Select a company in Job Details first. When editing an existing job, you can upload without that step.');
      return;
    }

    try {
      setUploadingApplicationLogo(true);
      const res = await filesApiUpload(target.entity, target.id, file, 'APP_FORM_LOGO');
      const url = res.data?.fileUrl;
      if (!url) throw new Error('Upload succeeded but no file URL was returned.');
      setFormData((prev) => ({ ...prev, logoOption: 'custom', applicationLogoUrl: url }));
      logoUploadFeedback.markSuccess(file.name);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      logoUploadFeedback.markError(message);
      void requestInfo(message);
    } finally {
      setUploadingApplicationLogo(false);
    }
  };

  const patchJobDetailsForm = useCallback(
    (patch: Partial<CreateJobDetailsFormData> | ((prev: CreateJobDetailsFormData) => Partial<CreateJobDetailsFormData>)) => {
      setFormData((prev) => {
        const current: CreateJobDetailsFormData = {
          nationality: prev.nationality,
          jobTitle: prev.jobTitle,
          priority: prev.priority,
          companyId: prev.companyId,
          contactPersonId: prev.contactPersonId,
          contactPersonName: prev.contactPersonName,
          numberOfOpenings: prev.numberOfOpenings,
          country: prev.country,
          state: prev.state,
          city: prev.city,
          industryType: prev.industryType,
          employmentType: prev.employmentType,
          targetHireDate: prev.targetHireDate,
          minExperience: prev.minExperience,
          maxExperience: prev.maxExperience,
          payRangeMin: prev.payRangeMin,
          payRangeMax: prev.payRangeMax,
          salaryCurrency: prev.currency,
          languages: prev.languages,
          skills: prev.skills,
          videoMediaLink: prev.videoMediaLink,
          forecastRevenue: prev.forecastRevenue,
          managerId: prev.managerId,
          assignedToId: prev.assignedToId,
        };
        const nextPatch = typeof patch === 'function' ? patch(current) : patch;
        const merged = { ...prev, ...nextPatch };
        if (
          'payRangeMin' in nextPatch ||
          'payRangeMax' in nextPatch ||
          'salaryCurrency' in nextPatch
        ) {
          merged.minSalary = merged.payRangeMin;
          merged.maxSalary = merged.payRangeMax;
          const nextCurrency =
            typeof nextPatch === 'object' && nextPatch && 'salaryCurrency' in nextPatch
              ? String(nextPatch.salaryCurrency)
              : merged.currency;
          merged.currency = normalizeJobSalaryCurrency(nextCurrency);
        }
        return merged;
      });
    },
    []
  );

  const jobDetailsFormData: CreateJobDetailsFormData = {
    nationality: formData.nationality,
    jobTitle: formData.jobTitle,
    priority: formData.priority,
    companyId: formData.companyId,
    contactPersonId: formData.contactPersonId,
    contactPersonName: formData.contactPersonName,
    numberOfOpenings: formData.numberOfOpenings,
    country: formData.country,
    state: formData.state,
    city: formData.city,
    industryType: formData.industryType,
    employmentType: formData.employmentType,
    targetHireDate: formData.targetHireDate,
    minExperience: formData.minExperience,
    maxExperience: formData.maxExperience,
    payRangeMin: formData.payRangeMin,
    payRangeMax: formData.payRangeMax,
    salaryCurrency: formData.currency,
    languages: formData.languages,
    skills: formData.skills,
    videoMediaLink: formData.videoMediaLink,
    forecastRevenue: formData.forecastRevenue,
    managerId: formData.managerId,
    assignedToId: formData.assignedToId,
  };

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
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
            className="fixed right-0 top-0 h-full w-3/4 max-w-6xl bg-white shadow-2xl z-50 pointer-events-auto border-l border-slate-200 flex flex-col"
          >
            {/* Sticky Header */}
            <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{isEditMode ? 'Edit Job' : 'Add Job'}</h2>
                <p className="text-sm text-slate-500">
                  {isEditMode
                    ? 'Update job details, description, and publishing options.'
                    : 'Upload a JD or generate one with AI, then complete the job details.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto bg-slate-50/30 p-6">
              {/* Section 1: Job Details */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-4">
                <button
                  type="button"
                  onClick={() => toggleAccordion('details')}
                  className="w-full px-5 py-4 flex items-center justify-between border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                >
                  <span className="text-sm font-bold text-slate-900">1. Job Details</span>
                  {accordions.find(a => a.id === 'details')?.isOpen ? (
                    <ChevronUp size={18} className="text-slate-400" />
                  ) : (
                    <ChevronDown size={18} className="text-slate-400" />
                  )}
                </button>
                {accordions.find(a => a.id === 'details')?.isOpen && (
                  <div className="p-5 space-y-6">
                    {!isEditMode ? (
                      <CreateJobEntryOptions
                        onJdFile={handleJdFromFile}
                        onGenerateWithAi={openAiPromptBox}
                        disabled={loading || loadingJob}
                        extracting={isExtractingJd || aiGenerating}
                        generating={aiGenerating}
                      />
                    ) : null}

                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Job Description{' '}
                        <span className="font-normal text-slate-500">(optional)</span>
                      </h3>
                      <p className="mt-1 mb-3 text-xs text-slate-500">
                        {isEditMode
                          ? 'Rich-text editor for the full posting.'
                          : 'Rich-text editor for the full posting. Upload a JD above or use Generate JD with AI to pre-fill this field.'}
                      </p>
                      {isOpen ? (
                        <RichTextEditor
                          value={formData.jobDescriptionHtml}
                          onChange={(html) => setFormData((prev) => ({ ...prev, jobDescriptionHtml: html }))}
                          placeholder="Enter the full job description…"
                          minHeight={360}
                        />
                      ) : null}
                    </div>

                    <div className="border-t border-slate-100" />

                    <CreateJobDetailsForm
                      formData={jobDetailsFormData}
                      setFormData={patchJobDetailsForm}
                      clients={clients}
                      users={users}
                      contacts={contacts}
                      loadingClients={loadingClients}
                      loadingUsers={loadingUsers}
                      loadingContacts={loadingContacts}
                      dropdownsOpen={dropdownsOpen}
                      setDropdownsOpen={setDropdownsOpen}
                      skillInput={skillInput}
                      setSkillInput={setSkillInput}
                      onAddSkill={addSkill}
                      onRemoveSkill={removeSkill}
                      uploadedFile={uploadedFile}
                      setUploadedFile={setUploadedFile}
                      existingOtherDocName={existingOtherDocName}
                      uploadingFile={uploadingFile}
                    />
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-4">
                <button
                  type="button"
                  onClick={() => toggleAccordion('application')}
                  className="w-full px-5 py-4 flex items-center justify-between border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                >
                  <span className="text-sm font-bold text-slate-900">2. Job Application Form</span>
                  {accordions.find(a => a.id === 'application')?.isOpen ? (
                    <ChevronUp size={18} className="text-slate-400" />
                  ) : (
                    <ChevronDown size={18} className="text-slate-400" />
                  )}
                </button>
                {accordions.find(a => a.id === 'application')?.isOpen && (
                  <div className="p-5 space-y-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.enableApplicationForm}
                        onChange={(e) => setFormData(prev => ({ ...prev, enableApplicationForm: e.target.checked }))}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-slate-700">
                        Enable Job Application Form
                        <span className="text-xs text-slate-500 ml-1">(Required To Post On Partner Job Boards)</span>
                      </span>
                    </label>

                    {formData.enableApplicationForm && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">Logo selection</label>
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="logoOption"
                                value="account"
                                checked={formData.logoOption === 'account'}
                                onChange={(e) => {
                                  const v = e.target.value as ApplicationLogoOption;
                                  setFormData((prev) => ({
                                    ...prev,
                                    logoOption: v,
                                    applicationLogoUrl: '',
                                  }));
                                }}
                                className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-700">Your Account Logo</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="logoOption"
                                value="company"
                                checked={formData.logoOption === 'company'}
                                onChange={(e) => {
                                  const v = e.target.value as ApplicationLogoOption;
                                  setFormData((prev) => ({
                                    ...prev,
                                    logoOption: v,
                                    applicationLogoUrl: '',
                                  }));
                                }}
                                className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-700">Job's Company Logo</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="logoOption"
                                value="none"
                                checked={formData.logoOption === 'none'}
                                onChange={(e) => {
                                  const v = e.target.value as ApplicationLogoOption;
                                  setFormData((prev) => ({
                                    ...prev,
                                    logoOption: v,
                                    applicationLogoUrl: '',
                                  }));
                                }}
                                className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-700">No logo</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="logoOption"
                                value="custom"
                                checked={formData.logoOption === 'custom'}
                                onChange={(e) => {
                                  const v = e.target.value as ApplicationLogoOption;
                                  setFormData((prev) => ({
                                    ...prev,
                                    logoOption: v,
                                    applicationLogoUrl: v === 'custom' ? prev.applicationLogoUrl : '',
                                  }));
                                }}
                                className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-700">Uploaded logo (Cloudinary)</span>
                            </label>
                          </div>

                          <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
                            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                              <DocumentUploadButton
                                variant="secondary"
                                label="Upload logo"
                                uploadingLabel="Uploading"
                                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                                isUploading={uploadingApplicationLogo}
                                uploadSuccess={logoUploadFeedback.uploadSuccess}
                                uploadPercent={logoUploadFeedback.uploadPercent}
                                onFilesSelected={async (files) => {
                                  const file = files[0];
                                  if (file) await handleApplicationLogoFileChange(file);
                                }}
                              />
                              <p className="text-xs text-slate-500 max-w-md">
                                Images are stored in <span className="font-medium text-slate-600">Cloudinary</span> via your API.
                                {isEditMode && jobId
                                  ? ' Upload is attached to this job.'
                                  : ' Select a company in Job Details first so the file can be uploaded under that client.'}
                              </p>
                            </div>
                            {formData.applicationLogoUrl ? (
                              <div className="flex flex-wrap items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                                <img
                                  src={formData.applicationLogoUrl}
                                  alt="Uploaded application form logo"
                                  className="h-20 max-h-24 w-auto max-w-[220px] rounded-lg border border-slate-200 bg-white object-contain p-1"
                                />
                                <div className="flex flex-col gap-2">
                                  <p className="text-xs font-medium text-slate-600">Preview</p>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setFormData((prev) => ({
                                        ...prev,
                                        applicationLogoUrl: '',
                                        logoOption: prev.logoOption === 'custom' ? 'none' : prev.logoOption,
                                      }))
                                    }
                                    className="self-start text-xs font-semibold text-red-600 hover:text-red-700"
                                  >
                                    Remove uploaded logo
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-slate-700">Job Application Form Questions</label>
                            <span className="text-xs text-slate-500">Shown to candidates when they click Apply</span>
                          </div>

                          {formData.applicationQuestions.length > 0 ? (
                            <div className="space-y-3">
                              {formData.applicationQuestions.map((question, index) => {
                                const updateQuestion = (patch: Partial<ScreeningQuestion>) => {
                                  setFormData((prev) => ({
                                    ...prev,
                                    applicationQuestions: prev.applicationQuestions.map((q, i) =>
                                      i === index ? { ...q, ...patch } : q
                                    ),
                                  }));
                                };
                                const removeQuestion = () => {
                                  setFormData((prev) => ({
                                    ...prev,
                                    applicationQuestions: prev.applicationQuestions.filter((_, i) => i !== index),
                                  }));
                                };
                                const setOption = (optionIndex: number, value: string) => {
                                  const next = [...(question.options || [])];
                                  next[optionIndex] = value;
                                  updateQuestion({ options: next });
                                };
                                const addOption = () => {
                                  updateQuestion({ options: [...(question.options || []), ''] });
                                };
                                const removeOption = (optionIndex: number) => {
                                  updateQuestion({
                                    options: (question.options || []).filter((_, i) => i !== optionIndex),
                                  });
                                };
                                return (
                                  <div
                                    key={question.id}
                                    className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                                  >
                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                      <span className="text-xs font-semibold text-slate-500">#{index + 1}</span>
                                      <select
                                        value={question.type}
                                        onChange={(e) => {
                                          const nextType = e.target.value as ScreeningQuestionType;
                                          const patch: Partial<ScreeningQuestion> = { type: nextType };
                                          if (nextType === 'single_choice' && !(question.options && question.options.length)) {
                                            patch.options = ['', ''];
                                          }
                                          if (nextType === 'slider') {
                                            if (typeof question.min !== 'number') patch.min = 0;
                                            if (typeof question.max !== 'number') patch.max = 100;
                                            if (typeof question.step !== 'number') patch.step = 1;
                                            if (!question.minLabel) patch.minLabel = 'Beginner';
                                            if (!question.maxLabel) patch.maxLabel = 'Expert';
                                          }
                                          updateQuestion(patch);
                                        }}
                                        className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                      >
                                        {SCREENING_TYPE_OPTIONS.map((opt) => (
                                          <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                          </option>
                                        ))}
                                      </select>
                                      <label className="ml-auto inline-flex items-center gap-1.5 text-xs text-slate-600">
                                        <input
                                          type="checkbox"
                                          checked={!!question.required}
                                          onChange={(e) => updateQuestion({ required: e.target.checked })}
                                          className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        Required
                                      </label>
                                      <button
                                        type="button"
                                        onClick={removeQuestion}
                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                        title="Delete question"
                                      >
                                        <X size={16} />
                                      </button>
                                    </div>

                                    <input
                                      type="text"
                                      value={question.label}
                                      onChange={(e) => updateQuestion({ label: e.target.value })}
                                      placeholder="Type your question here…"
                                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    />

                                    <p className="mt-1 text-[11px] text-slate-500">
                                      {SCREENING_TYPE_OPTIONS.find((o) => o.value === question.type)?.hint}
                                    </p>

                                    {question.type === 'single_choice' && (
                                      <div className="mt-3 space-y-2">
                                        <p className="text-xs font-medium text-slate-600">Options</p>
                                        {(question.options || []).map((opt, optionIndex) => (
                                          <div key={optionIndex} className="flex items-center gap-2">
                                            <input
                                              type="text"
                                              value={opt}
                                              onChange={(e) => setOption(optionIndex, e.target.value)}
                                              placeholder={`Option ${optionIndex + 1}`}
                                              className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                            />
                                            <button
                                              type="button"
                                              onClick={() => removeOption(optionIndex)}
                                              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                              title="Remove option"
                                            >
                                              <X size={14} />
                                            </button>
                                          </div>
                                        ))}
                                        <button
                                          type="button"
                                          onClick={addOption}
                                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                                        >
                                          <Plus size={14} /> Add option
                                        </button>
                                      </div>
                                    )}

                                    {question.type === 'slider' && (
                                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                        <div>
                                          <label className="block text-[11px] font-medium text-slate-600 mb-1">Min value</label>
                                          <input
                                            type="number"
                                            value={typeof question.min === 'number' ? question.min : 0}
                                            onChange={(e) => updateQuestion({ min: Number(e.target.value) })}
                                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[11px] font-medium text-slate-600 mb-1">Max value</label>
                                          <input
                                            type="number"
                                            value={typeof question.max === 'number' ? question.max : 100}
                                            onChange={(e) => updateQuestion({ max: Number(e.target.value) })}
                                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[11px] font-medium text-slate-600 mb-1">Min label</label>
                                          <input
                                            type="text"
                                            value={question.minLabel || ''}
                                            onChange={(e) => updateQuestion({ minLabel: e.target.value })}
                                            placeholder="Beginner"
                                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[11px] font-medium text-slate-600 mb-1">Max label</label>
                                          <input
                                            type="text"
                                            value={question.maxLabel || ''}
                                            onChange={(e) => updateQuestion({ maxLabel: e.target.value })}
                                            placeholder="Expert"
                                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                          />
                                        </div>
                                      </div>
                                    )}

                                    {question.type === 'yes_no' && (
                                      <p className="mt-2 text-[11px] text-slate-500">
                                        Candidates will see two buttons: <span className="font-medium">Yes</span> and{' '}
                                        <span className="font-medium">No</span>.
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-500 italic">No questions added yet.</p>
                          )}

                          <div className="mt-3 flex flex-wrap gap-2">
                            {SCREENING_TYPE_OPTIONS.map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                  const base: ScreeningQuestion = {
                                    id: generateScreeningQuestionId(),
                                    type: opt.value,
                                    label: '',
                                    required: false,
                                  };
                                  if (opt.value === 'single_choice') base.options = ['', ''];
                                  if (opt.value === 'slider') {
                                    base.min = 0;
                                    base.max = 100;
                                    base.step = 1;
                                    base.minLabel = 'Beginner';
                                    base.maxLabel = 'Expert';
                                  }
                                  setFormData((prev) => ({
                                    ...prev,
                                    applicationQuestions: [...prev.applicationQuestions, base],
                                  }));
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:border-blue-500 hover:text-blue-600 transition-colors"
                              >
                                <Plus size={14} /> {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Note For Candidates
                            <span className="text-xs text-slate-500 ml-1">(Required To Post On Partner Job Boards, If Job Description Is Not Provided In Text Format)</span>
                          </label>
                          <textarea
                            value={formData.noteForCandidates}
                            onChange={(e) => setFormData(prev => ({ ...prev, noteForCandidates: e.target.value }))}
                            rows={4}
                            placeholder="Add a note for candidates..."
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y"
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Section 3: Publish & Share */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-4">
                <button
                  type="button"
                  onClick={() => toggleAccordion('publish')}
                  className="w-full px-5 py-4 flex items-center justify-between border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                >
                  <span className="text-sm font-bold text-slate-900">3. Publish & Share</span>
                  {accordions.find(a => a.id === 'publish')?.isOpen ? (
                    <ChevronUp size={18} className="text-slate-400" />
                  ) : (
                    <ChevronDown size={18} className="text-slate-400" />
                  )}
                </button>
                {accordions.find(a => a.id === 'publish')?.isOpen && (
                  <div className="p-5 space-y-4">
                    {/* LinkedIn Card */}
                    <div className="border border-slate-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                            <Linkedin size={20} className="text-blue-600" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">LinkedIn</h4>
                            <p className="text-xs text-slate-500">Post to LinkedIn Jobs</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.linkedInEnabled}
                            onChange={(e) => setFormData(prev => ({ ...prev, linkedInEnabled: e.target.checked }))}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>

                      {formData.linkedInEnabled && (
                        <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                          {/* LinkedIn Connection Component */}
                          <LinkedInConnect />

                          {/* Show LinkedIn post preview and options when connected */}
                          {linkedIn.isConnected && linkedIn.linkedinUser && (
                            <>
                              {/* LinkedIn Post Preview */}
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                  LinkedIn Post Preview
                                  <span className="text-xs text-slate-500 ml-1">({linkedInPostText.length}/700 chars)</span>
                                </label>
                                <LinkedInPostPreview
                                  userName={linkedIn.linkedinUser.name}
                                  userPicture={linkedIn.linkedinUser.picture}
                                  jobTitle={formData.jobTitle}
                                  company={clients.find(c => c.id === formData.companyId)?.companyName || ''}
                                  description={formData.jobDescriptionHtml ? formData.jobDescriptionHtml.replace(/<[^>]*>/g, '') : undefined}
                                  applyUrl={formData.linkedInExternalUrl || `${window.location.origin}/jobs/[jobId]/apply`}
                                  location={formData.city || formData.fullAddress || undefined}
                                />
                              </div>

                              {/* Editable Post Text */}
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                  Edit Post Text
                                  <span className="text-xs text-slate-500 ml-1">({linkedInPostText.length}/700 chars)</span>
                                </label>
                                <textarea
                                  value={linkedInPostText}
                                  onChange={(e) => {
                                    const text = e.target.value.substring(0, 700);
                                    setLinkedInPostText(text);
                                  }}
                                  rows={6}
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y"
                                  placeholder="LinkedIn post text will be auto-generated..."
                                />
                              </div>

                              {/* Apply URL */}
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Application URL</label>
                                <input
                                  type="url"
                                  value={formData.linkedInExternalUrl}
                                  onChange={(e) => setFormData(prev => ({ ...prev, linkedInExternalUrl: e.target.value }))}
                                  placeholder="https://yourcompany.com/apply"
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                                <p className="text-xs text-slate-500 mt-1">This will be posted to your LinkedIn feed when you save the job</p>
                              </div>

                              {/* Success Toast */}
                              {showLinkedInSuccess && linkedInPostUrl && (
                                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Check size={16} className="text-green-600" />
                                    <span className="text-sm font-medium text-green-700">Posted to LinkedIn successfully!</span>
                                  </div>
                                  <a
                                    href={linkedInPostUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:text-blue-700 underline flex items-center gap-1"
                                  >
                                    View post on LinkedIn
                                    <ExternalLink size={12} />
                                  </a>
                                </div>
                              )}

                              {/* Error Display */}
                              {linkedIn.error && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                  <div className="flex items-center gap-2">
                                    <AlertCircle size={16} className="text-red-600" />
                                    <span className="text-sm text-red-700">{linkedIn.error}</span>
                                  </div>
                                  {linkedIn.error.includes('expired') && (
                                    <button
                                      type="button"
                                      onClick={handleConnectLinkedIn}
                                      className="mt-2 text-xs text-blue-600 hover:text-blue-700 underline"
                                    >
                                      Reconnect LinkedIn
                                    </button>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Twitter/X Card */}
                    <div className="border border-slate-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center">
                            <Twitter size={20} className="text-slate-900" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">Twitter / X</h4>
                            <p className="text-xs text-slate-500">Post job announcement to X</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.twitterEnabled}
                            onChange={(e) => setFormData(prev => ({ ...prev, twitterEnabled: e.target.checked }))}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>

                      {formData.twitterEnabled && (
                        <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                          {!formData.twitterConnected ? (
                            <button
                              type="button"
                              className="w-full px-4 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors text-sm font-medium"
                            >
                              Connect X Account
                            </button>
                          ) : (
                            <>
                              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                                <Check size={16} className="text-green-600" />
                                <span className="text-sm text-green-700">Connected</span>
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                  Tweet text
                                  <span className="text-xs text-slate-500 ml-1">({formData.twitterTweetText.length}/280 chars)</span>
                                </label>
                                <textarea
                                  value={formData.twitterTweetText}
                                  onChange={(e) => {
                                    const text = e.target.value.substring(0, 280);
                                    setFormData(prev => ({ ...prev, twitterTweetText: text }));
                                  }}
                                  rows={3}
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y"
                                />
                              </div>

                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={formData.twitterIncludeLogo}
                                  onChange={(e) => setFormData(prev => ({ ...prev, twitterIncludeLogo: e.target.checked }))}
                                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm text-slate-700">Include company logo image</span>
                              </label>

                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Schedule tweet (optional)</label>
                                <input
                                  type="datetime-local"
                                  min={getLocalDateTimeInputMinNow()}
                                  value={formData.twitterScheduleDate}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    const min = getLocalDateTimeInputMinNow();
                                    setFormData((prev) => ({
                                      ...prev,
                                      twitterScheduleDate: v ? clampDateTimeLocalToMin(v, min) : '',
                                    }));
                                  }}
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                              </div>

                              <button
                                type="button"
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-100 transition-colors text-sm font-medium"
                              >
                                Preview Tweet
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Facebook Card */}
                    <div className="border border-slate-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                            <Facebook size={20} className="text-blue-600" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">Facebook</h4>
                            <p className="text-xs text-slate-500">Post to Facebook Page</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.facebookEnabled}
                            onChange={(e) => setFormData(prev => ({ ...prev, facebookEnabled: e.target.checked }))}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>

                      {formData.facebookEnabled && (
                        <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                          {!formData.facebookConnected ? (
                            <button
                              type="button"
                              className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium"
                            >
                              Connect Facebook Page
                            </button>
                          ) : (
                            <>
                              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                                <Check size={16} className="text-green-600" />
                                <span className="text-sm text-green-700">Connected</span>
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Page selector</label>
                                <select
                                  value={formData.facebookPageId}
                                  onChange={(e) => setFormData(prev => ({ ...prev, facebookPageId: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                >
                                  <option value="">Select page</option>
                                  <option value="page1">Company Page 1</option>
                                  <option value="page2">Company Page 2</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Post caption</label>
                                <textarea
                                  value={formData.facebookCaption}
                                  onChange={(e) => setFormData(prev => ({ ...prev, facebookCaption: e.target.value }))}
                                  rows={4}
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y"
                                />
                              </div>

                              <button
                                type="button"
                                className="w-full px-4 py-2.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl hover:bg-blue-100 transition-colors text-sm font-medium"
                              >
                                Preview Post
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* WhatsApp Card */}
                    <div className="border border-slate-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                            <WhatsAppIcon size={20} className="text-green-600" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">WhatsApp Business</h4>
                            <p className="text-xs text-slate-500">Send via WhatsApp Broadcast</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.whatsappEnabled}
                            onChange={(e) => setFormData(prev => ({ ...prev, whatsappEnabled: e.target.checked }))}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>

                      {formData.whatsappEnabled && (
                        <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">WhatsApp Business API phone number</label>
                            <input
                              type="tel"
                              value={formData.whatsappPhoneNumber}
                              onChange={(e) => setFormData(prev => ({ ...prev, whatsappPhoneNumber: e.target.value }))}
                              placeholder="+1234567890"
                              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Message template</label>
                            <select
                              value={formData.whatsappTemplate}
                              onChange={(e) => setFormData(prev => ({ ...prev, whatsappTemplate: e.target.value }))}
                              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            >
                              <option value="">Select template</option>
                              <option>Job Opening Template 1</option>
                              <option>Job Opening Template 2</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Recipient list</label>
                            <input
                              type="text"
                              placeholder="Enter phone numbers or import CSV"
                              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sticky Footer */}
            <div className="shrink-0 border-t border-slate-200 bg-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-sm font-medium text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Close
                </button>
              </div>
              <button
                type="button"
                onClick={handleSaveJob}
                disabled={loading}
                className="px-6 py-2.5 text-sm font-medium text-white bg-green-600 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : 'Save Job'}
              </button>
            </div>
          </motion.div>

          <AnimatePresence>
            {showAiPromptBox && (
              <motion.div
                key="ai-panel"
                initial={{ x: '100%', opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 26, stiffness: 210 }}
                onClick={(e) => e.stopPropagation()}
                className="fixed right-0 top-0 z-[70] h-full w-3/4 max-w-6xl border-l border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)] pointer-events-auto flex flex-col "
              >
                <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">AI Drawer</p>
                    <h3 className="mt-1 text-base font-bold text-slate-900">Generate Job Description</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Use a custom prompt and generate the description with AI.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAiPromptBox(false)}
                    className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Close AI drawer"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="flex-1 overflow-hidden bg-slate-50">
                  <div className="flex h-full flex-col">
                    <div className="flex-1 overflow-y-auto px-6 py-6">
                      <div className="space-y-4">
                        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                          <p className="text-[15px] leading-8 text-slate-600">
                            Ask AI to write a strong job description for this role. Include tone, skills, seniority,
                            work mode, responsibilities, or any hiring details you want. Press
                            <span className="mx-1 inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500">
                              Enter
                            </span>
                            to generate.
                          </p>
                        </div>

                        <div className="flex justify-start">
                          <div className="flex max-w-[92%] items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white shadow-sm">
                              AI
                            </div>
                            <div className="max-w-[88%] rounded-[22px] border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-slate-700 shadow-sm">
                              Role: <span className="font-semibold text-slate-900">{aiDetectedRole || formData.jobTitle || 'Will detect from your prompt'}</span>
                            </div>
                          </div>
                        </div>

                        {aiMessages.map((message) => (
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

                        {aiQuestionStep === 'company' ? (
                          <div className="flex justify-start">
                            <div className="flex max-w-[92%] items-start gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white shadow-sm">
                                AI
                              </div>
                              <div className="w-full max-w-[88%] rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
                                <label className="block text-sm font-medium text-slate-700 mb-2">Choose company</label>
                                <select
                                  value={aiDraftData.companyId}
                                  onChange={(e) => handleAiCompanySelect(e.target.value)}
                                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                >
                                  <option value="">Select company</option>
                                  {clients.map((client) => (
                                    <option key={client.id} value={client.id}>
                                      {client.companyName}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {aiDrawerError ? (
                          <div className="flex justify-start">
                            <div className="flex max-w-[92%] items-start gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white shadow-sm">
                                AI
                              </div>
                              <div className="max-w-[88%] rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
                                {aiDrawerError}
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {aiGenerating ? (
                          <div className="flex justify-start">
                            <div className="flex max-w-[92%] items-start gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white shadow-sm">
                                AI
                              </div>
                              <div className="max-w-[88%] rounded-[22px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500 shadow-sm">
                                Generating job description...
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {aiGeneratedDescription ? (
                          <div className="flex justify-start">
                            <div className="flex max-w-[92%] items-start gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white shadow-sm">
                                AI
                              </div>
                              <div className="max-w-[88%] rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Job Title</p>
                                      <p className="mt-2 text-sm font-medium text-slate-900">{formData.jobTitle || aiDraftData.jobTitle || '-'}</p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Openings</p>
                                      <p className="mt-2 text-sm font-medium text-slate-900">{formData.numberOfOpenings || aiDraftData.openings || '-'}</p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Company</p>
                                      <p className="mt-2 text-sm font-medium text-slate-900">
                                        {clients.find((client) => client.id === (formData.companyId || aiDraftData.companyId))?.companyName || '-'}
                                      </p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Location</p>
                                      <p className="mt-2 text-sm font-medium text-slate-900">{formData.jobLocation || aiDraftData.location || '-'}</p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Work Mode</p>
                                      <p className="mt-2 text-sm font-medium text-slate-900">{formData.jobLocationType || aiDraftData.workMode || '-'}</p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Salary</p>
                                      <p className="mt-2 text-sm font-medium text-slate-900">
                                        {(() => {
                                          const min = formData.minSalary;
                                          const max = formData.maxSalary;
                                          if (min && max) return `${formData.currency} ${min} - ${max}`;
                                          if (min) return `${formData.currency} ${min}`;
                                          if (max) return `${formData.currency} ${max}`;
                                          if (formData.salaryInput) return `${formData.currency} ${formData.salaryInput}`;
                                          return aiDraftData.salary || '-';
                                        })()}
                                      </p>
                                    </div>
                                  </div>

                                  {aiDescriptionView.title ? (
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                      <h4 className="text-xl font-semibold text-slate-900">{aiDescriptionView.title}</h4>
                                      {aiDescriptionView.intro.map((paragraph, index) => (
                                        <p key={`${paragraph}-${index}`} className="mt-3 text-sm leading-7 text-slate-600">
                                          {paragraph}
                                        </p>
                                      ))}
                                    </div>
                                  ) : null}

                                  {aiDescriptionView.sections.map((section) => (
                                    <div
                                      key={section.heading}
                                      className="rounded-2xl border border-slate-200 bg-white px-4 py-4"
                                    >
                                      <h5 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
                                        {section.heading}
                                      </h5>
                                      {section.paragraphs.map((paragraph, index) => (
                                        <p key={`${section.heading}-p-${index}`} className="mt-3 text-sm leading-7 text-slate-600">
                                          {paragraph}
                                        </p>
                                      ))}
                                      {section.items.length ? (
                                        <div className="mt-3 space-y-2">
                                          {section.items.map((item, index) => (
                                            <div
                                              key={`${section.heading}-i-${index}`}
                                              className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                                            >
                                              {item}
                                            </div>
                                          ))}
                                        </div>
                                      ) : null}
                                    </div>
                                  ))}

                                  {(aiGeneratedQualification || aiGeneratedSpecialization) ? (
                                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                                      <h5 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
                                        Education
                                      </h5>
                                      {aiGeneratedQualification ? (
                                        <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                                          Qualification: {aiGeneratedQualification}
                                        </div>
                                      ) : null}
                                      {aiGeneratedSpecialization ? (
                                        <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                                          Specialization: {aiGeneratedSpecialization}
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : null}

                        {aiGeneratedQuestions.length ? (
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                                      <h5 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
                                        Screening Questions
                                      </h5>
                                      <div className="mt-3 space-y-2">
                                        {aiGeneratedQuestions.map((question, index) => (
                                          <div
                                            key={`screening-question-${index}`}
                                            className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                                          >
                                            {index + 1}. {question}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : null}
                        <div ref={aiConversationEndRef} />
                      </div>
                    </div>

                    <div className="border-t border-slate-200 bg-white px-6 py-4">
                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          value={aiPrompt}
                          onChange={(e) => setAiPrompt(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleGenerateFromPromptBox();
                            }
                          }}
                          placeholder="Message the AI to generate the job description..."
                          className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                        <button
                          type="button"
                          onClick={handleGenerateFromPromptBox}
                          disabled={aiGenerating}
                          className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-400 text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="Generate now"
                        >
                          <SendHorizontal size={18} />
                        </button>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <span className="text-sm text-slate-500">
                          {aiGenerating ? 'Generating job description...' : aiGeneratedDescription ? 'Job description generated' : 'Ready to generate'}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowAiPromptBox(false)}
                            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                          >
                            Close
                          </button>
                          {aiGeneratedDescription ? (
                          <button
                            type="button"
                            onClick={handleFinalizeAiJob}
                            className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                          >
                            Finalize This Job
                            </button>
                          ) : null}
                        </div>
                      </div>
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
