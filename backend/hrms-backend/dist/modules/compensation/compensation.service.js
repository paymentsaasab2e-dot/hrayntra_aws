"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompensationService = void 0;
const prisma_1 = __importDefault(require("../../shared/prisma"));
const salary_calculator_1 = require("./salary-calculator");
const default_profiles_1 = require("./default-profiles");
function normalizeLocation(value) {
    return (value || '').trim().toLowerCase();
}
class CompensationService {
    static async ensureDefaultProfiles(tenantId) {
        const existing = await prisma_1.default.payrollComplianceProfile.count({ where: { tenantId } });
        if (existing > 0)
            return;
        for (const seed of default_profiles_1.DEFAULT_COMPLIANCE_PROFILES) {
            await prisma_1.default.payrollComplianceProfile.create({
                data: {
                    tenantId,
                    name: seed.name,
                    country: seed.country,
                    region: seed.region || null,
                    city: seed.city || null,
                    locality: seed.locality || null,
                    currencyCode: seed.currencyCode,
                    anchorType: seed.anchorType,
                    components: seed.components,
                    isDefault: Boolean(seed.isDefault),
                },
            });
        }
    }
    static async listProfiles(tenantId, filters) {
        await this.ensureDefaultProfiles(tenantId);
        const where = { tenantId };
        if (filters?.country)
            where.country = filters.country;
        return prisma_1.default.payrollComplianceProfile.findMany({
            where,
            orderBy: [{ isDefault: 'desc' }, { country: 'asc' }, { name: 'asc' }],
        });
    }
    static async getProfile(id, tenantId) {
        const profile = await prisma_1.default.payrollComplianceProfile.findFirst({
            where: { id, tenantId },
        });
        if (!profile)
            throw new Error('Compliance profile not found');
        return profile;
    }
    static async matchProfile(tenantId, input) {
        await this.ensureDefaultProfiles(tenantId);
        const profiles = await prisma_1.default.payrollComplianceProfile.findMany({ where: { tenantId } });
        if (!profiles.length)
            return null;
        const country = normalizeLocation(input.country);
        const region = normalizeLocation(input.region);
        const city = normalizeLocation(input.city);
        const locality = normalizeLocation(input.locality);
        const scored = profiles
            .map((p) => {
            let score = 0;
            if (country && normalizeLocation(p.country) === country)
                score += 10;
            if (region && normalizeLocation(p.region) === region)
                score += 5;
            if (city && normalizeLocation(p.city) === city)
                score += 3;
            if (locality && normalizeLocation(p.locality) === locality)
                score += 2;
            if (p.isDefault)
                score += 1;
            return { profile: p, score };
        })
            .filter((row) => row.score > 0)
            .sort((a, b) => b.score - a.score);
        if (scored.length)
            return scored[0].profile;
        return profiles.find((p) => p.isDefault) || profiles[0];
    }
    static async createProfile(tenantId, data) {
        if (data.isDefault) {
            await prisma_1.default.payrollComplianceProfile.updateMany({
                where: { tenantId, country: data.country },
                data: { isDefault: false },
            });
        }
        return prisma_1.default.payrollComplianceProfile.create({
            data: {
                tenantId,
                name: data.name,
                country: data.country,
                region: data.region || null,
                city: data.city || null,
                locality: data.locality || null,
                currencyCode: data.currencyCode || 'INR',
                anchorType: data.anchorType || 'ANNUAL_CTC',
                components: data.components || [],
                documentUrl: data.documentUrl || null,
                isDefault: Boolean(data.isDefault),
            },
        });
    }
    static async updateProfile(id, tenantId, data) {
        await this.getProfile(id, tenantId);
        if (data.isDefault) {
            const current = await prisma_1.default.payrollComplianceProfile.findUnique({ where: { id } });
            if (current) {
                await prisma_1.default.payrollComplianceProfile.updateMany({
                    where: { tenantId, country: current.country, id: { not: id } },
                    data: { isDefault: false },
                });
            }
        }
        return prisma_1.default.payrollComplianceProfile.update({
            where: { id },
            data: {
                name: data.name,
                country: data.country,
                region: data.region,
                city: data.city,
                locality: data.locality,
                currencyCode: data.currencyCode,
                anchorType: data.anchorType,
                components: data.components,
                documentUrl: data.documentUrl,
                isDefault: data.isDefault,
            },
        });
    }
    static async deleteProfile(id, tenantId) {
        await this.getProfile(id, tenantId);
        const inUse = await prisma_1.default.employeeCompensation.count({ where: { complianceProfileId: id } });
        if (inUse > 0)
            throw new Error('Profile is assigned to employees and cannot be deleted');
        return prisma_1.default.payrollComplianceProfile.delete({ where: { id } });
    }
    static preview(input) {
        return (0, salary_calculator_1.calculateCompensation)(input);
    }
    static async getEmployeeCompensation(employeeId, tenantId) {
        return prisma_1.default.employeeCompensation.findFirst({
            where: { employeeId, tenantId },
            include: { complianceProfile: true },
        });
    }
    static async getOnboardingCompensation(onboardingHireId, tenantId) {
        return prisma_1.default.employeeCompensation.findFirst({
            where: { onboardingHireId, tenantId },
            include: { complianceProfile: true },
        });
    }
    static async upsertCompensation(tenantId, input) {
        const profile = await this.getProfile(input.complianceProfileId, tenantId);
        const components = profile.components || [];
        const snapshot = (0, salary_calculator_1.calculateCompensation)({
            anchorType: input.anchorType || profile.anchorType,
            anchorValue: input.anchorValue,
            currencyCode: profile.currencyCode,
            components,
            componentOverrides: input.componentOverrides,
        });
        const payload = {
            tenantId,
            complianceProfileId: profile.id,
            anchorType: input.anchorType || profile.anchorType,
            anchorValue: input.anchorValue,
            currencyCode: profile.currencyCode,
            componentOverrides: input.componentOverrides || null,
            computedSnapshot: JSON.parse(JSON.stringify(snapshot)),
            effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : new Date(),
        };
        if (input.employeeId) {
            const existing = await prisma_1.default.employeeCompensation.findUnique({
                where: { employeeId: input.employeeId },
            });
            if (existing) {
                return prisma_1.default.employeeCompensation.update({
                    where: { id: existing.id },
                    data: payload,
                    include: { complianceProfile: true },
                });
            }
            return prisma_1.default.employeeCompensation.create({
                data: { ...payload, employeeId: input.employeeId },
                include: { complianceProfile: true },
            });
        }
        if (input.onboardingHireId) {
            const existing = await prisma_1.default.employeeCompensation.findUnique({
                where: { onboardingHireId: input.onboardingHireId },
            });
            if (existing) {
                return prisma_1.default.employeeCompensation.update({
                    where: { id: existing.id },
                    data: payload,
                    include: { complianceProfile: true },
                });
            }
            return prisma_1.default.employeeCompensation.create({
                data: { ...payload, onboardingHireId: input.onboardingHireId },
                include: { complianceProfile: true },
            });
        }
        throw new Error('employeeId or onboardingHireId is required');
    }
    static async linkCompensationToEmployee(onboardingHireId, employeeId, tenantId) {
        const comp = await prisma_1.default.employeeCompensation.findFirst({
            where: { onboardingHireId, tenantId },
        });
        if (!comp)
            return null;
        const existingEmployeeComp = await prisma_1.default.employeeCompensation.findUnique({
            where: { employeeId },
        });
        if (existingEmployeeComp && existingEmployeeComp.id !== comp.id) {
            await prisma_1.default.employeeCompensation.delete({ where: { id: existingEmployeeComp.id } });
        }
        return prisma_1.default.employeeCompensation.update({
            where: { id: comp.id },
            data: { employeeId, onboardingHireId: null },
            include: { complianceProfile: true },
        });
    }
}
exports.CompensationService = CompensationService;
//# sourceMappingURL=compensation.service.js.map