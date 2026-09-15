/**
 * Centralized module-wise Assignment Rules.
 * Custom “Can assign to” lists define who the assignor may assign to.
 *
 * Persistence: existing `settings` collection (no new Mongo collection required).
 * key = assignment_rule:<module>:<orgKey>
 * userId = assignorUserId
 * scope = ORG
 * value = { assigneeUserIds: string[], createdById?: string }
 *
 * Semantics:
 * - No setting row → default to reporting hierarchy (descendants via managerId).
 *   If the assignor has no reports, keep the existing eligible pool (no extra filter).
 * - Setting exists with [] → assign to nobody.
 * - Setting exists with ids → those people (active) appear in Assign To; prefer
 *   members already in the eligible pool, then backfill any missing checked ids.
 * - Lookup prefers company-specific key, then tenant-wide `_` (All / active company).
 */
import { prisma } from '../config/prisma.js';
import {
  resolveAssignmentModules,
  filterUsersByAssignmentAccess,
  filterUsersByAssignableCompany,
} from './assigneeModuleAccess.service.js';
import { isSuperAdminUserId } from './taskAssignmentScope.service.js';
import { isSuperAdminUser } from '../utils/superAdminScope.js';
import { requestedAssignCompanyId } from './orgListScope.service.js';
import { excludeHqPlatformUsers, isHqPlatformUser } from '../utils/hqPlatformUser.js';

const idStr = (id) => String(id || '').trim();

export const ASSIGNMENT_RULE_MODULES = [
  'Leads',
  'Clients',
  'RecruitmentClients',
  'Jobs',
  'Candidates',
  'Interviews',
  'Tasks',
];

const SETTING_SCOPE = 'ORG';
const KEY_PREFIX = 'assignment_rule';

function normalizeModule(raw) {
  const resolved = resolveAssignmentModules(raw);
  const moduleName = resolved[0] || '';
  if (!ASSIGNMENT_RULE_MODULES.includes(moduleName)) {
    throw new Error(
      `Invalid assignment-rules module. Supported: ${ASSIGNMENT_RULE_MODULES.join(', ')}`,
    );
  }
  return moduleName;
}

function normalizeOrgUnitId(value) {
  const id = idStr(value);
  return id || null;
}

function orgKey(orgUnitId) {
  return normalizeOrgUnitId(orgUnitId) || '_';
}

function settingKey(moduleName, orgUnitId) {
  return `${KEY_PREFIX}:${moduleName}:${orgKey(orgUnitId)}`;
}

function parseAssigneeIds(value) {
  if (!value || typeof value !== 'object') return [];
  const raw = value.assigneeUserIds;
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map(idStr).filter(Boolean))];
}

async function findAssignmentRuleRow(assignorUserId, moduleName, orgUnitId = null) {
  const actorId = idStr(assignorUserId);
  if (!actorId || !moduleName) return null;

  const companyId = normalizeOrgUnitId(orgUnitId);
  if (companyId) {
    const companyRow = await prisma.setting.findFirst({
      where: {
        userId: actorId,
        key: settingKey(moduleName, companyId),
        scope: SETTING_SCOPE,
      },
      select: { value: true, key: true },
    });
    if (companyRow) return companyRow;
  }

  return prisma.setting.findFirst({
    where: {
      userId: actorId,
      key: settingKey(moduleName, null),
      scope: SETTING_SCOPE,
    },
    select: { value: true, key: true },
  });
}

/**
 * @returns {{ configured: boolean, allowedIds: Set<string> | null }}
 */
export async function getAssignmentRuleState(assignorUserId, module, orgUnitId = null) {
  const actorId = idStr(assignorUserId);
  if (!actorId) return { configured: false, allowedIds: null };

  let moduleName;
  try {
    moduleName = normalizeModule(module);
  } catch {
    return { configured: false, allowedIds: null };
  }

  const row = await findAssignmentRuleRow(actorId, moduleName, orgUnitId);
  if (!row) return { configured: false, allowedIds: null };

  return {
    configured: true,
    allowedIds: new Set(parseAssigneeIds(row.value)),
  };
}

