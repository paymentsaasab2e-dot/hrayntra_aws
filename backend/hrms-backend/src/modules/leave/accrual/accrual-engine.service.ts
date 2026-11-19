import prisma from '../../../shared/prisma';
import { OrgScopeContext } from '../../../shared/org/org-scope.service';
import { requireTenantId } from '../../../shared/tenant/tenant-scope';
import { AccrualFrequency, AccrualTransactionType, LeaveType } from '@prisma/client';

export interface AccrualRunItem {
  employeeId: string;
  employeeCode: string;
  name: string;
  designation: string;
  department: string;
  locationName?: string | null;
  planName: string;
  planCode: string;
  frequency: AccrualFrequency;
  joiningDate: string;
  isProratedJoiner: boolean;
  prorataNote?: string;
  casualCredit: number;
  sickCredit: number;
  earnedCredit: number;
  totalCredit: number;
  openingBalance: number;
  projectedClosingBalance: number;
  alreadyAccruedForPeriod: boolean;
}

export interface YearEndRunItem {
  employeeId: string;
  employeeCode: string;
  name: string;
  designation: string;
  department: string;
  planName: string;
  carryForwardLimit: number;
  currentBalance: number;
  carriedForward: number;
  lapsedAmount: number;
  newOpeningBalance: number;
  encashmentEligibleDays: number;
}

function roundToHalf(val: number): number {
  return Math.round(val * 2) / 2;
}

export class AccrualEngineService {
  /**
   * Resolves the matching LeaveAccrualPlan for an employee based on
   * Group criteria (Location, Grade/Designation, Department) with fallback to default.
   */
  static async resolvePlanForEmployee(tenantId: string, employee: {
    locationId?: string | null;
    designation: string;
    department: string;
  }) {
    const plans = await prisma.leaveAccrualPlan.findMany({
      where: { tenantId, isActive: true },
    });

    if (plans.length === 0) {
      // Auto-create standard corporate default plan if none exists
      return prisma.leaveAccrualPlan.create({
        data: {
          tenantId,
          code: 'LV-DEF-STD',
          name: 'Standard Company Leave Plan',
          frequency: AccrualFrequency.MONTHLY,
          annualCasual: 6.0,
          annualSick: 6.0,
          annualEarned: 6.0,
          carryForwardLimit: 15.0,
          lapseUnusedCasual: true,
          lapseUnusedSick: true,
          enableEncashment: true,
          maxEncashmentDays: 10.0,
          minBalanceRetention: 15.0,
          isDefault: true,
          enableProRata: true,
          proRataRounding: 'HALF_DAY',
        },
      });
    }

    // Score group matching:
    // Location match: +4
    // Grade / Designation match: +2
    // Department match: +1
    let bestPlan = plans.find((p) => p.isDefault) || plans[0];
    let highestScore = 0;

    for (const plan of plans) {
      let score = 0;
      if (employee.locationId && plan.targetLocationIds?.includes(employee.locationId)) {
        score += 4;
      }
      if (employee.designation && plan.targetGrades?.some((g) => g.toLowerCase() === employee.designation.toLowerCase())) {
        score += 2;
      }
      if (employee.department && plan.targetDepartments?.some((d) => d.toLowerCase() === employee.department.toLowerCase())) {
        score += 1;
      }

      if (score > highestScore) {
        highestScore = score;
        bestPlan = plan;
      }
    }

    return bestPlan;
  }

