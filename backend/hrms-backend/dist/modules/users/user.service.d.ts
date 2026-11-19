export declare class UserService {
    static getAll(scope?: {
        tenantId?: string | null;
        allowedOrgUnitIds?: string[] | null;
    }): Promise<{
        id: any;
        email: any;
        role: any;
        displayName: any;
        status: any;
        permissions: import("../../shared/permissions").UserPermissions;
        employee: {
            id: any;
            employeeId: any;
            name: string;
            email: any;
            department: any;
            designation: any;
            locationId: any;
            locationName: any;
            orgUnitId: any;
            orgUnitName: any;
        } | null;
        orgUnitId: any;
        orgUnitName: any;
        createdAt: any;
    }[]>;
    static create(data: any, actorTenantId?: string | null): Promise<{
        user: {
            id: any;
            email: any;
            role: any;
            displayName: any;
            status: any;
            permissions: import("../../shared/permissions").UserPermissions;
            employee: {
                id: any;
                employeeId: any;
                name: string;
                email: any;
                department: any;
                designation: any;
                locationId: any;
                locationName: any;
                orgUnitId: any;
                orgUnitName: any;
            } | null;
            orgUnitId: any;
            orgUnitName: any;
            createdAt: any;
        };
        employee: {
            id: any;
            employeeId: any;
            name: string;
            email: any;
            department: any;
            designation: any;
            locationId: any;
            locationName: any;
            orgUnitId: any;
            orgUnitName: any;
        } | {
            id: any;
            employeeId: any;
            name: string;
        } | null;
        onboarding: {
            id: string;
            status: string;
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
        };
    }>;
    static update(id: string, data: any, actorTenantId?: string | null): Promise<{
        id: any;
        email: any;
        role: any;
        displayName: any;
        status: any;
        permissions: import("../../shared/permissions").UserPermissions;
        employee: {
            id: any;
            employeeId: any;
            name: string;
            email: any;
            department: any;
            designation: any;
            locationId: any;
            locationName: any;
            orgUnitId: any;
            orgUnitName: any;
        } | null;
        orgUnitId: any;
        orgUnitName: any;
        createdAt: any;
    }>;
    static delete(id: string, actorTenantId?: string | null): Promise<{
        success: boolean;
    }>;
}
