import prisma from '../../../shared/prisma';
import { OrgScopeContext, employeeWhereFromScope } from '../../../shared/org/org-scope.service';
import { requireTenantId } from '../../../shared/tenant/tenant-scope';
import {
  FamilyRelationship,
  NomineeBenefitScheme,
  DependentGender,
} from '@prisma/client';

export interface StatutorySchemeSummary {
  scheme: NomineeBenefitScheme;
  schemeLabel: string;
  totalAllocated: number;
  status: 'COMPLIANT' | 'UNDER_ALLOCATED' | 'OVER_ALLOCATED';
  nomineeCount: number;
  minorCount: number;
  remainingPercentage: number;
}

export const SCHEME_LABELS: Record<NomineeBenefitScheme, string> = {
  GRATUITY: 'Gratuity (Form F - Payment of Gratuity Act, 1972)',
  PF_EPF: 'Provident Fund (EPFO Form 2 Part A)',
  PF_EPS: 'Family Pension (EPFO Form 2 Part B)',
  INSURANCE_GTLI: 'Group Term Life Insurance (GTLI)',
  INSURANCE_GPA: 'Group Personal Accident (GPA)',
  GENERAL: 'General Company Benefits',
};

function calculateAge(dob: Date): number {
  const diffMs = Date.now() - dob.getTime();
  const ageDate = new Date(diffMs);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
}

export class BeneficiaryService {
  /**
   * Helper: verify employee belongs to scoped tenant and user has access
   */
  private static async verifyEmployee(scope: OrgScopeContext, employeeId: string) {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(employeeId);
    const employee = await prisma.employee.findFirst({
      where: {
        ...(isObjectId ? { id: employeeId } : { employeeId }),
        ...employeeWhereFromScope(scope),
      },
      include: {
        orgUnit: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
      },
    });
    if (!employee) {
      throw new Error('Employee not found or unauthorized');
    }
    return employee;
  }

  // ════════════════════════════════════════════════════════════════
  // 1. FULL CONSOLIDATED SNAPSHOT & STATUTORY AUDIT SUMMARY
  // ════════════════════════════════════════════════════════════════

  static async getBeneficiarySnapshot(scope: OrgScopeContext, employeeId: string) {
    const employee = await this.verifyEmployee(scope, employeeId);
    const tenantId = requireTenantId(scope);

    const [emergencyContacts, dependents, nominees] = await Promise.all([
      prisma.employeeEmergencyContact.findMany({
        where: { employeeId: employee.id, tenantId },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      }),
      prisma.employeeDependent.findMany({
        where: { employeeId: employee.id, tenantId },
        orderBy: [{ relationship: 'asc' }, { dateOfBirth: 'asc' }],
      }),
      prisma.employeeNominee.findMany({
        where: { employeeId: employee.id, tenantId },
        orderBy: [{ scheme: 'asc' }, { sharePercentage: 'desc' }],
      }),
    ]);

    // Calculate Statutory Health per Scheme
    const statutorySchemes: NomineeBenefitScheme[] = [
      'GRATUITY',
      'PF_EPF',
      'PF_EPS',
      'INSURANCE_GTLI',
    ];

    const schemeSummaries: StatutorySchemeSummary[] = statutorySchemes.map((scheme) => {
      const schemeNominees = nominees.filter((n) => n.scheme === scheme);
      const totalAllocated = schemeNominees.reduce((acc, n) => acc + (n.sharePercentage || 0), 0);
      const roundedTotal = Math.round(totalAllocated * 100) / 100;
      const minorCount = schemeNominees.filter((n) => n.isMinor).length;

      let status: 'COMPLIANT' | 'UNDER_ALLOCATED' | 'OVER_ALLOCATED' = 'UNDER_ALLOCATED';
      if (Math.abs(roundedTotal - 100) < 0.01) {
        status = 'COMPLIANT';
      } else if (roundedTotal > 100) {
        status = 'OVER_ALLOCATED';
      }

      return {
        scheme,
        schemeLabel: SCHEME_LABELS[scheme],
        totalAllocated: roundedTotal,
        status,
        nomineeCount: schemeNominees.length,
        minorCount,
        remainingPercentage: Math.max(0, 100 - roundedTotal),
      };
    });

    return {
      employee: {
        id: employee.id,
        employeeId: employee.employeeId,
        name: `${employee.firstName} ${employee.lastName}`,
        email: employee.email,
        phone: employee.phone,
        designation: employee.designation,
        department: employee.department,
        joiningDate: employee.joiningDate,
      },
      emergencyContacts,
      dependents,
      nominees,
      statutorySummary: schemeSummaries,
    };
  }

