import { OrgScopeContext } from '../../shared/org/org-scope.service';
export declare class LocationService {
    static getAll(scope: OrgScopeContext, activeOnly?: boolean): Promise<({
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
    static getById(scope: OrgScopeContext, id: string): Promise<{
        employees: {
            id: string;
            employeeId: string;
            firstName: string;
            lastName: string;
        }[];
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
    }>;
    static create(scope: OrgScopeContext, data: any): Promise<{
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
    }>;
    static update(scope: OrgScopeContext, id: string, data: any): Promise<{
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
    }>;
    static delete(scope: OrgScopeContext, id: string): Promise<{
        success: boolean;
    }>;
}
