import { getJobPortalPrismaClient, prisma } from '../../config/prisma.js';
import { withMongoWriteConflictRetry } from '../../utils/mongoWriteRetry.js';
import {
  gradeMcqSession,
  normalizeAssessmentPayload,
  normalizeJobAssessmentLinks,
  sanitizeConfigForCandidate,
  generateSessionToken,
} from './assessment.schema.js';

function resolveDurationMinutes(link, assessment) {
  return link?.durationOverrideMinutes ?? assessment?.durationMinutes ?? 15;
}

function resolvePassScore(link, assessment) {
  return link?.passScoreOverridePercent ?? assessment?.passScorePercent ?? 60;
}

const COMPLETED_SESSION_STATUSES = ['SUBMITTED', 'EXPIRED'];

async function resolveApplicationById(applicationId) {
  const id = String(applicationId || '').trim();
  if (!id) return null;

  const tenantApp = await prisma.application.findUnique({
    where: { id },
    select: { id: true, candidateId: true, jobId: true },
  });
  if (tenantApp) return { ...tenantApp, source: 'tenant' };

  const portalPrisma = getJobPortalPrismaClient();
  if (portalPrisma !== prisma) {
    const portalApp = await portalPrisma.application.findUnique({
      where: { id },
      select: { id: true, candidateId: true, jobId: true },
    });
    if (portalApp) return { ...portalApp, source: 'portal' };
  }

  return null;
}

function formatReviewContent(assessment) {
  if (!assessment) return null;
  const type = String(assessment.type || '').toUpperCase();
  const config =
    assessment.config && typeof assessment.config === 'object' ? assessment.config : {};

  if (type === 'MCQ') {
    const questions = Array.isArray(config.questions) ? config.questions : [];
    return {
      kind: 'MCQ',
      items: questions.map((q, index) => ({
        id: q.id,
        index: index + 1,
        prompt: String(q.prompt || ''),
        options: (Array.isArray(q.options) ? q.options : []).map((o) => ({
          id: o.id,
          text: String(o.text || ''),
          correct: o.id === q.correctOptionId,
        })),
        correctOptionId: q.correctOptionId,
      })),
    };
  }

  if (type === 'CODING') {
    const questions = Array.isArray(config.questions) ? config.questions : [];
    if (questions.length) {
      return {
        kind: 'CODING',
        multi: true,
        language: String(config.language || ''),
        items: questions.map((q, index) => ({
          id: q.id,
          index: index + 1,
          title: String(q.title || ''),
          prompt: String(q.prompt || ''),
          sampleInput: q.sampleInput ?? '',
          sampleOutput: q.sampleOutput ?? '',
          expectedAnswer: String(q.expectedAnswer || ''),
          marks: q.marks ?? null,
          testCases: (Array.isArray(q.testCases) ? q.testCases : []).map((tc) => ({
            input: tc.input,
            expected: tc.expected,
          })),
        })),
      };
    }
    return {
      kind: 'CODING',
      prompt: String(config.prompt || ''),
      language: String(config.language || ''),
      testCases: (Array.isArray(config.testCases) ? config.testCases : []).map((tc) => ({
        input: tc.input,
        expected: tc.expected,
      })),
    };
  }

  if (type === 'ESSAY') {
    return {
      kind: 'ESSAY',
      prompt: String(config.prompt || ''),
      minWords: config.minWords ?? null,
      maxWords: config.maxWords ?? null,
    };
  }

  if (type === 'VIDEO') {
    return {
      kind: 'VIDEO',
      prompt: String(config.prompt || ''),
      maxDurationSeconds: config.maxDurationSeconds ?? null,
    };
  }

  return null;
}

function mapSessionToResult(s) {
  const assessment = s.jobAssessment?.assessment;
  return {
    sessionId: s.id,
    assessmentId: s.assessmentId,
    jobAssessmentId: s.jobAssessmentId,
    title: assessment?.title,
    description: assessment?.description || null,
    type: assessment?.type,
    status: s.status,
    scorePercent: s.scorePercent,
    startedAt: s.startedAt,
    submittedAt: s.submittedAt,
    tabSwitchCount: s.tabSwitchCount,
    flagged: s.flagged,
    answers: s.answers,
    reviewContent: formatReviewContent(assessment),
    proctoringEvents: s.proctoringEvents,
  };
}

