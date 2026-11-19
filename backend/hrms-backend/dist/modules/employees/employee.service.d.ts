import { OrgScopeContext } from '../../shared/org/org-scope.service';
export declare class EmployeeService {
    static getAll(scope?: OrgScopeContext): Promise<({
        orgUnit: {
            id: string;
            name: string;
            levelOrder: number;
            isLeaf: boolean;
        } | null;
        user: {
            email: string;
            role: import(".prisma/client").$Enums.Role;
        } | null;
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
    } & {
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
    })[]>;
    static getById(id: string, scope?: OrgScopeContext): Promise<({
        orgUnit: {
            id: string;
            name: string;
            levelOrder: number;
            isLeaf: boolean;
        } | null;
        user: {
            email: string;
            role: import(".prisma/client").$Enums.Role;
        } | null;
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
    } & {
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
    }) | null>;
    static create(scope: OrgScopeContext, data: any): Promise<{
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
    }>;
    static update(scope: OrgScopeContext, id: string, data: any): Promise<{
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
    }>;
    static delete(scope: OrgScopeContext, id: string): Promise<{
        success: boolean;
    }>;
}