  /**
   * Calculates pro-rata leave entitlement for new joiners joining mid-cycle
   */
  static calculateProRata(
    joiningDate: Date,
    asOfDate: Date,
    plan: {
      frequency: AccrualFrequency;
      annualCasual: number;
      annualSick: number;
      annualEarned: number;
      enableProRata: boolean;
    }
  ) {
    if (!plan.enableProRata) {
      return {
        isProratedJoiner: false,
        casual: plan.frequency === 'MONTHLY' ? roundToHalf(plan.annualCasual / 12) : plan.annualCasual,
        sick: plan.frequency === 'MONTHLY' ? roundToHalf(plan.annualSick / 12) : plan.annualSick,
        earned: plan.frequency === 'MONTHLY' ? roundToHalf(plan.annualEarned / 12) : plan.annualEarned,
        note: 'Full standard period quota credited',
      };
    }

    const jYear = joiningDate.getFullYear();
    const jMonth = joiningDate.getMonth();
    const jDay = joiningDate.getDate();

    const currYear = asOfDate.getFullYear();
    const currMonth = asOfDate.getMonth();

    if (plan.frequency === 'MONTHLY') {
      const isJoinedThisMonth = jYear === currYear && jMonth === currMonth;

      if (!isJoinedThisMonth) {
        // Standard full month rate
        const mCasual = roundToHalf(plan.annualCasual / 12);
        const mSick = roundToHalf(plan.annualSick / 12);
        const mEarned = roundToHalf(plan.annualEarned / 12);
        return {
          isProratedJoiner: false,
          casual: mCasual,
          sick: mSick,
          earned: mEarned,
          note: 'Regular monthly scheduled accrual',
        };
      }

      // Pro-rata for joiner mid-month
      const daysInMonth = new Date(currYear, currMonth + 1, 0).getDate();
      const workedDays = Math.max(1, daysInMonth - jDay + 1);
      const ratio = workedDays / daysInMonth;

      const pCasual = roundToHalf((plan.annualCasual / 12) * ratio);
      const pSick = roundToHalf((plan.annualSick / 12) * ratio);
      const pEarned = roundToHalf((plan.annualEarned / 12) * ratio);

      return {
        isProratedJoiner: true,
        casual: pCasual,
        sick: pSick,
        earned: pEarned,
        note: `Joined ${jDay}/${currMonth + 1}: prorated ${workedDays}/${daysInMonth} days (${Math.round(ratio * 100)}%)`,
      };
    }

    // Yearly frequency
    const isJoinedThisYear = jYear === currYear;
    if (!isJoinedThisYear) {
      return {
        isProratedJoiner: false,
        casual: plan.annualCasual,
        sick: plan.annualSick,
        earned: plan.annualEarned,
        note: 'Full annual quota credited',
      };
    }

    // Pro-rata for joiner mid-year: remaining months / 12
    const remainingMonths = 12 - jMonth;
    const ratio = Math.max(0.1, remainingMonths / 12);

    const yCasual = roundToHalf(plan.annualCasual * ratio);
    const ySick = roundToHalf(plan.annualSick * ratio);
    const yEarned = roundToHalf(plan.annualEarned * ratio);

    return {
      isProratedJoiner: true,
      casual: yCasual,
      sick: ySick,
      earned: yEarned,
      note: `Joined month ${jMonth + 1}: prorated for ${remainingMonths}/12 months`,
    };
  }

