import { env } from '../../config/env.js';
import { getJobPortalPrismaClient } from '../../config/prisma.js';

function phase1FrontendBase() {
  return String(
    process.env.PHASE1_FRONTEND_URL ||
      process.env.JOB_PORTAL_FRONTEND_URL ||
      process.env.NEXT_PUBLIC_PHASE1_FRONTEND_URL ||
      'http://localhost:3000',
  )
    .trim()
    .replace(/\/+$/, '');
}

function formatDuration(ms) {
  const totalSec = Math.max(0, Math.floor(Number(ms) / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function isRejectedStatus(status) {
  const s = String(status || '').toLowerCase();
  return (
    s.includes('reject') ||
    s.includes('declin') ||
    s === 'not_selected' ||
    s === 'unsuccessful'
  );
}

async function fetchPhase1BehaviorPayload(candidateId) {
  try {
    const url = `${phase1FrontendBase()}/api/hq-behavior?userId=${encodeURIComponent(candidateId)}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    return json?.data || null;
  } catch (error) {
    console.warn('[hq-candidate-behavior] Phase 1 fetch failed:', error?.message || error);
    return null;
  }
}

async function loadPortalCandidate(candidateId) {
  const portal = getJobPortalPrismaClient();
  if (!portal?.candidate?.findFirst) return null;
  return portal.candidate.findFirst({
    where: {
      id: String(candidateId),
      OR: [{ isDeleted: false }, { isDeleted: { isSet: false } }],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      currentTitle: true,
      city: true,
      location: true,
      status: true,
      source: true,
      stage: true,
      lastActivity: true,
      updatedAt: true,
      createdAt: true,
    },
  });
}

async function loadPortalSessions(candidateId) {
  const portal = getJobPortalPrismaClient();
  if (!portal?.session?.findMany) return [];
  return portal.session.findMany({
    where: { candidateId: String(candidateId) },
    orderBy: { loginAt: 'desc' },
    take: 40,
    select: {
      id: true,
      loginAt: true,
      logoutAt: true,
      durationMs: true,
      deviceType: true,
      browser: true,
      operatingSystem: true,
      country: true,
      state: true,
      city: true,
      timezone: true,
      isActive: true,
      createdAt: true,
      lastUsedAt: true,
    },
  });
}

async function loadApplicationStats(candidateId) {
  const portal = getJobPortalPrismaClient();
  if (!portal?.application?.findMany) {
    return { total: 0, rejections: 0, recent: [] };
  }
  const apps = await portal.application.findMany({
    where: { candidateId: String(candidateId) },
    orderBy: { appliedAt: 'desc' },
    take: 20,
    select: {
      id: true,
      status: true,
      appliedAt: true,
      updatedAt: true,
      job: { select: { title: true, location: true } },
    },
  });
  let rejections = 0;
  for (const app of apps) {
    if (isRejectedStatus(app.status)) rejections += 1;
  }
  return {
    total: apps.length,
    rejections,
    recent: apps.map((app) => ({
      id: app.id,
      status: app.status || '—',
      jobTitle: app.job?.title || '—',
      company: app.job?.location || '—',
      createdAt: app.appliedAt,
    })),
  };
}

function serializeSession(row) {
  const loginAt = row.loginAt || row.createdAt;
  let durationMs = typeof row.durationMs === 'number' ? row.durationMs : null;
  if (durationMs == null && loginAt) {
    const start = new Date(loginAt).getTime();
    const end = row.logoutAt ? new Date(row.logoutAt).getTime() : Date.now();
    if (Number.isFinite(start) && Number.isFinite(end)) {
      durationMs = Math.max(0, end - start);
    }
  }
  return {
    id: row.id,
    startedAt: loginAt,
    endedAt: row.logoutAt || null,
    durationMs: durationMs || 0,
    durationLabel: formatDuration(durationMs || 0),
    deviceType: row.deviceType || null,
    browser: row.browser || null,
    operatingSystem: row.operatingSystem || null,
    country: row.country || null,
    state: row.state || null,
    city: row.city || null,
    isActive: row.isActive !== false && !row.logoutAt,
  };
}

function buildDbFallbackSummary({ sessions, applications, candidate }) {
  const sessionCount = sessions.length;
  const totalDurationMs = sessions.reduce((sum, s) => sum + (s.durationMs || 0), 0);
  const activeSessions = sessions.filter((s) => s.isActive).length;
  return {
    logins: sessionCount,
    visits: null,
    jobCardClicks: null,
    applies: applications.total,
    activeMs: totalDurationMs,
    sessionCount,
    activeSessions,
    rejectionsTotal: applications.rejections,
    profileSnapshot: {
      skillsCount: null,
      profileCompleteness: null,
      cvScore: null,
      applicationsTotal: applications.total,
      rejectionsTotal: applications.rejections,
    },
    candidateName: candidate
      ? [candidate.firstName, candidate.lastName].filter(Boolean).join(' ').trim()
      : null,
  };
}

export async function getCandidateBehaviorAnalysis(candidateId) {
  const id = String(candidateId || '').trim();
  if (!id) {
    const err = new Error('Candidate ID is required');
    err.code = 'VALIDATION';
    throw err;
  }

  const [candidate, sessionsRaw, applications, behaviorPayload] = await Promise.all([
    loadPortalCandidate(id),
    loadPortalSessions(id),
    loadApplicationStats(id),
    fetchPhase1BehaviorPayload(id),
  ]);

  const sessions = sessionsRaw.map(serializeSession);
  const rollup7d = behaviorPayload?.rollup7d || null;
  const dbSummary = buildDbFallbackSummary({ sessions, applications, candidate });

  return {
    candidateId: id,
    candidate: candidate
      ? {
          id: candidate.id,
          name: [candidate.firstName, candidate.lastName].filter(Boolean).join(' ').trim() || '—',
          email: candidate.email || '',
          phone: candidate.phone || '',
          title: candidate.currentTitle || '',
          location: candidate.location || candidate.city || '',
          status: candidate.status || candidate.stage || '',
          source: candidate.source || '',
          lastActivity: candidate.lastActivity || candidate.updatedAt || null,
        }
      : null,
    capturedAt: behaviorPayload?.capturedAt || null,
    activityStateUpdatedAt: behaviorPayload?.activityStateUpdatedAt || null,
    rollup7d,
    triggers: Array.isArray(behaviorPayload?.triggers) ? behaviorPayload.triggers : rollup7d?.hqTriggers || [],
    suggestionMetrics: behaviorPayload?.suggestionMetrics || null,
    portalSessions: sessions,
    applications: applications.recent,
    applicationStats: {
      total: applications.total,
      rejections: applications.rejections,
    },
    dbSummary,
    dataSource: rollup7d ? 'phase1_behavior_tracker' : sessions.length ? 'portal_db_sessions' : 'none',
    phase1BehaviorUrl: `${phase1FrontendBase()}/api/hq-behavior?userId=${encodeURIComponent(id)}`,
  };
}
