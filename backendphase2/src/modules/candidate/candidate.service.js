import { prisma, getActiveTenantDbName, getJobPortalPrismaClient } from '../../config/prisma.js';
import {
  fetchCandidateCommonForMatchPipeline,
  fetchCandidateCommonForTenant,
  fetchCandidateCommonForCandidatesList,
  fetchCandidateCommonByCandidateId,
} from '../../services/candidateCommon/candidateCommonPool.service.js';
import {
  PIPELINE_STAGES,
  mapStageNameToPipelineBucket,
  updateCandidateStage,
} from '../stage/candidateStage.service.js';
import { getPaginationParams, formatPaginationResponse } from '../../utils/pagination.js';
import { dbLogger } from '../../utils/db-logger.js';
import { generateMeetingLink } from '../../services/meetingService.js';
import {
  sendCandidateAssignmentEmail,
  sendCandidateInterviewScheduledEmail,
  sendInterviewPanelScheduledEmail,
} from '../../services/emailService.js';
import { buildSuperAdminOwnerScope, isSuperAdminUser } from '../../utils/superAdminScope.js';
import { canViewAllAssignments, hasAnyPermission as hasAnyPermissionScope } from '../../utils/permissionScope.js';
import {
  createUserNotification,
  pushPortalNotification,
} from '../notification/notification.service.js';
import { AI_MATCH_AUTHOR_WHERE } from '../match/matchQueryHelpers.js';
import { permanentDeleteCandidateById } from '../../services/candidatePermanentDelete.service.js';

const CANDIDATE_ACTIVITY_ENTITY = 'CANDIDATE';
const NOTE_ACTIVITY_KIND = 'candidate-note';
const TAG_ACTIVITY_KIND = 'candidate-tag';
const PIPELINE_ACTIVITY_KIND = 'candidate-pipeline';

function isPhase1CandidateSource(source) {
  return String(source || '').trim().toLowerCase() === 'phase1';
}

function isPhase1CandidateRecord(candidate) {
  return isPhase1CandidateSource(candidate?.source);
}

function candidateHasRealJobLink(candidate) {
  if (!candidate) return false;
  const assigned = Array.isArray(candidate.assignedJobs) ? candidate.assignedJobs : [];
  if (assigned.some((id) => String(id || '').trim())) return true;
  if (Array.isArray(candidate.applications) && candidate.applications.length > 0) return true;
  if (Array.isArray(candidate.pipelineEntries) && candidate.pipelineEntries.length > 0) return true;
  return false;
}

function isTerminalCandidateStage(stage) {
  const normalized = String(stage || '').trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized.includes('hire') ||
    normalized === 'placed' ||
    normalized === 'joined' ||
    normalized === 'onboarded' ||
    normalized.includes('reject')
  );
}

/** CRM list/drawer stage: job-linked candidates default to Applied unless a later stage is set. */
function resolveCandidateStageForList(candidate) {
  const explicit = String(candidate?.stage || '').trim();
  const explicitLower = explicit.toLowerCase();
  if (explicit && explicitLower !== 'new') {
    return explicit;
  }
  if (candidateHasRealJobLink(candidate)) {
    return 'Applied';
  }
  const status = String(candidate?.status || '').toUpperCase();
  if (status === 'NEW' || status === 'ACTIVE') return 'New';
  return explicit || 'New';
}

function stageWhenLinkingToJob(existingStage) {
  const current = String(existingStage || '').trim();
  if (isTerminalCandidateStage(current)) return current;
  if (!current || current.toLowerCase() === 'new') return 'Applied';
  return current;
}

/**
 * CRM Candidates page: show Phase 1 / AI-pool rows only after a real job link (apply, assign, pipeline).
 * Hide sparse rows created only so Match records can reference a tenant candidate id.
 */
function candidateHasListIdentity(candidate) {
  return (
    Boolean(String(candidate?.firstName || '').trim()) ||
    Boolean(String(candidate?.lastName || '').trim()) ||
    Boolean(String(candidate?.email || '').trim())
  );
}

function shouldShowOnCrmCandidatesList(candidate, options = {}) {
  if (!candidate) return false;
  const includeCommonPool = options.includeCommonPool === true;
  if (isPhase1CandidateSource(candidate.source) && !candidateHasRealJobLink(candidate)) {
    if (includeCommonPool) {
      return candidateHasListIdentity(candidate);
    }
    return false;
  }
  if (!candidateHasListIdentity(candidate) && !candidateHasRealJobLink(candidate)) {
    return false;
  }
  return true;
}

function candidateMatchesSearch(candidate, search) {
  if (!search) return true;
  const needle = String(search).trim().toLowerCase();
  if (!needle) return true;
  const hay = [
    candidate?.firstName,
    candidate?.lastName,
    candidate?.email,
    candidate?.phone,
  ]
    .map((value) => String(value || '').toLowerCase())
    .join(' ');
  return hay.includes(needle);
}

function annotateCandidateListFlags(candidate) {
  const phase1 = isPhase1CandidateRecord(candidate);
  const hasJob = candidateHasRealJobLink(candidate);
  const discoveryOnly = phase1 && !hasJob;
  const resolvedStage = resolveCandidateStageForList(candidate);
  const stageNew = ['new', ''].includes(String(resolvedStage || '').trim().toLowerCase());
  return {
    ...candidate,
    stage: resolvedStage,
    isPhase1Candidate: phase1,
    isNewCandidate: discoveryOnly || (phase1 && stageNew && !hasJob),
    isJobAppliedCandidate: hasJob && resolvedStage === 'Applied',
    poolOrigin: discoveryOnly ? 'phase1_common' : phase1 ? 'phase1' : 'tenant',
  };
}

/** Prisma scope: non-phase1 OR phase1 with a real job/application/pipeline link. */
function buildCrmCandidatesListScopeClause() {
  return {
    OR: [
      { NOT: { source: 'phase1' } },
      { assignedJobs: { isEmpty: false } },
      { applications: { some: {} } },
      { pipelineEntries: { some: {} } },
    ],
  };
}
const REJECTION_ACTIVITY_KIND = 'candidate-rejection';
const INTERVIEW_ACTIVITY_KIND = 'candidate-interview';

