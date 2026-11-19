import { TenantHrRules } from './policy-rules';
export declare class PolicyService {
    static getActiveRules(tenantId: string): Promise<TenantHrRules>;
    static listDocuments(tenantId: string): Promise<({
        versions: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            isActive: boolean;
            policyDocumentId: string;
            version: number;
            effectiveFrom: Date;
            publishedAt: Date | null;
            publishedByUserId: string | null;
            rules: import("@prisma/client/runtime/library").JsonValue;
        }[];
    } & {
        id: string;
        status: import(".prisma/client").$Enums.PolicyDocumentStatus;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        category: import(".prisma/client").$Enums.PolicyCategory;
        title: string;
        fileName: string | null;
        fileUrl: string | null;
        mimeType: string | null;
        fileSize: number | null;
        extractedText: string | null;
        draftRules: import("@prisma/client/runtime/library").JsonValue | null;
        uploadedByUserId: string | null;
    })[]>;
    static getDocument(id: string, tenantId: string): Promise<{
        versions: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            isActive: boolean;
            policyDocumentId: string;
            version: number;
            effectiveFrom: Date;
            publishedAt: Date | null;
            publishedByUserId: string | null;
            rules: import("@prisma/client/runtime/library").JsonValue;
        }[];
    } & {
        id: string;
        status: import(".prisma/client").$Enums.PolicyDocumentStatus;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        category: import(".prisma/client").$Enums.PolicyCategory;
        title: string;
        fileName: string | null;
        fileUrl: string | null;
        mimeType: string | null;
        fileSize: number | null;
        extractedText: string | null;
        draftRules: import("@prisma/client/runtime/library").JsonValue | null;
        uploadedByUserId: string | null;
    }>;
    static createFromUpload(tenantId: string, userId: string, data: {
        title: string;
        file?: Express.Multer.File;
    }): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.PolicyDocumentStatus;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        category: import(".prisma/client").$Enums.PolicyCategory;
        title: string;
        fileName: string | null;
        fileUrl: string | null;
        mimeType: string | null;
        fileSize: number | null;
        extractedText: string | null;
        draftRules: import("@prisma/client/runtime/library").JsonValue | null;
        uploadedByUserId: string | null;
    }>;
    static createManual(tenantId: string, userId: string, title: string): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.PolicyDocumentStatus;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        category: import(".prisma/client").$Enums.PolicyCategory;
        title: string;
        fileName: string | null;
        fileUrl: string | null;
        mimeType: string | null;
        fileSize: number | null;
        extractedText: string | null;
        draftRules: import("@prisma/client/runtime/library").JsonValue | null;
        uploadedByUserId: string | null;
    }>;
    static updateDraftRules(id: string, tenantId: string, rules: Partial<TenantHrRules>): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.PolicyDocumentStatus;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        category: import(".prisma/client").$Enums.PolicyCategory;
        title: string;
        fileName: string | null;
        fileUrl: string | null;
        mimeType: string | null;
        fileSize: number | null;
        extractedText: string | null;
        draftRules: import("@prisma/client/runtime/library").JsonValue | null;
        uploadedByUserId: string | null;
    }>;
    static publish(id: string, tenantId: string, userId: string): Promise<{
        document: {
            versions: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                tenantId: string;
                isActive: boolean;
                policyDocumentId: string;
                version: number;
                effectiveFrom: Date;
                publishedAt: Date | null;
                publishedByUserId: string | null;
                rules: import("@prisma/client/runtime/library").JsonValue;
            }[];
        } & {
            id: string;
            status: import(".prisma/client").$Enums.PolicyDocumentStatus;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            category: import(".prisma/client").$Enums.PolicyCategory;
            title: string;
            fileName: string | null;
            fileUrl: string | null;
            mimeType: string | null;
            fileSize: number | null;
            extractedText: string | null;
            draftRules: import("@prisma/client/runtime/library").JsonValue | null;
            uploadedByUserId: string | null;
        };
        version: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            isActive: boolean;
            policyDocumentId: string;
            version: number;
            effectiveFrom: Date;
            publishedAt: Date | null;
            publishedByUserId: string | null;
            rules: import("@prisma/client/runtime/library").JsonValue;
        };
        rules: TenantHrRules;
    }>;
    static getActive(tenantId: string): Promise<{
        rules: TenantHrRules;
        version: null;
        totalAnnualLeaveDays: number;
    } | {
        rules: TenantHrRules;
        version: {
            id: string;
            version: number;
            publishedAt: Date | null;
            documentTitle: string;
        };
        totalAnnualLeaveDays: number;
    }>;
    static updateActiveRules(tenantId: string, userId: string, rules: Partial<TenantHrRules>): Promise<{
        rules: TenantHrRules;
        versionId: string;
    }>;
    static acknowledge(versionId: string, userId: string): Promise<{
        id: string;
        userId: string;
        policyVersionId: string;
        acknowledgedAt: Date;
    }>;
}
