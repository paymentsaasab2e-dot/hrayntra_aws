import { prisma } from '../../config/prisma.js';
import { isSuperAdminUser } from '../../utils/superAdminScope.js';
import { formatAuthConnectionDetails } from '../../utils/deviceFingerprint.js';

function parseYmd(dateStr) {
  const raw = String(dateStr || '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d, label: raw };
}

export function resolveDateRange({ date, from, to } = {}) {
  if (date) {
    const parsed = parseYmd(date);
    if (!parsed) throw new Error('Invalid date. Use YYYY-MM-DD.');
    const start = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d, 0, 0, 0, 0));
    const end = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d, 23, 59, 59, 999));
    return { start, end, dateLabel: parsed.label };
  }

  if (from || to) {
    const start = from ? new Date(from) : new Date(0);
    const end = to ? new Date(to) : new Date();
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error('Invalid from/to date range');
    }
    return { start, end, dateLabel: null };
  }

  const today = new Date();
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const d = today.getUTCDate();
  const start = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, d, 23, 59, 59, 999));
  const dateLabel = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return { start, end, dateLabel };
}

function displayName(user) {
  if (!user) return 'Unknown';
  if (user.name) return user.name;
  const parts = [user.firstName, user.lastName].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return user.email || 'Unknown';
}

function buildSuperAdminMemberWhere(req) {
  if (!isSuperAdminUser(req) || !req?.user?.id) return {};
  return {
    OR: [
      { id: req.user.id },
      { credential: { is: { createdBy: req.user.id } } },
    ],
  };
}

function mapCrmActivity(row) {
  return {
    id: `crm-${row.id}`,
    source: 'crm',
    kind: 'crm_action',
    title: row.action,
    description: row.description || undefined,
    module: row.category || row.entityType || 'CRM',
    entityType: row.entityType || undefined,
    entityId: row.entityId || row.relatedId || undefined,
    relatedLabel: row.relatedLabel || undefined,
    category: row.category || undefined,
    at: row.createdAt,
  };
}

function mapTeamActivity(row) {
  const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  const ipAddress = meta.ipAddress ? String(meta.ipAddress) : undefined;
  const device = meta.device ? String(meta.device) : undefined;
  const isAuthEvent = row.module === 'Auth' || row.action === 'Logged out';
  const connectionDetails = formatAuthConnectionDetails(ipAddress, device);
  let description = meta.description ? String(meta.description) : undefined;
  if (isAuthEvent && connectionDetails) {
    description = connectionDetails;
  }

  return {
    id: `team-${row.id}`,
    source: 'team',
    kind: row.module === 'Auth' ? 'auth' : 'team_action',
    title: row.action,
    description,
    module: row.module,
    ipAddress,
    device,
    at: row.timestamp,
  };
}

function mapLoginHistory(row, outcomeLabel) {
  const title =
    row.outcome === 'SUCCESS'
      ? 'Logged in'
      : row.outcome === 'FAILED'
        ? 'Login failed'
        : row.outcome === 'LOCKED'
          ? 'Login blocked (locked)'
          : `Login attempt (${row.outcome})`;

  return {
    id: `login-${row.id}`,
    source: 'auth',
    kind: 'login',
    title,
    description: formatAuthConnectionDetails(row.ipAddress, row.device),
    module: 'Auth',
    outcome: row.outcome,
    ipAddress: row.ipAddress || undefined,
    device: row.device || undefined,
    at: row.timestamp,
  };
}

async function fetchCredentialIdsByUserIds(userIds) {
  if (!userIds.length) return new Map();
  const credentials = await prisma.userCredential.findMany({
    where: { userId: { in: userIds } },
    select: { id: true, userId: true },
  });
  const map = new Map();
  credentials.forEach((c) => map.set(c.userId, c.id));
  return map;
}

