import { prisma } from '../../config/prisma.js';
import { getPaginationParams, formatPaginationResponse } from '../../utils/pagination.js';
import { dbLogger } from '../../utils/db-logger.js';
import { generateMeetingLink } from '../../services/meetingService.js';
import {
  sendCandidateAssignmentEmail,
  sendCandidateInterviewScheduledEmail,
  sendInterviewPanelScheduledEmail,
} from '../../services/emailService.js';

const CANDIDATE_ACTIVITY_ENTITY = 'CANDIDATE';
const NOTE_ACTIVITY_KIND = 'candidate-note';
const TAG_ACTIVITY_KIND = 'candidate-tag';
const PIPELINE_ACTIVITY_KIND = 'candidate-pipeline';
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

async function getCandidateActivities(candidateId) {
  return prisma.activity.findMany({
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

async function getCandidateOrThrow(id) {
  const candidate = await prisma.candidate.findUnique({
    where: { id },
  });

  if (!candidate) {
    throw new Error('Candidate not found');
  }

  return candidate;
}

async function buildCandidateResponse(candidate) {
  const activities = await getCandidateActivities(candidate.id);
  const customTags = extractCustomTags(activities);
  const internalNotes = activities.map(mapActivityToNote).filter(Boolean);
  const activityFeed = activities.map(mapActivityToDrawerItem).filter(Boolean);

  return {
    ...candidate,
    tags: customTags.map((tag) => tag.label),
    tagObjects: customTags,
    internalNotes,
    activityFeed,
  };
}

/** Candidates the user may see when mine=true: created by them, or applied / in pipeline on jobs they created. */
async function buildMineCandidatesScope(userId) {
  if (!userId) {
    return { id: { in: [] } };
  }
  const myJobs = await prisma.job.findMany({
    where: { createdById: userId },
    select: { id: true },
  });
  const myJobIds = myJobs.map((j) => j.id);
  const orClause = [{ createdById: userId }];
  if (myJobIds.length > 0) {
    orClause.push({ matches: { some: { jobId: { in: myJobIds } } } });
    orClause.push({ pipelineEntries: { some: { jobId: { in: myJobIds } } } });
    orClause.push({ interviews: { some: { jobId: { in: myJobIds } } } });
  }
  return { OR: orClause };
}

export const candidateService = {
  async getAll(req) {
    const { page, limit, skip } = getPaginationParams(req);
    const { status, stage, assignedToId, search } = req.query;
    const mine =
      req.query?.mine === 'true' || req.query?.mine === '1' || req.query?.mine === true;

    if (mine && !req.user?.id) {
      return formatPaginationResponse([], page, limit, 0);
    }

    const where = {};
    if (status) where.status = status;
    if (stage) where.stage = stage; // Filter by stage field
    if (assignedToId) where.assignedToId = assignedToId;

    const andParts = [];
    if (mine && req.user?.id) {
      andParts.push(await buildMineCandidatesScope(req.user.id));
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
    if (andParts.length) {
      where.AND = andParts;
    }

    const [candidates, total] = await Promise.all([
      prisma.candidate.findMany({
        where,
        skip,
        take: limit,
        include: {
          assignedTo: {
            select: { id: true, name: true, email: true },
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
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.candidate.count({ where }),
    ]);

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

    const enriched = candidates.map((candidate) => {
      const titles = (Array.isArray(candidate.assignedJobs) ? candidate.assignedJobs : [])
        .map((jobId) => jobsById.get(jobId))
        .filter(Boolean);
      return {
        ...candidate,
        assignedJobTitles: titles,
      };
    });

    return formatPaginationResponse(enriched, page, limit, total);
  },

  async getById(id) {
    const candidate = await prisma.candidate.findUnique({
      where: { id },
      include: candidateDetailInclude,
    });

    if (!candidate) {
      return null;
    }

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
    const updateData = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      linkedIn: data.linkedIn,
      resume: data.resume,
      skills: data.skills,
      experience: data.experience,
      currentTitle: data.currentTitle,
      currentCompany: data.currentCompany,
      designation: data.designation,
      location: data.location,
      status: data.status,
      source: data.source,
      assignedToId: data.assignedToId,
      rating: data.rating,
      noticePeriod: data.noticePeriod,
      hotlist: data.hotlist,
      salary: data.salary,
      assignedJobs: data.assignedJobs,
      stage: data.stage,
      lastActivity: data.lastActivity ? new Date(data.lastActivity) : undefined,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
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
      certifications: data.certifications,
      languages: data.languages,
      portfolio: data.portfolio,
      github: data.github,
      website: data.website,
      notes: data.notes,
      cvSummary: data.cvSummary,
      cvEducationEntries: data.cvEducationEntries,
      cvWorkExperienceEntries: data.cvWorkExperienceEntries,
      cvPortfolioLinks: data.cvPortfolioLinks,
      tags: data.tags,
      preferredLocation: data.preferredLocation,
      willingToRelocate: data.willingToRelocate,
      remoteWorkPreference: data.remoteWorkPreference,
    };

    // Log data being updated
    dbLogger.logUpdate('CANDIDATE', id, updateData);

    const updated = await prisma.candidate.update({
      where: { id },
      data: updateData,
    });

    console.log(`✅ Candidate updated successfully (ID: ${id})\n`);

    return updated;
  },

  async delete(id) {
    const deletedCount = await prisma.$transaction(async (tx) => {
      // Orphaned activity rows (no FK cascade) — remove so DB stays clean
      await tx.activity.deleteMany({
        where: {
          OR: [
            { entityType: 'CANDIDATE', entityId: id },
            { relatedType: 'candidate', relatedId: id },
          ],
        },
      });

      // Leads store converted candidate id without a Prisma FK — clear reference
      await tx.lead.updateMany({
        where: { convertedToCandidateId: id },
        data: { convertedToCandidateId: null },
      });

      const result = await tx.candidate.deleteMany({ where: { id } });
      return result.count;
    });

    if (deletedCount === 0) {
      return { message: 'Candidate already deleted' };
    }

    return { message: 'Candidate deleted successfully' };
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

    const activityPayload = {
      action: 'Candidate added to pipeline',
      description: `${candidate.firstName} ${candidate.lastName}`.trim()
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

    await prisma.candidate.update({
      where: { id: candidateId },
      data: {
        stage: stageName,
        assignedToId: data?.recruiterId || candidate.assignedToId || undefined,
        assignedJobs: updatedAssignedJobs,
        lastActivity: new Date(),
        status: 'ACTIVE',
      },
    });

    await prisma.activity.create({
      data: activityPayload,
    });

    return this.getById(candidateId);
  },

  async rejectCandidate(candidateId, data, userId) {
    const candidate = await getCandidateOrThrow(candidateId);
    const reason = String(data?.reason || '').trim();
    const feedback = String(data?.feedback || '').trim();

    if (!reason) {
      throw new Error('Reject reason is required');
    }

    if (feedback.length < 20) {
      throw new Error('HR feedback must be at least 20 characters');
    }

    await prisma.$transaction(async (tx) => {
      await tx.candidate.update({
        where: { id: candidateId },
        data: {
          stage: 'Rejected',
          lastActivity: new Date(),
          status: 'INACTIVE',
        },
      });

      await tx.activity.create({
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
          },
        },
      });

      await tx.activity.create({
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
    });

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

      await tx.candidate.update({
        where: { id: candidateId },
        data: {
          stage: 'Interviewing',
          lastActivity: new Date(),
          status: 'ACTIVE',
        },
      });

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

    const scopeWhere = mine ? await buildMineCandidatesScope(userId) : null;

    // Get counts by stage
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

    const stageCounts = await Promise.all(
      stages.map(async (stage) => {
        const count = await prisma.candidate.count({
          where: scopeWhere ? { AND: [{ stage }, scopeWhere] } : { stage },
        });
        return { stage, count };
      })
    );

    // Get total count
    const totalCount = await prisma.candidate.count({
      where: scopeWhere || {},
    });

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
          where: { id: { in: candidateIds } },
          data: { assignedToId: primaryRecruiterId },
        });

        const assignedCandidates = await prisma.candidate.findMany({
          where: { id: { in: candidateIds } },
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
          where: { id: { in: candidateIds } },
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
          where: { id: { in: candidateIds } },
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
