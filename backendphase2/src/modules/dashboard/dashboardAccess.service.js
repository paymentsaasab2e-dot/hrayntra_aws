import { prisma } from '../../config/prisma.js';
import { hasPermission } from '../../utils/permissionScope.js';
import { isSuperAdminUser } from '../../utils/superAdminScope.js';
import { isDepartmentHeadUser } from '../../services/departmentRole.service.js';
import { resolveViewerOrgScope } from '../org/org.service.js';

function userIdFrom(req) {
  return String(req?.user?.id || req?.user?._id || '').trim();
}

function wantsSelfScope(req) {
  const scope = String(req?.query?.scope || '').trim().toLowerCase();
  const mineOnly = req?.query?.mineOnly;
  return scope === 'self' || mineOnly === true || String(mineOnly || '').toLowerCase() === 'true';
}

function emptyMyWork() {
  return {
    openTasks: 0,
    overdueTasks: 0,
    awaitingTaskApproval: 0,
    pendingLeadConversions: 0,
    pendingCrossDept: 0,
    pendingTeamRequests: 0,
    pendingApprovalsTotal: 0,
    approvals: [],
  };
}

/**
 * Full stats: Super Admin, department Rank 1 (head), or dash_full_scope on the role.
 * My work tab: Super Admin, Rank 1, or dash_mine_approvals (approvals bucket).
 * Rank 1 / Super Admin have approvals-in-My-work on by default.
 */
export async function resolveDashboardAccess(req) {
  const userId = userIdFrom(req);
  const isSuperAdmin = isSuperAdminUser(req);
  const isDepartmentHead = userId ? await isDepartmentHeadUser(userId) : false;
  const hasOverride = hasPermission(req, 'dash_full_scope');
  const hasMineApprovalsPerm = hasPermission(req, 'dash_mine_approvals');

  let org = {
    isTenantAdmin: Boolean(isSuperAdmin),
    isTenantWide: Boolean(isSuperAdmin),
    canSwitchCompanies: Boolean(isSuperAdmin),
    companies: [],
    orgUnitId: null,
    hierarchyPurpose: 'member',
    memberIds: [],
  };
  try {
    org = await resolveViewerOrgScope(req);
  } catch {
    // Org collections may not exist until first visit to Organization.
  }

  const isOrgHead =
    org.hierarchyPurpose === 'company_head' || org.hierarchyPurpose === 'site_head';
  const canFullStats = Boolean(isSuperAdmin || isDepartmentHead || hasOverride || isOrgHead);
  const showMineApprovals = Boolean(isSuperAdmin || isDepartmentHead || hasMineApprovalsPerm);
  const forceSelf = wantsSelfScope(req);
  const statsScope = forceSelf || !canFullStats ? 'self' : 'full';

  return {
    statsScope,
    canFullStats,
    showMineTab: Boolean(isSuperAdmin || isDepartmentHead || hasMineApprovalsPerm),
    showMineApprovals,
    isSuperAdmin,
    isDepartmentHead,
    org,
  };
}

export async function applyDashboardAssignedScope(req) {
  const access = await resolveDashboardAccess(req);
  const uid = userIdFrom(req);
  if (!req.query || typeof req.query !== 'object') req.query = {};
  const noneId = '000000000000000000000000';

  if (access.statsScope === 'self' && uid) {
    req.query.assignedTo = uid;
    delete req.query.assignedToIds;
  } else if (!access.canFullStats && uid) {
    req.query.assignedTo = uid;
    delete req.query.assignedToIds;
  } else if (access.org && !access.org.isTenantWide) {
    const ids = access.org.memberIds?.length ? access.org.memberIds : [noneId];
    req.query.assignedToIds = ids.join(',');
    delete req.query.assignedTo;
  }

  return access;
}

function approvalItem({ id, kind, title, from, at, href, priority }) {
  return {
    id: String(id),
    kind,
    title: String(title || 'Approval').trim() || 'Approval',
    from: from ? String(from) : '',
    at: at ? new Date(at).toISOString() : null,
    href,
    priority: priority ? String(priority) : '',
  };
}

