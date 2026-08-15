'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Building2,
  Check,
  ChevronDown,
  ExternalLink,
  FileText,
  Globe,
  Linkedin,
  Loader2,
  LogIn,
  MapPin,
  Plus,
  Search,
  Share2,
  Sparkles,
  Upload,
  X,
  Lock,
} from 'lucide-react';
import {
  apiConnectIntegration,
  apiCreateJob,
  apiGenerateJobFromPrompt,
  apiGetClient,
  apiGetClients,
  apiGetContacts,
  apiGetJobApplyLink,
  apiGetSocialStatus,
  apiProcessJobCreationPipeline,
  apiSuggestJobTitles,
  type BackendClient,
  type BackendContact,
  type BackendUser,
  type CreateJobData,
  type JobCreationPipelineResult,
} from '@/lib/api';
import {
  apiCreateTenantCompanyPost,
  apiGetTenantCompanyPage,
  type TenantCompanyPage,
} from '@/lib/company-page-api';
import { AiCoinLockBadge, useAiCoinGate } from '../coins/AiCoinGate';
import { AiCoinLockBanner } from '../coins/TenantCoinsContext';
import { getAllTeamMembersForAssign, teamMembersToBackendUsers } from '@/lib/api/teamApi';
import { LocationAutocomplete } from '@/components/LocationAutocomplete';
import { RichTextEditor } from '@/components/RichTextEditor';
import { PreScreenAssessmentSection } from '@/components/jobs/PreScreenAssessmentSection';
import {
  CreateJobDetailsForm,
  type CreateJobDetailsFormData,
  type JobLanguageEntry,
} from '@/components/drawers/CreateJobDetailsForm';
import { ClientDetailsDrawer } from '@/components/drawers/ClientDetailsDrawer';
import { PublicVisibilityToggle } from '@/components/forms/PublicVisibilityToggle';
import { useLinkedIn } from '@/hooks/useLinkedIn';
import { useDrawerUnsavedGuard } from '@/hooks/useDrawerUnsavedGuard';
import type { JobPreScreenAssessmentLink } from '@/lib/preScreenAssessmentTypes';
import { buildJobContactPersonOptions } from '@/lib/jobClientContacts';
import {
  DEFAULT_JOB_PUBLIC_FIELD_VISIBILITY,
  isJobFieldPubliclyVisible,
  parseJobPublicFieldVisibility,
  toggleJobPublicFieldVisibility,
  type JobPublicFieldVisibility,
} from '@/lib/jobPublicFieldVisibility';
import { stripHtml } from '@/lib/jobSocialPost';

type WizardStep = 'client' | 'title' | 'location' | 'prompt' | 'review';
type PublishFlowStep = 'assessment' | 'distribution' | null;
type DistributionChannel =
  | 'internal_company'
  | 'hryantra'
  | 'external_platforms'
  | 'social_media';

const DISTRIBUTION_OPTIONS: Array<{
  id: DistributionChannel;
  label: string;
  description: string;
  icon: React.ElementType;
}> = [
  {
    id: 'internal_company',
    label: 'Internal company',
    description: 'Post this job on your company page in Phase 1 community.',
    icon: Building2,
  },
  {
    id: 'hryantra',
    label: 'HRyantra',
    description: 'Publish on the HRyantra job board (Phase 1).',
    icon: Sparkles,
  },
  {
    id: 'external_platforms',
    label: 'External platforms',
    description: 'Partner job boards — coming soon.',
    icon: Globe,
  },
  {
    id: 'social_media',
    label: 'Social media',
    description: 'Promote on LinkedIn, X, and other connected channels.',
    icon: Share2,
  },
];

const DISTRIBUTION_PLATFORMS: Record<
  DistributionChannel,
  Array<{ id: string; label: string }>
> = {
  internal_company: [{ id: 'company_page', label: 'Company page' }],
  hryantra: [{ id: 'hryantra_job_board', label: 'HRyantra job board' }],
  external_platforms: [
    { id: 'indeed', label: 'Indeed' },
    { id: 'naukri', label: 'Naukri' },
    { id: 'glassdoor', label: 'Glassdoor' },
    { id: 'monster', label: 'Monster' },
  ],
  social_media: [
    { id: 'linkedin', label: 'LinkedIn' },
    { id: 'x_twitter', label: 'X (Twitter)' },
    { id: 'facebook', label: 'Facebook' },
    { id: 'instagram', label: 'Instagram' },
  ],
};

const EXTERNAL_COMING_SOON_PLATFORM_IDS = new Set([
  'indeed',
  'naukri',
  'glassdoor',
  'monster',
]);

const SOCIAL_COMING_SOON_PLATFORM_IDS = new Set([
  'x_twitter',
  'facebook',
  'instagram',
]);

function isComingSoonPlatform(platformId: string) {
  return (
    EXTERNAL_COMING_SOON_PLATFORM_IDS.has(platformId) ||
    SOCIAL_COMING_SOON_PLATFORM_IDS.has(platformId)
  );
}

function getDistributionChannelsFromPlatforms(
  selected: Record<string, boolean>,
): Record<DistributionChannel, boolean> {
  return {
    internal_company: DISTRIBUTION_PLATFORMS.internal_company.some((p) => selected[p.id]),
    hryantra: DISTRIBUTION_PLATFORMS.hryantra.some((p) => selected[p.id]),
    // External boards are coming soon — never count as selected destinations
    external_platforms: false,
    social_media: DISTRIBUTION_PLATFORMS.social_media.some(
      (p) => selected[p.id] && !isComingSoonPlatform(p.id),
    ),
  };
}

const SOCIAL_AUTH_PLATFORM_IDS = new Set(['linkedin', 'x_twitter', 'facebook', 'instagram']);

type SocialPlatformConnection = {
  linkedin: boolean;
  x_twitter: boolean;
  facebook: boolean;
  instagram: boolean;
};

const EMPTY_SOCIAL_CONNECTIONS: SocialPlatformConnection = {
  linkedin: false,
  x_twitter: false,
  facebook: false,
  instagram: false,
};

function isSocialAuthPlatform(platformId: string) {
  return SOCIAL_AUTH_PLATFORM_IDS.has(platformId);
}

type WizardDraft = {
  clientId: string;
  clientName: string;
  jobTitle: string;
  locationQuery: string;
  country: string;
  state: string;
  city: string;
  extraPrompt: string;
  nationality: string;
  priority: string;
  numberOfOpenings: string;
  industryType: string;
  employmentType: string;
  targetHireDate: string;
  minExperience: string;
  maxExperience: string;
  salaryCurrency: string;
  payRangeMin: string;
  payRangeMax: string;
  jobDescriptionHtml: string;
  keyResponsibilitiesText: string;
  qualificationsExperienceText: string;
  candidateRequirementsText: string;
  skills: string[];
  languages: JobLanguageEntry[];
  showClientNamePublicly: boolean;
  publicFieldVisibility: JobPublicFieldVisibility;
  contactPersonId: string;
  contactPersonName: string;
  managerId: string;
  assignedToId: string;
  videoMediaLink: string;
  forecastRevenue: string;
};

const EMPTY_DRAFT: WizardDraft = {
  clientId: '',
  clientName: '',
  jobTitle: '',
  locationQuery: '',
  country: '',
  state: '',
  city: '',
  extraPrompt: '',
  nationality: '',
  priority: 'Medium',
  numberOfOpenings: '1',
  industryType: '',
  employmentType: 'Full Time',
  targetHireDate: '',
  minExperience: '0',
  maxExperience: '10',
  salaryCurrency: 'USD',
  payRangeMin: '',
  payRangeMax: '',
  jobDescriptionHtml: '',
  keyResponsibilitiesText: '',
  qualificationsExperienceText: '',
  candidateRequirementsText: '',
  skills: [],
  languages: [],
  showClientNamePublicly: true,
  publicFieldVisibility: { ...DEFAULT_JOB_PUBLIC_FIELD_VISIBILITY },
  contactPersonId: '',
  contactPersonName: '',
  managerId: '',
  assignedToId: '',
  videoMediaLink: '',
  forecastRevenue: '',
};

const JOB_AI_WIZARD_OAUTH_DRAFT_KEY = 'job_ai_wizard_oauth_draft';

type JobAiWizardOauthDraft = {
  draft: WizardDraft;
  selectedDistributionPlatforms: Record<string, boolean>;
  activeDistributionTab: DistributionChannel;
  publishFlowStep: PublishFlowStep;
  step: WizardStep;
  mode: 'ai' | 'manual';
  preScreenAssessments: JobPreScreenAssessmentLink[];
};

