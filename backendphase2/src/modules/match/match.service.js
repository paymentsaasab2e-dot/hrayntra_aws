import { prisma } from '../../config/prisma.js';
import { getPaginationParams, formatPaginationResponse } from '../../utils/pagination.js';
import { canViewAllAssignments, hasAnyPermission } from '../../utils/permissionScope.js';
import {
  candidateService,
  loadMatchPipelineCandidatePool,
  ensureCandidateMaterializedForMatch,
} from '../candidate/candidate.service.js';
import { sendMatchSubmissionEmail } from '../../emails/email.service.js';
import { env } from '../../config/env.js';
import { createRequire } from 'module';
import {
  createClientReviewToken,
  normalizeSubmissionType,
} from '../../services/interview.service.js';
import { AI_MATCH_AUTHOR_WHERE, MANUAL_MATCH_AUTHOR_WHERE } from './matchQueryHelpers.js';

// Mirror of the interview drawer's purpose codes. Keeping the resolution
// logic here means a match-submitted-to-client carries the same UX (tag
// options + offer-letter upload) on the public review page.
const MATCH_SUBMISSION_PURPOSES = {
  INITIAL_REVIEW: 'Initial review — please confirm the candidate is a fit before scheduling.',
  INTERIM_REVIEW: 'Mid-cycle review — please confirm next steps.',
  OFFER_CONFIRMATION: 'Final clarification — please attach the signed offer letter.',
  GENERAL: 'Please review this candidate.',
};

const buildClientReviewUrl = (match, submissionType) => {
  const token = createClientReviewToken({
    matchId: match.id,
    candidateId: match.candidateId,
    jobId: match.jobId,
    clientId: match.job?.clientId || match.job?.client?.id || null,
    submissionType,
  });
  return `${env.FRONTEND_URL}/client-review/${encodeURIComponent(token)}`;
};

const require = createRequire(import.meta.url);

const CANDIDATE_ACTIVITY_ENTITY = 'CANDIDATE';
const NOTE_ACTIVITY_KIND = 'candidate-note';
const PIPELINE_ACTIVITY_KIND = 'candidate-pipeline';
const MATCH_SUBMISSION_ACTIVITY_KIND = 'match-submission';
const MATCH_REJECTION_ACTIVITY_KIND = 'match-rejection';
const MATCH_SAVE_ACTIVITY_KIND = 'match-save';

function getActivityMetadata(activity) {
  return activity?.metadata && typeof activity.metadata === 'object' ? activity.metadata : {};
}

function buildInitials(firstName = '', lastName = '') {
  return `${String(firstName || '').trim()[0] || ''}${String(lastName || '').trim()[0] || ''}`.toUpperCase() || 'NA';
}

/** Matches visible when tied to the user's jobs/candidates or created by them (unless tenant-wide access). */
function buildMatchListScope(req) {
  if (!req?.user?.id) return null;
  if (canViewAllAssignments(req)) return null;
  if (hasAnyPermission(req, ['view_all_candidates'])) return null;
  const uid = req.user.id;
  return {
    OR: [
      { createdById: uid },
      { job: { is: { OR: [{ createdById: uid }, { assignedToId: uid }] } } },
      { candidate: { is: { OR: [{ createdById: uid }, { assignedToId: uid }] } } },
    ],
  };
}

function parseSalary(salary) {
  if (!salary || typeof salary !== 'object') {
    return {
      expected: 'Not shared',
      currency: 'USD',
      amount: 0,
      fit: 'average',
    };
  }

  const currency = salary.currency || 'USD';
  const rawExpected = salary.expected ?? salary.max ?? salary.current ?? 0;
  const amount = Number(rawExpected) || 0;
  const symbol =
    currency === 'GBP' ? '£' : currency === 'EUR' ? 'EUR ' : currency === 'INR' ? 'INR ' : currency === 'AED' ? 'AED ' : '$';

  return {
    expected: amount ? `${symbol}${amount >= 1000 ? `${Math.round(amount / 1000)}k` : amount}` : 'Not shared',
    currency,
    amount,
    fit: amount <= 80000 ? 'excellent' : amount <= 120000 ? 'good' : amount <= 160000 ? 'average' : 'poor',
  };
}