async function loadActiveAssigneesByIds(ids) {
  const unique = [...new Set((ids || []).map(idStr).filter(Boolean))];
  if (!unique.length) return [];

  const rows = await prisma.user.findMany({
    where: {
      id: { in: unique },
      OR: [{ status: 'ACTIVE' }, { status: null }],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      name: true,
      email: true,
      departmentId: true,
      roleId: true,
      managerId: true,
      status: true,
      orgUnitId: true,
      systemRole: {
        select: {
          id: true,
          roleName: true,
          color: true,
        },
      },
      departmentRelation: {
        select: { id: true, name: true },
      },
    },
  });

  const byId = new Map();
  for (const user of rows) {
    if (!user || isHqPlatformUser(user)) continue;
    const firstName = user.firstName || '';
    const lastName = user.lastName || '';
    const name =
      user.name ||
      `${firstName} ${lastName}`.trim() ||
      user.email ||
      'User';
    byId.set(idStr(user.id), {
      id: user.id,
      firstName,
      lastName,
      name,
      email: user.email,
      departmentId: user.departmentId,
      roleId: user.roleId,
      managerId: user.managerId || null,
      status: user.status,
      role: user.systemRole || null,
      department: user.departmentRelation || null,
      orgUnitId: user.orgUnitId || null,
    });
  }

  return unique.map((id) => byId.get(id)).filter(Boolean);
}

/**
 * Active users who have access to the given module (role permissions).
 * Optional orgUnitId limits to that company subtree.
 */
export async function listEligibleAssigneeUserIdsForModule(module, orgUnitId = null) {
  const moduleName = normalizeModule(module);
  const companyId = normalizeOrgUnitId(orgUnitId);

  const users = await prisma.user.findMany({
    where: {
      OR: [{ status: 'ACTIVE' }, { status: null }],
    },
    select: {
      id: true,
      roleId: true,
      email: true,
      orgUnitId: true,
      firstName: true,
      lastName: true,
      name: true,
      systemRole: {
        select: { roleName: true },
      },
      credential: { select: { loginId: true } },
    },
  });

  let pool = excludeHqPlatformUsers(users);
  if (companyId) {
    const orgUnits = await prisma.orgUnit.findMany({
      select: { id: true, parentId: true },
    });
    pool = filterUsersByAssignableCompany(pool, companyId, orgUnits);
  }

  const eligible = await filterUsersByAssignmentAccess(pool, { modules: [moduleName] });
  return eligible.map((user) => idStr(user.id)).filter(Boolean);
}

export async function applyAssignmentRules(actorUserId, module, candidates, { req = null, orgUnitId = null } = {}) {
  const list = Array.isArray(candidates) ? candidates : [];

  const companyId =
    normalizeOrgUnitId(orgUnitId) ||
    (req ? requestedAssignCompanyId(req) : null) ||
    null;

  const state = await getAssignmentRuleState(actorUserId, module, companyId);
  // Custom saved rules apply to everyone (including Super Admin).
  if (state.configured) {
    const allowed = state.allowedIds || new Set();
    if (!allowed.size) return [];

    const fromPool = list.filter((member) => allowed.has(idStr(member?.id || member)));
    const found = new Set(fromPool.map((member) => idStr(member?.id || member)));
    const missing = [...allowed].filter((id) => !found.has(id));
    if (!missing.length) return fromPool;

    // Checked “Can assign to” people must appear even if outside the pre-filtered pool
    // (e.g. other department). Keep module-access gate so Assign To stays actionable.
    const extrasRaw = await loadActiveAssigneesByIds(missing);
    let extras = extrasRaw;
    try {
      const moduleName = normalizeModule(module);
      extras = await filterUsersByAssignmentAccess(extrasRaw, { modules: [moduleName] });
    } catch {
      extras = extrasRaw;
    }
    if (!extras.length) return fromPool;

    const merged = [...fromPool];
    const seen = new Set(found);
    for (const member of extras) {
      const id = idStr(member.id);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      merged.push(member);
    }
    return merged;
  }

  if (!list.length) return list;

  // Unsaved default: Super Admin keeps full access.
  if (req && isSuperAdminUser(req)) return list;
  if (!req && (await isSuperAdminUserId(actorUserId))) return list;

  // Unsaved default: reporting hierarchy (who reports to this assignor).
  const hierarchyIds = await listDescendantUserIds(actorUserId);
  if (!hierarchyIds.length) return list;
  const allowed = new Set(hierarchyIds.map(idStr));
  return list.filter((member) => allowed.has(idStr(member?.id || member)));
}

export async function assertAssignmentRuleAllows(
  actorUserId,
  module,
  assigneeUserId,
  { req = null, orgUnitId = null } = {},
) {
  if (!actorUserId || !assigneeUserId) return;

  const companyId =
    normalizeOrgUnitId(orgUnitId) ||
    (req ? requestedAssignCompanyId(req) : null) ||
    null;

  const state = await getAssignmentRuleState(actorUserId, module, companyId);
  if (state.configured) {
    const allowed = state.allowedIds || new Set();
    if (allowed.has(idStr(assigneeUserId))) return;
    throw new Error(
      'Assignment Rules do not allow assigning this record to the selected member for this module.',
    );
  }

  // Unsaved default: Super Admin may assign to anyone.
  if (req && isSuperAdminUser(req)) return;
  if (!req && (await isSuperAdminUserId(actorUserId))) return;

  const hierarchyIds = await listDescendantUserIds(actorUserId);
  if (!hierarchyIds.length) return;
  if (hierarchyIds.includes(idStr(assigneeUserId))) return;

  throw new Error(
    'Assignment Rules do not allow assigning this record to the selected member for this module.',
  );
}

