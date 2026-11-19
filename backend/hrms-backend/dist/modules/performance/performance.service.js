"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerformanceService = void 0;
const prisma_1 = __importDefault(require("../../shared/prisma"));
const org_scope_service_1 = require("../../shared/org/org-scope.service");
const performanceCalculator_1 = require("./performanceCalculator");
class PerformanceService {
    static async resolveEmployeeId(employeeId, scope) {
        if (!employeeId)
            throw new Error('Employee ID is required');
        const whereBase = scope ? (0, org_scope_service_1.employeeWhereFromScope)(scope) : {};
        if (employeeId.match(/^[0-9a-fA-F]{24}$/)) {
            const emp = await prisma_1.default.employee.findFirst({
                where: { id: employeeId, ...whereBase },
            });
            if (!emp)
                throw new Error(`Employee ${employeeId} not found`);
            return emp.id;
        }
        const emp = await prisma_1.default.employee.findFirst({
            where: { employeeId, ...whereBase },
        });
        if (!emp)
            throw new Error(`Employee ${employeeId} not found`);
        return emp.id;
    }
    static async getAll(scope, filters = {}) {
        if (!scope.tenantId)
            return [];
        const visibleEmployees = await prisma_1.default.employee.findMany({
            where: (0, org_scope_service_1.employeeWhereFromScope)(scope),
            select: { id: true },
        });
        const visibleIds = visibleEmployees.map((e) => e.id);
        if (visibleIds.length === 0)
            return [];
        const where = { employeeId: { in: visibleIds } };
        if (filters.employeeId) {
            const empId = await this.resolveEmployeeId(filters.employeeId, scope);
            if (!visibleIds.includes(empId))
                return [];
            where.employeeId = empId;
        }
        if (filters.status)
            where.status = filters.status;
        if (filters.cycleType)
            where.cycleType = filters.cycleType;
        return prisma_1.default.performanceReview.findMany({
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
    static async getById(scope, id) {
        if (!scope.tenantId)
            return null;
        const review = await prisma_1.default.performanceReview.findUnique({
            where: { id },
            include: { employee: true },
        });
        if (!review)
            return null;
        const visible = await prisma_1.default.employee.findFirst({
            where: { id: review.employeeId, ...(0, org_scope_service_1.employeeWhereFromScope)(scope) },
            select: { id: true },
        });
        return visible ? review : null;
    }
    static async getByEmployee(scope, employeeId) {
        const empId = await this.resolveEmployeeId(employeeId, scope);
        return prisma_1.default.performanceReview.findMany({
            where: { employeeId: empId },
            orderBy: { createdAt: 'desc' },
        });
    }
    static async computeForEmployee(scope, employeeId, cycle, cycleType, managerScore = 0) {
        const empId = await this.resolveEmployeeId(employeeId, scope);
        return performanceCalculator_1.PerformanceCalculator.compute(empId, cycle, cycleType, managerScore);
    }
    static async computeTeamAnalytics(scope, cycle, cycleType) {
        if (!scope.tenantId) {
            return {
                cycle,
                cycleType,
                summary: { employeeCount: 0, avgFinalScore: 0, avgOnTimeRate: 0, totalOverdueOpen: 0, atRiskCount: 0 },
                employees: [],
            };
        }
        const visible = await prisma_1.default.employee.findMany({
            where: { status: 'ACTIVE', ...(0, org_scope_service_1.employeeWhereFromScope)(scope) },
            select: { id: true },
        });
        return performanceCalculator_1.PerformanceCalculator.computeTeamAnalytics(cycle, cycleType, visible.map((e) => e.id));
    }
    static async refreshReview(scope, id) {
        const existing = await this.getById(scope, id);
        if (!existing)
            throw new Error('Review not found');
        const managerScore = existing.metrics?.managerScore || 0;
        const computed = await performanceCalculator_1.PerformanceCalculator.compute(existing.employeeId, existing.cycle, existing.cycleType, managerScore);
        const includeManager = managerScore > 0;
        const finalScore = (0, performanceCalculator_1.computeFinalScore)(computed.taskScore, computed.attendanceScore, computed.leaveScore, managerScore, includeManager);
        const metrics = {
            taskScore: computed.taskScore,
            attendanceScore: computed.attendanceScore,
            leaveScore: computed.leaveScore,
            managerScore,
            finalScore,
            category: (0, performanceCalculator_1.categoryFromScore)(includeManager ? finalScore : computed.breakdown.provisionalScore),
            breakdown: computed.breakdown,
        };
        return prisma_1.default.performanceReview.update({
            where: { id },
            data: {
                metrics,
                insights: computed.insights,
            },
            include: { employee: true },
        });
    }
    static async create(scope, data) {
        const empId = await this.resolveEmployeeId(data.employeeId, scope);
        const cycleType = (data.cycleType || 'quarterly');
        const computed = await performanceCalculator_1.PerformanceCalculator.compute(empId, data.cycle, cycleType, 0);
        const metrics = {
            taskScore: computed.taskScore,
            attendanceScore: computed.attendanceScore,
            leaveScore: computed.leaveScore,
            managerScore: 0,
            finalScore: computed.breakdown.provisionalScore,
            category: computed.category,
            breakdown: computed.breakdown,
        };
        return prisma_1.default.performanceReview.create({
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
    static async update(scope, id, data) {
        const existing = await this.getById(scope, id);
        if (!existing)
            throw new Error('Review not found');
        const nextMetrics = data.metrics
            ? { ...existing.metrics, ...data.metrics }
            : existing.metrics;
        return prisma_1.default.performanceReview.update({
            where: { id },
            data: {
                cycle: data.cycle ?? existing.cycle,
                cycleType: data.cycleType ?? existing.cycleType,
                metrics: nextMetrics,
                insights: data.insights
                    ? { ...existing.insights, ...data.insights }
                    : existing.insights,
                status: data.status ?? existing.status,
            },
        });
    }
    static async submitSelfReview(scope, id, data) {
        const existing = await this.getById(scope, id);
        if (!existing)
            throw new Error('Review not found');
        return prisma_1.default.performanceReview.update({
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
    static async submitManagerReview(scope, id, data) {
        const review = await this.getById(scope, id);
        if (!review)
            throw new Error('Review not found');
        const managerScore = data.rating * 20;
        const computed = await performanceCalculator_1.PerformanceCalculator.compute(review.employeeId, review.cycle, review.cycleType, managerScore);
        const finalScore = (0, performanceCalculator_1.computeFinalScore)(computed.taskScore, computed.attendanceScore, computed.leaveScore, managerScore, true);
        const metrics = {
            taskScore: computed.taskScore,
            attendanceScore: computed.attendanceScore,
            leaveScore: computed.leaveScore,
            managerScore,
            finalScore,
            category: (0, performanceCalculator_1.categoryFromScore)(finalScore),
            breakdown: computed.breakdown,
        };
        return prisma_1.default.performanceReview.update({
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
    static async delete(scope, id) {
        const existing = await this.getById(scope, id);
        if (!existing)
            throw new Error('Review not found');
        return prisma_1.default.performanceReview.delete({ where: { id } });
    }
}
exports.PerformanceService = PerformanceService;
//# sourceMappingURL=performance.service.js.map