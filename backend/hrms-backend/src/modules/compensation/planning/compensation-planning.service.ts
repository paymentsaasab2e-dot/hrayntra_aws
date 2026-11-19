import prisma from '../../../shared/prisma';
import { logger } from '../../../shared/logger';

export interface CreateCompensationCycleInput {
  name: string;
  code: string;
  fiscalYear: string;
  effectiveDate: Date | string;
  totalBudgetAmount: number;
  currency?: string;
  overallHikePercent?: number;
  ratingMatrix?: Record<string, Record<string, number>>;
}

export class CompensationPlanningService {
  /**
   * Standard Default Merit Grid (Rating x Compa-Ratio Band)
   * Rows: Performance Ratings 1 to 5
   * Columns: Compa-Ratio Bands (Low: < 85%, Mid: 85-115%, High: > 115%)
   */
  static readonly DEFAULT_RATING_MATRIX: Record<number, { low: number; mid: number; high: number }> = {
    5: { low: 20.0, mid: 16.0, high: 12.0 }, // Outstanding
    4: { low: 15.0, mid: 12.0, high: 9.0 },  // Exceeds Expectations
    3: { low: 10.0, mid: 8.0,  high: 5.0 },  // Meets Expectations
    2: { low: 4.0,  mid: 2.0,  high: 0.0 },  // Needs Improvement
    1: { low: 0.0,  mid: 0.0,  high: 0.0 },  // Unsatisfactory
  };

  /**
   * Calculate compa-ratio given an employee's current salary and grade midpoint
   */
  static calculateCompaRatio(currentCtc: number, gradeMidpoint: number) {
    if (!gradeMidpoint || gradeMidpoint <= 0) {
      return { compaRatio: 100.0, bandPosition: 'TARGET_BAND' as const };
    }
    const ratio = Math.round((currentCtc / gradeMidpoint) * 1000) / 10;
    let bandPosition: 'BELOW_MARKET' | 'TARGET_BAND' | 'ABOVE_MARKET' = 'TARGET_BAND';
    if (ratio < 85.0) bandPosition = 'BELOW_MARKET';
    else if (ratio > 115.0) bandPosition = 'ABOVE_MARKET';

    return { compaRatio: ratio, bandPosition };
  }

  /**
   * Determine recommended merit hike % from rating and compa-ratio
   */
  static getRecommendedHike(rating: number, compaRatio: number): number {
    const roundedRating = Math.max(1, Math.min(5, Math.round(rating)));
    const grid = this.DEFAULT_RATING_MATRIX[roundedRating] || this.DEFAULT_RATING_MATRIX[3];

    if (compaRatio < 85.0) return grid.low;
    if (compaRatio > 115.0) return grid.high;
    return grid.mid;
  }

  /**
   * Create a new compensation increment cycle
   */
  static async createCycle(tenantId: string, input: CreateCompensationCycleInput) {
    const existing = await prisma.compensationCycle.findUnique({
      where: {
        tenantId_code: {
          tenantId,
          code: input.code,
        },
      },
    });

    if (existing) {
      throw new Error(`Cycle with code ${input.code} already exists`);
    }

    const cycle = await prisma.compensationCycle.create({
      data: {
        tenantId,
        name: input.name,
        code: input.code,
        fiscalYear: input.fiscalYear,
        effectiveDate: new Date(input.effectiveDate),
        totalBudgetAmount: input.totalBudgetAmount,
        currency: input.currency || 'INR',
        overallHikePercent: input.overallHikePercent || 10.0,
        ratingMatrix: (input.ratingMatrix || this.DEFAULT_RATING_MATRIX) as any,
        status: 'PLANNING',
      },
    });

    logger.info('compensation.cycle.created', { tenantId, cycleId: cycle.id, code: cycle.code });
    return cycle;
  }

