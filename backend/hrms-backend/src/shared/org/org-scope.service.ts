import prisma from '../prisma';

export type OrgScopeContext = {
  tenantId: string | null;
  orgUnitId: string | null;
  /** null = unrestricted within tenant (HQ admin / HR) */
  allowedOrgUnitIds: string[] | null;
  /** null = unrestricted within tenant */
  scopedEmployeeIds: string[] | null;
  employeeSelfOnly: boolean;
  isHqAdmin: boolean;
};

const HQ_ROLES = new Set(['ADMIN', 'HR']);

export async function getDescendantOrgUnitIds(rootOrgUnitId: string): Promise<string[]> {
  const root = await prisma.orgUnit.findUnique({ where: { id: rootOrgUnitId } });
  if (!root) return [rootOrgUnitId];

  const all = await prisma.orgUnit.findMany({
    where: { tenantId: root.tenantId, status: 'ACTIVE' },
    select: { id: true, path: true },
  });

  return all.filter((unit) => unit.id === root.id || unit.path.startsWith(root.path)).map((u) => u.id);
}

export async function resolveOrgScope(user: {
  id: string;
  role: string;
  orgUnitId?: string | null;
  tenantId?: string | null;
  employeeId?: string | null;
}): Promise<OrgScopeContext> {
  // Platform owner is not attached to a tenant — empty scope (no ops data).
  if (user.role === 'PLATFORM_OWNER' && !user.tenantId) {
    return {
      tenantId: null,
      orgUnitId: null,
      allowedOrgUnitIds: [],
      scopedEmployeeIds: [],
      employeeSelfOnly: false,
      isHqAdmin: false,
    };
  }

  let tenantId: string | null = null;
  if (user.tenantId) {
    tenantId = (await prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { id: true } }))?.id || null;
  } else if (user.orgUnitId) {
    const ou = await prisma.orgUnit.findUnique({
      where: { id: user.orgUnitId },
      select: { tenantId: true },
    });
    tenantId = ou?.tenantId || null;
  }

  // Fail closed: never invent a tenant via findFirst().
  if (!tenantId) {
    return {
      tenantId: null,
      orgUnitId: user.orgUnitId || null,
      allowedOrgUnitIds: [],
      scopedEmployeeIds: [],
      employeeSelfOnly: false,
      isHqAdmin: false,
    };
  }

  const isHqAdmin = HQ_ROLES.has(user.role);

  if (isHqAdmin) {
    return {
      tenantId,
      orgUnitId: user.orgUnitId || null,
      allowedOrgUnitIds: null,
      scopedEmployeeIds: null,
      employeeSelfOnly: false,
      isHqAdmin: true,
    };
  }

  const bindingOrgUnitId = user.orgUnitId || null;

  if (user.role === 'EMPLOYEE') {
    const employeeId = user.employeeId || null;
    return {
      tenantId,
      orgUnitId: bindingOrgUnitId,
      allowedOrgUnitIds: bindingOrgUnitId ? [bindingOrgUnitId] : [],
      scopedEmployeeIds: employeeId ? [employeeId] : [],
      employeeSelfOnly: true,
      isHqAdmin: false,
    };
  }

  // MANAGER / site head: self + subtree within the same tenant
  if (user.role === 'MANAGER' && bindingOrgUnitId) {
    const allowedOrgUnitIds = await getDescendantOrgUnitIds(bindingOrgUnitId);
    const employees = await prisma.employee.findMany({
      where: {
        orgUnitId: { in: allowedOrgUnitIds },
        OR: [{ tenantId }, { tenantId: null, orgUnit: { tenantId } }],
      },
      select: { id: true },
    });
    return {
      tenantId,
      orgUnitId: bindingOrgUnitId,
      allowedOrgUnitIds,
      scopedEmployeeIds: employees.map((e) => e.id),
      employeeSelfOnly: false,
      isHqAdmin: false,
    };
  }

  return {
    tenantId,
    orgUnitId: bindingOrgUnitId,
    allowedOrgUnitIds: bindingOrgUnitId ? [bindingOrgUnitId] : [],
    scopedEmployeeIds: [],
    employeeSelfOnly: false,
    isHqAdmin: false,
  };
}

/**
 * Employees visible to this caller.
 * HQ (scopedEmployeeIds === null) → all employees in tenant.
 * Manager → subtree employee ids.
 * Employee → self only.
 */
export function employeeWhereFromScope(scope: OrgScopeContext) {
  if (!scope.tenantId) {
    return { id: { in: [] as string[] } };
  }

  const tenantClause = {
    OR: [
      { tenantId: scope.tenantId },
      { tenantId: null, orgUnit: { tenantId: scope.tenantId } },
      { tenantId: null, user: { tenantId: scope.tenantId } },
    ],
  };

  if (scope.scopedEmployeeIds == null) {
    return tenantClause;
  }
  if (scope.scopedEmployeeIds.length === 0) {
    return { id: { in: [] as string[] } };
  }
  return {
    AND: [{ id: { in: scope.scopedEmployeeIds } }, tenantClause],
  };
}

export function orgUnitWhereFromScope(scope: OrgScopeContext) {
  if (!scope.tenantId) {
    return { id: { in: [] as string[] } };
  }
  if (scope.allowedOrgUnitIds === null) {
    return { tenantId: scope.tenantId };
  }
  if (scope.allowedOrgUnitIds.length === 0) {
    return { id: { in: [] as string[] } };
  }
  return { tenantId: scope.tenantId, id: { in: scope.allowedOrgUnitIds } };
}
