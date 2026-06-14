import { prisma } from '../config/prisma.js';
import { createAlertNotification } from '../modules/setting/alert-dispatch.service.js';
import { leadService } from '../modules/lead/lead.service.js';
import {
  findDepartmentHeadUser,
  isDepartmentHeadUser,
} from './departmentRole.service.js';

const idStr = (id) => String(id || '').trim();

function formatUserName(user) {
  const parts = [user?.firstName, user?.lastName].filter(Boolean);
  const joined = parts.join(' ').trim();
  return String(user?.name || '').trim() || joined || String(user?.email || '').trim();
}

function serializeRequest(row) {
  return {
    id: row.id,
    leadId: row.leadId,
    leadCompanyName: row.leadCompanyName || undefined,
    requestedById: row.requestedById,
    requestedByName: row.requestedByName || undefined,
    approverUserId: row.approverUserId,
    status: String(row.status || 'PENDING').toLowerCase(),
    clientPayload: row.clientPayload || {},
    reviewedById: row.reviewedById || undefined,
    reviewedByName: row.reviewedByName || undefined,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : undefined,
    reviewNote: row.reviewNote || undefined,
    requestNote: row.requestNote || undefined,
    createdClientId: row.createdClientId || undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function notifyLeadConversionEvent(userId, alertId, { title, description, requestId }) {
  if (!userId) return;
  await createAlertNotification(userId, alertId, {
    category: 'LEADS',
    title,
    description,
    actionLabel: 'Review conversion',
    actionPath: `/request/approval?tab=lead-conversion&requestId=${encodeURIComponent(requestId)}`,
    entityType: 'LEAD_CONVERSION_REQUEST',
    entityId: requestId,
  });
}

async function resolveApproverForUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: idStr(userId) },
    select: { id: true, departmentId: true, managerId: true },
  });
  if (!user) return null;

  // Reports-to is the primary approver (Sales Employee → Sales Head).
  if (user.managerId && idStr(user.managerId) !== idStr(userId)) {
    return user.managerId;
  }

  if (user.departmentId) {
    const head = await findDepartmentHeadUser(user.departmentId);
    if (head?.id && idStr(head.id) !== idStr(userId)) {
      return head.id;
    }
  }

  return null;
}

async function isSuperAdminUserId(userId) {
  const user = await prisma.user.findUnique({
    where: { id: idStr(userId) },
    select: {
      role: true,
      systemRole: { select: { roleName: true } },
    },
  });
  if (!user) return false;
  const roleName = user.systemRole?.roleName || user.role || '';
  const normalized = String(roleName).trim().toUpperCase().replace(/\s+/g, '_');
  return normalized === 'SUPER_ADMIN' || normalized.replace(/_/g, '') === 'SUPERADMIN';
}

async function buildInboxWhere(actorUserId) {
  const uid = idStr(actorUserId);
  if (!uid) return { approverUserId: uid };

  if (await isSuperAdminUserId(uid)) {
    return { status: 'PENDING' };
  }

  const actor = await prisma.user.findUnique({
    where: { id: uid },
    select: { id: true, departmentId: true },
  });

  const isHead = await isDepartmentHeadUser(uid);
  if (isHead && actor?.departmentId) {
    const teamMembers = await prisma.user.findMany({
      where: {
        departmentId: actor.departmentId,
        status: 'ACTIVE',
        isActive: true,
      },
      select: { id: true },
    });
    const teamIds = teamMembers.map((m) => m.id).filter((id) => idStr(id) !== uid);
    return {
      OR: [
        { approverUserId: uid },
        ...(teamIds.length
          ? [{ status: 'PENDING', requestedById: { in: teamIds } }]
          : []),
      ],
    };
  }

  return { approverUserId: uid };
}

