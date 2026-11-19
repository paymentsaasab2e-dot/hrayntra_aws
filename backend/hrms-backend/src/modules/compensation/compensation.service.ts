import prisma from '../../shared/prisma';
import { calculateCompensation, SalaryComponentRule } from './salary-calculator';
import { DEFAULT_COMPLIANCE_PROFILES } from './default-profiles';

function normalizeLocation(value?: string | null) {
  return (value || '').trim().toLowerCase();
}

export class CompensationService {
  static async ensureDefaultProfiles(tenantId: string) {
    const existing = await prisma.payrollComplianceProfile.count({ where: { tenantId } });
    if (existing > 0) return;

    for (const seed of DEFAULT_COMPLIANCE_PROFILES) {
      await prisma.payrollComplianceProfile.create({
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

  static async listProfiles(tenantId: string, filters?: { country?: string }) {
    await this.ensureDefaultProfiles(tenantId);
    const where: any = { tenantId };
    if (filters?.country) where.country = filters.country;
    return prisma.payrollComplianceProfile.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { country: 'asc' }, { name: 'asc' }],
    });
  }

  static async getProfile(id: string, tenantId: string) {
    const profile = await prisma.payrollComplianceProfile.findFirst({
      where: { id, tenantId },
    });
    if (!profile) throw new Error('Compliance profile not found');
    return profile;
  }

  static async matchProfile(
    tenantId: string,
    input: { country?: string; region?: string; city?: string; locality?: string }
  ) {
    await this.ensureDefaultProfiles(tenantId);
    const profiles = await prisma.payrollComplianceProfile.findMany({ where: { tenantId } });
    if (!profiles.length) return null;

    const country = normalizeLocation(input.country);
    const region = normalizeLocation(input.region);
    const city = normalizeLocation(input.city);
    const locality = normalizeLocation(input.locality);

    const scored = profiles
      .map((p) => {
        let score = 0;
        if (country && normalizeLocation(p.country) === country) score += 10;
        if (region && normalizeLocation(p.region) === region) score += 5;
        if (city && normalizeLocation(p.city) === city) score += 3;
        if (locality && normalizeLocation(p.locality) === locality) score += 2;
        if (p.isDefault) score += 1;
        return { profile: p, score };
      })
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length) return scored[0].profile;
    return profiles.find((p) => p.isDefault) || profiles[0];
  }

  static async createProfile(tenantId: string, data: any) {
    if (data.isDefault) {
      await prisma.payrollComplianceProfile.updateMany({
        where: { tenantId, country: data.country },
        data: { isDefault: false },
      });
    }
    return prisma.payrollComplianceProfile.create({
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

  static async updateProfile(id: string, tenantId: string, data: any) {
    await this.getProfile(id, tenantId);
    if (data.isDefault) {
      const current = await prisma.payrollComplianceProfile.findUnique({ where: { id } });
      if (current) {
        await prisma.payrollComplianceProfile.updateMany({
          where: { tenantId, country: current.country, id: { not: id } },
          data: { isDefault: false },
        });
      }
    }
    return prisma.payrollComplianceProfile.update({
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

  static async deleteProfile(id: string, tenantId: string) {
    await this.getProfile(id, tenantId);
    const inUse = await prisma.employeeCompensation.count({ where: { complianceProfileId: id } });
    if (inUse > 0) throw new Error('Profile is assigned to employees and cannot be deleted');
    return prisma.payrollComplianceProfile.delete({ where: { id } });
  }

  static preview(input: {
    anchorType: any;
    anchorValue: number;
    currencyCode?: string;
    components: SalaryComponentRule[];
    componentOverrides?: Record<string, number>;
  }) {
    return calculateCompensation(input);
  }

  static async getEmployeeCompensation(employeeId: string, tenantId: string) {
    return prisma.employeeCompensation.findFirst({
      where: { employeeId, tenantId },
      include: { complianceProfile: true },
    });
  }

  static async getOnboardingCompensation(onboardingHireId: string, tenantId: string) {
    return prisma.employeeCompensation.findFirst({
      where: { onboardingHireId, tenantId },
      include: { complianceProfile: true },
    });
  }

  static async upsertCompensation(
    tenantId: string,
    input: {
      employeeId?: string;
      onboardingHireId?: string;
      complianceProfileId: string;
      anchorType: any;
      anchorValue: number;
      componentOverrides?: Record<string, number>;
      effectiveFrom?: string;
    }
  ) {
    const profile = await this.getProfile(input.complianceProfileId, tenantId);
    const components = (profile.components as SalaryComponentRule[]) || [];
    const snapshot = calculateCompensation({
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
      const existing = await prisma.employeeCompensation.findUnique({
        where: { employeeId: input.employeeId },
      });
      if (existing) {
        return prisma.employeeCompensation.update({
          where: { id: existing.id },
          data: payload,
          include: { complianceProfile: true },
        });
      }
      return prisma.employeeCompensation.create({
        data: { ...payload, employeeId: input.employeeId },
        include: { complianceProfile: true },
      });
    }

    if (input.onboardingHireId) {
      const existing = await prisma.employeeCompensation.findUnique({
        where: { onboardingHireId: input.onboardingHireId },
      });
      if (existing) {
        return prisma.employeeCompensation.update({
          where: { id: existing.id },
          data: payload,
          include: { complianceProfile: true },
        });
      }
      return prisma.employeeCompensation.create({
        data: { ...payload, onboardingHireId: input.onboardingHireId },
        include: { complianceProfile: true },
      });
    }

    throw new Error('employeeId or onboardingHireId is required');
  }

  static async linkCompensationToEmployee(onboardingHireId: string, employeeId: string, tenantId: string) {
    const comp = await prisma.employeeCompensation.findFirst({
      where: { onboardingHireId, tenantId },
    });
    if (!comp) return null;

    const existingEmployeeComp = await prisma.employeeCompensation.findUnique({
      where: { employeeId },
    });
    if (existingEmployeeComp && existingEmployeeComp.id !== comp.id) {
      await prisma.employeeCompensation.delete({ where: { id: existingEmployeeComp.id } });
    }

    return prisma.employeeCompensation.update({
      where: { id: comp.id },
      data: { employeeId, onboardingHireId: null },
      include: { complianceProfile: true },
    });
  }
}