const candidateDetailInclude = {
  assignedTo: {
    select: { id: true, name: true, email: true, avatar: true },
  },
  interviews: {
    include: {
      interviewer: {
        select: { id: true, name: true, email: true, avatar: true, role: true, department: true },
      },
      job: {
        select: { id: true, title: true },
      },
    },
    orderBy: { scheduledAt: 'desc' },
  },
  placements: true,
  matches: {
    include: {
      job: {
        select: {
          id: true,
          title: true,
          client: { select: { companyName: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  },
  pipelineEntries: {
    include: {
      stage: true,
      movedBy: {
        select: { id: true, name: true, email: true, avatar: true },
      },
    },
    orderBy: { movedAt: 'desc' },
  },
};

const candidateListInclude = {
  assignedTo: {
    select: { id: true, name: true, email: true },
  },
  applications: {
    select: { id: true, jobId: true },
    take: 30,
  },
  pipelineEntries: {
    select: { id: true, jobId: true },
    take: 30,
  },
  matches: {
    include: {
      job: {
        select: {
          id: true,
          title: true,
          client: { select: { companyName: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 40,
  },
};

function pickFirstNonEmpty(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
      continue;
    }
    if (typeof value === 'number') {
      if (Number.isFinite(value)) return value;
      continue;
    }
    if (Array.isArray(value)) {
      if (value.length) return value;
      continue;
    }
    return value;
  }
  return null;
}

/** Prefer non-empty portal/common Phase 1 fields over sparse tenant CRM stubs (same Mongo id). */
function mergePortalAndTenantCandidateRow(portalRow, tenantRow) {
  if (!tenantRow) return portalRow;
  if (!portalRow) return tenantRow;
  const jobSet = new Set([
    ...(Array.isArray(portalRow.assignedJobs) ? portalRow.assignedJobs : []),
    ...(Array.isArray(tenantRow.assignedJobs) ? tenantRow.assignedJobs : []),
  ].map(String).filter(Boolean));

  const scalarKeys = [
    'firstName',
    'lastName',
    'email',
    'phone',
    'linkedIn',
    'resume',
    'resumeUrl',
    'experience',
    'experienceYears',
    'currentTitle',
    'currentCompany',
    'location',
    'address',
    'addressLine',
    'city',
    'country',
    'designation',
    'cvSummary',
    'notes',
    'recruiterNotes',
    'education',
    'recruiterEducation',
  ];
  const arrayKeys = [
    'skills',
    'recruiterSkills',
    'languages',
    'recruiterLanguages',
    'certifications',
    'certificationsList',
  ];
  const richKeys = ['cvEducationEntries', 'cvWorkExperienceEntries', 'cvPortfolioLinks'];

  const merged = { ...tenantRow, ...portalRow, assignedJobs: Array.from(jobSet) };
  for (const key of scalarKeys) {
    merged[key] = pickFirstNonEmpty(tenantRow[key], portalRow[key]);
  }
  for (const key of arrayKeys) {
    merged[key] = pickFirstNonEmpty(tenantRow[key], portalRow[key]);
  }
  for (const key of richKeys) {
    merged[key] = pickFirstNonEmpty(tenantRow[key], portalRow[key]);
  }
  merged.source = pickFirstNonEmpty(tenantRow.source, portalRow.source);
  return merged;
}

async function resolveJobIdForStageSync(candidateId, data) {
  const explicit = String(data?.jobId || '').trim();
  if (explicit) return explicit;
  const m = await prisma.match.findFirst({
    where: { candidateId },
    orderBy: { updatedAt: 'desc' },
    select: { jobId: true },
  });
  if (m?.jobId) return String(m.jobId);
  // Fallback: many flows (especially reject from the Candidates tab) never
  // send `jobId`, but the tenant candidate still carries `assignedJobs[]`.
  // Without a jobId the portal `Application` row + pipeline never sync —
  // the job portal keeps showing "Interview" forever.
  const cand = await prisma.candidate.findFirst({
    where: { id: candidateId, isDeleted: { not: true } },
    select: { assignedJobs: true },
  });
  const fromAssigned = Array.isArray(cand?.assignedJobs)
    ? cand.assignedJobs.map((id) => String(id || '').trim()).find((id) => /^[a-f\d]{24}$/i.test(id))
    : null;
  return fromAssigned || null;
}

function getActivityMetadata(activity) {
  return activity?.metadata && typeof activity.metadata === 'object' ? activity.metadata : {};
}

function normalizeTagId(value = '') {
  return `tag-${String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')}`;
}

function getTagColor(label = '') {
  const palette = ['#2563eb', '#7c3aed', '#059669', '#ea580c', '#dc2626', '#0891b2', '#ca8a04', '#4f46e5'];
  const seed = label.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return palette[seed % palette.length];
}

function buildTagRecord(tag) {
  if (!tag) return null;

  const label = typeof tag === 'string' ? tag.trim() : String(tag.label || '').trim();
  if (!label) return null;

  return {
    id: typeof tag === 'string' ? normalizeTagId(label) : tag.id || normalizeTagId(label),
    label,
    color: typeof tag === 'string' ? getTagColor(label) : tag.color || getTagColor(label),
  };
}

function getCandidateActivityType(activity) {
  const metadata = getActivityMetadata(activity);
  const action = String(activity.action || '').toLowerCase();

  if (metadata.kind === NOTE_ACTIVITY_KIND) return 'note-added';
  if (metadata.kind === PIPELINE_ACTIVITY_KIND) return 'added-to-pipeline';
  if (metadata.kind === REJECTION_ACTIVITY_KIND) return 'rejected';
  if (metadata.kind === INTERVIEW_ACTIVITY_KIND) return 'interview-scheduled';
  if (action.includes('email')) return 'email-sent';
  if (action.includes('resume')) return 'resume-parsed';
  if (action.includes('stage')) return 'stage-movement';

  return 'note-added';
}

function mapActivityToDrawerItem(activity) {
  const metadata = getActivityMetadata(activity);

  if (metadata.kind === TAG_ACTIVITY_KIND) {
    return null;
  }

  return {
    id: activity.id,
    type: getCandidateActivityType(activity),
    title: activity.action,
    description: activity.description || metadata.text || null,
    timestamp: activity.createdAt,
    performedBy: {
      name: activity.performedBy?.name || 'System',
      avatar: activity.performedBy?.avatar || null,
    },
    relatedJob: metadata.relatedJobTitle || activity.relatedLabel || null,
  };
}

function mapActivityToNote(activity) {
  const metadata = getActivityMetadata(activity);

  if (metadata.kind !== NOTE_ACTIVITY_KIND) {
    return null;
  }

  return {
    id: activity.id,
    text: metadata.text || activity.description || '',
    createdAt: activity.createdAt,
    recruiter: {
      id: activity.performedBy?.id,
      name: activity.performedBy?.name || 'Recruiter',
      avatar: activity.performedBy?.avatar || null,
    },
    tags: Array.isArray(metadata.tags) ? metadata.tags.filter(Boolean) : [],
    isPinned: Boolean(metadata.isPinned),
  };
}

function clampScore(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function buildAiCandidateAnalysis(candidate) {
  const matches = Array.isArray(candidate?.matches) ? candidate.matches : [];
  const primaryMatch = matches.find((item) => Number.isFinite(Number(item?.score))) || matches[0] || null;

  const experienceYears = Number(candidate?.experience ?? candidate?.experienceYears ?? 0);
  const hasEducation = Boolean(candidate?.education || candidate?.recruiterEducation);
  const skillsCount = Array.isArray(candidate?.skills) ? candidate.skills.length : 0;

  if (primaryMatch && Number.isFinite(Number(primaryMatch?.score))) {
    const overall = clampScore(primaryMatch.score, 0);
    const skillsMatch = clampScore(overall + Math.min(skillsCount * 2, 8) - 4, overall);
    const experienceFit = clampScore(overall + Math.min(experienceYears * 2, 10) - 5, overall);
    const educationFit = clampScore(overall + (hasEducation ? 4 : -6), overall);
    const keywordMatch = clampScore(Math.round((skillsMatch * 0.5) + (experienceFit * 0.3) + (educationFit * 0.2)), overall);

    const jobTitle = primaryMatch?.job?.title || null;
    const insights = [
      {
        type: overall >= 65 ? 'strength' : 'gap',
        text: jobTitle
          ? `AI fit score is ${overall}% for applied job "${jobTitle}".`
          : `AI fit score is ${overall}% based on latest matched job.`,
      },
      {
        type: skillsMatch >= 60 ? 'strength' : 'gap',
        text: skillsMatch >= 60
          ? 'Skills alignment is strong for the selected role.'
          : 'Skills alignment needs improvement for the selected role.',
      },
      {
        type: experienceFit >= 60 ? 'strength' : 'gap',
        text: experienceFit >= 60
          ? 'Experience level is relevant to current role expectations.'
          : 'Experience appears lighter than this role typically expects.',
      },
    ];

    return {
      source: 'match',
      jobTitle,
      overall,
      breakdown: {
        skillsMatch,
        experienceFit,
        educationFit,
        keywordMatch,
      },
      insights,
    };
  }

  const skillsMatch = clampScore(skillsCount > 0 ? 55 + skillsCount * 8 : 38, 0);
  const experienceFit = clampScore(experienceYears > 0 ? 45 + experienceYears * 6 : 35, 0);
  const educationFit = hasEducation ? 72 : 48;
  const keywordMatch = clampScore(Math.round((skillsMatch * 0.45) + (experienceFit * 0.35) + (educationFit * 0.2)), 0);
  const overall = clampScore(Math.round((skillsMatch + experienceFit + educationFit + keywordMatch) / 4), 0);

  return {
    source: 'estimated',
    jobTitle: null,
    overall,
    breakdown: {
      skillsMatch,
      experienceFit,
      educationFit,
      keywordMatch,
    },
    insights: [
      {
        type: 'gap',
        text: 'No applied-job match score available yet. This is an estimated profile-fit score.',
      },
    ],
  };
}

function extractCustomTags(activities) {
  const activeTags = new Map();
  const orderedActivities = [...activities].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  for (const activity of orderedActivities) {
    const metadata = getActivityMetadata(activity);
    if (metadata.kind !== TAG_ACTIVITY_KIND) continue;

    const tag = buildTagRecord(metadata.tag);
    if (!tag) continue;

    if (metadata.operation === 'remove') {
      activeTags.delete(tag.id);
    } else {
      activeTags.set(tag.id, tag);
    }
  }

  return Array.from(activeTags.values());
}

function mapInterviewType(type, mode) {
  const normalizedType = String(type || '').toLowerCase();
  const normalizedMode = String(mode || '').toLowerCase();

  if (normalizedType.includes('technical')) return 'TECHNICAL';
  if (normalizedType.includes('final')) return 'FINAL';
  if (normalizedMode === 'phone') return 'PHONE';
  if (normalizedMode === 'in-person') return 'ONSITE';

  return 'VIDEO';
}

function mapInterviewMode(mode) {
  const normalizedMode = String(mode || '').toLowerCase();
  if (normalizedMode === 'in-person' || normalizedMode === 'onsite' || normalizedMode === 'walk-in') {
    return 'OFFLINE';
  }

  return 'ONLINE';
}

function mapMeetingPlatform(platform, mode) {
  const normalizedPlatform = String(platform || mode || '').toLowerCase();
  if (normalizedPlatform.includes('google')) return 'GOOGLE_MEET';
  if (normalizedPlatform.includes('teams') || normalizedPlatform.includes('microsoft')) return 'MS_TEAMS';
  if (normalizedPlatform.includes('zoom')) return 'ZOOM';
  return null;
}

function mapStageToMatchStatus(stage) {
  const normalizedStage = String(stage || '').toLowerCase();

  if (normalizedStage.includes('shortlist')) return 'SHORTLISTED';
  if (normalizedStage.includes('reject')) return 'REJECTED';

  return 'REVIEWED';
}

function parseDurationToMinutes(duration) {
  const value = String(duration || '').trim().toLowerCase();
  const match = value.match(/(\d+(?:\.\d+)?)/);

  if (!match) return 60;

  const amount = Number(match[1]);
  if (Number.isNaN(amount)) return 60;
  if (value.includes('hour')) return Math.round(amount * 60);

  return Math.round(amount);
}

function buildScheduledAt(date, time) {
  if (!date || !time) {
    throw new Error('Interview date and time are required');
  }

  const normalizedTime = String(time).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!normalizedTime) {
    throw new Error('Invalid interview time format');
  }

  let hours = Number(normalizedTime[1]);
  const minutes = Number(normalizedTime[2]);
  const meridiem = normalizedTime[3].toUpperCase();

  if (hours === 12) {
    hours = meridiem === 'AM' ? 0 : 12;
  } else if (meridiem === 'PM') {
    hours += 12;
  }

  const scheduledAt = new Date(`${date}T00:00:00`);
  scheduledAt.setHours(hours, minutes, 0, 0);

  if (Number.isNaN(scheduledAt.getTime())) {
    throw new Error('Invalid interview schedule');
  }

  return scheduledAt;
}

async function generateCandidateMeetingLink({ candidate, job, data, interviewers, userId }) {
  const platform = mapMeetingPlatform(data?.platform, data?.mode);
  if (String(data?.mode || '').toLowerCase() !== 'video' || !platform) {
    return { meetingLink: null, platform: null, error: null };
  }

  const scheduledAt = buildScheduledAt(data?.date, data?.time);
  const interviewerIds = Array.isArray(interviewers) ? interviewers.map((item) => item.id).filter(Boolean) : [];
  const panelUsers = interviewerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: interviewerIds } },
        select: { email: true },
      })
    : [];

  const result = await generateMeetingLink(platform, {
    id: `candidate-preview-${candidate.id}-${Date.now()}`,
    date: scheduledAt,
    duration: parseDurationToMinutes(data?.duration),
    timezone: String(data?.timezone || 'Asia/Kolkata').trim() || 'Asia/Kolkata',
    candidateName: `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || candidate.email || 'Candidate',
    jobTitle: job.title,
    panelEmails: panelUsers.map((item) => item.email).filter(Boolean),
    notes: String(data?.notes || '').trim() || undefined,
  }, userId);

  return {
    meetingLink: result.meetingLink,
    platform,
    error: result.error || null,
  };
}

async function getCandidateActivities(candidateId, client = prisma) {
  return client.activity.findMany({
    where: {
      entityType: CANDIDATE_ACTIVITY_ENTITY,
      entityId: candidateId,
    },
    include: {
      performedBy: {
        select: { id: true, name: true, email: true, avatar: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Copy a portal-only candidate into the active tenant DB so mutations (interview, reject, etc.) succeed.
 * List view merges portal + tenant rows; without this, POST .../interviews fails with "Candidate not found".
 */
async function materializePortalCandidateIntoTenant(portalRow) {
  const assignedJobs = Array.isArray(portalRow.assignedJobs) ? portalRow.assignedJobs : [];
  const skills =
    Array.isArray(portalRow.recruiterSkills) && portalRow.recruiterSkills.length
      ? portalRow.recruiterSkills
      : Array.isArray(portalRow.skills)
        ? portalRow.skills
        : [];
  const languages = Array.isArray(portalRow.languages) ? portalRow.languages : [];
  const recruiterLanguages = Array.isArray(portalRow.recruiterLanguages) ? portalRow.recruiterLanguages : [];

  const baseData = {
    firstName: portalRow.firstName ?? null,
    lastName: portalRow.lastName ?? null,
    email: portalRow.email ?? null,
    phone: portalRow.phone ?? null,
    linkedIn: portalRow.linkedIn ?? null,
    resume: portalRow.resume ?? portalRow.resumeUrl ?? null,
    resumeUrl: portalRow.resumeUrl ?? null,
    skills,
    recruiterSkills: Array.isArray(portalRow.recruiterSkills) ? portalRow.recruiterSkills : [],
    experience: portalRow.experience ?? portalRow.experienceYears ?? null,
    experienceYears: portalRow.experienceYears ?? null,
    currentTitle: portalRow.currentTitle ?? null,
    currentCompany: portalRow.currentCompany ?? null,
    location: portalRow.location ?? null,
    address: portalRow.address ?? portalRow.addressLine ?? null,
    addressLine: portalRow.addressLine ?? null,
    city: portalRow.city ?? null,
    country: portalRow.country ?? null,
    status: 'ACTIVE',
    recruiterStatus: portalRow.recruiterStatus ?? null,
    source: portalRow.source ?? 'Job portal',
    assignedJobs,
    stage: portalRow.stage ?? 'Applied',
    lastActivity: portalRow.lastActivity ?? new Date(),
    languages,
    recruiterLanguages,
    notes: portalRow.notes ?? portalRow.recruiterNotes ?? null,
    recruiterNotes: portalRow.recruiterNotes ?? null,
    education: portalRow.education ?? portalRow.recruiterEducation ?? null,
    recruiterEducation: portalRow.recruiterEducation ?? null,
    certifications: Array.isArray(portalRow.certifications) ? portalRow.certifications : [],
    certificationsList: Array.isArray(portalRow.certificationsList) ? portalRow.certificationsList : [],
    portfolio: portalRow.portfolio ?? null,
    website: portalRow.website ?? null,
    preferredLocation: portalRow.preferredLocation ?? null,
  };

  return prisma.candidate.upsert({
    where: { id: portalRow.id },
    create: {
      id: portalRow.id,
      ...baseData,
    },
    update: {
      stage: baseData.stage,
      assignedJobs: baseData.assignedJobs,
      lastActivity: baseData.lastActivity,
    },
  });
}

/** Profile fields synced when AI match materializes a pool row — never workflow fields on update. */
function buildMatchMaterializeProfileFields(poolRow, skills, languages, recruiterLanguages) {
  return {
    firstName: poolRow.firstName ?? null,
    lastName: poolRow.lastName ?? null,
    email: poolRow.email ?? null,
    phone: poolRow.phone ?? null,
    linkedIn: poolRow.linkedIn ?? null,
    resume: poolRow.resume ?? poolRow.resumeUrl ?? null,
    resumeUrl: poolRow.resumeUrl ?? null,
    skills,
    recruiterSkills: Array.isArray(poolRow.recruiterSkills) ? poolRow.recruiterSkills : [],
    experience: poolRow.experience ?? poolRow.experienceYears ?? null,
    experienceYears: poolRow.experienceYears ?? null,
    currentTitle: poolRow.currentTitle ?? null,
    currentCompany: poolRow.currentCompany ?? null,
    location: poolRow.location ?? null,
    address: poolRow.address ?? poolRow.addressLine ?? null,
    addressLine: poolRow.addressLine ?? null,
    city: poolRow.city ?? null,
    country: poolRow.country ?? null,
    recruiterStatus: poolRow.recruiterStatus ?? null,
    lastActivity: poolRow.lastActivity ?? new Date(),
    languages,
    recruiterLanguages,
    notes: poolRow.notes ?? poolRow.recruiterNotes ?? null,
    recruiterNotes: poolRow.recruiterNotes ?? null,
    education: poolRow.education ?? poolRow.recruiterEducation ?? null,
    recruiterEducation: poolRow.recruiterEducation ?? null,
    certifications: Array.isArray(poolRow.certifications) ? poolRow.certifications : [],
    certificationsList: Array.isArray(poolRow.certificationsList) ? poolRow.certificationsList : [],
    cvSummary: poolRow.cvSummary ?? null,
    cvEducationEntries: poolRow.cvEducationEntries ?? null,
    cvWorkExperienceEntries: poolRow.cvWorkExperienceEntries ?? null,
    cvPortfolioLinks: poolRow.cvPortfolioLinks ?? null,
    portfolio: poolRow.portfolio ?? null,
    website: poolRow.website ?? null,
    preferredLocation: poolRow.preferredLocation ?? null,
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
  };
}

function isAppliedMatchEvaluation(evaluation) {
  return evaluation && typeof evaluation === 'object' && evaluation.origin === 'applied';
}

/**
 * Full materialize for AI match: create tenant row for Match FK.
 * Phase 1 rows stay discovery-only (New stage, no job assignment, hidden from Candidates list).
 * When aiMatchOnly is true, never link the scoring job to assignedJobs (score-only, no assignment).
 */
async function materializeCandidateForMatch(poolRow, options = {}) {
  const matchingJobId = String(options.matchingJobId || '').trim();
  const aiMatchOnly = Boolean(options.aiMatchOnly);
  const phase1 = isPhase1CandidateSource(poolRow?.source);
  let poolAssignedJobs = Array.isArray(poolRow.assignedJobs)
    ? poolRow.assignedJobs.map((id) => String(id || '').trim()).filter(Boolean)
    : [];
  if (aiMatchOnly && matchingJobId) {
    poolAssignedJobs = poolAssignedJobs.filter((id) => id !== matchingJobId);
  }
  const hasRealJobLink = !aiMatchOnly && poolAssignedJobs.length > 0;
  const assignedJobs =
    phase1 && !hasRealJobLink ? [] : poolAssignedJobs;
  const skills =
    Array.isArray(poolRow.recruiterSkills) && poolRow.recruiterSkills.length
      ? poolRow.recruiterSkills
      : Array.isArray(poolRow.skills)
        ? poolRow.skills
        : [];
  const languages = Array.isArray(poolRow.languages) ? poolRow.languages : [];
  const recruiterLanguages = Array.isArray(poolRow.recruiterLanguages) ? poolRow.recruiterLanguages : [];

  const profileFields = buildMatchMaterializeProfileFields(
    poolRow,
    skills,
    languages,
    recruiterLanguages,
  );

  const existing = await prisma.candidate.findUnique({
    where: { id: poolRow.id },
    select: { id: true, isDeleted: true, stage: true, assignedJobs: true, source: true },
  });

  if (existing && existing.isDeleted !== true) {
    return prisma.candidate.update({
      where: { id: poolRow.id },
      data: profileFields,
    });
  }

  // AI match materialize must not default CRM stage to Applied — preserve pool stage or New.
  const stageForCreate =
    poolRow.stage && String(poolRow.stage).trim() ? String(poolRow.stage).trim() : 'New';

  // Pool-only rows (no job application) stay phase1 discovery — visible on AI Matches, not Candidates list.
  const discoveryOnly = (phase1 || !hasRealJobLink) && !hasRealJobLink;
  const sourceForCreate = discoveryOnly
    ? 'phase1'
    : phase1
      ? 'phase1'
      : poolRow.source ?? null;

  const createData = {
    id: poolRow.id,
    ...profileFields,
    status: 'ACTIVE',
    source: sourceForCreate,
    assignedJobs,
    stage: discoveryOnly ? 'New' : stageForCreate,
  };

  if (existing?.isDeleted === true) {
    const restoreData = {
      ...profileFields,
      status: 'ACTIVE',
    };
    if (phase1) {
      restoreData.source = 'phase1';
      restoreData.assignedJobs = [];
      if (!existing.stage || isPhase1CandidateSource(existing.source)) {
        restoreData.stage = 'New';
      }
    } else {
      restoreData.source = poolRow.source ?? existing.source ?? null;
      const poolStage = poolRow.stage && String(poolRow.stage).trim();
      if (!existing.stage) {
        restoreData.stage = poolStage || 'New';
      } else if (existing.stage === 'Applied' && poolStage && poolStage !== 'Applied') {
        restoreData.stage = poolStage;
      }
      if (!aiMatchOnly && (!Array.isArray(existing.assignedJobs) || !existing.assignedJobs.length)) {
        restoreData.assignedJobs = assignedJobs;
      } else if (aiMatchOnly && matchingJobId && Array.isArray(existing.assignedJobs)) {
        const trimmed = existing.assignedJobs
          .map((id) => String(id || '').trim())
          .filter((id) => id && id !== matchingJobId);
        if (trimmed.length !== existing.assignedJobs.length) {
          restoreData.assignedJobs = trimmed;
        }
      }
    }
    return prisma.candidate.update({
      where: { id: poolRow.id },
      data: restoreData,
    });
  }

  return prisma.candidate.create({ data: createData });
}

/**
 * Resolve a candidate by id from the tenant DB, falling back to the job-portal DB and
 * materializing the row into the tenant on demand. The merged candidate list view shows
 * portal-only rows in the picker, so callers that mutate (interview create, reject, etc.)
 * must use this helper instead of `prisma.candidate.findUnique` to avoid a "Candidate not
 * found" 400 for candidates that exist on the portal side but not in the tenant yet.
 */
async function getCandidateOrThrow(id) {
  const candidate = await prisma.candidate.findUnique({
    where: { id },
  });

  if (candidate) {
    if (candidate.isDeleted === true) {
      throw new Error('Candidate not found');
    }
    return candidate;
  }

  if (!isTenantScopedRequest()) {
    throw new Error('Candidate not found');
  }

  const portalPrisma = getJobPortalPrismaClient();
  const portalRow = await portalPrisma.candidate.findUnique({
    where: { id },
  });

  if (!portalRow) {
    throw new Error('Candidate not found');
  }

  return materializePortalCandidateIntoTenant(portalRow);
}

/**
 * Pool for AI match pipeline: tenant NEW/ACTIVE + candidatecommon (Phase 1 snapshots)
 * + optional job-portal merge. Excludes AI-rejected rows for this job.
 */
async function loadMatchPipelineCandidatePool(req, jobId) {
  const jobIdStr = String(jobId || '').trim();
  if (!jobIdStr) {
    return {
      candidates: [],
      tenantCount: 0,
      commonCount: 0,
      portalCount: 0,
      mergedCount: 0,
      phase1TombstoneReincluded: 0,
      commonIncluded: false,
      portalIncluded: false,
    };
  }

  const includeCommon =
    process.env.MATCH_INCLUDE_CANDIDATE_COMMON !== 'false' &&
    process.env.MATCH_INCLUDE_CANDIDATE_COMMON !== '0';
  const includePortal =
    process.env.MATCH_INCLUDE_PORTAL_CANDIDATES !== 'false' &&
    process.env.MATCH_INCLUDE_PORTAL_CANDIDATES !== '0';

  const tenantCandidates = await prisma.candidate.findMany({
    where: {
      isDeleted: { not: true },
      status: { in: ['NEW', 'ACTIVE'] },
    },
  });

  let commonCandidates = [];
  const commonIncluded = includeCommon && isTenantScopedRequest();
  if (commonIncluded) {
    commonCandidates = await fetchCandidateCommonForMatchPipeline(req);
  }

  let portalCandidates = [];
  const portalIncluded = includePortal && isTenantScopedRequest();
  if (portalIncluded) {
    const portalPrisma = getJobPortalPrismaClient();
    const portalLimit = Math.min(5000, Math.max(1, Number(process.env.MATCH_PORTAL_POOL_MAX || 500) || 500));
    portalCandidates = await portalPrisma.candidate.findMany({
      take: portalLimit,
      orderBy: { updatedAt: 'desc' },
    });
  }

  const portalIdsForTombstone = [
    ...portalCandidates.map((c) => c.id),
    ...commonCandidates.map((c) => c.id),
  ];
  const softDeletedTenantIds = portalIdsForTombstone.length
    ? await collectSoftDeletedTenantCandidateIds(portalIdsForTombstone)
    : new Set();

  const mergedById = new Map();
  // Phase 1 snapshots stay eligible for AI matching even when tenant has a recycle-bin tombstone.
  for (const candidate of commonCandidates) {
    mergedById.set(candidate.id, candidate);
  }
  let phase1TombstoneReincluded = 0;
  for (const candidate of commonCandidates) {
    if (softDeletedTenantIds.has(candidate.id)) phase1TombstoneReincluded += 1;
  }
  for (const candidate of portalCandidates) {
    if (softDeletedTenantIds.has(candidate.id) && !mergedById.has(candidate.id)) continue;
    const prior = mergedById.get(candidate.id);
    mergedById.set(
      candidate.id,
      prior ? mergePortalAndTenantCandidateRow(candidate, prior) : candidate
    );
  }
  for (const candidate of tenantCandidates) {
    const prior = mergedById.get(candidate.id);
    mergedById.set(
      candidate.id,
      prior ? mergePortalAndTenantCandidateRow(prior, candidate) : candidate
    );
  }

  let merged = Array.from(mergedById.values());
  if (merged.length) {
    const rejected = await prisma.match.findMany({
      where: {
        jobId: jobIdStr,
        status: 'REJECTED',
        createdById: AI_MATCH_AUTHOR_WHERE,
        candidateId: { in: merged.map((c) => c.id) },
      },
      select: { candidateId: true },
    });
    const rejectedIds = new Set(rejected.map((r) => r.candidateId));
    merged = merged.filter((c) => !rejectedIds.has(c.id));
  }

  return {
    candidates: merged,
    tenantCount: tenantCandidates.length,
    commonCount: commonCandidates.length,
    portalCount: portalCandidates.length,
    mergedCount: merged.length,
    phase1TombstoneReincluded,
    commonIncluded,
    portalIncluded,
  };
}

/**
 * Ensure a scored candidate exists in the tenant DB before writing a Match row.
 * @returns {{ id: string, materialized: boolean } | null}
 */
async function ensureCandidateMaterializedForMatch(candidateRow) {
  if (!candidateRow?.id) return null;
  if (!isTenantScopedRequest()) return null;

  const existing = await prisma.candidate.findUnique({
    where: { id: candidateRow.id },
    select: { id: true, isDeleted: true },
  });
  if (existing?.isDeleted === true) {
    const row = await materializeCandidateForMatch(candidateRow);
    if (!row?.id) return null;
    return { id: row.id, materialized: true };
  }
  if (existing) return { id: existing.id, materialized: false };

  const row = await materializeCandidateForMatch(candidateRow);
  if (!row?.id) return null;
  return { id: row.id, materialized: true };
}

// Exposed for cross-module callers (e.g. services/interview.service.js) so they can
// rely on the same portal→tenant materialization as the candidate module routes.
/**
 * Candidates tied to a specific job for the Matches page "AI Applied Matches" tab and
 * the Job drawer Candidates tab:
 * - `assignedJobs` contains the job id (recruiter assigned), and/or
 * - a tenant `Application` row exists for (candidateId, jobId), and/or
 * - a `PipelineEntry` exists for this job.
 * Does not load the general AI pool (NEW/ACTIVE tenant-wide, candidatecommon, portal).
 */
async function loadAppliedMatchCandidatePool(req, jobId) {
  const jobIdStr = String(jobId || '').trim();
  if (!jobIdStr) {
    return {
      candidates: [],
      tenantCount: 0,
      commonCount: 0,
      portalCount: 0,
      mergedCount: 0,
      phase1TombstoneReincluded: 0,
      commonIncluded: false,
      portalIncluded: false,
    };
  }

  const applicationRows = await prisma.application.findMany({
    where: { jobId: jobIdStr },
    select: { candidateId: true },
  });
  const applicationCandidateIds = [
    ...new Set(applicationRows.map((row) => String(row.candidateId || '').trim()).filter(Boolean)),
  ];

  const pipelineRows = await prisma.pipelineEntry.findMany({
    where: { jobId: jobIdStr },
    select: { candidateId: true },
  });
  const pipelineCandidateIds = [
    ...new Set(pipelineRows.map((row) => String(row.candidateId || '').trim()).filter(Boolean)),
  ];

  const matchRows = await prisma.match.findMany({
    where: { jobId: jobIdStr },
    select: { candidateId: true, evaluation: true },
  });
  const matchCandidateIds = [
    ...new Set(
      matchRows
        .filter((row) => isAppliedMatchEvaluation(row.evaluation))
        .map((row) => String(row.candidateId || '').trim())
        .filter(Boolean),
    ),
  ];

  const linkedIdSet = new Set([
    ...applicationCandidateIds,
    ...pipelineCandidateIds,
    ...matchCandidateIds,
  ]);

  const assignedCandidates = await prisma.candidate.findMany({
    where: {
      isDeleted: { not: true },
      assignedJobs: { has: jobIdStr },
    },
  });
  assignedCandidates.forEach((row) => linkedIdSet.add(row.id));

  const extraIds = [...linkedIdSet].filter((id) => !assignedCandidates.some((row) => row.id === id));
  let extraCandidates = [];
  if (extraIds.length) {
    extraCandidates = await prisma.candidate.findMany({
      where: {
        isDeleted: { not: true },
        id: { in: extraIds },
      },
    });
  }

  const byId = new Map();
  for (const row of assignedCandidates) byId.set(row.id, row);
  for (const row of extraCandidates) byId.set(row.id, row);

  let portalCount = 0;
  if (isTenantScopedRequest()) {
    try {
      const portalPrisma = getJobPortalPrismaClient();
      const portalLinkedIds = new Set();

      const portalApplications = await portalPrisma.application.findMany({
        where: { jobId: jobIdStr },
        select: { candidateId: true },
      });
      for (const row of portalApplications) {
        const id = String(row.candidateId || '').trim();
        if (id) portalLinkedIds.add(id);
      }

      const portalMatches = await portalPrisma.match.findMany({
        where: { jobId: jobIdStr },
        select: { candidateId: true, evaluation: true },
      });
      for (const row of portalMatches) {
        if (!isAppliedMatchEvaluation(row.evaluation)) continue;
        const id = String(row.candidateId || '').trim();
        if (id) portalLinkedIds.add(id);
      }

      const portalAssigned = await portalPrisma.candidate.findMany({
        where: { assignedJobs: { has: jobIdStr } },
        select: { id: true },
      });
      for (const row of portalAssigned) {
        const id = String(row.id || '').trim();
        if (id) portalLinkedIds.add(id);
      }

      if (portalLinkedIds.size) {
        const portalCandidates = await portalPrisma.candidate.findMany({
          where: { id: { in: [...portalLinkedIds] } },
        });
        for (const portalRow of portalCandidates) {
          const id = String(portalRow.id || '').trim();
          if (!id) continue;
          portalCount += 1;
          const tenantRow = byId.get(id);
          const mappedPortal = {
            id,
            firstName: portalRow.firstName ?? null,
            lastName: portalRow.lastName ?? null,
            email: portalRow.email ?? null,
            phone: portalRow.phone ?? null,
            linkedIn: portalRow.linkedIn ?? null,
            resume: portalRow.resumeUrl ?? null,
            resumeUrl: portalRow.resumeUrl ?? null,
            experience: portalRow.experience ?? portalRow.experienceYears ?? null,
            experienceYears: portalRow.experienceYears ?? portalRow.experience ?? null,
            currentTitle: portalRow.currentTitle ?? portalRow.designation ?? null,
            currentCompany: portalRow.currentCompany ?? null,
            location: portalRow.location ?? null,
            city: portalRow.city ?? null,
            country: portalRow.country ?? null,
            designation: portalRow.designation ?? portalRow.currentTitle ?? null,
            avatar: portalRow.avatar ?? null,
            stage: portalRow.stage ?? 'Applied',
            source: portalRow.source || 'Job Portal',
            assignedJobs: Array.isArray(portalRow.assignedJobs)
              ? portalRow.assignedJobs.map(String)
              : [jobIdStr],
            status: 'ACTIVE',
          };
          const jobSet = new Set([
            ...(Array.isArray(mappedPortal.assignedJobs) ? mappedPortal.assignedJobs : []),
            jobIdStr,
          ]);
          mappedPortal.assignedJobs = Array.from(jobSet);
          byId.set(
            id,
            tenantRow ? mergePortalAndTenantCandidateRow(mappedPortal, tenantRow) : mappedPortal
          );
        }
      }
    } catch (portalErr) {
      console.warn(
        '[loadAppliedMatchCandidatePool] portal applicants merge failed:',
        portalErr?.message || portalErr
      );
    }
  }

  const candidates = Array.from(byId.values());

  return {
    candidates,
    tenantCount: assignedCandidates.length + extraCandidates.length,
    commonCount: 0,
    portalCount,
    mergedCount: candidates.length,
    phase1TombstoneReincluded: 0,
    commonIncluded: false,
    portalIncluded: portalCount > 0,
  };
}

export {
  getCandidateOrThrow,
  loadMatchPipelineCandidatePool,
  loadAppliedMatchCandidatePool,
  ensureCandidateMaterializedForMatch,
};

function normalizePortalWorkMode(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return null;
  if (raw === 'REMOTE') return 'Remote';
  if (raw === 'ON_SITE' || raw === 'ONSITE' || raw === 'ON-SITE') return 'On-site';
  if (raw === 'HYBRID') return 'Hybrid';
  return value;
}

/**
 * The job-portal "career_preferences" collection lives in the portal MongoDB
 * but is not part of the backendphase2 Prisma schema. We read it via raw command
 * so we can surface candidate-self-updated values (notice period, expected
 * salary, availability, preferred location, etc.) inside the recruiter drawer.
 */
async function fetchCareerPreferencesForCandidates(candidateIds) {
  const map = new Map();
  if (!Array.isArray(candidateIds) || !candidateIds.length) return map;

  let portalClient = null;
  try { portalClient = getJobPortalPrismaClient(); } catch { portalClient = null; }
  if (!portalClient) return map;

  const ids = Array.from(new Set(candidateIds.map((id) => String(id)).filter(Boolean)));
  const objectIdHexes = ids.filter((id) => /^[a-fA-F0-9]{24}$/.test(id));
  const stringIds = ids;

  try {
    const result = await portalClient.$runCommandRaw({
      find: 'career_preferences',
      filter: {
        $or: [
          ...(objectIdHexes.length
            ? [{ candidateId: { $in: objectIdHexes.map((hex) => ({ $oid: hex })) } }]
            : []),
          { candidateId: { $in: stringIds } },
        ],
      },
      limit: ids.length,
    });
    const docs = result?.cursor?.firstBatch || [];
    for (const doc of docs) {
      const rawId = doc?.candidateId;
      const idStr = rawId && typeof rawId === 'object' && rawId.$oid
        ? String(rawId.$oid)
        : String(rawId || '');
      if (idStr) map.set(idStr, doc);
    }
  } catch (err) {
    console.warn('[candidate.service] bulk career_preferences fetch failed:', err?.message || err);
  }

  return map;
}

async function fetchPortalCareerPreferencesRaw(client, candidateId) {
  if (!candidateId) return null;
  const targetClient = client || (() => {
    try { return getJobPortalPrismaClient(); } catch { return null; }
  })();
  if (!targetClient) return null;

  const idStr = String(candidateId);
  const isObjectIdHex = /^[a-fA-F0-9]{24}$/.test(idStr);

  try {
    const filters = isObjectIdHex
      ? [{ candidateId: { $oid: idStr } }, { candidateId: idStr }]
      : [{ candidateId: idStr }];

    for (const filter of filters) {
      const result = await targetClient.$runCommandRaw({
        find: 'career_preferences',
        filter,
        limit: 1,
      });
      const doc = result?.cursor?.firstBatch?.[0];
      if (doc) return doc;
    }
  } catch (err) {
    console.warn('[candidate.service] failed to fetch career_preferences:', err?.message || err);
  }

  return null;
}

function mergeCareerPreferencesIntoCandidate(candidate, careerPrefs) {
  if (!candidate || !careerPrefs) return candidate;

  const cp = careerPrefs;
  const noticeFromDays = cp.noticePeriodDays != null
    ? `${cp.noticePeriodDays} day${Number(cp.noticePeriodDays) === 1 ? '' : 's'}`
    : null;

  const preferredLocations = Array.isArray(cp.preferredLocations) ? cp.preferredLocations : [];
  const expectedSalaryNum = cp.preferredSalary != null && Number.isFinite(Number(cp.preferredSalary))
    ? Number(cp.preferredSalary)
    : null;
  const currentSalaryNum = cp.currentSalary != null && Number.isFinite(Number(cp.currentSalary))
    ? Number(cp.currentSalary)
    : null;

  candidate.noticePeriod = pickFirstNonEmpty(candidate.noticePeriod, cp.noticePeriod, noticeFromDays);
  candidate.availability = pickFirstNonEmpty(candidate.availability, cp.availabilityToStart);
  candidate.expectedSalary = candidate.expectedSalary != null ? candidate.expectedSalary : expectedSalaryNum;
  candidate.currentSalary = candidate.currentSalary != null ? candidate.currentSalary : currentSalaryNum;
  candidate.preferredLocation = pickFirstNonEmpty(candidate.preferredLocation, preferredLocations[0]);

  candidate.careerPreferences = {
    preferredRoles: Array.isArray(cp.preferredRoles) ? cp.preferredRoles : [],
    preferredIndustry: cp.preferredIndustry || null,
    functionalArea: cp.functionalArea || null,
    jobTypes: Array.isArray(cp.jobTypes) ? cp.jobTypes : [],
    preferredWorkMode: normalizePortalWorkMode(cp.preferredWorkMode),
    preferredLocations,
    relocationPreference: cp.relocationPreference || null,
    preferredCurrency: cp.preferredCurrency || null,
    preferredSalary: expectedSalaryNum,
    preferredSalaryType: cp.preferredSalaryType || null,
    preferredBenefits: Array.isArray(cp.preferredBenefits) ? cp.preferredBenefits : [],
    availabilityToStart: cp.availabilityToStart || null,
    noticePeriod: cp.noticePeriod || noticeFromDays,
    noticePeriodDays: cp.noticePeriodDays != null ? Number(cp.noticePeriodDays) : null,
    openToRelocation: Boolean(cp.openToRelocation),
    currentLocation: cp.currentLocation || null,
    currentSalary: currentSalaryNum,
    currentCurrency: cp.currentCurrency || null,
    currentSalaryType: cp.currentSalaryType || null,
    currentBenefits: Array.isArray(cp.currentBenefits) ? cp.currentBenefits : [],
    passportNumbersByLocation: cp.passportNumbersByLocation ?? null,
  };

  return candidate;
}

async function buildCandidateResponse(candidate, activityClient = prisma) {
  const activities = await getCandidateActivities(candidate.id, activityClient);
  const customTags = extractCustomTags(activities);
  const internalNotes = activities.map(mapActivityToNote).filter(Boolean);
  const activityFeed = activities.map(mapActivityToDrawerItem).filter(Boolean);
  const normalizedCandidate = {
    ...candidate,
    resume: candidate.resume || candidate.resumeUrl || null,
    skills:
      Array.isArray(candidate.skills) && candidate.skills.length
        ? candidate.skills
        : Array.isArray(candidate.recruiterSkills)
          ? candidate.recruiterSkills
          : [],
    experience: candidate.experience ?? candidate.experienceYears ?? null,
    address: candidate.address || candidate.addressLine || null,
    status: candidate.status || candidate.recruiterStatus || 'NEW',
    education: candidate.education || candidate.recruiterEducation || null,
    certifications:
      Array.isArray(candidate.certifications) && candidate.certifications.length
        ? candidate.certifications
        : Array.isArray(candidate.certificationsList)
          ? candidate.certificationsList
          : [],
    languages:
      Array.isArray(candidate.languages) && candidate.languages.length
        ? candidate.languages
        : Array.isArray(candidate.recruiterLanguages)
          ? candidate.recruiterLanguages
          : [],
    notes: candidate.notes || candidate.recruiterNotes || null,
    aiCandidateAnalysis: buildAiCandidateAnalysis(candidate),
  };

  return {
    ...normalizedCandidate,
    tags: customTags.map((tag) => tag.label),
    tagObjects: customTags,
    internalNotes,
    activityFeed,
  };
}

/** Candidates the user may see when mine=true: created by them, assigned to them, or linked to jobs they created. */
async function buildMineCandidatesScope(userId) {
  if (!userId) {
    return { id: { in: [] } };
  }
  const myJobs = await prisma.job.findMany({
    where: { createdById: userId },
    select: { id: true },
  });
  const myJobIds = myJobs.map((j) => j.id);
  const orClause = [{ createdById: userId }, { assignedToId: userId }];
  if (myJobIds.length > 0) {
    orClause.push({ matches: { some: { jobId: { in: myJobIds } } } });
    orClause.push({ pipelineEntries: { some: { jobId: { in: myJobIds } } } });
    orClause.push({ interviews: { some: { jobId: { in: myJobIds } } } });
    orClause.push({ assignedJobs: { hasSome: myJobIds } });
    orClause.push({ applications: { some: { jobId: { in: myJobIds } } } });
  }
  return { OR: orClause };
}

function isTenantScopedRequest() {
  return Boolean(getActiveTenantDbName());
}

async function getVisibleTenantJobIds(req, mine) {
  const jobWhere = {};
  if (mine && req?.user?.id) {
    jobWhere.createdById = req.user.id;
  }

  const jobs = await prisma.job.findMany({
    where: { ...jobWhere, isDeleted: { not: true } },
    select: { id: true },
  });

  return jobs.map((job) => job.id);
}

/**
 * Portal DB candidates never carry the tenant CRM `isDeleted` flag. After a tenant soft-deletes
 * a candidate, the portal row can still exist — merge paths must drop those ids so deleted
 * candidates never reappear in lists, stats, or exports.
 */
async function collectSoftDeletedTenantCandidateIds(portalCandidateIds) {
  const ids = [...new Set((portalCandidateIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (!ids.length) return new Set();

  const [softDeletedRows, purgedRows] = await Promise.all([
    prisma.candidate.findMany({
      where: { id: { in: ids }, isDeleted: true },
      select: { id: true },
    }),
    prisma.purgedCandidateRef
      .findMany({
        where: { candidateId: { in: ids } },
        select: { candidateId: true },
      })
      .catch(() => []),
  ]);

  const hidden = new Set(softDeletedRows.map((r) => r.id));
  for (const row of purgedRows) {
    hidden.add(row.candidateId);
  }
  return hidden;
}

const CANDIDATE_EXPERIENCE_RANGES = {
  '0-2': { min: 0, max: 2 },
  '2-5': { min: 2, max: 5 },
  '5-10': { min: 5, max: 10 },
  '10+': { min: 10, max: null },
};

/** UI / API stage filter keys → DB values that may appear on `candidate.stage`. */
const STAGE_FILTER_VARIANTS = {
  new: ['New', 'NEW'],
  applied: ['Applied', 'APPLIED'],
  longlist: ['Longlist', 'Long List', 'LONGLIST'],
  shortlist: ['Shortlist', 'Short List', 'SHORTLIST'],
  screening: ['Screening', 'SCREENING'],
  submitted: ['Submitted', 'SUBMITTED'],
  interviewing: ['Interviewing', 'Interview', 'INTERVIEW', 'INTERVIEWING'],
  offered: ['Offered', 'Offer', 'OFFER', 'OFFERED'],
  hired: ['Hired', 'HIRED', 'Placed', 'PLACED'],
  rejected: ['Rejected', 'REJECTED'],
};

function normalizeStageFilterKey(stageParam) {
  const raw = String(stageParam || '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  const keys = Object.keys(STAGE_FILTER_VARIANTS);
  if (keys.includes(lower)) return lower;
  const byVariant = keys.find((key) =>
    (STAGE_FILTER_VARIANTS[key] || []).some((v) => String(v).toLowerCase() === lower)
  );
  return byVariant || lower;
}

function stageMatchesFilter(candidateStage, stageParam) {
  const key = normalizeStageFilterKey(stageParam);
  if (!key) return true;
  const hay = String(candidateStage || '').trim();
  const hayLower = hay.toLowerCase();
  if (key === 'new') {
    return !hay || hayLower === 'new';
  }
  const variants = STAGE_FILTER_VARIANTS[key];
  if (!variants) {
    return hayLower === key || hayLower.includes(key);
  }
  return variants.some((variant) => {
    const v = String(variant || '').trim().toLowerCase();
    return v && (hayLower === v || hayLower.includes(v));
  });
}

function buildStagePrismaWhereClause(stageParam) {
  const key = normalizeStageFilterKey(stageParam);
  if (!key) return null;
  if (key === 'new') {
    return {
      OR: [{ stage: null }, { stage: '' }, { stage: 'New' }, { stage: 'NEW' }],
    };
  }
  const variants = STAGE_FILTER_VARIANTS[key] || [String(stageParam || '').trim()];
  const unique = [...new Set(variants.map((v) => String(v).trim()).filter(Boolean))];
  return {
    OR: unique.map((variant) => ({ stage: variant })),
  };
}

function parseCandidateListFilters(query = {}) {
  const company = String(query.company || '').trim();
  const location = String(query.location || '').trim();
  const jobId = String(query.jobId || '').trim();
  const experienceRange = String(query.experienceRange || '').trim();
  const stage = String(query.stage || '').trim();
  const range = CANDIDATE_EXPERIENCE_RANGES[experienceRange];
  return {
    company,
    location,
    jobId,
    experienceRange,
    stage,
    minExperience: range ? range.min : null,
    maxExperience: range && range.max != null ? range.max : null,
    minExperienceOpen: range && range.max == null ? range.min : null,
  };
}

function appendCandidateListFilterAndParts(andParts, filters) {
  const { company, location, jobId, stage, minExperience, maxExperience, minExperienceOpen } = filters;
  const stageClause = buildStagePrismaWhereClause(stage);
  if (stageClause) {
    andParts.push(stageClause);
  }
  if (company) {
    andParts.push({
      OR: [
        { currentCompany: { contains: company, mode: 'insensitive' } },
        {
          matches: {
            some: {
              job: {
                client: { companyName: { contains: company, mode: 'insensitive' } },
              },
            },
          },
        },
      ],
    });
  }
  if (location) {
    andParts.push({ location: { contains: location } });
  }
  if (jobId) {
    andParts.push({
      OR: [{ assignedJobs: { has: jobId } }, { matches: { some: { jobId: jobId } } }],
    });
  }
  const expBounds = [];
  if (minExperience != null || maxExperience != null || minExperienceOpen != null) {
    const experienceClause = {};
    const experienceYearsClause = {};
    if (minExperience != null) {
      experienceClause.gte = minExperience;
      experienceYearsClause.gte = minExperience;
    }
    if (maxExperience != null) {
      experienceClause.lte = maxExperience;
      experienceYearsClause.lte = maxExperience;
    }
    if (minExperienceOpen != null) {
      experienceClause.gte = minExperienceOpen;
      experienceYearsClause.gte = minExperienceOpen;
    }
    if (Object.keys(experienceClause).length) {
      expBounds.push({ experience: experienceClause });
    }
    if (Object.keys(experienceYearsClause).length) {
      expBounds.push({ experienceYears: experienceYearsClause });
    }
    if (expBounds.length) {
      andParts.push({ OR: expBounds });
    }
  }
}

function candidateMatchesListFilters(candidate, filters) {
  const { company, location, jobId, stage, minExperience, maxExperience, minExperienceOpen } = filters;
  if (stage && !stageMatchesFilter(candidate.stage, stage)) {
    return false;
  }
  if (company) {
    const needle = company.toLowerCase();
    const currentCompanyHay = String(candidate.currentCompany || '').toLowerCase();
    const matchClientNames = (Array.isArray(candidate.matches) ? candidate.matches : [])
      .map((match) => String(match?.job?.client?.companyName || '').toLowerCase())
      .filter(Boolean);
    const matchesCompany =
      currentCompanyHay.includes(needle) ||
      matchClientNames.some((name) => name.includes(needle));
    if (!matchesCompany) return false;
  }
  if (location) {
    const hay = String(candidate.location || '').toLowerCase();
    if (!hay.includes(location.toLowerCase())) return false;
  }
  if (jobId) {
    const assigned = Array.isArray(candidate.assignedJobs) ? candidate.assignedJobs.map(String) : [];
    const matchJobIds = Array.isArray(candidate.matches)
      ? candidate.matches.map((m) => String(m?.jobId || m?.job?.id || '')).filter(Boolean)
      : [];
    if (!assigned.includes(jobId) && !matchJobIds.includes(jobId)) return false;
  }
  const exp = Number(candidate.experience ?? candidate.experienceYears ?? 0) || 0;
  if (minExperience != null && exp < minExperience) return false;
  if (maxExperience != null && exp > maxExperience) return false;
  if (minExperienceOpen != null && exp < minExperienceOpen) return false;
  return true;
}

async function fetchPortalCandidatesForTenant(req, { status, assignedToId, search, mine, listFilters }) {
  if (!isTenantScopedRequest()) return [];

  const portalPrisma = getJobPortalPrismaClient();
  const tenantJobIds = await getVisibleTenantJobIds(req, mine);
  const canViewAllPortal =
    isSuperAdminUser(req) ||
    canViewAllAssignments(req) ||
    hasAnyPermissionScope(req, ['view_all_candidates']);

  const where = {};
  if (assignedToId === 'unassigned') {
    where.assignedToId = null;
  } else if (assignedToId) {
    where.assignedToId = assignedToId;
  }

  const andParts = [];
  // Super admin / view-all with mine=false: show all portal rows (no CRM job link gate).
  // Regular users or explicit mine=true: require link to an allowed CRM job.
  if (!canViewAllPortal || mine) {
    if (!tenantJobIds.length) return [];
    andParts.push({
      OR: [
        { matches: { some: { jobId: { in: tenantJobIds } } } },
        { assignedJobs: { hasSome: tenantJobIds } },
      ],
    });
  }

  if (status) {
    andParts.push({
      OR: [{ status }, { recruiterStatus: status }],
    });
  }

  const superAdminScope = buildSuperAdminOwnerScope(req, ['createdById', 'assignedToId']);
  const canViewAllCandidates =
    canViewAllAssignments(req) || hasAnyPermissionScope(req, ['view_all_candidates']);
  if (mine && req?.user?.id) {
    const mineScope = await buildMineCandidatesScope(req.user.id);
    andParts.push(mineScope);
  } else if (superAdminScope) {
    andParts.push(superAdminScope);
  } else if (!canViewAllCandidates && req?.user?.id) {
    andParts.push({ OR: [{ createdById: req.user.id }, { assignedToId: req.user.id }] });
  }

  if (search) {
    andParts.push({
      OR: [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { email: { contains: search } },
      ],
    });
  }

  if (listFilters) {
    appendCandidateListFilterAndParts(andParts, listFilters);
  }

  if (andParts.length) {
    where.AND = andParts;
  }

  return portalPrisma.candidate.findMany({
    where,
    include: candidateListInclude,
    orderBy: { createdAt: 'desc' },
  });
}

export const candidateService = {
  async getAll(req) {
    const { page, limit, skip } = getPaginationParams(req);
    const { status, assignedToId, search } = req.query;
    const listFilters = parseCandidateListFilters(req.query);
    const includeCommonPool =
      req.query?.includeCommonPool === 'true' || req.query?.includeCommonPool === '1';
    const mine =
      req.query?.mine === 'true' || req.query?.mine === '1' || req.query?.mine === true;

    if (mine && !req.user?.id) {
      return formatPaginationResponse([], page, limit, 0);
    }

    const where = {};
    if (status) where.status = status;
    if (assignedToId === 'unassigned') {
      where.assignedToId = null;
    } else if (assignedToId) {
      where.assignedToId = assignedToId;
    }

    const andParts = [];
    // Recycle Bin: hide soft-deleted rows from the normal Candidates page.
    // `not: true` matches false, null, and missing-field documents (legacy rows from before
    // the soft-delete column existed) without tripping Prisma's "Argument isDeleted is missing".
    andParts.push({ isDeleted: { not: true } });
    // AI match Phase 1 snapshots are materialized for Match FK only — list them on AI Matches.
    andParts.push(buildCrmCandidatesListScopeClause());
    const superAdminScope = buildSuperAdminOwnerScope(req, ['createdById', 'assignedToId']);
    const canViewAllCandidates =
      canViewAllAssignments(req) || hasAnyPermissionScope(req, ['view_all_candidates']);

    // When mine=true, use the expanded "my candidates" scope only:
    // - created by me
    // - linked to jobs created by me (matches / pipeline / interviews)
    // Do NOT also AND with the legacy super-admin owner scope, otherwise
    // candidates applied on my jobs but not directly assigned/created get excluded.
    if (mine && req.user?.id) {
      andParts.push(await buildMineCandidatesScope(req.user.id));
    } else if (superAdminScope) {
      andParts.push(superAdminScope);
    } else if (!canViewAllCandidates && req.user?.id) {
      andParts.push({ OR: [{ createdById: req.user.id }, { assignedToId: req.user.id }] });
    }
    if (search) {
      // MongoDB doesn't support mode: 'insensitive' - use contains for case-sensitive search
      andParts.push({
        OR: [
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { email: { contains: search } },
        ],
      });
    }
    appendCandidateListFilterAndParts(andParts, listFilters);
    if (andParts.length) {
      where.AND = andParts;
    }

    let candidates = [];
    let total = 0;

    if (isTenantScopedRequest()) {
      const [tenantCandidates, portalCandidates] = await Promise.all([
        prisma.candidate.findMany({
          where,
          include: candidateListInclude,
          orderBy: { createdAt: 'desc' },
        }),
        fetchPortalCandidatesForTenant(req, { status, assignedToId, search, mine, listFilters }),
      ]);

      // Recycle Bin: the portal-DB copy of a candidate stays around when the tenant flips
      // isDeleted=true. Look up any tenant rows for the IDs the portal returned that are
      // soft-deleted and drop them from the merged map so the Candidates page hides them.
      const softDeletedTenantIds = await collectSoftDeletedTenantCandidateIds(
        portalCandidates.map((c) => c.id)
      );

      const mergedById = new Map();
      for (const candidate of portalCandidates) {
        if (softDeletedTenantIds.has(candidate.id)) continue;
        mergedById.set(candidate.id, candidate);
      }
      for (const candidate of tenantCandidates) {
        const prior = mergedById.get(candidate.id);
        mergedById.set(
          candidate.id,
          prior ? mergePortalAndTenantCandidateRow(prior, candidate) : candidate
        );
      }

      if (includeCommonPool) {
        const commonCandidates = await fetchCandidateCommonForCandidatesList(req);
        for (const commonRow of commonCandidates) {
          if (softDeletedTenantIds.has(commonRow.id)) continue;
          const prior = mergedById.get(commonRow.id);
          mergedById.set(
            commonRow.id,
            prior ? mergePortalAndTenantCandidateRow(commonRow, prior) : commonRow
          );
        }
      }

      const merged = Array.from(mergedById.values())
        .filter((candidate) => shouldShowOnCrmCandidatesList(candidate, { includeCommonPool }))
        .filter((candidate) => candidateMatchesSearch(candidate, search))
        .filter((candidate) => candidateMatchesListFilters(candidate, listFilters))
        .sort((a, b) => {
        const aTime = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });

      total = merged.length;
      candidates = merged.slice(skip, skip + limit);
    } else {
      [candidates, total] = await Promise.all([
        prisma.candidate.findMany({
          where,
          skip,
          take: limit,
          include: candidateListInclude,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.candidate.count({ where }),
      ]);
    }

    // Resolve assigned job ids into human-readable job titles for list UI.
    // Candidates created via drawer store `assignedJobs: [jobId]` but may not have a Match yet.
    const assignedJobIds = Array.from(
      new Set(
        candidates
          .flatMap((candidate) => (Array.isArray(candidate.assignedJobs) ? candidate.assignedJobs : []))
          .filter(Boolean)
          .map((id) => String(id))
      )
    );

    const jobsById = new Map();
    if (assignedJobIds.length) {
      const jobs = await prisma.job.findMany({
        where: { id: { in: assignedJobIds } },
        select: { id: true, title: true },
      });
      for (const job of jobs) jobsById.set(job.id, job.title);
    }

    // Fetch career preferences from portal DB for the visible page so that
    // candidate-self-updated values (notice period, expected salary, availability,
    // preferred location) appear in the list response too.
    const careerPrefsByCandidate = await fetchCareerPreferencesForCandidates(
      candidates.map((c) => c.id).filter(Boolean)
    );

    const enriched = candidates.map((candidate) => {
      const careerPrefs = careerPrefsByCandidate.get(String(candidate.id));
      if (careerPrefs) mergeCareerPreferencesIntoCandidate(candidate, careerPrefs);
      const titles = (Array.isArray(candidate.assignedJobs) ? candidate.assignedJobs : [])
        .map((jobId) => jobsById.get(jobId))
        .filter(Boolean);
      return annotateCandidateListFlags({
        ...candidate,
        resume: candidate.resume || candidate.resumeUrl || null,
        skills:
          Array.isArray(candidate.skills) && candidate.skills.length
            ? candidate.skills
            : Array.isArray(candidate.recruiterSkills)
              ? candidate.recruiterSkills
              : [],
        experience: candidate.experience ?? candidate.experienceYears ?? null,
        status: candidate.status || candidate.recruiterStatus || 'NEW',
        education: candidate.education || candidate.recruiterEducation || null,
        languages:
          Array.isArray(candidate.languages) && candidate.languages.length
            ? candidate.languages
            : Array.isArray(candidate.recruiterLanguages)
              ? candidate.recruiterLanguages
              : [],
        notes: candidate.notes || candidate.recruiterNotes || null,
        assignedJobTitles: titles,
      });
    });

    return formatPaginationResponse(enriched, page, limit, total);
  },

  async getById(id, req = null) {
    // Super admins should be able to open ANY candidate in their tenant by default.
    // buildSuperAdminOwnerScope already returns null unless mineOnly=true is explicitly
    // passed, so we don't apply any extra "mine" restriction here. Non-super users
    // without the view_all_candidates permission stay scoped to records they
    // created or are assigned to.
    const superAdminScope = buildSuperAdminOwnerScope(req, ['createdById', 'assignedToId']);
    let accessScope = superAdminScope;
    const canViewAllCandidates =
      canViewAllAssignments(req) || hasAnyPermissionScope(req, ['view_all_candidates']);

    if (!isSuperAdminUser(req) && !canViewAllCandidates && req?.user?.id) {
      const assignedScope = { OR: [{ createdById: req.user.id }, { assignedToId: req.user.id }] };
      accessScope = accessScope ? { AND: [accessScope, assignedScope] } : assignedScope;
    }

    const baseTenantWhere = { id, isDeleted: { not: true } };
    let candidate = await prisma.candidate.findFirst({
      where: accessScope ? { AND: [baseTenantWhere, accessScope] } : baseTenantWhere,
      include: candidateDetailInclude,
    });

    if (!candidate && isTenantScopedRequest()) {
      const [tombstone, purgedRef] = await Promise.all([
        prisma.candidate.findFirst({
          where: { id, isDeleted: true },
          select: { id: true },
        }),
        prisma.purgedCandidateRef
          .findUnique({ where: { candidateId: id }, select: { candidateId: true } })
          .catch(() => null),
      ]);
      if (tombstone || purgedRef) {
        return null;
      }
      const portalPrisma = getJobPortalPrismaClient();
      candidate = await portalPrisma.candidate.findFirst({
        where: accessScope ? { AND: [{ id }, accessScope] } : { id },
        include: candidateDetailInclude,
      });
      if (candidate) {
        const careerPrefs = await fetchPortalCareerPreferencesRaw(portalPrisma, candidate.id);
        mergeCareerPreferencesIntoCandidate(candidate, careerPrefs);
        return buildCandidateResponse(annotateCandidateListFlags(candidate), portalPrisma);
      }

      const commonCandidate = await fetchCandidateCommonByCandidateId(id);
      if (commonCandidate) {
        let portalClientForPrefs = null;
        try {
          portalClientForPrefs = getJobPortalPrismaClient();
        } catch {
          portalClientForPrefs = null;
        }
        const careerPrefs = await fetchPortalCareerPreferencesRaw(portalClientForPrefs, id);
        mergeCareerPreferencesIntoCandidate(commonCandidate, careerPrefs);
        return buildCandidateResponse(annotateCandidateListFlags(commonCandidate), portalClientForPrefs);
      }
    }

    if (!candidate) return null;

    // Career preferences live in the job-portal DB (where candidates self-update).
    // Always look there so recruiter drawer reflects candidate-side updates.
    let portalClientForPrefs = null;
    try { portalClientForPrefs = getJobPortalPrismaClient(); } catch { portalClientForPrefs = null; }
    const careerPrefs = await fetchPortalCareerPreferencesRaw(portalClientForPrefs, candidate.id);
    mergeCareerPreferencesIntoCandidate(candidate, careerPrefs);

    return buildCandidateResponse(candidate);
  },

  async create(data, createdByUserId) {
    const candidateData = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      linkedIn: data.linkedIn,
      resume: data.resume,
      skills: data.skills || [],
      experience: data.experience,
      currentTitle: data.currentTitle,
      currentCompany: data.currentCompany,
      location: data.location,
      status: data.status || 'NEW',
      source: data.source,
      assignedToId: data.assignedToId,
      rating: data.rating,
      noticePeriod: data.noticePeriod,
      hotlist: data.hotlist || false,
      salary: data.salary,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      gender: data.gender,
      address: data.address,
      city: data.city,
      state: data.state,
      zipCode: data.zipCode,
      country: data.country,
      workAuthorization: data.workAuthorization,
      availability: data.availability,
      expectedSalary: data.expectedSalary,
      currentSalary: data.currentSalary,
      education: data.education,
      certifications: data.certifications || [],
      languages: data.languages || [],
      portfolio: data.portfolio,
      github: data.github,
      website: data.website,
      notes: data.notes,
      tags: data.tags || [],
      preferredLocation: data.preferredLocation,
      willingToRelocate: data.willingToRelocate || false,
      remoteWorkPreference: data.remoteWorkPreference,
      createdById: createdByUserId || undefined,
    };

    // Log data being stored
    dbLogger.logCreate('CANDIDATE', candidateData);

    const candidate = await prisma.candidate.create({
      data: candidateData,
    });

    console.log(`✅ Candidate created successfully with ID: ${candidate.id}\n`);

    return candidate;
  },

  async update(id, data) {
    // Whitelist of fields that exist on the Candidate Prisma model. Anything not
    // in this list (e.g. legacy `tags`, `dateOfBirth`, `workAuthorization`,
    // `state`, `zipCode`, `github`, `gender`, `willingToRelocate`,
    // `remoteWorkPreference`) is intentionally ignored — including those keys
    // even with `undefined` values can cause Prisma "Unknown argument" errors,
    // and silently mapping them would also corrupt valid saves.
    const ALLOWED_FIELDS = [
      'firstName',
      'lastName',
      'email',
      'phone',
      'linkedIn',
      'resume',
      'resumeUrl',
      'skills',
      'recruiterSkills',
      'currentTitle',
      'currentCompany',
      'designation',
      'location',
      'address',
      'addressLine',
      'city',
      'country',
      'status',
      'recruiterStatus',
      'source',
      'assignedToId',
      'rating',
      'availability',
      'noticePeriod',
      'hotlist',
      'avatar',
      'education',
      'recruiterEducation',
      'certifications',
      'certificationsList',
      'languages',
      'recruiterLanguages',
      'portfolio',
      'website',
      'notes',
      'recruiterNotes',
      'cvSummary',
      'cvEducationEntries',
      'cvWorkExperienceEntries',
      'cvPortfolioLinks',
      'preferredLocation',
      'assignedJobs',
      'stage',
      'salary',
      'extraData',
    ];
    const INTEGER_FIELDS = new Set([
      'experience',
      'experienceYears',
      'expectedSalary',
      'currentSalary',
    ]);

    const updateData = {};
    for (const key of ALLOWED_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(data || {}, key)) {
        updateData[key] = data[key];
      }
    }

    for (const key of INTEGER_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(data || {}, key)) continue;
      const raw = data[key];
      if (raw === null || raw === '' || raw === undefined) {
        updateData[key] = null;
        continue;
      }
      const parsed = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10);
      updateData[key] = Number.isFinite(parsed) ? parsed : null;
    }

    if (Object.prototype.hasOwnProperty.call(data || {}, 'lastActivity')) {
      updateData.lastActivity = data.lastActivity ? new Date(data.lastActivity) : null;
    }

    if (Object.prototype.hasOwnProperty.call(data || {}, 'assignedJobs')) {
      const existingRow = await prisma.candidate.findUnique({
        where: { id },
        select: { assignedJobs: true, stage: true },
      });
      if (existingRow) {
        const prevIds = new Set(
          (Array.isArray(existingRow.assignedJobs) ? existingRow.assignedJobs : []).map((jid) =>
            String(jid || '').trim(),
          ),
        );
        const nextIds = (Array.isArray(data.assignedJobs) ? data.assignedJobs : [])
          .map((jid) => String(jid || '').trim())
          .filter(Boolean);
        const addedJob = nextIds.some((jid) => !prevIds.has(jid));
        if (addedJob && !Object.prototype.hasOwnProperty.call(updateData, 'stage')) {
          updateData.stage = stageWhenLinkingToJob(existingRow.stage);
          if (!Object.prototype.hasOwnProperty.call(updateData, 'status')) {
            updateData.status = 'ACTIVE';
          }
        }
      }
    }

    dbLogger.logUpdate('CANDIDATE', id, updateData);

    // The candidate may live in the main tenant DB (recruiter-created) OR in
    // the per-tenant job-portal DB (self-registered via the public portal).
    // We update wherever the row actually exists so saves never fail with
    // "Record to update not found" on hybrid candidates.
    const writeOnClient = async (client) => {
      try {
        return await client.candidate.update({
          where: { id },
          data: updateData,
        });
      } catch (error) {
        if (error?.code === 'P2025') return null;
        throw error;
      }
    };

    let updated = await writeOnClient(prisma);

    if (!updated && isTenantScopedRequest()) {
      let portalPrisma = null;
      try { portalPrisma = getJobPortalPrismaClient(); } catch { portalPrisma = null; }
      if (portalPrisma) {
        updated = await writeOnClient(portalPrisma);
      }
    }

    if (!updated) {
      const err = new Error('Candidate not found');
      err.code = 'P2025';
      throw err;
    }

    console.log(`✅ Candidate updated successfully (ID: ${id})\n`);

    return updated;
  },

  async delete(id, performedById = null) {
    // Soft delete — keeps related rows (interviews, placements, pipeline entries, applications)
    // intact so the Recycle Bin restore brings the full candidate back.
    //
    // The Candidates page merges tenant + job-portal candidates. A row that only lives in the
    // portal DB has no tenant document to flip `isDeleted` on, so we must materialize it into
    // the tenant first; otherwise the soft-delete silently no-ops, the row keeps re-appearing
    // from the portal merge, and the Recycle Bin stays empty.
    const tenantRow = await prisma.candidate.findUnique({
      where: { id },
      select: { id: true, isDeleted: true, deletedAt: true },
    });

    if (tenantRow?.isDeleted === true) {
      if (tenantRow.deletedAt) {
        // Already in the Recycle Bin — make this idempotent so the UI still sees success.
        return { message: 'Candidate already in Recycle Bin' };
      }
      // Tombstone left behind by a previous purge — re-stamp delete metadata so it shows
      // up in the Recycle Bin again instead of staying invisibly tombstoned forever.
      const tombstoneRow = await prisma.candidate.findUnique({
        where: { id },
        select: { email: true, extraData: true },
      });
      const tombstoneExtra =
        tombstoneRow?.extraData &&
        typeof tombstoneRow.extraData === 'object' &&
        !Array.isArray(tombstoneRow.extraData)
          ? tombstoneRow.extraData
          : {};
      await prisma.candidate.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          deletedBy: performedById || null,
          email: null,
          extraData: {
            ...tombstoneExtra,
            ...(tombstoneRow?.email
              ? { preRecycleBinEmail: String(tombstoneRow.email).trim() }
              : {}),
          },
        },
      });
      return { message: 'Candidate moved to Recycle Bin' };
    }

    if (!tenantRow) {
      // Portal-only candidate — bring it into the tenant DB so the tombstone is persisted.
      if (!isTenantScopedRequest()) {
        throw new Error('Candidate not found');
      }
      let portalPrisma = null;
      try {
        portalPrisma = getJobPortalPrismaClient();
      } catch {
        portalPrisma = null;
      }
      const portalRow = portalPrisma
        ? await portalPrisma.candidate.findUnique({ where: { id } })
        : null;
      if (!portalRow) {
        throw new Error('Candidate not found');
      }
      await materializePortalCandidateIntoTenant(portalRow);
    }

    const rowBeforeDelete = await prisma.candidate.findUnique({
      where: { id },
      select: { email: true, extraData: true },
    });

    const priorExtra =
      rowBeforeDelete?.extraData &&
      typeof rowBeforeDelete.extraData === 'object' &&
      !Array.isArray(rowBeforeDelete.extraData)
        ? rowBeforeDelete.extraData
        : {};

    await prisma.candidate.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: performedById || null,
        // Free the email for bulk CV re-import after the user clears the Candidates page.
        email: null,
        extraData: {
          ...priorExtra,
          ...(rowBeforeDelete?.email
            ? { preRecycleBinEmail: String(rowBeforeDelete.email).trim() }
            : {}),
        },
      },
    });
    return { message: 'Candidate moved to Recycle Bin' };
  },

  /**
   * Recycle Bin — list soft-deleted candidates (newest first). Scope:
   * - admins / view_all_candidates: all deleted
   * - everyone else: deleted candidates they created, are assigned to, or deleted themselves
   *
   * Purged candidates keep `isDeleted=true` as a tombstone (so the portal merge never
   * resurrects them on the Candidates page) but clear `deletedAt`, so we exclude rows
   * with `deletedAt: null` to keep the Recycle Bin showing only currently-restorable
   * candidates.
   */
  async listTrash(req) {
    const page = Math.max(Number.parseInt(String(req.query?.page ?? '1'), 10) || 1, 1);
    const limit = Math.min(
      Math.max(Number.parseInt(String(req.query?.limit ?? '50'), 10) || 50, 1),
      500
    );
    const skip = (page - 1) * limit;

    const andParts = [{ isDeleted: true, deletedAt: { not: null } }];
    const canViewAll =
      canViewAllAssignments(req) || hasAnyPermissionScope(req, ['view_all_candidates']);
    if (!canViewAll && req?.user?.id) {
      andParts.push({
        OR: [
          { createdById: req.user.id },
          { assignedToId: req.user.id },
          { deletedBy: req.user.id },
        ],
      });
    }
    const where = { AND: andParts };

    const [candidates, total] = await Promise.all([
      prisma.candidate.findMany({
        where,
        skip,
        take: limit,
        orderBy: { deletedAt: 'desc' },
        include: candidateListInclude,
      }),
      prisma.candidate.count({ where }),
    ]);
    return formatPaginationResponse(candidates, page, limit, total);
  },

  /** Recycle Bin — restore a soft-deleted candidate. */
  async restore(id /*, performedById */) {
    const candidate = await prisma.candidate.findFirst({
      where: { id, isDeleted: true },
      select: { id: true },
    });
    if (!candidate) {
      throw new Error('Deleted candidate not found');
    }
    const trashRow = await prisma.candidate.findUnique({
      where: { id },
      select: { email: true, extraData: true },
    });
    const trashExtra =
      trashRow?.extraData &&
      typeof trashRow.extraData === 'object' &&
      !Array.isArray(trashRow.extraData)
        ? trashRow.extraData
        : {};
    const restoredEmail =
      String(trashRow?.email || '').trim() ||
      String(trashExtra.preRecycleBinEmail || '').trim() ||
      null;

    await prisma.candidate.update({
      where: { id },
      data: {
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
        ...(restoredEmail ? { email: restoredEmail } : {}),
        extraData: (() => {
          const { preRecycleBinEmail: _removed, ...rest } = trashExtra;
          return Object.keys(rest).length ? rest : undefined;
        })(),
      },
    });
    return { message: 'Candidate restored' };
  },

  /**
   * Recycle Bin — permanently delete a soft-deleted candidate.
   * Removes the tenant row, deletes S3 resume/assets, and records PurgedCandidateRef
   * so portal merge and bulk CV duplicate checks ignore this id.
   */
  /**
   * Bulk permanent-delete (Recycle Bin → Delete forever). Iterates over the supplied
   * ids and delegates to `purge` so PII wipe + tombstone logic stays consistent. We
   * intentionally process sequentially: each purge runs its own Prisma transaction
   * and Mongo doesn't love a flurry of overlapping transactions in the same tenant
   * DB. Returns per-id success/failure so the UI can show "deleted X of Y".
   */
  async bulkPurge(ids) {
    const unique = Array.from(new Set((ids || []).map((id) => String(id || '').trim()).filter(Boolean)));
    if (!unique.length) {
      return { success: 0, failed: 0, failures: [] };
    }
    let success = 0;
    const failures = [];
    for (const candidateId of unique) {
      try {
        await this.purge(candidateId);
        success += 1;
      } catch (err) {
        failures.push({ id: candidateId, message: err?.message || 'Failed to purge candidate' });
      }
    }
    return { success, failed: failures.length, failures };
  },

  async purge(id) {
    const candidate = await prisma.candidate.findFirst({
      where: { id, isDeleted: true },
      select: { id: true },
    });
    if (!candidate) {
      throw new Error('Deleted candidate not found');
    }

    await permanentDeleteCandidateById(id);
    return { message: 'Candidate permanently deleted' };
  },

  async addNote(candidateId, data, userId) {
    const candidate = await getCandidateOrThrow(candidateId);
    const text = String(data?.text || '').trim();
    const tags = Array.isArray(data?.tags) ? data.tags.filter(Boolean) : [];

    if (!text) {
      throw new Error('Note text is required');
    }

    const activity = await prisma.activity.create({
      data: {
        action: 'Internal note added',
        description: text,
        performedById: userId,
        entityType: CANDIDATE_ACTIVITY_ENTITY,
        entityId: candidateId,
        category: 'Notes',
        relatedType: 'candidate',
        relatedId: candidateId,
        relatedLabel: `${candidate.firstName} ${candidate.lastName}`.trim() || candidate.email,
        metadata: {
          kind: NOTE_ACTIVITY_KIND,
          text,
          tags,
          isPinned: false,
        },
      },
      include: {
        performedBy: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });

    return mapActivityToNote(activity);
  },

  async updateNote(candidateId, noteId, data) {
    await getCandidateOrThrow(candidateId);

    const note = await prisma.activity.findUnique({
      where: { id: noteId },
    });

    if (!note || note.entityId !== candidateId || getActivityMetadata(note).kind !== NOTE_ACTIVITY_KIND) {
      throw new Error('Candidate note not found');
    }

    const text = String(data?.text || '').trim();
    if (!text) {
      throw new Error('Note text is required');
    }

    const existingMetadata = getActivityMetadata(note);
    const updated = await prisma.activity.update({
      where: { id: noteId },
      data: {
        description: text,
        metadata: {
          ...existingMetadata,
          text,
          tags: Array.isArray(data?.tags) ? data.tags.filter(Boolean) : existingMetadata.tags || [],
        },
      },
      include: {
        performedBy: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });

    return mapActivityToNote(updated);
  },

  async deleteNote(candidateId, noteId) {
    await getCandidateOrThrow(candidateId);

    const note = await prisma.activity.findUnique({
      where: { id: noteId },
    });

    if (!note || note.entityId !== candidateId || getActivityMetadata(note).kind !== NOTE_ACTIVITY_KIND) {
      throw new Error('Candidate note not found');
    }

    await prisma.activity.delete({ where: { id: noteId } });
    return { message: 'Candidate note deleted successfully' };
  },

  async pinNote(candidateId, noteId, isPinned) {
    await getCandidateOrThrow(candidateId);

    const note = await prisma.activity.findUnique({
      where: { id: noteId },
    });

    if (!note || note.entityId !== candidateId || getActivityMetadata(note).kind !== NOTE_ACTIVITY_KIND) {
      throw new Error('Candidate note not found');
    }

    const existingMetadata = getActivityMetadata(note);
    const updated = await prisma.activity.update({
      where: { id: noteId },
      data: {
        metadata: {
          ...existingMetadata,
          isPinned: Boolean(isPinned),
        },
      },
      include: {
        performedBy: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });

    return mapActivityToNote(updated);
  },

  async addTag(candidateId, data, userId) {
    const candidate = await getCandidateOrThrow(candidateId);
    const tag = buildTagRecord(data?.tag || data);

    if (!tag) {
      throw new Error('Tag label is required');
    }

    await prisma.activity.create({
      data: {
        action: 'Candidate tag added',
        description: `Tag "${tag.label}" added to candidate.`,
        performedById: userId,
        entityType: CANDIDATE_ACTIVITY_ENTITY,
        entityId: candidateId,
        category: 'Candidates',
        relatedType: 'candidate',
        relatedId: candidateId,
        relatedLabel: `${candidate.firstName} ${candidate.lastName}`.trim() || candidate.email,
        metadata: {
          kind: TAG_ACTIVITY_KIND,
          operation: 'add',
          tag,
        },
      },
    });

    return tag;
  },

  async removeTag(candidateId, tagId, userId) {
    const candidate = await getCandidateOrThrow(candidateId);
    const activities = await getCandidateActivities(candidateId);
    const tags = extractCustomTags(activities);
    const matchedTag = tags.find(
      (tag) => tag.id === tagId || normalizeTagId(tag.label) === tagId || tag.label.toLowerCase() === String(tagId).toLowerCase()
    );

    if (!matchedTag) {
      throw new Error('Candidate tag not found');
    }

    await prisma.activity.create({
      data: {
        action: 'Candidate tag removed',
        description: `Tag "${matchedTag.label}" removed from candidate.`,
        performedById: userId,
        entityType: CANDIDATE_ACTIVITY_ENTITY,
        entityId: candidateId,
        category: 'Candidates',
        relatedType: 'candidate',
        relatedId: candidateId,
        relatedLabel: `${candidate.firstName} ${candidate.lastName}`.trim() || candidate.email,
        metadata: {
          kind: TAG_ACTIVITY_KIND,
          operation: 'remove',
          tag: matchedTag,
        },
      },
    });

    return { message: 'Candidate tag removed successfully' };
  },

  async addToPipeline(candidateId, data, userId) {
    const candidate = await getCandidateOrThrow(candidateId);
    const jobId = String(data?.jobId || '').trim();
    const rawStageName = String(data?.stage || '').trim();

    if (!jobId) {
      throw new Error('Job is required');
    }

    if (!rawStageName) {
      throw new Error('Pipeline stage is required');
    }

    const normalizedStage = rawStageName.toLowerCase();
    // Keep UI tags consistent across modules:
    // - offer/offered -> Offer
    // - joined/hired -> Hired
    const stageName =
      normalizedStage === 'offer' || normalizedStage === 'offered'
        ? 'Offer'
        : normalizedStage === 'joined' || normalizedStage === 'hired'
          ? 'Hired'
          : rawStageName;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        pipelineStages: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!job) {
      throw new Error('Job not found');
    }

    const existingStage = job.pipelineStages.find(
      (stage) => stage.name.toLowerCase() === stageName.toLowerCase()
    );

    const updatedAssignedJobs = Array.from(new Set([...(candidate.assignedJobs || []), jobId]));

    const pipelineNotes = String(data?.notes || '').trim() || null;

    const hadPipelineEntry = await prisma.pipelineEntry.findFirst({
      where: { candidateId, jobId },
      select: { id: true },
    });

    const activityPayload = {
      action: hadPipelineEntry ? 'Pipeline entry updated' : 'Candidate added to pipeline',
      description: hadPipelineEntry
        ? `${candidate.firstName} ${candidate.lastName}`.trim()
          ? `${candidate.firstName} ${candidate.lastName} moved to ${stageName} on ${job.title}.`
          : `Candidate moved to ${stageName} on ${job.title}.`
        : `${candidate.firstName} ${candidate.lastName}`.trim()
        ? `${candidate.firstName} ${candidate.lastName} added to ${job.title} at ${stageName} stage.`
        : `Candidate added to ${job.title} at ${stageName} stage.`,
      performedById: userId,
      entityType: CANDIDATE_ACTIVITY_ENTITY,
      entityId: candidateId,
      category: 'Candidates',
      relatedType: 'job',
      relatedId: job.id,
      relatedLabel: job.title,
      metadata: {
        kind: PIPELINE_ACTIVITY_KIND,
        jobId: job.id,
        relatedJobTitle: job.title,
        recruiterId: data?.recruiterId || null,
        priority: data?.priority || 'Medium',
        stage: stageName,
        notes: pipelineNotes,
      },
    };

    let targetStage = existingStage;

    if (!targetStage) {
      const nextOrder =
        job.pipelineStages.length > 0
          ? Math.max(...job.pipelineStages.map((stage) => stage.order || 0)) + 1
          : 1;

      targetStage = await prisma.pipelineStage.create({
        data: {
          jobId,
          name: stageName,
          order: nextOrder,
          color: '#2563eb',
        },
      });
    }

    await prisma.pipelineEntry.deleteMany({
      where: {
        candidateId,
        jobId,
      },
    });

    await prisma.pipelineEntry.create({
      data: {
        candidateId,
        jobId,
        stageId: targetStage.id,
        movedById: userId,
        notes: pipelineNotes,
      },
    });

    const existingMatch = await prisma.match.findFirst({
      where: {
        candidateId,
        jobId,
      },
    });

    if (existingMatch) {
      await prisma.match.update({
        where: { id: existingMatch.id },
        data: {
          status: mapStageToMatchStatus(stageName),
          notes: pipelineNotes || existingMatch.notes || null,
        },
      });
    } else {
      await prisma.match.create({
        data: {
          candidateId,
          jobId,
          createdById: userId,
          score: 75,
          status: mapStageToMatchStatus(stageName),
          notes: pipelineNotes,
        },
      });
    }

    const priorStage = String(candidate.stage || '').trim().toLowerCase();
    const crmStage =
      stageName ||
      ((!priorStage || priorStage === 'new') && updatedAssignedJobs.length
        ? 'Applied'
        : stageWhenLinkingToJob(candidate.stage));

    await prisma.candidate.update({
      where: { id: candidateId },
      data: {
        stage: crmStage,
        assignedToId: data?.recruiterId || candidate.assignedToId || undefined,
        assignedJobs: updatedAssignedJobs,
        lastActivity: new Date(),
        status: 'ACTIVE',
      },
    });

    await prisma.activity.create({
      data: activityPayload,
    });

    // Bucket the (possibly custom) stage name into a canonical PIPELINE_STAGES value
    // and mirror to the job-portal Application + ApplicationTimeline. Without this the
    // candidate keeps showing the previous tag (e.g. "Interviewing") in other tabs and
    // /applications even though the recruiter moved them to "Offer" in the custom
    // per-job pipeline.
    try {
      await updateCandidateStage({
        candidateId,
        jobId,
        stage: mapStageNameToPipelineBucket(stageName),
        performedById: userId,
        skipStageActivity: true,
        metadata: {
          customStageName: stageName,
          pipelineNotes,
        },
      });
    } catch (stageError) {
      console.warn(
        '[candidate.addToPipeline] candidate stage sync failed:',
        stageError?.message || stageError,
      );
    }

    return this.getById(candidateId);
  },

  async removeFromPipeline(candidateId, jobId, userId) {
    const candidate = await getCandidateOrThrow(candidateId);
    const normalizedJobId = String(jobId || '').trim();
    if (!normalizedJobId) {
      throw new Error('Job is required');
    }

    const job = await prisma.job.findUnique({
      where: { id: normalizedJobId },
      select: { id: true, title: true },
    });
    if (!job) {
      throw new Error('Job not found');
    }

    const deleted = await prisma.pipelineEntry.deleteMany({
      where: { candidateId, jobId: normalizedJobId },
    });

    if (!deleted.count) {
      throw new Error('Pipeline entry not found for this job');
    }

    const updatedAssignedJobs = (candidate.assignedJobs || []).filter(
      (id) => String(id) !== normalizedJobId
    );

    await prisma.candidate.update({
      where: { id: candidateId },
      data: {
        assignedJobs: updatedAssignedJobs,
        lastActivity: new Date(),
      },
    });

    await prisma.activity.create({
      data: {
        action: 'Removed from pipeline',
        description: `${candidate.firstName} ${candidate.lastName}`.trim()
          ? `${candidate.firstName} ${candidate.lastName} removed from ${job.title} pipeline.`
          : `Candidate removed from ${job.title} pipeline.`,
        performedById: userId,
        entityType: CANDIDATE_ACTIVITY_ENTITY,
        entityId: candidateId,
        category: 'Candidates',
        relatedType: 'job',
        relatedId: job.id,
        relatedLabel: job.title,
        metadata: {
          kind: PIPELINE_ACTIVITY_KIND,
          jobId: job.id,
          relatedJobTitle: job.title,
        },
      },
    });

    return this.getById(candidateId);
  },

  async rejectCandidate(candidateId, data, userId) {
    const candidate = await getCandidateOrThrow(candidateId);
    const reason = String(data?.reason || '').trim();
    const feedback = String(data?.feedback || '').trim();
    // Default to true so callers that don't pass the flag (older clients,
    // bulk operations) keep the existing "feedback visible to candidate"
    // behaviour. New rejection modals send this explicitly.
    const showFeedbackToCandidate =
      data?.showFeedbackToCandidate === undefined
        ? true
        : Boolean(data.showFeedbackToCandidate);

    if (!reason) {
      throw new Error('Reject reason is required');
    }

    const jobId = await resolveJobIdForStageSync(candidateId, data);

    await updateCandidateStage({
      candidateId,
      jobId,
      stage: PIPELINE_STAGES.REJECTED,
      reason,
      feedback,
      performedById: userId,
      skipStageActivity: true,
      showFeedbackToCandidate,
    });

    // Sweep ALL of the candidate's other in-progress portal applications and
    // flip them to REJECTED too. This is what the recruiter means when they
    // press "Reject" without picking a specific job (Candidates tab) — the
    // candidate is no longer in consideration on any open requisition. It also
    // remediates older applications whose `Application.status` enum is stale
    // because an earlier reject ran without `jobId`. The per-job reject above
    // already covered `jobId`; here we cover every other open one.
    try {
      const portal = getJobPortalPrismaClient();
      const otherOpen = await portal.application.findMany({
        where: {
          candidateId,
          status: { notIn: ['REJECTED', 'SELECTED'] },
          ...(jobId ? { NOT: { jobId } } : {}),
        },
        select: { id: true, jobId: true },
      });
      for (const app of otherOpen) {
        try {
          await updateCandidateStage({
            candidateId,
            jobId: app.jobId,
            stage: PIPELINE_STAGES.REJECTED,
            reason,
            feedback,
            performedById: userId,
            skipStageActivity: true,
            showFeedbackToCandidate,
          });
        } catch (perAppErr) {
          console.warn(
            '[candidate.rejectCandidate] secondary application reject failed:',
            { applicationId: app.id, jobId: app.jobId },
            perAppErr?.message || perAppErr
          );
        }
      }
    } catch (sweepErr) {
      console.warn(
        '[candidate.rejectCandidate] open-applications sweep failed:',
        sweepErr?.message || sweepErr
      );
    }

    await prisma.activity.create({
      data: {
        action: 'Candidate rejected',
        description: `${candidate.firstName} ${candidate.lastName}`.trim()
          ? `${candidate.firstName} ${candidate.lastName} was rejected due to ${reason.toLowerCase()}.`
          : `Candidate was rejected due to ${reason.toLowerCase()}.`,
        performedById: userId,
        entityType: CANDIDATE_ACTIVITY_ENTITY,
        entityId: candidateId,
        category: 'Candidates',
        relatedType: 'candidate',
        relatedId: candidateId,
        relatedLabel: `${candidate.firstName} ${candidate.lastName}`.trim() || candidate.email,
        metadata: {
          kind: REJECTION_ACTIVITY_KIND,
          reason,
          feedback,
          sendEmail: Boolean(data?.sendEmail),
          showFeedbackToCandidate,
        },
      },
    });

    if (feedback) {
      await prisma.activity.create({
        data: {
          action: 'Internal note added',
          description: feedback,
          performedById: userId,
          entityType: CANDIDATE_ACTIVITY_ENTITY,
          entityId: candidateId,
          category: 'Notes',
          relatedType: 'candidate',
          relatedId: candidateId,
          relatedLabel: `${candidate.firstName} ${candidate.lastName}`.trim() || candidate.email,
          metadata: {
            kind: NOTE_ACTIVITY_KIND,
            text: `${feedback}${data?.sendEmail ? '\n\nRejection email will be sent to the candidate.' : '\n\nRejection email was skipped.'}`,
            tags: ['Rejected', reason],
            isPinned: true,
          },
        },
      });
    }

    // CRM bell + portal bell notifications. Best-effort.
    try {
      const candidateName = `${candidate.firstName || ''} ${candidate.lastName || ''}`
        .trim() ||
        candidate.email ||
        'Candidate';
      if (userId) {
        await createUserNotification(userId, {
          category: 'CANDIDATE',
          title: 'Candidate rejected',
          description: `${candidateName} was rejected (${reason}).`,
          actionLabel: 'View candidate',
          actionPath: `/candidate?candidateId=${candidateId}`,
          entityType: 'CANDIDATE',
          entityId: candidateId,
          metadata: { reason, jobId: jobId || null },
        });
      }
      void pushPortalNotification(candidateId, {
        type: 'application',
        title: 'Application update',
        description: showFeedbackToCandidate && feedback
          ? `Your application was not selected. Feedback: ${feedback}`
          : 'Your application was not selected this time.',
        actionButton: 'View applications',
        actionPath: '/applications',
        metadata: {
          status: 'REJECTED',
          jobId: jobId || null,
          reason,
          showFeedbackToCandidate,
          feedback: showFeedbackToCandidate ? feedback : null,
        },
      });
    } catch (bellErr) {
      console.warn(
        '[candidate.rejectCandidate] notification failed (non-fatal):',
        bellErr?.message || bellErr
      );
    }

    return this.getById(candidateId);
  },

  async scheduleInterview(candidateId, data, userId) {
    const candidate = await getCandidateOrThrow(candidateId);
    const jobId = String(data?.jobId || candidate.assignedJobs?.[0] || '').trim();

    if (!jobId) {
      throw new Error('Linked job is required to schedule an interview');
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        title: true,
        clientId: true,
      },
    });

    if (!job) {
      throw new Error('Job not found');
    }

    const interviewers = Array.isArray(data?.interviewers) ? data.interviewers.filter(Boolean) : [];
    if (!interviewers.length) {
      throw new Error('Select at least one interviewer');
    }
    const panelMembers = await prisma.user.findMany({
      where: { id: { in: interviewers.map((item) => item.id).filter(Boolean) } },
      select: { id: true, name: true, email: true },
    });

    const leadInterviewer =
      interviewers.find((item) => item.role === 'Lead Interviewer') || interviewers[0];
    const scheduledAt = buildScheduledAt(data?.date, data?.time);
    const notes = String(data?.notes || '').trim();
    let generatedMeetingLink = data?.mode === 'video' ? String(data?.meetingLink || '').trim() || null : null;
    const resolvedPlatform = mapMeetingPlatform(data?.platform, data?.mode);

    if (String(data?.mode || '').toLowerCase() === 'video' && resolvedPlatform && !generatedMeetingLink) {
      const generated = await generateCandidateMeetingLink({ candidate, job, data, interviewers, userId });
      if (!generated.meetingLink) {
        throw new Error(generated.error || 'Unable to generate meeting link');
      }
      generatedMeetingLink = generated.meetingLink;
    }

    const client = await prisma.client.findUnique({
      where: { id: job.clientId },
      select: { companyName: true },
    });

    const interview = await prisma.$transaction(async (tx) => {
      const createdInterview = await tx.interview.create({
        data: {
          candidateId,
          jobId,
          clientId: job.clientId,
          interviewerId: leadInterviewer?.id || null,
          createdById: userId,
          scheduledAt,
          duration: parseDurationToMinutes(data?.duration),
          type: mapInterviewType(data?.type, data?.mode),
          status: 'SCHEDULED',
          location: data?.mode === 'in-person' ? String(data?.location || '').trim() || null : null,
          meetingLink: generatedMeetingLink,
          notes: notes || null,
          // In our UI, "Interview Type" is the human-friendly label (HR Screening, Technical Round 1, etc.).
          // Persist that label in `round` so the Candidate drawer can display it cleanly.
          round: String(data?.type || data?.round || 1),
          mode: mapInterviewMode(data?.mode),
          platform: resolvedPlatform,
          timezone: String(data?.timezone || '').trim() || null,
          instructions: data?.mode === 'phone' ? String(data?.phoneNumber || '').trim() || null : null,
          panelIds: interviewers.map((item) => item.id).filter(Boolean),
        },
        include: {
          interviewer: {
            select: { id: true, name: true, email: true, avatar: true, role: true, department: true },
          },
          job: {
            select: { id: true, title: true },
          },
        },
      });

      if (interviewers.length) {
        await tx.interviewPanel.createMany({
          data: interviewers.map((item) => ({
            interviewId: createdInterview.id,
            userId: item.id,
            // Candidate drawer uses roles like "Lead Interviewer/Interviewer/Observer".
            // Interview module expects PanelRole enum; default to TECHNICAL.
            role: 'TECHNICAL',
          })),
        });
      }

      await tx.activity.create({
        data: {
          action: 'Interview scheduled',
          description: `${data?.type || 'Interview'} on ${String(data?.date || '')} at ${String(data?.time || '')}`,
          performedById: userId,
          entityType: CANDIDATE_ACTIVITY_ENTITY,
          entityId: candidateId,
          category: 'Interviews',
          relatedType: 'job',
          relatedId: job.id,
          relatedLabel: job.title,
          metadata: {
            kind: INTERVIEW_ACTIVITY_KIND,
            interviewId: createdInterview.id,
            relatedJobTitle: job.title,
            date: data?.date,
            time: data?.time,
            duration: data?.duration,
            mode: data?.mode,
            type: data?.type,
            round: data?.round,
            sendCandidateInvite: Boolean(data?.sendCandidateInvite),
            sendInterviewerInvite: Boolean(data?.sendInterviewerInvite),
          },
        },
      });

      return createdInterview;
    });

    if (Boolean(data?.sendCandidateInvite) && candidate.email) {
      await sendCandidateInterviewScheduledEmail({
        toEmail: candidate.email,
        candidateName: `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || candidate.email,
        jobTitle: job.title,
        companyName: client?.companyName || 'Company',
        scheduledAt,
        timezone: String(data?.timezone || 'Asia/Kolkata').trim() || 'Asia/Kolkata',
        interviewType: String(data?.type || '').trim() || null,
        roundLabel: String(data?.round || '').trim() || null,
        durationLabel: String(data?.duration || '').trim() || null,
        modeLabel:
          String(data?.mode || '').toLowerCase() === 'video'
            ? 'Video Call'
            : String(data?.mode || '').toLowerCase() === 'in-person'
              ? 'In Person'
              : String(data?.mode || '').toLowerCase() === 'phone'
                ? 'Phone Call'
                : 'Interview',
        platformLabel:
          resolvedPlatform === 'GOOGLE_MEET'
            ? 'Google Meet'
            : resolvedPlatform === 'ZOOM'
              ? 'Zoom'
              : null,
        meetingLink: generatedMeetingLink,
        location: data?.mode === 'in-person' ? String(data?.location || '').trim() || null : null,
        phoneNumber: data?.mode === 'phone' ? String(data?.phoneNumber || '').trim() || null : null,
        interviewerNames: interviewers.map((item) => item.name).filter(Boolean),
        notes: notes || null,
        senderUserId: userId,
      });
    }

    if (Boolean(data?.sendInterviewerInvite) && panelMembers.length) {
      const candidateName = `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || candidate.email;
      for (const panelMember of panelMembers) {
        if (!panelMember.email) continue;
        await sendInterviewPanelScheduledEmail({
          toEmail: panelMember.email,
          recipientName: panelMember.name,
          candidateName,
          jobTitle: job.title,
          companyName: client?.companyName || 'Company',
          scheduledAt,
          timezone: String(data?.timezone || 'Asia/Kolkata').trim() || 'Asia/Kolkata',
          interviewType: String(data?.type || '').trim() || null,
          roundLabel: String(data?.round || '').trim() || null,
          durationLabel: String(data?.duration || '').trim() || null,
          modeLabel:
            String(data?.mode || '').toLowerCase() === 'video'
              ? 'Video Call'
              : String(data?.mode || '').toLowerCase() === 'in-person'
                ? 'In Person'
                : String(data?.mode || '').toLowerCase() === 'phone'
                  ? 'Phone Call'
                  : 'Interview',
          platformLabel:
            resolvedPlatform === 'GOOGLE_MEET'
              ? 'Google Meet'
              : resolvedPlatform === 'ZOOM'
                ? 'Zoom'
                : null,
          meetingLink: generatedMeetingLink,
          location: data?.mode === 'in-person' ? String(data?.location || '').trim() || null : null,
          phoneNumber: data?.mode === 'phone' ? String(data?.phoneNumber || '').trim() || null : null,
          interviewerNames: panelMembers.map((item) => item.name).filter(Boolean),
          notes: notes || null,
          senderUserId: userId,
        });
      }
    }

    const locationLine =
      String(data?.mode || '').toLowerCase() === 'in-person' ? String(data?.location || '').trim() || null : null;

    // Names shown to the candidate on the job portal interview card.
    const interviewerNames = [
      ...interviewers.map((item) => item.name).filter(Boolean),
      ...panelMembers.map((item) => item.name).filter(Boolean),
    ];
    const dedupedInterviewerNames = Array.from(new Set(interviewerNames.map((n) => String(n).trim()).filter(Boolean)));
    const scheduler = userId
      ? await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, email: true },
        }).catch(() => null)
      : null;
    const schedulerLabel = scheduler?.name || scheduler?.email || null;

    await updateCandidateStage({
      candidateId,
      jobId,
      stage: PIPELINE_STAGES.INTERVIEW,
      metadata: {
        scheduledAt: interview.scheduledAt,
        interviewTitle: String(data?.type || '').trim() || null,
        meetingLink: generatedMeetingLink,
        locationLine,
        mode: String(data?.mode || '').trim() || null,
        interviewerNames: dedupedInterviewerNames,
        recruiterName: schedulerLabel,
      },
      performedById: userId,
      skipStageActivity: true,
    });

    return interview;
  },

  async generateInterviewMeetingLink(candidateId, data, userId) {
    const candidate = await getCandidateOrThrow(candidateId);
    const jobId = String(data?.jobId || candidate.assignedJobs?.[0] || '').trim();

    if (!jobId) {
      throw new Error('Linked job is required to generate a meeting link');
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, title: true, clientId: true },
    });

    if (!job) {
      throw new Error('Job not found');
    }

    const interviewers = Array.isArray(data?.interviewers) ? data.interviewers.filter(Boolean) : [];
    const result = await generateCandidateMeetingLink({ candidate, job, data, interviewers, userId });

    if (!result.meetingLink) {
      throw new Error(result.error || 'Unable to generate meeting link');
    }

    return {
      meetingLink: result.meetingLink,
      platform: result.platform,
    };
  },

  async updateInterview(candidateId, interviewId, data, userId) {
    await getCandidateOrThrow(candidateId);

    const existing = await prisma.interview.findUnique({
      where: { id: interviewId },
      select: { id: true, candidateId: true, jobId: true, clientId: true, createdById: true },
    });

    if (!existing || existing.candidateId !== candidateId) {
      throw new Error('Interview not found for this candidate');
    }

    // Status mapping from UI
    const statusRaw = String(data?.status || '').toLowerCase();
    const nextStatus =
      statusRaw === 'completed'
        ? 'COMPLETED'
        : statusRaw === 'cancelled'
          ? 'CANCELLED'
          : statusRaw === 'scheduled'
            ? 'SCHEDULED'
            : undefined;

    const scheduledAt =
      data?.date && data?.time ? buildScheduledAt(data?.date, data?.time) : undefined;

    const interviewers = Array.isArray(data?.interviewers) ? data.interviewers.filter(Boolean) : [];
    const leadInterviewer =
      interviewers.find((item) => item.role === 'Lead Interviewer') || interviewers[0];

    const updated = await prisma.$transaction(async (tx) => {
      const updatedInterview = await tx.interview.update({
        where: { id: interviewId },
        data: {
          // If interview was created without createdById (legacy), backfill on first edit.
          createdById: existing.createdById ? undefined : userId,
          scheduledAt: scheduledAt || undefined,
          duration: data?.duration ? parseDurationToMinutes(data.duration) : undefined,
          // Keep UI label in round field for display consistency
          round: data?.type ? String(data.type) : undefined,
          type: data?.type || data?.mode ? mapInterviewType(data?.type, data?.mode) : undefined,
          mode: data?.mode ? mapInterviewMode(data?.mode) : undefined,
          platform: data?.platform || data?.mode ? mapMeetingPlatform(data?.platform, data?.mode) : undefined,
          location: data?.mode === 'in-person' ? String(data?.location || '').trim() || null : undefined,
          meetingLink: data?.mode === 'video' ? String(data?.meetingLink || '').trim() || null : undefined,
          instructions: data?.mode === 'phone' ? String(data?.phoneNumber || '').trim() || null : undefined,
          notes: typeof data?.notes === 'string' ? data.notes.trim() || null : undefined,
          interviewerId: leadInterviewer?.id ? leadInterviewer.id : undefined,
          panelIds: interviewers.length ? interviewers.map((i) => i.id).filter(Boolean) : undefined,
          status: nextStatus || undefined,
        },
        include: {
          interviewer: {
            select: { id: true, name: true, email: true, avatar: true, role: true, department: true },
          },
          job: { select: { id: true, title: true } },
        },
      });

      if (interviewers.length) {
        await tx.interviewPanel.deleteMany({ where: { interviewId } });
        await tx.interviewPanel.createMany({
          data: interviewers.map((item) => ({
            interviewId,
            userId: item.id,
            role: 'TECHNICAL',
          })),
        });
      }

      await tx.activity.create({
        data: {
          action: 'Interview updated',
          description: `Interview updated (${nextStatus || 'SCHEDULED'})`,
          performedById: userId,
          entityType: CANDIDATE_ACTIVITY_ENTITY,
          entityId: candidateId,
          category: 'Interviews',
          relatedType: 'job',
          relatedId: updatedInterview.jobId,
          relatedLabel: updatedInterview.job?.title || '',
          metadata: {
            kind: INTERVIEW_ACTIVITY_KIND,
            interviewId: updatedInterview.id,
            status: nextStatus,
            date: data?.date,
            time: data?.time,
            duration: data?.duration,
            mode: data?.mode,
            type: data?.type,
          },
        },
      });

      return updatedInterview;
    });

    return updated;
  },

  async getStats(req = {}) {
    const includeCommonPool =
      req.query?.includeCommonPool === 'true' || req.query?.includeCommonPool === '1';
    const mine =
      req.query?.mine === 'true' || req.query?.mine === '1' || req.query?.mine === true;
    const userId = req.user?.id;

    const emptyStats = {
      all: 0,
      applied: 0,
      longlist: 0,
      shortlist: 0,
      screening: 0,
      submitted: 0,
      interviewing: 0,
      offered: 0,
      hired: 0,
      rejected: 0,
    };

    if (mine && !userId) {
      return emptyStats;
    }

    const superAdminScope = buildSuperAdminOwnerScope(req, ['createdById', 'assignedToId']);
    const mineScope = mine ? await buildMineCandidatesScope(userId) : null;
    const scopeWhere = mine ? mineScope : superAdminScope;

    const stages = [
      'Applied',
      'Longlist',
      'Shortlist',
      'Screening',
      'Submitted',
      'Interviewing',
      'Offered',
      'Hired',
      'Rejected',
    ];

    // Recycle Bin: don't count soft-deleted candidates in the stage stats.
    const scopedStatsWhere = {
      AND: [scopeWhere || {}, { isDeleted: { not: true } }, buildCrmCandidatesListScopeClause()],
    };
    let scopedCandidates = await prisma.candidate.findMany({
      where: scopedStatsWhere,
      select: { id: true, stage: true, source: true },
    });

    if (isTenantScopedRequest()) {
      const portalCandidates = await fetchPortalCandidatesForTenant(req, {
        status: undefined,
        assignedToId: undefined,
        search: undefined,
        mine,
        listFilters: { stage: '' },
      });
      // Same Recycle Bin guard as getAll(): drop portal entries whose tenant row is soft-deleted.
      const softDeletedTenantIds = await collectSoftDeletedTenantCandidateIds(
        portalCandidates.map((c) => c.id)
      );
      const byId = new Map(scopedCandidates.map((candidate) => [candidate.id, candidate]));
      for (const portalCandidate of portalCandidates) {
        if (softDeletedTenantIds.has(portalCandidate.id)) continue;
        if (!byId.has(portalCandidate.id)) {
          byId.set(portalCandidate.id, { id: portalCandidate.id, stage: portalCandidate.stage || null });
        }
      }
      scopedCandidates = Array.from(byId.values());
    }

    if (includeCommonPool && isTenantScopedRequest()) {
      const commonCandidates = await fetchCandidateCommonForCandidatesList(req);
      const softDeletedTenantIds = await collectSoftDeletedTenantCandidateIds(
        commonCandidates.map((c) => c.id)
      );
      const byId = new Map(scopedCandidates.map((candidate) => [candidate.id, candidate]));
      for (const commonRow of commonCandidates) {
        if (softDeletedTenantIds.has(commonRow.id)) continue;
        if (!byId.has(commonRow.id)) {
          byId.set(commonRow.id, { id: commonRow.id, stage: commonRow.stage || null, source: commonRow.source });
        }
      }
      scopedCandidates = Array.from(byId.values());
    }

    scopedCandidates = scopedCandidates.filter((candidate) =>
      shouldShowOnCrmCandidatesList(candidate, { includeCommonPool })
    );

    const stageCounts = stages.map((stageName) => ({
      stage: stageName,
      count: scopedCandidates.filter((candidate) => String(candidate.stage || '') === stageName).length,
    }));

    const totalCount = scopedCandidates.length;

    // Build result object
    const result = {
      all: totalCount,
      applied: stageCounts.find((s) => s.stage === 'Applied')?.count || 0,
      longlist: stageCounts.find((s) => s.stage === 'Longlist')?.count || 0,
      shortlist: stageCounts.find((s) => s.stage === 'Shortlist')?.count || 0,
      screening: stageCounts.find((s) => s.stage === 'Screening')?.count || 0,
      submitted: stageCounts.find((s) => s.stage === 'Submitted')?.count || 0,
      interviewing: stageCounts.find((s) => s.stage === 'Interviewing')?.count || 0,
      offered: stageCounts.find((s) => s.stage === 'Offered')?.count || 0,
      hired: stageCounts.find((s) => s.stage === 'Hired')?.count || 0,
      rejected: stageCounts.find((s) => s.stage === 'Rejected')?.count || 0,
    };

    return result;
  },

  async bulkAction(action, candidateIds, payload, userId) {
    if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
      throw new Error('Candidate IDs are required');
    }

    switch (action) {
      case 'assign_recruiter': {
        const recruiterIds = Array.isArray(payload?.recruiterIds)
          ? payload.recruiterIds.filter(Boolean)
          : payload?.recruiterId
            ? [payload.recruiterId]
            : [];

        if (!recruiterIds.length) {
          throw new Error('At least one recruiter is required');
        }

        const uniqueRecruiterIds = Array.from(new Set(recruiterIds.map(String)));
        const primaryRecruiterId = uniqueRecruiterIds[0];
        const recruiters = await prisma.user.findMany({
          where: { id: { in: uniqueRecruiterIds }, isActive: true },
          select: { id: true, name: true, email: true },
        });

        if (!recruiters.length) {
          throw new Error('Selected recruiters were not found');
        }

        const updated = await prisma.candidate.updateMany({
          where: { id: { in: candidateIds }, isDeleted: { not: true } },
          data: { assignedToId: primaryRecruiterId },
        });

        const assignedCandidates = await prisma.candidate.findMany({
          where: { id: { in: candidateIds }, isDeleted: { not: true } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            currentTitle: true,
            currentCompany: true,
            experience: true,
            location: true,
            stage: true,
            skills: true,
            assignedJobs: true,
          },
        });

        const assignedBy = userId
          ? await prisma.user.findUnique({
              where: { id: userId },
              select: { name: true },
            })
          : null;

        // Log activity for each candidate
        for (const candidateId of candidateIds) {
          const candidate = await prisma.candidate.findUnique({
            where: { id: candidateId },
            select: { firstName: true, lastName: true, email: true },
          });
          if (candidate) {
            await prisma.activity.create({
              data: {
                action: 'Bulk action: Assign recruiter',
                description: `Recruiter assigned via bulk action`,
                performedById: userId,
                entityType: CANDIDATE_ACTIVITY_ENTITY,
                entityId: candidateId,
                category: 'Assignment',
                relatedType: 'candidate',
                relatedId: candidateId,
                relatedLabel: `${candidate.firstName} ${candidate.lastName}`.trim() || candidate.email,
                metadata: {
                  kind: 'candidate-bulk-action',
                  recruiterId: primaryRecruiterId,
                  recruiterIds: uniqueRecruiterIds,
                },
              },
            });
          }
        }

        await Promise.allSettled(
          recruiters
            .filter((recruiter) => recruiter.email)
            .map((recruiter) =>
              sendCandidateAssignmentEmail({
                toEmail: recruiter.email,
                assigneeName: recruiter.name,
                assignedByName: assignedBy?.name || null,
                senderUserId: userId,
                candidates: assignedCandidates.map((candidate) => ({
                  name: `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || candidate.email || 'Candidate',
                  email: candidate.email,
                  phone: candidate.phone,
                  currentTitle: candidate.currentTitle,
                  currentCompany: candidate.currentCompany,
                  experience: candidate.experience,
                  location: candidate.location,
                  stage: candidate.stage,
                  skills: candidate.skills,
                  assignedJobs: candidate.assignedJobs,
                })),
              })
            )
        );

        return { updated: updated.count };
      }

      case 'add_tag': {
        if (!payload?.tag) {
          throw new Error('Tag is required');
        }
        // For each candidate, add tag via activity
        for (const candidateId of candidateIds) {
          const candidate = await prisma.candidate.findUnique({
            where: { id: candidateId },
            select: { firstName: true, lastName: true, email: true },
          });
          if (candidate) {
            await prisma.activity.create({
              data: {
                action: `Tag added: ${payload.tag}`,
                description: `Tag "${payload.tag}" added via bulk action`,
                performedById: userId,
                entityType: CANDIDATE_ACTIVITY_ENTITY,
                entityId: candidateId,
                category: 'Tagging',
                relatedType: 'candidate',
                relatedId: candidateId,
                relatedLabel: `${candidate.firstName} ${candidate.lastName}`.trim() || candidate.email,
                metadata: { kind: TAG_ACTIVITY_KIND, tag: payload.tag },
              },
            });
          }
        }
        return { updated: candidateIds.length };
      }

      case 'reject': {
        const reason = payload?.reason || 'Bulk rejection';
        const updated = await prisma.candidate.updateMany({
          where: { id: { in: candidateIds }, isDeleted: { not: true } },
          data: { status: 'REJECTED' },
        });
        // Log rejection for each candidate
        for (const candidateId of candidateIds) {
          const candidate = await prisma.candidate.findUnique({
            where: { id: candidateId },
            select: { firstName: true, lastName: true, email: true },
          });
          if (candidate) {
            await prisma.activity.create({
              data: {
                action: 'Candidate rejected',
                description: reason,
                performedById: userId,
                entityType: CANDIDATE_ACTIVITY_ENTITY,
                entityId: candidateId,
                category: 'Rejection',
                relatedType: 'candidate',
                relatedId: candidateId,
                relatedLabel: `${candidate.firstName} ${candidate.lastName}`.trim() || candidate.email,
                metadata: { kind: REJECTION_ACTIVITY_KIND, reason },
              },
            });
          }
        }
        return { updated: updated.count };
      }

      case 'export': {
        // Return candidates for export
        const candidates = await prisma.candidate.findMany({
          where: { id: { in: candidateIds }, isDeleted: { not: true } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            currentCompany: true,
            currentTitle: true,
            experience: true,
            location: true,
            status: true,
            source: true,
            createdAt: true,
          },
        });
        return { candidates };
      }

      default:
        throw new Error(`Unknown bulk action: ${action}`);
    }
  },
};
