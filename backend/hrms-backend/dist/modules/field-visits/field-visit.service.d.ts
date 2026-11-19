export declare class FieldVisitService {
    static listVisitLocations(activeOnly?: boolean): Promise<({
        _count: {
            employees: number;
        };
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string | null;
        orgUnitId: string | null;
        address: string | null;
        lat: number;
        lng: number;
        radiusMeters: number;
        isActive: boolean;
        usage: import(".prisma/client").$Enums.LocationUsage;
    })[]>;
    static listRoster(dateKey: string, scopedEmployeeIds: string[] | null, employeeId?: string): Promise<({
        id: string;
        status: import(".prisma/client").$Enums.FieldVisitStatus;
        createdAt: Date;
        updatedAt: Date;
        employeeId: string;
        locationId: string;
        distanceMeters: number | null;
        notes: string | null;
        dateKey: string;
        sequence: number;
        plannedTime: string | null;
        verifiedAt: Date | null;
        verifyLat: number | null;
        verifyLng: number | null;
    } & {
        employee?: any;
        location: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string | null;
            orgUnitId: string | null;
            address: string | null;
            lat: number;
            lng: number;
            radiusMeters: number;
            isActive: boolean;
            usage: import(".prisma/client").$Enums.LocationUsage;
        } | null;
    })[]>;
    static assignRoster(data: {
        dateKey: string;
        employeeId: string;
        locationIds: string[];
        plannedTimes?: string[];
    }): Promise<({
        id: string;
        status: import(".prisma/client").$Enums.FieldVisitStatus;
        createdAt: Date;
        updatedAt: Date;
        employeeId: string;
        locationId: string;
        distanceMeters: number | null;
        notes: string | null;
        dateKey: string;
        sequence: number;
        plannedTime: string | null;
        verifiedAt: Date | null;
        verifyLat: number | null;
        verifyLng: number | null;
    } & {
        employee?: any;
        location: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string | null;
            orgUnitId: string | null;
            address: string | null;
            lat: number;
            lng: number;
            radiusMeters: number;
            isActive: boolean;
            usage: import(".prisma/client").$Enums.LocationUsage;
        } | null;
    })[]>;
    static removeAssignment(id: string): Promise<{
        success: boolean;
    }>;
    static getMineToday(userId: string): Promise<{
        employee: null;
        assignments: never[];
        lastPing?: undefined;
    } | {
        employee: {
            id: string;
            status: import(".prisma/client").$Enums.EmployeeStatus;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            tenantId: string | null;
            orgUnitId: string | null;
            employeeId: string;
            firstName: string;
            lastName: string;
            userId: string | null;
            phone: string | null;
            designation: string;
            department: string;
            joiningDate: Date;
            locationId: string | null;
            reportsToUserId: string | null;
            totalLeaves: number;
            probationEndDate: Date | null;
        };
        assignments: ({
            id: string;
            status: import(".prisma/client").$Enums.FieldVisitStatus;
            createdAt: Date;
            updatedAt: Date;
            employeeId: string;
            locationId: string;
            distanceMeters: number | null;
            notes: string | null;
            dateKey: string;
            sequence: number;
            plannedTime: string | null;
            verifiedAt: Date | null;
            verifyLat: number | null;
            verifyLng: number | null;
        } & {
            employee?: any;
            location: {
                id: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                tenantId: string | null;
                orgUnitId: string | null;
                address: string | null;
                lat: number;
                lng: number;
                radiusMeters: number;
                isActive: boolean;
                usage: import(".prisma/client").$Enums.LocationUsage;
            } | null;
        })[];
        lastPing: {
            id: string;
            employeeId: string;
            lat: number;
            lng: number;
            recordedAt: Date;
        } | null;
    }>;
    static verifyVisit(assignmentId: string, userId: string, lat: number, lng: number, allowHrOverride?: boolean): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.FieldVisitStatus;
        createdAt: Date;
        updatedAt: Date;
        employeeId: string;
        locationId: string;
        distanceMeters: number | null;
        notes: string | null;
        dateKey: string;
        sequence: number;
        plannedTime: string | null;
        verifiedAt: Date | null;
        verifyLat: number | null;
        verifyLng: number | null;
    } & {
        employee?: any;
        location: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string | null;
            orgUnitId: string | null;
            address: string | null;
            lat: number;
            lng: number;
            radiusMeters: number;
            isActive: boolean;
            usage: import(".prisma/client").$Enums.LocationUsage;
        } | null;
    }>;
    static markMissed(id: string): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.FieldVisitStatus;
        createdAt: Date;
        updatedAt: Date;
        employeeId: string;
        locationId: string;
        distanceMeters: number | null;
        notes: string | null;
        dateKey: string;
        sequence: number;
        plannedTime: string | null;
        verifiedAt: Date | null;
        verifyLat: number | null;
        verifyLng: number | null;
    } & {
        employee?: any;
        location: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string | null;
            orgUnitId: string | null;
            address: string | null;
            lat: number;
            lng: number;
            radiusMeters: number;
            isActive: boolean;
            usage: import(".prisma/client").$Enums.LocationUsage;
        } | null;
    }>;
    static recordPing(userId: string, lat: number, lng: number): Promise<{
        id: string;
        employeeId: string;
        lat: number;
        lng: number;
        recordedAt: Date;
    }>;
    static getLiveSnapshot(dateKey: string, scopedEmployeeIds: string[] | null): Promise<{
        employee: {
            id: string;
            employeeId: string;
            firstName: string;
            lastName: string;
            designation: string;
            department: string;
        };
        assignments: ({
            id: string;
            status: import(".prisma/client").$Enums.FieldVisitStatus;
            createdAt: Date;
            updatedAt: Date;
            employeeId: string;
            locationId: string;
            distanceMeters: number | null;
            notes: string | null;
            dateKey: string;
            sequence: number;
            plannedTime: string | null;
            verifiedAt: Date | null;
            verifyLat: number | null;
            verifyLng: number | null;
        } & {
            employee?: any;
            location: {
                id: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                tenantId: string | null;
                orgUnitId: string | null;
                address: string | null;
                lat: number;
                lng: number;
                radiusMeters: number;
                isActive: boolean;
                usage: import(".prisma/client").$Enums.LocationUsage;
            } | null;
        })[];
        lastPing: {
            id: string;
            employeeId: string;
            lat: number;
            lng: number;
            recordedAt: Date;
        } | null;
        progress: {
            total: number;
            verified: number;
            pending: number;
        };
    }[]>;
}