  /**
   * Executes or previews the Accrual Engine run for the tenant.
   * Can be triggered on-demand via HR action or by scheduled daemon.
   */
  static async runAccrualEngine(scope: OrgScopeContext, options: {
    asOfDate?: Date;
    employeeId?: string;
    commit?: boolean;
    force?: boolean;
    planId?: string;
    department?: string;
  }) {
    const tenantId = requireTenantId(scope);
    const asOfDate = options.asOfDate ? new Date(options.asOfDate) : new Date();
    const commit = !!options.commit;
    const force = !!options.force;

    const where: any = {
      tenantId,
      status: { not: 'TERMINATED' },
    };
    if (options.employeeId) {
      if (/^[0-9a-fA-F]{24}$/.test(options.employeeId)) {
        where.id = options.employeeId;
      } else {
        where.employeeId = options.employeeId;
      }
    }
    if (options.department && options.department !== 'ALL') {
      where.department = options.department;
    }

    let explicitPlan: any = null;
    if (options.planId && options.planId !== 'AUTO') {
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(options.planId);
      explicitPlan = await prisma.leaveAccrualPlan.findFirst({
        where: {
          tenantId,
          ...(isObjectId ? { id: options.planId } : { code: options.planId }),
        },
      });
    }

    const employees = await prisma.employee.findMany({
      where,
      include: {
        location: { select: { id: true, name: true } },
      },
      orderBy: { employeeId: 'asc' },
    });

    const startOfCurrentPeriod = new Date(asOfDate.getFullYear(), asOfDate.getMonth(), 1);
    const endOfCurrentPeriod = new Date(asOfDate.getFullYear(), asOfDate.getMonth() + 1, 0, 23, 59, 59);
    const batchId = `accrual_${asOfDate.getFullYear()}_${asOfDate.getMonth() + 1}_${Date.now().toString(36)}`;

    const items: AccrualRunItem[] = [];
    let totalEmployeesEvaluated = employees.length;
    let totalCreditsApplied = 0;
    let totalProratedJoiners = 0;

    for (const emp of employees) {
      const plan = explicitPlan || await this.resolvePlanForEmployee(tenantId, {
        locationId: emp.locationId,
        designation: emp.designation,
        department: emp.department,
      });

      // Check if already accrued for this period
      const existingPeriodAccrual = await prisma.leaveAccrualLedger.findFirst({
        where: {
          employeeId: emp.id,
          transactionType: { in: [AccrualTransactionType.SCHEDULED_ACCRUAL, AccrualTransactionType.PRORATA_JOINER_CREDIT] },
          effectiveDate: { gte: startOfCurrentPeriod, lte: endOfCurrentPeriod },
        },
      });

      const alreadyAccrued = !!existingPeriodAccrual && !force;

      // Current opening balance
      const currentBalance = emp.totalLeaves || 0;

      const calc = this.calculateProRata(
        emp.joiningDate ? new Date(emp.joiningDate) : asOfDate,
        asOfDate,
        plan
      );

      const totalLeaveCredit = calc.casual + calc.sick + calc.earned;
      const projectedClosingBalance = currentBalance + (alreadyAccrued ? 0 : totalLeaveCredit);

      if (calc.isProratedJoiner) {
        totalProratedJoiners++;
      }
      if (!alreadyAccrued) {
        totalCreditsApplied += totalLeaveCredit;
      }

      items.push({
        employeeId: emp.id,
        employeeCode: emp.employeeId,
        name: `${emp.firstName} ${emp.lastName}`.trim(),
        designation: emp.designation,
        department: emp.department,
        locationName: emp.location?.name || null,
        planName: plan.name,
        planCode: plan.code,
        frequency: plan.frequency,
        joiningDate: emp.joiningDate ? emp.joiningDate.toISOString().split('T')[0] : asOfDate.toISOString().split('T')[0],
        isProratedJoiner: calc.isProratedJoiner,
        prorataNote: calc.note,
        casualCredit: calc.casual,
        sickCredit: calc.sick,
        earnedCredit: calc.earned,
        totalCredit: totalLeaveCredit,
        openingBalance: currentBalance,
        projectedClosingBalance,
        alreadyAccruedForPeriod: alreadyAccrued,
      });

      // If commit mode and not already accrued, write to DB
      if (commit && !alreadyAccrued) {
        const transType = calc.isProratedJoiner
          ? AccrualTransactionType.PRORATA_JOINER_CREDIT
          : AccrualTransactionType.SCHEDULED_ACCRUAL;

        // Record ledger transactions for each leave type
        if (calc.casual > 0) {
          await prisma.leaveAccrualLedger.create({
            data: {
              tenantId,
              employeeId: emp.id,
              leaveType: LeaveType.CASUAL,
              transactionType: transType,
              amount: calc.casual,
              openingBalance: currentBalance,
              closingBalance: currentBalance + calc.casual,
              effectiveDate: asOfDate,
              description: `Casual Leave accrual: ${calc.note}`,
              batchId,
              triggeredBy: (scope as any).userId || 'SYSTEM',
            },
          });
        }

        if (calc.sick > 0) {
          await prisma.leaveAccrualLedger.create({
            data: {
              tenantId,
              employeeId: emp.id,
              leaveType: LeaveType.SICK,
              transactionType: transType,
              amount: calc.sick,
              openingBalance: currentBalance + calc.casual,
              closingBalance: currentBalance + calc.casual + calc.sick,
              effectiveDate: asOfDate,
              description: `Sick Leave accrual: ${calc.note}`,
              batchId,
              triggeredBy: (scope as any).userId || 'SYSTEM',
            },
          });
        }

        if (calc.earned > 0) {
          await prisma.leaveAccrualLedger.create({
            data: {
              tenantId,
              employeeId: emp.id,
              leaveType: LeaveType.EARNED,
              transactionType: transType,
              amount: calc.earned,
              openingBalance: currentBalance + calc.casual + calc.sick,
              closingBalance: projectedClosingBalance,
              effectiveDate: asOfDate,
              description: `Earned Leave accrual: ${calc.note}`,
              batchId,
              triggeredBy: (scope as any).userId || 'SYSTEM',
            },
          });
        }

        // Update employee root totalLeaves
        await prisma.employee.update({
          where: { id: emp.id },
          data: { totalLeaves: projectedClosingBalance },
        });
      }
    }

    return {
      success: true,
      commit,
      batchId: commit ? batchId : null,
      asOfDate: asOfDate.toISOString().split('T')[0],
      stats: {
        totalEmployeesEvaluated,
        totalCreditsApplied,
        totalProratedJoiners,
        alreadyAccruedCount: items.filter((i) => i.alreadyAccruedForPeriod).length,
      },
      items,
    };
  }

