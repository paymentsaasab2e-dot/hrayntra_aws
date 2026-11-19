import { OrgScopeContext } from '../../shared/org/org-scope.service';
export declare class AssetService {
    static getAll(scope: OrgScopeContext): Promise<({
        allocations: ({
            employee: {
                employeeId: string;
                firstName: string;
                lastName: string;
            };
        } & {
            id: string;
            status: string;
            createdAt: Date;
            updatedAt: Date;
            employeeId: string;
            notes: string | null;
            assetId: string;
            issuedOn: string;
            expectedReturn: string | null;
            returnedOn: string | null;
            conditionOnIssue: string;
            conditionOnReturn: string | null;
            issuedBy: string;
        })[];
    } & {
        id: string;
        name: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string | null;
        type: string;
        serialNumber: string;
        brand: string;
        model: string;
        condition: string;
        purchasedOn: string;
        warrantyUntil: string | null;
        notes: string | null;
    })[]>;
    static getById(scope: OrgScopeContext, id: string): Promise<({
        allocations: ({
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
        } & {
            id: string;
            status: string;
            createdAt: Date;
            updatedAt: Date;
            employeeId: string;
            notes: string | null;
            assetId: string;
            issuedOn: string;
            expectedReturn: string | null;
            returnedOn: string | null;
            conditionOnIssue: string;
            conditionOnReturn: string | null;
            issuedBy: string;
        })[];
    } & {
        id: string;
        name: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string | null;
        type: string;
        serialNumber: string;
        brand: string;
        model: string;
        condition: string;
        purchasedOn: string;
        warrantyUntil: string | null;
        notes: string | null;
    }) | null>;
    static create(scope: OrgScopeContext, data: any): Promise<{
        id: string;
        name: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string | null;
        type: string;
        serialNumber: string;
        brand: string;
        model: string;
        condition: string;
        purchasedOn: string;
        warrantyUntil: string | null;
        notes: string | null;
    }>;
    static update(scope: OrgScopeContext, id: string, data: any): Promise<{
        id: string;
        name: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string | null;
        type: string;
        serialNumber: string;
        brand: string;
        model: string;
        condition: string;
        purchasedOn: string;
        warrantyUntil: string | null;
        notes: string | null;
    }>;
    static delete(scope: OrgScopeContext, id: string): Promise<{
        id: string;
        name: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string | null;
        type: string;
        serialNumber: string;
        brand: string;
        model: string;
        condition: string;
        purchasedOn: string;
        warrantyUntil: string | null;
        notes: string | null;
    }>;
    static getAllocations(scope: OrgScopeContext): Promise<({
        employee: {
            employeeId: string;
            firstName: string;
            lastName: string;
            department: string;
        };
        asset: {
            id: string;
            name: string;
            status: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string | null;
            type: string;
            serialNumber: string;
            brand: string;
            model: string;
            condition: string;
            purchasedOn: string;
            warrantyUntil: string | null;
            notes: string | null;
        };
    } & {
        id: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        employeeId: string;
        notes: string | null;
        assetId: string;
        issuedOn: string;
        expectedReturn: string | null;
        returnedOn: string | null;
        conditionOnIssue: string;
        conditionOnReturn: string | null;
        issuedBy: string;
    })[]>;
    static assignAsset(scope: OrgScopeContext, data: any): Promise<{
        id: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        employeeId: string;
        notes: string | null;
        assetId: string;
        issuedOn: string;
        expectedReturn: string | null;
        returnedOn: string | null;
        conditionOnIssue: string;
        conditionOnReturn: string | null;
        issuedBy: string;
    }>;
    static returnAsset(scope: OrgScopeContext, allocationId: string, data: any): Promise<{
        id: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        employeeId: string;
        notes: string | null;
        assetId: string;
        issuedOn: string;
        expectedReturn: string | null;
        returnedOn: string | null;
        conditionOnIssue: string;
        conditionOnReturn: string | null;
        issuedBy: string;
    }>;
}
