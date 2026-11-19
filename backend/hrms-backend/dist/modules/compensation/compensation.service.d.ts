import { SalaryComponentRule } from './salary-calculator';
export declare class CompensationService {
    static ensureDefaultProfiles(tenantId: string): Promise<void>;
    static listProfiles(tenantId: string, filters?: {
        country?: string;
    }): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        country: string;
        region: string | null;
        city: string | null;
        locality: string | null;
        currencyCode: string;
        anchorType: import(".prisma/client").$Enums.SalaryAnchorType;
        documentUrl: string | null;
        isDefault: boolean;
        components: {
            code: string;
            name: string;
            section: import(".prisma/client").$Enums.SalaryComponentSection;
            calcType: import(".prisma/client").$Enums.SalaryCalcType;
            value: number;
            baseRef: string | null;
            cap: number | null;
            order: number;
        }[];
    }[]>;
    static getProfile(id: string, tenantId: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        country: string;
        region: string | null;
        city: string | null;
        locality: string | null;
        currencyCode: string;
        anchorType: import(".prisma/client").$Enums.SalaryAnchorType;
        documentUrl: string | null;
        isDefault: boolean;
        components: {
            code: string;
            name: string;
            section: import(".prisma/client").$Enums.SalaryComponentSection;
            calcType: import(".prisma/client").$Enums.SalaryCalcType;
            value: number;
            baseRef: string | null;
            cap: number | null;
            order: number;
        }[];
    }>;
    static matchProfile(tenantId: string, input: {
        country?: string;
        region?: string;
        city?: string;
        locality?: string;
    }): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        country: string;
        region: string | null;
        city: string | null;
        locality: string | null;
        currencyCode: string;
        anchorType: import(".prisma/client").$Enums.SalaryAnchorType;
        documentUrl: string | null;
        isDefault: boolean;
        components: {
            code: string;
            name: string;
            section: import(".prisma/client").$Enums.SalaryComponentSection;
            calcType: import(".prisma/client").$Enums.SalaryCalcType;
            value: number;
            baseRef: string | null;
            cap: number | null;
            order: number;
        }[];
    } | null>;
    static createProfile(tenantId: string, data: any): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        country: string;
        region: string | null;
        city: string | null;
        locality: string | null;
        currencyCode: string;
        anchorType: import(".prisma/client").$Enums.SalaryAnchorType;
        documentUrl: string | null;
        isDefault: boolean;
        components: {
            code: string;
            name: string;
            section: import(".prisma/client").$Enums.SalaryComponentSection;
            calcType: import(".prisma/client").$Enums.SalaryCalcType;
            value: number;
            baseRef: string | null;
            cap: number | null;
            order: number;
        }[];
    }>;
    static updateProfile(id: string, tenantId: string, data: any): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        country: string;
        region: string | null;
        city: string | null;
        locality: string | null;
        currencyCode: string;
        anchorType: import(".prisma/client").$Enums.SalaryAnchorType;
        documentUrl: string | null;
        isDefault: boolean;
        components: {
            code: string;
            name: string;
            section: import(".prisma/client").$Enums.SalaryComponentSection;
            calcType: import(".prisma/client").$Enums.SalaryCalcType;
            value: number;
            baseRef: string | null;
            cap: number | null;
            order: number;
        }[];
    }>;
    static deleteProfile(id: string, tenantId: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        country: string;
        region: string | null;
        city: string | null;
        locality: string | null;
        currencyCode: string;
        anchorType: import(".prisma/client").$Enums.SalaryAnchorType;
        documentUrl: string | null;
        isDefault: boolean;
        components: {
            code: string;
            name: string;
            section: import(".prisma/client").$Enums.SalaryComponentSection;
            calcType: import(".prisma/client").$Enums.SalaryCalcType;
            value: number;
            baseRef: string | null;
            cap: number | null;
            order: number;
        }[];
    }>;
    static preview(input: {
        anchorType: any;
        anchorValue: number;
        currencyCode?: string;
        components: SalaryComponentRule[];
        componentOverrides?: Record<string, number>;
    }): import("./salary-calculator").CompensationSnapshot;
    static getEmployeeCompensation(employeeId: string, tenantId: string): Promise<({
        complianceProfile: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            country: string;
            region: string | null;
            city: string | null;
            locality: string | null;
            currencyCode: string;
            anchorType: import(".prisma/client").$Enums.SalaryAnchorType;
            documentUrl: string | null;
            isDefault: boolean;
            components: {
                code: string;
                name: string;
                section: import(".prisma/client").$Enums.SalaryComponentSection;
                calcType: import(".prisma/client").$Enums.SalaryCalcType;
                value: number;
                baseRef: string | null;
                cap: number | null;
                order: number;
            }[];
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        employeeId: string | null;
        effectiveFrom: Date;
        currencyCode: string;
        anchorType: import(".prisma/client").$Enums.SalaryAnchorType;
        complianceProfileId: string;
        onboardingHireId: string | null;
        anchorValue: number;
        componentOverrides: import("@prisma/client/runtime/library").JsonValue | null;
        computedSnapshot: import("@prisma/client/runtime/library").JsonValue;
    }) | null>;
    static getOnboardingCompensation(onboardingHireId: string, tenantId: string): Promise<({
        complianceProfile: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            country: string;
            region: string | null;
            city: string | null;
            locality: string | null;
            currencyCode: string;
            anchorType: import(".prisma/client").$Enums.SalaryAnchorType;
            documentUrl: string | null;
            isDefault: boolean;
            components: {
                code: string;
                name: string;
                section: import(".prisma/client").$Enums.SalaryComponentSection;
                calcType: import(".prisma/client").$Enums.SalaryCalcType;
                value: number;
                baseRef: string | null;
                cap: number | null;
                order: number;
            }[];
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        employeeId: string | null;
        effectiveFrom: Date;
        currencyCode: string;
        anchorType: import(".prisma/client").$Enums.SalaryAnchorType;
        complianceProfileId: string;
        onboardingHireId: string | null;
        anchorValue: number;
        componentOverrides: import("@prisma/client/runtime/library").JsonValue | null;
        computedSnapshot: import("@prisma/client/runtime/library").JsonValue;
    }) | null>;
    static upsertCompensation(tenantId: string, input: {
        employeeId?: string;
        onboardingHireId?: string;
        complianceProfileId: string;
        anchorType: any;
        anchorValue: number;
        componentOverrides?: Record<string, number>;
        effectiveFrom?: string;
    }): Promise<{
        complianceProfile: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            country: string;
            region: string | null;
            city: string | null;
            locality: string | null;
            currencyCode: string;
            anchorType: import(".prisma/client").$Enums.SalaryAnchorType;
            documentUrl: string | null;
            isDefault: boolean;
            components: {
                code: string;
                name: string;
                section: import(".prisma/client").$Enums.SalaryComponentSection;
                calcType: import(".prisma/client").$Enums.SalaryCalcType;
                value: number;
                baseRef: string | null;
                cap: number | null;
                order: number;
            }[];
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        employeeId: string | null;
        effectiveFrom: Date;
        currencyCode: string;
        anchorType: import(".prisma/client").$Enums.SalaryAnchorType;
        complianceProfileId: string;
        onboardingHireId: string | null;
        anchorValue: number;
        componentOverrides: import("@prisma/client/runtime/library").JsonValue | null;
        computedSnapshot: import("@prisma/client/runtime/library").JsonValue;
    }>;
    static linkCompensationToEmployee(onboardingHireId: string, employeeId: string, tenantId: string): Promise<({
        complianceProfile: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            country: string;
            region: string | null;
            city: string | null;
            locality: string | null;
            currencyCode: string;
            anchorType: import(".prisma/client").$Enums.SalaryAnchorType;
            documentUrl: string | null;
            isDefault: boolean;
            components: {
                code: string;
                name: string;
                section: import(".prisma/client").$Enums.SalaryComponentSection;
                calcType: import(".prisma/client").$Enums.SalaryCalcType;
                value: number;
                baseRef: string | null;
                cap: number | null;
                order: number;
            }[];
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        employeeId: string | null;
        effectiveFrom: Date;
        currencyCode: string;
        anchorType: import(".prisma/client").$Enums.SalaryAnchorType;
        complianceProfileId: string;
        onboardingHireId: string | null;
        anchorValue: number;
        componentOverrides: import("@prisma/client/runtime/library").JsonValue | null;
        computedSnapshot: import("@prisma/client/runtime/library").JsonValue;
    }) | null>;
}
