const {
  writeAuditEvent,
  listAuditEvents,
  getAuditEventById,
  buildHqAuditRelease,
  persistHqRelease,
  listHqReleases,
  auditContextFromReq,
} = require('../services/audit.service');

async function createAuditEvent(req, res) {
  try {
    const ctx = auditContextFromReq(req);
    const result = await writeAuditEvent({
      ...ctx,
      action: req.body?.action,
      entityType: req.body?.entityType,
      entityId: req.body?.entityId,
      actorId: req.body?.actorId || ctx.actorId,
      actorLabel: req.body?.actorLabel || ctx.actorLabel,
      actorRole: req.body?.actorRole || ctx.actorRole,
      source: req.body?.source || ctx.source,
      status: req.body?.status,
      metadata: req.body?.metadata,
      capturedAt: req.body?.capturedAt,
      ipAddress: req.body?.ipAddress || ctx.ipAddress,
      userAgent: req.body?.userAgent || ctx.userAgent,
    });

    if (!result.ok) {
      return res.status(400).json({ success: false, message: result.error || 'Invalid event' });
    }

    return res.status(201).json({
      success: true,
      message: 'Audit event recorded',
      data: result.event,
    });
  } catch (error) {
    console.error('createAuditEvent:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to record audit event',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

async function listEvents(req, res) {
  try {
    const data = await listAuditEvents({
      page: req.query.page,
      limit: req.query.limit,
      action: req.query.action,
      entityType: req.query.entityType,
      actorId: req.query.actorId,
      source: req.query.source,
      from: req.query.from,
      to: req.query.to,
      q: req.query.q,
    });
    return res.json({ success: true, data });
  } catch (error) {
    console.error('listEvents:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to list audit events',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

async function getEvent(req, res) {
  try {
    const event = await getAuditEventById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Audit event not found' });
    }
    return res.json({ success: true, data: event });
  } catch (error) {
    console.error('getEvent:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load audit event',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * HQ release endpoint — attachable package of recent admin audit logs.
 * GET  = build preview package (does not persist unless ?persist=1)
 * POST = build + persist release (optional acknowledge for HQ systems)
 */
async function hqRelease(req, res) {
  try {
    const body = req.method === 'POST' ? req.body || {} : {};
    const sinceHours = Number(req.query.sinceHours || body.sinceHours || 24);
    const limit = Number(req.query.limit || body.limit || 200);
    const persist =
      req.method === 'POST' ||
      String(req.query.persist || '') === '1' ||
      body.persist === true;

    const release = await buildHqAuditRelease({
      sinceHours,
      limit,
      action: req.query.action || body.action,
      entityType: req.query.entityType || body.entityType,
    });

    let saved = null;
    if (persist) {
      saved = await persistHqRelease(release, {
        acknowledged: Boolean(body.acknowledge || body.acknowledged),
        acknowledgedBy: body.acknowledgedBy || body.hqSystemId || 'hq',
        actorLabel: body.actorLabel || 'HQ',
        note: body.note || null,
      });
    }

    return res.json({
      success: true,
      message: persist
        ? 'HQ audit release package created and stored'
        : 'HQ audit release package (preview)',
      data: {
        release: saved || release,
        persisted: Boolean(persist),
      },
    });
  } catch (error) {
    console.error('hqRelease:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to build HQ audit release',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/** Continuous HQ feed — recent events + last releases. */
async function hqFeed(req, res) {
  try {
    const limit = Number(req.query.limit || 50);
    const sinceHours = Number(req.query.sinceHours || 24);
    const from = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();
    const { events, pagination } = await listAuditEvents({ from, limit, page: 1 });
    const releases = listHqReleases(10);

    return res.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        window: { sinceHours, from },
        events,
        pagination,
        releases,
      },
    });
  } catch (error) {
    console.error('hqFeed:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load HQ audit feed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

async function listReleases(req, res) {
  try {
    const releases = listHqReleases(Number(req.query.limit || 20));
    return res.json({ success: true, data: { releases, count: releases.length } });
  } catch (error) {
    console.error('listReleases:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to list HQ releases',
    });
  }
}

module.exports = {
  createAuditEvent,
  listEvents,
  getEvent,
  hqRelease,
  hqFeed,
  listReleases,
};