  /**
   * Runs the Year-End Carry-Forward, Lapse & Encashment Reconciliation Job.
   */
  static async runYearEndJob(scope: OrgScopeContext, options: {
    cycleYear: number;
    commit?: boolean;
    planId?: string;
    department?: string;
  }) {
    const tenantId = requireTenantId(scope);
    const cycleYear = options.cycleYear || new Date().getFullYear();
    const commit = !!options.commit;
    const batchId = `yearend_${cycleYear}_${Date.now().toString(36)}`;

    const where: any = { tenantId, status: { not: 'TERMINATED' } };
    if (options.department && options.department !== 'ALL') {
      where.department = options.department;
    }

    let explicitPlan: any = null;
    if (options.planId && options.planId !== 'AUTO') {
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(options.planId);
      explicitPlan = await prisma.leaveAccrualPlan.findFirst({
        where: {
          tenantId,
          ...(isObjectId ? { id: options.planId } : { code: options.planId }),
        },
      });
    }

    const employees = await prisma.employee.findMany({
      where,
      orderBy: { employeeId: 'asc' },
    });

    const items: YearEndRunItem[] = [];
    let totalCarried = 0;
    let totalLapsed = 0;

    for (const emp of employees) {
      const plan = explicitPlan || await this.resolvePlanForEmployee(tenantId, {
        locationId: emp.locationId,
        designation: emp.designation,
        department: emp.department,
      });

      const currentBalance = emp.totalLeaves || 0;
      const limit = plan.carryForwardLimit ?? 15.0;

      let carriedForward = Math.min(currentBalance, limit);
      let lapsedAmount = Math.max(0, currentBalance - limit);

      totalCarried += carriedForward;
      totalLapsed += lapsedAmount;

      // Encashment eligible days (retaining min balance)
      const minRetention = plan.minBalanceRetention ?? 15.0;
      const maxEncash = plan.maxEncashmentDays ?? 10.0;
      const encashmentEligibleDays = Math.max(0, Math.min(currentBalance - minRetention, maxEncash));

      items.push({
        employeeId: emp.id,
        employeeCode: emp.employeeId,
        name: `${emp.firstName} ${emp.lastName}`.trim(),
        designation: emp.designation,
        department: emp.department,
        planName: plan.name,
        carryForwardLimit: limit,
        currentBalance,
        carriedForward,
        lapsedAmount,
        newOpeningBalance: carriedForward,
        encashmentEligibleDays,
      });

      if (commit) {
        const effectiveDate = new Date(cycleYear, 11, 31, 23, 59, 59);

        if (lapsedAmount > 0) {
          await prisma.leaveAccrualLedger.create({
            data: {
              tenantId,
              employeeId: emp.id,
              leaveType: LeaveType.EARNED,
              transactionType: AccrualTransactionType.LAPSE,
              amount: -lapsedAmount,
              openingBalance: currentBalance,
              closingBalance: carriedForward,
              effectiveDate,
              description: `Year-end lapse of unused leaves exceeding ${limit} days carry cap`,
              batchId,
              triggeredBy: (scope as any).userId || 'SYSTEM',
            },
          });
        }

        await prisma.leaveAccrualLedger.create({
          data: {
            tenantId,
            employeeId: emp.id,
            leaveType: LeaveType.EARNED,
            transactionType: AccrualTransactionType.CARRY_FORWARD,
            amount: 0,
            openingBalance: carriedForward,
            closingBalance: carriedForward,
            effectiveDate: new Date(cycleYear + 1, 0, 1),
            description: `Year-end balance carried forward into ${cycleYear + 1}`,
            batchId,
            triggeredBy: (scope as any).userId || 'SYSTEM',
          },
        });

        await prisma.employee.update({
          where: { id: emp.id },
          data: { totalLeaves: carriedForward },
        });
      }
    }

    return {
      success: true,
      commit,
      cycleYear,
      batchId: commit ? batchId : null,
      stats: {
        totalEmployees: employees.length,
        totalCarried,
        totalLapsed,
      },
      items,
    };
  }

