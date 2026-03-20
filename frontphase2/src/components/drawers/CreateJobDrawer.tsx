'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  ChevronDown,
  ChevronUp,
  Plus,
  Check,
  Sparkles,
  Upload,
  Info,
  Linkedin,
  Twitter,
  Facebook,
  MessageCircle,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { apiCreateJob, apiUpdateJob, apiGetJob, apiGetClients, apiGetUsers, apiUploadJobFile, type CreateJobData, type BackendClient, type BackendUser } from '../../lib/api';
import { LinkedInConnect } from '../LinkedInConnect';
import { LinkedInPostPreview } from '../LinkedInPostPreview';
import { useLinkedIn } from '../../hooks/useLinkedIn';

export interface CreateJobDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onJobCreated?: () => void;
  jobId?: string;
  onJobUpdated?: () => void;
}

interface AccordionSection {
  id: 'details' | 'description' | 'application' | 'publish';
  label: string;
  isOpen: boolean;
}

export function CreateJobDrawer({ isOpen, onClose, onJobCreated, jobId, onJobUpdated }: CreateJobDrawerProps) {
  const isEditMode = !!jobId;
  const [loading, setLoading] = useState(false);
  const [loadingJob, setLoadingJob] = useState(false);
  const [clients, setClients] = useState<BackendClient[]>([]);
  const [users, setUsers] = useState<BackendUser[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [createNewDeal, setCreateNewDeal] = useState(false);
  const [linkedInPostText, setLinkedInPostText] = useState('');
  const [showLinkedInSuccess, setShowLinkedInSuccess] = useState(false);
  const [linkedInPostUrl, setLinkedInPostUrl] = useState<string | null>(null);

  // LinkedIn integration hook
  const linkedIn = useLinkedIn();

  // Accordion state
  const [accordions, setAccordions] = useState<AccordionSection[]>([
    { id: 'details', label: 'Job Details', isOpen: true },
    { id: 'description', label: 'Job Description', isOpen: false },
    { id: 'application', label: 'Job Application Form', isOpen: false },
    { id: 'publish', label: 'Publish & Share', isOpen: false },
  ]);

  // Form state - Section 1: Job Details
  const [formData, setFormData] = useState({
    // Job Details
    hiringPipeline: 'Master Hiring Pipeline',
    jobTitle: '',
    numberOfOpenings: '1',
    companyId: '',
    targetCompanies: [] as string[],
    
    // Job Description
    jobDescriptionHtml: '',
    jobType: 'Part Time',
    jobCategory: '',
    jobLocationType: '',
    minExperience: '0 Year',
    maxExperience: '',
    salaryType: 'Annual Salary',
    currency: 'Rupees (₹ - India)',
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
    ownerId: '',
    collaborators: [] as string[],
    jobFunction: '',
    jobIndustry: '',
    
    // Job Application Form
    enableApplicationForm: false,
    logoOption: 'account' as 'account' | 'company' | 'none',
    applicationQuestions: [] as string[],
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
  const [newQuestionInput, setNewQuestionInput] = useState('');
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);
  // JD file upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [existingJdFileName, setExistingJdFileName] = useState<string>('');
  const [dropdownsOpen, setDropdownsOpen] = useState({
    pipeline: false,
    company: false,
    targetCompanies: false,
    owner: false,
    collaborators: false,
    jobType: false,
    locationType: false,
    minExperience: false,
    maxExperience: false,
    salaryType: false,
    currency: false,
    qualification: false,
    jobFunction: false,
    jobIndustry: false,
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
        hiringPipeline: 'Master Hiring Pipeline',
        jobTitle: '',
        numberOfOpenings: '1',
        companyId: '',
        targetCompanies: [],
        jobDescriptionHtml: '',
        jobType: 'Part Time',
        jobCategory: '',
        jobLocationType: '',
        minExperience: '0 Year',
        maxExperience: '',
        salaryType: 'Annual Salary',
        currency: 'Rupees (₹ - India)',
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
        ownerId: '',
        collaborators: [],
        jobFunction: '',
        jobIndustry: '',
        enableApplicationForm: false,
        logoOption: 'account',
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
      setNewQuestionInput('');
      setEditingQuestionIndex(null);
      setUploadedFile(null);
      setExistingJdFileName('');
    }
  }, [isOpen]);

  // Load data on mount
  useEffect(() => {
    if (isOpen) {
      const loadData = async () => {
        // Always load clients and users first
        await Promise.all([loadClients(), loadUsers()]);
        // Then load job data if in edit mode
        if (isEditMode && jobId) {
          await loadJobData();
        }
      };
      loadData();
    }
  }, [isOpen, jobId, isEditMode]);

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
      const tweetText = `We're hiring a ${formData.jobTitle} at ${companyName}! Apply here: [application URL] #hiring ${formData.jobCategory ? `#${formData.jobCategory.replace(/\s+/g, '')}` : ''}`;
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

  const loadJobData = async () => {
    if (!jobId) return;
    try {
      setLoadingJob(true);
      const response = await apiGetJob(jobId);
      // Handle different response structures
      const job = response.data || (response as any);
      
      if (!job) {
        throw new Error('Job data not found');
      }
      
      // Parse salary from JSON
      const salary = job.salary || {};
      const salaryType = salary.type || 'Annual Salary';
      const currency = salary.currency || 'Rupees (₹ - India)';
      const minSalary = salary.min ? String(salary.min) : '';
      const maxSalary = salary.max ? String(salary.max) : '';
      
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
      
      // Parse distributionPlatforms JSON to extract jobFunction and jobIndustry
      let jobFunction = '';
      let jobIndustry = '';
      if (job.distributionPlatforms && typeof job.distributionPlatforms === 'object') {
        jobFunction = (job.distributionPlatforms as any).jobFunction || '';
        jobIndustry = (job.distributionPlatforms as any).jobIndustry || '';
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
      setExistingJdFileName(jdFileName);
      
      setFormData(prev => ({
        ...prev,
        jobTitle: job.title || '',
        companyId: job.clientId || '',
        numberOfOpenings: String(job.openings || 1),
        jobDescriptionHtml: job.description || '',
        jobType: mapJobTypeFromBackend(job.type),
        jobCategory: job.jobCategory || job.department || '',
        jobLocationType: job.jobLocationType || '',
        minExperience,
        maxExperience,
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
        ownerId: job.assignedToId || '',
        jobFunction,
        jobIndustry,
        enableApplicationForm: job.applicationFormEnabled || false,
        logoOption: (job.applicationFormLogo as 'account' | 'company' | 'none') || 'account',
        applicationQuestions: job.applicationFormQuestions || [],
        noteForCandidates: job.applicationFormNote || '',
      }));
      
      // Set JD file name if available (for display purposes)
      if (jdFileName) {
        // Note: We can't restore the actual file, but we can show the filename
        // The user would need to re-upload if they want to change it
      }
    } catch (error) {
      console.error('Failed to load job data:', error);
      alert('Failed to load job data. Please try again.');
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
      const response = await apiGetUsers({ isActive: true });
      if (response.data && Array.isArray(response.data)) {
        setUsers(response.data);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleAiAssist = async () => {
    if (!formData.jobTitle || !formData.companyId) {
      alert('Please fill in Job Title and Company first');
      return;
    }

    setAiGenerating(true);
    try {
      const company = clients.find(c => c.id === formData.companyId);
      const companyName = company?.companyName || '';
      
      const response = await fetch('/api/v1/ai/job-description', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({
          jobTitle: formData.jobTitle,
          company: companyName,
          jobType: formData.jobType,
          jobCategory: formData.jobCategory,
        }),
      });

      if (!response.ok) throw new Error('Failed to generate job description');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      let htmlContent = '';
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        htmlContent += chunk;
        
        // Update editor content as we stream
        setFormData(prev => ({ ...prev, jobDescriptionHtml: htmlContent }));
      }
    } catch (error: any) {
      console.error('AI Assist failed:', error);
      alert(error.message || 'Failed to generate job description');
    } finally {
      setAiGenerating(false);
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
      alert('Job Title is required');
      return;
    }
    if (!formData.companyId) {
      alert('Company is required');
      return;
    }
    if (!formData.numberOfOpenings) {
      alert('Number of Openings is required');
      return;
    }

    try {
      setLoading(true);
      
      // Map UI form values to API payload
      const parsedMinExp = parseInt(formData.minExperience) || undefined;
      const parsedMaxExp = parseInt(formData.maxExperience) || undefined;

      // Map UI job type to backend enum
      const mapJobType = (value: string): CreateJobData['type'] => {
        const v = value.toLowerCase();
        if (v.includes('full')) return 'FULL_TIME';
        if (v.includes('part')) return 'PART_TIME';
        if (v.includes('contract')) return 'CONTRACT';
        if (v.includes('intern')) return 'INTERNSHIP';
        return 'FULL_TIME';
      };

      const jobData: CreateJobData = {
        title: formData.jobTitle,
        description: formData.jobDescriptionHtml,
        clientId: formData.companyId,
        openings: parseInt(formData.numberOfOpenings) || 1,
        // Core job fields
        type: mapJobType(formData.jobType),
        status: 'OPEN',
        // Build location string from all location parts
        location: (() => {
          const parts = [];
          if (formData.locality) parts.push(formData.locality);
          if (formData.city) parts.push(formData.city);
          if (formData.state) parts.push(formData.state);
          if (formData.country) parts.push(formData.country);
          if (formData.postalCode) parts.push(formData.postalCode);
          return parts.length > 0 ? parts.join(', ') : (formData.fullAddress || undefined);
        })(),
        requirements: [], // can be enhanced later
        skills: formData.skills,
        experienceRequired:
          parsedMinExp !== undefined || parsedMaxExp !== undefined
            ? `${parsedMinExp ?? ''}${parsedMaxExp !== undefined ? `-${parsedMaxExp}` : ''}`.trim()
            : undefined,
        // Combine qualification and specialization for education field
        education: formData.educationalQualification 
          ? (formData.educationalSpecialization 
              ? `${formData.educationalQualification} - ${formData.educationalSpecialization}`
              : formData.educationalQualification)
          : undefined,
        // Salary as JSON
        salary:
          formData.minSalary || formData.maxSalary
            ? {
                type: formData.salaryType,
                currency: formData.currency,
                min: formData.minSalary ? Number(formData.minSalary) : undefined,
                max: formData.maxSalary ? Number(formData.maxSalary) : undefined,
              }
            : undefined,
        // Ownership
        assignedToId: formData.ownerId || undefined,
        // Application form
        applicationFormEnabled: formData.enableApplicationForm,
        applicationFormLogo: formData.logoOption,
        applicationFormQuestions: formData.applicationQuestions,
        applicationFormNote: formData.noteForCandidates || undefined,
        // UI-specific metadata stored on job
        department: formData.jobCategory || undefined,
        jobCategory: formData.jobCategory || undefined,
        jobLocationType: formData.jobLocationType || undefined,
        // Store additional fields in distributionPlatforms JSON
        distributionPlatforms: (() => {
          const distPlatforms: any = {};
          if (formData.locality) distPlatforms.locality = formData.locality;
          if (formData.postalCode) distPlatforms.postalCode = formData.postalCode;
          if (formData.jobFunction) distPlatforms.jobFunction = formData.jobFunction;
          if (formData.jobIndustry) distPlatforms.jobIndustry = formData.jobIndustry;
          if (formData.educationalSpecialization) distPlatforms.educationalSpecialization = formData.educationalSpecialization;
          if (formData.city) distPlatforms.city = formData.city;
          if (formData.state) distPlatforms.state = formData.state;
          if (formData.country) distPlatforms.country = formData.country;
          if (formData.fullAddress) distPlatforms.fullAddress = formData.fullAddress;
          return Object.keys(distPlatforms).length > 0 ? distPlatforms : undefined;
        })(),
        // Store JD file name if file was uploaded
        jdFileName: uploadedFile?.name || undefined,
      };

      let createdJobId: string | undefined;
      if (isEditMode && jobId) {
        await apiUpdateJob(jobId, jobData);
        createdJobId = jobId;
        onJobUpdated?.();
      } else {
        const response = await apiCreateJob(jobData);
        createdJobId = (response as any).data?.id || (response as any).data?.data?.id || (response as any).id;
        onJobCreated?.();
      }

      // Post to social media if enabled
      const socialPosts: string[] = [];
      
      if (formData.linkedInEnabled && linkedIn.isConnected && createdJobId) {
        try {
          const company = clients.find(c => c.id === formData.companyId);
          const companyName = company?.companyName || '';
          const applyUrl = formData.linkedInExternalUrl || `${window.location.origin}/jobs/${createdJobId}/apply`;
          
          const result = await linkedIn.postJob({
            jobTitle: formData.jobTitle,
            company: companyName,
            description: formData.jobDescriptionHtml ? formData.jobDescriptionHtml.replace(/<[^>]*>/g, '') : undefined,
            applyUrl,
            location: formData.city || formData.fullAddress || undefined,
            postText: linkedInPostText, // Use the edited post text
          });
          
          socialPosts.push('LinkedIn');
          setLinkedInPostUrl(result.linkedinPostUrl);
          setShowLinkedInSuccess(true);
          
          // Hide success message after 5 seconds
          setTimeout(() => setShowLinkedInSuccess(false), 5000);
        } catch (error: any) {
          console.error('LinkedIn post failed:', error);
          // Don't block job save - LinkedIn post is independent
        }
      }
      
      if (formData.twitterEnabled && formData.twitterConnected) {
        try {
          await postToTwitter();
          socialPosts.push('Twitter');
        } catch (error) {
          console.error('Twitter post failed:', error);
        }
      }
      
      if (formData.facebookEnabled && formData.facebookConnected) {
        try {
          await postToFacebook();
          socialPosts.push('Facebook');
        } catch (error) {
          console.error('Facebook post failed:', error);
        }
      }

      // Upload file if one was selected
      if (uploadedFile && createdJobId) {
        try {
          setUploadingFile(true);
          await apiUploadJobFile(createdJobId, uploadedFile, 'JD');
          console.log('Job description file uploaded successfully');
        } catch (error: any) {
          console.error('Failed to upload file:', error);
          // Don't block job save - file upload is optional
          alert(`Job saved successfully, but file upload failed: ${error.message}`);
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
      alert(error.message || 'Failed to save job');
    } finally {
      setLoading(false);
    }
  };


  const postToTwitter = async () => {
    const response = await fetch('/api/v1/social/twitter/post', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
      },
      body: JSON.stringify({
        text: formData.twitterTweetText,
        includeLogo: formData.twitterIncludeLogo,
        scheduleDate: formData.twitterScheduleDate,
      }),
    });
    
    if (!response.ok) throw new Error('Twitter post failed');
  };

  const postToFacebook = async () => {
    const response = await fetch('/api/v1/social/facebook/post', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
      },
      body: JSON.stringify({
        pageId: formData.facebookPageId,
        caption: formData.facebookCaption,
      }),
    });
    
    if (!response.ok) throw new Error('Facebook post failed');
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

  if (!isOpen) return null;

  const selectedCompany = clients.find(c => c.id === formData.companyId);
  const selectedOwner = users.find(u => u.id === formData.ownerId);

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
            className="fixed right-0 top-0 h-full w-[680px] bg-white shadow-2xl z-50 pointer-events-auto border-l border-slate-200 flex flex-col"
          >
            {/* Sticky Header */}
            <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">{isEditMode ? 'Edit Job' : 'Add Job'}</h2>
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X size={20} />
              </button>
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
                  <div className="p-5 space-y-4">
                    {/* Select Hiring Pipeline */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Select Hiring Pipeline <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={formData.hiringPipeline}
                          onChange={(e) => setFormData(prev => ({ ...prev, hiringPipeline: e.target.value }))}
                          className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                          <option>Master Hiring Pipeline</option>
                        </select>
                        <button
                          type="button"
                          className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                        >
                          <Plus size={18} />
                        </button>
                      </div>
                    </div>

                    {/* Job Title */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Job Title <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.jobTitle}
                        onChange={(e) => setFormData(prev => ({ ...prev, jobTitle: e.target.value }))}
                        placeholder="Customer Success Manager"
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>

                    {/* Number Of Openings */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Number Of Openings <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={formData.numberOfOpenings}
                        onChange={(e) => setFormData(prev => ({ ...prev, numberOfOpenings: e.target.value }))}
                        min="1"
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>

                    {/* Company */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Company <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <button
                            type="button"
                            onClick={() => setDropdownsOpen(prev => ({ ...prev, company: !prev.company }))}
                            className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-left text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          >
                            {selectedCompany ? (
                              <span>{selectedCompany.companyName}</span>
                            ) : (
                              <span className="text-slate-400">Search Companies</span>
                            )}
                            <ChevronDown size={16} className="text-slate-400" />
                          </button>
                          {dropdownsOpen.company && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setDropdownsOpen(prev => ({ ...prev, company: false }))} />
                              <ul className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg max-h-48 overflow-y-auto">
                                {loadingClients ? (
                                  <li className="px-4 py-2 text-sm text-slate-500">Loading...</li>
                                ) : clients.length === 0 ? (
                                  <li className="px-4 py-2 text-sm text-slate-500">No companies found</li>
                                ) : (
                                  clients.map((client) => (
                                    <li key={client.id}>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setFormData(prev => ({ ...prev, companyId: client.id }));
                                          setDropdownsOpen(prev => ({ ...prev, company: false }));
                                        }}
                                        className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${
                                          formData.companyId === client.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
                                        }`}
                                      >
                                        {client.companyName}
                                      </button>
                                    </li>
                                  ))
                                )}
                              </ul>
                            </>
                          )}
                        </div>
                        <button
                          type="button"
                          className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                        >
                          <Plus size={18} />
                        </button>
                      </div>
                    </div>

                    {/* Target Companies */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Target Companies</label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setDropdownsOpen(prev => ({ ...prev, targetCompanies: !prev.targetCompanies }))}
                          className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-left text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                          <span className="text-slate-400">
                            {formData.targetCompanies.length === 0 ? 'Select target companies' : `${formData.targetCompanies.length} selected`}
                          </span>
                          <ChevronDown size={16} className="text-slate-400" />
                        </button>
                        {dropdownsOpen.targetCompanies && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setDropdownsOpen(prev => ({ ...prev, targetCompanies: false }))} />
                            <ul className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg max-h-48 overflow-y-auto">
                              {clients.map((client) => (
                                <li key={client.id}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const isSelected = formData.targetCompanies.includes(client.id);
                                      setFormData(prev => ({
                                        ...prev,
                                        targetCompanies: isSelected
                                          ? prev.targetCompanies.filter(id => id !== client.id)
                                          : [...prev.targetCompanies, client.id],
                                      }));
                                    }}
                                    className={`w-full flex items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${
                                      formData.targetCompanies.includes(client.id) ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
                                    }`}
                                  >
                                    <span>{client.companyName}</span>
                                    {formData.targetCompanies.includes(client.id) && <Check size={16} />}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                      {formData.targetCompanies.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {formData.targetCompanies.map((companyId) => {
                            const company = clients.find(c => c.id === companyId);
                            return company ? (
                              <span
                                key={companyId}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm"
                              >
                                {company.companyName}
                                <button
                                  type="button"
                                  onClick={() => setFormData(prev => ({ ...prev, targetCompanies: prev.targetCompanies.filter(id => id !== companyId) }))}
                                  className="text-blue-700 hover:text-blue-900"
                                >
                                  <X size={14} />
                                </button>
                              </span>
                            ) : null;
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Section 2: Job Description */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-4">
                <button
                  type="button"
                  onClick={() => toggleAccordion('description')}
                  className="w-full px-5 py-4 flex items-center justify-between border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                >
                  <span className="text-sm font-bold text-slate-900">2. Job Description</span>
                  {accordions.find(a => a.id === 'description')?.isOpen ? (
                    <ChevronUp size={18} className="text-slate-400" />
                  ) : (
                    <ChevronDown size={18} className="text-slate-400" />
                  )}
                </button>
                {accordions.find(a => a.id === 'description')?.isOpen && (
                  <div className="p-5 space-y-4">
                    {/* Upload File */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Job Description File (Optional)
                      </label>
                      <div className="flex items-center gap-3">
                        <label className="relative flex-1 flex items-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors text-sm font-medium text-slate-700 cursor-pointer">
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx,.txt"
                            className="sr-only"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setUploadedFile(file);
                              }
                            }}
                            disabled={uploadingFile}
                          />
                          <Upload size={18} />
                          {uploadedFile ? uploadedFile.name : (existingJdFileName || 'Upload File')}
                          <Info size={16} className="text-slate-400" />
                        </label>
                        {uploadedFile && (
                          <button
                            type="button"
                            onClick={() => setUploadedFile(null)}
                            className="px-3 py-2 text-sm text-red-600 hover:text-red-700"
                            disabled={uploadingFile}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      {uploadingFile && (
                        <p className="text-sm text-blue-600 mt-2">Uploading file...</p>
                      )}
                    </div>

                    {/* Rich Text Editor */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Job Description</label>
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        {/* Toolbar */}
                        <div className="bg-slate-50 border-b border-slate-200 p-2 flex items-center gap-1 flex-wrap">
                          <button
                            type="button"
                            onClick={handleAiAssist}
                            disabled={aiGenerating}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                          >
                            <Sparkles size={14} />
                            {aiGenerating ? 'Generating...' : 'AI Assist'}
                          </button>
                          <div className="w-px h-6 bg-slate-300 mx-1" />
                          <button type="button" className="p-1.5 hover:bg-slate-200 rounded" title="Bold">
                            <span className="text-xs font-bold">B</span>
                          </button>
                          <button type="button" className="p-1.5 hover:bg-slate-200 rounded" title="Italic">
                            <span className="text-xs italic">I</span>
                          </button>
                          <button type="button" className="p-1.5 hover:bg-slate-200 rounded" title="Underline">
                            <span className="text-xs underline">U</span>
                          </button>
                          {/* Add more toolbar buttons as needed */}
                        </div>
                        {/* Editor */}
                        <textarea
                          value={formData.jobDescriptionHtml}
                          onChange={(e) => setFormData(prev => ({ ...prev, jobDescriptionHtml: e.target.value }))}
                          rows={12}
                          placeholder="Enter job description... Use AI Assist to generate automatically."
                          className="w-full px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none resize-y min-h-[300px]"
                        />
                      </div>
                    </div>

                    {/* Job Type */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Job Type
                        <span className="text-xs text-slate-500 ml-1">(Required to post on Organic Job Boards)</span>
                      </label>
                      <select
                        value={formData.jobType}
                        onChange={(e) => setFormData(prev => ({ ...prev, jobType: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      >
                        <option>Part Time</option>
                        <option>Full Time</option>
                        <option>Contract</option>
                        <option>Internship</option>
                      </select>
                    </div>

                    {/* Job Category */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Job Category</label>
                      <input
                        type="text"
                        value={formData.jobCategory}
                        onChange={(e) => setFormData(prev => ({ ...prev, jobCategory: e.target.value }))}
                        placeholder="Technical/Administration"
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>

                    {/* Job Location Type */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Job Location Type
                        <span className="text-xs text-slate-500 ml-1">(Required to post on Organic Job Boards)</span>
                      </label>
                      <select
                        value={formData.jobLocationType}
                        onChange={(e) => setFormData(prev => ({ ...prev, jobLocationType: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      >
                        <option value="">Click to select</option>
                        <option>On-site</option>
                        <option>Remote</option>
                        <option>Hybrid</option>
                      </select>
                    </div>

                    {/* Experience Fields */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Minimum Experience (Years)</label>
                        <div className="relative">
                          <select
                            value={formData.minExperience}
                            onChange={(e) => setFormData(prev => ({ ...prev, minExperience: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          >
                            <option>0 Year</option>
                            <option>1 Year</option>
                            <option>2 Years</option>
                            <option>3 Years</option>
                            <option>4 Years</option>
                            <option>5+ Years</option>
                          </select>
                          {formData.minExperience && (
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, minExperience: '0 Year' }))}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Maximum Experience (Years)</label>
                        <div className="relative">
                          <select
                            value={formData.maxExperience}
                            onChange={(e) => setFormData(prev => ({ ...prev, maxExperience: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          >
                            <option value="">Select</option>
                            <option>1 Year</option>
                            <option>2 Years</option>
                            <option>3 Years</option>
                            <option>4 Years</option>
                            <option>5 Years</option>
                            <option>8 Years</option>
                            <option>10+ Years</option>
                          </select>
                          {formData.maxExperience && (
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, maxExperience: '' }))}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Salary Fields */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Salary Type
                        <span className="text-xs text-slate-500 ml-1">(Required To Post On Partner Job Boards)</span>
                      </label>
                      <div className="relative">
                        <select
                          value={formData.salaryType}
                          onChange={(e) => setFormData(prev => ({ ...prev, salaryType: e.target.value }))}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                          <option>Annual Salary</option>
                          <option>Monthly Salary</option>
                          <option>Hourly Rate</option>
                        </select>
                        {formData.salaryType && (
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, salaryType: 'Annual Salary' }))}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Currency
                        <span className="text-xs text-slate-500 ml-1">(Required To Post On Partner Job Boards)</span>
                      </label>
                      <select
                        value={formData.currency}
                        onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      >
                        <option>Rupees (₹ - India)</option>
                        <option>US Dollar ($ - USA)</option>
                        <option>Euro (€ - Europe)</option>
                        <option>Pound (£ - UK)</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Minimum Salary
                          <span className="text-xs text-slate-500 ml-1">(Required To Post On Partner Job Boards)</span>
                        </label>
                        <input
                          type="number"
                          value={formData.minSalary}
                          onChange={(e) => setFormData(prev => ({ ...prev, minSalary: e.target.value }))}
                          placeholder="600000"
                          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Maximum Salary
                          <span className="text-xs text-slate-500 ml-1">(Required To Post On Partner Job Boards)</span>
                        </label>
                        <input
                          type="number"
                          value={formData.maxSalary}
                          onChange={(e) => setFormData(prev => ({ ...prev, maxSalary: e.target.value }))}
                          placeholder="800000"
                          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    {/* Education Fields */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Educational Qualification</label>
                        <select
                          value={formData.educationalQualification}
                          onChange={(e) => setFormData(prev => ({ ...prev, educationalQualification: e.target.value }))}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                          <option value="">Select</option>
                          <option>Bachelor of Engineering</option>
                          <option>Master of Engineering</option>
                          <option>Bachelor of Science</option>
                          <option>Master of Science</option>
                          <option>MBA</option>
                          <option>Diploma</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Educational Specialization</label>
                        <input
                          type="text"
                          value={formData.educationalSpecialization}
                          onChange={(e) => setFormData(prev => ({ ...prev, educationalSpecialization: e.target.value }))}
                          placeholder="Computer Science"
                          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    {/* Skills */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Skills</label>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={skillInput}
                          onChange={(e) => setSkillInput(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addSkill();
                            }
                          }}
                          placeholder="Type skill and press Enter"
                          className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                        <button
                          type="button"
                          onClick={addSkill}
                          className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium"
                        >
                          Add
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {formData.skills.map((skill, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm"
                          >
                            {skill}
                            <button
                              type="button"
                              onClick={() => removeSkill(index)}
                              className="text-blue-700 hover:text-blue-900"
                            >
                              <X size={14} />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Location Fields */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Locality</label>
                        <input
                          type="text"
                          value={formData.locality}
                          onChange={(e) => setFormData(prev => ({ ...prev, locality: e.target.value }))}
                          placeholder="Search or Enter Locality"
                          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          City
                          <span className="text-xs text-slate-500 ml-1">(Required To Post On Partner Job Boards)</span>
                        </label>
                        <input
                          type="text"
                          value={formData.city}
                          onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                          placeholder="Search or Enter City"
                          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          State
                          <span className="text-xs text-slate-500 ml-1">(Required To Post On Partner Job Boards)</span>
                        </label>
                        <input
                          type="text"
                          value={formData.state}
                          onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                          placeholder="Search or Enter State"
                          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Country
                          <span className="text-xs text-slate-500 ml-1">(Required To Post On Partner Job Boards)</span>
                        </label>
                        <input
                          type="text"
                          value={formData.country}
                          onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                          placeholder="Search or Enter Country"
                          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Postal Code
                        <span className="text-xs text-slate-500 ml-1">(Required to post on Organic Job Boards)</span>
                      </label>
                      <input
                        type="text"
                        value={formData.postalCode}
                        onChange={(e) => setFormData(prev => ({ ...prev, postalCode: e.target.value }))}
                        placeholder="Search or Enter Postal Code"
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Full Address</label>
                      <textarea
                        value={formData.fullAddress}
                        onChange={(e) => setFormData(prev => ({ ...prev, fullAddress: e.target.value }))}
                        rows={3}
                        placeholder="Street Address"
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y"
                      />
                    </div>

                    {/* Owner and Collaborator */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Select Owner</label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setDropdownsOpen(prev => ({ ...prev, owner: !prev.owner }))}
                            className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-left text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          >
                            {selectedOwner ? (
                              <span>{selectedOwner.name}</span>
                            ) : (
                              <span className="text-slate-400">Select owner</span>
                            )}
                            <ChevronDown size={16} className="text-slate-400" />
                          </button>
                          {dropdownsOpen.owner && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setDropdownsOpen(prev => ({ ...prev, owner: false }))} />
                              <ul className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg max-h-48 overflow-y-auto">
                                {users.map((user) => (
                                  <li key={user.id}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setFormData(prev => ({ ...prev, ownerId: user.id }));
                                        setDropdownsOpen(prev => ({ ...prev, owner: false }));
                                      }}
                                      className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${
                                        formData.ownerId === user.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
                                      }`}
                                    >
                                      {user.name}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Collaborator</label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setDropdownsOpen(prev => ({ ...prev, collaborators: !prev.collaborators }))}
                            className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-left text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          >
                            <span className="text-slate-400">
                              {formData.collaborators.length === 0 ? 'Select Users' : `${formData.collaborators.length} selected`}
                            </span>
                            <ChevronDown size={16} className="text-slate-400" />
                          </button>
                          {dropdownsOpen.collaborators && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setDropdownsOpen(prev => ({ ...prev, collaborators: false }))} />
                              <ul className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg max-h-48 overflow-y-auto">
                                {users.map((user) => (
                                  <li key={user.id}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const isSelected = formData.collaborators.includes(user.id);
                                        setFormData(prev => ({
                                          ...prev,
                                          collaborators: isSelected
                                            ? prev.collaborators.filter(id => id !== user.id)
                                            : [...prev.collaborators, user.id],
                                        }));
                                      }}
                                      className={`w-full flex items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${
                                        formData.collaborators.includes(user.id) ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
                                      }`}
                                    >
                                      <span>{user.name}</span>
                                      {formData.collaborators.includes(user.id) && <Check size={16} />}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Job Function and Industry */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Job Function
                          <span className="text-xs text-slate-500 ml-1">(Required to post on Organic Job Boards)</span>
                        </label>
                        <select
                          value={formData.jobFunction}
                          onChange={(e) => setFormData(prev => ({ ...prev, jobFunction: e.target.value }))}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                          <option value="">Click to select</option>
                          <option>Engineering</option>
                          <option>Sales</option>
                          <option>Marketing</option>
                          <option>Operations</option>
                          <option>Finance</option>
                          <option>Human Resources</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Job Industry
                          <span className="text-xs text-slate-500 ml-1">(Required to post on Organic Job Boards)</span>
                        </label>
                        <select
                          value={formData.jobIndustry}
                          onChange={(e) => setFormData(prev => ({ ...prev, jobIndustry: e.target.value }))}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                          <option value="">Click to select</option>
                          <option>Technology</option>
                          <option>Healthcare</option>
                          <option>Finance</option>
                          <option>Retail</option>
                          <option>Manufacturing</option>
                          <option>Education</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 3: Job Application Form */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-4">
                <button
                  type="button"
                  onClick={() => toggleAccordion('application')}
                  className="w-full px-5 py-4 flex items-center justify-between border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                >
                  <span className="text-sm font-bold text-slate-900">3. Job Application Form</span>
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
                                onChange={(e) => setFormData(prev => ({ ...prev, logoOption: e.target.value as 'account' | 'company' | 'none' }))}
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
                                onChange={(e) => setFormData(prev => ({ ...prev, logoOption: e.target.value as 'account' | 'company' | 'none' }))}
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
                                onChange={(e) => setFormData(prev => ({ ...prev, logoOption: e.target.value as 'account' | 'company' | 'none' }))}
                                className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-700">No logo</span>
                            </label>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">Job Application Form Questions</label>
                          
                          {/* Add New Question */}
                          <div className="mb-3 flex gap-2">
                            <input
                              type="text"
                              value={newQuestionInput}
                              onChange={(e) => setNewQuestionInput(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter' && newQuestionInput.trim()) {
                                  e.preventDefault();
                                  setFormData(prev => ({
                                    ...prev,
                                    applicationQuestions: [...prev.applicationQuestions, newQuestionInput.trim()],
                                  }));
                                  setNewQuestionInput('');
                                }
                              }}
                              placeholder="Type a new question and press Enter"
                              className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (newQuestionInput.trim()) {
                                  setFormData(prev => ({
                                    ...prev,
                                    applicationQuestions: [...prev.applicationQuestions, newQuestionInput.trim()],
                                  }));
                                  setNewQuestionInput('');
                                }
                              }}
                              className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-1"
                            >
                              <Plus size={16} />
                              Add
                            </button>
                          </div>

                          {/* List of Questions */}
                          {formData.applicationQuestions.length > 0 && (
                            <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                              {formData.applicationQuestions.map((question, index) => (
                                <div
                                  key={index}
                                  className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
                                >
                                  {editingQuestionIndex === index ? (
                                    <>
                                      <input
                                        type="text"
                                        value={question}
                                        onChange={(e) => {
                                          const updated = [...formData.applicationQuestions];
                                          updated[index] = e.target.value;
                                          setFormData(prev => ({ ...prev, applicationQuestions: updated }));
                                        }}
                                        onBlur={() => setEditingQuestionIndex(null)}
                                        onKeyPress={(e) => {
                                          if (e.key === 'Enter') {
                                            setEditingQuestionIndex(null);
                                          }
                                        }}
                                        className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        autoFocus
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setEditingQuestionIndex(null)}
                                        className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                                        title="Save"
                                      >
                                        <Check size={16} />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <span className="flex-1 text-sm text-slate-700">{question}</span>
                                      <button
                                        type="button"
                                        onClick={() => setEditingQuestionIndex(index)}
                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                        title="Edit"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                        </svg>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setFormData(prev => ({
                                            ...prev,
                                            applicationQuestions: prev.applicationQuestions.filter((_, i) => i !== index),
                                          }));
                                          if (editingQuestionIndex === index) {
                                            setEditingQuestionIndex(null);
                                          }
                                        }}
                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                        title="Delete"
                                      >
                                        <X size={16} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {formData.applicationQuestions.length === 0 && (
                            <p className="text-sm text-slate-500 italic">No questions added yet. Add questions above.</p>
                          )}
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

              {/* Section 4: Publish & Share */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-4">
                <button
                  type="button"
                  onClick={() => toggleAccordion('publish')}
                  className="w-full px-5 py-4 flex items-center justify-between border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                >
                  <span className="text-sm font-bold text-slate-900">4. Publish & Share</span>
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
                                  value={formData.twitterScheduleDate}
                                  onChange={(e) => setFormData(prev => ({ ...prev, twitterScheduleDate: e.target.value }))}
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
                            <MessageCircle size={20} className="text-green-600" />
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
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createNewDeal}
                    onChange={(e) => setCreateNewDeal(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">Create New Deal</span>
                </label>
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
        </>
      )}
    </AnimatePresence>
  );
}