function toRelativeLabel(value) {
  if (!value) return 'Recently';
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)));
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return diffDays <= 1 ? '1d ago' : `${diffDays}d ago`;
}

function toTimestamp(value) {
  if (!value) return 'Recently';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function buildExplanation(match, candidate, job) {
  const candidateSkills = Array.isArray(candidate.skills) ? candidate.skills : [];
  const jobSkills = Array.isArray(job.skills) ? job.skills : [];
  const normalizedCandidateSkills = candidateSkills.map((skill) => String(skill).toLowerCase());
  const matchedSkills = jobSkills.filter((skill) => normalizedCandidateSkills.includes(String(skill).toLowerCase())).slice(0, 4);
  const missingSkills = jobSkills.filter((skill) => !normalizedCandidateSkills.includes(String(skill).toLowerCase())).slice(0, 4);
  const score = Number(match.score || 0);

  const candidateName = `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim();

  return {
    skills: matchedSkills.length >= Math.max(1, Math.ceil(jobSkills.length / 2)) ? true : matchedSkills.length ? 'partial' : false,
    experience:
      candidate.experience && candidate.experience >= Number.parseInt(String(job.experienceRequired || '0'), 10)
        ? true
        : candidate.experience
        ? 'partial'
        : false,
    location: candidate.location && job.location && candidate.location.toLowerCase().includes(String(job.location).toLowerCase()) ? true : 'partial',
    salary: score >= 85 ? true : score >= 70 ? 'partial' : false,
    text:
      match.notes ||
      candidateName
        ? `${candidateName} aligns with ${job.title} on ${matchedSkills.slice(0, 3).join(', ') || 'core skills'} and ${candidate.experience || 0} years of experience.`
        : `Profile aligned to ${job.title}.`,
    matchedSkills,
    missingSkills,
    roleRequirement: job.experienceRequired || `${candidate.experience || 0}+ years`,
  };
}

function deriveDisplayStatus(match, candidate, activities, jobId) {
  const submissionActivity = activities.find((activity) => {
    const metadata = getActivityMetadata(activity);
    return metadata.kind === MATCH_SUBMISSION_ACTIVITY_KIND && metadata.jobId === jobId;
  });
  if (match.status === 'REJECTED') return 'Rejected';
  if (submissionActivity) return 'Submitted';
  if ((candidate.assignedJobs || []).includes(jobId) || String(candidate.stage || '').trim()) return 'Sent to Pipeline';
  if (match.status === 'SHORTLISTED') return 'Selected';
  if (match.status === 'REVIEWED') return 'Reviewed';
  return 'New';
}

function mapNotes(activities) {
  return activities
    .filter((activity) => getActivityMetadata(activity).kind === NOTE_ACTIVITY_KIND)
    .slice(0, 10)
    .map((activity) => {
      const metadata = getActivityMetadata(activity);
      return {
        id: activity.id,
        text: metadata.text || activity.description || '',
        createdAt: toRelativeLabel(activity.createdAt),
        author: activity.performedBy?.name || 'Recruiter',
      };
    });
}

function mapActivity(activities) {
  return activities.slice(0, 10).map((activity) => ({
    id: activity.id,
    title: activity.action,
    description: activity.description || getActivityMetadata(activity).text || '',
    timestamp: toTimestamp(activity.createdAt),
  }));
}

function mapSubmittedHistory(activities, jobId) {
  const activity = activities.find((item) => {
    const metadata = getActivityMetadata(item);
    return metadata.kind === MATCH_SUBMISSION_ACTIVITY_KIND && metadata.jobId === jobId;
  });

  if (!activity) return null;

  return {
    date: new Date(activity.createdAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    status: getActivityMetadata(activity).notifyClient ? 'Submitted to client' : 'Drafted for client',
  };
}

function getClientRecipients(client) {
  const contacts = Array.isArray(client?.contacts) ? client.contacts : [];
  const contactsWithEmail = contacts.filter((contact) => contact?.email);
  const recipients = contactsWithEmail.map((contact) => contact.email);
  return [...new Set(recipients)];
}

function mapEmailCandidate(candidate) {
  return {
    name: `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim(),
    currentTitle: candidate.currentTitle || candidate.designation || 'Candidate',
    currentCompany: candidate.currentCompany || '',
    experience: candidate.experience || 0,
    location: candidate.location || 'Not shared',
    skills: candidate.skills || [],
    email: candidate.email || '',
    phone: candidate.phone || 'Not shared',
  };
}

