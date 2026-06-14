import { prisma } from '../config/prisma.js';
import { syncDefaultPermissions } from '../modules/role/permission-sync.service.js';

const ROLE_LINK_INCLUDE = {
  role: {
    select: {
      id: true,
      roleName: true,
      color: true,
      description: true,
    },
  },
};

function departmentRoleDelegate(client = prisma) {
  const delegate = client?.departmentRole;
  if (!delegate) {
    throw new Error(
      'Department roles are not initialized. In backendphase2 run: pnpm db:push && pnpm prisma:generate — then restart the API server.',
    );
  }
  return delegate;
}

async function linkDepartmentRole(client, departmentId, roleId, rank) {
  const departmentRole = departmentRoleDelegate(client);
  const existing = await departmentRole.findUnique({
    where: {
      departmentId_roleId: {
        departmentId,
        roleId,
      },
    },
  });

  if (existing) {
    return departmentRole.update({
      where: { id: existing.id },
      data: { rank },
      include: ROLE_LINK_INCLUDE,
    });
  }

  return departmentRole.create({
    data: {
      departmentId,
      roleId,
      rank,
    },
    include: ROLE_LINK_INCLUDE,
  });
}

/** MongoDB Prisma does not support orderBy on nested includes — sort in application code. */
export const departmentRoleInclude = {
  departmentRoles: {
    include: {
      role: {
        select: {
          id: true,
          roleName: true,
          color: true,
          description: true,
        },
      },
    },
  },
};

export function sortDepartmentRoles(department) {
  if (!department?.departmentRoles?.length) return department;
  return {
    ...department,
    departmentRoles: [...department.departmentRoles].sort(
      (a, b) => (a.rank ?? 0) - (b.rank ?? 0),
    ),
  };
}

/**
 * @param {Array<{ roleId?: string, roleName?: string, description?: string, color?: string, permissionIds?: string[], rank: number }>} roles
 */
export async function applyDepartmentRoles(departmentId, roles, client = prisma) {
  if (!Array.isArray(roles) || roles.length === 0) {
    return [];
  }

  await syncDefaultPermissions();

  const normalized = roles
    .map((entry, index) => ({
      roleId: entry.roleId ? String(entry.roleId).trim() : '',
      roleName: entry.roleName ? String(entry.roleName).trim() : '',
      description: entry.description ? String(entry.description).trim() : undefined,
      color: entry.color ? String(entry.color).trim() : 'blue',
      permissionIds: Array.isArray(entry.permissionIds) ? entry.permissionIds : [],
      rank: Number.isFinite(Number(entry.rank)) ? Number(entry.rank) : index + 1,
    }))
    .filter((entry) => entry.roleId || entry.roleName);

  const ranks = normalized.map((r) => r.rank);
  if (new Set(ranks).size !== ranks.length) {
    throw new Error('Each role in a department must have a unique rank');
  }

  const links = [];

  for (const entry of normalized) {
    let roleId = entry.roleId;

    if (!roleId) {
      if (!entry.roleName) {
        throw new Error('Role name is required when creating a new role');
      }

      const existing = await client.systemRole.findUnique({
        where: { roleName: entry.roleName },
        select: { id: true },
      });

      if (existing) {
        roleId = existing.id;
      } else {
        const created = await client.systemRole.create({
          data: {
            roleName: entry.roleName,
            description: entry.description,
            color: entry.color || 'blue',
          },
        });
        roleId = created.id;

        if (entry.permissionIds.length > 0) {
          const rawPermissionValues = [...new Set(entry.permissionIds.map((id) => String(id).trim()).filter(Boolean))];
          const permissionRecords = await client.permission.findMany({
            where: {
              OR: [{ id: { in: rawPermissionValues } }, { permissionName: { in: rawPermissionValues } }],
            },
            select: { id: true, permissionName: true },
          });
          const permissionById = new Map(permissionRecords.map((p) => [p.id, p.id]));
          const permissionByName = new Map(permissionRecords.map((p) => [p.permissionName, p.id]));
          const uniquePermissionIds = [
            ...new Set(
              rawPermissionValues
                .map((value) => permissionById.get(value) || permissionByName.get(value))
                .filter(Boolean),
            ),
          ];
          if (uniquePermissionIds.length > 0) {
            await client.rolePermission.createMany({
              data: uniquePermissionIds.map((permissionId) => ({
                roleId,
                permissionId,
              })),
            });
          }
        }
      }
    } else {
      const role = await client.systemRole.findUnique({ where: { id: roleId }, select: { id: true } });
      if (!role) {
        throw new Error('Selected role was not found');
      }
    }

    const link = await linkDepartmentRole(client, departmentId, roleId, entry.rank);

    links.push(link);
  }

  return links;
}

