const { prisma, retryQuery } = require('../lib/prisma');
const { buildSessionEngagementStats } = require('../utils/session-engagement.util');
const { requireJwtSecret } = require('../config/secrets');
const {
  buildSessionTrackingFields,
} = require('../utils/session-tracking.util');
const jwt = require('jsonwebtoken');

function serializeSession(row) {
  return {
    id: row.id,
    candidateId: row.candidateId,
    loginAt: row.loginAt,
    logoutAt: row.logoutAt,
    durationMs: row.durationMs,
    ipAddress: row.ipAddress,
    deviceType: row.deviceType,
    browser: row.browser,
    operatingSystem: row.operatingSystem,
    country: row.country,
    state: row.state,
    city: row.city,
    timezone: row.timezone,
    isActive: row.isActive !== false && !row.logoutAt,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
  };
}

function issueCandidateToken(candidate) {
  return jwt.sign(
    {
      candidateId: candidate.id,
      whatsappNumber: candidate.whatsappNumber,
      isVerified: true,
      hqImpersonation: true,
    },
    requireJwtSecret(),
    { expiresIn: '2h' },
  );
}

function phase1FrontendBase() {
  return String(
    process.env.PHASE1_FRONTEND_URL ||
      process.env.JOB_PORTAL_FRONTEND_URL ||
      process.env.FRONTEND_URL ||
      process.env.CLIENT_URL ||
      'http://localhost:3000',
  )
    .trim()
    .replace(/\/+$/, '');
}

async function createImpersonationSession(req, candidateId, token) {
  try {
    const tracking = buildSessionTrackingFields(req, req.body || {});
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    await prisma.session.create({
      data: {
        candidateId,
        token,
        expiresAt,
        ...tracking,
      },
    });
  } catch (err) {
    console.warn('[hq-impersonate] session create failed:', err?.message || err);
  }
}

/**
 * POST /api/hq/impersonate-candidate
 * Body: { email? , candidateId? }
 * Issues a short-lived job-portal JWT so HQ can open the candidate account.
 */
