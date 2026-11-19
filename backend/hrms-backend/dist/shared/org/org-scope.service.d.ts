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
export declare function getDescendantOrgUnitIds(rootOrgUnitId: string): Promise<string[]>;
export declare function resolveOrgScope(user: {
    id: string;
    role: string;
    orgUnitId?: string | null;
    tenantId?: string | null;
    employeeId?: string | null;
}): Promise<OrgScopeContext>;
/**
 * Employees visible to this caller.
 * HQ (scopedEmployeeIds === null) → all employees in tenant.
 * Manager → subtree employee ids.
 * Employee → self only.
 */
export declare function employeeWhereFromScope(scope: OrgScopeContext): {
    OR: ({
        tenantId: string;
        orgUnit?: undefined;
        user?: undefined;
    } | {
        tenantId: null;
        orgUnit: {
            tenantId: string;
        };
        user?: undefined;
    } | {
        tenantId: null;
        user: {
            tenantId: string;
        };
        orgUnit?: undefined;
    })[];
} | {
    id: {
        in: string[];
    };
    AND?: undefined;
} | {
    AND: ({
        OR: ({
            tenantId: string;
            orgUnit?: undefined;
            user?: undefined;
        } | {
            tenantId: null;
            orgUnit: {
                tenantId: string;
            };
            user?: undefined;
        } | {
            tenantId: null;
            user: {
                tenantId: string;
            };
            orgUnit?: undefined;
        })[];
    } | {
        id: {
            in: string[];
        };
    })[];
    id?: undefined;
};
export declare function orgUnitWhereFromScope(scope: OrgScopeContext): {
    id: {
        in: string[];
    };
    tenantId?: undefined;
} | {
    tenantId: string;
    id?: undefined;
} | {
    tenantId: string;
    id: {
        in: string[];
    };
};