async function getCandidateActivities(candidateIds) {
  if (!candidateIds.length) return [];
  return prisma.activity.findMany({
    where: {
      entityType: CANDIDATE_ACTIVITY_ENTITY,
      entityId: { in: candidateIds },
    },
    include: {
      performedBy: {
        select: { id: true, name: true, email: true, avatar: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

function mapMatchRecord(match, activitiesByCandidateId) {
  const candidate = match.candidate;
  const job = match.job;
  const activities = activitiesByCandidateId.get(candidate.id) || [];
  let explanation = buildExplanation(match, candidate, job);
  let score = Math.round(Number(match.score || 0));

  if (match.evaluation && typeof match.evaluation === 'object') {
    const ev = match.evaluation;
    const final = Number(ev.finalScore ?? ev.merged?.finalScore ?? match.score) || 0;
    const p1 = ev.pass1?.score ?? 0;
    const p2 = ev.pass2?.score ?? 0;
    const p3 = ev.pass3?.score ?? 0;
    const p4 = ev.pass4?.skipped ? null : ev.pass4?.score ?? 0;
    explanation = {
      ...explanation,
      text: String(ev.suggestion || explanation.text),
      scoreBand: ev.band || ev.merged?.band || explanation.scoreBand,
      matchedSkills:
        Array.isArray(ev.pass1?.matchedRequired) && ev.pass1.matchedRequired.length
          ? ev.pass1.matchedRequired.slice(0, 10)
          : explanation.matchedSkills,
      missingSkills:
        Array.isArray(ev.pass1?.missingRequired) && ev.pass1.missingRequired.length
          ? ev.pass1.missingRequired.slice(0, 10)
          : explanation.missingSkills,
      aiEngine: {
        deterministicScore: p1,
        aiScore: p3,
        verdict: ev.band || ev.merged?.band || 'Fit',
        confidenceLevel: final >= 80 ? 'high' : final >= 60 ? 'medium' : 'low',
        confidenceScore: final,
        breakdown: {
          skills: p1,
          experience: p2,
          semantic: p3,
          cultural: p4 == null ? 0 : p4,
        },
        pipelineWeights: ev.weights || ev.merged?.weights,
        suggestion: ev.suggestion,
        runId: ev.runId,
        formula: ev.merged?.formula,
      },
    };
    score = Math.round(final);
  }

  const salary = parseSalary(candidate.salary);
  const displayStatus = deriveDisplayStatus(match, candidate, activities, job.id);

  return {
    id: match.id,
    candidateId: candidate.id,
    jobId: job.id,
    name: `${candidate.firstName} ${candidate.lastName}`.trim(),
    photo: candidate.avatar || '',
    initials: buildInitials(candidate.firstName, candidate.lastName),
    score,
    skills: candidate.skills || [],
    experience: candidate.experience || 0,
    location: candidate.location || 'Location unavailable',
    salary,
    noticePeriod: candidate.noticePeriod || 'Not shared',
    status: displayStatus,
    matchSource: match.createdById ? 'manual' : 'ai',
    createdBy: match.createdBy ? { name: match.createdBy.name } : { name: '—' },
    createdAt: match.createdAt,
    explanation,
    currentTitle: candidate.currentTitle || candidate.designation || 'Candidate',
    currentCompany: candidate.currentCompany || 'Unknown company',
    email: candidate.email,
    phone: candidate.phone || 'Not shared',
    resumeName: candidate.resume ? String(candidate.resume).split('/').pop() : 'Resume not uploaded',
    portfolioUrl: candidate.linkedIn || undefined,
    savedAt: candidate.hotlist ? candidate.updatedAt : null,
    notes: mapNotes(activities),
    activity: mapActivity(activities),
    submittedHistory: mapSubmittedHistory(activities, job.id),
    matchRating: null,
    isPhase1Candidate:
      (match.evaluation &&
        typeof match.evaluation === 'object' &&
        match.evaluation.origin === 'phase1') ||
      String(candidate.source || '').toLowerCase() === 'phase1',
  };
}

export const matchService = {
  async getAll(req) {
    const { page, limit, skip } = getPaginationParams(req);
    const { jobId, candidateId, status, minScore, source, saved } = req.query;

    const where = {};
    if (jobId) where.jobId = jobId;
    if (candidateId) where.candidateId = candidateId;
    if (status) where.status = status;
    if (minScore !== undefined && minScore !== null && minScore !== '') {
      const parsed = parseFloat(minScore);
      if (Number.isFinite(parsed)) where.score = { gte: parsed };
    }
    if (source === 'manual') where.createdById = MANUAL_MATCH_AUTHOR_WHERE;
    if (source === 'ai') where.createdById = AI_MATCH_AUTHOR_WHERE;
    if (saved === 'true') {
      where.candidate = {
        is: {
          hotlist: true,
        },
      };
    }

    const visibilityScope = buildMatchListScope(req);
    const mergedWhere =
      visibilityScope && Object.keys(where).length > 0
        ? { AND: [where, visibilityScope] }
        : visibilityScope || where;

    const shouldRunPipeline =
      String(source) === 'ai' &&
      jobId &&
      (req.query.runPipeline === '1' || req.query.refresh === '1' || req.query.forceRefresh === '1');

    if (shouldRunPipeline) {
      try {
        const { runMatchPipeline } = require('../../services/jobMatchEngine/matchPipelineRunner.cjs');
        const forceRefresh = req.query.refresh === '1' || req.query.forceRefresh === '1';
        const suggestionMin = Number(process.env.MATCH_SUGGESTION_MIN_SCORE || 50);
        const minForPipeline = minScore ? parseFloat(minScore) : suggestionMin;
        const pool = await loadMatchPipelineCandidatePool(req, String(jobId));
        if (pool.commonIncluded || pool.portalIncluded) {
          const tombstoneNote =
            pool.phase1TombstoneReincluded > 0
              ? ` phase1-reincluded=${pool.phase1TombstoneReincluded}`
              : '';
          console.log(
            `[matchService] AI pool: tenant=${pool.tenantCount} common=${pool.commonCount ?? 0} portal=${pool.portalCount} merged=${pool.mergedCount}${tombstoneNote} (job ${jobId})`
          );
        }
        await runMatchPipeline({
          jobId: String(jobId),
          prisma,
          minScore: Number.isFinite(minForPipeline) ? minForPipeline : suggestionMin,
          forceRefresh,
          candidates: pool.candidates,
          poolStats: pool,
          materializeCandidate: ensureCandidateMaterializedForMatch,
        });
      } catch (pipeErr) {
        console.error('[matchService] AI match pipeline failed:', pipeErr?.message || pipeErr);
      }
    }

    const [matches, total] = await Promise.all([
      prisma.match.findMany({
        where: mergedWhere,
        skip,
        take: limit,
        include: {
          candidate: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              skills: true,
              experience: true,
              phone: true,
              location: true,
              currentTitle: true,
              currentCompany: true,
              noticePeriod: true,
              avatar: true,
              resume: true,
              linkedIn: true,
              salary: true,
              hotlist: true,
              assignedJobs: true,
              stage: true,
              designation: true,
              updatedAt: true,
            },
          },
          job: {
            select: {
              id: true,
              title: true,
              skills: true,
              experienceRequired: true,
              location: true,
              status: true,
              priority: true,
              client: { select: { companyName: true } },
            },
          },
          createdBy: {
            select: { id: true, name: true },
          },
        },
        orderBy: { score: 'desc' },
      }),
      prisma.match.count({ where: mergedWhere }),
    ]);

    const activities = await getCandidateActivities([...new Set(matches.map((match) => match.candidate.id))]);
    const activitiesByCandidateId = new Map();
    for (const activity of activities) {
      const candidateActivities = activitiesByCandidateId.get(activity.entityId) || [];
      candidateActivities.push(activity);
      activitiesByCandidateId.set(activity.entityId, candidateActivities);
    }

    const enrichedMatches = matches.map((match) => mapMatchRecord(match, activitiesByCandidateId));

    return formatPaginationResponse(enrichedMatches, page, limit, total);
  },

  async getById(id, req = null) {
    const visibilityScope = buildMatchListScope(req);
    const whereClause = visibilityScope ? { AND: [{ id }, visibilityScope] } : { id };
    const match = await prisma.match.findFirst({
      where: whereClause,
      include: {
        candidate: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            skills: true,
            experience: true,
            location: true,
            currentTitle: true,
            currentCompany: true,
            noticePeriod: true,
            avatar: true,
            resume: true,
            linkedIn: true,
            salary: true,
            hotlist: true,
            assignedJobs: true,
            stage: true,
            designation: true,
            updatedAt: true,
          },
        },
        job: {
          include: {
            client: true,
          },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!match) return null;

    const activities = await getCandidateActivities([match.candidate.id]);
    const activitiesByCandidateId = new Map([[match.candidate.id, activities]]);
    return mapMatchRecord(match, activitiesByCandidateId);
  },

  async create(data) {
    return prisma.match.create({
      data: {
        candidateId: data.candidateId,
        jobId: data.jobId,
        score: data.score,
        status: data.status || 'SUGGESTED',
        notes: data.notes,
        createdById: data.createdById,
      },
    });
  },

  async update(id, data) {
    return prisma.match.update({
      where: { id },
      data: {
        status: data.status,
        notes: data.notes,
        score: data.score,
      },
    });
  },

  async delete(id) {
    await prisma.match.delete({ where: { id } });
    return { message: 'Match deleted successfully' };
  },

  async save(id, data, userId) {
    const match = await prisma.match.findUnique({
      where: { id },
      include: {
        candidate: true,
        job: { select: { id: true, title: true } },
      },
    });

    if (!match) {
      throw new Error('Match not found');
    }

    const saved = data?.saved !== false;

    await prisma.$transaction(async (tx) => {
      await tx.candidate.update({
        where: { id: match.candidateId },
        data: {
          hotlist: saved,
          lastActivity: new Date(),
        },
      });

      await tx.activity.create({
        data: {
          action: saved ? 'Match saved' : 'Match unsaved',
          description: saved
            ? `Saved match for ${match.job.title}.`
            : `Removed saved match for ${match.job.title}.`,
          performedById: userId,
          entityType: CANDIDATE_ACTIVITY_ENTITY,
          entityId: match.candidateId,
          category: 'Candidates',
          relatedType: 'job',
          relatedId: match.jobId,
          relatedLabel: match.job.title,
          metadata: {
            kind: MATCH_SAVE_ACTIVITY_KIND,
            saved,
            jobId: match.jobId,
            relatedJobTitle: match.job.title,
          },
        },
      });
    });

    return this.getById(id);
  },

  async submit(id, data, userId) {
    const match = await prisma.match.findUnique({
      where: { id },
      include: {
        candidate: true,
        job: {
          include: {
            client: {
              include: {
                contacts: {
                  where: {
                    contactType: 'CLIENT',
                  },
                  select: {
                    email: true,
                    firstName: true,
                    lastName: true,
                  },
                  orderBy: [{ createdAt: 'asc' }],
                },
              },
            },
          },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!match) {
      throw new Error('Match not found');
    }

    const message = String(data?.message || '').trim();
    const notifyClient = Boolean(data?.notifyClient);
    const recipients = notifyClient ? getClientRecipients(match.job.client) : [];

    if (notifyClient && !recipients.length) {
      throw new Error('No client contact email found for this job');
    }

    // Mirror the interview drawer: the recruiter must commit to a purpose.
    // We default to GENERAL if the caller didn't pass one (older client),
    // but still log it on the activity so the row carries the intent.
    const submissionType =
      normalizeSubmissionType(data?.submissionType) || 'GENERAL';
    const reviewUrl = notifyClient ? buildClientReviewUrl(match, submissionType) : null;

    await prisma.$transaction(async (tx) => {
      await tx.match.update({
        where: { id },
        data: {
          status: 'SHORTLISTED',
          notes: message || match.notes || null,
        },
      });

      await tx.candidate.update({
        where: { id: match.candidateId },
        data: {
          lastActivity: new Date(),
        },
      });

      await tx.activity.create({
        data: {
          action: 'Candidate submitted',
          description: `Submitted to ${match.job.client?.companyName || 'client'}${notifyClient ? ' and client notified.' : '.'}`,
          performedById: userId,
          entityType: CANDIDATE_ACTIVITY_ENTITY,
          entityId: match.candidateId,
          category: 'Candidates',
          relatedType: 'job',
          relatedId: match.jobId,
          relatedLabel: match.job.title,
          metadata: {
            kind: MATCH_SUBMISSION_ACTIVITY_KIND,
            jobId: match.jobId,
            relatedJobTitle: match.job.title,
            clientName: match.job.client?.companyName || null,
            notifyClient,
            message,
            submissionType,
            reviewUrl,
          },
        },
      });
    });

    if (notifyClient) {
      const purposeLine = MATCH_SUBMISSION_PURPOSES[submissionType] || MATCH_SUBMISSION_PURPOSES.GENERAL;
      const finalMessage = [
        message,
        message ? '' : null,
        purposeLine,
        reviewUrl ? `Review link: ${reviewUrl}` : null,
      ]
        .filter((part) => part !== null)
        .join('\n')
        .trim();

      const emailResult = await sendMatchSubmissionEmail({
        to: recipients,
        clientName: match.job.client?.companyName || 'Team',
        jobTitle: match.job.title,
        recruiterName: match.createdBy?.name || 'Recruitment Team',
        message: finalMessage,
        candidates: [mapEmailCandidate(match.candidate)],
        portalUrl: reviewUrl || `${env.FRONTEND_URL}/matches`,
      });

      if (!emailResult.success) {
        throw new Error(emailResult.error || 'Failed to send email');
      }
    }

    return this.getById(id);
  },

  async reject(id, data, userId) {
    const match = await prisma.match.findUnique({
      where: { id },
      include: {
        candidate: true,
        job: { select: { id: true, title: true } },
      },
    });

    if (!match) {
      throw new Error('Match not found');
    }

    const reason = String(data?.reason || '').trim();
    const notes = String(data?.notes || '').trim();

    if (!reason) {
      throw new Error('Reject reason is required');
    }

    await prisma.$transaction(async (tx) => {
      await tx.match.update({
        where: { id },
        data: {
          status: 'REJECTED',
          notes: notes || reason,
        },
      });

      await tx.candidate.update({
        where: { id: match.candidateId },
        data: {
          lastActivity: new Date(),
        },
      });

      await tx.activity.create({
        data: {
          action: 'Match rejected',
          description: `${reason}${notes ? ` • ${notes}` : ''}`,
          performedById: userId,
          entityType: CANDIDATE_ACTIVITY_ENTITY,
          entityId: match.candidateId,
          category: 'Candidates',
          relatedType: 'job',
          relatedId: match.jobId,
          relatedLabel: match.job.title,
          metadata: {
            kind: MATCH_REJECTION_ACTIVITY_KIND,
            reason,
            notes,
            jobId: match.jobId,
            relatedJobTitle: match.job.title,
          },
        },
      });
    });

    return this.getById(id);
  },

  async bulkReject(data, userId) {
    const matchIds = Array.isArray(data?.matchIds) ? data.matchIds.filter(Boolean) : [];
    const reason = String(data?.reason || '').trim();
    const notes = String(data?.notes || '').trim();

    if (!matchIds.length) {
      throw new Error('Select at least one match');
    }

    if (!reason) {
      throw new Error('Reject reason is required');
    }

    const items = [];
    for (const matchId of matchIds) {
      const updated = await this.reject(matchId, { reason, notes }, userId);
      items.push(updated);
    }

    return {
      count: items.length,
      items,
    };
  },

  async bulkAddToPipeline(data, userId) {
    const candidateIds = Array.isArray(data?.candidateIds) ? data.candidateIds.filter(Boolean) : [];
    const jobId = String(data?.jobId || '').trim();
    const stage = String(data?.stage || '').trim();
    const recruiterId = String(data?.recruiterId || '').trim();
    const notes = String(data?.notes || '').trim();
    const priority = String(data?.priority || 'Medium').trim();

    if (!candidateIds.length) {
      throw new Error('Select at least one candidate');
    }

    if (!jobId) {
      throw new Error('Job is required');
    }

    if (!stage) {
      throw new Error('Pipeline stage is required');
    }

    const items = [];
    for (const candidateId of candidateIds) {
      const updated = await candidateService.addToPipeline(
        candidateId,
        {
          jobId,
          stage,
          recruiterId: recruiterId || undefined,
          notes,
          priority,
        },
        userId
      );
      items.push(updated);
    }

    return {
      count: items.length,
      items,
    };
  },

  async bulkEmail(data, userId) {
    const matchIds = Array.isArray(data?.matchIds) ? data.matchIds.filter(Boolean) : [];
    const message = String(data?.message || '').trim();
    const subject = String(data?.subject || '').trim();

    if (!matchIds.length) {
      throw new Error('Select at least one match');
    }

    const matches = await prisma.match.findMany({
      where: {
        id: { in: matchIds },
      },
      include: {
        candidate: true,
        job: {
          include: {
            client: {
              include: {
                contacts: {
                  where: {
                    contactType: 'CLIENT',
                  },
                  select: {
                    email: true,
                    firstName: true,
                    lastName: true,
                  },
                  orderBy: [{ createdAt: 'asc' }],
                },
              },
            },
          },
        },
      },
    });

    if (!matches.length) {
      throw new Error('No matches found');
    }

    const firstJob = matches[0].job;
    const sameJob = matches.every((item) => item.jobId === firstJob.id);
    if (!sameJob) {
      throw new Error('Bulk email requires matches from the same job');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    const recipients = getClientRecipients(firstJob.client);
    if (!recipients.length) {
      throw new Error('No client contact email found for this job');
    }

    // One review token per match — the bulk email lists all candidates and
    // includes a per-candidate "review" link so the client can drill into any
    // one of them. We pick the first link as `portalUrl` so older email
    // templates still have a meaningful CTA target.
    const submissionType = normalizeSubmissionType(data?.submissionType) || 'GENERAL';
    const reviewLinks = matches.map((item) => ({
      candidateId: item.candidateId,
      candidateName: `${item.candidate?.firstName || ''} ${item.candidate?.lastName || ''}`.trim() || 'Candidate',
      url: buildClientReviewUrl(item, submissionType),
    }));

    const purposeLine =
      MATCH_SUBMISSION_PURPOSES[submissionType] || MATCH_SUBMISSION_PURPOSES.GENERAL;
    const linkBlock = reviewLinks
      .map((entry) => `• ${entry.candidateName}: ${entry.url}`)
      .join('\n');
    const finalMessage = [message, message ? '' : null, purposeLine, linkBlock]
      .filter((part) => part !== null)
      .join('\n')
      .trim();

    const emailResult = await sendMatchSubmissionEmail({
      to: recipients,
      clientName: firstJob.client?.companyName || 'Team',
      jobTitle: firstJob.title,
      recruiterName: user?.name || 'Recruitment Team',
      message: finalMessage,
      subject: subject || `Candidate Submission: ${firstJob.title}`,
      candidates: matches.map((item) => mapEmailCandidate(item.candidate)),
      portalUrl: reviewLinks[0]?.url || `${env.FRONTEND_URL}/matches`,
    });

    if (!emailResult.success) {
      throw new Error(emailResult.error || 'Failed to send email');
    }

    await prisma.activity.createMany({
      data: matches.map((match) => ({
        action: 'Candidate submission email sent',
        description: `Submission email sent for ${match.job.title}.`,
        performedById: userId,
        entityType: CANDIDATE_ACTIVITY_ENTITY,
        entityId: match.candidateId,
        category: 'Candidates',
        relatedType: 'job',
        relatedId: match.jobId,
        relatedLabel: match.job.title,
        metadata: {
          kind: MATCH_SUBMISSION_ACTIVITY_KIND,
          jobId: match.jobId,
          relatedJobTitle: match.job.title,
          clientName: match.job.client?.companyName || null,
          notifyClient: true,
          message,
          subject: subject || `Candidate Submission: ${firstJob.title}`,
          bulk: true,
          submissionType,
          reviewUrl: reviewLinks.find((entry) => entry.candidateId === match.candidateId)?.url || null,
        },
      })),
    });

    return {
      count: matches.length,
      recipients,
    };
  },
};