export async function listDescendantUserIds(managerUserId, { maxDepth = 25 } = {}) {
  const root = idStr(managerUserId);
  if (!root) return [];

  const collected = [];
  let frontier = [root];
  const seen = new Set([root]);

  for (let depth = 0; depth < maxDepth && frontier.length; depth += 1) {
    const reports = await prisma.user.findMany({
      where: { managerId: { in: frontier } },
      select: { id: true },
    });
    const next = [];
    for (const row of reports) {
      const id = idStr(row.id);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      collected.push(id);
      next.push(id);
    }
    frontier = next;
  }

  return collected;
}

/**
 * List all saved Assignment Rule configs (from settings).
 * Optional orgUnitId filters to that company (or tenant-wide when null and includeTenantWide).
 */
export async function listSavedAssignmentRules({ orgUnitId = null } = {}) {
  const companyId = normalizeOrgUnitId(orgUnitId);
  const rows = await prisma.setting.findMany({
    where: {
      scope: SETTING_SCOPE,
      key: { startsWith: `${KEY_PREFIX}:` },
    },
    select: {
      userId: true,
      key: true,
      value: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  const parsed = [];
  for (const row of rows) {
    const key = String(row.key || '');
    // assignment_rule:<Module>:<orgKey>
    const parts = key.split(':');
    if (parts.length < 3 || parts[0] !== KEY_PREFIX) continue;
    const moduleName = parts[1];
    const orgKeyPart = parts.slice(2).join(':') || '_';
    const rowOrgId = orgKeyPart === '_' ? null : orgKeyPart;
    if (companyId && rowOrgId !== companyId) continue;
    if (!ASSIGNMENT_RULE_MODULES.includes(moduleName)) continue;
    const assignorUserId = idStr(row.userId);
    if (!assignorUserId) continue;
    parsed.push({
      module: moduleName,
      assignorUserId,
      orgUnitId: rowOrgId,
      assigneeUserIds: parseAssigneeIds(row.value),
      configured: true,
      updatedAt: row.updatedAt || null,
    });
  }

  const userIds = [
    ...new Set([
      ...parsed.map((r) => r.assignorUserId),
      ...parsed.flatMap((r) => r.assigneeUserIds),
    ]),
  ];
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          name: true,
          email: true,
          systemRole: { select: { roleName: true } },
          departmentRelation: { select: { name: true } },
        },
      })
    : [];
  const byId = new Map(
    users.map((u) => [
      String(u.id),
      {
        id: String(u.id),
        name:
          String(u.name || '').trim() ||
          [u.firstName, u.lastName].filter(Boolean).join(' ').trim() ||
          u.email ||
          'Member',
        email: u.email || '',
        roleName: u.systemRole?.roleName || '',
        departmentName: u.departmentRelation?.name || '',
      },
    ]),
  );

  return parsed.map((row) => ({
    ...row,
    assignor: byId.get(row.assignorUserId) || {
      id: row.assignorUserId,
      name: 'Unknown member',
      email: '',
      roleName: '',
      departmentName: '',
    },
    assignees: row.assigneeUserIds.map(
      (id) =>
        byId.get(id) || {
          id,
          name: 'Unknown member',
          email: '',
          roleName: '',
          departmentName: '',
        },
    ),
  }));
}

export async function getAssignmentRulesForAssignor({
  module,
  assignorUserId,
  orgUnitId = null,
}) {
  const moduleName = normalizeModule(module);
  const assignorId = idStr(assignorUserId);
  if (!assignorId) throw new Error('assignorUserId is required');

  const assignor = await prisma.user.findUnique({
    where: { id: assignorId },
    select: { id: true, status: true },
  });
  if (!assignor) throw new Error('Assignor not found');

  const companyId = normalizeOrgUnitId(orgUnitId);
  const row = await findAssignmentRuleRow(assignorId, moduleName, companyId);

  const eligibleAssigneeUserIds = await listEligibleAssigneeUserIdsForModule(moduleName, companyId);
  const eligibleSet = new Set(eligibleAssigneeUserIds);

  const hierarchyIds = await listDescendantUserIds(assignorId);
  const suggestedAssigneeIds = hierarchyIds.filter((id) => eligibleSet.has(id));
  const configured = Boolean(row);
  const savedIds = row
    ? parseAssigneeIds(row.value).filter((id) => eligibleSet.has(id))
    : [];

  return {
    module: moduleName,
    assignorUserId: assignorId,
    orgUnitId: companyId,
    configured,
    // When not saved, UI shows hierarchy as the effective "already selected" set.
    assigneeUserIds: configured ? savedIds : suggestedAssigneeIds,
    suggestedAssigneeIds,
    eligibleAssigneeUserIds,
    usingHierarchyDefault: !configured,
  };
}

