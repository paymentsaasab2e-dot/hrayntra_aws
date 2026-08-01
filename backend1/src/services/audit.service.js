/**
 * System Audit Logs — durable trail of administrative / privileged actions.
 * Primary: Prisma SystemAuditLog (Mongo). Fallback: JSON file under data/.
 */

const fs = require('fs');
const path = require('path');
const { prisma } = require('../lib/prisma');

const DATA_DIR = path.join(__dirname, '../../data');
const FILE_PATH = path.join(DATA_DIR, 'system-audit-logs.json');
const MAX_FILE_EVENTS = 5000;
const HQ_RELEASE_PATH = path.join(DATA_DIR, 'hq-audit-releases.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readFileEvents() {
  try {
    ensureDataDir();
    if (!fs.existsSync(FILE_PATH)) return [];
    const raw = fs.readFileSync(FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeFileEvents(events) {
  ensureDataDir();
  const trimmed = events.slice(0, MAX_FILE_EVENTS);
  fs.writeFileSync(FILE_PATH, JSON.stringify(trimmed, null, 2), 'utf8');
  return trimmed;
}

function readHqReleases() {
  try {
    ensureDataDir();
    if (!fs.existsSync(HQ_RELEASE_PATH)) return [];
    const parsed = JSON.parse(fs.readFileSync(HQ_RELEASE_PATH, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeHqReleases(releases) {
  ensureDataDir();
  fs.writeFileSync(HQ_RELEASE_PATH, JSON.stringify(releases.slice(0, 200), null, 2), 'utf8');
}

function uid(prefix = 'aud') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeInput(input = {}) {
  const capturedAt = input.capturedAt ? new Date(input.capturedAt) : new Date();
  return {
    action: String(input.action || '').trim().slice(0, 120),
    entityType: String(input.entityType || 'system').trim().slice(0, 80),
    entityId: input.entityId != null ? String(input.entityId).slice(0, 120) : null,
    actorId: input.actorId != null ? String(input.actorId).slice(0, 120) : null,
    actorLabel: input.actorLabel != null ? String(input.actorLabel).slice(0, 160) : null,
    actorRole: input.actorRole != null ? String(input.actorRole).slice(0, 80) : 'admin',
    source: input.source != null ? String(input.source).slice(0, 120) : null,
    status: String(input.status || 'success').slice(0, 40),
    ipAddress: input.ipAddress != null ? String(input.ipAddress).slice(0, 80) : null,
    userAgent: input.userAgent != null ? String(input.userAgent).slice(0, 400) : null,
    metadata:
      input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
        ? input.metadata
        : input.metadata != null
          ? { value: input.metadata }
          : null,
    capturedAt: Number.isNaN(capturedAt.getTime()) ? new Date() : capturedAt,
  };
}

function toPublic(row) {
  if (!row) return null;
  return {
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId || null,
    actorId: row.actorId || null,
    actorLabel: row.actorLabel || null,
    actorRole: row.actorRole || null,
    source: row.source || null,
    status: row.status || 'success',
    ipAddress: row.ipAddress || null,
    userAgent: row.userAgent || null,
    metadata: row.metadata || null,
    capturedAt: row.capturedAt instanceof Date ? row.capturedAt.toISOString() : row.capturedAt,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  };
}

/**
 * Write one audit event. Never throws to callers — returns { ok, event?, error? }.
 */
async function writeAuditEvent(input) {
  const data = normalizeInput(input);
  if (!data.action) {
    return { ok: false, error: 'action is required' };
  }

  let prismaRow = null;
  try {
    if (prisma?.systemAuditLog?.create) {
      prismaRow = await prisma.systemAuditLog.create({
        data: {
          action: data.action,
          entityType: data.entityType,
          entityId: data.entityId,
          actorId: data.actorId,
          actorLabel: data.actorLabel,
          actorRole: data.actorRole,
          source: data.source,
          status: data.status,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          metadata: data.metadata ?? undefined,
          capturedAt: data.capturedAt,
        },
      });
    }
  } catch (err) {
    console.warn('[audit] Prisma write skipped:', err.message);
  }

  const fileEvent = {
    id: prismaRow?.id || uid('aud'),
    ...data,
    capturedAt: data.capturedAt.toISOString(),
    createdAt: new Date().toISOString(),
  };

  try {
    const events = readFileEvents();
    events.unshift(fileEvent);
    writeFileEvents(events);
  } catch (err) {
    console.warn('[audit] File write failed:', err.message);
    if (!prismaRow) {
      return { ok: false, error: err.message };
    }
  }

  return { ok: true, event: toPublic(prismaRow || fileEvent) };
}

/** Fire-and-forget helper for controllers. */
function recordAdminAudit(input) {
  void writeAuditEvent(input).catch((err) => {
    console.warn('[audit] recordAdminAudit failed:', err?.message || err);
  });
}

function matchFilters(event, filters = {}) {
  if (filters.action && event.action !== filters.action) return false;
  if (filters.entityType && event.entityType !== filters.entityType) return false;
  if (filters.actorId && event.actorId !== filters.actorId) return false;
  if (filters.source && event.source !== filters.source) return false;
  if (filters.q) {
    const hay = [
      event.action,
      event.entityType,
      event.entityId,
      event.actorId,
      event.actorLabel,
      event.source,
      JSON.stringify(event.metadata || {}),
    ]
      .join(' ')
      .toLowerCase();
    if (!hay.includes(String(filters.q).toLowerCase())) return false;
  }
  if (filters.from) {
    const from = new Date(filters.from).getTime();
    if (!Number.isNaN(from) && new Date(event.capturedAt).getTime() < from) return false;
  }
  if (filters.to) {
    const to = new Date(filters.to).getTime();
    if (!Number.isNaN(to) && new Date(event.capturedAt).getTime() > to) return false;
  }
  return true;
}

async function listAuditEvents(filters = {}) {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(filters.limit) || 50));

  let rows = [];
  try {
    if (prisma?.systemAuditLog?.findMany) {
      const where = {};
      if (filters.action) where.action = String(filters.action);
      if (filters.entityType) where.entityType = String(filters.entityType);
      if (filters.actorId) where.actorId = String(filters.actorId);
      if (filters.source) where.source = String(filters.source);
      if (filters.from || filters.to) {
        where.capturedAt = {};
        if (filters.from) where.capturedAt.gte = new Date(filters.from);
        if (filters.to) where.capturedAt.lte = new Date(filters.to);
      }
      const [total, items] = await Promise.all([
        prisma.systemAuditLog.count({ where }),
        prisma.systemAuditLog.findMany({
          where,
          orderBy: { capturedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);
      let mapped = items.map(toPublic);
      if (filters.q) {
        mapped = mapped.filter((e) => matchFilters(e, { q: filters.q }));
      }
      return {
        events: mapped,
        pagination: { page, limit, total: filters.q ? mapped.length : total },
      };
    }
  } catch (err) {
    console.warn('[audit] Prisma list skipped:', err.message);
  }

  const all = readFileEvents().filter((e) => matchFilters(e, filters));
  const total = all.length;
  const start = (page - 1) * limit;
  return {
    events: all.slice(start, start + limit).map(toPublic),
    pagination: { page, limit, total },
  };
}

async function getAuditEventById(id) {
  if (!id) return null;
  try {
    if (prisma?.systemAuditLog?.findUnique) {
      const row = await prisma.systemAuditLog.findUnique({ where: { id } });
      if (row) return toPublic(row);
    }
  } catch (err) {
    console.warn('[audit] Prisma get skipped:', err.message);
  }
  return toPublic(readFileEvents().find((e) => e.id === id) || null);
}

/**
 * Build an HQ release package — snapshot of recent admin audit events
 * for management / HQ to attach in CRM or ops dashboards.
 */
async function buildHqAuditRelease(options = {}) {
  const sinceHours = Math.min(720, Math.max(1, Number(options.sinceHours) || 24));
  const limit = Math.min(500, Math.max(1, Number(options.limit) || 200));
  const from = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();

  const { events, pagination } = await listAuditEvents({
    from,
    limit,
    page: 1,
    action: options.action,
    entityType: options.entityType,
  });

  const byAction = {};
  for (const e of events) {
    byAction[e.action] = (byAction[e.action] || 0) + 1;
  }

  const release = {
    releaseId: uid('hqaud'),
    version: '1.0',
    product: 'HRYantra Portal (backend1)',
    purpose: 'System audit logs for administrative actions — HQ attach package',
    generatedAt: new Date().toISOString(),
    window: {
      sinceHours,
      from,
      to: new Date().toISOString(),
    },
    summary: {
      eventCount: events.length,
      totalMatched: pagination.total,
      byAction,
      highRiskActions: events
        .filter((e) =>
          /delete|purge|bulk|role|token|suspend|grant/i.test(e.action),
        )
        .slice(0, 50)
        .map((e) => ({
          id: e.id,
          action: e.action,
          entityType: e.entityType,
          entityId: e.entityId,
          actorLabel: e.actorLabel,
          capturedAt: e.capturedAt,
        })),
    },
    events,
    attachHints: {
      header: 'x-internal-admin-key',
      pollFeed: 'GET /api/audit/hq/feed',
      release: 'GET|POST /api/audit/hq/release',
      listEvents: 'GET /api/audit/events',
      writeEvent: 'POST /api/audit/events',
      nextProxy: 'GET|POST /api/hq-audit (jobportal Next app)',
    },
  };

  return release;
}

async function persistHqRelease(release, meta = {}) {
  const packageRow = {
    ...release,
    acknowledgedAt: meta.acknowledged ? new Date().toISOString() : null,
    acknowledgedBy: meta.acknowledgedBy || null,
    note: meta.note || null,
  };
  const all = readHqReleases();
  all.unshift(packageRow);
  writeHqReleases(all);

  await writeAuditEvent({
    action: 'audit.hq_release',
    entityType: 'hq_release',
    entityId: release.releaseId,
    actorId: meta.acknowledgedBy || 'hq',
    actorLabel: meta.actorLabel || 'HQ Release',
    actorRole: 'hq',
    source: 'audit.hq.release',
    status: 'success',
    metadata: {
      eventCount: release.summary?.eventCount,
      sinceHours: release.window?.sinceHours,
      acknowledged: Boolean(meta.acknowledged),
      note: meta.note || null,
    },
  });

  return packageRow;
}

function listHqReleases(limit = 20) {
  return readHqReleases().slice(0, Math.min(100, Math.max(1, limit)));
}

/**
 * Extract request context for audit from Express req.
 */
function auditContextFromReq(req, overrides = {}) {
  const ip =
    req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    null;
  return {
    ipAddress: ip,
    userAgent: req.headers['user-agent'] || null,
    actorId: overrides.actorId || req.headers['x-admin-actor-id'] || req.user?.candidateId || 'admin',
    actorLabel:
      overrides.actorLabel ||
      req.headers['x-admin-actor-label'] ||
      'Super Admin',
    actorRole: overrides.actorRole || req.headers['x-admin-actor-role'] || 'admin',
    source: overrides.source || req.headers['x-audit-source'] || 'api',
    ...overrides,
  };
}

module.exports = {
  writeAuditEvent,
  recordAdminAudit,
  listAuditEvents,
  getAuditEventById,
  buildHqAuditRelease,
  persistHqRelease,
  listHqReleases,
  auditContextFromReq,
};
