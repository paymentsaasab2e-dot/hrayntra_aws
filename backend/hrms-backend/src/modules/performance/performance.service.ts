import prisma from '../../shared/prisma';
import { OrgScopeContext, employeeWhereFromScope } from '../../shared/org/org-scope.service';
import {
  PerformanceCalculator,
  categoryFromScore,
  computeFinalScore,
  type CycleType,
} from './performanceCalculator';

export class PerformanceService {
  static async resolveEmployeeId(employeeId: string, scope?: OrgScopeContext): Promise<string> {
    if (!employeeId) throw new Error('Employee ID is required');
    const whereBase = scope ? employeeWhereFromScope(scope) : {};
    if (employeeId.match(/^[0-9a-fA-F]{24}$/)) {
      const emp = await prisma.employee.findFirst({
        where: { id: employeeId, ...whereBase },
      });
      if (!emp) throw new Error(`Employee ${employeeId} not found`);
      return emp.id;
    }
    const emp = await prisma.employee.findFirst({
      where: { employeeId, ...whereBase },
    });
    if (!emp) throw new Error(`Employee ${employeeId} not found`);
    return emp.id;
  }

  static async getAll(scope: OrgScopeContext, filters: any = {}) {
    if (!scope.tenantId) return [];

    const visibleEmployees = await prisma.employee.findMany({
      where: employeeWhereFromScope(scope),
      select: { id: true },
    });
    const visibleIds = visibleEmployees.map((e) => e.id);
    if (visibleIds.length === 0) return [];

    const where: any = { employeeId: { in: visibleIds } };
    if (filters.employeeId) {
      const empId = await this.resolveEmployeeId(filters.employeeId, scope);
      if (!visibleIds.includes(empId)) return [];
      where.employeeId = empId;
    }
    if (filters.status) where.status = filters.status;
    if (filters.cycleType) where.cycleType = filters.cycleType;

    return prisma.performanceReview.findMany({
      where,
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeId: true,
            department: true,
            designation: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getById(scope: OrgScopeContext, id: string) {
    if (!scope.tenantId) return null;
    const review = await prisma.performanceReview.findUnique({
      where: { id },
      include: { employee: true },
    });
    if (!review) return null;
    const visible = await prisma.employee.findFirst({
      where: { id: review.employeeId, ...employeeWhereFromScope(scope) },
      select: { id: true },
    });
    return visible ? review : null;
  }

  static async getByEmployee(scope: OrgScopeContext, employeeId: string) {
    const empId = await this.resolveEmployeeId(employeeId, scope);
    return prisma.performanceReview.findMany({
      where: { employeeId: empId },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async computeForEmployee(
    scope: OrgScopeContext,
    employeeId: string,
    cycle: string,
    cycleType: CycleType,
    managerScore = 0
  ) {
    const empId = await this.resolveEmployeeId(employeeId, scope);
    return PerformanceCalculator.compute(empId, cycle, cycleType, managerScore);
  }

  static async computeTeamAnalytics(scope: OrgScopeContext, cycle: string, cycleType: CycleType) {
    if (!scope.tenantId) {
      return {
        cycle,
        cycleType,
        summary: { employeeCount: 0, avgFinalScore: 0, avgOnTimeRate: 0, totalOverdueOpen: 0, atRiskCount: 0 },
        employees: [],
      };
    }
    const visible = await prisma.employee.findMany({
      where: { status: 'ACTIVE', ...employeeWhereFromScope(scope) },
      select: { id: true },
    });
    return PerformanceCalculator.computeTeamAnalytics(
      cycle,
      cycleType,
      visible.map((e) => e.id)
    );
  }

  static async refreshReview(scope: OrgScopeContext, id: string) {
    const existing = await this.getById(scope, id);
    if (!existing) throw new Error('Review not found');

    const managerScore = (existing.metrics as any)?.managerScore || 0;
    const computed = await PerformanceCalculator.compute(
      existing.employeeId,
      existing.cycle,
      existing.cycleType as CycleType,
      managerScore
    );

    const includeManager = managerScore > 0;
    const finalScore = computeFinalScore(
      computed.taskScore,
      computed.attendanceScore,
      computed.leaveScore,
      managerScore,
      includeManager
    );

    const metrics = {
      taskScore: computed.taskScore,
      attendanceScore: computed.attendanceScore,
      leaveScore: computed.leaveScore,
      managerScore,
      finalScore,
      category: categoryFromScore(includeManager ? finalScore : computed.breakdown.provisionalScore),
      breakdown: computed.breakdown,
    };

    return prisma.performanceReview.update({
      where: { id },
      data: {
        metrics,
        insights: computed.insights,
      },
      include: { employee: true },
    });
  }

  static async create(scope: OrgScopeContext, data: any) {
    const empId = await this.resolveEmployeeId(data.employeeId, scope);
    const cycleType = (data.cycleType || 'quarterly') as CycleType;
    const computed = await PerformanceCalculator.compute(empId, data.cycle, cycleType, 0);

    const metrics = {
      taskScore: computed.taskScore,
      attendanceScore: computed.attendanceScore,
      leaveScore: computed.leaveScore,
      managerScore: 0,
      finalScore: computed.breakdown.provisionalScore,
      category: computed.category,
      breakdown: computed.breakdown,
    };

    return prisma.performanceReview.create({
      data: {
        employeeId: empId,
        cycle: data.cycle,
        cycleType,
        metrics,
        insights: computed.insights,
        status: 'Pending Self Review',
      },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeId: true,
            department: true,
            designation: true,
          },
        },
      },
    });
  }

  static async update(scope: OrgScopeContext, id: string, data: any) {
    const existing = await this.getById(scope, id);
    if (!existing) throw new Error('Review not found');

    const nextMetrics = data.metrics
      ? { ...(existing.metrics as any), ...data.metrics }
      : (existing.metrics as any);

    return prisma.performanceReview.update({
      where: { id },
      data: {
        cycle: data.cycle ?? existing.cycle,
        cycleType: data.cycleType ?? existing.cycleType,
        metrics: nextMetrics,
        insights: data.insights
          ? { ...(existing.insights as any), ...data.insights }
          : (existing.insights as any),
        status: data.status ?? existing.status,
      },
    });
  }

  static async submitSelfReview(scope: OrgScopeContext, id: string, data: any) {
    const existing = await this.getById(scope, id);
    if (!existing) throw new Error('Review not found');
    return prisma.performanceReview.update({
      where: { id },
      data: {
        selfAssessment: {
          submittedAt: new Date().toISOString(),
          rating: data.rating,
          comments: data.comments,
        },
        status: 'Pending Manager Review',
      },
    });
  }

  static async submitManagerReview(scope: OrgScopeContext, id: string, data: any) {
    const review = await this.getById(scope, id);
    if (!review) throw new Error('Review not found');

    const managerScore = data.rating * 20;
    const computed = await PerformanceCalculator.compute(
      review.employeeId,
      review.cycle,
      review.cycleType as CycleType,
      managerScore
    );

    const finalScore = computeFinalScore(
      computed.taskScore,
      computed.attendanceScore,
      computed.leaveScore,
      managerScore,
      true
    );

    const metrics = {
      taskScore: computed.taskScore,
      attendanceScore: computed.attendanceScore,
      leaveScore: computed.leaveScore,
      managerScore,
      finalScore,
      category: categoryFromScore(finalScore),
      breakdown: computed.breakdown,
    };

    return prisma.performanceReview.update({
      where: { id },
      data: {
        managerAssessment: {
          submittedAt: new Date().toISOString(),
          managerId: data.managerId,
          rating: data.rating,
          feedback: data.feedback,
        },
        metrics,
        insights: computed.insights,
        status: 'Completed',
      },
      include: { employee: true },
    });
  }

  static async delete(scope: OrgScopeContext, id: string) {
    const existing = await this.getById(scope, id);
    if (!existing) throw new Error('Review not found');
    return prisma.performanceReview.delete({ where: { id } });
  }
}
