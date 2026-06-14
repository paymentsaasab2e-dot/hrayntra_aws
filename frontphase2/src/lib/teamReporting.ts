import type { Department, DepartmentRoleLink, Role, TeamMember } from '../types/team';

export type DepartmentWithRoles = Department & {
  departmentRoles?: DepartmentRoleLink[];
};

const idStr = (id: string | undefined | null) => String(id || '').trim();

export function getMemberDepartmentId(member: TeamMember & { departmentId?: string }): string | undefined {
  return member.department?.id || member.departmentId;
}

export function getMemberRoleId(member: TeamMember & { roleId?: string; systemRole?: Role }): string | undefined {
  return member.role?.id || member.roleId || member.systemRole?.id;
}

export function getDepartmentRoleLinks(department?: DepartmentWithRoles | null): DepartmentRoleLink[] {
  if (!department?.departmentRoles?.length) return [];
  return [...department.departmentRoles].sort((a, b) => Number(a.rank) - Number(b.rank));
}

/** Map roleId -> rank for a department (rank 1 = highest authority). */
export function buildDepartmentRankMap(
  department?: DepartmentWithRoles | null,
  roleOptions?: Array<Role & { rank?: number }>,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const link of getDepartmentRoleLinks(department)) {
    map.set(idStr(link.roleId), Number(link.rank));
  }
  if (map.size === 0 && roleOptions?.length) {
    for (const role of roleOptions) {
      if (role.rank != null) map.set(idStr(role.id), Number(role.rank));
    }
  }
  return map;
}

function buildDepartmentRankNameMap(
  department?: DepartmentWithRoles | null,
  roleOptions?: Array<Role & { rank?: number }>,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const link of getDepartmentRoleLinks(department)) {
    const roleName = String(link.role?.roleName || '').trim().toLowerCase();
    if (roleName) map.set(roleName, Number(link.rank));
  }
  for (const role of roleOptions || []) {
    const roleName = String(role.roleName || '').trim().toLowerCase();
    if (roleName && role.rank != null) map.set(roleName, Number(role.rank));
  }
  return map;
}

function resolveMemberRankInDepartment(
  member: TeamMember,
  rankByRoleId: Map<string, number>,
  rankByRoleName: Map<string, number>,
): number | null {
  const roleId = idStr(getMemberRoleId(member));
  if (rankByRoleId.has(roleId)) return rankByRoleId.get(roleId) ?? null;

  const roleName = String(
    member.role?.roleName ||
      (member as { systemRole?: { roleName?: string } }).systemRole?.roleName ||
      '',
  )
    .trim()
    .toLowerCase();
  if (roleName && rankByRoleName.has(roleName)) return rankByRoleName.get(roleName) ?? null;

  return null;
}

export function getRoleRankInDepartment(
  departmentId: string | undefined,
  roleId: string | undefined,
  departments: DepartmentWithRoles[],
  roleName?: string | null,
): number | null {
  if (!departmentId || (!roleId && !roleName)) return null;
  const dept = departments.find((d) => d.id === departmentId);
  const rankByRoleId = buildDepartmentRankMap(dept);
  const rankByRoleName = buildDepartmentRankNameMap(dept);
  if (roleId) {
    const direct = rankByRoleId.get(idStr(roleId));
    if (direct != null) return direct;
  }
  const normalizedName = String(roleName || '').trim().toLowerCase();
  if (normalizedName && rankByRoleName.has(normalizedName)) {
    return rankByRoleName.get(normalizedName) ?? null;
  }
  return null;
}

/** Roles available for a member in the selected department (falls back to all roles if none configured). */
export function getRolesForDepartment(
  departmentId: string | undefined,
  departments: DepartmentWithRoles[],
  allRoles: Role[],
): Array<Role & { rank?: number }> {
  if (!departmentId) return allRoles;

  const dept = departments.find((d) => d.id === departmentId);
  const links = getDepartmentRoleLinks(dept);
  if (links.length === 0) return allRoles;

  return links
    .map((link) => {
      const role = link.role || allRoles.find((r) => idStr(r.id) === idStr(link.roleId));
      if (!role) return null;
      return { ...role, rank: Number(link.rank) };
    })
    .filter(Boolean) as Array<Role & { rank?: number }>;
}

export function isSuperAdminMember(member: TeamMember): boolean {
  const roleName = member.role?.roleName || (member as { systemRole?: { roleName?: string } }).systemRole?.roleName;
  return roleName === 'Super Admin';
}

