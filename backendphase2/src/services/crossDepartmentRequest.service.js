import { prisma } from '../config/prisma.js';
import { createAlertNotification } from '../modules/setting/alert-dispatch.service.js';
import { logCrmGlobalActivity } from '../utils/crmGlobalActivity.js';
import { hasPermission } from '../utils/permissionScope.js';
import {
  canInitiateCrossDepartmentRequest,
  findDepartmentHeadUser,
  isDepartmentHeadUser,
  listCrossDepartmentTargetOptions,
} from './departmentRole.service.js';
import { taskService } from '../modules/task/task.service.js';
import { clientService } from '../modules/client/client.service.js';
import {
  assertCanSetSelfAsTaskCompletionApprover,
  assertValidTaskCompletionApprover,
} from './taskAssignmentScope.service.js';

const idStr = (id) => String(id || '').trim();

function formatUserName(user) {
  const parts = [user?.firstName, user?.lastName].filter(Boolean);
  const joined = parts.join(' ').trim();
  return String(user?.name || '').trim() || joined || String(user?.email || '').trim();
}

function serializeRequest(row) {
  return {
    id: row.id,
    subject: row.subject,
    description: row.description || undefined,
    priority: row.priority,
    status: String(row.status || 'PENDING').toLowerCase(),
    workType: row.workType,
    sourceDepartmentId: row.sourceDepartmentId,
    targetDepartmentId: row.targetDepartmentId,
    requestedById: row.requestedById,
    requestedByName: row.requestedByName || undefined,
    targetHeadUserId: row.targetHeadUserId || undefined,
    targetUserId: row.targetUserId || undefined,
    assignedToId: row.assignedToId || undefined,
    reviewedById: row.reviewedById || undefined,
    reviewedByName: row.reviewedByName || undefined,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : undefined,
    reviewNote: row.reviewNote || undefined,
    linkedEntityType: row.linkedEntityType || undefined,
    linkedEntityId: row.linkedEntityId || undefined,
    createdTaskId: row.createdTaskId || undefined,
    payload: row.payload || undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapCrossDeptPriorityToTask(priority) {
  const map = { low: 'Low', medium: 'Medium', high: 'High', LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' };
  return map[String(priority || 'medium')] || 'Medium';
}

async function createCrossDeptHandoffTask(existing, assigneeId, reviewerId, req, options = {}) {
  const { setSelfAsApprover = false, dueDate } = options;
  let completionApproverId = null;
  if (
    setSelfAsApprover &&
    reviewerId &&
    idStr(assigneeId) !== idStr(reviewerId)
  ) {
    await assertCanSetSelfAsTaskCompletionApprover(reviewerId);
    completionApproverId = reviewerId;
    await assertValidTaskCompletionApprover(reviewerId, completionApproverId, assigneeId);
  }

  const resolvedDueDate =
    dueDate && String(dueDate).trim()
      ? String(dueDate).trim()
      : new Date().toISOString().split('T')[0];

  const linkedType = existing.workType === 'CLIENT' ? 'CLIENT' : existing.linkedEntityType || null;

  return taskService.create(
    {
      title: existing.subject,
      description: existing.description || '',
      assigneeId,
      assignedToId: assigneeId,
      createdById: existing.requestedById,
      performedById: reviewerId,
      skipAssignScopeCheck: true,
      priority: mapCrossDeptPriorityToTask(existing.priority),
      dueDate: resolvedDueDate,
      taskType: existing.workType === 'CLIENT' ? 'Follow-up' : 'Note',
      linkedEntityType: linkedType,
      linkedEntityId: existing.linkedEntityId || null,
      notifyAssignee: true,
      participantIds: [existing.requestedById, reviewerId, assigneeId].filter(Boolean),
      completionApproverId,
    },
    req,
  );
}

async function notifyCrossDeptEvent(userId, alertId, { title, description, requestId }) {
  if (!userId) return;
  await createAlertNotification(userId, alertId, {
    category: 'TEAM',
    title,
    description,
    actionLabel: 'Review request',
    actionPath: `/request/approval?tab=cross-dept&requestId=${encodeURIComponent(requestId)}`,
    entityType: 'CROSS_DEPT_REQUEST',
    entityId: requestId,
  });
}

export const crossDepartmentRequestService = {
  async getAssignOptions(actorUserId, req) {
    const canHandoffClient = hasPermission(req, 'clients_handoff');
    const options = await listCrossDepartmentTargetOptions(actorUserId, {
      forceLoadDepartments: canHandoffClient,
    });
    return {
      ...options,
      canHandoffClient,
    };
  },

  async list(actorUserId, { box = 'sent' } = {}) {
    const uid = idStr(actorUserId);
    let where = {};
    if (box === 'inbox') {
      const actor = await prisma.user.findUnique({
        where: { id: uid },
        select: { departmentId: true },
      });
      const isHead = await isDepartmentHeadUser(uid);
      const or = [
        { targetHeadUserId: uid },
        { assignedToId: uid, status: { in: ['ACCEPTED', 'FORWARDED'] } },
      ];
      if (isHead && actor?.departmentId) {
        or.push({
          targetDepartmentId: idStr(actor.departmentId),
          status: 'PENDING',
        });
      }
      where = { OR: or };
    } else {
      where = { requestedById: uid };
    }

    const rows = await prisma.crossDepartmentWorkRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(serializeRequest);
  },

  async create(actorUserId, data, req) {
    const uid = idStr(actorUserId);
    if (!uid) throw new Error('Unauthorized');

    const workType = String(data.workType || 'TASK').toUpperCase();

    if (workType === 'CLIENT') {
      if (!hasPermission(req, 'clients_handoff')) {
        throw new Error('You do not have permission to hand off clients to another department');
      }
    } else {
      const canInitiate = await canInitiateCrossDepartmentRequest(uid);
      if (!canInitiate) {
        throw new Error('Only department heads (rank 1) can create cross-department requests');
      }
    }

    const actor = await prisma.user.findUnique({
      where: { id: uid },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        email: true,
        departmentId: true,
      },
    });
    if (!actor?.departmentId) {
      throw new Error(
        workType === 'CLIENT'
          ? 'You must belong to a department to hand off clients'
          : 'You must belong to a department to send cross-department requests',
      );
    }

    const targetDepartmentId = idStr(data.targetDepartmentId);
    const targetUserId = data.targetUserId ? idStr(data.targetUserId) : null;
    const subject = String(data.subject || '').trim();
    if (!subject) throw new Error('Subject is required');
    const description = data.description ? String(data.description).trim() : '';
    if (!description) throw new Error('Remark is required when sending a request');
    if (!targetDepartmentId) throw new Error('Target department is required');

    const targetDept = await prisma.department.findUnique({
      where: { id: targetDepartmentId },
      select: { id: true, name: true, allowsCrossDepartmentRequests: true },
    });
    if (!targetDept) throw new Error('Target department not found');
    if (!targetDept.allowsCrossDepartmentRequests) {
      throw new Error('Target department does not accept cross-department requests');
    }
    if (idStr(actor.departmentId) === targetDepartmentId) {
      throw new Error('Use normal assignment for members in your own department');
    }

    const headUser = await findDepartmentHeadUser(targetDepartmentId);
    if (!headUser?.id) {
      throw new Error('Target department has no active department head to review this request');
    }

    if (targetUserId) {
      const member = await prisma.user.findFirst({
        where: {
          id: targetUserId,
          departmentId: targetDepartmentId,
          status: 'ACTIVE',
          isActive: true,
        },
        select: { id: true },
      });
      if (!member) throw new Error('Selected member is not in the target department');
    }

    if (workType === 'CLIENT') {
      const clientId = idStr(data.linkedEntityId);
      if (!clientId) throw new Error('Client id is required for client handoff requests');

      const existingPending = await prisma.crossDepartmentWorkRequest.findFirst({
        where: {
          workType: 'CLIENT',
          linkedEntityId: clientId,
          requestedById: uid,
          status: 'PENDING',
        },
        select: { id: true },
      });
      if (existingPending) {
        throw new Error(
          'A handoff request for this client is already pending approval. Wait for a response before sending again.',
        );
      }

      const client = await prisma.client.findFirst({
        where: { id: clientId, isDeleted: { not: true } },
        select: { id: true, companyName: true, assignedToId: true },
      });
      if (!client) throw new Error('Client not found');
      if (client.assignedToId) {
        const assignee = await prisma.user.findUnique({
          where: { id: client.assignedToId },
          select: { departmentId: true },
        });
        if (idStr(assignee?.departmentId) !== idStr(actor.departmentId)) {
          throw new Error(
            'This client is already assigned to another department. Only your department\'s clients can be handed off.',
          );
        }
      }
    }

    const linkedEntityId = idStr(data.linkedEntityId);
    if (linkedEntityId && workType !== 'CLIENT') {
      const existingPending = await prisma.crossDepartmentWorkRequest.findFirst({
        where: {
          workType,
          linkedEntityId,
          requestedById: uid,
          status: 'PENDING',
        },
        select: { id: true },
      });
      if (existingPending) {
        throw new Error(
          'A request for this record is already pending approval. Wait for a response before sending again.',
        );
      }
    }

    const row = await prisma.crossDepartmentWorkRequest.create({
      data: {
        subject,
        description: description || null,
        priority: data.priority || 'medium',
        workType,
        sourceDepartmentId: actor.departmentId,
        targetDepartmentId,
        requestedById: uid,
        requestedByName: formatUserName(actor),
        targetHeadUserId: headUser.id,
        targetUserId,
        linkedEntityType: data.linkedEntityType || null,
        linkedEntityId: data.linkedEntityId || null,
        payload: data.payload || null,
        status: 'PENDING',
      },
    });

    await notifyCrossDeptEvent(headUser.id, 'cross_dept.request_created', {
      title: 'Cross-department work request',
      description: `${formatUserName(actor)} sent "${subject}" to ${targetDept.name}.`,
      requestId: row.id,
    });

    await logCrmGlobalActivity({
      performedById: uid,
      action: workType === 'CLIENT' ? 'Client handoff requested' : 'Cross-department request sent',
      description: `${subject}${description ? ` — ${description}` : ''}`,
      entityType: workType === 'CLIENT' ? 'CLIENT' : 'USER',
      entityId: workType === 'CLIENT' ? data.linkedEntityId || row.id : row.id,
      category: 'Request',
      relatedType: 'CROSS_DEPT_REQUEST',
      relatedId: row.id,
      relatedLabel: subject,
    });

    return serializeRequest(row);
  },

  async review(actorUserId, requestId, { action, note, assignToId, dueDate, setSelfAsApprover } = {}) {
    const uid = idStr(actorUserId);
    const rid = idStr(requestId);
    const normalizedAction = String(action || '').trim().toLowerCase();

    const existing = await prisma.crossDepartmentWorkRequest.findUnique({ where: { id: rid } });
    if (!existing) throw new Error('Request not found');
    if (existing.status !== 'PENDING') {
      throw new Error('Only pending requests can be reviewed');
    }

    const reviewer = await prisma.user.findUnique({
      where: { id: uid },
      select: { id: true, firstName: true, lastName: true, name: true, departmentId: true },
    });
    if (!reviewer) throw new Error('Unauthorized');

    const isTargetHead =
      idStr(existing.targetHeadUserId) === uid ||
      (await isDepartmentHeadUser(uid) && idStr(reviewer.departmentId) === idStr(existing.targetDepartmentId));

    if (!isTargetHead) {
      throw new Error('Only the target department head can approve or reject this request');
    }

    const reviewerName = formatUserName(reviewer);
    const trimmedNote = note ? String(note).trim() : null;

    if (normalizedAction === 'reject') {
      if (!trimmedNote) {
        throw new Error('Remark is required when rejecting a request');
      }
      const updated = await prisma.crossDepartmentWorkRequest.update({
        where: { id: rid },
        data: {
          status: 'REJECTED',
          reviewedById: uid,
          reviewedByName: reviewerName,
          reviewedAt: new Date(),
          reviewNote: trimmedNote,
        },
      });

      await notifyCrossDeptEvent(existing.requestedById, 'cross_dept.request_rejected', {
        title: 'Cross-department request rejected',
        description: `${reviewerName} rejected "${existing.subject}".${trimmedNote ? ` Note: ${trimmedNote}` : ''}`,
        requestId: rid,
      });

      await logCrmGlobalActivity({
        performedById: uid,
        action: 'Cross-department request rejected',
        description: `${existing.subject}${trimmedNote ? ` — ${trimmedNote}` : ''}`,
        entityType: existing.workType === 'CLIENT' ? 'CLIENT' : 'USER',
        entityId: existing.linkedEntityId || rid,
        category: 'Request',
        relatedType: 'CROSS_DEPT_REQUEST',
        relatedId: rid,
        relatedLabel: existing.subject,
      });

      return serializeRequest(updated);
    }

    if (normalizedAction !== 'accept' && normalizedAction !== 'approve') {
      throw new Error('Action must be accept or reject');
    }

    const finalAssigneeId = idStr(assignToId || existing.targetUserId || existing.targetHeadUserId);
    if (!finalAssigneeId) throw new Error('Assignee is required to accept this request');

    const assignee = await prisma.user.findFirst({
      where: {
        id: finalAssigneeId,
        departmentId: existing.targetDepartmentId,
        status: 'ACTIVE',
        isActive: true,
      },
      select: { id: true },
    });
    if (!assignee) throw new Error('Assignee must be an active member of the target department');

    let createdTaskId = existing.createdTaskId || null;
    const handoffTaskOptions = {
      setSelfAsApprover: setSelfAsApprover === true,
      dueDate: dueDate ? String(dueDate).trim() : null,
    };

    if (existing.workType === 'TASK' && !createdTaskId) {
      const task = await createCrossDeptHandoffTask(
        existing,
        finalAssigneeId,
        uid,
        { user: reviewer },
        handoffTaskOptions,
      );
      createdTaskId = task?.id || null;
    } else if (existing.workType === 'CLIENT' && !createdTaskId) {
      const task = await createCrossDeptHandoffTask(
        existing,
        finalAssigneeId,
        uid,
        { user: reviewer },
        handoffTaskOptions,
      );
      createdTaskId = task?.id || null;

      if (existing.linkedEntityId) {
        await clientService.update(
          existing.linkedEntityId,
          {
            assignedToId: finalAssigneeId,
            performedById: uid,
          },
          { user: reviewer, userWithPermissions: { id: uid }, _bypassClientScope: true },
        );
      }
    } else if (existing.workType === 'CLIENT' && existing.linkedEntityId) {
      await clientService.update(
        existing.linkedEntityId,
        {
          assignedToId: finalAssigneeId,
          performedById: uid,
        },
        { user: reviewer, userWithPermissions: { id: uid }, _bypassClientScope: true },
      );
    }

    const updated = await prisma.crossDepartmentWorkRequest.update({
      where: { id: rid },
      data: {
        status: 'ACCEPTED',
        assignedToId: finalAssigneeId,
        reviewedById: uid,
        reviewedByName: reviewerName,
        reviewedAt: new Date(),
        reviewNote: trimmedNote,
        createdTaskId,
      },
    });

    const notifyIds = [existing.requestedById, finalAssigneeId].filter(
      (id, index, arr) => id && arr.indexOf(id) === index && id !== uid,
    );
    for (const notifyId of notifyIds) {
      await notifyCrossDeptEvent(notifyId, 'cross_dept.request_accepted', {
        title: 'Cross-department request accepted',
        description: `${reviewerName} accepted "${existing.subject}" and assigned it for completion.`,
        requestId: rid,
      });
    }

    await logCrmGlobalActivity({
      performedById: uid,
      action: existing.workType === 'CLIENT' ? 'Client handoff accepted' : 'Cross-department request accepted',
      description: `${existing.subject}${trimmedNote ? ` — ${trimmedNote}` : ''}`,
      entityType: existing.workType === 'CLIENT' ? 'CLIENT' : 'USER',
      entityId: existing.linkedEntityId || rid,
      category: 'Request',
      relatedType: 'CROSS_DEPT_REQUEST',
      relatedId: rid,
      relatedLabel: existing.subject,
    });

    return serializeRequest(updated);
  },

  async forward(actorUserId, requestId, { assignToId, note } = {}) {
    const uid = idStr(actorUserId);
    const rid = idStr(requestId);
    const nextAssigneeId = idStr(assignToId);
    if (!nextAssigneeId) throw new Error('Forward assignee is required');

    const existing = await prisma.crossDepartmentWorkRequest.findUnique({ where: { id: rid } });
    if (!existing) throw new Error('Request not found');
    if (!['ACCEPTED', 'FORWARDED'].includes(existing.status)) {
      throw new Error('Only accepted requests can be forwarded');
    }

    const reviewer = await prisma.user.findUnique({
      where: { id: uid },
      select: { id: true, firstName: true, lastName: true, name: true, departmentId: true },
    });
    const isTargetHead =
      idStr(existing.targetHeadUserId) === uid ||
      (await isDepartmentHeadUser(uid) && idStr(reviewer?.departmentId) === idStr(existing.targetDepartmentId));
    if (!isTargetHead) throw new Error('Only the target department head can forward this request');

    const assignee = await prisma.user.findFirst({
      where: {
        id: nextAssigneeId,
        departmentId: existing.targetDepartmentId,
        status: 'ACTIVE',
        isActive: true,
      },
      select: { id: true },
    });
    if (!assignee) throw new Error('Forward target must be in the target department');

    if (existing.createdTaskId) {
      await taskService.update(
        existing.createdTaskId,
        { assigneeId: nextAssigneeId, assignedToId: nextAssigneeId },
        { user: reviewer },
      );
    } else if (existing.workType === 'CLIENT' && existing.linkedEntityId) {
      await clientService.update(
        existing.linkedEntityId,
        {
          assignedToId: nextAssigneeId,
          performedById: uid,
        },
        { user: reviewer, userWithPermissions: { id: uid }, _bypassClientScope: true },
      );
    }

    const updated = await prisma.crossDepartmentWorkRequest.update({
      where: { id: rid },
      data: {
        status: 'FORWARDED',
        assignedToId: nextAssigneeId,
        reviewedById: uid,
        reviewedByName: formatUserName(reviewer),
        reviewedAt: new Date(),
        reviewNote: note ? String(note).trim() : existing.reviewNote,
      },
    });

    await notifyCrossDeptEvent(nextAssigneeId, 'cross_dept.request_forwarded', {
      title: 'Work forwarded to you',
      description: `"${existing.subject}" was forwarded to you for completion.`,
      requestId: rid,
    });

    return serializeRequest(updated);
  },
};