  /**
   * List all compensation cycles for tenant
   */
  static async listCycles(tenantId: string) {
    return prisma.compensationCycle.findMany({
      where: { tenantId },
      include: {
        departmentPools: true,
        _count: { select: { recommendations: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Allocate or update departmental budget pool for a cycle
   */
  static async allocateDepartmentPool(
    tenantId: string,
    cycleId: string,
    department: string,
    allocatedBudget: number
  ) {
    const cycle = await prisma.compensationCycle.findFirst({
      where: { id: cycleId, tenantId },
    });
    if (!cycle) throw new Error('Compensation cycle not found');

    const pool = await prisma.departmentBudgetPool.upsert({
      where: {
        cycleId_department: {
          cycleId,
          department,
        },
      },
      create: {
        tenantId,
        cycleId,
        department,
        allocatedBudget,
      },
      update: {
        allocatedBudget,
      },
    });

    logger.info('compensation.pool.allocated', { tenantId, cycleId, department, allocatedBudget });
    return pool;
  }

  /**
   * Populate recommendations for all eligible active employees in the tenant
   */
  static async generateRecommendationsForCycle(tenantId: string, cycleId: string) {
    const cycle = await prisma.compensationCycle.findFirst({
      where: { id: cycleId, tenantId },
    });
    if (!cycle) throw new Error('Compensation cycle not found');

    const employees = await prisma.employee.findMany({
      where: { tenantId, status: 'ACTIVE' },
      include: {
        compensation: true,
        performanceReviews: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    let generatedCount = 0;

    for (const emp of employees) {
      // Calculate current annualized CTC
      let currentCtc = 600000;
      if (emp.compensation) {
        if (emp.compensation.anchorType === 'ANNUAL_CTC') {
          currentCtc = emp.compensation.anchorValue;
        } else {
          currentCtc = emp.compensation.anchorValue * 12;
        }
      }

      // Assume Grade midpoint ~ baseline depending on designation level
      const gradeMidpoint = 800000;
      const { compaRatio } = this.calculateCompaRatio(currentCtc, gradeMidpoint);

      // Latest review rating or default solid performer 3.8
      const rating = emp.performanceReviews[0]?.metrics?.finalScore
        ? (emp.performanceReviews[0].metrics.finalScore / 20) // Convert out of 100 to 5-star
        : 3.8;

      const recommendedPercent = this.getRecommendedHike(rating, compaRatio);
      const recommendedHikeAmount = Math.round((currentCtc * recommendedPercent) / 100);
      const newProposedCtc = currentCtc + recommendedHikeAmount;

      await prisma.employeeIncrementRecommendation.upsert({
        where: {
          cycleId_employeeId: {
            cycleId,
            employeeId: emp.id,
          },
        },
        create: {
          tenantId,
          cycleId,
          employeeId: emp.id,
          currentCtc,
          gradeMidpoint,
          compaRatio,
          performanceRating: Math.round(rating * 10) / 10,
          recommendedPercent,
          recommendedHikeAmount,
          newProposedCtc,
          managerNotes: `Generated via rating ${Math.round(rating * 10) / 10} and compa-ratio ${compaRatio}%`,
          status: 'SUBMITTED',
        },
        update: {
          currentCtc,
          gradeMidpoint,
          compaRatio,
          performanceRating: Math.round(rating * 10) / 10,
          recommendedPercent,
          recommendedHikeAmount,
          newProposedCtc,
        },
      });

      generatedCount++;
    }

    // Refresh departmental pool spent aggregates
    await this.refreshPoolSpentAggregates(cycleId);

    // Update cycle status to IN_PROGRESS
    await prisma.compensationCycle.update({
      where: { id: cycleId },
      data: { status: 'IN_PROGRESS' },
    });

    return {
      success: true,
      cycleCode: cycle.code,
      totalRecommendations: generatedCount,
    };
  }

  /**
   * Update a manager recommendation (override hike %, adjust new CTC)
   */
  static async updateRecommendation(
    tenantId: string,
    recommendationId: string,
    input: {
      recommendedPercent?: number;
      recommendedHikeAmount?: number;
      managerNotes?: string;
      status?: string;
    }
  ) {
    const rec = await prisma.employeeIncrementRecommendation.findFirst({
      where: { id: recommendationId, tenantId },
    });
    if (!rec) throw new Error('Recommendation not found');

    const updateData: any = {};
    if (input.managerNotes !== undefined) updateData.managerNotes = input.managerNotes;
    if (input.status) updateData.status = input.status;

    if (input.recommendedPercent !== undefined) {
      updateData.recommendedPercent = input.recommendedPercent;
      updateData.recommendedHikeAmount = Math.round((rec.currentCtc * input.recommendedPercent) / 100);
      updateData.newProposedCtc = rec.currentCtc + updateData.recommendedHikeAmount;
    } else if (input.recommendedHikeAmount !== undefined) {
      updateData.recommendedHikeAmount = input.recommendedHikeAmount;
      updateData.recommendedPercent = Math.round((input.recommendedHikeAmount / rec.currentCtc) * 1000) / 10;
      updateData.newProposedCtc = rec.currentCtc + input.recommendedHikeAmount;
    }

    const updated = await prisma.employeeIncrementRecommendation.update({
      where: { id: rec.id },
      data: updateData,
      include: { employee: true },
    });

    await this.refreshPoolSpentAggregates(rec.cycleId);

    return updated;
  }

  /**
   * Recalculates spent budget per department pool
   */
  private static async refreshPoolSpentAggregates(cycleId: string) {
    const recs = await prisma.employeeIncrementRecommendation.findMany({
      where: { cycleId },
      include: { employee: { select: { department: true } } },
    });

    const deptMap: Record<string, { totalHike: number; count: number; totalPct: number }> = {};
    for (const r of recs) {
      const dept = r.employee.department || 'General';
      if (!deptMap[dept]) deptMap[dept] = { totalHike: 0, count: 0, totalPct: 0 };
      deptMap[dept].totalHike += r.recommendedHikeAmount;
      deptMap[dept].totalPct += r.recommendedPercent;
      deptMap[dept].count += 1;
    }

    for (const [dept, stat] of Object.entries(deptMap)) {
      const avgPct = stat.count > 0 ? Math.round((stat.totalPct / stat.count) * 10) / 10 : 0;
      await prisma.departmentBudgetPool.upsert({
        where: { cycleId_department: { cycleId, department: dept } },
        create: {
          tenantId: recs[0]?.tenantId || '',
          cycleId,
          department: dept,
          allocatedBudget: Math.round(stat.totalHike * 1.15), // Auto-allocate 15% buffer pool if unset
          spentBudget: stat.totalHike,
          eligibleHeadcount: stat.count,
          averageHikePercent: avgPct,
        },
        update: {
          spentBudget: stat.totalHike,
          eligibleHeadcount: stat.count,
          averageHikePercent: avgPct,
        },
      });
    }
  }

  /**
   * Apply increment cycle and update employee CTCs
   */
  static async applyCycle(tenantId: string, cycleId: string, hrUserId: string) {
    const cycle = await prisma.compensationCycle.findFirst({
      where: { id: cycleId, tenantId },
      include: { recommendations: { include: { employee: true } } },
    });
    if (!cycle) throw new Error('Compensation cycle not found');

    let appliedCount = 0;
    const now = new Date();

    // Fetch default profile for tenant
    const defaultProfile = await prisma.payrollComplianceProfile.findFirst({
      where: { tenantId },
      select: { id: true },
    });

    for (const rec of cycle.recommendations) {
      if (rec.status !== 'REJECTED') {
        const existingComp = await prisma.employeeCompensation.findFirst({
          where: { employeeId: rec.employeeId, tenantId },
        });

        if (existingComp) {
          await prisma.employeeCompensation.update({
            where: { id: existingComp.id },
            data: {
              anchorType: 'ANNUAL_CTC',
              anchorValue: rec.newProposedCtc,
              computedSnapshot: {
                annualCtc: rec.newProposedCtc,
                monthlyGross: Math.round(rec.newProposedCtc / 12),
              },
              effectiveFrom: cycle.effectiveDate,
            },
          });
        } else {
          await prisma.employeeCompensation.create({
            data: {
              tenantId,
              employeeId: rec.employeeId,
              anchorType: 'ANNUAL_CTC',
              anchorValue: rec.newProposedCtc,
              currencyCode: cycle.currency || 'INR',
              complianceProfileId: defaultProfile?.id || '6a08259b752e15d6a06ec480',
              computedSnapshot: {
                annualCtc: rec.newProposedCtc,
                monthlyGross: Math.round(rec.newProposedCtc / 12),
              },
              effectiveFrom: cycle.effectiveDate,
            },
          });
        }

        await prisma.employeeIncrementRecommendation.update({
          where: { id: rec.id },
          data: {
            status: 'APPLIED',
            hrApprovedByUserId: hrUserId,
            appliedAt: now,
          },
        });

        appliedCount++;
      }
    }

    await prisma.compensationCycle.update({
      where: { id: cycleId },
      data: { status: 'APPLIED' },
    });

    logger.info('compensation.cycle.applied', { tenantId, cycleId, appliedCount });
    return {
      success: true,
      cycleCode: cycle.code,
      appliedCount,
      effectiveDate: cycle.effectiveDate,
    };
  }

  /**
   * Get detailed analytics dashboard for a compensation cycle
   */
  static async getCycleDashboard(tenantId: string, cycleId: string) {
    const cycle = await prisma.compensationCycle.findFirst({
      where: { id: cycleId, tenantId },
      include: {
        departmentPools: true,
        recommendations: {
          include: {
            employee: {
              select: { id: true, firstName: true, lastName: true, department: true, designation: true },
            },
          },
        },
      },
    });
    if (!cycle) throw new Error('Compensation cycle not found');

    const recs = cycle.recommendations;
    const totalCurrentCtc = recs.reduce((sum, r) => sum + r.currentCtc, 0);
    const totalNewProposedCtc = recs.reduce((sum, r) => sum + r.newProposedCtc, 0);
    const totalHikeSpent = recs.reduce((sum, r) => sum + r.recommendedHikeAmount, 0);
    const overallAvgHikePct = recs.length > 0
      ? Math.round((recs.reduce((sum, r) => sum + r.recommendedPercent, 0) / recs.length) * 10) / 10
      : 0;

    // Compa-ratio distribution
    const belowMarket = recs.filter((r) => (r.compaRatio || 100) < 85).length;
    const targetBand = recs.filter((r) => (r.compaRatio || 100) >= 85 && (r.compaRatio || 100) <= 115).length;
    const aboveMarket = recs.filter((r) => (r.compaRatio || 100) > 115).length;

    return {
      cycle: {
        id: cycle.id,
        name: cycle.name,
        code: cycle.code,
        fiscalYear: cycle.fiscalYear,
        effectiveDate: cycle.effectiveDate,
        status: cycle.status,
        totalBudgetAmount: cycle.totalBudgetAmount,
        currency: cycle.currency,
        overallHikePercent: cycle.overallHikePercent,
      },
      metrics: {
        eligibleEmployees: recs.length,
        totalCurrentPayroll: totalCurrentCtc,
        totalProposedPayroll: totalNewProposedCtc,
        totalHikeCommitted: totalHikeSpent,
        budgetUtilizationPercent: cycle.totalBudgetAmount > 0
          ? Math.round((totalHikeSpent / cycle.totalBudgetAmount) * 100)
          : 0,
        averageHikePercent: overallAvgHikePct,
      },
      compaRatioDistribution: {
        belowMarketCount: belowMarket,
        targetBandCount: targetBand,
        aboveMarketCount: aboveMarket,
      },
      departmentPools: cycle.departmentPools,
      recommendations: recs,
    };
  }
}
