import { OrgScopeContext } from '../org/org-scope.service';
/** Fail closed: no tenant → empty result set. */
export declare function tenantWhereFromScope(scope: OrgScopeContext | undefined | null): {
    tenantId: string;
} | {
    tenantId: {
        in: string[];
    };
};
export declare function requireTenantId(scope: OrgScopeContext | undefined | null): string;
/** Combine tenant isolation with org-unit visibility. */
export declare function orgUnitTenantWhere(scope: OrgScopeContext | undefined | null): {
    tenantId: string;
} | {
    tenantId: {
        in: string[];
    };
} | {
    id: {
        in: string[];
    };
    tenantId: string;
} | {
    id: {
        in: string[];
    };
    tenantId: {
        in: string[];
    };
};
