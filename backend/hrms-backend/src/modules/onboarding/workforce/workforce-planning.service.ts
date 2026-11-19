import prisma from '../../../shared/prisma';
import { logger } from '../../../shared/logger';

export class WorkforcePlanningService {
  /**
   * Seed standard approved departmental headcount budgets
   */
  static async seedStandardHeadcountPlans(tenantId: string, fiscalYear: string = 'FY2026-27') {
    const standards = [
      { department: 'Engineering', approvedHeadcount: 20, budgetedCtcCap: 30000000 },
      { department: 'Sales', approvedHeadcount: 10, budgetedCtcCap: 15000000 },
      { department: 'Marketing', approvedHeadcount: 5, budgetedCtcCap: 6000000 },
      { department: 'Human Resources', approvedHeadcount: 4, budgetedCtcCap: 4500000 },
      { department: 'Finance', approvedHeadcount: 4, budgetedCtcCap: 5000000 },
      { department: 'Operations', approvedHeadcount: 10, budgetedCtcCap: 8000000 },
    ];

    const results = [];
    for (const s of standards) {
      const plan = await prisma.headcountPlan.upsert({
        where: {
          tenantId_fiscalYear_department: {
            tenantId,
            fiscalYear,
            department: s.department,
          },
        },
        create: {
          tenantId,
          fiscalYear,
          department: s.department,
          approvedHeadcount: s.approvedHeadcount,
          budgetedCtcCap: s.budgetedCtcCap,
          notes: `Standard approved budget for ${s.department}`,
        },
        update: {
          approvedHeadcount: s.approvedHeadcount,
          budgetedCtcCap: s.budgetedCtcCap,
        },
      });
      results.push(plan);
    }

    logger.info('workforce.headcount.seeded', { tenantId, fiscalYear, count: results.length });
    return results;
  }

  /**
   * Set or update approved headcount plan for a department
   */
  static async setHeadcountPlan(
    tenantId: string,
    input: {
      fiscalYear: string;
      department: string;
      approvedHeadcount: number;
      budgetedCtcCap?: number;
      notes?: string;
    }
  ) {
    const plan = await prisma.headcountPlan.upsert({
      where: {
        tenantId_fiscalYear_department: {
          tenantId,
          fiscalYear: input.fiscalYear,
          department: input.department,
        },
      },
      create: {
        tenantId,
        fiscalYear: input.fiscalYear,
        department: input.department,
        approvedHeadcount: input.approvedHeadcount,
        budgetedCtcCap: input.budgetedCtcCap || null,
        notes: input.notes,
      },
      update: {
        approvedHeadcount: input.approvedHeadcount,
        budgetedCtcCap: input.budgetedCtcCap || null,
        notes: input.notes,
      },
    });

    logger.info('workforce.headcount.set', { tenantId, planId: plan.id, dept: plan.department });
    return plan;
  }

  /**
   * Compute Headcount Budget vs Actual variance across departments
   */
  static async getHeadcountBudgetVsActual(tenantId: string, fiscalYear: string = 'FY2026-27') {
    // 1. Fetch approved headcount plans
    let plans = await prisma.headcountPlan.findMany({
      where: { tenantId, fiscalYear, isActive: true },
      orderBy: { department: 'asc' },
    });

    if (plans.length === 0) {
      plans = await this.seedStandardHeadcountPlans(tenantId, fiscalYear);
    }

    // 2. Fetch active employee counts per department with compensation snapshot
    const activeEmployees = await prisma.employee.findMany({
      where: { tenantId, status: 'ACTIVE' },
      include: {
        compensation: true,
      },
    });

    // 3. Fetch active/in-flight job requisitions (APPROVED or SUBMITTED)
    const activeRequisitions = await prisma.jobRequisition.findMany({
      where: {
        tenantId,
        status: { in: ['APPROVED', 'SUBMITTED', 'BUDGET_EXCEPTION_REQUIRED'] },
      },
      select: { department: true, numberOfOpenings: true },
    });

    // Aggregations
    const actualCountMap: Record<string, number> = {};
    const actualCtcMap: Record<string, number> = {};
    for (const emp of activeEmployees) {
      const dept = emp.department || 'General';
      actualCountMap[dept] = (actualCountMap[dept] || 0) + 1;

      let annualized = 600000;
      if (emp.compensation) {
        if (emp.compensation.anchorType === 'ANNUAL_CTC') {
          annualized = emp.compensation.anchorValue;
        } else {
          annualized = emp.compensation.anchorValue * 12;
        }
      }
      actualCtcMap[dept] = (actualCtcMap[dept] || 0) + annualized;
    }

    const inFlightReqMap: Record<string, number> = {};
    for (const req of activeRequisitions) {
      inFlightReqMap[req.department] = (inFlightReqMap[req.department] || 0) + req.numberOfOpenings;
    }

    let totalApproved = 0;
    let totalActual = 0;
    let totalInFlight = 0;

    const departmentBreakdown = plans.map((plan) => {
      const actual = actualCountMap[plan.department] || 0;
      const inFlight = inFlightReqMap[plan.department] || 0;
      const committed = actual + inFlight;
      const remainingVacancies = Math.max(0, plan.approvedHeadcount - committed);
      const isOverBudget = committed > plan.approvedHeadcount;
      const variance = plan.approvedHeadcount - committed;
      const utilizationPercent = plan.approvedHeadcount > 0
        ? Math.round((committed / plan.approvedHeadcount) * 100)
        : 100;

      totalApproved += plan.approvedHeadcount;
      totalActual += actual;
      totalInFlight += inFlight;

      return {
        id: plan.id,
        department: plan.department,
        approvedHeadcount: plan.approvedHeadcount,
        actualHeadcount: actual,
        inFlightRequisitions: inFlight,
        totalCommitted: committed,
        remainingVacancies,
        isOverBudget,
        variance,
        utilizationPercent,
        budgetedCtcCap: plan.budgetedCtcCap,
        actualCtcAnnualized: actualCtcMap[plan.department] || 0,
      };
    });

    return {
      fiscalYear,
      summary: {
        totalApprovedHeadcount: totalApproved,
        totalActualHeadcount: totalActual,
        totalInFlightRequisitions: totalInFlight,
        totalRemainingCapacity: Math.max(0, totalApproved - (totalActual + totalInFlight)),
        overallUtilizationPercent: totalApproved > 0
          ? Math.round(((totalActual + totalInFlight) / totalApproved) * 100)
          : 0,
      },
      departments: departmentBreakdown,
    };
  }