function sessionResultRank(s) {
  if (s.status === 'SUBMITTED') return 3;
  if (s.status === 'EXPIRED') return 1;
  return 0;
}

/** One row per attached test — keep best / latest attempt when candidates retried. */
function dedupeSessionsByAssessment(sessions = []) {
  const byAssessment = new Map();
  for (const session of sessions) {
    const key =
      String(session.jobAssessmentId || '').trim() ||
      String(session.assessmentId || '').trim() ||
      session.id;
    const existing = byAssessment.get(key);
    if (!existing) {
      byAssessment.set(key, session);
      continue;
    }
    const rankA = sessionResultRank(existing);
    const rankB = sessionResultRank(session);
    if (rankB !== rankA) {
      byAssessment.set(key, rankB > rankA ? session : existing);
      continue;
    }
    const scoreA = existing.scorePercent ?? -1;
    const scoreB = session.scorePercent ?? -1;
    if (scoreB !== scoreA) {
      byAssessment.set(key, scoreB > scoreA ? session : existing);
      continue;
    }
    const timeA = existing.submittedAt ? new Date(existing.submittedAt).getTime() : 0;
    const timeB = session.submittedAt ? new Date(session.submittedAt).getTime() : 0;
    byAssessment.set(key, timeB >= timeA ? session : existing);
  }
  return Array.from(byAssessment.values()).sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
  );
}