  /**
   * Submits a leave encashment request for an employee.
   */
  static async requestEncashment(scope: OrgScopeContext, data: {
    employeeId: string;
    daysToEncash: number;
    planId?: string;
    remarks?: string;
    reason?: string;
    ratePerDay?: number;
  }) {
    const tenantId = requireTenantId(scope);
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(data.employeeId);
    const emp = await prisma.employee.findFirst({
      where: {
        ...(isObjectId ? { id: data.employeeId } : { employeeId: data.employeeId }),
        tenantId,
      },
      include: { compensation: true },
    });
    if (!emp) throw new Error('Employee not found');

    let plan: any = null;
    if (data.planId && data.planId !== 'AUTO') {
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(data.planId);
      plan = await prisma.leaveAccrualPlan.findFirst({
        where: {
          tenantId,
          ...(isObjectId ? { id: data.planId } : { code: data.planId }),
        },
      });
    }

    if (!plan) {
      plan = await this.resolvePlanForEmployee(tenantId, {
        locationId: emp.locationId,
        designation: emp.designation,
        department: emp.department,
      });
    }

    if (!plan.enableEncashment) {
      throw new Error(`Encashment is not enabled under plan "${plan.name}"`);
    }

    const currentBalance = emp.totalLeaves || 0;
    const minRetention = plan.minBalanceRetention ?? 15.0;
    const maxEncash = plan.maxEncashmentDays ?? 10.0;
    const maxAllowed = Math.max(0, Math.min(currentBalance - minRetention, maxEncash));

    if (data.daysToEncash > maxAllowed) {
      throw new Error(
        `Requested ${data.daysToEncash} days exceeds eligible encashment limit of ${maxAllowed} days under policy "${plan.name}" (must retain ${minRetention} balance, max ${maxEncash} encashable)`
      );
    }

    // Daily wage estimation (Basic CTC / 26 or explicit ratePerDay)
    let perDayRate = data.ratePerDay && data.ratePerDay > 0 ? data.ratePerDay : 1000;
    if (!data.ratePerDay && emp.compensation?.anchorValue) {
      const basicAnnual = (emp.compensation.anchorValue as number) * 0.4;
      perDayRate = Math.round(basicAnnual / (12 * 26));
    }

    const totalAmount = Math.round(perDayRate * data.daysToEncash);

    const encashment = await prisma.leaveEncashmentRequest.create({
      data: {
        tenantId,
        employeeId: emp.id,
        daysToEncash: data.daysToEncash,
        perDayRate,
        totalAmount,
        status: 'APPROVED', // HR submitted / approved
        approvedByUserId: (scope as any).userId,
        processedAt: new Date(),
        payrollMonth: new Date().toISOString().slice(0, 7),
      },
    });

    // Debit leave ledger
    await prisma.leaveAccrualLedger.create({
      data: {
        tenantId,
        employeeId: emp.id,
        leaveType: LeaveType.EARNED,
        transactionType: AccrualTransactionType.ENCASHMENT,
        amount: -data.daysToEncash,
        openingBalance: currentBalance,
        closingBalance: currentBalance - data.daysToEncash,
        effectiveDate: new Date(),
        description: `Leave encashment of ${data.daysToEncash} days (₹${totalAmount})`,
        triggeredBy: (scope as any).userId || 'SYSTEM',
      },
    });

    // Update employee balance
    await prisma.employee.update({
      where: { id: emp.id },
      data: { totalLeaves: currentBalance - data.daysToEncash },
    });

    return encashment;
  }

