import { prisma } from '../config/prisma.js';
import { userHasAnyPermission } from '../modules/role/permission-aliases.js';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeId(value) {
  return String(value || '').trim();
}

function formatUserName(user) {
  const first = String(user?.firstName || '').trim();
  const last = String(user?.lastName || '').trim();
  const joined = [first, last].filter(Boolean).join(' ');
  return String(user?.name || '').trim() || joined || String(user?.email || '').trim();
}

function serializeTeamRequest(row) {
  return {
    id: row.id,
    subject: row.subject,
    description: row.description,
    priority: row.priority,
    status: row.status,
    sendToId: row.sendToId,
    sendToName: row.sendToName,
    sendToEmail: row.sendToEmail || undefined,
    requestedById: row.requestedById,
    requestedByName: row.requestedByName || undefined,
    requestedByEmail: row.requestedByEmail || undefined,
    reviewedById: row.reviewedById || undefined,
    reviewedByName: row.reviewedByName || undefined,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : undefined,
    reviewNote: row.reviewNote || undefined,
    linkedJobId: row.linkedJobId || undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function getAuthz(req) {
  const authz = req.userWithPermissions || {};
  const permissions = Array.isArray(authz.permissions) ? authz.permissions : [];
  const isSuperAdmin = Boolean(authz.isSuperAdmin);
  return {
    userId: normalizeId(authz.id || req.user?.id),
    email: normalizeEmail(authz.email || req.user?.email),
    name: formatUserName(authz),
    permissions,
    isSuperAdmin,
    canViewAll:
      isSuperAdmin || userHasAnyPermission(permissions, ['view_all_requests', 'all']),
    canDelete:
      isSuperAdmin ||
      userHasAnyPermission(permissions, ['requests_delete', 'view_all_requests', 'all']),
    canUpdate:
      isSuperAdmin || userHasAnyPermission(permissions, ['requests_update', 'all']),
  };
}

function buildSentWhere(authz) {
  const clauses = [{ requestedById: authz.userId }];
  if (authz.email) clauses.push({ requestedByEmail: authz.email });
  return { OR: clauses };
}

function buildInboxWhere(authz) {
  const clauses = [{ sendToId: authz.userId }];
  if (authz.email) clauses.push({ sendToEmail: authz.email });
  return { OR: clauses };
}

function isSender(request, authz) {
  if (authz.userId && normalizeId(request.requestedById) === authz.userId) return true;
  if (authz.email && normalizeEmail(request.requestedByEmail) === authz.email) return true;
  return false;
}

function isRecipient(request, authz) {
  if (authz.userId && normalizeId(request.sendToId) === authz.userId) return true;
  if (authz.email && normalizeEmail(request.sendToEmail) === authz.email) return true;
  return false;
}

/**
 * GET /api/team/requests?box=sent|inbox&all=true
 */
export async function listTeamRequests(req, res) {
  try {
    const authz = getAuthz(req);
    const box = String(req.query.box || 'sent').trim().toLowerCase();
    const viewAll = String(req.query.all || '').trim().toLowerCase() === 'true';

    let where = {};
    // Approvals inbox is always personal — only requests addressed to the signed-in user.
    if (box === 'inbox') {
      where = buildInboxWhere(authz);
    } else if (viewAll && authz.canViewAll) {
      where = {};
    } else {
      where = buildSentWhere(authz);
    }

    const rows = await prisma.teamMemberRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      data: rows.map(serializeTeamRequest),
    });
  } catch (error) {
    console.error('Error listing team requests:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch team requests',
    });
  }
}

/**
 * POST /api/team/requests
 */
export async function createTeamRequest(req, res) {
  try {
    const authz = getAuthz(req);
    const subject = String(req.body?.subject || '').trim();
    const description = String(req.body?.description || '').trim();
    const sendToId = normalizeId(req.body?.sendToId);
    const sendToName = String(req.body?.sendToName || '').trim();
    const priority = String(req.body?.priority || 'medium').trim().toLowerCase();

    if (!sendToId) {
      return res.status(400).json({ success: false, message: 'Send to is required' });
    }
    if (!subject) {
      return res.status(400).json({ success: false, message: 'Subject is required' });
    }
    if (!description) {
      return res.status(400).json({ success: false, message: 'Description is required' });
    }
    if (!['low', 'medium', 'high'].includes(priority)) {
      return res.status(400).json({ success: false, message: 'Invalid priority' });
    }

    const recipient = await prisma.user.findUnique({
      where: { id: sendToId },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        status: true,
        isActive: true,
      },
    });

    if (!recipient) {
      return res.status(404).json({ success: false, message: 'Recipient not found' });
    }

    const resolvedSendToName = sendToName || formatUserName(recipient);
    const resolvedSendToEmail = normalizeEmail(req.body?.sendToEmail) || normalizeEmail(recipient.email);

    const row = await prisma.teamMemberRequest.create({
      data: {
        subject,
        description,
        priority,
        status: 'pending',
        sendToId: recipient.id,
        sendToName: resolvedSendToName,
        sendToEmail: resolvedSendToEmail || null,
        requestedById: authz.userId,
        requestedByName: authz.name || null,
        requestedByEmail: authz.email || null,
      },
    });

    return res.status(201).json({
      success: true,
      data: serializeTeamRequest(row),
    });
  } catch (error) {
    console.error('Error creating team request:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create team request',
    });
  }
}

