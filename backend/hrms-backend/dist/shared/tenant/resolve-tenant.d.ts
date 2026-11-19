/**
 * Resolve the caller's tenant. Never falls back to "first tenant in DB"
 * (that leaked Client A data to Client B).
 */
export declare function resolveTenantId(user: {
    tenantId?: string | null;
    orgUnitId?: string | null;
    role?: string;
}): Promise<string | null>;