async function impersonateCandidate(req, res) {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const candidateId = String(req.body?.candidateId || req.body?.id || '').trim();
    if (!email && !candidateId) {
      return res.status(400).json({
        success: false,
        message: 'email or candidateId is required',
      });
    }

    const where = candidateId
      ? { id: candidateId, isDeleted: { not: true } }
      : { email, isDeleted: { not: true } };

    let candidate = await retryQuery(async () =>
      prisma.candidate.findFirst({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          whatsappNumber: true,
          passwordHash: true,
          isVerified: true,
          status: true,
          updatedAt: true,
        },
      }),
    );

    // Fallback: case-insensitive email scan when exact match misses.
    if (!candidate && email && !candidateId) {
      const rows = await retryQuery(async () =>
        prisma.candidate.findMany({
          where: { isDeleted: { not: true } },
          take: 5000,
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            whatsappNumber: true,
            passwordHash: true,
            isVerified: true,
            status: true,
            updatedAt: true,
          },
        }),
      );
      candidate = rows.find((row) => String(row.email || '').trim().toLowerCase() === email) || null;
    }

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Job portal candidate not found',
      });
    }

    const token = issueCandidateToken(candidate);
    await createImpersonationSession(req, candidate.id, token);

    const name =
      [candidate.firstName, candidate.lastName].filter(Boolean).join(' ').trim() ||
      candidate.email ||
      'Candidate';
    const frontendBase = phase1FrontendBase();
    const loginUrl = `${frontendBase}/candidate-dashboard#hqCandidateLogin=${encodeURIComponent(token)}`;

    return res.json({
      success: true,
      data: {
        token,
        candidateId: candidate.id,
        email: candidate.email || email || null,
        name,
        hasPassword: Boolean(candidate.passwordHash),
        isVerified: Boolean(candidate.isVerified),
        loginUrl,
        expiresIn: '2h',
      },
    });
  } catch (error) {
    console.error('hq impersonateCandidate:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create candidate login session',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * POST /api/hq/candidate-lookup
 * Body: { email? , candidateId? }
 * Soft status for HQ Account Support (no login session created).
 */
async function lookupCandidate(req, res) {
  try {
    const email = String(req.body?.email || req.query?.email || '')
      .trim()
      .toLowerCase();
    const candidateId = String(
      req.body?.candidateId || req.body?.id || req.query?.candidateId || '',
    ).trim();
    if (!email && !candidateId) {
      return res.status(400).json({
        success: false,
        message: 'email or candidateId is required',
      });
    }

    const where = candidateId
      ? { id: candidateId, isDeleted: { not: true } }
      : { email, isDeleted: { not: true } };

    let candidate = await retryQuery(async () =>
      prisma.candidate.findFirst({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          passwordHash: true,
          isVerified: true,
          status: true,
          updatedAt: true,
          createdAt: true,
        },
      }),
    );

    if (!candidate && email && !candidateId) {
      const rows = await retryQuery(async () =>
        prisma.candidate.findMany({
          where: { isDeleted: { not: true } },
          take: 2000,
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            passwordHash: true,
            isVerified: true,
            status: true,
            updatedAt: true,
            createdAt: true,
          },
        }),
      );
      candidate =
        rows.find((row) => String(row.email || '').trim().toLowerCase() === email) || null;
    }

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Job portal candidate not found',
      });
    }

    let lastLoginAt = null;
    try {
      const session = await prisma.session.findFirst({
        where: { candidateId: candidate.id },
        orderBy: { loginAt: 'desc' },
        select: { loginAt: true },
      });
      lastLoginAt = session?.loginAt ? new Date(session.loginAt).toISOString() : null;
    } catch {
      lastLoginAt = null;
    }

    const name =
      [candidate.firstName, candidate.lastName].filter(Boolean).join(' ').trim() ||
      candidate.email ||
      'Candidate';

    return res.json({
      success: true,
      data: {
        exists: true,
        candidateId: candidate.id,
        email: candidate.email || email || null,
        name,
        status: candidate.status || null,
        isVerified: Boolean(candidate.isVerified),
        passwordGenerated: Boolean(candidate.passwordHash),
        hasLoggedInToPortal: Boolean(lastLoginAt),
        lastLoginAt,
        createdAt: candidate.createdAt
          ? new Date(candidate.createdAt).toISOString()
          : null,
      },
    });
  } catch (error) {
    console.error('hq lookupCandidate:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to look up candidate',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * GET /api/hq/sessions/:candidateId
 * Login sessions + duration / location / best alert send window.
 */
async function getCandidateSessions(req, res) {
  try {
    const candidateId = String(req.params.candidateId || '').trim();
    if (!candidateId) {
      return res.status(400).json({ success: false, message: 'candidateId is required' });
    }
    const limit = Math.min(100, Math.max(1, Number(req.query?.limit) || 40));

    const sessionsRaw = await retryQuery(async () =>
      prisma.session.findMany({
        where: { candidateId },
        orderBy: { loginAt: 'desc' },
        take: limit,
        select: {
          id: true,
          candidateId: true,
          loginAt: true,
          logoutAt: true,
          durationMs: true,
          ipAddress: true,
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
      }),
    );

    const sessions = sessionsRaw.map(serializeSession);
    const engagement = buildSessionEngagementStats(sessions);

    return res.json({
      success: true,
      data: {
        candidateId,
        sessions,
        engagement,
        alertTiming: engagement.alertTiming,
        locations: engagement.locations,
      },
    });
  } catch (error) {
    console.error('hq getCandidateSessions:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load sessions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * GET /api/hq/sessions?limit=50
 * Recent login sessions across candidates (simple HQ feed).
 */
async function listRecentSessions(req, res) {
  try {
    const limit = Math.min(200, Math.max(1, Number(req.query?.limit) || 50));
    const sessionsRaw = await retryQuery(async () =>
      prisma.session.findMany({
        orderBy: { loginAt: 'desc' },
        take: limit,
        select: {
          id: true,
          candidateId: true,
          loginAt: true,
          logoutAt: true,
          durationMs: true,
          ipAddress: true,
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
      }),
    );

    const sessions = sessionsRaw.map(serializeSession);
    const byCandidate = new Map();
    for (const s of sessions) {
      const id = s.candidateId;
      if (!id) continue;
      const bucket = byCandidate.get(id) || [];
      bucket.push(s);
      byCandidate.set(id, bucket);
    }

    const users = [...byCandidate.entries()].map(([candidateId, rows]) => {
      const engagement = buildSessionEngagementStats(rows);
      return {
        candidateId,
        sessionCount: engagement.sessionCount,
        alertTiming: engagement.alertTiming,
        topLocation: engagement.locations[0] || null,
        avgDurationMs: engagement.avgDurationMs,
        lastLoginAt: rows[0]?.loginAt || rows[0]?.createdAt || null,
      };
    });

    return res.json({
      success: true,
      data: {
        count: sessions.length,
        users,
        sessions,
      },
    });
  } catch (error) {
    console.error('hq listRecentSessions:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to list sessions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

module.exports = {
  getCandidateSessions,
  listRecentSessions,
  impersonateCandidate,
  lookupCandidate,
};