export async function syncDepartmentRoles(departmentId, roles) {
  if (!Array.isArray(roles)) {
    return null;
  }

  await departmentRoleDelegate().deleteMany({ where: { departmentId } });
  if (roles.length === 0) {
    return [];
  }
  return applyDepartmentRoles(departmentId, roles);
}

async function loadDepartmentRankMaps(departmentId) {
  const normalizedDeptId = idStr(departmentId);
  const deptRoles = await departmentRoleDelegate().findMany({
    where: { departmentId: normalizedDeptId },
    select: {
      roleId: true,
      rank: true,
      role: { select: { id: true, roleName: true } },
    },
  });

  const rankByRoleId = new Map();
  const rankByRoleName = new Map();

  for (const row of deptRoles) {
    const rank = Number(row.rank);
    rankByRoleId.set(idStr(row.roleId), rank);
    const roleName = String(row.role?.roleName || '').trim().toLowerCase();
    if (roleName) rankByRoleName.set(roleName, rank);
  }

  return { deptRoles, rankByRoleId, rankByRoleName };
}

function resolveUserRankInDepartment(user, rankByRoleId, rankByRoleName) {
  const roleId = idStr(user?.roleId || user?.role?.id || user?.systemRole?.id);
  if (rankByRoleId.has(roleId)) return rankByRoleId.get(roleId);

  const roleName = String(
    user?.role?.roleName || user?.systemRole?.roleName || '',
  )
    .trim()
    .toLowerCase();
  if (roleName && rankByRoleName.has(roleName)) return rankByRoleName.get(roleName);

  return null;
}

export async function getDepartmentRoleRank(departmentId, roleId) {
  if (!departmentId || !roleId) return null;
  const { rankByRoleId, rankByRoleName } = await loadDepartmentRankMaps(departmentId);
  const direct = rankByRoleId.get(idStr(roleId));
  if (direct != null) return direct;

  const roleRow = await prisma.systemRole.findUnique({
    where: { id: idStr(roleId) },
    select: { roleName: true },
  });
  const roleName = String(roleRow?.roleName || '').trim().toLowerCase();
  if (roleName && rankByRoleName.has(roleName)) return rankByRoleName.get(roleName);

  return null;
}

export async function assertRoleAllowedInDepartment(departmentId, roleId) {
  if (!departmentId || !roleId) return;

  const count = await departmentRoleDelegate().count({
    where: { departmentId },
  });
  if (count === 0) {
    return;
  }

  const link = await departmentRoleDelegate().findUnique({
    where: {
      departmentId_roleId: {
        departmentId,
        roleId,
      },
    },
    select: { id: true },
  });

  if (!link) {
    throw new Error('Selected role is not assigned to this department');
  }
}

export async function findSuperAdminManagerId() {
  const superRole = await prisma.systemRole.findUnique({
    where: { roleName: 'Super Admin' },
    select: { id: true },
  });
  if (!superRole) return null;

  const superAdmin = await prisma.user.findFirst({
    where: {
      roleId: superRole.id,
      status: 'ACTIVE',
      isActive: true,
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });

  return superAdmin?.id ?? null;
}

/**
 * Default manager when no higher-ranked members exist in the department.
 */
export async function validateReportingManager(departmentId, roleId, managerId) {
  if (!managerId) return;

  const memberRank = await getDepartmentRoleRank(departmentId, roleId);
  if (memberRank == null) return;

  const manager = await prisma.user.findUnique({
    where: { id: managerId },
    select: {
      id: true,
      departmentId: true,
      roleId: true,
      systemRole: { select: { roleName: true } },
    },
  });

  if (!manager) {
    throw new Error('Selected manager was not found');
  }

  if (manager.systemRole?.roleName === 'Super Admin') {
    return;
  }

  const managerRank = await getDepartmentRoleRank(departmentId, manager.roleId);
  if (managerRank == null || Number(managerRank) >= Number(memberRank)) {
    throw new Error('Reports To must be a member with a higher rank (lower rank number) in this department');
  }
}

export async function resolveDefaultManagerId(departmentId, roleId, explicitManagerId) {
  if (explicitManagerId) return explicitManagerId;
  const candidates = await listReportingManagerCandidates(departmentId, roleId);
  return pickDefaultManagerFromCandidates(candidates);
}

const memberListSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  departmentId: true,
  roleId: true,
  status: true,
  systemRole: {
    select: {
      id: true,
      roleName: true,
      color: true,
    },
  },
  departmentRelation: {
    select: {
      id: true,
      name: true,
    },
  },
};

