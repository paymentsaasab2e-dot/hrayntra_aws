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
  apiGetUsers,
  apiPinCandidateNote,
  apiRejectCandidate,
  apiRemoveCandidateTag,
  apiScheduleCandidateInterview,
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

/** List + stats scoped to the logged-in user (backend: mine=true). */
const MY_CANDIDATES_LIST_PARAMS = { mine: true as const, page: 1, limit: 200 };

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
    currentTitle: c.currentTitle || c.status,
    currentCompany: c.currentCompany || c.source || '—',
    stage,
    experience: c.experience ?? 0,
    location: c.location || '—',
    email: c.email,
    phone: c.phone || '—',
    designation: c.currentTitle || c.status,
    expectedSalary: salary.expected || '—',
    noticePeriod: c.noticePeriod || '—',
    assignedJob: latestMatch?.job?.title || '—',
    assignedJobId: latestMatch?.job?.id || c.assignedJobs?.[0] || null,
    recruiter: c.assignedTo?.name || 'Unassigned',
    source: c.source || '—',
    availability: c.status === 'ACTIVE' ? 'available' : c.status === 'PLACED' ? 'unavailable' : 'limited',
    resumeUrl: c.resume || null,
    summary: c.skills?.length ? `Skills: ${c.skills.join(', ')}` : null,
    tags: c.tagObjects?.length ? c.tagObjects : fallbackTags,
    notes: c.internalNotes?.length ? c.internalNotes : fallbackNotes,
    files: c.resume ? [{ name: 'Resume', url: c.resume }] : [],
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
      overall,
      breakdown: {
        skillsMatch,
        experienceFit,
        educationFit,
        keywordMatch,
      },
      insights: insightItems,
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
              stage: profile.stage || candidate.stage,
              owner: profile.recruiter || candidate.owner,
              assignedJobs:
                profile.assignedJob && profile.assignedJob !== '—'
                  ? [profile.assignedJob]
                  : candidate.assignedJobs,
              designation: profile.designation || candidate.designation,
              location: profile.location || candidate.location,
              phone: profile.phone || candidate.phone,
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
        ...MY_CANDIDATES_LIST_PARAMS,
      };

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
  }, [filters, activeStage]);

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
                  My candidates
                  <span className="text-sm font-normal text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                    {filteredCandidates.length} shown
                  </span>
                </h1>
                <p className="text-xs text-slate-500 max-w-xl mt-0.5">
                  People you added plus applicants on jobs you created (from the API).
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
                onClick={() => setIsAddCandidateOpen(true)}
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
                  onAddToPipeline={async (ids) => {
                    // This would open a drawer/modal to select job and stage
                    toast.info(`Add ${ids.length} candidate(s) to pipeline - Feature coming soon`);
                  }}
                  onAssignRecruiter={async (ids) => {
                    // Open a drawer to select recruiter
                    const recruiterId = prompt('Enter recruiter ID (or use the drawer in future):');
                    if (recruiterId) {
                      try {
                        await apiBulkActionCandidates('assign_recruiter', ids, { recruiterId });
                        toast.success(`Assigned recruiter to ${ids.length} candidate(s)`);
                        setSelectedIds([]);
                        loadCandidates();
                      } catch (err: any) {
                        toast.error(err?.message || 'Failed to assign recruiter');
                      }
                    }
                  }}
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
      />

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
