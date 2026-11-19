export interface GraduationOptions {
    createLogin?: boolean;
    password?: string;
    role?: string;
    sendWelcomeEmail?: boolean;
    locationId?: string;
    orgUnitId?: string;
    employeeCode?: string;
}
export declare class OnboardingService {
    static getAll(filters?: any, tenantId?: string | null): Promise<({
        compensation: ({
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
        }) | null;
    } & {
        id: string;
        name: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
        role: string;
        tenantId: string | null;
        employeeId: string | null;
        userId: string | null;
        phone: string | null;
        department: string;
        country: string | null;
        region: string | null;
        city: string | null;
        locality: string | null;
        source: import(".prisma/client").$Enums.OnboardingSource;
        progress: number;
        joinDate: string;
        tasks: {
            label: string;
            done: boolean;
        }[];
    })[]>;
    static getById(id: string, tenantId?: string | null): Promise<({
        compensation: ({
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
        }) | null;
    } & {
        id: string;
        name: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
        role: string;
        tenantId: string | null;
        employeeId: string | null;
        userId: string | null;
        phone: string | null;
        department: string;
        country: string | null;
        region: string | null;
        city: string | null;
        locality: string | null;
        source: import(".prisma/client").$Enums.OnboardingSource;
        progress: number;
        joinDate: string;
        tasks: {
            label: string;
            done: boolean;
        }[];
    }) | null>;
    static create(data: any, tenantId?: string | null): Promise<({
        compensation: ({
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
        }) | null;
    } & {
        id: string;
        name: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
        role: string;
        tenantId: string | null;
        employeeId: string | null;
        userId: string | null;
        phone: string | null;
        department: string;
        country: string | null;
        region: string | null;
        city: string | null;
        locality: string | null;
        source: import(".prisma/client").$Enums.OnboardingSource;
        progress: number;
        joinDate: string;
        tasks: {
            label: string;
            done: boolean;
        }[];
    }) | null>;
    static bulkCreate(candidates: any[], tenantId?: string | null, source?: string): Promise<(({
        compensation: ({
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
        }) | null;
    } & {
        id: string;
        name: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
        role: string;
        tenantId: string | null;
        employeeId: string | null;
        userId: string | null;
        phone: string | null;
        department: string;
        country: string | null;
        region: string | null;
        city: string | null;
        locality: string | null;
        source: import(".prisma/client").$Enums.OnboardingSource;
        progress: number;
        joinDate: string;
        tasks: {
            label: string;
            done: boolean;
        }[];
    }) | null)[]>;
    static update(id: string, data: any, tenantId?: string | null): Promise<({
        compensation: ({
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
        }) | null;
    } & {
        id: string;
        name: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
        role: string;
        tenantId: string | null;
        employeeId: string | null;
        userId: string | null;
        phone: string | null;
        department: string;
        country: string | null;
        region: string | null;
        city: string | null;
        locality: string | null;
        source: import(".prisma/client").$Enums.OnboardingSource;
        progress: number;
        joinDate: string;
        tasks: {
            label: string;
            done: boolean;
        }[];
    }) | null>;
    static updateTask(id: string, taskLabel: string, done: boolean, tenantId?: string | null): Promise<{
        compensation: ({
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
        }) | null;
    } & {
        id: string;
        name: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
        role: string;
        tenantId: string | null;
        employeeId: string | null;
        userId: string | null;
        phone: string | null;
        department: string;
        country: string | null;
        region: string | null;
        city: string | null;
        locality: string | null;
        source: import(".prisma/client").$Enums.OnboardingSource;
        progress: number;
        joinDate: string;
        tasks: {
            label: string;
            done: boolean;
        }[];
    }>;
    static complete(id: string, tenantId?: string | null, options?: GraduationOptions): Promise<{
        hire: {
            compensation: ({
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
            }) | null;
        } & {
            id: string;
            name: string;
            status: string;
            createdAt: Date;
            updatedAt: Date;
            email: string | null;
            role: string;
            tenantId: string | null;
            employeeId: string | null;
            userId: string | null;
            phone: string | null;
            department: string;
            country: string | null;
            region: string | null;
            city: string | null;
            locality: string | null;
            source: import(".prisma/client").$Enums.OnboardingSource;
            progress: number;
            joinDate: string;
            tasks: {
                label: string;
                done: boolean;
            }[];
        };
        employee: {
            id: any;
            employeeId: any;
            firstName: any;
            lastName: any;
            name: string;
            email: any;
            department: any;
            designation: any;
            joiningDate: any;
            status: any;
        } | null;
        user: {
            id: any;
            email: any;
            role: any;
            displayName: any;
            status: any;
        } | null;
        credentials: {
            email: any;
            password: string | null;
            role: any;
            isNewUser: boolean;
            emailSent: boolean;
            message: string;
        };
    }>;
    static delete(id: string, tenantId?: string | null): Promise<{
        id: string;
        name: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
        role: string;
        tenantId: string | null;
        employeeId: string | null;
        userId: string | null;
        phone: string | null;
        department: string;
        country: string | null;
        region: string | null;
        city: string | null;
        locality: string | null;
        source: import(".prisma/client").$Enums.OnboardingSource;
        progress: number;
        joinDate: string;
        tasks: {
            label: string;
            done: boolean;
        }[];
    }>;
}
