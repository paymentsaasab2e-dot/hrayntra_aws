import { prisma } from '../../config/prisma.js';
import { hasPermission } from '../../utils/permissionScope.js';
import { isSuperAdminUser } from '../../utils/superAdminScope.js';
import { isDepartmentHeadUser } from '../../services/departmentRole.service.js';
import { resolveViewerOrgScope, userIdsInOrgScope, collectDescendantIds } from '../org/org.service.js';

/** @typedef {'self' | 'department' | 'company' | 'tenant'} DashboardLevel */

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

async function loadUserDepartmentMeta(userId) {
  if (!userId) return { departmentId: null, departmentName: null };
  const user = await prisma.user
    .findUnique({
      where: { id: userId },
      select: {
        departmentId: true,
        departmentRelation: { select: { id: true, name: true } },
      },
    })
    .catch(() => null);
  const departmentId = String(user?.departmentId || user?.departmentRelation?.id || '').trim() || null;
  const departmentName = String(user?.departmentRelation?.name || '').trim() || null;
  return { departmentId, departmentName };
}

async function departmentMemberIds(departmentId) {
  const deptId = String(departmentId || '').trim();
  if (!deptId) return [];
  const rows = await prisma.user
    .findMany({
      where: {
        departmentId: deptId,
        isActive: true,
        status: 'ACTIVE',
      },
      select: { id: true },
    })
    .catch(() => []);
  return (rows || []).map((r) => String(r.id)).filter(Boolean);
}

/**
 * Dashboard data level (separate from which tabs the role can open):
 * - self: assigned-to-me only
 * - department: Rank 1 head or dash_dept_scope → everyone in that department
 * - company: company_head / site_head or dash_company_scope → that org node
 * - tenant: Super Admin or dash_full_scope → whole tenant
 */
export async function resolveDashboardAccess(req) {
  const userId = userIdFrom(req);
  const isSuperAdmin = isSuperAdminUser(req);
  const isDepartmentHead = userId ? await isDepartmentHeadUser(userId) : false;
  const hasTenantScopePerm = hasPermission(req, 'dash_full_scope');
  const hasCompanyScopePerm = hasPermission(req, 'dash_company_scope');
  const hasDeptScopePerm = hasPermission(req, 'dash_dept_scope');
  const hasMineApprovalsPerm = hasPermission(req, 'dash_mine_approvals');

  let org = {
    isTenantAdmin: Boolean(isSuperAdmin),
    isTenantWide: Boolean(isSuperAdmin),
    canSwitchCompanies: Boolean(isSuperAdmin),
    companies: [],
    orgUnitId: null,
    homeOrgUnitName: null,
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

  /** Rank 1 for data scope — Super Admin already maps to tenant via isSuperAdmin. */
  const isDeptRank1 = Boolean(isDepartmentHead && !isSuperAdmin);

  const { departmentId, departmentName } = await loadUserDepartmentMeta(userId);

  /** @type {DashboardLevel} */
  let dashboardLevel = 'self';
  if (isSuperAdmin || hasTenantScopePerm) {
    dashboardLevel = 'tenant';
  } else if (isOrgHead || hasCompanyScopePerm) {
    dashboardLevel = 'company';
  } else if (isDeptRank1 || hasDeptScopePerm) {
    dashboardLevel = 'department';
  }

  const forceSelf = wantsSelfScope(req);
  if (forceSelf) dashboardLevel = 'self';

  const canFullStats = dashboardLevel !== 'self';
  const statsScope = canFullStats ? 'full' : 'self';
  const showMineApprovals = Boolean(isSuperAdmin || isDeptRank1 || hasMineApprovalsPerm);
  const showMineTab = Boolean(isSuperAdmin || isDeptRank1 || hasMineApprovalsPerm);

  let scopeLabel = 'your assigned records';
  if (dashboardLevel === 'tenant') scopeLabel = 'all companies';
  else if (dashboardLevel === 'company') {
    scopeLabel = org.homeOrgUnitName || 'this company';
  } else if (dashboardLevel === 'department') {
    scopeLabel = departmentName ? `${departmentName} department` : 'your department';
  }

  /** User ids included in dashboard / Hours & scores for this level (null = whole tenant). */
  let scopeUserIds = null;
  if (dashboardLevel === 'self' && userId) {
    scopeUserIds = [userId];
  } else if (dashboardLevel === 'department') {
    const ids = await departmentMemberIds(departmentId);
    scopeUserIds = ids.length ? ids : userId ? [userId] : [];
  } else if (dashboardLevel === 'company') {
    let ids = org.memberIds?.length ? [...org.memberIds] : [];
    if (!ids.length) {
      const homeId = String(org.homeOrgUnitId || org.orgUnitId || '').trim();
      if (homeId) {
        try {
          ids = await userIdsInOrgScope(homeId);
        } catch {
          ids = [];
        }
      }
    }
    if (!ids.length && userId) ids = [userId];
    scopeUserIds = ids;
  }

  return {
    dashboardLevel,
    statsScope,
    canFullStats,
    scopeLabel,
    scopeUserIds,
    departmentId,
    departmentName,
    showMineTab,
    showMineApprovals,
    isSuperAdmin,
    isDepartmentHead: isDeptRank1,
    org,
  };
}

export async function applyDashboardAssignedScope(req) {
  const access = await resolveDashboardAccess(req);
  const uid = userIdFrom(req);
  if (!req.query || typeof req.query !== 'object') req.query = {};
  const noneId = '000000000000000000000000';

  delete req.query.assignedTo;
  delete req.query.assignedToIds;
  delete req.query.orgUnitIds;

  if (access.dashboardLevel === 'self' && uid) {
    req.query.assignedTo = uid;
  } else if (access.dashboardLevel === 'department') {
    const ids = await departmentMemberIds(access.departmentId);
    const scoped = ids.length ? ids : uid ? [uid] : [noneId];
    req.query.assignedToIds = scoped.join(',');
  } else if (access.dashboardLevel === 'company') {
    let ids = access.org?.memberIds?.length ? [...access.org.memberIds] : [];
    let unitIds = access.org?.unitIds?.length ? [...access.org.unitIds] : [];
    // Role grant dash_company_scope without org-head purpose may still have a home company.
    if (!ids.length) {
      const homeId = String(access.org?.homeOrgUnitId || access.org?.orgUnitId || '').trim();
      if (homeId) {
        try {
          ids = await userIdsInOrgScope(homeId);
          unitIds = await collectDescendantIds(homeId);
        } catch {
          ids = [];
        }
      }
    }
    if (!ids.length && uid) ids = [uid];
    if (!ids.length) ids = [noneId];
    req.query.assignedToIds = ids.join(',');
    if (unitIds.length) {
      req.query.orgUnitIds = unitIds.map(String).join(',');
    }
  }
  // tenant: no assignee filter — full tenant numbers

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
