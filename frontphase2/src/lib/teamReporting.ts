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

export function getRoleRankInDepartment(
  departmentId: string | undefined,
  roleId: string | undefined,
  departments: DepartmentWithRoles[],
): number | null {
  if (!departmentId || !roleId) return null;
  const dept = departments.find((d) => d.id === departmentId);
  const rank = buildDepartmentRankMap(dept).get(idStr(roleId));
  return rank != null ? rank : null;
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

function mergeLists(primary: TeamMember[], extra: TeamMember[]): TeamMember[] {
  const merged = [...primary];
  for (const item of extra) {
    if (!merged.some((m) => m.id === item.id)) merged.push(item);
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
  const memberRank =
    memberRankOverride != null
      ? Number(memberRankOverride)
      : rankByRoleId.get(idStr(roleId));

  if (memberRank == null || Number.isNaN(memberRank) || rankByRoleId.size === 0) {
    const inDept = eligible.filter((m) => idStr(getMemberDepartmentId(m)) === idStr(departmentId));
    return mergeLists(inDept.length > 0 ? inDept : [], superAdmins);
  }

  const memberRankNum = Number(memberRank);

  const superiors = eligible
    .filter((m) => {
      if (isSuperAdminMember(m)) return false;
      const userRoleId = getMemberRoleId(m);
      if (!userRoleId) return false;
      const userRank = rankByRoleId.get(idStr(userRoleId));
      if (userRank == null) return false;
      return userRank < memberRankNum;
    })
    .sort((a, b) => {
      const rankA = rankByRoleId.get(idStr(getMemberRoleId(a))) ?? 99;
      const rankB = rankByRoleId.get(idStr(getMemberRoleId(b))) ?? 99;
      if (rankA !== rankB) return rankA - rankB;
      const aInDept = idStr(getMemberDepartmentId(a)) === idStr(departmentId) ? 0 : 1;
      const bInDept = idStr(getMemberDepartmentId(b)) === idStr(departmentId) ? 0 : 1;
      return aInDept - bInDept;
    });

  return mergeLists(superiors, superAdmins);
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