function normalizeMemberRow(member) {
  return {
    ...member,
    role: member.systemRole || null,
    department: member.departmentRelation || null,
  };
}

function mergeManagerLists(primary, superAdmins) {
  const merged = [...primary];
  for (const sa of superAdmins) {
    if (!merged.some((m) => m.id === sa.id)) merged.push(sa);
  }
  return merged;
}

const idStr = (id) => String(id || '').trim();

/**
 * Candidates for "Reports To" for a role in a department.
 * Rule: rank 1 = highest authority; a member reports to users whose role rank number is LOWER.
 */
export async function listReportingManagerCandidates(departmentId, roleId, options = {}) {
  const { excludeMemberId } = options;
  const normalizedRoleId = idStr(roleId);
  const normalizedDeptId = idStr(departmentId);

  const { deptRoles, rankByRoleId, rankByRoleName } = await loadDepartmentRankMaps(normalizedDeptId);
  let memberRank = rankByRoleId.get(normalizedRoleId);

  if (memberRank == null && normalizedRoleId) {
    const roleRow = await prisma.systemRole.findUnique({
      where: { id: normalizedRoleId },
      select: { roleName: true },
    });
    const roleName = String(roleRow?.roleName || '').trim().toLowerCase();
    if (roleName && rankByRoleName.has(roleName)) {
      memberRank = rankByRoleName.get(roleName);
    }
  }

  const superRole = await prisma.systemRole.findUnique({
    where: { roleName: 'Super Admin' },
    select: { id: true },
  });

  const superAdmins = superRole
    ? await prisma.user.findMany({
        where: {
          roleId: superRole.id,
          status: 'ACTIVE',
          isActive: true,
          ...(excludeMemberId ? { id: { not: excludeMemberId } } : {}),
        },
        select: memberListSelect,
      })
    : [];

  const superAdminNormalized = superAdmins.map(normalizeMemberRow);

  const excludeFilter = excludeMemberId ? { id: { not: excludeMemberId } } : {};

  if (memberRank == null || deptRoles.length === 0) {
    const inDept = await prisma.user.findMany({
      where: {
        departmentId: normalizedDeptId,
        status: 'ACTIVE',
        isActive: true,
        ...excludeFilter,
      },
      select: memberListSelect,
    });
    return mergeManagerLists(inDept.map(normalizeMemberRow), superAdminNormalized);
  }

  const memberRankNum = Number(memberRank);

  const pickSuperiorsFromRows = (rows, preferSameDepartment = false) =>
    rows
      .map(normalizeMemberRow)
      .filter((member) => {
        if (member.role?.roleName === 'Super Admin') return false;
        if (preferSameDepartment && idStr(member.departmentId || member.department?.id) !== normalizedDeptId) {
          return false;
        }
        const userRank = resolveUserRankInDepartment(member, rankByRoleId, rankByRoleName);
        return userRank != null && Number(userRank) < memberRankNum;
      })
      .sort((a, b) => {
        const rankA = resolveUserRankInDepartment(a, rankByRoleId, rankByRoleName) ?? 99;
        const rankB = resolveUserRankInDepartment(b, rankByRoleId, rankByRoleName) ?? 99;
        if (rankA !== rankB) return rankA - rankB;
        const aInDept = idStr(a.departmentId || a.department?.id) === normalizedDeptId ? 0 : 1;
        const bInDept = idStr(b.departmentId || b.department?.id) === normalizedDeptId ? 0 : 1;
        return aInDept - bInDept;
      });

  const inDeptMembers = await prisma.user.findMany({
    where: {
      departmentId: normalizedDeptId,
      status: 'ACTIVE',
      isActive: true,
      ...excludeFilter,
    },
    select: memberListSelect,
  });

  let superiors = pickSuperiorsFromRows(inDeptMembers, true);

  if (superiors.length === 0) {
    const orgMembers = await prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        isActive: true,
        ...excludeFilter,
      },
      select: memberListSelect,
    });
    superiors = pickSuperiorsFromRows(orgMembers, false);
  }

  return mergeManagerLists(superiors, superAdminNormalized);
}

export async function pickDefaultManagerFromCandidates(candidates) {
  if (!candidates?.length) {
    return findSuperAdminManagerId();
  }
  const nonSuper = candidates.filter((m) => m.role?.roleName !== 'Super Admin');
  if (nonSuper.length > 0) {
    return nonSuper[0].id;
  }
  const superAdmin = candidates.find((m) => m.role?.roleName === 'Super Admin');
  return superAdmin?.id ?? candidates[0]?.id ?? findSuperAdminManagerId();
}

