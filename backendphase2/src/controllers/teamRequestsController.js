import { prisma } from '../config/prisma.js';
import { userHasAnyPermission } from '../modules/role/permission-aliases.js';
import { logCrmGlobalActivity } from '../utils/crmGlobalActivity.js';
import { taskService } from '../modules/task/task.service.js';
import {
  assertCanSetSelfAsTaskCompletionApprover,
  assertValidTaskCompletionApprover,
} from '../services/taskAssignmentScope.service.js';

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
    linkedTaskId: row.linkedTaskId || undefined,
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
      return res.status(400).json({ success: false, message: 'Remark is required' });
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

    const existingPending = await prisma.teamMemberRequest.findFirst({
      where: {
        requestedById: authz.userId,
        sendToId: recipient.id,
        subject,
        status: 'pending',
      },
      select: { id: true },
    });
    if (existingPending) {
      return res.status(400).json({
        success: false,
        message:
          'A request with this subject is already pending approval. Wait for a response before sending again.',
      });
    }

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

    await logCrmGlobalActivity({
      performedById: authz.userId,
      action: 'Team request sent',
      description: `${subject} — ${description}`,
      entityType: 'USER',
      entityId: recipient.id,
      category: 'Request',
      relatedType: 'TEAM_REQUEST',
      relatedId: row.id,
      relatedLabel: subject,
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

    if (status === 'rejected' && !reviewNote) {
      return res.status(400).json({ success: false, message: 'Remark is required when rejecting a request' });
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

    if (reviewed) {
      await logCrmGlobalActivity({
        performedById: authz.userId,
        action: status === 'approved' ? 'Team request approved' : 'Team request rejected',
        description: `${existing.subject}${reviewNote ? ` — ${reviewNote}` : ''}`,
        entityType: 'USER',
        entityId: existing.requestedById,
        category: 'Request',
        relatedType: 'TEAM_REQUEST',
        relatedId: requestId,
        relatedLabel: existing.subject,
      });
    }

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

function mapTeamRequestPriorityToTask(priority) {
  const map = { low: 'Low', medium: 'Medium', high: 'High' };
  return map[String(priority || 'medium').toLowerCase()] || 'Medium';
}

async function createTaskForApprovedTeamRequest(
  existing,
  assignToId,
  approverUserId,
  req,
  { setSelfAsApprover = false, dueDate } = {},
) {
  let completionApproverId = null;
  if (
    setSelfAsApprover &&
    approverUserId &&
    normalizeId(assignToId) !== normalizeId(approverUserId)
  ) {
    await assertCanSetSelfAsTaskCompletionApprover(approverUserId);
    completionApproverId = approverUserId;
    await assertValidTaskCompletionApprover(approverUserId, completionApproverId, assignToId);
  }

  const resolvedDueDate =
    dueDate && String(dueDate).trim()
      ? String(dueDate).trim()
      : new Date().toISOString().split('T')[0];

  const task = await taskService.create(
    {
      title: existing.subject,
      description: [
        existing.description,
        existing.requestedByName ? `Requested by ${existing.requestedByName}.` : '',
        'Create a job from this approved hiring request.',
      ]
        .filter(Boolean)
        .join('\n\n'),
      assigneeId: assignToId,
      assignedToId: assignToId,
      createdById: existing.requestedById,
      performedById: req?.user?.id || approverUserId,
      priority: mapTeamRequestPriorityToTask(existing.priority),
      dueDate: resolvedDueDate,
      taskType: 'Note',
      linkedEntityType: 'TEAM_REQUEST',
      linkedEntityId: existing.id,
      notifyAssignee: true,
      participantIds: [existing.requestedById, approverUserId, assignToId].filter(Boolean),
      completionApproverId,
    },
    req,
  );
  return task;
}

async function canCreateJobForTeamRequest(existing, authz) {
  if (isRecipient(existing, authz)) return true;
  if (!existing.linkedTaskId) return false;
  const task = await prisma.task.findUnique({
    where: { id: existing.linkedTaskId },
    select: { assignedToId: true },
  });
  return Boolean(task && normalizeId(task.assignedToId) === authz.userId);
}

/**
 * GET /api/team/requests/:id
 */
export async function getTeamRequest(req, res) {
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
      isSender(existing, authz) ||
      isRecipient(existing, authz) ||
      authz.canViewAll ||
      (existing.linkedTaskId
        ? await canCreateJobForTeamRequest(existing, authz)
        : false);

    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    return res.status(200).json({
      success: true,
      data: serializeTeamRequest(existing),
    });
  } catch (error) {
    console.error('Error fetching team request:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch team request',
    });
  }
}

/**
 * PATCH /api/team/requests/:id/create-task
 * Create (or delegate) a hiring-request task to a team member.
 */
export async function forwardTeamRequestToTask(req, res) {
  try {
    const authz = getAuthz(req);
    const requestId = normalizeId(req.params.id);
    const assignToId = normalizeId(req.body?.assignToId);
    const setSelfAsApprover = req.body?.setSelfAsApprover === true;
    const dueDate = String(req.body?.dueDate || '').trim() || null;

    if (!requestId) {
      return res.status(400).json({ success: false, message: 'Request id is required' });
    }
    if (!assignToId) {
      return res.status(400).json({ success: false, message: 'Assignee is required' });
    }

    const existing = await prisma.teamMemberRequest.findUnique({ where: { id: requestId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }
    if (existing.status !== 'approved') {
      return res.status(409).json({ success: false, message: 'Only approved requests can be assigned as tasks' });
    }
    if (!isRecipient(existing, authz)) {
      return res.status(403).json({ success: false, message: 'Only the request recipient can assign this request' });
    }
    if (!authz.canUpdate && !authz.canViewAll) {
      return res.status(403).json({ success: false, message: 'Access denied: requires requests_update' });
    }

    let updated = existing;

    if (!existing.linkedTaskId) {
      const task = await createTaskForApprovedTeamRequest(
        existing,
        assignToId,
        authz.userId,
        req,
        { setSelfAsApprover, dueDate },
      );
      updated = await prisma.teamMemberRequest.update({
        where: { id: requestId },
        data: { linkedTaskId: task.id },
      });

      await logCrmGlobalActivity({
        performedById: authz.userId,
        action: 'Team request assigned as task',
        description: `${existing.subject} assigned for job creation`,
        entityType: 'USER',
        entityId: assignToId,
        category: 'Request',
        relatedType: 'TEAM_REQUEST',
        relatedId: requestId,
        relatedLabel: existing.subject,
      });
    } else {
      await taskService.delegateTask(
        existing.linkedTaskId,
        {
          assignToId,
          setSelfAsApprover,
        },
        req,
      );

      await logCrmGlobalActivity({
        performedById: authz.userId,
        action: 'Team request task delegated',
        description: `${existing.subject} delegated for job creation`,
        entityType: 'USER',
        entityId: assignToId,
        category: 'Request',
        relatedType: 'TEAM_REQUEST',
        relatedId: requestId,
        relatedLabel: existing.subject,
      });
    }

    return res.status(200).json({
      success: true,
      data: serializeTeamRequest(updated),
    });
  } catch (error) {
    console.error('Error assigning team request task:', error);
    const message = error instanceof Error ? error.message : 'Failed to assign task from request';
    const status =
      message.includes('assign tasks') || message.includes('verify completion') ? 403 : 500;
    return res.status(status).json({
      success: false,
      message,
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
    if (!(await canCreateJobForTeamRequest(existing, authz))) {
      return res.status(403).json({
        success: false,
        message: 'Only the request recipient or assigned task owner can create a job for this request',
      });
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