export const preScreenAssessmentService = {
  async listLibrary({ type } = {}) {
    const where = { isDeleted: false };
    if (type) where.type = String(type).toUpperCase();
    return prisma.preScreenAssessment.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });
  },

  async getById(id) {
    return prisma.preScreenAssessment.findFirst({
      where: { id, isDeleted: false },
    });
  },

  async create(data, createdById) {
    const payload = normalizeAssessmentPayload(data);
    return prisma.preScreenAssessment.create({
      data: { ...payload, createdById: createdById || null },
    });
  },

  async update(id, data) {
    const existing = await this.getById(id);
    if (!existing) throw new Error('Assessment not found');
    const payload = normalizeAssessmentPayload({ ...existing, ...data, type: data.type || existing.type });
    return prisma.preScreenAssessment.update({
      where: { id },
      data: payload,
    });
  },

  async softDelete(id) {
    const existing = await this.getById(id);
    if (!existing) throw new Error('Assessment not found');
    return prisma.preScreenAssessment.update({
      where: { id },
      data: { isDeleted: true },
    });
  },

  async getJobLinks(jobId) {
    const rows = await prisma.jobPreScreenAssessment.findMany({
      where: { jobId },
      include: { assessment: true },
      orderBy: { sortOrder: 'asc' },
    });
    return rows.filter((r) => r.assessment && !r.assessment.isDeleted);
  },

  async replaceJobLinks(jobId, links = []) {
    const normalized = normalizeJobAssessmentLinks(links);
    const assessmentIds = [...new Set(normalized.map((l) => l.assessmentId))];
    if (assessmentIds.length) {
      const found = await prisma.preScreenAssessment.findMany({
        where: { id: { in: assessmentIds }, isDeleted: false },
        select: { id: true },
      });
      const foundSet = new Set(found.map((f) => f.id));
      for (const id of assessmentIds) {
        if (!foundSet.has(id)) throw new Error(`Assessment not found: ${id}`);
      }
    }
    const existing = await prisma.jobPreScreenAssessment.findMany({
      where: { jobId },
      select: { id: true, assessmentId: true },
    });
    const nextAssessmentIds = new Set(normalized.map((l) => l.assessmentId));
    const toRemove = existing.filter((row) => !nextAssessmentIds.has(row.assessmentId));

    await prisma.$transaction(async (tx) => {
      for (const row of toRemove) {
        await tx.assessmentSession.deleteMany({ where: { jobAssessmentId: row.id } });
        await tx.jobPreScreenAssessment.delete({ where: { id: row.id } });
      }

      for (const link of normalized) {
        await tx.jobPreScreenAssessment.upsert({
          where: {
            jobId_assessmentId: { jobId, assessmentId: link.assessmentId },
          },
          create: {
            jobId,
            assessmentId: link.assessmentId,
            sortOrder: link.sortOrder,
            required: link.required,
            timing: link.timing,
            durationOverrideMinutes: link.durationOverrideMinutes,
            passScoreOverridePercent: link.passScoreOverridePercent,
          },
          update: {
            sortOrder: link.sortOrder,
            required: link.required,
            timing: link.timing,
            durationOverrideMinutes: link.durationOverrideMinutes,
            passScoreOverridePercent: link.passScoreOverridePercent,
          },
        });
      }
    });

    return this.getJobLinks(jobId);
  },

  async getPortalJobAssessments(jobId) {
    const links = await this.getJobLinks(jobId);
    return links.map((link) => ({
      jobAssessmentId: link.id,
      assessmentId: link.assessmentId,
      title: link.assessment.title,
      type: link.assessment.type,
      description: link.assessment.description,
      durationMinutes: resolveDurationMinutes(link, link.assessment),
      required: link.required,
      timing: link.timing,
      passScorePercent: resolvePassScore(link, link.assessment),
      antiCheatEnabled: link.assessment.antiCheatEnabled,
    }));
  },

  async startSession({
    jobId,
    candidateId,
    applicationId,
    jobAssessmentId,
    tenantDbName,
  }) {
    const link = await prisma.jobPreScreenAssessment.findFirst({
      where: { id: jobAssessmentId, jobId },
      include: { assessment: true },
    });
    if (!link?.assessment || link.assessment.isDeleted) {
      throw new Error('Assessment not attached to this job');
    }

    const existing = await prisma.assessmentSession.findFirst({
      where: {
        candidateId,
        jobId,
        jobAssessmentId,
        status: 'IN_PROGRESS',
        expiresAt: { gt: new Date() },
      },
    });
    if (existing) return this.getSessionForCandidate(existing.accessToken);

    const duration = resolveDurationMinutes(link, link.assessment);
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + duration * 60 * 1000);
    const session = await prisma.assessmentSession.create({
      data: {
        accessToken: generateSessionToken(),
        candidateId,
        jobId,
        applicationId: applicationId || null,
        assessmentId: link.assessmentId,
        jobAssessmentId: link.id,
        startedAt,
        expiresAt,
        status: 'IN_PROGRESS',
      },
      include: {
        jobAssessment: { include: { assessment: true } },
      },
    });

    return this.formatSessionForCandidate(session, { tenantDbName });
  },

  async getSessionForCandidate(accessToken) {
    const session = await prisma.assessmentSession.findUnique({
      where: { accessToken },
      include: {
        jobAssessment: { include: { assessment: true } },
      },
    });
    if (!session) throw new Error('Session not found');
    return this.formatSessionForCandidate(session);
  },

  formatSessionForCandidate(session, { tenantDbName } = {}) {
    const assessment = session.jobAssessment?.assessment;
    const now = Date.now();
    const expiresMs = new Date(session.expiresAt).getTime();
    const expired = now > expiresMs;
    const durationMinutes = assessment
      ? resolveDurationMinutes(session.jobAssessment, assessment)
      : 15;
    return {
      sessionId: session.id,
      accessToken: session.accessToken,
      status:
        expired && session.status === 'IN_PROGRESS' ? 'EXPIRED' : session.status,
      startedAt: session.startedAt,
      expiresAt: session.expiresAt,
      remainingSeconds: Math.max(0, Math.floor((expiresMs - now) / 1000)),
      tabSwitchCount: session.tabSwitchCount,
      flagged: session.flagged,
      scorePercent: session.scorePercent,
      jobId: session.jobId,
      candidateId: session.candidateId,
      applicationId: session.applicationId,
      jobAssessmentId: session.jobAssessmentId,
      tenantDbName: tenantDbName || null,
      assessment: assessment
        ? {
            id: assessment.id,
            title: assessment.title,
            type: assessment.type,
            description: assessment.description,
            durationMinutes,
            antiCheatEnabled: assessment.antiCheatEnabled,
            config: sanitizeConfigForCandidate(assessment.type, assessment.config),
          }
        : null,
    };
  },

  async logProctoringEvent(accessToken, { eventType, metadata } = {}) {
    const session = await prisma.assessmentSession.findUnique({
      where: { accessToken },
      include: { assessment: true },
    });
    if (!session) throw new Error('Session not found');
    if (session.status !== 'IN_PROGRESS') return { ignored: true };

    const antiCheat =
      session.assessment?.config &&
      typeof session.assessment.config === 'object' &&
      session.assessment.config.antiCheat &&
      typeof session.assessment.config.antiCheat === 'object'
        ? session.assessment.config.antiCheat
        : {};
    const maxTabSwitches = Math.max(1, Number(antiCheat.maxTabSwitches) || 3);

    const type = String(eventType || 'unknown').trim();
    const tabSwitch = type === 'tab_switch' || type === 'blur' || type === 'visibility_hidden';
    const nextCount = tabSwitch ? session.tabSwitchCount + 1 : session.tabSwitchCount;
    const flagged = tabSwitch && nextCount >= maxTabSwitches;

    await withMongoWriteConflictRetry(async () => {
      await prisma.proctoringEvent.create({
        data: {
          sessionId: session.id,
          eventType: type,
          metadata: metadata || null,
        },
      });
      if (tabSwitch) {
        await prisma.assessmentSession.update({
          where: { id: session.id },
          data: { tabSwitchCount: nextCount, flagged },
        });
      }
    });

    return { tabSwitchCount: nextCount, flagged };
  },

  async submitSession(accessToken, answers = {}) {
    return withMongoWriteConflictRetry(async () => {
      const session = await prisma.assessmentSession.findUnique({
        where: { accessToken },
        include: { jobAssessment: { include: { assessment: true } } },
      });
      if (!session) throw new Error('Session not found');
      if (session.status === 'SUBMITTED') {
        return { alreadySubmitted: true, scorePercent: session.scorePercent };
      }
      if (session.status !== 'IN_PROGRESS' && session.status !== 'EXPIRED') {
        throw new Error('Assessment session is no longer active');
      }

      const now = new Date();
      const assessment = session.jobAssessment?.assessment;
      let scorePercent = null;
      if (assessment?.type === 'MCQ') {
        const graded = gradeMcqSession(assessment.config, answers);
        scorePercent = graded.scorePercent;
      }

      const updated = await prisma.assessmentSession.update({
        where: { id: session.id },
        data: {
          status: 'SUBMITTED',
          submittedAt: now,
          answers,
          scorePercent,
        },
      });

      const passScore = resolvePassScore(session.jobAssessment, assessment);
      return {
        sessionId: updated.id,
        status: updated.status,
        scorePercent,
        passed: scorePercent != null ? scorePercent >= passScore : null,
        passScorePercent: passScore,
        tabSwitchCount: updated.tabSwitchCount,
        flagged: updated.flagged,
      };
    });
  },

  /**
   * Link pre-submit assessment sessions (no applicationId yet) to the portal/tenant application row.
   */
  async linkSessionsToApplication({ applicationId, candidateId, jobId }) {
    const appId = String(applicationId || '').trim();
    const candId = String(candidateId || '').trim();
    const jId = String(jobId || '').trim();
    if (!appId || !candId || !jId) return { linked: 0 };

    const result = await withMongoWriteConflictRetry(() =>
      prisma.assessmentSession.updateMany({
        where: {
          candidateId: candId,
          jobId: jId,
          applicationId: null,
          status: { in: COMPLETED_SESSION_STATUSES },
        },
        data: { applicationId: appId },
      })
    );
    return { linked: result.count || 0 };
  },

  async getApplicationAssessmentResults(applicationId) {
    const appId = String(applicationId || '').trim();
    if (!appId) return [];

    const app = await resolveApplicationById(appId);
    const orClauses = [{ applicationId: appId }];
    if (app?.candidateId && app?.jobId) {
      orClauses.push({
        candidateId: app.candidateId,
        jobId: app.jobId,
        status: { in: COMPLETED_SESSION_STATUSES },
      });
    }

    const sessions = await prisma.assessmentSession.findMany({
      where: { OR: orClauses },
      include: {
        jobAssessment: { include: { assessment: true } },
        proctoringEvents: { orderBy: { occurredAt: 'asc' }, take: 50 },
      },
      orderBy: { startedAt: 'asc' },
    });

    if (app?.candidateId && app?.jobId) {
      try {
        await this.linkSessionsToApplication({
          applicationId: appId,
          candidateId: app.candidateId,
          jobId: app.jobId,
        });
      } catch (linkErr) {
        console.warn('[pre-screen] link sessions to application failed (non-fatal):', linkErr?.message || linkErr);
      }
    }

    const dedupedById = new Map();
    for (const session of sessions) {
      dedupedById.set(session.id, session);
    }
    return dedupeSessionsByAssessment(Array.from(dedupedById.values())).map(mapSessionToResult);
  },

  async getCandidateAssessmentResults(candidateId, { jobId } = {}) {
    const candId = String(candidateId || '').trim();
    if (!candId) return [];

    const where = {
      candidateId: candId,
      status: { in: COMPLETED_SESSION_STATUSES },
    };
    const scopedJobId = String(jobId || '').trim();
    if (scopedJobId) where.jobId = scopedJobId;

    const sessions = await prisma.assessmentSession.findMany({
      where,
      include: {
        jobAssessment: { include: { assessment: true } },
        proctoringEvents: { orderBy: { occurredAt: 'asc' }, take: 50 },
      },
      orderBy: { startedAt: 'desc' },
    });
    if (!sessions.length) return [];

    const jobIds = [...new Set(sessions.map((s) => String(s.jobId || '').trim()).filter(Boolean))];
    const [applications, jobs] = await Promise.all([
      jobIds.length
        ? prisma.application.findMany({
            where: { candidateId: candId, jobId: { in: jobIds } },
            select: { id: true, jobId: true },
          })
        : [],
      jobIds.length
        ? prisma.job.findMany({
            where: { id: { in: jobIds } },
            select: { id: true, title: true },
          })
        : [],
    ]);

    const applicationIdByJobId = new Map(
      applications.map((row) => [String(row.jobId || '').trim(), row.id])
    );
    const jobTitleById = new Map(jobs.map((row) => [row.id, row.title]));

    const grouped = new Map();
    for (const jobKey of jobIds) {
      const jobSessions = sessions.filter((s) => String(s.jobId || '').trim() === jobKey);
      grouped.set(jobKey, {
        jobId: jobKey,
        jobTitle: jobTitleById.get(jobKey) || 'Untitled job',
        applicationId: applicationIdByJobId.get(jobKey) || null,
        results: dedupeSessionsByAssessment(jobSessions).map(mapSessionToResult),
      });
    }

    return Array.from(grouped.values()).sort((a, b) => {
      const latest = (group) => {
        const times = (group.results || [])
          .map((row) => row.submittedAt || row.startedAt || '')
          .filter(Boolean)
          .map((value) => new Date(value).getTime())
          .filter((value) => Number.isFinite(value));
        return times.length ? Math.max(...times) : 0;
      };
      return latest(b) - latest(a);
    });
  },

  async gradeSession(sessionId, { scorePercent, reviewNote, reviewedById } = {}) {
    const id = String(sessionId || '').trim();
    if (!id) throw new Error('Session id is required');

    const score = Number(scorePercent);
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      throw new Error('scorePercent must be between 0 and 100');
    }

    const session = await prisma.assessmentSession.findUnique({
      where: { id },
      include: { jobAssessment: { include: { assessment: true } } },
    });
    if (!session) throw new Error('Assessment session not found');
    if (session.status !== 'SUBMITTED' && session.status !== 'EXPIRED') {
      throw new Error('Only submitted attempts can be graded');
    }

    const existingAnswers =
      session.answers && typeof session.answers === 'object' && !Array.isArray(session.answers)
        ? { ...session.answers }
        : {};
    const review = {
      note: reviewNote ? String(reviewNote).trim() : null,
      reviewedById: reviewedById || null,
      reviewedAt: new Date().toISOString(),
      passed: score >= resolvePassScore(session.jobAssessment, session.jobAssessment?.assessment),
    };

    const updated = await withMongoWriteConflictRetry(() =>
      prisma.assessmentSession.update({
        where: { id },
        data: {
          scorePercent: score,
          answers: { ...existingAnswers, _review: review },
        },
        include: {
          jobAssessment: { include: { assessment: true } },
          proctoringEvents: { orderBy: { occurredAt: 'asc' }, take: 50 },
        },
      })
    );

    return mapSessionToResult(updated);
  },
};
