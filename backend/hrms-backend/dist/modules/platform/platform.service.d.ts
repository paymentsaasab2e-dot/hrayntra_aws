import { TenantPackageKey } from '../../shared/tenant-packages';
export declare class PlatformService {
    static listPackages(): {
        key: TenantPackageKey;
        label: string;
        description: string;
        maxUsers: number;
        enabledTabs: string[];
        enabledActions: string[];
    }[];
    static getStatsSummary(filters?: {
        minUsers?: number;
        maxUsers?: number;
        packageKey?: string;
        status?: string;
    }): Promise<{
        totals: {
            tenants: number;
            users: number;
            employees: number;
            pendingApprovals: number;
        };
        tenants: {
            id: any;
            name: any;
            slug: any;
            status: any;
            packageKey: any;
            packageLabel: string;
            maxUsers: any;
            packagePermissions: any;
            hierarchyLevels: any;
            approvalLevels: any;
            orgUnits: any;
            stats: {
                userCount: number;
                orgUnitCount: number;
                employeeCount: number;
                pendingApprovals: number;
                activeUsers: number;
                managers: number;
                usersByRole: Record<string, number>;
                usersByStatus: Record<string, number>;
                byHierarchyLevel: {
                    levelOrder: number;
                    orgUnitCount: number;
                    userCount: number;
                }[];
            } | {
                userCount: any;
                orgUnitCount: any;
                employeeCount: number;
                pendingApprovals: number;
                activeUsers: number;
                managers: number;
                usersByRole: {};
                usersByStatus: {};
                byHierarchyLevel: never[];
            };
            provisionedAdminEmail: any;
            hasProvisionedCredentials: boolean;
            showUsersLocationColumn: boolean;
            createdAt: any;
            updatedAt: any;
        }[];
    }>;
    static listTenants(): Promise<{
        id: any;
        name: any;
        slug: any;
        status: any;
        packageKey: any;
        packageLabel: string;
        maxUsers: any;
        packagePermissions: any;
        hierarchyLevels: any;
        approvalLevels: any;
        orgUnits: any;
        stats: {
            userCount: number;
            orgUnitCount: number;
            employeeCount: number;
            pendingApprovals: number;
            activeUsers: number;
            managers: number;
            usersByRole: Record<string, number>;
            usersByStatus: Record<string, number>;
            byHierarchyLevel: {
                levelOrder: number;
                orgUnitCount: number;
                userCount: number;
            }[];
        } | {
            userCount: any;
            orgUnitCount: any;
            employeeCount: number;
            pendingApprovals: number;
            activeUsers: number;
            managers: number;
            usersByRole: {};
            usersByStatus: {};
            byHierarchyLevel: never[];
        };
        provisionedAdminEmail: any;
        hasProvisionedCredentials: boolean;
        showUsersLocationColumn: boolean;
        createdAt: any;
        updatedAt: any;
    }[]>;
    static getTenant(id: string): Promise<{
        id: any;
        name: any;
        slug: any;
        status: any;
        packageKey: any;
        packageLabel: string;
        maxUsers: any;
        packagePermissions: any;
        hierarchyLevels: any;
        approvalLevels: any;
        orgUnits: any;
        stats: {
            userCount: number;
            orgUnitCount: number;
            employeeCount: number;
            pendingApprovals: number;
            activeUsers: number;
            managers: number;
            usersByRole: Record<string, number>;
            usersByStatus: Record<string, number>;
            byHierarchyLevel: {
                levelOrder: number;
                orgUnitCount: number;
                userCount: number;
            }[];
        } | {
            userCount: any;
            orgUnitCount: any;
            employeeCount: number;
            pendingApprovals: number;
            activeUsers: number;
            managers: number;
            usersByRole: {};
            usersByStatus: {};
            byHierarchyLevel: never[];
        };
        provisionedAdminEmail: any;
        hasProvisionedCredentials: boolean;
        showUsersLocationColumn: boolean;
        createdAt: any;
        updatedAt: any;
    }>;
    static createTenant(data: {
        name: string;
        slug?: string;
        rootOrgName?: string;
        levels?: any[];
        packageKey?: TenantPackageKey;
        maxUsers?: number;
        customPermissions?: any;
        tenantAdmin?: {
            email: string;
            password?: string;
            displayName?: string;
        };
    }): Promise<{
        tenantAdmin: {
            id: string;
            email: string;
            displayName: string | null;
            role: import(".prisma/client").$Enums.Role;
            password: string | null;
        };
        email: {
            sent: boolean;
            skipped: boolean;
            message: string;
            id: string;
        } | {
            sent: boolean;
            skipped: boolean;
            message: any;
            id?: undefined;
        } | null;
        rootOrgUnitId: string;
        id: any;
        name: any;
        slug: any;
        status: any;
        packageKey: any;
        packageLabel: string;
        maxUsers: any;
        packagePermissions: any;
        hierarchyLevels: any;
        approvalLevels: any;
        orgUnits: any;
        stats: {
            userCount: number;
            orgUnitCount: number;
            employeeCount: number;
            pendingApprovals: number;
            activeUsers: number;
            managers: number;
            usersByRole: Record<string, number>;
            usersByStatus: Record<string, number>;
            byHierarchyLevel: {
                levelOrder: number;
                orgUnitCount: number;
                userCount: number;
            }[];
        } | {
            userCount: any;
            orgUnitCount: any;
            employeeCount: number;
            pendingApprovals: number;
            activeUsers: number;
            managers: number;
            usersByRole: {};
            usersByStatus: {};
            byHierarchyLevel: never[];
        };
        provisionedAdminEmail: any;
        hasProvisionedCredentials: boolean;
        showUsersLocationColumn: boolean;
        createdAt: any;
        updatedAt: any;
    }>;
    static getTenantCredentials(id: string): Promise<{
        tenantId: string;
        tenantName: string;
        userId: string | null;
        email: string | null;
        password: string | null;
        message: string | null;
    }>;
    static updateTenant(id: string, data: {
        name?: string;
        slug?: string;
        status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
        rootOrgName?: string;
        showUsersLocationColumn?: boolean;
    }): Promise<{
        id: any;
        name: any;
        slug: any;
        status: any;
        packageKey: any;
        packageLabel: string;
        maxUsers: any;
        packagePermissions: any;
        hierarchyLevels: any;
        approvalLevels: any;
        orgUnits: any;
        stats: {
            userCount: number;
            orgUnitCount: number;
            employeeCount: number;
            pendingApprovals: number;
            activeUsers: number;
            managers: number;
            usersByRole: Record<string, number>;
            usersByStatus: Record<string, number>;
            byHierarchyLevel: {
                levelOrder: number;
                orgUnitCount: number;
                userCount: number;
            }[];
        } | {
            userCount: any;
            orgUnitCount: any;
            employeeCount: number;
            pendingApprovals: number;
            activeUsers: number;
            managers: number;
            usersByRole: {};
            usersByStatus: {};
            byHierarchyLevel: never[];
        };
        provisionedAdminEmail: any;
        hasProvisionedCredentials: boolean;
        showUsersLocationColumn: boolean;
        createdAt: any;
        updatedAt: any;
    }>;
    static updateTenantAdmin(id: string, data: {
        displayName?: string;
        email?: string;
        password?: string;
    }): Promise<{
        tenantId: string;
        tenantName: string;
        userId: string | null;
        email: string | null;
        password: string | null;
        message: string | null;
    }>;
    static updateTenantPackage(id: string, data: {
        packageKey: TenantPackageKey;
        maxUsers?: number;
        customPermissions?: any;
    }): Promise<{
        id: any;
        name: any;
        slug: any;
        status: any;
        packageKey: any;
        packageLabel: string;
        maxUsers: any;
        packagePermissions: any;
        hierarchyLevels: any;
        approvalLevels: any;
        orgUnits: any;
        stats: {
            userCount: number;
            orgUnitCount: number;
            employeeCount: number;
            pendingApprovals: number;
            activeUsers: number;
            managers: number;
            usersByRole: Record<string, number>;
            usersByStatus: Record<string, number>;
            byHierarchyLevel: {
                levelOrder: number;
                orgUnitCount: number;
                userCount: number;
            }[];
        } | {
            userCount: any;
            orgUnitCount: any;
            employeeCount: number;
            pendingApprovals: number;
            activeUsers: number;
            managers: number;
            usersByRole: {};
            usersByStatus: {};
            byHierarchyLevel: never[];
        };
        provisionedAdminEmail: any;
        hasProvisionedCredentials: boolean;
        showUsersLocationColumn: boolean;
        createdAt: any;
        updatedAt: any;
    }>;
    static syncTenantUserPermissions(tenantId: string, packagePermissions: any): Promise<void>;
    static deleteTenant(id: string): Promise<{
        success: boolean;
    }>;
}
