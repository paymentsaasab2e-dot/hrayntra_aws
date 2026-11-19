import { OrgScopeContext } from '../../shared/org/org-scope.service';
export declare class DocumentService {
    static getAll(scope: OrgScopeContext, filters?: any): Promise<({
        employee: {
            employeeId: string;
            firstName: string;
            lastName: string;
            department: string;
        } | null;
    } & {
        id: string;
        name: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string | null;
        employeeId: string | null;
        category: string;
        type: string;
        tags: string[];
        uploadedBy: string;
        uploadedAt: Date;
        size: string;
        url: string;
    })[]>;
    static getById(scope: OrgScopeContext, id: string): Promise<({
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
        } | null;
    } & {
        id: string;
        name: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string | null;
        employeeId: string | null;
        category: string;
        type: string;
        tags: string[];
        uploadedBy: string;
        uploadedAt: Date;
        size: string;
        url: string;
    }) | null>;
    static create(scope: OrgScopeContext, data: any): Promise<{
        id: string;
        name: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string | null;
        employeeId: string | null;
        category: string;
        type: string;
        tags: string[];
        uploadedBy: string;
        uploadedAt: Date;
        size: string;
        url: string;
    }>;
    static update(scope: OrgScopeContext, id: string, data: any): Promise<{
        id: string;
        name: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string | null;
        employeeId: string | null;
        category: string;
        type: string;
        tags: string[];
        uploadedBy: string;
        uploadedAt: Date;
        size: string;
        url: string;
    }>;
    static archive(scope: OrgScopeContext, id: string): Promise<{
        id: string;
        name: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string | null;
        employeeId: string | null;
        category: string;
        type: string;
        tags: string[];
        uploadedBy: string;
        uploadedAt: Date;
        size: string;
        url: string;
    }>;
    static delete(scope: OrgScopeContext, id: string): Promise<{
        id: string;
        name: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string | null;
        employeeId: string | null;
        category: string;
        type: string;
        tags: string[];
        uploadedBy: string;
        uploadedAt: Date;
        size: string;
        url: string;
    }>;
}
