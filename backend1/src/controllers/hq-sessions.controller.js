const { prisma, retryQuery } = require('../lib/prisma');
const { buildSessionEngagementStats } = require('../utils/session-engagement.util');

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
};
