import prisma from '../../shared/prisma';
import { OrgScopeContext } from '../../shared/org/org-scope.service';
import { requireTenantId, tenantWhereFromScope } from '../../shared/tenant/tenant-scope';
import { HrTemplateType } from '@prisma/client';

export class TemplateService {
  static async getAll(scope: OrgScopeContext, type?: HrTemplateType) {
    const tenantId = requireTenantId(scope);
    return prisma.hrTemplate.findMany({
      where: {
        tenantId,
        ...(type ? { type } : {}),
      },
      orderBy: [{ type: 'asc' }, { isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  static async getById(scope: OrgScopeContext, id: string) {
    const tenantId = requireTenantId(scope);
    return prisma.hrTemplate.findFirst({
      where: { id, tenantId },
    });
  }

  static async create(scope: OrgScopeContext, data: {
    type: HrTemplateType;
    name: string;
    code: string;
    description?: string;
    isDefault?: boolean;
    config: any;
  }) {
    const tenantId = requireTenantId(scope);

    // If marked default, unset default on other templates of same type
    if (data.isDefault) {
      await prisma.hrTemplate.updateMany({
        where: { tenantId, type: data.type },
        data: { isDefault: false },
      });
    }

    return prisma.hrTemplate.create({
      data: {
        tenantId,
        type: data.type,
        name: data.name,
        code: data.code.toUpperCase().trim(),
        description: data.description,
        isDefault: !!data.isDefault,
        config: data.config,
      },
    });
  }

  static async update(scope: OrgScopeContext, id: string, data: {
    name?: string;
    code?: string;
    description?: string;
    isDefault?: boolean;
    isActive?: boolean;
    config?: any;
  }) {
    const tenantId = requireTenantId(scope);
    const existing = await prisma.hrTemplate.findFirst({ where: { id, tenantId } });
    if (!existing) throw new Error('Template not found');

    if (data.isDefault) {
      await prisma.hrTemplate.updateMany({
        where: { tenantId, type: existing.type, id: { not: id } },
        data: { isDefault: false },
      });
    }

    return prisma.hrTemplate.update({
      where: { id },
      data: {
        name: data.name,
        code: data.code ? data.code.toUpperCase().trim() : undefined,
        description: data.description,
        isDefault: data.isDefault,
        isActive: data.isActive,
        config: data.config,
      },
    });
  }

  static async delete(scope: OrgScopeContext, id: string) {
    const tenantId = requireTenantId(scope);
    const existing = await prisma.hrTemplate.findFirst({ where: { id, tenantId } });
    if (!existing) throw new Error('Template not found');

    await prisma.hrTemplate.delete({ where: { id } });
    return { success: true, message: 'Template deleted' };
  }

  static async duplicate(scope: OrgScopeContext, id: string, newName?: string, newCode?: string) {
    const tenantId = requireTenantId(scope);
    const source = await prisma.hrTemplate.findFirst({ where: { id, tenantId } });
    if (!source) throw new Error('Source template not found');

    const code = (newCode || `${source.code}_COPY_${Date.now().toString(36).slice(-4)}`).toUpperCase();
    const name = newName || `${source.name} (Copy)`;

    return prisma.hrTemplate.create({
      data: {
        tenantId,
        type: source.type,
        name,
        code,
        description: source.description ? `Copy of ${source.name}: ${source.description}` : `Copy of ${source.name}`,
        isDefault: false,
        isActive: true,
        config: source.config as any,
      },
    });
  }

  /**
   * Applies template to target employees or master data
   */
  static async applyTemplate(scope: OrgScopeContext, id: string, target: {
    employeeIds?: string[];
    designation?: string;
    department?: string;
  }) {
    const tenantId = requireTenantId(scope);
    const template = await prisma.hrTemplate.findFirst({ where: { id, tenantId } });
    if (!template) throw new Error('Template not found');

    const config = template.config as any;

    if (template.type === 'SALARY') {
      // Find eligible employees
      const where: any = { tenantId, status: { not: 'TERMINATED' } };
      if (target.employeeIds?.length) where.id = { in: target.employeeIds };
      if (target.designation) where.designation = target.designation;
      if (target.department) where.department = target.department;

      const emps = await prisma.employee.findMany({ where, select: { id: true, firstName: true, lastName: true } });

      let complianceProfile = await prisma.payrollComplianceProfile.findFirst({ where: { tenantId } });
      if (!complianceProfile) {
        complianceProfile = await prisma.payrollComplianceProfile.create({
          data: {
            tenantId,
            name: 'Standard Indian Compliance Profile',
            country: 'India',
            currencyCode: 'INR',
            anchorType: 'ANNUAL_CTC',
            components: [],
            isDefault: true,
          },
        });
      }

      for (const emp of emps) {
        await prisma.employeeCompensation.upsert({
          where: { employeeId: emp.id },
          update: {
            anchorType: config.anchorType || 'ANNUAL_CTC',
            anchorValue: Number(config.anchorValue) || 600000,
            currencyCode: config.currencyCode || 'INR',
            computedSnapshot: config.components || config,
            effectiveFrom: new Date(),
          },
          create: {
            tenantId,
            employeeId: emp.id,
            complianceProfileId: complianceProfile.id,
            anchorType: config.anchorType || 'ANNUAL_CTC',
            anchorValue: Number(config.anchorValue) || 600000,
            currencyCode: config.currencyCode || 'INR',
            computedSnapshot: config.components || config,
            effectiveFrom: new Date(),
          },
        });
      }

      return {
        success: true,
        message: `Salary template "${template.name}" applied to ${emps.length} employee(s)`,
        affectedCount: emps.length,
      };
    }

    if (template.type === 'HOLIDAY_CALENDAR') {
      const holidays = Array.isArray(config.holidays) ? config.holidays : [];
      let imported = 0;
      for (const h of holidays) {
        if (!h.name || !h.date) continue;
        const d = new Date(h.date);
        await prisma.holiday.upsert({
          where: { tenantId_date: { tenantId, date: d } },
          update: { name: h.name, type: h.type || 'Public Holiday', description: h.description },
          create: {
            tenantId,
            name: h.name,
            date: d,
            type: h.type || 'Public Holiday',
            description: h.description,
            isActive: true,
          },
        });
        imported++;
      }
      return {
        success: true,
        message: `Imported ${imported} holiday(s) from template "${template.name}"`,
        importedCount: imported,
      };
    }

    if (template.type === 'LEAVE_PLAN') {
      // Sync into LeaveAccrualPlan
      const plan = await prisma.leaveAccrualPlan.upsert({
        where: { tenantId_code: { tenantId, code: template.code } },
        update: {
          name: template.name,
          frequency: config.frequency || 'MONTHLY',
          annualCasual: Number(config.annualCasual ?? 6),
          annualSick: Number(config.annualSick ?? 6),
          annualEarned: Number(config.annualEarned ?? 6),
          carryForwardLimit: Number(config.carryForwardLimit ?? 15),
          lapseUnusedCasual: config.lapseUnusedCasual !== undefined ? config.lapseUnusedCasual : true,
          lapseUnusedSick: config.lapseUnusedSick !== undefined ? config.lapseUnusedSick : true,
          enableEncashment: config.enableEncashment !== undefined ? config.enableEncashment : true,
          maxEncashmentDays: Number(config.maxEncashmentDays ?? 10),
          minBalanceRetention: Number(config.minBalanceRetention ?? 15),
          isDefault: !!template.isDefault,
          targetLocationIds: config.targetLocationIds || [],
          targetGrades: config.targetGrades || [],
          targetDepartments: config.targetDepartments || [],
        },
        create: {
          tenantId,
          code: template.code,
          name: template.name,
          frequency: config.frequency || 'MONTHLY',
          annualCasual: Number(config.annualCasual ?? 6),
          annualSick: Number(config.annualSick ?? 6),
          annualEarned: Number(config.annualEarned ?? 6),
          carryForwardLimit: Number(config.carryForwardLimit ?? 15),
          lapseUnusedCasual: config.lapseUnusedCasual !== undefined ? config.lapseUnusedCasual : true,
          lapseUnusedSick: config.lapseUnusedSick !== undefined ? config.lapseUnusedSick : true,
          enableEncashment: config.enableEncashment !== undefined ? config.enableEncashment : true,
          maxEncashmentDays: Number(config.maxEncashmentDays ?? 10),
          minBalanceRetention: Number(config.minBalanceRetention ?? 15),
          isDefault: !!template.isDefault,
          targetLocationIds: config.targetLocationIds || [],
          targetGrades: config.targetGrades || [],
          targetDepartments: config.targetDepartments || [],
        },
      });

      return {
        success: true,
        message: `Leave plan template "${template.name}" activated as active accrual policy`,
        planId: plan.id,
      };
    }

    return { success: true, message: `Template "${template.name}" configured` };
  }

  /**
   * Seeds standard ready-to-use Indian corporate templates for a tenant
   */
  static async seedStandardTemplates(scope: OrgScopeContext) {
    const tenantId = requireTenantId(scope);
    const count = await prisma.hrTemplate.count({ where: { tenantId } });
    if (count > 0) return { seeded: false, message: 'Templates already exist' };

    const standards = [
      // 1. Salary Template: Software Engineer (CTC ₹8,00,000)
      {
        type: HrTemplateType.SALARY,
        name: 'Standard Software Engineer (8 LPA CTC)',
        code: 'SAL-SWE-8L',
        description: 'Standard Indian CTC breakdown for Mid-Level Software Engineers (PF 12%, HRA 50%, Medical, Conveyance)',
        isDefault: true,
        config: {
          anchorType: 'ANNUAL_CTC',
          anchorValue: 800000,
          currencyCode: 'INR',
          components: {
            basicAnnual: 320000, // 40% of CTC
            hraAnnual: 160000,   // 50% of Basic
            conveyanceAnnual: 19200,
            medicalAllowanceAnnual: 15000,
            specialAllowanceAnnual: 209000,
            employerPfAnnual: 38400, // 12% of Basic
            employerGratuityAnnual: 15392,
            statutoryBonusAnnual: 23008,
          },
          epfEnabled: true,
          esiEnabled: false,
          ptEnabled: true,
        },
      },
      // 2. Salary Template: Sales Executive (CTC ₹4,50,000)
      {
        type: HrTemplateType.SALARY,
        name: 'Sales Executive (4.5 LPA CTC)',
        code: 'SAL-SALES-4.5L',
        description: 'Standard Sales Executive CTC with ESI coverage and Travel / Conveyance allowance',
        isDefault: false,
        config: {
          anchorType: 'ANNUAL_CTC',
          anchorValue: 450000,
          currencyCode: 'INR',
          components: {
            basicAnnual: 180000,
            hraAnnual: 90000,
            conveyanceAnnual: 24000,
            specialAllowanceAnnual: 112000,
            employerPfAnnual: 21600,
            employerEsiAnnual: 14625,
            employerGratuityAnnual: 8655,
          },
          epfEnabled: true,
          esiEnabled: true,
          ptEnabled: true,
        },
      },
      // 3. Leave Plan: Standard Corporate 18-Day Plan
      {
        type: HrTemplateType.LEAVE_PLAN,
        name: 'Standard Corporate 18-Day Leave Policy',
        code: 'LV-CORP-18D',
        description: 'Monthly accrued 18 annual leaves (6 Casual, 6 Sick, 6 Earned) with 15 days carry-over',
        isDefault: true,
        config: {
          frequency: 'MONTHLY',
          annualCasual: 6.0,
          annualSick: 6.0,
          annualEarned: 6.0,
          carryForwardLimit: 15.0,
          lapseUnusedCasual: true,
          lapseUnusedSick: true,
          enableEncashment: true,
          maxEncashmentDays: 10.0,
          minBalanceRetention: 15.0,
          enableProRata: true,
          proRataRounding: 'HALF_DAY',
        },
      },
      // 4. Leave Plan: Factory / Plant 15-Day Plan
      {
        type: HrTemplateType.LEAVE_PLAN,
        name: 'Plant & Operations 15-Day Leave Policy',
        code: 'LV-PLANT-15D',
        description: 'Factories Act aligned leave policy for manufacturing/plant operations staff (12 Earned, 3 Casual)',
        isDefault: false,
        config: {
          frequency: 'MONTHLY',
          annualCasual: 3.0,
          annualSick: 0.0,
          annualEarned: 12.0,
          carryForwardLimit: 30.0,
          lapseUnusedCasual: true,
          lapseUnusedSick: false,
          enableEncashment: true,
          maxEncashmentDays: 15.0,
          minBalanceRetention: 12.0,
          enableProRata: true,
          proRataRounding: 'HALF_DAY',
          targetDepartments: ['Operations', 'Plant', 'Manufacturing'],
        },
      },
      // 5. Shift Template: General Day Shift
      {
        type: HrTemplateType.SHIFT,
        name: 'General Day Shift (09:00 - 18:00)',
        code: 'SH-GEN-DAY',
        description: 'Standard 9-hour corporate working shift with 15 minutes grace time and 4.5 hours half-day mark',
        isDefault: true,
        config: {
          startTime: '09:00',
          endTime: '18:00',
          graceMinutes: 15,
          halfDayThresholdHours: 4.5,
          fullDayThresholdHours: 8.0,
          lateMarkAfterMinutes: 30,
          breakMinutes: 60,
          isNightShift: false,
        },
      },
      // 6. Shift Template: Night Shift
      {
        type: HrTemplateType.SHIFT,
        name: 'Night Operations Shift (22:00 - 06:00)',
        code: 'SH-NIGHT-OPS',
        description: 'Overnight shift crossing midnight with night differential allowance',
        isDefault: false,
        config: {
          startTime: '22:00',
          endTime: '06:00',
          graceMinutes: 20,
          halfDayThresholdHours: 4.0,
          fullDayThresholdHours: 7.5,
          lateMarkAfterMinutes: 30,
          breakMinutes: 45,
          isNightShift: true,
        },
      },
      // 7. Checklist Template: Employee Onboarding
      {
        type: HrTemplateType.CHECKLIST,
        name: 'Standard New Joiner Onboarding Checklist',
        code: 'CHK-ONBOARD-STD',
        description: 'Complete 360-degree onboarding blueprint covering IT provisioning, HR verification, and Buddy assignment',
        isDefault: true,
        config: {
          category: 'ONBOARDING',
          items: [
            { title: 'Collect KYC Documents (Aadhaar, PAN, Degree)', department: 'HR', relativeDueDays: -3, isMandatory: true },
            { title: 'Provision Laptop & IT Peripherals', department: 'IT', relativeDueDays: -1, isMandatory: true },
            { title: 'Create Company Google Workspace & Slack Account', department: 'IT', relativeDueDays: 0, isMandatory: true },
            { title: 'Assign Workplace Buddy & Orientation Schedule', department: 'HR', relativeDueDays: 1, isMandatory: false },
            { title: 'Enroll into Group Medical Cover (GMC) & PF Portal', department: 'HR', relativeDueDays: 7, isMandatory: true },
            { title: '30-Day Manager Check-in & Initial Milestone Review', department: 'Manager', relativeDueDays: 30, isMandatory: true },
          ],
        },
      },
      // 8. Checklist Template: Employee Exit Clearance
      {
        type: HrTemplateType.CHECKLIST,
        name: 'Standard Employee Exit Clearance Checklist',
        code: 'CHK-EXIT-STD',
        description: 'Full-and-final settlement clearance checklist across IT, Finance, Admin, and Reporting Manager',
        isDefault: true,
        config: {
          category: 'OFFBOARDING',
          items: [
            { title: 'Collect Company Laptop, Access Card, and Hardware', department: 'IT', relativeDueDays: -1, isMandatory: true },
            { title: 'Revoke Email, VPN, and Corporate Software Access', department: 'IT', relativeDueDays: 0, isMandatory: true },
            { title: 'Conduct Formal Exit Interview & Knowledge Transfer Handover', department: 'HR', relativeDueDays: -2, isMandatory: true },
            { title: 'Verify No-Dues & Travel Advance Clearances', department: 'Finance', relativeDueDays: 1, isMandatory: true },
            { title: 'Process Full & Final (FnF) Settlement & Issue Experience Letter', department: 'HR', relativeDueDays: 7, isMandatory: true },
          ],
        },
      },
      // 9. Holiday Calendar Template: Gazetted Holidays 2026
      {
        type: HrTemplateType.HOLIDAY_CALENDAR,
        name: 'Indian National & Gazetted Holidays 2026',
        code: 'HOL-IND-2026',
        description: 'Standard Central Government Gazetted Holidays calendar for calendar year 2026',
        isDefault: true,
        config: {
          year: 2026,
          region: 'National',
          holidays: [
            { name: 'Republic Day', date: '2026-01-26', type: 'Gazetted Holiday' },
            { name: 'Maha Shivratri', date: '2026-02-17', type: 'Public Holiday' },
            { name: 'Holi', date: '2026-03-04', type: 'Gazetted Holiday' },
            { name: 'Id-ul-Fitr (Eid)', date: '2026-03-21', type: 'Gazetted Holiday' },
            { name: 'Mahavir Jayanti', date: '2026-04-01', type: 'Gazetted Holiday' },
            { name: 'Good Friday', date: '2026-04-03', type: 'Gazetted Holiday' },
            { name: 'Buddha Purnima', date: '2026-05-02', type: 'Gazetted Holiday' },
            { name: 'Independence Day', date: '2026-08-15', type: 'Gazetted Holiday' },
            { name: 'Milad-un-Nabi', date: '2026-08-26', type: 'Gazetted Holiday' },
            { name: 'Mahatma Gandhi Jayanti', date: '2026-10-02', type: 'Gazetted Holiday' },
            { name: 'Dussehra (Vijay Dashami)', date: '2026-10-20', type: 'Gazetted Holiday' },
            { name: 'Diwali (Deepavali)', date: '2026-11-08', type: 'Gazetted Holiday' },
            { name: 'Guru Nanak Jayanti', date: '2026-11-24', type: 'Gazetted Holiday' },
            { name: 'Christmas Day', date: '2026-12-25', type: 'Gazetted Holiday' },
          ],
        },
      },
    ];

    for (const item of standards) {
      await prisma.hrTemplate.create({
        data: {
          tenantId,
          type: item.type,
          name: item.name,
          code: item.code,
          description: item.description,
          isDefault: item.isDefault,
          config: item.config,
        },
      });
    }

    return { seeded: true, count: standards.length };
  }
}