/**
 * PATCH /api/team/requests/:id/status
 */
export async function updateTeamRequestStatus(req, res) {
  try {
    const authz = getAuthz(req);
    const requestId = normalizeId(req.params.id);
    const status = String(req.body?.status || '').trim().toLowerCase();
    const reviewNote = String(req.body?.reviewNote || '').trim() || null;

    if (!requestId) {
      return res.status(400).json({ success: false, message: 'Request id is required' });
    }
    if (!['approved', 'rejected', 'cancelled'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid request status' });
    }

    const existing = await prisma.teamMemberRequest.findUnique({ where: { id: requestId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    const sender = isSender(existing, authz);
    const recipient = isRecipient(existing, authz);

    if (status === 'cancelled') {
      if (!sender && !authz.canViewAll) {
        return res.status(403).json({ success: false, message: 'Only the sender can cancel this request' });
      }
    } else if (!recipient) {
      return res.status(403).json({ success: false, message: 'Only the recipient can approve or reject this request' });
    }

    if (!authz.canUpdate && !authz.canViewAll) {
      return res.status(403).json({ success: false, message: 'Access denied: requires requests_update' });
    }

    if (existing.status !== 'pending' && status !== existing.status) {
      return res.status(409).json({ success: false, message: 'Request has already been reviewed' });
    }

    const reviewed = ['approved', 'rejected'].includes(status);
    const updated = await prisma.teamMemberRequest.update({
      where: { id: requestId },
      data: {
        status,
        reviewNote,
        reviewedById: reviewed ? authz.userId : existing.reviewedById,
        reviewedByName: reviewed ? authz.name || null : existing.reviewedByName,
        reviewedAt: reviewed ? new Date() : existing.reviewedAt,
      },
    });

    return res.status(200).json({
      success: true,
      data: serializeTeamRequest(updated),
    });
  } catch (error) {
    console.error('Error updating team request status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update team request',
    });
  }
}

/**
 * PATCH /api/team/requests/:id/link-job
 */
export async function linkTeamRequestToJob(req, res) {
  try {
    const authz = getAuthz(req);
    const requestId = normalizeId(req.params.id);
    const jobId = normalizeId(req.body?.jobId);

    if (!requestId) {
      return res.status(400).json({ success: false, message: 'Request id is required' });
    }
    if (!jobId) {
      return res.status(400).json({ success: false, message: 'Job id is required' });
    }

    const existing = await prisma.teamMemberRequest.findUnique({ where: { id: requestId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }
    if (existing.status !== 'approved') {
      return res.status(409).json({ success: false, message: 'Only approved requests can be linked to a job' });
    }
    if (!isRecipient(existing, authz)) {
      return res.status(403).json({ success: false, message: 'Only the request recipient can create a job for this request' });
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true },
    });
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const updated = await prisma.teamMemberRequest.update({
      where: { id: requestId },
      data: { linkedJobId: jobId },
    });

    return res.status(200).json({
      success: true,
      data: serializeTeamRequest(updated),
    });
  } catch (error) {
    console.error('Error linking team request to job:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to link request to job',
    });
  }
}

/**
 * DELETE /api/team/requests/:id
 */
export async function deleteTeamRequest(req, res) {
  try {
    const authz = getAuthz(req);
    const requestId = normalizeId(req.params.id);

    if (!requestId) {
      return res.status(400).json({ success: false, message: 'Request id is required' });
    }

    const existing = await prisma.teamMemberRequest.findUnique({ where: { id: requestId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    const allowed =
      authz.canDelete ||
      isSender(existing, authz) ||
      isRecipient(existing, authz);

    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Access denied: cannot delete this request' });
    }

    await prisma.teamMemberRequest.delete({ where: { id: requestId } });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting team request:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete team request',
    });
  }
}