export async function getMyWorkStats(userId) {
  const uid = String(userId || '').trim();
  if (!uid) return emptyMyWork();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const openStatuses = ['PENDING', 'IN_PROGRESS'];

  const user = await prisma.user
    .findUnique({
      where: { id: uid },
      select: { id: true, email: true, departmentId: true },
    })
    .catch(() => null);

  const email = String(user?.email || '').trim().toLowerCase();
  const deptId = String(user?.departmentId || '').trim();
  const isHead = await isDepartmentHeadUser(uid).catch(() => false);

  const teamInboxWhere = {
    status: 'pending',
    OR: [{ sendToId: uid }, ...(email ? [{ sendToEmail: email }] : [])],
  };

  const crossPendingOr = [{ targetHeadUserId: uid }, { targetUserId: uid }];
  if (isHead && deptId) {
    crossPendingOr.push({ targetDepartmentId: deptId });
  }

  const [
    openTasks,
    overdueTasks,
    awaitingTaskApproval,
    pendingLeadConversions,
    pendingCrossDept,
    pendingTeamRequests,
    teamRows,
    leadRows,
    crossRows,
    taskRows,
  ] = await Promise.all([
    prisma.task
      .count({ where: { assignedToId: uid, status: { in: openStatuses } } })
      .catch(() => 0),
    prisma.task
      .count({
        where: {
          assignedToId: uid,
          status: { in: openStatuses },
          dueDate: { lt: startOfToday },
        },
      })
      .catch(() => 0),
    prisma.task
      .count({
        where: { completionApproverId: uid, status: 'AWAITING_APPROVAL' },
      })
      .catch(() => 0),
    prisma.leadConversionRequest
      .count({ where: { approverUserId: uid, status: 'PENDING' } })
      .catch(() => 0),
    prisma.crossDepartmentWorkRequest
      .count({
        where: { status: 'PENDING', OR: crossPendingOr },
      })
      .catch(() => 0),
    prisma.teamMemberRequest.count({ where: teamInboxWhere }).catch(() => 0),
    prisma.teamMemberRequest
      .findMany({
        where: teamInboxWhere,
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          subject: true,
          requestedByName: true,
          createdAt: true,
          priority: true,
        },
      })
      .catch(() => []),
    prisma.leadConversionRequest
      .findMany({
        where: { approverUserId: uid, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          leadCompanyName: true,
          requestedByName: true,
          createdAt: true,
        },
      })
      .catch(() => []),
    prisma.crossDepartmentWorkRequest
      .findMany({
        where: { status: 'PENDING', OR: crossPendingOr },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          subject: true,
          requestedByName: true,
          createdAt: true,
          priority: true,
          workType: true,
        },
      })
      .catch(() => []),
    prisma.task
      .findMany({
        where: { completionApproverId: uid, status: 'AWAITING_APPROVAL' },
        orderBy: { updatedAt: 'desc' },
        take: 8,
        select: {
          id: true,
          title: true,
          updatedAt: true,
          createdAt: true,
          priority: true,
        },
      })
      .catch(() => []),
  ]);

  const approvals = [
    ...(teamRows || []).map((row) =>
      approvalItem({
        id: row.id,
        kind: 'team',
        title: row.subject,
        from: row.requestedByName,
        at: row.createdAt,
        href: `/request/approval?tab=team&requestId=${encodeURIComponent(row.id)}`,
        priority: row.priority,
      }),
    ),
    ...(leadRows || []).map((row) =>
      approvalItem({
        id: row.id,
        kind: 'lead-conversion',
        title: `Convert ${row.leadCompanyName || 'lead'} to client`,
        from: row.requestedByName,
        at: row.createdAt,
        href: `/request/approval?tab=lead-conversion&requestId=${encodeURIComponent(row.id)}`,
      }),
    ),
    ...(crossRows || []).map((row) =>
      approvalItem({
        id: row.id,
        kind: 'cross-dept',
        title: row.subject,
        from: row.requestedByName,
        at: row.createdAt,
        href: `/request/approval?tab=cross-dept&requestId=${encodeURIComponent(row.id)}`,
        priority: row.priority,
      }),
    ),
    ...(taskRows || []).map((row) =>
      approvalItem({
        id: row.id,
        kind: 'task-completion',
        title: row.title,
        from: '',
        at: row.updatedAt || row.createdAt,
        href: `/request/approval?tab=task-completion`,
        priority: row.priority,
      }),
    ),
  ]
    .sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())
    .slice(0, 8);

  const pendingApprovalsTotal =
    Number(awaitingTaskApproval || 0) +
    Number(pendingLeadConversions || 0) +
    Number(pendingCrossDept || 0) +
    Number(pendingTeamRequests || 0);

  return {
    openTasks,
    overdueTasks,
    awaitingTaskApproval,
    pendingLeadConversions,
    pendingCrossDept,
    pendingTeamRequests,
    pendingApprovalsTotal,
    approvals,
  };
}