export const leadConversionRequestService = {
  async list(actorUserId, { box = 'inbox' } = {}) {
    const uid = idStr(actorUserId);
    const where =
      box === 'sent'
        ? { requestedById: uid }
        : await buildInboxWhere(uid);

    const rows = await prisma.leadConversionRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(serializeRequest);
  },

  async submit(actorUserId, leadId, body = {}) {
    const uid = idStr(actorUserId);
    const lid = idStr(leadId);
    if (!uid || !lid) throw new Error('Unauthorized');

    const payload =
      body && typeof body === 'object' && !Array.isArray(body) ? { ...body } : {};
    const requestNote = String(payload.requestNote || '').trim();
    delete payload.requestNote;
    if (!requestNote) {
      throw new Error('Remark is required when submitting a conversion request');
    }

    const isHead = await isDepartmentHeadUser(uid);
    if (isHead) {
      throw new Error('Department heads can convert leads directly without a request');
    }

    const lead = await prisma.lead.findFirst({
      where: { id: lid, isDeleted: { not: true } },
      select: {
        id: true,
        companyName: true,
        contactPerson: true,
        convertedToClientId: true,
        status: true,
        assignedToId: true,
        assignedToIds: true,
      },
    });
    if (!lead) throw new Error('Lead not found');
    if (lead.convertedToClientId || lead.status === 'Converted') {
      throw new Error('This lead has already been converted');
    }

    const existingPending = await prisma.leadConversionRequest.findFirst({
      where: { leadId: lid, status: 'PENDING' },
      select: { id: true },
    });
    if (existingPending) {
      throw new Error('A conversion request for this lead is already pending approval');
    }

    const isAssigned =
      idStr(lead.assignedToId) === uid ||
      (Array.isArray(lead.assignedToIds) && lead.assignedToIds.some((id) => idStr(id) === uid));
    if (!isAssigned) {
      throw new Error('You can only request conversion for leads assigned to you');
    }

    const approverUserId = await resolveApproverForUser(uid);
    if (!approverUserId) {
      throw new Error('No department head is configured to approve this conversion');
    }

    const actor = await prisma.user.findUnique({
      where: { id: uid },
      select: { id: true, firstName: true, lastName: true, name: true, email: true },
    });

    const companyLabel =
      String(payload.companyName || lead.companyName || lead.contactPerson || 'Lead').trim() ||
      'Lead';

    const row = await prisma.leadConversionRequest.create({
      data: {
        leadId: lid,
        leadCompanyName: companyLabel,
        requestedById: uid,
        requestedByName: formatUserName(actor),
        approverUserId,
        requestNote,
        clientPayload: payload && typeof payload === 'object' ? payload : {},
        status: 'PENDING',
      },
    });

    await notifyLeadConversionEvent(approverUserId, 'lead.conversion_requested', {
      title: 'Lead conversion pending approval',
      description: `${formatUserName(actor)} requested to convert "${companyLabel}" to a client.`,
      requestId: row.id,
    });

    return serializeRequest(row);
  },

  async review(actorUserId, requestId, { action, note } = {}) {
    const uid = idStr(actorUserId);
    const rid = idStr(requestId);
    const normalizedAction = String(action || '').trim().toLowerCase();

    const existing = await prisma.leadConversionRequest.findUnique({ where: { id: rid } });
    if (!existing) throw new Error('Conversion request not found');
    if (existing.status !== 'PENDING') {
      throw new Error('Only pending conversion requests can be reviewed');
    }

    const isApprover =
      idStr(existing.approverUserId) === uid || (await isDepartmentHeadUser(uid));
    if (!isApprover) {
      throw new Error('Only the assigned approver or a department head can review this request');
    }

    const reviewer = await prisma.user.findUnique({
      where: { id: uid },
      select: { id: true, firstName: true, lastName: true, name: true, email: true },
    });
    const reviewerName = formatUserName(reviewer);
    const trimmedNote = note ? String(note).trim() : null;

    if (normalizedAction === 'reject') {
      if (!trimmedNote) {
        throw new Error('Remark is required when rejecting a conversion request');
      }
      const updated = await prisma.leadConversionRequest.update({
        where: { id: rid },
        data: {
          status: 'REJECTED',
          reviewedById: uid,
          reviewedByName: reviewerName,
          reviewedAt: new Date(),
          reviewNote: trimmedNote,
        },
      });

      await notifyLeadConversionEvent(existing.requestedById, 'lead.conversion_rejected', {
        title: 'Lead conversion rejected',
        description: `${reviewerName} rejected conversion for "${existing.leadCompanyName || 'lead'}".${trimmedNote ? ` Note: ${trimmedNote}` : ''}`,
        requestId: rid,
      });

      return serializeRequest(updated);
    }

    if (normalizedAction !== 'accept' && normalizedAction !== 'approve') {
      throw new Error('Action must be accept or reject');
    }

    const payload =
      existing.clientPayload && typeof existing.clientPayload === 'object'
        ? existing.clientPayload
        : {};

    const client = await leadService.convertToClient(existing.leadId, {
      ...payload,
      performedById: uid,
    });

    const updated = await prisma.leadConversionRequest.update({
      where: { id: rid },
      data: {
        status: 'APPROVED',
        reviewedById: uid,
        reviewedByName: reviewerName,
        reviewedAt: new Date(),
        reviewNote: trimmedNote,
        createdClientId: client?.id || null,
      },
    });

    await notifyLeadConversionEvent(existing.requestedById, 'lead.conversion_approved', {
      title: 'Lead converted to client',
      description: `${reviewerName} approved conversion for "${existing.leadCompanyName || 'lead'}".`,
      requestId: rid,
    });

    return { ...serializeRequest(updated), client };
  },
};