async function collectTimelineForUser(userId, start, end) {
  const credentialId = (
    await prisma.userCredential.findUnique({
      where: { userId },
      select: { id: true },
    })
  )?.id;

  const [crmRows, teamRows, loginRows] = await Promise.all([
    prisma.activity.findMany({
      where: {
        performedById: userId,
        createdAt: { gte: start, lte: end },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
    prisma.userActivity.findMany({
      where: {
        userId,
        timestamp: { gte: start, lte: end },
      },
      orderBy: { timestamp: 'desc' },
      take: 500,
    }),
    credentialId
      ? prisma.loginHistory.findMany({
          where: {
            credentialId,
            timestamp: { gte: start, lte: end },
          },
          orderBy: { timestamp: 'desc' },
          take: 200,
        })
      : Promise.resolve([]),
  ]);

  const items = [
    ...crmRows.map(mapCrmActivity),
    ...teamRows.map(mapTeamActivity),
    ...loginRows.map((r) => mapLoginHistory(r)),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const summary = {
    total: items.length,
    logins: items.filter((i) => i.kind === 'login' && i.outcome === 'SUCCESS').length,
    loginFailures: items.filter((i) => i.kind === 'login' && i.outcome === 'FAILED').length,
    logouts: items.filter((i) => i.title === 'Logged out').length,
    crm: items.filter((i) => i.source === 'crm').length,
    team: items.filter((i) => i.source === 'team' && i.module !== 'Auth').length,
  };

  return { items, summary };
}

function summarizeCountsForUsers(userIds, crmRows, teamRows, loginRows, credIdToUserId) {
  const stats = new Map();
  userIds.forEach((id) => {
    stats.set(id, {
      eventCount: 0,
      loginCount: 0,
      crmActionCount: 0,
      teamActionCount: 0,
      lastActivityAt: null,
    });
  });

  const bump = (userId, atIso, bucket, extra = {}) => {
    const s = stats.get(userId);
    if (!s) return;
    s.eventCount += 1;
    if (bucket === 'login' && extra.outcome === 'SUCCESS') s.loginCount += 1;
    if (bucket === 'crm') s.crmActionCount += 1;
    if (bucket === 'team') s.teamActionCount += 1;
    if (atIso) {
      const t = new Date(atIso).getTime();
      const prev = s.lastActivityAt ? new Date(s.lastActivityAt).getTime() : 0;
      if (t > prev) s.lastActivityAt = new Date(atIso).toISOString();
    }
  };

  crmRows.forEach((r) => bump(r.performedById, r.createdAt, 'crm'));
  teamRows.forEach((r) => bump(r.userId, r.timestamp, 'team'));
  loginRows.forEach((r) => {
    const uid = credIdToUserId.get(r.credentialId);
    if (uid) bump(uid, r.timestamp, 'login', { outcome: r.outcome });
  });

  return stats;
}

export const memberAuditService = {
  async getTeamOverview(req) {
    const { start, end, dateLabel } = resolveDateRange(req.query || {});
    const { search } = req.query || {};

    const andFilters = [buildSuperAdminMemberWhere(req)];
    if (search) {
      const term = String(search).trim();
      andFilters.push({
        OR: [
          { firstName: { contains: term, mode: 'insensitive' } },
          { lastName: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
          { name: { contains: term, mode: 'insensitive' } },
        ],
      });
    }

    const where = andFilters.filter((f) => Object.keys(f).length).length
      ? { AND: andFilters.filter((f) => Object.keys(f).length) }
      : {};

    const members = await prisma.user.findMany({
      where,
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      take: 200,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        email: true,
        avatar: true,
        status: true,
        lastLogin: true,
        systemRole: { select: { roleName: true } },
      },
    });

    const userIds = members.map((m) => m.id);
    if (!userIds.length) {
      return { date: dateLabel, members: [] };
    }

    const credMap = await fetchCredentialIdsByUserIds(userIds);
    const credentialIds = [...credMap.values()];
    const credIdToUserId = new Map([...credMap.entries()].map(([uid, cid]) => [cid, uid]));

    const [crmRows, teamRows, loginRows] = await Promise.all([
      prisma.activity.findMany({
        where: {
          performedById: { in: userIds },
          createdAt: { gte: start, lte: end },
        },
        select: { performedById: true, createdAt: true },
      }),
      prisma.userActivity.findMany({
        where: {
          userId: { in: userIds },
          timestamp: { gte: start, lte: end },
        },
        select: { userId: true, timestamp: true },
      }),
      credentialIds.length
        ? prisma.loginHistory.findMany({
            where: {
              credentialId: { in: credentialIds },
              timestamp: { gte: start, lte: end },
            },
            select: { credentialId: true, timestamp: true, outcome: true },
          })
        : Promise.resolve([]),
    ]);

    const countMap = summarizeCountsForUsers(userIds, crmRows, teamRows, loginRows, credIdToUserId);

    return {
      date: dateLabel,
      range: { from: start.toISOString(), to: end.toISOString() },
      members: members.map((m) => {
        const c = countMap.get(m.id) || {
          eventCount: 0,
          loginCount: 0,
          crmActionCount: 0,
          teamActionCount: 0,
          lastActivityAt: null,
        };
        return {
          id: m.id,
          name: displayName(m),
          email: m.email,
          avatar: m.avatar,
          status: m.status,
          roleName: m.systemRole?.roleName || null,
          lastLogin: m.lastLogin,
          ...c,
        };
      }),
    };
  },

  async getMemberTimeline(req, userId) {
    const member = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        email: true,
        avatar: true,
        status: true,
        systemRole: { select: { roleName: true } },
      },
    });

    if (!member) {
      return null;
    }

    const { start, end, dateLabel } = resolveDateRange(req.query || {});
    const { items, summary } = await collectTimelineForUser(userId, start, end);

    const groups = [];
    const byHour = new Map();
    items.forEach((item) => {
      const d = new Date(item.at);
      const label = d.toLocaleString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'UTC',
      });
      const key = `${d.getUTCHours()}`;
      if (!byHour.has(key)) {
        byHour.set(key, { label, items: [] });
      }
      byHour.get(key).items.push(item);
    });
    [...byHour.entries()]
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .forEach(([, group]) => groups.push(group));

    return {
      date: dateLabel,
      range: { from: start.toISOString(), to: end.toISOString() },
      member: {
        id: member.id,
        name: displayName(member),
        email: member.email,
        avatar: member.avatar,
        status: member.status,
        roleName: member.systemRole?.roleName || null,
      },
      summary,
      items,
      groups,
    };
  },
};
