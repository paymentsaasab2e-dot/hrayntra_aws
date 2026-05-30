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

export async function getDepartmentRoleRank(departmentId, roleId) {
  if (!departmentId || !roleId) return null;
  const row = await departmentRoleDelegate().findUnique({
    where: {
      departmentId_roleId: {
        departmentId,
        roleId,
      },
    },
    select: { rank: true },
  });
  return row?.rank ?? null;
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

  const deptRoles = await departmentRoleDelegate().findMany({
    where: { departmentId: normalizedDeptId },
    select: { roleId: true, rank: true },
  });

  const rankByRoleId = new Map(deptRoles.map((row) => [idStr(row.roleId), Number(row.rank)]));
  let memberRank = rankByRoleId.get(normalizedRoleId);

  if (memberRank == null && normalizedRoleId) {
    const roleRow = await prisma.systemRole.findUnique({
      where: { id: normalizedRoleId },
      select: { roleName: true },
    });
    if (roleRow?.roleName) {
      const rolesWithName = await prisma.systemRole.findMany({
        where: { roleName: roleRow.roleName },
        select: { id: true },
      });
      for (const r of rolesWithName) {
        const rank = rankByRoleId.get(idStr(r.id));
        if (rank != null) {
          memberRank = rank;
          break;
        }
      }
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

  if (memberRank == null || deptRoles.length === 0) {
    const inDept = await prisma.user.findMany({
      where: {
        departmentId: normalizedDeptId,
        status: 'ACTIVE',
        isActive: true,
        ...(excludeMemberId ? { id: { not: excludeMemberId } } : {}),
      },
      select: memberListSelect,
    });
    return mergeManagerLists(inDept.map(normalizeMemberRow), superAdminNormalized);
  }

  const memberRankNum = Number(memberRank);
  const superiorRoleIds = deptRoles
    .filter((row) => Number(row.rank) < memberRankNum)
    .map((row) => row.roleId);

  if (superiorRoleIds.length === 0) {
    const topRoleIds = deptRoles.filter((row) => Number(row.rank) === 1).map((row) => row.roleId);
    const topMembers =
      topRoleIds.length > 0
        ? await prisma.user.findMany({
            where: {
              departmentId: normalizedDeptId,
              roleId: { in: topRoleIds },
              status: 'ACTIVE',
              isActive: true,
              ...(excludeMemberId ? { id: { not: excludeMemberId } } : {}),
            },
            select: memberListSelect,
          })
        : [];
    return mergeManagerLists(topMembers.map(normalizeMemberRow), superAdminNormalized);
  }

  const excludeFilter = excludeMemberId ? { id: { not: excludeMemberId } } : {};

  const inDeptSuperiors = await prisma.user.findMany({
    where: {
      departmentId: normalizedDeptId,
      roleId: { in: superiorRoleIds },
      status: 'ACTIVE',
      isActive: true,
      ...excludeFilter,
    },
    select: memberListSelect,
  });

  let superiors = inDeptSuperiors.map(normalizeMemberRow);

  if (superiors.length === 0) {
    const orgSuperiors = await prisma.user.findMany({
      where: {
        roleId: { in: superiorRoleIds },
        status: 'ACTIVE',
        isActive: true,
        ...excludeFilter,
      },
      select: memberListSelect,
    });
    superiors = orgSuperiors.map(normalizeMemberRow);
  }

  superiors.sort((a, b) => {
    const rankA = rankByRoleId.get(idStr(a.role?.id || a.roleId)) ?? 99;
    const rankB = rankByRoleId.get(idStr(b.role?.id || b.roleId)) ?? 99;
    return rankA - rankB;
  });

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
