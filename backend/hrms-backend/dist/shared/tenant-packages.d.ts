import { UserPermissions } from './permissions';
export type TenantPackageKey = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
export type TenantPackageDefinition = {
    key: TenantPackageKey;
    label: string;
    description: string;
    maxUsers: number;
    permissions: UserPermissions;
};
export declare const TENANT_PACKAGES: TenantPackageDefinition[];
export declare function getTenantPackage(key?: string | null): TenantPackageDefinition;
export declare function applyTenantPackageCeiling(userPermissions: UserPermissions, packagePermissions: UserPermissions): UserPermissions;
/** Effective permissions for a tenant user: role capabilities capped by tenant package. */
export declare function resolveTenantUserPermissions(role: string, packagePermissions: UserPermissions): UserPermissions;