export function mergeReportingManagerLists(...lists: TeamMember[][]): TeamMember[] {
  const merged: TeamMember[] = [];
  for (const list of lists) {
    for (const member of list) {
      if (!merged.some((entry) => entry.id === member.id)) merged.push(member);
    }
  }
  return merged;
}

/**
 * Reports To: anyone whose department role rank is LESS than the selected role (lower number = superior).
 * Super Admin is always included as fallback.
 */
export function filterReportingManagers(options: {
  managers: TeamMember[];
  departmentId?: string;
  roleId?: string;
  departments: DepartmentWithRoles[];
  excludeMemberId?: string;
  /** When known from role dropdown (Rank N). */
  memberRank?: number | null;
  /** Roles configured for the selected department. */
  departmentRoleOptions?: Array<Role & { rank?: number }>;
}): TeamMember[] {
  const {
    managers,
    departmentId,
    roleId,
    departments,
    excludeMemberId,
    memberRank: memberRankOverride,
    departmentRoleOptions,
  } = options;

  const eligible = managers.filter((m) => {
    if (m.status && m.status !== 'ACTIVE') return false;
    if (excludeMemberId && m.id === excludeMemberId) return false;
    return true;
  });

  const superAdmins = eligible.filter(isSuperAdminMember);

  if (!departmentId || !roleId) {
    return superAdmins.length > 0 ? superAdmins : eligible;
  }

  const dept = departments.find((d) => idStr(d.id) === idStr(departmentId));
  const rankByRoleId = buildDepartmentRankMap(dept, departmentRoleOptions);
  const rankByRoleName = buildDepartmentRankNameMap(dept, departmentRoleOptions);
  const memberRank =
    memberRankOverride != null
      ? Number(memberRankOverride)
      : rankByRoleId.get(idStr(roleId)) ??
        (() => {
          const selected = departmentRoleOptions?.find((role) => idStr(role.id) === idStr(roleId));
          return selected?.rank != null ? Number(selected.rank) : null;
        })();

  if (memberRank == null || Number.isNaN(memberRank) || rankByRoleId.size === 0) {
    const inDept = eligible.filter((m) => idStr(getMemberDepartmentId(m)) === idStr(departmentId));
    return mergeReportingManagerLists(inDept.length > 0 ? inDept : [], superAdmins);
  }

  const memberRankNum = Number(memberRank);

  const superiorsInDept = eligible
    .filter((m) => {
      if (idStr(getMemberDepartmentId(m)) !== idStr(departmentId)) return false;
      if (isSuperAdminMember(m)) return false;
      const userRank = resolveMemberRankInDepartment(m, rankByRoleId, rankByRoleName);
      return userRank != null && userRank < memberRankNum;
    })
    .sort((a, b) => {
      const rankA = resolveMemberRankInDepartment(a, rankByRoleId, rankByRoleName) ?? 99;
      const rankB = resolveMemberRankInDepartment(b, rankByRoleId, rankByRoleName) ?? 99;
      return rankA - rankB;
    });

  const superiors =
    superiorsInDept.length > 0
      ? superiorsInDept
      : eligible
          .filter((m) => {
            if (isSuperAdminMember(m)) return false;
            const userRank = resolveMemberRankInDepartment(m, rankByRoleId, rankByRoleName);
            return userRank != null && userRank < memberRankNum;
          })
          .sort((a, b) => {
            const rankA = resolveMemberRankInDepartment(a, rankByRoleId, rankByRoleName) ?? 99;
            const rankB = resolveMemberRankInDepartment(b, rankByRoleId, rankByRoleName) ?? 99;
            if (rankA !== rankB) return rankA - rankB;
            const aInDept = idStr(getMemberDepartmentId(a)) === idStr(departmentId) ? 0 : 1;
            const bInDept = idStr(getMemberDepartmentId(b)) === idStr(departmentId) ? 0 : 1;
            return aInDept - bInDept;
          });

  return mergeReportingManagerLists(superiors, superAdmins);
}

export function pickDefaultManagerId(
  reportingOptions: TeamMember[],
  currentManagerId?: string,
): string {
  if (currentManagerId && reportingOptions.some((m) => m.id === currentManagerId)) {
    return currentManagerId;
  }

  const nonSuper = reportingOptions.filter((m) => !isSuperAdminMember(m));
  if (nonSuper.length > 0) {
    return nonSuper[0].id;
  }

  const superAdmin = reportingOptions.find(isSuperAdminMember);
  return superAdmin?.id || reportingOptions[0]?.id || '';
}