  // ════════════════════════════════════════════════════════════════
  // 2. EMERGENCY CONTACTS
  // ════════════════════════════════════════════════════════════════

  static async listEmergencyContacts(scope: OrgScopeContext, employeeId: string) {
    const employee = await this.verifyEmployee(scope, employeeId);
    return prisma.employeeEmergencyContact.findMany({
      where: { employeeId: employee.id, tenantId: requireTenantId(scope) },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }

  static async addEmergencyContact(
    scope: OrgScopeContext,
    employeeId: string,
    data: {
      name: string;
      relationship: FamilyRelationship;
      primaryPhone: string;
      secondaryPhone?: string;
      email?: string;
      address?: string;
      isPrimary?: boolean;
    }
  ) {
    const employee = await this.verifyEmployee(scope, employeeId);
    const tenantId = requireTenantId(scope);

    if (!data.name || !data.primaryPhone) {
      throw new Error('Contact name and primary phone number are mandatory');
    }

    // If marked as primary, unmark any existing primary for this employee
    if (data.isPrimary) {
      await prisma.employeeEmergencyContact.updateMany({
        where: { employeeId: employee.id, tenantId },
        data: { isPrimary: false },
      });
    } else {
      // If this is the very first emergency contact, automatically make it primary
      const existingCount = await prisma.employeeEmergencyContact.count({
        where: { employeeId: employee.id, tenantId },
      });
      if (existingCount === 0) {
        data.isPrimary = true;
      }
    }

    return prisma.employeeEmergencyContact.create({
      data: {
        tenantId,
        employeeId: employee.id,
        name: data.name.trim(),
        relationship: data.relationship || 'OTHER',
        primaryPhone: data.primaryPhone.trim(),
        secondaryPhone: data.secondaryPhone?.trim() || null,
        email: data.email?.trim() || null,
        address: data.address?.trim() || null,
        isPrimary: Boolean(data.isPrimary),
      },
    });
  }

  static async updateEmergencyContact(
    scope: OrgScopeContext,
    employeeId: string,
    contactId: string,
    data: {
      name?: string;
      relationship?: FamilyRelationship;
      primaryPhone?: string;
      secondaryPhone?: string;
      email?: string;
      address?: string;
      isPrimary?: boolean;
    }
  ) {
    const employee = await this.verifyEmployee(scope, employeeId);
    const tenantId = requireTenantId(scope);

    const existing = await prisma.employeeEmergencyContact.findFirst({
      where: { id: contactId, employeeId: employee.id, tenantId },
    });
    if (!existing) {
      throw new Error('Emergency contact not found');
    }

    if (data.isPrimary) {
      await prisma.employeeEmergencyContact.updateMany({
        where: { employeeId: employee.id, tenantId, id: { not: contactId } },
        data: { isPrimary: false },
      });
    }

    return prisma.employeeEmergencyContact.update({
      where: { id: contactId },
      data: {
        name: data.name !== undefined ? data.name.trim() : undefined,
        relationship: data.relationship,
        primaryPhone: data.primaryPhone !== undefined ? data.primaryPhone.trim() : undefined,
        secondaryPhone: data.secondaryPhone !== undefined ? data.secondaryPhone?.trim() || null : undefined,
        email: data.email !== undefined ? data.email?.trim() || null : undefined,
        address: data.address !== undefined ? data.address?.trim() || null : undefined,
        isPrimary: data.isPrimary !== undefined ? Boolean(data.isPrimary) : undefined,
      },
    });
  }

  static async deleteEmergencyContact(scope: OrgScopeContext, employeeId: string, contactId: string) {
    const employee = await this.verifyEmployee(scope, employeeId);
    const tenantId = requireTenantId(scope);

    const existing = await prisma.employeeEmergencyContact.findFirst({
      where: { id: contactId, employeeId: employee.id, tenantId },
    });
    if (!existing) {
      throw new Error('Emergency contact not found');
    }

    await prisma.employeeEmergencyContact.delete({ where: { id: contactId } });

    // If deleted contact was primary, promote the next available contact to primary
    if (existing.isPrimary) {
      const nextContact = await prisma.employeeEmergencyContact.findFirst({
        where: { employeeId: employee.id, tenantId },
        orderBy: { createdAt: 'asc' },
      });
      if (nextContact) {
        await prisma.employeeEmergencyContact.update({
          where: { id: nextContact.id },
          data: { isPrimary: true },
        });
      }
    }

    return { success: true };
  }

  // ════════════════════════════════════════════════════════════════
  // 3. DEPENDENTS (INSURANCE & GMC COVERAGE)
  // ════════════════════════════════════════════════════════════════

  static async listDependents(scope: OrgScopeContext, employeeId: string) {
    const employee = await this.verifyEmployee(scope, employeeId);
    return prisma.employeeDependent.findMany({
      where: { employeeId: employee.id, tenantId: requireTenantId(scope) },
      orderBy: [{ relationship: 'asc' }, { dateOfBirth: 'asc' }],
    });
  }

  static async addDependent(
    scope: OrgScopeContext,
    employeeId: string,
    data: {
      fullName: string;
      relationship: FamilyRelationship;
      gender?: DependentGender;
      dateOfBirth: string | Date;
      isCoveredUnderGmc?: boolean;
      nationalIdNumber?: string;
      preExistingDisease?: string;
      isDisabled?: boolean;
    }
  ) {
    const employee = await this.verifyEmployee(scope, employeeId);
    const tenantId = requireTenantId(scope);

    if (!data.fullName || !data.dateOfBirth) {
      throw new Error('Dependent full name and date of birth are required');
    }

    const dob = new Date(data.dateOfBirth);
    if (isNaN(dob.getTime())) {
      throw new Error('Invalid date of birth provided');
    }

    return prisma.employeeDependent.create({
      data: {
        tenantId,
        employeeId: employee.id,
        fullName: data.fullName.trim(),
        relationship: data.relationship,
        gender: data.gender || 'OTHER',
        dateOfBirth: dob,
        isCoveredUnderGmc: data.isCoveredUnderGmc !== undefined ? Boolean(data.isCoveredUnderGmc) : true,
        nationalIdNumber: data.nationalIdNumber?.trim() || null,
        preExistingDisease: data.preExistingDisease?.trim() || null,
        isDisabled: Boolean(data.isDisabled),
      },
    });
  }

  static async updateDependent(
    scope: OrgScopeContext,
    employeeId: string,
    dependentId: string,
    data: {
      fullName?: string;
      relationship?: FamilyRelationship;
      gender?: DependentGender;
      dateOfBirth?: string | Date;
      isCoveredUnderGmc?: boolean;
      nationalIdNumber?: string;
      preExistingDisease?: string;
      isDisabled?: boolean;
    }
  ) {
    const employee = await this.verifyEmployee(scope, employeeId);
    const tenantId = requireTenantId(scope);

    const existing = await prisma.employeeDependent.findFirst({
      where: { id: dependentId, employeeId: employee.id, tenantId },
    });
    if (!existing) {
      throw new Error('Dependent record not found');
    }

    let dob: Date | undefined;
    if (data.dateOfBirth) {
      dob = new Date(data.dateOfBirth);
      if (isNaN(dob.getTime())) {
        throw new Error('Invalid date of birth provided');
      }
    }

    return prisma.employeeDependent.update({
      where: { id: dependentId },
      data: {
        fullName: data.fullName !== undefined ? data.fullName.trim() : undefined,
        relationship: data.relationship,
        gender: data.gender,
        dateOfBirth: dob,
        isCoveredUnderGmc: data.isCoveredUnderGmc !== undefined ? Boolean(data.isCoveredUnderGmc) : undefined,
        nationalIdNumber: data.nationalIdNumber !== undefined ? data.nationalIdNumber?.trim() || null : undefined,
        preExistingDisease: data.preExistingDisease !== undefined ? data.preExistingDisease?.trim() || null : undefined,
        isDisabled: data.isDisabled !== undefined ? Boolean(data.isDisabled) : undefined,
      },
    });
  }

  static async deleteDependent(scope: OrgScopeContext, employeeId: string, dependentId: string) {
    const employee = await this.verifyEmployee(scope, employeeId);
    const tenantId = requireTenantId(scope);

    const existing = await prisma.employeeDependent.findFirst({
      where: { id: dependentId, employeeId: employee.id, tenantId },
    });
    if (!existing) {
      throw new Error('Dependent record not found');
    }

    await prisma.employeeDependent.delete({ where: { id: dependentId } });
    return { success: true };
  }

  // ════════════════════════════════════════════════════════════════
  // 4. STATUTORY NOMINEES (PF, GRATUITY & INSURANCE)
  // ════════════════════════════════════════════════════════════════

  static async listNominees(scope: OrgScopeContext, employeeId: string, scheme?: NomineeBenefitScheme) {
    const employee = await this.verifyEmployee(scope, employeeId);
    const tenantId = requireTenantId(scope);

    return prisma.employeeNominee.findMany({
      where: {
        employeeId: employee.id,
        tenantId,
        ...(scheme ? { scheme } : {}),
      },
      orderBy: [{ scheme: 'asc' }, { sharePercentage: 'desc' }],
    });
  }

  static async addNominee(
    scope: OrgScopeContext,
    employeeId: string,
    data: {
      name: string;
      relationship: FamilyRelationship;
      dateOfBirth: string | Date;
      scheme: NomineeBenefitScheme;
      sharePercentage: number;
      address?: string;
      nationalIdNumber?: string;
      guardianName?: string;
      guardianRelation?: string;
      guardianAge?: number;
      guardianAddress?: string;
    }
  ) {
    const employee = await this.verifyEmployee(scope, employeeId);
    const tenantId = requireTenantId(scope);

    if (!data.name || !data.dateOfBirth || data.sharePercentage === undefined) {
      throw new Error('Nominee name, date of birth, and share percentage are required');
    }

    const share = Number(data.sharePercentage);
    if (isNaN(share) || share <= 0 || share > 100) {
      throw new Error('Share percentage must be between 1% and 100%');
    }

    const dob = new Date(data.dateOfBirth);
    if (isNaN(dob.getTime())) {
      throw new Error('Invalid date of birth provided');
    }

    // Determine minor status (Indian statutory law: Age < 18 is a minor)
    const age = calculateAge(dob);
    const isMinor = age < 18;

    if (isMinor && (!data.guardianName || !data.guardianRelation)) {
      throw new Error(
        `Nominee is a minor (${age} years old). Under Indian statutory law (EPFO / Gratuity Act), an adult Guardian name and relationship are strictly mandatory.`
      );
    }

    // Verify scheme allocation does not exceed 100%
    const existingNominees = await prisma.employeeNominee.findMany({
      where: { employeeId: employee.id, tenantId, scheme: data.scheme },
    });
    const currentTotal = existingNominees.reduce((acc, n) => acc + n.sharePercentage, 0);
    if (currentTotal + share > 100.01) {
      throw new Error(
        `Total allocation for ${SCHEME_LABELS[data.scheme]} cannot exceed 100%. Current allocated: ${currentTotal}%, attempted to add: ${share}%.`
      );
    }

    return prisma.employeeNominee.create({
      data: {
        tenantId,
        employeeId: employee.id,
        name: data.name.trim(),
        relationship: data.relationship,
        dateOfBirth: dob,
        scheme: data.scheme,
        sharePercentage: share,
        address: data.address?.trim() || null,
        nationalIdNumber: data.nationalIdNumber?.trim() || null,
        isMinor,
        guardianName: isMinor ? data.guardianName?.trim() || null : null,
        guardianRelation: isMinor ? data.guardianRelation?.trim() || null : null,
        guardianAge: isMinor && data.guardianAge ? Number(data.guardianAge) : null,
        guardianAddress: isMinor ? data.guardianAddress?.trim() || null : null,
      },
    });
  }

  static async updateNominee(
    scope: OrgScopeContext,
    employeeId: string,
    nomineeId: string,
    data: {
      name?: string;
      relationship?: FamilyRelationship;
      dateOfBirth?: string | Date;
      scheme?: NomineeBenefitScheme;
      sharePercentage?: number;
      address?: string;
      nationalIdNumber?: string;
      guardianName?: string;
      guardianRelation?: string;
      guardianAge?: number;
      guardianAddress?: string;
    }
  ) {
    const employee = await this.verifyEmployee(scope, employeeId);
    const tenantId = requireTenantId(scope);

    const existing = await prisma.employeeNominee.findFirst({
      where: { id: nomineeId, employeeId: employee.id, tenantId },
    });
    if (!existing) {
      throw new Error('Nominee record not found');
    }

    const targetScheme = data.scheme || existing.scheme;
    const targetShare = data.sharePercentage !== undefined ? Number(data.sharePercentage) : existing.sharePercentage;

    if (isNaN(targetShare) || targetShare <= 0 || targetShare > 100) {
      throw new Error('Share percentage must be between 1% and 100%');
    }

    const dob = data.dateOfBirth ? new Date(data.dateOfBirth) : existing.dateOfBirth;
    if (isNaN(dob.getTime())) {
      throw new Error('Invalid date of birth provided');
    }

    const age = calculateAge(dob);
    const isMinor = age < 18;

    const guardianName = data.guardianName !== undefined ? data.guardianName : existing.guardianName;
    const guardianRelation = data.guardianRelation !== undefined ? data.guardianRelation : existing.guardianRelation;

    if (isMinor && (!guardianName || !guardianRelation)) {
      throw new Error(
        `Nominee is a minor (${age} years old). Under Indian statutory law (EPFO / Gratuity Act), an adult Guardian name and relationship are strictly mandatory.`
      );
    }

    // Verify scheme allocation sum
    const otherNominees = await prisma.employeeNominee.findMany({
      where: {
        employeeId: employee.id,
        tenantId,
        scheme: targetScheme,
        id: { not: nomineeId },
      },
    });
    const currentOthersTotal = otherNominees.reduce((acc, n) => acc + n.sharePercentage, 0);
    if (currentOthersTotal + targetShare > 100.01) {
      throw new Error(
        `Total allocation for ${SCHEME_LABELS[targetScheme]} cannot exceed 100%. Other nominees have: ${currentOthersTotal}%, attempted update: ${targetShare}%.`
      );
    }

    return prisma.employeeNominee.update({
      where: { id: nomineeId },
      data: {
        name: data.name !== undefined ? data.name.trim() : undefined,
        relationship: data.relationship,
        dateOfBirth: dob,
        scheme: targetScheme,
        sharePercentage: targetShare,
        address: data.address !== undefined ? data.address?.trim() || null : undefined,
        nationalIdNumber: data.nationalIdNumber !== undefined ? data.nationalIdNumber?.trim() || null : undefined,
        isMinor,
        guardianName: isMinor ? guardianName?.trim() || null : null,
        guardianRelation: isMinor ? guardianRelation?.trim() || null : null,
        guardianAge: isMinor && data.guardianAge ? Number(data.guardianAge) : undefined,
        guardianAddress: isMinor ? data.guardianAddress?.trim() || null : undefined,
      },
    });
  }

  static async deleteNominee(scope: OrgScopeContext, employeeId: string, nomineeId: string) {
    const employee = await this.verifyEmployee(scope, employeeId);
    const tenantId = requireTenantId(scope);

    const existing = await prisma.employeeNominee.findFirst({
      where: { id: nomineeId, employeeId: employee.id, tenantId },
    });
    if (!existing) {
      throw new Error('Nominee record not found');
    }

    await prisma.employeeNominee.delete({ where: { id: nomineeId } });
    return { success: true };
  }
}