async function loadUserForRankCheck(userId) {
  return prisma.user.findUnique({
    where: { id: idStr(userId) },
    select: {
      id: true,
      departmentId: true,
      roleId: true,
      status: true,
      isActive: true,
      firstName: true,
      lastName: true,
      name: true,
      email: true,
      systemRole: { select: { roleName: true } },
      departmentRelation: { select: { id: true, name: true } },
    },
  });
}

function formatUserDisplayName(user) {
  const parts = [user?.firstName, user?.lastName].filter(Boolean);
  const joined = parts.join(' ').trim();
  return String(user?.name || '').trim() || joined || String(user?.email || '').trim() || 'Team member';
}

export async function isDepartmentHeadUser(userId) {
  const user = await loadUserForRankCheck(userId);
  if (!user || user.status !== 'ACTIVE' || !user.isActive) return false;
  if (user.systemRole?.roleName === 'Super Admin') return true;

  const deptId = idStr(user.departmentId);
  const roleId = idStr(user.roleId);
  if (!deptId || !roleId) return false;

  const rank = await getDepartmentRoleRank(deptId, roleId);
  return rank === 1;
}

export async function canInitiateCrossDepartmentRequest(userId) {
  return isDepartmentHeadUser(userId);
}

export async function findDepartmentHeadUser(departmentId) {
  const deptId = idStr(departmentId);
  if (!deptId) return null;

  const headRole = await departmentRoleDelegate().findFirst({
    where: { departmentId: deptId },
    orderBy: { rank: 'asc' },
    select: { roleId: true },
  });
  if (!headRole?.roleId) return null;

  const headUser = await prisma.user.findFirst({
    where: {
      departmentId: deptId,
      roleId: headRole.roleId,
      status: 'ACTIVE',
      isActive: true,
    },
    select: memberListSelect,
    orderBy: { firstName: 'asc' },
  });

  return headUser ? normalizeMemberRow(headUser) : null;
}

export async function listCrossDepartmentTargetOptions(actorUserId, { forceLoadDepartments = false } = {}) {
  const canInitiate = await canInitiateCrossDepartmentRequest(actorUserId);
  const actor = await loadUserForRankCheck(actorUserId);
  const actorDeptId = idStr(actor?.departmentId);

  const ownDepartment = actorDeptId ? await loadOwnDepartmentOption(actorDeptId) : null;

  if (!canInitiate && !forceLoadDepartments) {
    return { canInitiate: false, departments: [], ownDepartment };
  }

  const departments = await loadCrossDepartmentTargetDepartments(actorDeptId);

  return {
    canInitiate,
    ownDepartment,
    departments,
  };
}

async function loadCrossDepartmentTargetDepartments(actorDeptId) {
  const departments = await prisma.department.findMany({
    where: {
      allowsCrossDepartmentRequests: true,
      ...(actorDeptId ? { id: { not: actorDeptId } } : {}),
    },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      users: {
        where: { status: 'ACTIVE', isActive: true },
        select: memberListSelect,
        orderBy: { firstName: 'asc' },
      },
      departmentRoles: {
        orderBy: { rank: 'asc' },
        select: { rank: true, roleId: true },
      },
    },
  });

  return departments.map((dept) => serializeCrossDepartmentOption(dept));
}

async function loadOwnDepartmentOption(departmentId) {
  const deptId = idStr(departmentId);
  if (!deptId) return null;

  const dept = await prisma.department.findUnique({
    where: { id: deptId },
    select: {
      id: true,
      name: true,
      users: {
        where: { status: 'ACTIVE', isActive: true },
        select: memberListSelect,
        orderBy: { firstName: 'asc' },
      },
      departmentRoles: {
        orderBy: { rank: 'asc' },
        select: { rank: true, roleId: true },
      },
    },
  });

  return dept ? serializeCrossDepartmentOption(dept) : null;
}

function serializeCrossDepartmentOption(dept) {
  return {
    id: dept.id,
    name: dept.name,
    headRoleId: dept.departmentRoles[0]?.roleId || null,
    members: dept.users.map((row) => {
      const member = normalizeMemberRow(row);
      return {
        id: member.id,
        name: formatUserDisplayName(member),
        email: member.email,
        roleId: member.roleId,
        roleName: member.role?.roleName || null,
        isDepartmentHead: dept.departmentRoles[0]?.roleId
          ? idStr(member.roleId) === idStr(dept.departmentRoles[0].roleId)
          : false,
      };
    }),
  };
}
