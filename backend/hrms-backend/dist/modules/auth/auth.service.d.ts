export declare class AuthService {
    static login(email: string, password: string): Promise<{
        token: string;
        user: {
            id: any;
            email: any;
            role: any;
            displayName: any;
            status: any;
            permissions: import("../../shared/permissions").UserPermissions;
            tenantId: any;
            tenantStatus: any;
            packageKey: any;
            packageLabel: string | null;
            maxUsers: any;
            showUsersLocationColumn: boolean;
            orgUnitId: any;
            orgUnit: {
                id: any;
                name: any;
                levelOrder: any;
                isLeaf: any;
                path: any;
            } | null;
            employee: {
                id: any;
                employeeId: any;
                firstName: any;
                lastName: any;
                email: any;
                designation: any;
                department: any;
                locationId: any;
                location: {
                    id: any;
                    name: any;
                    address: any;
                    lat: any;
                    lng: any;
                    radiusMeters: any;
                } | null;
                orgUnitId: any;
                orgUnit: {
                    id: any;
                    name: any;
                    levelOrder: any;
                    isLeaf: any;
                    path: any;
                } | null;
                workLocationLat: any;
                workLocationLng: any;
                workLocationRadius: any;
                workLocationName: any;
            } | null;
            employeeId: any;
        };
    }>;
    static register(data: any): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.UserAccountStatus;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        password: string;
        role: import(".prisma/client").$Enums.Role;
        displayName: string | null;
        permissions: import("@prisma/client/runtime/library").JsonValue | null;
        tenantId: string | null;
        orgUnitId: string | null;
    }>;
    static getProfile(userId: string): Promise<{
        id: any;
        email: any;
        role: any;
        displayName: any;
        status: any;
        permissions: import("../../shared/permissions").UserPermissions;
        tenantId: any;
        tenantStatus: any;
        packageKey: any;
        packageLabel: string | null;
        maxUsers: any;
        showUsersLocationColumn: boolean;
        orgUnitId: any;
        orgUnit: {
            id: any;
            name: any;
            levelOrder: any;
            isLeaf: any;
            path: any;
        } | null;
        employee: {
            id: any;
            employeeId: any;
            firstName: any;
            lastName: any;
            email: any;
            designation: any;
            department: any;
            locationId: any;
            location: {
                id: any;
                name: any;
                address: any;
                lat: any;
                lng: any;
                radiusMeters: any;
            } | null;
            orgUnitId: any;
            orgUnit: {
                id: any;
                name: any;
                levelOrder: any;
                isLeaf: any;
                path: any;
            } | null;
            workLocationLat: any;
            workLocationLng: any;
            workLocationRadius: any;
            workLocationName: any;
        } | null;
        employeeId: any;
    }>;
}
