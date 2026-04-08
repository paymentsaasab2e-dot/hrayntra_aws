'use client';

import React, { useState, useMemo, useEffect, useCallback, Suspense } from 'react';
import { StageTabs } from './components/StageTabs';
import { CandidateTable, Candidate } from './components/CandidateTable';
import { CandidateGrid } from './components/CandidateGrid';
import { FilterDrawer } from './components/FilterDrawer';
import { BulkActions } from './components/BulkActions';
import AddCandidateDrawer from '../../components/candidates/AddCandidateDrawer';
import {
  CandidateProfileDrawer,
  type CandidateInterviewerOption,
  type CandidateProfileDrawerData,
  type CandidateScheduledInterview,
  type CandidatePipelineJobOption,
  type CandidatePipelineRecruiterOption,
  type CandidateTagItem,
} from '../../components/drawers/CandidateProfileDrawer';
import { 
  Filter, 
  LayoutGrid, 
  List, 
  Plus,
  CheckSquare,
  Upload,
} from 'lucide-react';
import { CreateTaskModal } from '../../components/CreateTaskModal';
import { Toaster } from 'sonner';
import { MY_JOBS_LIST_PARAMS } from '../../lib/myJobsListParams';
import {
  apiAddCandidateNote,
  apiAddCandidateTag,
  apiAddCandidateToPipeline,
  apiBulkActionCandidates,
  apiDeleteCandidate,
  apiDeleteCandidateNote,
  apiGetCandidate,
  apiGetCandidates,
  apiGetJobs,
  apiGetPipelineStages,
  apiGetUsers,
  apiMoveCandidateStage,
  apiPinCandidateNote,
  apiRejectCandidate,
  apiRemoveCandidateTag,
  apiScheduleCandidateInterview,
  apiUpdateCandidate,
  apiUpdateCandidateInterview,
  apiUpdateCandidateNote,
  type BackendCandidate,
  type BackendJob,
  type BackendUser,
} from '../../lib/api';
import { useSearchParams, useRouter } from 'next/navigation';

export const dynamic = 'force-dynamic';
import { toast } from 'sonner';

/** MongoDB ObjectIDs are 24 hex characters. Avoids invalid ID errors when opening profile. */
function isValidObjectId(id: string): boolean {
  return typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id.trim());
}

