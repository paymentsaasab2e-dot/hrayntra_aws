import { OrgScopeContext } from '../org/org-scope.service';

/** Fail closed: no tenant → empty result set. */
export function tenantWhereFromScope(scope: OrgScopeContext | undefined | null): { tenantId: string } | { tenantId: { in: string[] } } {
  if (!scope?.tenantId) return { tenantId: { in: [] as string[] } };
  return { tenantId: scope.tenantId };
}

export function requireTenantId(scope: OrgScopeContext | undefined | null): string {
  if (!scope?.tenantId) {
    throw new Error('Tenant context required. Your account is not bound to a company.');
  }
  return scope.tenantId;
}

/** Combine tenant isolation with org-unit visibility. */
export function orgUnitTenantWhere(scope: OrgScopeContext | undefined | null) {
  const tenant = tenantWhereFromScope(scope);
  if (!scope || scope.allowedOrgUnitIds === null) {
    return tenant;
  }
  if (scope.allowedOrgUnitIds.length === 0) {
    return { ...tenant, id: { in: [] as string[] } };
  }
  return { ...tenant, id: { in: scope.allowedOrgUnitIds } };
}
