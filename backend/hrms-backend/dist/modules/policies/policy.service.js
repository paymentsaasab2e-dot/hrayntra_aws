"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PolicyService = void 0;
const fs_1 = __importDefault(require("fs"));
const prisma_1 = __importDefault(require("../../shared/prisma"));
const policy_rules_1 = require("./policy-rules");
async function extractPdfText(filePath) {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require('pdf-parse');
        const buffer = fs_1.default.readFileSync(filePath);
        const result = await pdfParse(buffer);
        return result.text?.slice(0, 50000) || null;
    }
    catch {
        return null;
    }
}
class PolicyService {
    static async getActiveRules(tenantId) {
        const active = await prisma_1.default.policyVersion.findFirst({
            where: { tenantId, isActive: true },
            orderBy: { publishedAt: 'desc' },
        });
        return (0, policy_rules_1.mergeRules)(active?.rules);
    }
    static async listDocuments(tenantId) {
        const docs = await prisma_1.default.policyDocument.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' },
            include: {
                versions: { orderBy: { version: 'desc' }, take: 3 },
            },
        });
        return docs;
    }
    static async getDocument(id, tenantId) {
        const doc = await prisma_1.default.policyDocument.findFirst({
            where: { id, tenantId },
            include: { versions: { orderBy: { version: 'desc' } } },
        });
        if (!doc)
            throw new Error('Policy document not found');
        return doc;
    }
    static async createFromUpload(tenantId, userId, data) {
        const title = String(data.title || 'Leave & Attendance Policy').trim();
        let fileName = null;
        let fileUrl = null;
        let mimeType = null;
        let fileSize = null;
        let extractedText = null;
        if (data.file) {
            fileName = data.file.originalname;
            mimeType = data.file.mimetype;
            fileSize = data.file.size;
            fileUrl = `/uploads/policies/${tenantId}/${data.file.filename}`;
            if (data.file.mimetype === 'application/pdf') {
                extractedText = await extractPdfText(data.file.path);
            }
        }
        return prisma_1.default.policyDocument.create({
            data: {
                tenantId,
                title,
                category: 'LEAVE_ATTENDANCE',
                fileName,
                fileUrl,
                mimeType,
                fileSize,
                extractedText,
                draftRules: policy_rules_1.DEFAULT_HR_RULES,
                status: 'DRAFT',
                uploadedByUserId: userId,
            },
        });
    }
    static async createManual(tenantId, userId, title) {
        return prisma_1.default.policyDocument.create({
            data: {
                tenantId,
                title: title.trim() || 'Leave & Attendance Policy',
                category: 'LEAVE_ATTENDANCE',
                draftRules: policy_rules_1.DEFAULT_HR_RULES,
                status: 'DRAFT',
                uploadedByUserId: userId,
            },
        });
    }
    static async updateDraftRules(id, tenantId, rules) {
        const doc = await this.getDocument(id, tenantId);
        const merged = (0, policy_rules_1.mergeRules)({ ...doc.draftRules, ...rules });
        return prisma_1.default.policyDocument.update({
            where: { id },
            data: { draftRules: merged },
        });
    }
    static async publish(id, tenantId, userId) {
        const doc = await this.getDocument(id, tenantId);
        const rules = (0, policy_rules_1.mergeRules)(doc.draftRules);
        const lastVersion = await prisma_1.default.policyVersion.findFirst({
            where: { policyDocumentId: id },
            orderBy: { version: 'desc' },
        });
        const nextVersion = (lastVersion?.version || 0) + 1;
        await prisma_1.default.policyVersion.updateMany({
            where: { tenantId, isActive: true },
            data: { isActive: false },
        });
        const version = await prisma_1.default.policyVersion.create({
            data: {
                policyDocumentId: id,
                tenantId,
                version: nextVersion,
                effectiveFrom: new Date(),
                publishedAt: new Date(),
                publishedByUserId: userId,
                rules: rules,
                isActive: true,
            },
        });
        await prisma_1.default.policyDocument.update({
            where: { id },
            data: { status: 'PUBLISHED' },
        });
        return { document: await this.getDocument(id, tenantId), version, rules };
    }
    static async getActive(tenantId) {
        const version = await prisma_1.default.policyVersion.findFirst({
            where: { tenantId, isActive: true },
            orderBy: { publishedAt: 'desc' },
            include: { policyDocument: true },
        });
        if (!version) {
            return { rules: policy_rules_1.DEFAULT_HR_RULES, version: null, totalAnnualLeaveDays: (0, policy_rules_1.totalAnnualLeaveDays)(policy_rules_1.DEFAULT_HR_RULES) };
        }
        const rules = (0, policy_rules_1.mergeRules)(version.rules);
        return {
            rules,
            version: {
                id: version.id,
                version: version.version,
                publishedAt: version.publishedAt,
                documentTitle: version.policyDocument.title,
            },
            totalAnnualLeaveDays: (0, policy_rules_1.totalAnnualLeaveDays)(rules),
        };
    }
    static async updateActiveRules(tenantId, userId, rules) {
        const active = await prisma_1.default.policyVersion.findFirst({
            where: { tenantId, isActive: true },
            include: { policyDocument: true },
        });
        const merged = (0, policy_rules_1.mergeRules)(active ? active.rules : policy_rules_1.DEFAULT_HR_RULES);
        const finalRules = (0, policy_rules_1.mergeRules)({ ...merged, ...rules });
        if (active) {
            await prisma_1.default.policyVersion.update({
                where: { id: active.id },
                data: { rules: finalRules },
            });
            if (active.policyDocumentId) {
                await prisma_1.default.policyDocument.update({
                    where: { id: active.policyDocumentId },
                    data: { draftRules: finalRules },
                });
            }
            return { rules: finalRules, versionId: active.id };
        }
        const doc = await prisma_1.default.policyDocument.create({
            data: {
                tenantId,
                title: 'Tenant HR Policy',
                category: 'LEAVE_ATTENDANCE',
                draftRules: finalRules,
                status: 'PUBLISHED',
                uploadedByUserId: userId,
            },
        });
        const version = await prisma_1.default.policyVersion.create({
            data: {
                policyDocumentId: doc.id,
                tenantId,
                version: 1,
                effectiveFrom: new Date(),
                publishedAt: new Date(),
                publishedByUserId: userId,
                rules: finalRules,
                isActive: true,
            },
        });
        return { rules: finalRules, versionId: version.id };
    }
    static async acknowledge(versionId, userId) {
        const existing = await prisma_1.default.policyAcknowledgment.findFirst({
            where: { policyVersionId: versionId, userId },
        });
        if (existing)
            return existing;
        return prisma_1.default.policyAcknowledgment.create({
            data: { policyVersionId: versionId, userId },
        });
    }
}
exports.PolicyService = PolicyService;
//# sourceMappingURL=policy.service.js.map