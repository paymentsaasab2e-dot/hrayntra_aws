import { OrgScopeContext } from '../../shared/org/org-scope.service';
export declare class HolidayService {
    static getAll(scope: OrgScopeContext, activeOnly?: boolean): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string | null;
        isActive: boolean;
        type: string | null;
        description: string | null;
        date: Date;
    }[]>;
    static create(scope: OrgScopeContext, data: any): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string | null;
        isActive: boolean;
        type: string | null;
        description: string | null;
        date: Date;
    }>;
    static bulkCreate(scope: OrgScopeContext, holidays: any[]): Promise<import(".prisma/client").Prisma.BatchPayload>;
    static update(scope: OrgScopeContext, id: string, data: any): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string | null;
        isActive: boolean;
        type: string | null;
        description: string | null;
        date: Date;
    }>;
    static delete(scope: OrgScopeContext, id: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string | null;
        isActive: boolean;
        type: string | null;
        description: string | null;
        date: Date;
    }>;
}
