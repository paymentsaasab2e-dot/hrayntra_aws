import { prisma } from '../../config/prisma.js';
import { getPaginationParams, formatPaginationResponse } from '../../utils/pagination.js';
import { candidateService } from '../candidate/candidate.service.js';
import { sendMatchSubmissionEmail } from '../../emails/email.service.js';
import { env } from '../../config/env.js';

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
  const primaryContacts = contactsWithEmail.filter((contact) => contact.isPrimary);
  const recipients = (primaryContacts.length ? primaryContacts : contactsWithEmail).map((contact) => contact.email);
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
  const explanation = buildExplanation(match, candidate, job);
  const salary = parseSalary(candidate.salary);
  const displayStatus = deriveDisplayStatus(match, candidate, activities, job.id);

  return {
    id: match.id,
    candidateId: candidate.id,
    jobId: job.id,
    name: `${candidate.firstName} ${candidate.lastName}`.trim(),
    photo: candidate.avatar || '',
    initials: buildInitials(candidate.firstName, candidate.lastName),
    score: Math.round(Number(match.score || 0)),
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
    if (minScore) where.score = { gte: parseFloat(minScore) };
    if (source === 'manual') where.createdById = { not: null };
    if (source === 'ai') where.createdById = null;
    if (saved === 'true') {
      where.candidate = {
        is: {
          hotlist: true,
        },
      };
    }

    const [matches, total] = await Promise.all([
      prisma.match.findMany({
        where,
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
      prisma.match.count({ where }),
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

  async getById(id) {
    const match = await prisma.match.findUnique({
      where: { id },
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
                    type: 'CLIENT',
                    email: { not: null },
                  },
                  select: {
                    email: true,
                    firstName: true,
                    lastName: true,
                    isPrimary: true,
                  },
                  orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
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
          },
        },
      });
    });

    if (notifyClient) {
      const emailResult = await sendMatchSubmissionEmail({
        to: recipients,
        clientName: match.job.client?.companyName || 'Team',
        jobTitle: match.job.title,
        recruiterName: match.createdBy?.name || 'Recruitment Team',
        message,
        candidates: [mapEmailCandidate(match.candidate)],
        portalUrl: `${env.FRONTEND_URL}/matches`,
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
                    type: 'CLIENT',
                    email: { not: null },
                  },
                  select: {
                    email: true,
                    firstName: true,
                    lastName: true,
                    isPrimary: true,
                  },
                  orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
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

    const emailResult = await sendMatchSubmissionEmail({
      to: recipients,
      clientName: firstJob.client?.companyName || 'Team',
      jobTitle: firstJob.title,
      recruiterName: user?.name || 'Recruitment Team',
      message,
      subject: subject || `Candidate Submission: ${firstJob.title}`,
      candidates: matches.map((item) => mapEmailCandidate(item.candidate)),
      portalUrl: `${env.FRONTEND_URL}/matches`,
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
        },
      })),
    });

    return {
      count: matches.length,
      recipients,
    };
  },
};