export async function replaceAssignmentRules({
  module,
  assignorUserId,
  assigneeUserIds = [],
  orgUnitId = null,
  createdById = null,
}) {
  const moduleName = normalizeModule(module);
  const assignorId = idStr(assignorUserId);
  if (!assignorId) throw new Error('assignorUserId is required');

  const assignor = await prisma.user.findUnique({
    where: { id: assignorId },
    select: { id: true },
  });
  if (!assignor) throw new Error('Assignor not found');

  const companyId = normalizeOrgUnitId(orgUnitId);
  const uniqueAssigneeIds = [
    ...new Set(
      (Array.isArray(assigneeUserIds) ? assigneeUserIds : [])
        .map(idStr)
        .filter(Boolean),
    ),
  ];

  if (uniqueAssigneeIds.length) {
    const found = await prisma.user.findMany({
      where: { id: { in: uniqueAssigneeIds } },
      select: { id: true },
    });
    if (found.length !== uniqueAssigneeIds.length) {
      throw new Error('One or more assignees were not found');
    }
  }

  const eligibleIds = new Set(await listEligibleAssigneeUserIdsForModule(moduleName, companyId));
  const filteredAssigneeIds = uniqueAssigneeIds.filter((id) => eligibleIds.has(id));
  if (uniqueAssigneeIds.length && !filteredAssigneeIds.length) {
    throw new Error(
      `None of the selected people have access to the ${moduleName} module. Pick members who can use that module.`,
    );
  }

  if (companyId) {
    const unit = await prisma.orgUnit.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!unit) throw new Error('Organization not found');
  }

  const key = settingKey(moduleName, companyId);
  const value = {
    assigneeUserIds: filteredAssigneeIds,
    createdById: createdById ? idStr(createdById) : null,
    module: moduleName,
    orgUnitId: companyId,
  };

  const existing = await prisma.setting.findFirst({
    where: { userId: assignorId, key, scope: SETTING_SCOPE },
    select: { id: true },
  });

  if (existing) {
    await prisma.setting.update({
      where: { id: existing.id },
      data: { value },
    });
  } else {
    await prisma.setting.create({
      data: {
        userId: assignorId,
        key,
        scope: SETTING_SCOPE,
        value,
      },
    });
  }

  return getAssignmentRulesForAssignor({
    module: moduleName,
    assignorUserId: assignorId,
    orgUnitId: companyId,
  });
}

/**
 * Validate User.managerId updates: no self, no cycles, company-safe when required.
 */
export async function assertValidReportsTo(userId, managerId, { allowCrossCompany = false } = {}) {
  const memberId = idStr(userId);
  const nextManagerId = idStr(managerId);

  if (!nextManagerId) return;

  if (!memberId) throw new Error('User id is required');
  if (memberId === nextManagerId) {
    throw new Error('A member cannot report to themselves');
  }

  const [member, manager] = await Promise.all([
    prisma.user.findUnique({
      where: { id: memberId },
      select: { id: true, orgUnitId: true },
    }),
    prisma.user.findUnique({
      where: { id: nextManagerId },
      select: { id: true, orgUnitId: true, status: true },
    }),
  ]);

  if (!member) throw new Error('Member not found');
  if (!manager) throw new Error('Reports To manager not found');

  if (!allowCrossCompany) {
    const memberOrg = idStr(member.orgUnitId);
    const managerOrg = idStr(manager.orgUnitId);
    if (memberOrg && managerOrg && memberOrg !== managerOrg) {
      throw new Error(
        'Reports To must be in the same company unless you have cross-company authority',
      );
    }
  }

  let cursor = nextManagerId;
  const seen = new Set();
  for (let i = 0; i < 50 && cursor; i += 1) {
    if (cursor === memberId) {
      throw new Error('Circular reporting hierarchy is not allowed');
    }
    if (seen.has(cursor)) break;
    seen.add(cursor);
    const parent = await prisma.user.findUnique({
      where: { id: cursor },
      select: { managerId: true },
    });
    cursor = idStr(parent?.managerId) || null;
  }

  const descendants = await listDescendantUserIds(memberId);
  if (descendants.includes(nextManagerId)) {
    throw new Error('A member cannot report to someone in their own reporting line');
  }
}

export { normalizeModule as normalizeAssignmentRuleModule, normalizeOrgUnitId };