function saveJobAiWizardOauthDraft(payload: JobAiWizardOauthDraft) {
  try {
    sessionStorage.setItem(JOB_AI_WIZARD_OAUTH_DRAFT_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota / private mode */
  }
}

function readJobAiWizardOauthDraft(): JobAiWizardOauthDraft | null {
  try {
    const raw = sessionStorage.getItem(JOB_AI_WIZARD_OAUTH_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as JobAiWizardOauthDraft;
  } catch {
    return null;
  }
}

function clearJobAiWizardOauthDraft() {
  try {
    sessionStorage.removeItem(JOB_AI_WIZARD_OAUTH_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

function defaultTargetHireDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

function toList(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((item) => item.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean);
}

function mapJobType(value: string): CreateJobData['type'] {
  const v = value.toLowerCase();
  if (v.includes('part')) return 'PART_TIME';
  if (v.includes('contract')) return 'CONTRACT';
  if (v.includes('intern')) return 'INTERNSHIP';
  if (v.includes('freelance')) return 'FREELANCE';
  return 'FULL_TIME';
}

function pipelineToDraft(
  base: WizardDraft,
  data: JobCreationPipelineResult,
): WizardDraft {
  return {
    ...base,
    jobTitle: data.jobTitle || base.jobTitle,
    nationality: data.nationality || base.nationality,
    priority: data.priority || base.priority,
    numberOfOpenings: data.numberOfOpenings || base.numberOfOpenings,
    country: data.country || base.country,
    state: data.state || base.state,
    city: data.city || base.city,
    locationQuery:
      [data.city, data.state, data.country].filter(Boolean).join(', ') || base.locationQuery,
    industryType: data.industryType || base.industryType,
    employmentType: data.employmentType || base.employmentType,
    targetHireDate: data.targetHireDate || base.targetHireDate || defaultTargetHireDate(),
    minExperience:
      data.minExperience != null ? String(data.minExperience) : base.minExperience,
    maxExperience:
      data.maxExperience != null ? String(data.maxExperience) : base.maxExperience,
    salaryCurrency: data.salaryCurrency || base.salaryCurrency,
    payRangeMin: data.payRangeMin || base.payRangeMin,
    payRangeMax: data.payRangeMax || base.payRangeMax,
    jobDescriptionHtml: data.jobDescriptionHtml || base.jobDescriptionHtml,
    keyResponsibilitiesText:
      data.keyResponsibilitiesText || base.keyResponsibilitiesText,
    qualificationsExperienceText:
      data.qualificationsExperienceText || base.qualificationsExperienceText,
    candidateRequirementsText:
      data.candidateRequirementsText || base.candidateRequirementsText,
    skills: data.skills?.length ? data.skills : base.skills,
    languages: data.languages?.length ? data.languages : base.languages,
  };
}

function draftToJobDetailsForm(draft: WizardDraft): CreateJobDetailsFormData {
  return {
    nationality: draft.nationality,
    jobTitle: draft.jobTitle,
    priority: draft.priority,
    companyId: draft.clientId,
    showClientNamePublicly: draft.showClientNamePublicly,
    publicFieldVisibility: draft.publicFieldVisibility,
    contactPersonId: draft.contactPersonId,
    contactPersonName: draft.contactPersonName,
    numberOfOpenings: draft.numberOfOpenings,
    country: draft.country,
    state: draft.state,
    city: draft.city,
    industryType: draft.industryType,
    employmentType: draft.employmentType,
    targetHireDate: draft.targetHireDate,
    minExperience: draft.minExperience,
    maxExperience: draft.maxExperience,
    payRangeMin: draft.payRangeMin,
    payRangeMax: draft.payRangeMax,
    salaryCurrency: draft.salaryCurrency,
    languages: draft.languages,
    skills: draft.skills,
    keyResponsibilitiesText: draft.keyResponsibilitiesText,
    qualificationsExperienceText: draft.qualificationsExperienceText,
    candidateRequirementsText: draft.candidateRequirementsText,
    videoMediaLink: draft.videoMediaLink,
    forecastRevenue: draft.forecastRevenue,
    managerId: draft.managerId,
    assignedToId: draft.assignedToId,
  };
}

function applyJobDetailsPatch(
  draft: WizardDraft,
  patch: Partial<CreateJobDetailsFormData>,
  clients: BackendClient[],
): WizardDraft {
  const merged = { ...draftToJobDetailsForm(draft), ...patch };
  const client = clients.find((row) => row.id === merged.companyId);
  return {
    ...draft,
    nationality: merged.nationality,
    jobTitle: merged.jobTitle,
    priority: merged.priority,
    clientId: merged.companyId,
    clientName: client?.companyName || draft.clientName,
    showClientNamePublicly: merged.showClientNamePublicly,
    publicFieldVisibility: merged.publicFieldVisibility,
    contactPersonId: merged.contactPersonId,
    contactPersonName: merged.contactPersonName,
    numberOfOpenings: merged.numberOfOpenings,
    country: merged.country,
    state: merged.state,
    city: merged.city,
    industryType: merged.industryType,
    employmentType: merged.employmentType,
    targetHireDate: merged.targetHireDate,
    minExperience: merged.minExperience,
    maxExperience: merged.maxExperience,
    payRangeMin: merged.payRangeMin,
    payRangeMax: merged.payRangeMax,
    salaryCurrency: merged.salaryCurrency,
    languages: merged.languages,
    skills: merged.skills,
    keyResponsibilitiesText: merged.keyResponsibilitiesText,
    qualificationsExperienceText: merged.qualificationsExperienceText,
    candidateRequirementsText: merged.candidateRequirementsText,
    videoMediaLink: merged.videoMediaLink,
    forecastRevenue: merged.forecastRevenue,
    managerId: merged.managerId,
    assignedToId: merged.assignedToId,
  };
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onJobCreated?: () => void;
  /** AI flow includes Brief the AI / Generate with AI. Manual skips that stage. */
  mode?: 'ai' | 'manual';
};

const STEPS: WizardStep[] = ['client', 'title', 'location', 'prompt', 'review'];

const STEP_LABELS: Record<WizardStep, string> = {
  client: 'Pick a client',
  title: 'Name the role',
  location: 'Set the location',
  prompt: 'Brief the AI',
  review: 'Preview & publish',
};

const STEP_HINTS: Record<WizardStep, string> = {
  client: 'Who is this job for? Select a client to continue.',
  title: 'Start with a clear title — AI can refine suggestions as you type.',
  location: 'Where will this role be based?',
  prompt: 'Add extra context so AI can draft a stronger job post.',
  review: 'Fine-tune everything, then publish when it looks right.',
};

export function JobAiCreateWizard({ isOpen, onClose, onJobCreated, mode = 'ai' }: Props) {
  const isManual = mode === 'manual';
  const wizardSteps = useMemo(
    () => (isManual ? (['client', 'title', 'location', 'review'] as WizardStep[]) : STEPS),
    [isManual],
  );
  const linkedIn = useLinkedIn();
  const jobAiGate = useAiCoinGate('ai.job_from_prompt');
  const [step, setStep] = useState<WizardStep>('client');
  const [draft, setDraft] = useState<WizardDraft>({
    ...EMPTY_DRAFT,
    targetHireDate: defaultTargetHireDate(),
  });
  const [clients, setClients] = useState<BackendClient[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [loadingClients, setLoadingClients] = useState(false);
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([]);
  const [loadingTitleSuggestions, setLoadingTitleSuggestions] = useState(false);
  const [users, setUsers] = useState<BackendUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [contacts, setContacts] = useState<ReturnType<typeof buildJobContactPersonOptions>>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [skillInput, setSkillInput] = useState('');
  const [dropdownsOpen, setDropdownsOpen] = useState<Record<string, boolean>>({});
  const [jdGenerating, setJdGenerating] = useState(false);
  const [jdError, setJdError] = useState('');
  const [pastedJobDescriptionText, setPastedJobDescriptionText] = useState('');
  const [jdAttachment, setJdAttachment] = useState<{
    file: File;
    status: 'processing' | 'ready' | 'error';
    error?: string;
  } | null>(null);
  const jdFileInputRef = useRef<HTMLInputElement | null>(null);
  const [publishFlowStep, setPublishFlowStep] = useState<PublishFlowStep>(null);
  const [preScreenAssessments, setPreScreenAssessments] = useState<JobPreScreenAssessmentLink[]>([]);
  const [activeDistributionTab, setActiveDistributionTab] =
    useState<DistributionChannel>('hryantra');
  const [selectedDistributionPlatforms, setSelectedDistributionPlatforms] = useState<
    Record<string, boolean>
  >({
    hryantra_job_board: true,
  });
  const [socialConnections, setSocialConnections] =
    useState<SocialPlatformConnection>(EMPTY_SOCIAL_CONNECTIONS);
  const [connectingPlatformId, setConnectingPlatformId] = useState<string | null>(null);
  const [tenantCompanyPage, setTenantCompanyPage] = useState<TenantCompanyPage | null>(null);
  const [loadingCompanyPage, setLoadingCompanyPage] = useState(false);

  const reset = useCallback(() => {
    setStep('client');
    setDraft({ ...EMPTY_DRAFT, targetHireDate: defaultTargetHireDate() });
    setClientSearch('');
    setShowCreateClient(false);
    setError('');
    setGenerating(false);
    setPublishing(false);
    setTitleSuggestions([]);
    setLoadingTitleSuggestions(false);
    setUsers([]);
    setLoadingUsers(false);
    setContacts([]);
    setLoadingContacts(false);
    setSkillInput('');
    setDropdownsOpen({});
    setJdGenerating(false);
    setJdError('');
    setPastedJobDescriptionText('');
    setJdAttachment(null);
    setPublishFlowStep(null);
    setPreScreenAssessments([]);
    setActiveDistributionTab('hryantra');
    setSelectedDistributionPlatforms({ hryantra_job_board: true });
    setSocialConnections(EMPTY_SOCIAL_CONNECTIONS);
    setConnectingPlatformId(null);
    setTenantCompanyPage(null);
    setLoadingCompanyPage(false);
  }, []);

  const {
    panelRef: wizardPanelRef,
    requestClose: requestWizardClose,
    markClean: markWizardClean,
    markDirty: markWizardDirty,
  } = useDrawerUnsavedGuard<HTMLDivElement>({
    isOpen,
    onClose,
    message:
      'You have unsaved progress in this job wizard. Do you want to discard it and close?',
  });

  const linkedInRefreshStatus = linkedIn.refreshStatus;

  const loadSocialConnections = useCallback(async () => {
    try {
      // Prefer the shared social status endpoint; LinkedIn refresh is best-effort
      // and must not block the Log in buttons if the DB is slow.
      const [socialResult] = await Promise.allSettled([
        apiGetSocialStatus(),
        linkedInRefreshStatus(),
      ]);

      if (socialResult.status === 'fulfilled') {
        const response = socialResult.value;
        const nextConnections: SocialPlatformConnection = {
          linkedin: Boolean(response.data?.linkedin?.connected),
          x_twitter: Boolean(response.data?.twitter?.connected),
          facebook: Boolean(response.data?.facebook?.connected),
          instagram: false,
        };
        setSocialConnections(nextConnections);

        setSelectedDistributionPlatforms((prev) => {
          const next = { ...prev };
          for (const platformId of SOCIAL_AUTH_PLATFORM_IDS) {
            if (!nextConnections[platformId as keyof SocialPlatformConnection]) {
              delete next[platformId];
            }
          }
          return next;
        });
      } else {
        setSocialConnections(EMPTY_SOCIAL_CONNECTIONS);
      }
    } catch {
      setSocialConnections(EMPTY_SOCIAL_CONNECTIONS);
    }
  }, [linkedInRefreshStatus]);

  useEffect(() => {
    if (!isOpen || publishFlowStep !== 'distribution') return;
    setSelectedDistributionPlatforms((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const id of EXTERNAL_COMING_SOON_PLATFORM_IDS) {
        if (next[id]) {
          delete next[id];
          changed = true;
        }
      }
      for (const id of SOCIAL_COMING_SOON_PLATFORM_IDS) {
        if (next[id]) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    let cancelled = false;
    setLoadingCompanyPage(true);
    void apiGetTenantCompanyPage()
      .then((res) => {
        if (cancelled) return;
        const page = res.data?.page || null;
        setTenantCompanyPage(page);
        if (!page) {
          setSelectedDistributionPlatforms((prev) => {
            if (!prev.company_page) return prev;
            const next = { ...prev };
            delete next.company_page;
            // Clear legacy internal destinations if present
            delete next.team_workspace;
            delete next.internal_job_board;
            delete next.employee_referrals;
            return next;
          });
        } else {
          // Default-select company page when it exists
          setSelectedDistributionPlatforms((prev) => {
            if (prev.company_page) return prev;
            return { ...prev, company_page: true };
          });
        }
      })
      .catch(() => {
        if (!cancelled) setTenantCompanyPage(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingCompanyPage(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, publishFlowStep]);

  useEffect(() => {
    if (!isOpen) return;

    if (sessionStorage.getItem('reopen_job_ai_wizard') === '1') {
      sessionStorage.removeItem('reopen_job_ai_wizard');
      const saved = readJobAiWizardOauthDraft();
      clearJobAiWizardOauthDraft();
      if (saved?.draft) {
        setDraft({ ...EMPTY_DRAFT, ...saved.draft });
        if (saved.selectedDistributionPlatforms) {
          setSelectedDistributionPlatforms(saved.selectedDistributionPlatforms);
        }
        if (saved.activeDistributionTab) {
          setActiveDistributionTab(saved.activeDistributionTab);
        }
        if (Array.isArray(saved.preScreenAssessments)) {
          setPreScreenAssessments(saved.preScreenAssessments);
        }
        if (saved.step) setStep(saved.step);
      } else {
        setStep('review');
      }
      setPublishFlowStep('distribution');
      setActiveDistributionTab((prev) =>
        saved?.activeDistributionTab ? saved.activeDistributionTab : 'social_media',
      );
      markWizardDirty();
    }
  }, [isOpen, markWizardDirty]);

  useEffect(() => {
    if (isManual && step === 'prompt') setStep('review');
  }, [isManual, step]);

  useEffect(() => {
    if (!isOpen || publishFlowStep !== 'distribution') return;
    void loadSocialConnections();
  }, [isOpen, publishFlowStep, loadSocialConnections]);

  const loadClients = useCallback(async () => {
    setLoadingClients(true);
    try {
      const res = await apiGetClients({ page: 1, limit: 200 });
      const raw = res.data as unknown;
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as { data?: BackendClient[] })?.data)
          ? (raw as { data: BackendClient[] }).data
          : Array.isArray((raw as { items?: BackendClient[] })?.items)
            ? (raw as { items: BackendClient[] }).items
            : [];
      setClients(list as BackendClient[]);
      return list as BackendClient[];
    } catch {
      setError('Could not load clients.');
      return [] as BackendClient[];
    } finally {
      setLoadingClients(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      reset();
      return;
    }
    let cancelled = false;
    void loadClients().then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, reset, loadClients]);

  const handleClientCreatedFromWizard = useCallback(
    (created?: BackendClient | null) => {
      setShowCreateClient(false);
      void loadClients().then((list) => {
        const match =
          (created?.id && list.find((c) => c.id === created.id)) ||
          (created?.id ? created : null) ||
          (created?.companyName
            ? list.find(
                (c) =>
                  (c.companyName || '').toLowerCase() ===
                  String(created.companyName || '').toLowerCase(),
              )
            : null);
        if (match?.id) {
          markWizardDirty();
          setDraft((prev) => ({
            ...prev,
            clientId: match.id,
            clientName: match.companyName || created?.companyName || 'Client',
          }));
          setClientSearch('');
        }
      });
    },
    [loadClients, markWizardDirty],
  );

  const jobDetailsFormData = useMemo(() => draftToJobDetailsForm(draft), [draft]);

  const patchJobDetailsForm = useCallback(
    (
      patch:
        | Partial<CreateJobDetailsFormData>
        | ((prev: CreateJobDetailsFormData) => Partial<CreateJobDetailsFormData>),
    ) => {
      markWizardDirty();
      setDraft((prev) => {
        const current = draftToJobDetailsForm(prev);
        const nextPatch = typeof patch === 'function' ? patch(current) : patch;
        return applyJobDetailsPatch(prev, nextPatch, clients);
      });
    },
    [clients, markWizardDirty],
  );

  const addSkill = useCallback(() => {
    const next = skillInput.trim();
    if (!next) return;
    markWizardDirty();
    setDraft((prev) => {
      if (prev.skills.some((skill) => skill.toLowerCase() === next.toLowerCase())) return prev;
      return { ...prev, skills: [...prev.skills, next] };
    });
    setSkillInput('');
  }, [skillInput, markWizardDirty]);

  const removeSkill = useCallback(
    (index: number) => {
      markWizardDirty();
      setDraft((prev) => ({
        ...prev,
        skills: prev.skills.filter((_, i) => i !== index),
      }));
    },
    [markWizardDirty],
  );

  const applyPipelineToDraft = useCallback(
    (data: JobCreationPipelineResult) => {
      setDraft((prev) => {
        const next = pipelineToDraft(prev, data);
        if (data.companyId || data.companyName) {
          const matchedClient = clients.find(
            (client) =>
              client.id === data.companyId ||
              client.companyName?.toLowerCase() === data.companyName?.toLowerCase(),
          );
          if (matchedClient) {
            next.clientId = matchedClient.id;
            next.clientName = matchedClient.companyName || next.clientName;
          }
        }
        return next;
      });
      markWizardDirty();
    },
    [clients, markWizardDirty],
  );

  const handleAutoFillFromPastedJd = useCallback(async () => {
    if (jdGenerating) return;
    const editorText = stripHtml(draft.jobDescriptionHtml || '');
    const sourceText = (pastedJobDescriptionText || editorText || '').trim();
    if (sourceText.length < 50) {
      setJdError('Paste a longer JD (at least 50 characters), then click Auto-fill.');
      return;
    }
    setJdError('');
    setJdGenerating(true);
    try {
      const response = await apiGenerateJobFromPrompt({
        prompt: sourceText,
        currentForm: {
          nationality: draft.nationality,
          jobTitle: draft.jobTitle,
          priority: draft.priority,
          companyId: draft.clientId,
          numberOfOpenings: draft.numberOfOpenings,
          country: draft.country,
          state: draft.state,
          city: draft.city,
          industryType: draft.industryType,
          employmentType: draft.employmentType,
          targetHireDate: draft.targetHireDate,
          skills: draft.skills,
        },
      });
      const data = response.data;
      if (!data?.jobTitle) {
        throw new Error('Could not extract enough fields from the pasted description.');
      }
      applyPipelineToDraft(data);
    } catch (err: unknown) {
      setJdError(err instanceof Error ? err.message : 'Failed to auto-fill from pasted JD.');
    } finally {
      setJdGenerating(false);
    }
  }, [applyPipelineToDraft, draft, jdGenerating, pastedJobDescriptionText]);

  const handleJdFilePick = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;
      const maxBytes = 5 * 1024 * 1024;
      if (file.size > maxBytes) {
        setJdError('Job description file must be smaller than 5MB.');
        return;
      }
      setJdError('');
      setJdAttachment({ file, status: 'processing' });
      setJdGenerating(true);
      markWizardDirty();
      try {
        const response = await apiProcessJobCreationPipeline(file, {
          nationality: draft.nationality,
          jobTitle: draft.jobTitle,
          priority: draft.priority,
          companyId: draft.clientId,
          numberOfOpenings: draft.numberOfOpenings,
          country: draft.country,
          state: draft.state,
          city: draft.city,
          industryType: draft.industryType,
          employmentType: draft.employmentType,
          targetHireDate: draft.targetHireDate,
          skills: draft.skills,
        });
        const data = response.data;
        if (!data?.jobTitle) {
          throw new Error('Could not extract a job title from this document.');
        }
        applyPipelineToDraft(data);
        setJdAttachment({ file, status: 'ready' });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to process job description file';
        setJdAttachment({ file, status: 'error', error: message });
        setJdError(message);
      } finally {
        setJdGenerating(false);
      }
    },
    [applyPipelineToDraft, draft, markWizardDirty],
  );

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const loadUsers = async () => {
      try {
        setLoadingUsers(true);
        const members = await getAllTeamMembersForAssign();
        if (!cancelled) setUsers(teamMembersToBackendUsers(members));
      } catch {
        if (!cancelled) setUsers([]);
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    };
    void loadUsers();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !draft.clientId) {
      setContacts([]);
      return;
    }
    let cancelled = false;
    const loadContacts = async () => {
      try {
        setLoadingContacts(true);
        const clientId = draft.clientId;
        const [contactsResponse, clientResponse] = await Promise.all([
          apiGetContacts({ clientId, type: 'CLIENT' }),
          apiGetClient(clientId).catch(() => null),
        ]);
        const raw = (contactsResponse as { data?: unknown }).data;
        const list = Array.isArray(raw)
          ? raw
          : raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown }).data)
            ? (raw as { data: unknown[] }).data
            : [];
        if (cancelled) return;
        const client =
          clientResponse && typeof clientResponse === 'object' && 'id' in clientResponse
            ? (clientResponse as BackendClient)
            : null;
        setContacts(buildJobContactPersonOptions(list as BackendContact[], client));
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
  }, [isOpen, draft.clientId]);

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      String(c.companyName || '')
        .toLowerCase()
        .includes(q),
    );
  }, [clients, clientSearch]);

  useEffect(() => {
    if (!isOpen || step !== 'title' || isManual) return;
    const query = draft.jobTitle.trim();
    if (query.length < 2) {
      setTitleSuggestions([]);
      setLoadingTitleSuggestions(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoadingTitleSuggestions(true);
      void apiSuggestJobTitles({
        query,
        company: draft.clientName || undefined,
        limit: 8,
      })
        .then((res) => {
          if (cancelled) return;
          const list = Array.isArray(res.data?.suggestions) ? res.data.suggestions : [];
          setTitleSuggestions(list.filter(Boolean).slice(0, 8));
        })
        .catch(() => {
          if (!cancelled) setTitleSuggestions([]);
        })
        .finally(() => {
          if (!cancelled) setLoadingTitleSuggestions(false);
        });
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isOpen, step, draft.jobTitle, draft.clientName, isManual]);

  const stepIndex = Math.max(0, wizardSteps.indexOf(step));

  const patchDraft = (patch: Partial<WizardDraft>) => {
    markWizardDirty();
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const goNext = () => {
    setError('');
    if (step === 'client') {
      if (!draft.clientId) {
        setError('Select a client to continue.');
        return;
      }
      setStep('title');
      return;
    }
    if (step === 'title') {
      if (!draft.jobTitle.trim()) {
        setError('Enter a job title to continue.');
        return;
      }
      setStep('location');
      return;
    }
    if (step === 'location') {
      if (!draft.country.trim() && !draft.locationQuery.trim()) {
        setError('Add a location to continue.');
        return;
      }
      setStep(isManual ? 'review' : 'prompt');
      return;
    }
    if (step === 'prompt') {
      void runAiGenerate();
    }
  };

  const skipAiBrief = () => {
    setError('');
    setDraft((prev) => ({
      ...prev,
      extraPrompt: '',
      targetHireDate: prev.targetHireDate || defaultTargetHireDate(),
    }));
    setStep('review');
  };

  const validateReview = () => {
    if (!draft.clientId || !draft.jobTitle.trim()) {
      setError('Client and job title are required.');
      return false;
    }
    if (!draft.country.trim()) {
      setError('Country is required before publishing.');
      return false;
    }
    if (!draft.targetHireDate) {
      setError('Target hire date is required.');
      return false;
    }
    return true;
  };

  const startPublishFlow = () => {
    setError('');
    if (!validateReview()) return;
    setPublishFlowStep('assessment');
  };

  const isSocialPlatformConnected = useCallback(
    (platformId: string) => {
      if (!isSocialAuthPlatform(platformId)) return true;
      return socialConnections[platformId as keyof SocialPlatformConnection] === true;
    },
    [socialConnections],
  );

  const toggleDistributionPlatform = (platformId: string) => {
    if (isComingSoonPlatform(platformId)) {
      return;
    }
    if (activeDistributionTab === 'social_media' && !isSocialPlatformConnected(platformId)) {
      return;
    }
    if (platformId === 'company_page' && !tenantCompanyPage) {
      setError('Create your company page first to publish internally.');
      return;
    }
    markWizardDirty();
    setSelectedDistributionPlatforms((prev) => ({
      ...prev,
      [platformId]: !prev[platformId],
    }));
  };

  const handleConnectSocialPlatform = async (platformId: string) => {
    if (platformId === 'instagram') {
      setError('Instagram integration is coming soon.');
      return;
    }

    setConnectingPlatformId(platformId);
    setError('');
    try {
      saveJobAiWizardOauthDraft({
        draft,
        selectedDistributionPlatforms,
        activeDistributionTab,
        publishFlowStep: 'distribution',
        step: 'review',
        mode,
        preScreenAssessments,
      });
      sessionStorage.setItem('reopen_job_ai_wizard', '1');
      sessionStorage.setItem('reopen_job_ai_wizard_mode', mode);
      sessionStorage.removeItem('reopen_create_job_drawer');

      if (platformId === 'linkedin') {
        await linkedIn.connect({ reopenCreateJobDrawer: false });
        return;
      }
      if (platformId === 'x_twitter') {
        await apiConnectIntegration('twitter', window.location.href);
        return;
      }
      if (platformId === 'facebook') {
        await apiConnectIntegration('facebook', window.location.href);
        return;
      }
      setConnectingPlatformId(null);
    } catch (err: unknown) {
      sessionStorage.removeItem('reopen_job_ai_wizard');
      sessionStorage.removeItem('reopen_job_ai_wizard_mode');
      clearJobAiWizardOauthDraft();
      setError(err instanceof Error ? err.message : 'Could not connect this platform.');
      setConnectingPlatformId(null);
    }
  };

  const distributionChannels = useMemo(
    () => getDistributionChannelsFromPlatforms(selectedDistributionPlatforms),
    [selectedDistributionPlatforms],
  );

  const activeDistributionOption = useMemo(
    () => DISTRIBUTION_OPTIONS.find((option) => option.id === activeDistributionTab)!,
    [activeDistributionTab],
  );
  const ActiveDistributionIcon = activeDistributionOption.icon;

  const publishFlowTitle =
    publishFlowStep === 'assessment'
      ? 'Pre-assessment test'
      : publishFlowStep === 'distribution'
        ? 'Publish destinations'
        : STEP_LABELS[step];

  const publishFlowHint =
    publishFlowStep === 'assessment'
      ? 'Add a screening test for applicants, or skip to choose where the job is published.'
      : publishFlowStep === 'distribution'
        ? 'Pick a category, then choose the platforms to publish on.'
        : isManual && step === 'title'
          ? 'Give this role a clear title, then continue.'
          : STEP_HINTS[step];

  const goBack = () => {
    setError('');
    if (publishFlowStep === 'distribution') {
      setPublishFlowStep('assessment');
      return;
    }
    if (publishFlowStep === 'assessment') {
      setPublishFlowStep(null);
      return;
    }
    const idx = wizardSteps.indexOf(step);
    if (idx > 0) setStep(wizardSteps[idx - 1]);
  };

  const runAiGenerate = async () => {
    if (!jobAiGate.confirmAndUnlock()) return;
    setGenerating(true);
    setError('');
    try {
      const prompt = [
        `Create a complete job posting.`,
        `Client / company: ${draft.clientName}`,
        `Job title: ${draft.jobTitle}`,
        `Location: ${[draft.city, draft.state, draft.country].filter(Boolean).join(', ') || draft.locationQuery}`,
        draft.extraPrompt.trim() ? `Additional requirements and notes:\n${draft.extraPrompt.trim()}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const response = await apiGenerateJobFromPrompt({
        prompt,
        currentForm: {
          jobTitle: draft.jobTitle,
          companyId: draft.clientId,
          companyName: draft.clientName,
          country: draft.country,
          state: draft.state,
          city: draft.city,
          numberOfOpenings: draft.numberOfOpenings,
          priority: draft.priority,
          employmentType: draft.employmentType,
          targetHireDate: draft.targetHireDate || defaultTargetHireDate(),
        },
      });

      const data = response.data;
      if (!data?.jobTitle) {
        throw new Error('AI could not build a job from those details. Try adding more in the prompt.');
      }

      setDraft((prev) =>
        pipelineToDraft(
          {
            ...prev,
            clientId: prev.clientId,
            clientName: prev.clientName,
          },
          { ...data, companyId: prev.clientId, companyName: prev.clientName },
        ),
      );
      markWizardDirty();
      setStep('review');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'AI job creation failed.');
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!validateReview()) return;

    const selectedChannels = Object.entries(distributionChannels).filter(([, on]) => on);
    if (selectedChannels.length === 0) {
      setError('Select at least one publish destination.');
      return;
    }

    const publishToCompanyPage = Boolean(selectedDistributionPlatforms.company_page);
    if (publishToCompanyPage && !tenantCompanyPage) {
      setError('Create your company page first, then publish to Internal company.');
      setActiveDistributionTab('internal_company');
      return;
    }

    setPublishing(true);
    setError('');
    try {
      const keyResponsibilities = toList(draft.keyResponsibilitiesText);
      const qualifications = toList(draft.qualificationsExperienceText);
      const candidateRequirements = toList(draft.candidateRequirementsText);
      const skills = draft.skills;
      const languages = draft.languages.filter((row) => row.language?.trim());

      const locationParts = [draft.city, draft.state, draft.country]
        .map((v) => v.trim())
        .filter(Boolean);
      const minExp = Number(draft.minExperience);
      const maxExp = Number(draft.maxExperience);

      const jobData: CreateJobData & {
        distributionPlatforms?: Record<string, boolean>;
      } = {
        title: draft.jobTitle.trim(),
        description: draft.jobDescriptionHtml.trim() || undefined,
        clientId: draft.clientId,
        openings: parseInt(draft.numberOfOpenings, 10) || 1,
        type: mapJobType(draft.employmentType),
        status: 'OPEN',
        location: locationParts.join(', ') || draft.locationQuery || undefined,
        country: draft.country.trim() || undefined,
        state: draft.state.trim() || undefined,
        city: draft.city.trim() || undefined,
        nationality: draft.nationality.trim() || undefined,
        priority: draft.priority || undefined,
        jobCategory: draft.industryType.trim() || undefined,
        expectedClosureDate: draft.targetHireDate || undefined,
        managerId: draft.managerId || undefined,
        assignedToId: draft.assignedToId || undefined,
        hiringManager: draft.contactPersonName.trim() || undefined,
        hiringManagerId: draft.contactPersonId || undefined,
        showClientNamePublicly: draft.showClientNamePublicly,
        publicFieldVisibility: draft.publicFieldVisibility,
        forecastRevenue: draft.forecastRevenue.trim() || undefined,
        videoMediaLink: draft.videoMediaLink.trim() || undefined,
        skills,
        keyResponsibilities,
        requirements: qualifications,
        candidateRequirements,
        languages,
        experienceRequired:
          Number.isFinite(minExp) || Number.isFinite(maxExp)
            ? `${Number.isFinite(minExp) ? minExp : ''}${Number.isFinite(maxExp) ? `-${maxExp}` : ''}`.trim()
            : undefined,
        salary:
          draft.payRangeMin || draft.payRangeMax
            ? {
                currency: draft.salaryCurrency || 'USD',
                min: draft.payRangeMin ? Number(draft.payRangeMin) : undefined,
                max: draft.payRangeMax ? Number(draft.payRangeMax) : undefined,
              }
            : undefined,
        preScreenAssessments: preScreenAssessments.map((link, index) => ({
          assessmentId: link.assessmentId,
          sortOrder: index,
          required: link.required !== false,
          timing: link.timing || 'AFTER_APPLY',
          durationOverrideMinutes: link.durationOverrideMinutes ?? null,
          passScoreOverridePercent: link.passScoreOverridePercent ?? null,
        })),
        distributionPlatforms: {
          internalCompany: distributionChannels.internal_company,
          companyPage: publishToCompanyPage,
          hryantra: Boolean(selectedDistributionPlatforms.hryantra_job_board),
          externalPlatforms: distributionChannels.external_platforms,
          socialMedia: distributionChannels.social_media,
        },
      };

      const created = await apiCreateJob(jobData);
      const createdJob = created.data;

      if (publishToCompanyPage) {
        let applyUrl = '';
        try {
          if (createdJob?.id) {
            const linkRes = await apiGetJobApplyLink(createdJob.id);
            applyUrl = String(linkRes.data?.applyUrl || '').trim();
          }
        } catch {
          /* apply link is optional for the company-page post */
        }

        const locationLine =
          locationParts.join(', ') || draft.locationQuery.trim() || '';
        const plainDescription = stripHtml(draft.jobDescriptionHtml || '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 280);
        const postLines = [
          `We're hiring: ${draft.jobTitle.trim()}`,
          locationLine ? `Location: ${locationLine}` : '',
          draft.numberOfOpenings
            ? `Openings: ${draft.numberOfOpenings}`
            : '',
          plainDescription ? `\n${plainDescription}${plainDescription.length >= 280 ? '…' : ''}` : '',
          applyUrl ? `\nApply: ${applyUrl}` : '',
        ].filter(Boolean);

        await apiCreateTenantCompanyPost({ text: postLines.join('\n') });
      }

      markWizardClean();
      onJobCreated?.();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to publish job.');
    } finally {
      setPublishing(false);
    }
  };

  if (!isOpen) return null;

  const fieldClass =
    'w-full rounded-2xl border border-slate-200/90 bg-white/90 px-3.5 py-3 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition placeholder:text-slate-400 hover:border-[#2098C8]/60 hover:shadow-md hover:shadow-[#2098C8]/10 focus:border-[#2098C8] focus:bg-white focus:ring-4 focus:ring-[#2098C8]/15';
  const textareaClass = `${fieldClass} min-h-[96px] resize-none leading-relaxed`;
  const labelClass =
    'mb-2 block text-[0.68rem] font-bold uppercase tracking-[0.16em] text-slate-500';
  const sectionClass =
    'rounded-[1.35rem] border border-white/80 bg-white/80 p-4 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.04] backdrop-blur-sm sm:p-5';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={() => void requestWizardClose()}
      />

      <motion.div
        ref={wizardPanelRef}
        initial={{ opacity: 0, y: 28, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
        className="relative flex max-h-[min(92vh,920px)] w-full max-w-3xl flex-col overflow-hidden rounded-[1.85rem] border border-white/70 bg-gradient-to-b from-white via-white to-slate-50 shadow-[0_40px_100px_-24px_rgba(2,6,23,0.55)]"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[radial-gradient(ellipse_at_top_right,_rgba(32,152,200,0.18),_transparent_55%),radial-gradient(ellipse_at_top_left,_rgba(32,152,200,0.12),_transparent_50%)]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage:
              'radial-gradient(rgba(15,23,42,0.055) 1px, transparent 1px)',
            backgroundSize: '18px 18px',
            maskImage: 'linear-gradient(to bottom, black 0%, transparent 40%)',
          }}
          aria-hidden
        />

        <div className="relative border-b border-[#2098C8]/20 px-5 pb-4 pt-5 sm:px-7 sm:pt-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#2098C8]/35 bg-[#E8F6FC] px-3 py-1 shadow-sm shadow-[#2098C8]/10">
                <span className="relative flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-[#2098C8]/25">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/hryantra-logo.png" alt="" className="h-5 w-5 object-contain" />
                </span>
                <span className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[#176F96]">
                  {isManual ? 'Create job' : 'AI job creation'}
                </span>
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${step}-${publishFlowStep || 'main'}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22 }}
                >
                  <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.7rem]">
                    {publishFlowTitle}
                  </h2>
                  <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-slate-500">
                    {publishFlowHint}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
            <button
              type="button"
              onClick={() => void requestWizardClose()}
              className="rounded-full border border-slate-200/90 bg-white/90 p-2.5 text-slate-400 shadow-sm transition hover:scale-105 hover:border-slate-300 hover:text-slate-700 active:scale-95"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-5 flex items-center gap-2">
            {wizardSteps.map((s, i) => {
              const done = i < stepIndex;
              const active = i === stepIndex;
              return (
                <div key={s} className="flex flex-1 items-center gap-2">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold transition-all ${
                      done
                        ? 'bg-[#2098C8] text-white shadow-md shadow-[#2098C8]/30'
                        : active
                          ? 'bg-[#2098C8] text-white shadow-lg shadow-[#2098C8]/30 ring-4 ring-[#2098C8]/25'
                          : 'bg-slate-100 text-slate-400 ring-1 ring-slate-200'
                    }`}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </div>
                  {i < wizardSteps.length - 1 ? (
                    <div
                      className={`h-1.5 flex-1 rounded-full ${
                        done
                          ? 'bg-[#2098C8]'
                          : active
                            ? 'bg-gradient-to-r from-[#2098C8] to-slate-200'
                            : 'bg-slate-200/90'
                      }`}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
          <p className="mt-2.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {publishFlowStep === 'assessment'
              ? 'Publish · Step 1 of 2'
              : publishFlowStep === 'distribution'
                ? 'Publish · Step 2 of 2'
                : `Step ${stepIndex + 1} of ${wizardSteps.length}`}
          </p>
        </div>

        <div
          className={`relative min-h-0 flex-1 px-5 py-5 sm:px-7 [scrollbar-width:thin] [scrollbar-color:#2098C8_transparent] ${
            publishFlowStep === 'assessment'
              ? 'overflow-y-auto overflow-x-hidden pb-44'
              : 'overflow-y-auto'
          }`}
        >
          {error ? (
            <div className="mb-4 rounded-2xl border border-red-200/80 bg-red-50/90 px-4 py-3 text-sm text-red-700 shadow-sm">
              {error}
            </div>
          ) : null}

          <AnimatePresence mode="wait">
            {step === 'client' ? (
              <motion.div
                key="client"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.22 }}
                className="space-y-4"
              >
                <div className="relative overflow-hidden rounded-[1.35rem] border border-[#2098C8]/25 bg-gradient-to-br from-[#E8F6FC] via-white to-[#E8F6FC]/70 p-4 shadow-sm sm:p-5">
                  <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[#2098C8]/25 blur-2xl" />
                  <div className="relative flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#2098C8] text-white shadow-lg shadow-[#2098C8]/30">
                      <Building2 className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900">Select your client</p>
                      <p className="mt-0.5 text-sm text-slate-500">
                        Search or tap a company below — this job will be linked to them. Or create a new client with the same fields as the Clients page.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#2098C8]/80" />
                    <input
                      type="search"
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      placeholder="Search clients…"
                      className={`${fieldClass} pl-10`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreateClient(true)}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-[#2098C8]/35 bg-white px-4 py-2.5 text-sm font-semibold text-[#176F96] shadow-sm transition hover:border-[#2098C8] hover:bg-[#E8F6FC] hover:text-[#0F5A7A]"
                  >
                    <Plus className="h-4 w-4" />
                    Create client
                  </button>
                </div>
                {loadingClients ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-14 text-sm text-slate-500">
                    <Loader2 className="h-6 w-6 animate-spin text-[#2098C8]" />
                    Loading clients…
                  </div>
                ) : (
                  <div className="max-h-[420px] space-y-2.5 overflow-y-auto pr-1 [scrollbar-width:thin]">
                    {filteredClients.length === 0 ? (
                      <div className="rounded-[1.35rem] border border-dashed border-slate-200 bg-white/70 px-4 py-10 text-center">
                        <p className="text-sm text-slate-500">No clients found.</p>
                        <button
                          type="button"
                          onClick={() => setShowCreateClient(true)}
                          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#2098C8] hover:underline"
                        >
                          <Plus className="h-4 w-4" />
                          Create a new client
                        </button>
                      </div>
                    ) : (
                      filteredClients.map((client, index) => {
                        const selected = draft.clientId === client.id;
                        return (
                          <motion.button
                            key={client.id}
                            type="button"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: Math.min(index * 0.03, 0.24) }}
                            whileHover={{ y: -1 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={() =>
                              patchDraft({
                                clientId: client.id,
                                clientName: client.companyName || 'Client',
                              })
                            }
                            className={`group flex w-full items-center gap-3 rounded-[1.2rem] border px-4 py-3.5 text-left transition ${
                              selected
                                ? 'border-[#2098C8] bg-gradient-to-r from-[#E8F6FC] to-[#E8F6FC]/70 shadow-md shadow-[#2098C8]/15 ring-2 ring-[#2098C8]/25'
                                : 'border-slate-200/70 bg-white/90 shadow-sm shadow-slate-900/[0.03] hover:border-[#2098C8]/55 hover:bg-[#E8F6FC]/50 hover:shadow-md hover:shadow-[#2098C8]/10'
                            }`}
                          >
                            <div
                              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition ${
                                selected
                                  ? 'bg-[#2098C8] text-white shadow-md shadow-[#2098C8]/25'
                                  : 'bg-gradient-to-br from-slate-100 to-slate-50 text-[#2098C8] ring-1 ring-slate-200/80 group-hover:from-[#E8F6FC] group-hover:to-white'
                              }`}
                            >
                              {client.logo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={client.logo}
                                  alt=""
                                  className="h-12 w-12 rounded-2xl object-cover"
                                />
                              ) : (
                                <Building2 className="h-5 w-5" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold text-slate-900">
                                {client.companyName}
                              </p>
                              <p className="truncate text-xs text-slate-500">
                                {client.industry || client.location || 'Client'}
                              </p>
                            </div>
                            <span
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition ${
                                selected
                                  ? 'bg-[#2098C8] text-white shadow-sm shadow-[#2098C8]/30'
                                  : 'bg-slate-100 text-transparent group-hover:bg-[#D6EEF8] group-hover:text-[#2098C8]/45'
                              }`}
                            >
                              <Check className="h-4 w-4" />
                            </span>
                          </motion.button>
                        );
                      })
                    )}
                  </div>
                )}
              </motion.div>
            ) : null}

            {step === 'title' ? (
              <motion.div
                key="title"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.22 }}
                className="space-y-4"
              >
                <div className={sectionClass}>
                  <label className={labelClass}>Job title *</label>
                  <input
                    type="text"
                    value={draft.jobTitle}
                    onChange={(e) => patchDraft({ jobTitle: e.target.value })}
                    placeholder="e.g. React Developer"
                    className={fieldClass}
                    autoFocus
                  />
                </div>
                {!isManual ? (
                <div className={`${sectionClass} relative overflow-hidden`}>
                  <div className="pointer-events-none absolute -right-8 top-0 h-24 w-24 rounded-full bg-[#D6EEF8]/60 blur-2xl" />
                  <p className="relative mb-3 inline-flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[#176F96]">
                    <Sparkles className="h-3.5 w-3.5 text-[#2098C8]" />
                    AI recommendations
                    {loadingTitleSuggestions ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#2098C8]" />
                    ) : null}
                  </p>
                  {draft.jobTitle.trim().length < 2 ? (
                    <p className="relative text-sm text-slate-500">
                      Type at least 2 characters to get AI title recommendations.
                    </p>
                  ) : loadingTitleSuggestions && titleSuggestions.length === 0 ? (
                    <p className="relative text-sm text-slate-500">Finding matching titles…</p>
                  ) : titleSuggestions.length === 0 ? (
                    <p className="relative text-sm text-slate-500">
                      No AI suggestions yet. Keep typing or enter your own title.
                    </p>
                  ) : (
                    <div className="relative flex flex-wrap gap-2">
                      {titleSuggestions.map((title) => (
                        <button
                          key={title}
                          type="button"
                          onClick={() => patchDraft({ jobTitle: title })}
                          className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                            draft.jobTitle === title
                              ? 'border-[#2098C8] bg-[#E8F6FC] text-[#176F96] shadow-sm shadow-[#2098C8]/15'
                              : 'border-slate-200 bg-slate-50/80 text-slate-700 hover:border-[#2098C8]/55 hover:bg-white hover:shadow-sm'
                          }`}
                        >
                          {title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                ) : null}
              </motion.div>
            ) : null}

            {step === 'location' ? (
              <motion.div
                key="location"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.22 }}
                className="space-y-4"
              >
                <div className={sectionClass}>
                  <label className={labelClass}>Location</label>
                  <LocationAutocomplete
                    value={draft.locationQuery}
                    onChange={(next) => patchDraft({ locationQuery: next })}
                    onSelect={(sel) =>
                      patchDraft({
                        locationQuery: sel.location,
                        country: sel.country,
                        state: sel.state,
                        city: sel.city,
                      })
                    }
                    placeholder="Search location…"
                    inputClassName={fieldClass}
                  />
                  <div className="mt-4 grid gap-3.5 sm:grid-cols-3">
                    <div>
                      <label className={labelClass}>Country *</label>
                      <input
                        className={fieldClass}
                        value={draft.country}
                        onChange={(e) => patchDraft({ country: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>State</label>
                      <input
                        className={fieldClass}
                        value={draft.state}
                        onChange={(e) => patchDraft({ state: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>City</label>
                      <input
                        className={fieldClass}
                        value={draft.city}
                        onChange={(e) => patchDraft({ city: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : null}

            {step === 'prompt' ? (
              <motion.div
                key="prompt"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="space-y-4"
              >
                <div className="rounded-2xl border border-[#2098C8]/25 bg-gradient-to-br from-[#E8F6FC]/90 via-white to-[#E8F6FC]/60 p-4 shadow-sm sm:p-5">
                  <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[#176F96]">
                    Preview so far
                  </p>
                  <div className="mt-3 space-y-2.5 text-sm text-slate-800">
                    <p>
                      <span className="font-semibold text-slate-500">Client:</span>{' '}
                      {draft.clientName}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-500">Title:</span>{' '}
                      {draft.jobTitle}
                    </p>
                    <p className="inline-flex items-start gap-1.5">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#2098C8]" />
                      {[draft.city, draft.state, draft.country].filter(Boolean).join(', ') ||
                        draft.locationQuery ||
                        '—'}
                    </p>
                  </div>
                </div>

                <div className={sectionClass}>
                  <label className={labelClass}>Tell AI what else to include</label>
                  <textarea
                    value={draft.extraPrompt}
                    onChange={(e) => patchDraft({ extraPrompt: e.target.value })}
                    rows={6}
                    placeholder="e.g. 3–5 years React experience, remote OK, salary 15–25 LPA, must know TypeScript, join within 30 days…"
                    className={`${textareaClass} min-h-[140px]`}
                  />
                  <p className="mt-2.5 text-xs leading-relaxed text-slate-500">
                    AI will generate description, responsibilities, skills, salary hints, and more.
                    You can edit everything on the next screen. To fill the job manually instead, use{' '}
                    <span className="font-semibold text-slate-600">Skip</span> below.
                  </p>
                </div>
              </motion.div>
            ) : null}

            {publishFlowStep === 'assessment' ? (
              <motion.div
                key="publish-assessment"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="space-y-4"
              >
                <div className={`${sectionClass} overflow-visible`}>
                  <PreScreenAssessmentSection
                    libraryMenuOpensUp
                    jobTitle={draft.jobTitle}
                    skills={draft.skills}
                    jobDescription={
                      draft.jobDescriptionHtml?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() ||
                      ''
                    }
                    links={preScreenAssessments}
                    onChange={(links) => {
                      markWizardDirty();
                      setPreScreenAssessments(links);
                    }}
                  />
                </div>
              </motion.div>
            ) : null}

            {publishFlowStep === 'distribution' ? (
              <motion.div
                key="publish-distribution"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="space-y-4"
              >
                <p className="rounded-2xl border border-[#2098C8]/25 bg-gradient-to-r from-[#E8F6FC]/80 to-[#E8F6FC]/60 px-4 py-3 text-sm text-slate-600 shadow-sm">
                  Choose where to publish{' '}
                  <span className="font-semibold">{draft.jobTitle}</span>.
                </p>

                <div className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200/80 bg-slate-50/90 p-1 [scrollbar-width:thin]">
                  {DISTRIBUTION_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const active = activeDistributionTab === option.id;
                    const hasSelection = DISTRIBUTION_PLATFORMS[option.id].some(
                      (platform) =>
                        !isComingSoonPlatform(platform.id) &&
                        selectedDistributionPlatforms[platform.id],
                    );
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setActiveDistributionTab(option.id)}
                        className={`flex min-w-[7.5rem] flex-1 flex-col items-center gap-1.5 rounded-xl px-2 py-2.5 text-center transition sm:min-w-0 sm:flex-row sm:px-3 sm:text-left ${
                          active
                            ? 'bg-white text-[#176F96] shadow-sm ring-1 ring-[#2098C8]/30'
                            : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
                        }`}
                      >
                        <span
                          className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                            active ? 'bg-[#2098C8] text-white' : 'bg-slate-200/80 text-[#2098C8]'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          {hasSelection ? (
                            <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white">
                              <Check className="h-2 w-2 text-white" />
                            </span>
                          ) : null}
                        </span>
                        <span className="text-[0.7rem] font-semibold leading-tight sm:text-xs">
                          {option.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className={sectionClass}>
                  <div className="flex items-start gap-3 border-b border-slate-100 pb-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2098C8]/10 text-[#2098C8]">
                      <ActiveDistributionIcon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {activeDistributionOption.label}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                        {activeDistributionOption.description}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-slate-400">
                    {activeDistributionTab === 'internal_company' ? 'Company page' : 'Platforms'}
                  </p>
                  {activeDistributionTab === 'internal_company' ? (
                    <div className="mt-3">
                      {loadingCompanyPage ? (
                        <div className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-4 py-6 text-sm text-slate-500">
                          <Loader2 className="h-4 w-4 animate-spin text-[#2098C8]" />
                          Checking company page…
                        </div>
                      ) : tenantCompanyPage ? (
                        <button
                          type="button"
                          onClick={() => toggleDistributionPlatform('company_page')}
                          className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                            selectedDistributionPlatforms.company_page
                              ? 'border-[#2098C8] bg-gradient-to-r from-[#E8F6FC]/90 to-white shadow-sm ring-1 ring-[#2098C8]/20'
                              : 'border-slate-200/80 bg-white hover:border-[#2098C8]/40 hover:bg-[#E8F6FC]/30'
                          }`}
                        >
                          <span
                            className={`flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl ${
                              selectedDistributionPlatforms.company_page
                                ? 'bg-[#2098C8] text-white'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {tenantCompanyPage.logoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={tenantCompanyPage.logoUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Building2 className="h-5 w-5" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-slate-900">
                              {tenantCompanyPage.name}
                            </span>
                            <span className="mt-0.5 block text-[0.7rem] text-slate-500">
                              Post this job on your company page in Phase 1 community
                              {tenantCompanyPage.domainKey
                                ? ` · ${tenantCompanyPage.domainKey}`
                                : ''}
                            </span>
                          </span>
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                              selectedDistributionPlatforms.company_page
                                ? 'border-[#2098C8] bg-[#2098C8] text-white'
                                : 'border-slate-200 bg-white'
                            }`}
                          >
                            {selectedDistributionPlatforms.company_page ? (
                              <Check className="h-3 w-3" />
                            ) : null}
                          </span>
                        </button>
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-5">
                          <p className="text-sm font-semibold text-slate-900">
                            No company page yet
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-slate-500">
                            Create your company page first. Then you can publish jobs to it from
                            Internal company.
                          </p>
                          <a
                            href="/company-page"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800"
                          >
                            Create company page
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              setLoadingCompanyPage(true);
                              void apiGetTenantCompanyPage()
                                .then((res) => {
                                  const page = res.data?.page || null;
                                  setTenantCompanyPage(page);
                                  if (page) {
                                    setSelectedDistributionPlatforms((prev) => ({
                                      ...prev,
                                      company_page: true,
                                    }));
                                  }
                                })
                                .catch(() => setTenantCompanyPage(null))
                                .finally(() => setLoadingCompanyPage(false));
                            }}
                            className="ml-2 mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Refresh
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {DISTRIBUTION_PLATFORMS[activeDistributionTab].map((platform) => {
                      const selected = Boolean(selectedDistributionPlatforms[platform.id]);
                      const requiresSocialAuth =
                        activeDistributionTab === 'social_media' &&
                        isSocialAuthPlatform(platform.id);
                      const connected = isSocialPlatformConnected(platform.id);
                      const isConnecting = connectingPlatformId === platform.id;
                      const comingSoon = isComingSoonPlatform(platform.id);
                      const PlatformIcon =
                        platform.id === 'linkedin'
                          ? Linkedin
                          : platform.id === 'x_twitter'
                            ? Share2
                            : platform.id === 'indeed' ||
                                platform.id === 'naukri' ||
                                platform.id === 'glassdoor' ||
                                platform.id === 'monster'
                              ? Globe
                              : platform.id.includes('hryantra')
                                ? Sparkles
                                : Building2;

                      if (comingSoon) {
                        return (
                          <div
                            key={platform.id}
                            aria-disabled="true"
                            className="flex cursor-not-allowed items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/90 px-3 py-3 opacity-75"
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-200/80 text-slate-500">
                              {platform.id === 'x_twitter' ? (
                                <span className="text-sm font-bold">X</span>
                              ) : (
                                <PlatformIcon className="h-4 w-4" />
                              )}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-700">{platform.label}</p>
                              <p className="text-[0.7rem] text-slate-500">Coming soon</p>
                            </div>
                            <span className="shrink-0 rounded-full bg-slate-200/90 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                              Soon
                            </span>
                          </div>
                        );
                      }

                      if (requiresSocialAuth && !connected) {
                        return (
                          <div
                            key={platform.id}
                            className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-3 py-3"
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                              {platform.id === 'x_twitter' ? (
                                <span className="text-sm font-bold">X</span>
                              ) : (
                                <PlatformIcon className="h-4 w-4" />
                              )}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-800">{platform.label}</p>
                              <p className="text-[0.7rem] text-slate-500">
                                {platform.id === 'instagram'
                                  ? 'Coming soon'
                                  : 'Sign in to publish here'}
                              </p>
                            </div>
                            {platform.id === 'instagram' ? (
                              <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                                Soon
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => void handleConnectSocialPlatform(platform.id)}
                                disabled={isConnecting}
                                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#2098C8]/40 bg-[#E8F6FC]/70 px-3 py-1.5 text-xs font-semibold text-[#176F96] transition hover:border-[#2098C8] hover:bg-[#E8F6FC] disabled:cursor-wait disabled:opacity-60"
                              >
                                {isConnecting ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <LogIn className="h-3.5 w-3.5" />
                                )}
                                Log in
                              </button>
                            )}
                          </div>
                        );
                      }

                      return (
                        <button
                          key={platform.id}
                          type="button"
                          onClick={() => toggleDistributionPlatform(platform.id)}
                          className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                            selected
                              ? 'border-[#2098C8] bg-gradient-to-r from-[#E8F6FC]/90 to-white shadow-sm ring-1 ring-[#2098C8]/20'
                              : 'border-slate-200/80 bg-white hover:border-[#2098C8]/40 hover:bg-[#E8F6FC]/30'
                          }`}
                        >
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                              selected
                                ? 'bg-[#2098C8] text-white'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {platform.id === 'x_twitter' ? (
                              <span className="text-sm font-bold">X</span>
                            ) : (
                              <PlatformIcon className="h-4 w-4" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1 text-sm font-medium text-slate-800">
                            {platform.label}
                          </span>
                          {requiresSocialAuth && connected ? (
                            <span className="shrink-0 text-[0.65rem] font-medium text-emerald-600">
                              Connected
                            </span>
                          ) : null}
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                              selected
                                ? 'border-[#2098C8] bg-[#2098C8] text-white'
                                : 'border-slate-200 bg-white'
                            }`}
                          >
                            {selected ? <Check className="h-3 w-3" /> : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  )}
                </div>
              </motion.div>
            ) : null}

            {step === 'review' && !publishFlowStep ? (
              <motion.div
                key="review"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="space-y-4"
              >
                <p className="rounded-2xl border border-[#2098C8]/25 bg-gradient-to-r from-[#E8F6FC]/80 to-[#E8F6FC]/60 px-4 py-3 text-sm text-slate-600 shadow-sm">
                  Review and edit the job details, then publish.
                </p>

                <div className={`${sectionClass} space-y-6`}>
                  <div className="flex items-start gap-3 border-b border-slate-100 pb-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2098C8]/10 text-[#2098C8]">
                      <Briefcase className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Job Details</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Description, role info, and requirements
                      </p>
                    </div>
                  </div>

                  <div>
                    <input
                      ref={jdFileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        void handleJdFilePick(file);
                      }}
                    />

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-900">
                        Job Description <span className="font-normal text-slate-500">(optional)</span>
                      </h3>
                      <div className="flex flex-wrap items-center gap-2">
                        <PublicVisibilityToggle
                          visible={isJobFieldPubliclyVisible(
                            draft.publicFieldVisibility,
                            'jobDescription',
                          )}
                          onToggle={() =>
                            patchDraft({
                              publicFieldVisibility: toggleJobPublicFieldVisibility(
                                parseJobPublicFieldVisibility(draft.publicFieldVisibility),
                                'jobDescription',
                              ),
                            })
                          }
                        />
                        <button
                          type="button"
                          onClick={() => jdFileInputRef.current?.click()}
                          disabled={jdGenerating}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:border-[#2098C8]/40 hover:bg-[#E8F6FC]/50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Upload className="h-3.5 w-3.5 text-[#2098C8]" />
                          Upload job description
                          <span className="font-normal text-slate-500">· PDF, DOC, DOCX, TXT</span>
                        </button>
                        {!isManual ? (
                        <button
                          type="button"
                          onClick={() => void handleAutoFillFromPastedJd()}
                          disabled={jdGenerating}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#2098C8]/30 bg-[#E8F6FC] px-3 py-1.5 text-xs font-semibold text-[#176F96] hover:bg-[#E8F6FC]/80 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Auto-fill from pasted JD
                        </button>
                        ) : null}
                      </div>
                    </div>

                    <p className="mt-1 mb-3 text-xs text-slate-500">
                      {isManual
                        ? 'Upload a JD or paste and edit the full posting below.'
                        : 'Upload a document to parse and auto-fill job fields with AI, or paste and edit the full posting below.'}
                    </p>

                    {jdAttachment ? (
                      <div className="mb-3 flex items-center gap-2 rounded-lg border border-slate-700/30 bg-slate-900 px-2.5 py-2 text-white">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#2098C8]">
                          {jdAttachment.status === 'processing' ? (
                            <Loader2 className="h-4 w-4 animate-spin text-white" />
                          ) : (
                            <FileText className="h-4 w-4 text-white" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium leading-tight">
                            {jdAttachment.file.name}
                          </p>
                          <p className="text-[11px] leading-tight text-slate-400">
                            {jdAttachment.status === 'processing'
                              ? 'Extracting job details…'
                              : jdAttachment.status === 'error'
                                ? jdAttachment.error || 'Processing failed'
                                : 'Ready — review the form and publish'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setJdAttachment(null);
                            setJdError('');
                          }}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
                          aria-label="Remove attached file"
                          disabled={jdAttachment.status === 'processing'}
                        >
                          <X size={12} strokeWidth={2.5} />
                        </button>
                      </div>
                    ) : null}

                    {jdError ? (
                      <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
                        {jdError}
                      </p>
                    ) : null}

                    <div
                      onPasteCapture={(event) => {
                        const pastedText = event.clipboardData.getData('text/plain')?.trim() || '';
                        if (pastedText.length >= 50) {
                          setPastedJobDescriptionText(pastedText);
                          setJdError('');
                        }
                      }}
                    >
                      <RichTextEditor
                        value={draft.jobDescriptionHtml}
                        onChange={(html) => patchDraft({ jobDescriptionHtml: html })}
                        placeholder="Paste or enter the full job description…"
                        minHeight={280}
                      />
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-2">
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
                    />
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="relative flex items-center justify-between gap-3 border-t border-[#2098C8]/25 bg-white/90 px-5 py-4 backdrop-blur-md sm:px-7">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#2098C8]/50 to-transparent" />
          <button
            type="button"
            onClick={goBack}
            disabled={
              (step === 'client' && !publishFlowStep) || generating || publishing
            }
            className="inline-flex items-center gap-1.5 rounded-2xl px-3.5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          {publishFlowStep === 'assessment' ? (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setPublishFlowStep('distribution');
                }}
                className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setPublishFlowStep('distribution');
                }}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#2098C8] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#2098C8]/30 transition hover:bg-[#1A86B3] hover:shadow-xl hover:shadow-[#2098C8]/35 active:scale-[0.98]"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : publishFlowStep === 'distribution' ? (
            <button
              type="button"
              onClick={() => void handlePublish()}
              disabled={publishing}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#2098C8] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#2098C8]/30 transition hover:bg-[#1A86B3] hover:shadow-xl hover:shadow-[#2098C8]/35 active:scale-[0.98] disabled:opacity-60"
            >
              {publishing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Publish job
            </button>
          ) : step === 'review' ? (
            <button
              type="button"
              onClick={startPublishFlow}
              disabled={publishing}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#2098C8] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#2098C8]/30 transition hover:bg-[#1A86B3] hover:shadow-xl hover:shadow-[#2098C8]/35 active:scale-[0.98] disabled:opacity-60"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : step === 'prompt' ? (
            <div className="flex flex-col items-end gap-2">
              <AiCoinLockBanner featureId="ai.job_from_prompt" className="w-full max-w-md" />
              <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={skipAiBrief}
                disabled={generating}
                className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] disabled:opacity-60"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={generating}
                className={`inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-bold text-white shadow-lg transition active:scale-[0.98] disabled:opacity-60 ${
                  jobAiGate.locked
                    ? 'bg-amber-600 shadow-amber-600/30 hover:bg-amber-700'
                    : 'bg-[#2098C8] shadow-[#2098C8]/30 hover:bg-[#1A86B3] hover:shadow-xl hover:shadow-[#2098C8]/35'
                }`}
                title={
                  jobAiGate.locked
                    ? `Locked — needs ${jobAiGate.cost} coins`
                    : `Spend ${jobAiGate.cost} coins to generate`
                }
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    {jobAiGate.locked ? <Lock className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                    Generate with AI
                    <AiCoinLockBadge featureId="ai.job_from_prompt" />
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={goNext}
              disabled={generating}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#2098C8] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#2098C8]/30 transition hover:bg-[#1A86B3] hover:shadow-xl hover:shadow-[#2098C8]/35 active:scale-[0.98] disabled:opacity-60"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </motion.div>

      {showCreateClient ? (
        <ClientDetailsDrawer
          client={null}
          isAddMode
          stackClassName="z-[100]"
          onClose={() => setShowCreateClient(false)}
          onClientCreated={handleClientCreatedFromWizard}
        />
      ) : null}
    </div>
  );
}