function isSuperAdminRole(role?: string | null): boolean {
  const normalized = String(role || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
  return normalized === 'SUPER_ADMIN';
}

const TAG_COLOR_PALETTE = [
  '#2563eb',
  '#7c3aed',
  '#059669',
  '#ea580c',
  '#dc2626',
  '#0891b2',
  '#ca8a04',
  '#4f46e5',
];

/** List all candidates for the candidate page. */
const ALL_CANDIDATES_LIST_PARAMS = { page: 1, limit: 200 };

function getTagColor(label: string) {
  const seed = label.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return TAG_COLOR_PALETTE[seed % TAG_COLOR_PALETTE.length];
}

function mapBackendStage(status: string): string {
  switch (status) {
    case 'NEW':
      return 'Applied';
    case 'INTERVIEWING':
      return 'Interviewing';
    case 'OFFERED':
      return 'Offered';
    case 'PLACED':
      return 'Hired';
    case 'REJECTED':
      return 'Rejected';
    default:
      return status;
  }
}

function mapBackendCandidate(c: BackendCandidate): Candidate {
  const fullName = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
  const email = c.email?.trim() || '';
  const phone = c.phone?.trim() || '';
  const shortId = c.id && c.id.length >= 6 ? c.id.slice(-6) : c.id;
  const name =
    fullName ||
    email ||
    phone ||
    (shortId ? `Candidate …${shortId}` : 'Candidate');
  const assignedJobsFromMatches = (c.matches || [])
    .map((match) => match.job?.title)
    .filter((title): title is string => Boolean(title && title.trim()));

  const assignedJobsFromAssignedTitles = (c.assignedJobTitles || []).filter((title) => Boolean(title && title.trim()));

  return {
    id: c.id,
    name,
    avatar: (c.avatar && String(c.avatar).trim()) || '',
    designation: c.currentTitle || c.status,
    company: c.currentCompany || c.source || '—',
    experience: c.experience ?? 0,
    location: c.location || '—',
    assignedJobs:
      assignedJobsFromAssignedTitles.length
        ? assignedJobsFromAssignedTitles
        : assignedJobsFromMatches.length
          ? assignedJobsFromMatches
          : [],
    stage: c.stage || mapBackendStage(c.status),
    owner: c.assignedTo?.name || 'Unassigned',
    lastActivity: (c.updatedAt || c.createdAt)
      ? (c.updatedAt || c.createdAt).slice(0, 10)
      : '',
    hotlist: c.hotlist,
    phone: c.phone || '',
    email: c.email ?? '',
    skills: c.skills || [],
    noticePeriod: '',
    salary: { current: '', expected: '' },
    source: c.source || '',
    rating: c.rating ?? 0,
  };
}

function formatSalary(
  salary?: BackendCandidate['salary']
): { current: string; expected: string } {
  if (!salary || (salary.min == null && salary.max == null)) {
    return { current: '', expected: '' };
  }

  const prefix = salary.currency || '';
  const min = salary.min != null ? `${prefix}${salary.min}` : '';
  const max = salary.max != null ? `${prefix}${salary.max}` : '';

  return {
    current: '',
    expected: [min, max].filter(Boolean).join(' - '),
  };
}

function extractApiData<T>(response: { data?: T | { data?: T } } | T): T {
  if ((response as { data?: T | { data?: T } })?.data) {
    const payload = (response as { data?: T | { data?: T } }).data;
    if (payload && typeof payload === 'object' && 'data' in payload) {
      return (payload as { data?: T }).data as T;
    }
    return payload as T;
  }

  return response as T;
}

type BackendCandidateInterview = NonNullable<BackendCandidate['interviews']>[number];

function mapCandidateProfile(c: BackendCandidate): CandidateProfileDrawerData {
  const namePart = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
  const emailPart = c.email?.trim() || '';
  const phonePart = c.phone?.trim() || '';
  const shortId = c.id && c.id.length >= 6 ? c.id.slice(-6) : c.id;
  const fullName =
    namePart ||
    emailPart ||
    phonePart ||
    (shortId ? `Candidate …${shortId}` : 'Candidate');
  const latestMatch = c.matches?.[0];
  const latestInterview = c.interviews?.[0];
  const salary = formatSalary(c.salary);
  const stage = c.stage || mapBackendStage(c.status);
  const skillsCount = c.skills?.length || 0;
  const skillsMatch = Math.min(95, skillsCount > 0 ? 55 + skillsCount * 8 : 38);
  const experienceFit = Math.min(96, c.experience != null ? 45 + c.experience * 6 : 35);
  const educationFit = c.currentTitle ? 72 : 48;
  const keywordMatch = Math.min(
    94,
    Math.round((skillsMatch * 0.45) + (experienceFit * 0.35) + (educationFit * 0.2))
  );
  const overall = Math.round((skillsMatch + experienceFit + educationFit + keywordMatch) / 4);
  const insightItems: NonNullable<CandidateProfileDrawerData['aiScore']>['insights'] = [];
  const backendAi = (c as BackendCandidate).aiCandidateAnalysis;
  const backendBreakdown = backendAi?.breakdown || {};
  const aiSkillsMatch =
    typeof backendBreakdown.skillsMatch === 'number' && Number.isFinite(backendBreakdown.skillsMatch)
      ? Math.max(0, Math.min(100, Math.round(backendBreakdown.skillsMatch)))
      : skillsMatch;
  const aiExperienceFit =
    typeof backendBreakdown.experienceFit === 'number' && Number.isFinite(backendBreakdown.experienceFit)
      ? Math.max(0, Math.min(100, Math.round(backendBreakdown.experienceFit)))
      : experienceFit;
  const aiEducationFit =
    typeof backendBreakdown.educationFit === 'number' && Number.isFinite(backendBreakdown.educationFit)
      ? Math.max(0, Math.min(100, Math.round(backendBreakdown.educationFit)))
      : educationFit;
  const aiKeywordMatch =
    typeof backendBreakdown.keywordMatch === 'number' && Number.isFinite(backendBreakdown.keywordMatch)
      ? Math.max(0, Math.min(100, Math.round(backendBreakdown.keywordMatch)))
      : keywordMatch;

  if (skillsCount > 0) {
    insightItems.push({
      type: 'strength',
      text: `${fullName} shows ${skillsCount} relevant skill${skillsCount > 1 ? 's' : ''} in the profile.`,
    });
  } else {
    insightItems.push({
      type: 'gap',
      text: 'Skills are missing or incomplete, which may lower the confidence of the screening result.',
    });
  }

  if ((c.experience ?? 0) >= 3) {
    insightItems.push({
      type: 'strength',
      text: `Experience level looks aligned with mid-level hiring expectations at ${c.experience} years.`,
    });
  } else {
    insightItems.push({
      type: 'gap',
      text: 'Experience appears limited for roles that expect deeper hands-on exposure.',
    });
  }

  if (!c.resume) {
    insightItems.push({
      type: 'gap',
      text: 'Resume file is not attached, so profile evaluation is based only on available record data.',
    });
  } else {
    insightItems.push({
      type: 'strength',
      text: 'Resume is available for detailed recruiter and AI review.',
    });
  }

  const fallbackActivityItems: NonNullable<CandidateProfileDrawerData['activity']> = [
    {
      id: `candidate-created-${c.id}`,
      type: 'note-added',
      title: 'Candidate profile created',
      description: `${fullName} was added to the system.`,
      timestamp: c.createdAt,
      performedBy: {
        name: c.assignedTo?.name || 'System',
      },
      relatedJob: latestMatch?.job?.title || null,
    },
  ];

  if (c.resume) {
    fallbackActivityItems.push({
      id: `resume-parsed-${c.id}`,
      type: 'resume-parsed',
      title: 'Resume parsed',
      description: 'Resume file is attached and ready for recruiter review.',
      timestamp: c.createdAt,
      performedBy: {
        name: 'AI Parser',
      },
      relatedJob: latestMatch?.job?.title || null,
    });
  }

  if (latestMatch) {
    fallbackActivityItems.push({
      id: `pipeline-${latestMatch.id}`,
      type: 'added-to-pipeline',
      title: 'Added to pipeline',
      description: `${fullName} was added to the hiring pipeline.`,
      timestamp: c.createdAt,
      performedBy: {
        name: c.assignedTo?.name || 'Recruiter',
      },
      relatedJob: latestMatch.job?.title || null,
    });
  }

  if (latestInterview?.scheduledAt) {
    fallbackActivityItems.push({
      id: `interview-${latestInterview.id}`,
      type: 'interview-scheduled',
      title: 'Interview scheduled',
      description: `Interview status: ${latestInterview.status || 'scheduled'}.`,
      timestamp: latestInterview.scheduledAt,
      performedBy: {
        name: c.assignedTo?.name || 'Recruiter',
      },
      relatedJob: latestMatch?.job?.title || null,
    });
  }

  const fallbackNotes: NonNullable<CandidateProfileDrawerData['notes']> = [
    {
      id: `note-screening-${c.id}`,
      text: c.resume
        ? 'Resume reviewed internally. Candidate looks promising for initial recruiter screening.'
        : 'Profile created, but resume is still missing and needs follow-up.',
      createdAt: c.createdAt,
      recruiter: {
        id: c.assignedTo?.id,
        name: c.assignedTo?.name || 'Recruiter',
        avatar: c.assignedTo?.avatar || null,
      },
      tags: ['Screening', c.resume ? 'Resume' : 'Follow-up'],
      isPinned: Boolean(c.resume),
    },
  ];

  if (latestInterview?.scheduledAt) {
    fallbackNotes.push({
      id: `note-interview-${latestInterview.id}`,
      text: 'Interview coordination is active. Keep communication warm and confirm availability before the next round.',
      createdAt: latestInterview.scheduledAt,
      recruiter: {
        id: c.assignedTo?.id,
        name: c.assignedTo?.name || 'Recruiter',
        avatar: c.assignedTo?.avatar || null,
      },
      tags: ['Interview', 'Follow-up'],
      isPinned: false,
    });
  }

  const fallbackTags = Array.from(
    new Set([
      ...(c.tags || []),
      ...(c.skills?.slice(0, 2) || []),
      (c.experience ?? 0) >= 5 ? 'Senior' : '',
      c.source?.toLowerCase().includes('referral') ? 'Referral' : '',
      c.location?.toLowerCase().includes('remote') ? 'Remote Candidate' : '',
    ].filter(Boolean))
  ).map((tag) => ({
    id: `tag-${tag.toLowerCase().replace(/\s+/g, '-')}`,
    label: tag,
    color: getTagColor(tag),
  }));

  return {
    id: c.id,
    name: fullName,
    firstName: c.firstName || null,
    lastName: c.lastName || null,
    currentTitle: c.currentTitle || c.status,
    currentCompany: c.currentCompany || c.source || '—',
    stage,
    experience: c.experience ?? 0,
    location: c.location || '—',
    email: c.email,
    phone: c.phone || '—',
    linkedIn: c.linkedIn || null,
    designation: c.currentTitle || c.status,
    expectedSalary: salary.expected || '—',
    expectedSalaryValue: c.expectedSalary ?? null,
    currentSalaryValue: c.currentSalary ?? null,
    salaryCurrency: c.salary?.currency || 'INR',
    noticePeriod: c.noticePeriod || '—',
    assignedJob: latestMatch?.job?.title || '—',
    assignedJobId: latestMatch?.job?.id || c.assignedJobs?.[0] || null,
    recruiter: c.assignedTo?.name || 'Unassigned',
    recruiterId: c.assignedTo?.id || null,
    source: c.source || '—',
    status: c.status || 'NEW',
    availability: c.availability || (c.status === 'ACTIVE' ? 'available' : c.status === 'PLACED' ? 'unavailable' : 'limited'),
    resumeUrl: c.resume || c.resumeUrl || null,
    summary:
      c.notes?.trim() ||
      c.cvSummary?.trim() ||
      (c.skills?.length ? `Skills: ${c.skills.join(', ')}` : null),
    cvAddress: c.address || null,
    cvCity: c.city || null,
    cvCountry: c.country || null,
    cvAvailability: c.availability || null,
    cvExpectedSalary:
      c.expectedSalary != null
        ? `${c.salary?.currency || 'INR'} ${c.expectedSalary}`
        : salary.expected || null,
    cvCurrentSalary: c.currentSalary != null ? `${c.salary?.currency || 'INR'} ${c.currentSalary}` : null,
    cvEducation: c.education || null,
    cvEducationEntries: Array.isArray(c.cvEducationEntries) ? c.cvEducationEntries : [],
    cvWorkExperienceEntries: Array.isArray(c.cvWorkExperienceEntries) ? c.cvWorkExperienceEntries : [],
    cvPortfolioLinks: c.cvPortfolioLinks || [],
    cvCertifications:
      (Array.isArray(c.certifications) && c.certifications.length
        ? c.certifications
        : Array.isArray((c as any).certificationsList)
          ? (c as any).certificationsList
          : []) || [],
    cvLanguages:
      (Array.isArray(c.languages) && c.languages.length
        ? c.languages
        : Array.isArray((c as any).recruiterLanguages)
          ? (c as any).recruiterLanguages
          : []) || [],
    cvPortfolio: c.portfolio || null,
    cvWebsite: c.website || null,
    cvNotes: c.cvSummary || c.notes || null,
    cvPreferredLocation: c.preferredLocation || null,
    cvSkills:
      (Array.isArray(c.skills) && c.skills.length
        ? c.skills
        : Array.isArray((c as any).recruiterSkills)
          ? (c as any).recruiterSkills
          : []) || [],
    cvSummary: c.cvSummary || null,
    tags: c.tagObjects?.length ? c.tagObjects : fallbackTags,
    notes: c.internalNotes?.length ? c.internalNotes : fallbackNotes,
    files: (c.resume || c.resumeUrl) ? [{ name: 'Resume', url: c.resume || c.resumeUrl }] : [],
    activity: c.activityFeed?.length ? c.activityFeed : fallbackActivityItems,
    scheduledInterviews: (c.interviews || [])
      .filter((interview) => Boolean(interview.scheduledAt))
      .map((interview, index) => ({
        id: interview.id,
        candidateId: c.id,
        jobId: interview.job?.id || latestMatch?.job?.id || null,
        jobTitle: interview.job?.title || latestMatch?.job?.title || null,
        // Backend stores human-friendly type label in `round` (e.g. "HR Screening").
        // If older records stored numeric rounds, we still fall back safely.
        type: interview.round || (interview as any).type || interview.status || 'Interview',
        round: index + 1,
        date: (interview.scheduledAt || '').split('T')[0] || '',
        time: interview.scheduledAt
          ? new Date(interview.scheduledAt).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            })
          : '',
        duration: interview.duration ? `${interview.duration} mins` : '1 hour',
        mode:
          interview.mode === 'in-person'
            ? 'in-person'
            : interview.mode === 'phone'
              ? 'phone'
              : 'video',
        platform:
          (interview as BackendCandidateInterview).platform === 'GOOGLE_MEET'
            ? 'Google Meet'
            : (interview as BackendCandidateInterview).platform === 'ZOOM'
              ? 'Zoom'
              : null,
        meetingLink: (interview as BackendCandidateInterview).meetingLink || null,
        location: (interview as BackendCandidateInterview).location || null,
        phoneNumber: c.phone || null,
        interviewers: interview.interviewer
          ? [{ id: interview.interviewer.id, name: interview.interviewer.name, role: 'Interviewer' }]
          : c.assignedTo
            ? [{ id: c.assignedTo.id, name: c.assignedTo.name, role: 'Interviewer' }]
          : [],
        notes: (interview as BackendCandidateInterview).notes || '',
        sendCandidateInvite: true,
        sendInterviewerInvite: true,
        status:
          String(interview.status || '').toUpperCase() === 'COMPLETED'
            ? 'completed'
            : String(interview.status || '').toUpperCase() === 'CANCELLED'
              ? 'cancelled'
              : 'scheduled',
      })),
    aiScore: {
      overall:
        typeof backendAi?.overall === 'number' && Number.isFinite(backendAi.overall)
          ? Math.max(0, Math.min(100, Math.round(backendAi.overall)))
          : overall,
      source: backendAi?.source || 'estimated',
      jobTitle: backendAi?.jobTitle || latestMatch?.job?.title || null,
      breakdown: {
        skillsMatch: aiSkillsMatch,
        experienceFit: aiExperienceFit,
        educationFit: aiEducationFit,
        keywordMatch: aiKeywordMatch,
      },
      insights:
        Array.isArray(backendAi?.insights) && backendAi.insights.length
          ? backendAi.insights
              .filter((item) => item && typeof item === 'object' && typeof item.text === 'string' && item.text.trim().length > 0)
              .map((item) => ({
                type: item.type === 'gap' ? 'gap' : 'strength',
                text: String(item.text),
              }))
          : insightItems,
    },
  };
}

function CandidatesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeStage, setActiveStage] = useState(searchParams.get('stage') || 'all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [isAddCandidateOpen, setIsAddCandidateOpen] = useState(false);
  const [candidateDrawerInitialTab, setCandidateDrawerInitialTab] = useState('manual');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    assignedToId: searchParams.get('assignedToId') || '',
    status: searchParams.get('status') || '',
  });
  const [selectedCandidateProfile, setSelectedCandidateProfile] = useState<CandidateProfileDrawerData | null>(null);
  const [candidateDrawerOpen, setCandidateDrawerOpen] = useState(false);
  const [loadingCandidateProfile, setLoadingCandidateProfile] = useState(false);
  const [availableDrawerTags, setAvailableDrawerTags] = useState<CandidateTagItem[]>([]);
  const [pipelineJobs, setPipelineJobs] = useState<CandidatePipelineJobOption[]>([]);
  const [pipelineRecruiters, setPipelineRecruiters] = useState<CandidatePipelineRecruiterOption[]>([]);
  const [interviewPanelMembers, setInterviewPanelMembers] = useState<CandidateInterviewerOption[]>([]);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkAssignSaving, setBulkAssignSaving] = useState(false);
  const [bulkAssignRecruiterIds, setBulkAssignRecruiterIds] = useState<string[]>([]);
  const [bulkMoveStageOpen, setBulkMoveStageOpen] = useState(false);
  const [bulkMoveStageJobId, setBulkMoveStageJobId] = useState('');
  const [bulkMoveStageStageId, setBulkMoveStageStageId] = useState('');
  const [bulkMoveStageNote, setBulkMoveStageNote] = useState('');
  const [bulkMoveStageOptions, setBulkMoveStageOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [bulkMoveStageLoading, setBulkMoveStageLoading] = useState(false);
  const [bulkMoveStageSaving, setBulkMoveStageSaving] = useState(false);
  const [deletingCandidateId, setDeletingCandidateId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{
    _id: string;
    name: string;
    email: string;
    role?: string;
  } | null>(null);
  const currentDrawerUser = useMemo(
    () => ({
      id: 'current-user',
      name: selectedCandidateProfile?.recruiter || 'You',
      avatar: null as string | null,
    }),
    [selectedCandidateProfile?.recruiter]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const storedUser = localStorage.getItem('currentUser');
      if (!storedUser) return;
      const parsed = JSON.parse(storedUser);
      setCurrentUser({
        _id: parsed.id || parsed._id || '',
        name: parsed.name || 'You',
        email: parsed.email || '',
        role: parsed.role,
      });
    } catch (storageError) {
      console.error('Failed to parse current user from storage:', storageError);
    }
  }, []);

  const syncCandidateCard = useCallback((profile: CandidateProfileDrawerData) => {
    setCandidates((prev) =>
      prev.map((candidate) =>
        candidate.id === profile.id
          ? {
              ...candidate,
              name: profile.name || candidate.name,
              stage: profile.stage || candidate.stage,
              owner: profile.recruiter || candidate.owner,
              assignedJobs:
                profile.assignedJob && profile.assignedJob !== '—'
                  ? [profile.assignedJob]
                  : candidate.assignedJobs,
              designation: profile.designation || candidate.designation,
              company: profile.currentCompany || profile.source || candidate.company,
              experience: profile.experience ?? candidate.experience,
              location: profile.location || candidate.location,
              phone: profile.phone || candidate.phone,
              email: profile.email || candidate.email,
              source: profile.source || candidate.source,
              lastActivity: new Date().toISOString().slice(0, 10),
            }
          : candidate
      )
    );
  }, []);

  const loadCandidateProfile = useCallback(
    async (candidateId: string) => {
      if (!isValidObjectId(candidateId)) {
        // Demo or invalid ID – don't call API (backend expects MongoDB ObjectID)
        return null;
      }
      const backendCandidate = extractApiData<BackendCandidate>(await apiGetCandidate(candidateId));
      const mappedProfile = mapCandidateProfile(backendCandidate);
      setSelectedCandidateProfile(mappedProfile);
      syncCandidateCard(mappedProfile);
      return mappedProfile;
    },
    [syncCandidateCard]
  );

  const loadCandidates = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    try {
      if (!silent) {
        setLoading(true);
        setError(null);
      }

      const queryParams: Record<string, string | number | boolean> = {
        ...ALL_CANDIDATES_LIST_PARAMS,
      };
      if (isSuperAdminRole(currentUser?.role)) {
        queryParams.mine = true;
      }

      if (filters.search) queryParams.search = filters.search;
      if (filters.assignedToId) queryParams.assignedToId = filters.assignedToId;

      if (activeStage !== 'all') {
        const stageMap: Record<string, string> = {
          applied: 'Applied',
          longlist: 'Longlist',
          shortlist: 'Shortlist',
          screening: 'Screening',
          submitted: 'Submitted',
          interviewing: 'Interviewing',
          offered: 'Offered',
          hired: 'Hired',
          rejected: 'Rejected',
        };
        const backendStage = stageMap[activeStage.toLowerCase()];
        if (backendStage) {
          queryParams.stage = backendStage;
        }
      } else if (filters.status) {
        queryParams.status = filters.status;
      }

      const res = await apiGetCandidates(queryParams);

      let backendCandidates: BackendCandidate[] = [];
      const payload = res.data as BackendCandidate[] | { data?: BackendCandidate[]; items?: BackendCandidate[] } | undefined;
      if (payload) {
        if (Array.isArray(payload)) {
          backendCandidates = payload;
        } else if (Array.isArray(payload.data)) {
          backendCandidates = payload.data;
        } else if (Array.isArray(payload.items)) {
          backendCandidates = payload.items;
        } else {
          console.warn('Unexpected response structure:', payload);
          backendCandidates = [];
        }
      }

      if (!Array.isArray(backendCandidates)) {
        console.error('Unexpected API response format: data is not an array.', res);
        if (!silent) {
          setError('Unexpected API response format.');
          setCandidates([]);
        }
        return;
      }

      const mapped = backendCandidates.map(mapBackendCandidate);
      setCandidates(mapped);
    } catch (err: any) {
      if (!silent) {
        setError(err?.message || 'Failed to load candidates.');
        setCandidates([]);
      }
      toast.error(err?.message || 'Failed to load candidates.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [filters, activeStage, currentUser?.role]);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  // Refresh stats when candidates are updated
  const refreshStats = useCallback(() => {
    // Stats will be refreshed by StageTabs component
    // This is just a placeholder for future use if needed
  }, []);

  // Update URL params when filters or stage change
  useEffect(() => {
    const params = new URLSearchParams();
    if (activeStage !== 'all') params.set('stage', activeStage);
    if (filters.search) params.set('search', filters.search);
    if (filters.assignedToId) params.set('assignedToId', filters.assignedToId);
    if (filters.status) params.set('status', filters.status);
    router.replace(`/candidate?${params.toString()}`, { scroll: false });
  }, [activeStage, filters, router]);

  useEffect(() => {
    let cancelled = false;

    async function loadPipelineOptions() {
      try {
        const [jobsRes, usersRes] = await Promise.all([
          apiGetJobs(MY_JOBS_LIST_PARAMS),
          apiGetUsers({ limit: 100 }),
        ]);
        if (cancelled) return;

        const jobsPayload = jobsRes.data;
        const usersPayload = usersRes.data;

        const jobsData: BackendJob[] = Array.isArray(jobsPayload)
          ? jobsPayload
          : Array.isArray((jobsPayload as any)?.data)
            ? (jobsPayload as any).data
            : Array.isArray((jobsPayload as any)?.items)
              ? (jobsPayload as any).items
              : [];

        const usersData: BackendUser[] = Array.isArray(usersPayload)
          ? usersPayload
          : Array.isArray((usersPayload as any)?.data)
            ? (usersPayload as any).data
            : [];

        setPipelineJobs(
          jobsData.map((job) => ({
            id: job.id,
            title: job.title,
            department: job.department || job.client?.companyName || null,
          }))
        );

        setPipelineRecruiters(
          usersData
            .filter((user) => user.isActive)
            .map((user) => ({
              id: user.id,
              name: user.name,
              avatar: user.avatar || null,
            }))
        );

        setInterviewPanelMembers(
          usersData
            .filter((user) => user.isActive)
            .map((user) => ({
              id: user.id,
              name: user.name,
              role: user.role,
              department: user.department || '',
              avatar: user.avatar || null,
            }))
        );
      } catch (optionError) {
        console.error('Failed to load pipeline options:', optionError);
      }
    }

    loadPipelineOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredCandidates = useMemo(() => {
    const base = candidates;
    if (activeStage === 'all') return base;
    return base.filter(c => c.stage.toLowerCase() === activeStage.toLowerCase());
  }, [activeStage, candidates]);

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredCandidates.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredCandidates.map(c => c.id));
    }
  };

  const loadBulkMoveStageOptions = useCallback(async (jobId: string) => {
    if (!jobId) {
      setBulkMoveStageOptions([]);
      setBulkMoveStageStageId('');
      return;
    }

    try {
      setBulkMoveStageLoading(true);
      const response = await apiGetPipelineStages(jobId);
      const payload = response.data;
      const stages = Array.isArray(payload)
        ? payload
        : Array.isArray((payload as any)?.data)
          ? (payload as any).data
          : [];

      const mappedStages = stages.map((stage: any) => ({
        id: String(stage.id),
        name: String(stage.name),
      }));

      setBulkMoveStageOptions(mappedStages);
      setBulkMoveStageStageId(mappedStages[0]?.id || '');
    } catch (stageError: any) {
      console.error('Failed to load pipeline stages for bulk move:', stageError);
      setBulkMoveStageOptions([]);
      setBulkMoveStageStageId('');
      toast.error(stageError?.message || 'Failed to load stages');
    } finally {
      setBulkMoveStageLoading(false);
    }
  }, []);

  const openBulkMoveStageModal = useCallback(async () => {
    const firstJobId = pipelineJobs[0]?.id || '';
    setBulkMoveStageJobId(firstJobId);
    setBulkMoveStageStageId('');
    setBulkMoveStageNote('');
    setBulkMoveStageOpen(true);

    if (firstJobId) {
      await loadBulkMoveStageOptions(firstJobId);
    } else {
      setBulkMoveStageOptions([]);
    }
  }, [loadBulkMoveStageOptions, pipelineJobs]);

  const closeBulkMoveStageModal = useCallback(() => {
    if (bulkMoveStageSaving) return;
    setBulkMoveStageOpen(false);
    setBulkMoveStageJobId('');
    setBulkMoveStageStageId('');
    setBulkMoveStageNote('');
    setBulkMoveStageOptions([]);
  }, [bulkMoveStageSaving]);

  const openBulkAssignModal = useCallback(() => {
    setBulkAssignRecruiterIds([]);
    setBulkAssignOpen(true);
  }, []);

  const closeBulkAssignModal = useCallback(() => {
    if (bulkAssignSaving) return;
    setBulkAssignOpen(false);
    setBulkAssignRecruiterIds([]);
  }, [bulkAssignSaving]);

  const toggleBulkAssignRecruiter = useCallback((recruiterId: string) => {
    setBulkAssignRecruiterIds((prev) =>
      prev.includes(recruiterId)
        ? prev.filter((id) => id !== recruiterId)
        : [...prev, recruiterId]
    );
  }, []);

  const submitBulkAssignRecruiter = useCallback(async () => {
    if (!bulkAssignRecruiterIds.length || !selectedIds.length) return;

    try {
      setBulkAssignSaving(true);
      await apiBulkActionCandidates('assign_recruiter', selectedIds, {
        recruiterId: bulkAssignRecruiterIds[0],
        recruiterIds: bulkAssignRecruiterIds,
      });
      toast.success(`Assigned ${selectedIds.length} candidate(s) to ${bulkAssignRecruiterIds.length} recruiter(s)`);
      setSelectedIds([]);
      setBulkAssignOpen(false);
      setBulkAssignRecruiterIds([]);
      await loadCandidates();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to assign recruiter');
    } finally {
      setBulkAssignSaving(false);
    }
  }, [bulkAssignRecruiterIds, loadCandidates, selectedIds]);

  const submitBulkMoveStage = useCallback(async () => {
    if (!bulkMoveStageJobId || !bulkMoveStageStageId || selectedIds.length === 0) return;

    try {
      setBulkMoveStageSaving(true);
      await Promise.all(
        selectedIds.map((candidateId) =>
          apiMoveCandidateStage(bulkMoveStageJobId, {
            candidateId,
            stageId: bulkMoveStageStageId,
            notes: bulkMoveStageNote.trim() || undefined,
          })
        )
      );

      const selectedStageName =
        bulkMoveStageOptions.find((stage) => stage.id === bulkMoveStageStageId)?.name || 'selected stage';
      toast.success(`Moved ${selectedIds.length} candidate(s) to ${selectedStageName}`);
      setBulkMoveStageOpen(false);
      setBulkMoveStageJobId('');
      setBulkMoveStageStageId('');
      setBulkMoveStageNote('');
      setBulkMoveStageOptions([]);
      setSelectedIds([]);
      await loadCandidates({ silent: true });
      refreshStats();
    } catch (moveError: any) {
      console.error('Failed to move candidates to stage:', moveError);
      toast.error(moveError?.message || 'Failed to move candidates');
    } finally {
      setBulkMoveStageSaving(false);
    }
  }, [
    bulkMoveStageJobId,
    bulkMoveStageNote,
    bulkMoveStageOptions,
    bulkMoveStageStageId,
    loadCandidates,
    refreshStats,
    selectedIds,
  ]);

  const handleDeleteCandidate = useCallback(
    async (candidate: Candidate) => {
      if (!isValidObjectId(candidate.id)) {
        toast.error('This candidate cannot be deleted (invalid id).');
        return;
      }
      if (!window.confirm('Permanently delete this candidate? This cannot be undone.')) {
        return;
      }
      try {
        setDeletingCandidateId(candidate.id);
        // Remove from UI immediately; silent refetch syncs with DB after delete
        setCandidates((prev) => prev.filter((c) => c.id !== candidate.id));
        await apiDeleteCandidate(candidate.id);
        toast.success('Candidate removed');
        setSelectedIds((prev) => prev.filter((id) => id !== candidate.id));
        if (selectedCandidateProfile?.id === candidate.id) {
          setCandidateDrawerOpen(false);
          setSelectedCandidateProfile(null);
        }
        await loadCandidates({ silent: true });
      } catch (err: unknown) {
        await loadCandidates({ silent: true });
        const msg = err instanceof Error ? err.message : 'Failed to delete candidate';
        toast.error(msg);
      } finally {
        setDeletingCandidateId(null);
      }
    },
    [loadCandidates, selectedCandidateProfile?.id]
  );

  const handleViewProfile = async (candidate: Candidate) => {
    setCandidateDrawerOpen(true);
    setLoadingCandidateProfile(true);

    setSelectedCandidateProfile({
      id: candidate.id,
      name: candidate.name,
      currentTitle: candidate.designation,
      currentCompany: candidate.company,
      designation: candidate.designation,
      stage: candidate.stage,
      experience: candidate.experience,
      location: candidate.location,
      email: candidate.email,
      phone: candidate.phone,
      expectedSalary: candidate.salary.expected || '—',
      noticePeriod: candidate.noticePeriod || '—',
      assignedJob: candidate.assignedJobs[0] || '—',
      recruiter: candidate.owner,
      source: candidate.source,
      availability: 'limited',
      summary: null,
      resumeUrl: null,
      tags: candidate.skills.map((tag) => ({
        id: `tag-${tag.toLowerCase().replace(/\s+/g, '-')}`,
        label: tag,
        color: getTagColor(tag),
      })),
      notes: [],
      files: [],
      assignedJobId: null,
      scheduledInterviews: [],
      activity: [],
    });

    try {
      await loadCandidateProfile(candidate.id);
    } catch (profileError) {
      console.error('Failed to load candidate profile:', profileError);
    } finally {
      setLoadingCandidateProfile(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#f8fafc]">
      {/* Pipeline Tabs */}
      <StageTabs
        activeStage={activeStage}
        statsMine
        onStageChange={(stage) => {
          setActiveStage(stage);
          setFilters((prev) => ({ ...prev, status: stage === 'all' ? '' : stage }));
        }}
        refreshTrigger={candidates.length}
      />

        {/* Content Body */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 py-4 flex items-center justify-between bg-white border-b border-slate-200">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  All candidates
                  <span className="text-sm font-normal text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                    {filteredCandidates.length} shown
                  </span>
                </h1>
                <p className="text-xs text-slate-500 max-w-xl mt-0.5">
                  View and manage every candidate available in the system.
                </p>
              </div>

              <div className="h-6 w-px bg-slate-200" />
              
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button 
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <List size={20} strokeWidth={viewMode === 'list' ? 2.5 : 2} />
                </button>
                <button 
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <LayoutGrid size={20} strokeWidth={viewMode === 'grid' ? 2.5 : 2} />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setCreateTaskOpen(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors shadow-sm"
              >
                <CheckSquare size={16} />
                Add Task
              </button>
              <button
                onClick={() => {
                  setCandidateDrawerInitialTab('bulkResume');
                  setIsAddCandidateOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors shadow-sm"
              >
                <Upload size={16} />
                Bulk CV Upload
              </button>
              <button
                onClick={() => {
                  setCandidateDrawerInitialTab('manual');
                  setIsAddCandidateOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm shadow-blue-100"
              >
                <Plus size={16} />
                Add Candidate
              </button>
              <button 
                onClick={() => setIsFilterOpen(true)}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-all ${
                  isFilterOpen 
                    ? 'bg-blue-50 border-blue-200 text-blue-600' 
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Filter size={16} />
                Filters
                {isFilterOpen && <span className="w-2 h-2 bg-blue-600 rounded-full" />}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-white">
            {error && (
              <div className="m-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                {error}
              </div>
            )}
            {loading ? (
              <div className="p-8 text-center text-sm text-slate-500">Loading candidates from API...</div>
            ) : viewMode === 'list' ? (
              <>
                <BulkActions
                  selectedIds={selectedIds}
                  onMoveStage={openBulkMoveStageModal}
                  onDelete={async (ids) => {
                    if (!confirm(`Are you sure you want to permanently delete ${ids.length} candidate(s)?`)) return;
                    try {
                      await Promise.all(ids.map((candidateId) => apiDeleteCandidate(candidateId)));
                      toast.success(`Deleted ${ids.length} candidate(s)`);
                      setSelectedIds([]);
                      await loadCandidates();
                    } catch (err: any) {
                      toast.error(err?.message || 'Failed to delete candidates');
                    }
                  }}
                  onAssignRecruiter={openBulkAssignModal}
                  onSendEmail={async (ids) => {
                    toast.info(`Send email to ${ids.length} candidate(s) - Feature coming soon`);
                  }}
                  onAddTag={async (ids) => {
                    const tag = prompt('Enter tag name:');
                    if (tag) {
                      try {
                        await apiBulkActionCandidates('add_tag', ids, { tag });
                        toast.success(`Added tag "${tag}" to ${ids.length} candidate(s)`);
                        setSelectedIds([]);
                        loadCandidates();
                      } catch (err: any) {
                        toast.error(err?.message || 'Failed to add tag');
                      }
                    }
                  }}
                  onExport={async (ids) => {
                    try {
                      const res = await apiBulkActionCandidates('export', ids);
                      const candidates = res.data?.candidates || [];
                      // Convert to CSV
                      const headers = ['ID', 'First Name', 'Last Name', 'Email', 'Phone', 'Company', 'Title', 'Experience', 'Location', 'Status', 'Source', 'Created At'];
                      const rows = candidates.map((c: any) => [
                        c.id,
                        c.firstName || '',
                        c.lastName || '',
                        c.email || '',
                        c.phone || '',
                        c.currentCompany || '',
                        c.currentTitle || '',
                        c.experience || '',
                        c.location || '',
                        c.status || '',
                        c.source || '',
                        c.createdAt || '',
                      ]);
                      const csv = [headers, ...rows]
                        .map((r) =>
                          r
                            .map((cell: unknown) => `"${String(cell).replace(/"/g, '""')}"`)
                            .join(',')
                        )
                        .join('\n');
                      const blob = new Blob([csv], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `candidates-export-${new Date().toISOString().split('T')[0]}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast.success(`Exported ${candidates.length} candidate(s)`);
                    } catch (err: any) {
                      toast.error(err?.message || 'Failed to export candidates');
                    }
                  }}
                  onReject={async (ids) => {
                    if (!confirm(`Are you sure you want to reject ${ids.length} candidate(s)?`)) return;
                    const reason = prompt('Enter rejection reason (optional):') || 'Bulk rejection';
                    try {
                      await apiBulkActionCandidates('reject', ids, { reason });
                      toast.success(`Rejected ${ids.length} candidate(s)`);
                      setSelectedIds([]);
                      loadCandidates();
                    } catch (err: any) {
                      toast.error(err?.message || 'Failed to reject candidates');
                    }
                  }}
                  onDeselect={() => setSelectedIds([])}
                />
                <CandidateTable
                  candidates={filteredCandidates}
                  selectedIds={selectedIds}
                  onToggleSelect={handleToggleSelect}
                  onToggleSelectAll={handleToggleSelectAll}
                  onViewProfile={handleViewProfile}
                  onDeleteCandidate={handleDeleteCandidate}
                  deletingCandidateId={deletingCandidateId}
                />
              </>
            ) : (
              <CandidateGrid 
                candidates={filteredCandidates} 
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onViewProfile={handleViewProfile}
              />
            )}
          </div>
        </div>

      <FilterDrawer 
        isOpen={isFilterOpen} 
        onClose={() => setIsFilterOpen(false)}
        filters={filters}
        onFiltersChange={(newFilters) => {
          setFilters(newFilters);
          loadCandidates();
        }}
      />

      <CreateTaskModal
        isOpen={createTaskOpen}
        onClose={() => setCreateTaskOpen(false)}
        onSuccess={() => setCreateTaskOpen(false)}
        initialRelatedTo="Candidate"
      />

      <AddCandidateDrawer
        isOpen={isAddCandidateOpen}
        onClose={() => setIsAddCandidateOpen(false)}
        onSuccess={() => {
          loadCandidates();
        }}
        currentUser={currentUser || { _id: '', name: 'You', email: '', role: 'RECRUITER' }}
        initialTab={candidateDrawerInitialTab}
      />

      {bulkMoveStageOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={closeBulkMoveStageModal} />
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-100 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-bold text-slate-900">Move stage</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Move {selectedIds.length} selected candidate{selectedIds.length === 1 ? '' : 's'} to another pipeline stage.
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  onClick={closeBulkMoveStageModal}
                  disabled={bulkMoveStageSaving}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">Job</label>
                <select
                  value={bulkMoveStageJobId}
                  onChange={async (e) => {
                    const nextJobId = e.target.value;
                    setBulkMoveStageJobId(nextJobId);
                    await loadBulkMoveStageOptions(nextJobId);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  disabled={bulkMoveStageSaving || pipelineJobs.length === 0}
                >
                  {pipelineJobs.length === 0 ? (
                    <option value="">No jobs available</option>
                  ) : (
                    pipelineJobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">Stage</label>
                <select
                  value={bulkMoveStageStageId}
                  onChange={(e) => setBulkMoveStageStageId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  disabled={bulkMoveStageSaving || bulkMoveStageLoading || bulkMoveStageOptions.length === 0}
                >
                  {bulkMoveStageLoading ? (
                    <option value="">Loading stages...</option>
                  ) : bulkMoveStageOptions.length === 0 ? (
                    <option value="">No pipeline configured for this job</option>
                  ) : (
                    bulkMoveStageOptions.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">Note (optional)</label>
                <textarea
                  value={bulkMoveStageNote}
                  onChange={(e) => setBulkMoveStageNote(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Add a short note for this move"
                  disabled={bulkMoveStageSaving}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-5">
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                onClick={closeBulkMoveStageModal}
                disabled={bulkMoveStageSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
                onClick={submitBulkMoveStage}
                disabled={
                  bulkMoveStageSaving ||
                  bulkMoveStageLoading ||
                  !bulkMoveStageJobId ||
                  !bulkMoveStageStageId ||
                  selectedIds.length === 0
                }
              >
                {bulkMoveStageSaving ? 'Moving...' : 'Move stage'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {bulkAssignOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={closeBulkAssignModal} />
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-100 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-bold text-slate-900">Assign recruiters</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Select one or more recruiters. The first selected recruiter becomes the primary assignee, and all selected recruiters receive the candidate details by email.
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  onClick={closeBulkAssignModal}
                  disabled={bulkAssignSaving}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="p-5">
              <div className="mb-3 text-xs font-bold uppercase text-slate-500">
                Recruiters
              </div>
              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {pipelineRecruiters.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                    No recruiters available.
                  </div>
                ) : (
                  pipelineRecruiters.map((recruiter) => {
                    const checked = bulkAssignRecruiterIds.includes(recruiter.id);
                    return (
                      <label
                        key={recruiter.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 transition-colors ${
                          checked
                            ? 'border-blue-200 bg-blue-50'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleBulkAssignRecruiter(recruiter.id)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          disabled={bulkAssignSaving}
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900">{recruiter.name}</div>
                          <div className="text-xs text-slate-500">
                            {checked && bulkAssignRecruiterIds[0] === recruiter.id ? 'Primary assignee' : 'Will receive assignment email'}
                          </div>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-100 p-5">
              <div className="text-xs text-slate-500">
                {bulkAssignRecruiterIds.length} recruiter{bulkAssignRecruiterIds.length === 1 ? '' : 's'} selected for {selectedIds.length} candidate{selectedIds.length === 1 ? '' : 's'}.
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  onClick={closeBulkAssignModal}
                  disabled={bulkAssignSaving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
                  onClick={submitBulkAssignRecruiter}
                  disabled={bulkAssignSaving || bulkAssignRecruiterIds.length === 0 || selectedIds.length === 0}
                >
                  {bulkAssignSaving ? 'Assigning...' : 'Assign recruiters'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <CandidateProfileDrawer
        isOpen={candidateDrawerOpen}
        currentUser={currentDrawerUser}
        availableTags={availableDrawerTags}
        jobs={pipelineJobs}
        recruiters={pipelineRecruiters}
        interviewers={interviewPanelMembers}
        existingInterviews={selectedCandidateProfile?.scheduledInterviews || []}
        candidate={
          loadingCandidateProfile && selectedCandidateProfile
            ? {
                ...selectedCandidateProfile,
                summary: selectedCandidateProfile.summary || 'Loading candidate details...',
              }
            : selectedCandidateProfile
        }
        onClose={() => {
          setCandidateDrawerOpen(false);
          setSelectedCandidateProfile(null);
        }}
        onAction={(action, candidate) => {
          console.log('Candidate drawer action:', action, candidate.id);
        }}
        onRejectCandidate={async (reason, feedback, sendEmail) => {
          if (!selectedCandidateProfile) return;
          await apiRejectCandidate(selectedCandidateProfile.id, { reason, feedback, sendEmail });
          await loadCandidateProfile(selectedCandidateProfile.id);
        }}
        onScheduleInterview={async (interviewData) => {
          const payload = {
            jobId: interviewData.jobId,
            type: interviewData.type,
            round: interviewData.round,
            date: interviewData.date,
            time: interviewData.time,
            duration: interviewData.duration,
            mode: interviewData.mode,
            platform:
              interviewData.platform === 'Google Meet'
                ? 'GOOGLE_MEET'
                : interviewData.platform === 'Zoom'
                  ? 'ZOOM'
                  : null,
            meetingLink: interviewData.meetingLink,
            location: interviewData.location,
            phoneNumber: interviewData.phoneNumber,
            interviewers: interviewData.interviewers,
            notes: interviewData.notes,
            sendCandidateInvite: interviewData.sendCandidateInvite,
            sendInterviewerInvite: interviewData.sendInterviewerInvite,
            status: interviewData.status,
          };

          // If ID looks like a real backend interview id, update; else schedule new.
          if (String(interviewData.id || '').length >= 12 && String(interviewData.id || '').includes('interview-') === false) {
            await apiUpdateCandidateInterview(interviewData.candidateId, interviewData.id, payload);
          } else {
            await apiScheduleCandidateInterview(interviewData.candidateId, payload as any);
          }
          await loadCandidateProfile(interviewData.candidateId);
        }}
        onAddNote={async (candidateId, note) => {
          await apiAddCandidateNote(candidateId, note);
          await loadCandidateProfile(candidateId);
        }}
        onEditNote={async (candidateId, noteId, updatedNote) => {
          await apiUpdateCandidateNote(candidateId, noteId, updatedNote);
          await loadCandidateProfile(candidateId);
        }}
        onDeleteNote={async (candidateId, noteId) => {
          await apiDeleteCandidateNote(candidateId, noteId);
          await loadCandidateProfile(candidateId);
        }}
        onPinNote={async (candidateId, noteId, isPinned) => {
          await apiPinCandidateNote(candidateId, noteId, isPinned);
          await loadCandidateProfile(candidateId);
        }}
        onAddTag={async (candidateId, tag) => {
          await apiAddCandidateTag(candidateId, tag);
          await loadCandidateProfile(candidateId);
        }}
        onRemoveTag={async (candidateId, tagId) => {
          await apiRemoveCandidateTag(candidateId, tagId);
          await loadCandidateProfile(candidateId);
        }}
        onCreateTag={(_, tagName) => {
          const newTag: CandidateTagItem = {
            id: `tag-${tagName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
            label: tagName,
            color: getTagColor(tagName),
          };
          setAvailableDrawerTags((prev) => {
            if (prev.some((tag) => tag.label.toLowerCase() === tagName.toLowerCase())) return prev;
            return [...prev, newTag];
          });
          return newTag;
        }}
        onAddToPipeline={async ({ candidateId, jobId, stage, recruiterId, priority, notes }) => {
          await apiAddCandidateToPipeline(candidateId, {
            jobId,
            stage,
            recruiterId,
            priority,
            notes,
          });
          await loadCandidateProfile(candidateId);
        }}
        onUpdateCandidate={async (candidateId, payload) => {
          await apiUpdateCandidate(candidateId, payload);
          await loadCandidateProfile(candidateId);
        }}
      />

      <Toaster position="top-right" richColors />
    </div>
  );
}

export default function CandidatesPage() {
  return (
    <Suspense fallback={<div className="w-full min-h-screen bg-[#f8fafc] flex items-center justify-center">Loading...</div>}>
      <CandidatesPageContent />
    </Suspense>
  );
}