  /**
   * Create a job requisition governed by approved headcount limits
   */
  static async createJobRequisition(
    tenantId: string,
    input: {
      title: string;
      department: string;
      numberOfOpenings?: number;
      budgetedMinCtc: number;
      budgetedMaxCtc: number;
      employmentType?: string;
      justification?: string;
      fiscalYear?: string;
    },
    raisedByUserId?: string
  ) {
    const fiscalYear = input.fiscalYear || 'FY2026-27';
    const openings = input.numberOfOpenings || 1;

    // Check approved headcount plan for this department
    let plan = await prisma.headcountPlan.findUnique({
      where: {
        tenantId_fiscalYear_department: {
          tenantId,
          fiscalYear,
          department: input.department,
        },
      },
    });

    if (!plan) {
      // Auto-fallback plan creation
      plan = await prisma.headcountPlan.create({
        data: {
          tenantId,
          fiscalYear,
          department: input.department,
          approvedHeadcount: 10,
          notes: 'Auto-initialized headcount baseline',
        },
      });
    }

    // Count existing active employees in this department
    const currentActive = await prisma.employee.count({
      where: { tenantId, department: input.department, status: 'ACTIVE' },
    });

    // Count existing open requisitions in this department
    const existingRequisitions = await prisma.jobRequisition.findMany({
      where: {
        tenantId,
        department: input.department,
        status: { in: ['APPROVED', 'SUBMITTED', 'BUDGET_EXCEPTION_REQUIRED'] },
      },
      select: { numberOfOpenings: true },
    });
    const currentInFlight = existingRequisitions.reduce((sum, r) => sum + r.numberOfOpenings, 0);

    const projectedTotal = currentActive + currentInFlight + openings;
    const isExceeded = projectedTotal > plan.approvedHeadcount;

    // Generate requisition number
    const count = await prisma.jobRequisition.count({ where: { tenantId } });
    const requisitionNumber = `REQ-2026-${String(count + 1).padStart(3, '0')}`;

    const initialStatus = isExceeded ? 'BUDGET_EXCEPTION_REQUIRED' : 'APPROVED';

    const requisition = await prisma.jobRequisition.create({
      data: {
        tenantId,
        requisitionNumber,
        title: input.title,
        department: input.department,
        numberOfOpenings: openings,
        budgetedMinCtc: input.budgetedMinCtc,
        budgetedMaxCtc: input.budgetedMaxCtc,
        employmentType: input.employmentType || 'FULL_TIME',
        justification: input.justification,
        status: initialStatus,
        budgetExceeded: isExceeded,
        currentDepartmentHeadcount: currentActive,
        approvedDepartmentBudget: plan.approvedHeadcount,
        raisedByUserId,
      },
    });

    logger.info('workforce.requisition.created', {
      tenantId,
      requisitionNumber,
      isExceeded,
      status: initialStatus,
      projectedTotal,
      approvedLimit: plan.approvedHeadcount,
    });

    return {
      requisition,
      governanceCheck: {
        approvedBudget: plan.approvedHeadcount,
        currentActive,
        currentInFlight,
        requestedOpenings: openings,
        projectedTotal,
        isBudgetExceeded: isExceeded,
        actionRequired: isExceeded
          ? 'Requires CFO / Head of HR special budget exception approval'
          : 'Approved within authorized headcount budget',
      },
    };
  }

  /**
   * Approve a job requisition (including exception approvals)
   */
  static async approveJobRequisition(
    tenantId: string,
    requisitionId: string,
    approvedByUserId: string,
    approvalNotes?: string
  ) {
    const req = await prisma.jobRequisition.findFirst({
      where: { id: requisitionId, tenantId },
    });
    if (!req) throw new Error('Job requisition not found');

    const updated = await prisma.jobRequisition.update({
      where: { id: req.id },
      data: {
        status: 'APPROVED',
        approvedByUserId,
        approvalNotes: approvalNotes || 'Approved by authorized authority',
      },
    });

    logger.info('workforce.requisition.approved', { tenantId, requisitionId, approvedByUserId });
    return updated;
  }

  /**
   * List all job requisitions
   */
  static async listJobRequisitions(
    tenantId: string,
    filters?: { department?: string; status?: string }
  ) {
    const where: any = { tenantId };
    if (filters?.department) where.department = filters.department;
    if (filters?.status) where.status = filters.status;

    return prisma.jobRequisition.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }
}