  /**
   * Retrieves transaction ledger history for an employee or tenant
   */
  static async getLedger(scope: OrgScopeContext, employeeId?: string) {
    const tenantId = requireTenantId(scope);
    let targetEmpId = employeeId;
    if (employeeId && !/^[0-9a-fA-F]{24}$/.test(employeeId)) {
      const emp = await prisma.employee.findFirst({
        where: { tenantId, employeeId },
        select: { id: true },
      });
      if (emp) targetEmpId = emp.id;
    }
    return prisma.leaveAccrualLedger.findMany({
      where: {
        tenantId,
        ...(targetEmpId ? { employeeId: targetEmpId } : {}),
      },
      include: {
        employee: { select: { id: true, employeeId: true, firstName: true, lastName: true, designation: true } },
      },
      orderBy: { effectiveDate: 'desc' },
      take: 100,
    });
  }

  /**
   * CRUD for LeaveAccrualPlan
   */
  static async listPlans(scope: OrgScopeContext) {
    const tenantId = requireTenantId(scope);
    const plans = await prisma.leaveAccrualPlan.findMany({
      where: { tenantId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
    if (plans.length === 0) {
      // Auto seed default corporate plan
      const defaultPlan = await prisma.leaveAccrualPlan.create({
        data: {
          tenantId,
          code: 'LV-DEF-STD',
          name: 'Standard Corporate Leave Plan',
          frequency: AccrualFrequency.MONTHLY,
          annualCasual: 6.0,
          annualSick: 6.0,
          annualEarned: 6.0,
          carryForwardLimit: 15.0,
          lapseUnusedCasual: true,
          lapseUnusedSick: true,
          enableEncashment: true,
          maxEncashmentDays: 10.0,
          minBalanceRetention: 15.0,
          isDefault: true,
        },
      });
      return [defaultPlan];
    }
    return plans;
  }

  static async upsertPlan(scope: OrgScopeContext, data: any) {
    const tenantId = requireTenantId(scope);
    const code = String(data.code || `PLAN_${Date.now().toString(36)}`).toUpperCase();

    // Support both direct fields and frontend alias names
    const annualCasual = Number(data.annualCasual ?? (data.annualQuota ? Math.round(data.annualQuota / 4) : 6));
    const annualSick = Number(data.annualSick ?? (data.annualQuota ? Math.round(data.annualQuota / 4) : 6));
    const annualEarned = Number(data.annualEarned ?? (data.annualQuota ? Math.round(data.annualQuota / 2) : 12));
    const carryForwardLimit = Number(data.carryForwardLimit ?? data.maxCarryForward ?? 15);
    const enableEncashment = data.enableEncashment !== undefined ? Boolean(data.enableEncashment) : (data.encashmentAllowed !== undefined ? Boolean(data.encashmentAllowed) : true);
    const maxEncashmentDays = Number(data.maxEncashmentDays ?? data.maxEncashmentPerYear ?? 10);
    const minBalanceRetention = Number(data.minBalanceRetention ?? data.minRetentionForEncashment ?? 15);
    const enableProRata = data.enableProRata !== undefined ? Boolean(data.enableProRata) : (data.prorateForJoiners !== undefined ? Boolean(data.prorateForJoiners) : true);
    const targetLocationIds = Array.isArray(data.targetLocationIds) ? data.targetLocationIds : (Array.isArray(data.targetLocations) ? data.targetLocations : []);
    const targetGrades = Array.isArray(data.targetGrades) ? data.targetGrades : [];
    const targetDepartments = Array.isArray(data.targetDepartments) ? data.targetDepartments : [];

    const planData = {
      name: data.name,
      code,
      frequency: data.frequency || AccrualFrequency.MONTHLY,
      annualCasual,
      annualSick,
      annualEarned,
      carryForwardLimit,
      lapseUnusedCasual: data.lapseUnusedCasual !== undefined ? Boolean(data.lapseUnusedCasual) : true,
      lapseUnusedSick: data.lapseUnusedSick !== undefined ? Boolean(data.lapseUnusedSick) : true,
      enableEncashment,
      maxEncashmentDays,
      minBalanceRetention,
      isDefault: Boolean(data.isDefault),
      targetLocationIds,
      targetGrades,
      targetDepartments,
      enableProRata,
    };

    let plan;
    if (data.id) {
      plan = await prisma.leaveAccrualPlan.update({
        where: { id: data.id },
        data: planData,
      }).catch(async () => {
        return prisma.leaveAccrualPlan.upsert({
          where: { tenantId_code: { tenantId, code } },
          update: planData,
          create: {
            tenantId,
            code,
            ...planData,
          },
        });
      });
    } else {
      plan = await prisma.leaveAccrualPlan.upsert({
        where: { tenantId_code: { tenantId, code } },
        update: planData,
        create: {
          tenantId,
          code,
          ...planData,
        },
      });
    }

    if (data.isDefault) {
      await prisma.leaveAccrualPlan.updateMany({
        where: { tenantId, id: { not: plan.id } },
        data: { isDefault: false },
      });
    }

    return plan;
  }

  static async deletePlan(scope: OrgScopeContext, planId: string) {
    const tenantId = requireTenantId(scope);
    const plan = await prisma.leaveAccrualPlan.findFirst({
      where: { id: planId, tenantId },
    });
    if (!plan) throw new Error('Leave plan not found');
    if (plan.isDefault) throw new Error('Cannot delete the tenant default leave plan');

    await prisma.leaveAccrualPlan.delete({
      where: { id: planId },
    });
    return { success: true, message: `Leave plan "${plan.name}" deleted successfully` };
  }

  /**
   * Imports opening leave balances (Casual, Sick, Earned) for employees
   */
  static async importOpeningBalances(
    scope: OrgScopeContext,
    rows: Array<{
      employeeCode: string;
      casualBalance?: number;
      sickBalance?: number;
      earnedBalance?: number;
      effectiveDate?: string | Date;
      notes?: string;
    }>
  ) {
    const tenantId = requireTenantId(scope);
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('At least one row of opening balances is required');
    }

    const employees = await prisma.employee.findMany({
      where: {
        OR: [
          { tenantId },
          { orgUnit: { tenantId } },
          { user: { tenantId } },
        ],
      },
      select: { id: true, employeeId: true, firstName: true, lastName: true },
    });

    const empByCode = new Map<string, typeof employees[0]>();
    employees.forEach((e) => {
      empByCode.set(e.employeeId.toUpperCase(), e);
      empByCode.set(e.id, e);
    });

    let successCount = 0;
    let failureCount = 0;
    const errors: Array<{ row: number; employeeCode: string; message: string }> = [];
    const createdTransactions: any[] = [];

    const defaultEffectiveDate = new Date();
    const batchId = `OB_${Date.now()}`;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const code = String(row.employeeCode || '').trim().toUpperCase();
      if (!code) {
        failureCount++;
        errors.push({ row: i + 1, employeeCode: code, message: 'Employee code is required' });
        continue;
      }

      const emp = empByCode.get(code);
      if (!emp) {
        failureCount++;
        errors.push({ row: i + 1, employeeCode: code, message: `Employee with code ${code} not found` });
        continue;
      }

      const rowDate = row.effectiveDate ? new Date(row.effectiveDate) : defaultEffectiveDate;
      const notes = row.notes || 'Opening Balance Import';

      const leaveTypesToImport = [
        { type: LeaveType.CASUAL, amount: Number(row.casualBalance ?? 0) },
        { type: LeaveType.SICK, amount: Number(row.sickBalance ?? 0) },
        { type: LeaveType.EARNED, amount: Number(row.earnedBalance ?? 0) },
      ];

      for (const item of leaveTypesToImport) {
        if (item.amount > 0) {
          const lastLedger = await prisma.leaveAccrualLedger.findFirst({
            where: { tenantId, employeeId: emp.id, leaveType: item.type },
            orderBy: { effectiveDate: 'desc' },
          });
          const prevBalance = lastLedger ? lastLedger.closingBalance : 0;
          const newBalance = prevBalance + item.amount;

          const txn = await prisma.leaveAccrualLedger.create({
            data: {
              tenantId,
              employeeId: emp.id,
              leaveType: item.type,
              transactionType: AccrualTransactionType.OPENING_BALANCE,
              amount: item.amount,
              openingBalance: prevBalance,
              closingBalance: newBalance,
              effectiveDate: rowDate,
              description: `${notes} - ${item.type} (${item.amount} days)`,
              batchId,
            },
          });
          createdTransactions.push(txn);
        }
      }

      successCount++;
    }

    return {
      batchId,
      totalRows: rows.length,
      successCount,
      failureCount,
      errors,
      createdTransactionsCount: createdTransactions.length,
    };
  }

  /**
   * Lists LOP (Loss of Pay) reversal records for retrospective leaves approved post-payroll
   */
  static async listLopReversals(
    scope: OrgScopeContext,
    options: { status?: string; employeeId?: string; month?: string } = {}
  ) {
    const tenantId = requireTenantId(scope);
    const where: any = { tenantId };
    if (options.status) where.status = options.status;
    if (options.employeeId) {
      if (/^[0-9a-fA-F]{24}$/.test(options.employeeId)) {
        where.employeeId = options.employeeId;
      } else {
        const emp = await prisma.employee.findFirst({
          where: { tenantId, employeeId: options.employeeId },
          select: { id: true },
        });
        if (emp) where.employeeId = emp.id;
      }
    }
    if (options.month) where.payrollMonth = options.month;

    const adjustments = await prisma.lopReversalAdjustment.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            department: true,
            designation: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return adjustments.map((adj) => ({
      id: adj.id,
      employeeId: adj.employeeId,
      employeeCode: adj.employee.employeeId,
      employeeName: `${adj.employee.firstName} ${adj.employee.lastName}`,
      department: adj.employee.department,
      designation: adj.employee.designation,
      leaveId: adj.leaveId,
      reversedDays: adj.reversedDays,
      datesAffected: adj.datesAffected,
      payrollMonth: adj.payrollMonth,
      creditedInCycle: adj.creditedInCycle,
      notes: adj.notes,
      status: adj.status,
      createdAt: adj.createdAt,
    }));
  }

  /**
   * Marks a LOP adjustment as refunded in the given payroll cycle
   */
  static async markLopRefunded(
    scope: OrgScopeContext,
    id: string,
    cycleMonth?: string
  ) {
    const tenantId = requireTenantId(scope);
    const adjustment = await prisma.lopReversalAdjustment.findFirst({
      where: { id, tenantId },
    });
    if (!adjustment) {
      throw new Error('LOP Reversal record not found');
    }

    const currentCycle = cycleMonth || new Date().toISOString().slice(0, 7);

    const updated = await prisma.lopReversalAdjustment.update({
      where: { id },
      data: {
        status: 'REFUNDED',
        creditedInCycle: currentCycle,
      },
    });

    return {
      success: true,
      adjustment: updated,
      message: `LOP adjustment marked as refunded in cycle ${currentCycle}`,
    };
  }
}
