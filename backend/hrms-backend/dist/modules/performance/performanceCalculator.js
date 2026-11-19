"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerformanceCalculator = exports.SCORE_WEIGHTS = void 0;
exports.getCycleDateRange = getCycleDateRange;
exports.categoryFromScore = categoryFromScore;
exports.buildInsights = buildInsights;
exports.computeFinalScore = computeFinalScore;
const prisma_1 = __importDefault(require("../../shared/prisma"));
const policy_rules_1 = require("../policies/policy-rules");
const policy_service_1 = require("../policies/policy.service");
exports.SCORE_WEIGHTS = {
    task: 0.4,
    attendance: 0.2,
    leave: 0.2,
    manager: 0.2,
};
function clamp(min, max, value) {
    return Math.min(max, Math.max(min, value));
}
function round1(value) {
    return Math.round(value * 10) / 10;
}
function getCycleDateRange(cycle, cycleType) {
    if (cycleType === 'monthly') {
        const [year, month] = cycle.split('-').map(Number);
        const start = new Date(year, (month || 1) - 1, 1);
        const end = new Date(year, month || 1, 0, 23, 59, 59, 999);
        return { start, end };
    }
    if (cycleType === 'quarterly') {
        const match = cycle.match(/^(\d{4})-Q([1-4])$/i);
        const year = Number(match?.[1] || new Date().getFullYear());
        const quarter = Number(match?.[2] || 1);
        const startMonth = (quarter - 1) * 3;
        const start = new Date(year, startMonth, 1);
        const end = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
        return { start, end };
    }
    const year = Number(cycle) || new Date().getFullYear();
    return {
        start: new Date(year, 0, 1),
        end: new Date(year, 11, 31, 23, 59, 59, 999),
    };
}
function categoryFromScore(score) {
    if (score >= 90)
        return 'Outstanding';
    if (score >= 75)
        return 'Exceeds Expectations';
    if (score >= 60)
        return 'Meets Expectations';
    return 'Needs Improvement';
}
function countWeekdaysBetween(start, end, workWeek) {
    let count = 0;
    const cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);
    const limit = new Date(end);
    limit.setHours(23, 59, 59, 999);
    while (cursor <= limit) {
        if (workWeek) {
            if (!(0, policy_rules_1.isDateWeekOff)(cursor, workWeek))
                count += 1;
        }
        else {
            const day = cursor.getDay();
            if (day !== 0 && day !== 6)
                count += 1;
        }
        cursor.setDate(cursor.getDate() + 1);
    }
    return count;
}
function daysBetween(a, b) {
    return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
}
function taskAssignedToEmployee(task, employeeMongoId) {
    if (task.assignedTo === employeeMongoId)
        return true;
    return Array.isArray(task.assigneeIds) && task.assigneeIds.includes(employeeMongoId);
}
function computeTaskMetrics(tasks, now) {
    const assignedCount = tasks.length;
    const completed = tasks.filter((t) => t.status === 'DONE');
    const completedCount = completed.length;
    const withDue = completed.filter((t) => t.dueDate);
    const onTimeCount = withDue.filter((t) => t.completedAt && new Date(t.completedAt) <= new Date(t.dueDate)).length;
    const earlyCount = withDue.filter((t) => {
        if (!t.completedAt || !t.dueDate)
            return false;
        return daysBetween(new Date(t.completedAt), new Date(t.dueDate)) <= -2;
    }).length;
    const lateCompletedCount = withDue.filter((t) => t.completedAt && new Date(t.completedAt) > new Date(t.dueDate)).length;
    const overdueOpenCount = tasks.filter((t) => t.status !== 'DONE' && t.dueDate && new Date(t.dueDate) < now).length;
    const cycleTimes = completed
        .filter((t) => t.completedAt)
        .map((t) => daysBetween(new Date(t.createdAt), new Date(t.completedAt)));
    const avgCycleTimeDays = cycleTimes.length
        ? round1(cycleTimes.reduce((sum, v) => sum + v, 0) / cycleTimes.length)
        : 0;
    const delayDays = withDue
        .filter((t) => t.completedAt && new Date(t.completedAt) > new Date(t.dueDate))
        .map((t) => daysBetween(new Date(t.dueDate), new Date(t.completedAt)));
    const avgDelayDays = delayDays.length
        ? round1(delayDays.reduce((sum, v) => sum + v, 0) / delayDays.length)
        : 0;
    const submittedForApproval = tasks.filter((t) => ['PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'Pending Approval', 'Approved', 'Changes Requested'].includes(String(t.approvalStatus || '')));
    const approvedCount = tasks.filter((t) => ['APPROVED', 'Approved'].includes(String(t.approvalStatus || ''))).length;
    const approvalPassRate = submittedForApproval.length
        ? approvedCount / submittedForApproval.length
        : 1;
    const projectTasks = tasks.filter((t) => t.projectId);
    const projectCompleted = projectTasks.filter((t) => t.status === 'DONE').length;
    const projectCompletedRate = projectTasks.length ? projectCompleted / projectTasks.length : 1;
    const urgentTasks = tasks.filter((t) => ['HIGH', 'URGENT'].includes(String(t.priority || '')));
    const urgentOverdue = urgentTasks.filter((t) => t.status !== 'DONE' && t.dueDate && new Date(t.dueDate) < now).length;
    const urgentOverdueRate = urgentTasks.length ? urgentOverdue / urgentTasks.length : 0;
    const completionRate = assignedCount ? completedCount / assignedCount : 0;
    const onTimeRate = completedCount ? onTimeCount / completedCount : 0;
    const earlyRate = completedCount ? earlyCount / completedCount : 0;
    const overduePenalty = Math.min(1, (lateCompletedCount + overdueOpenCount) / Math.max(assignedCount, 1));
    const taskScore = clamp(0, 100, completionRate * 30 +
        onTimeRate * 30 +
        earlyRate * 10 +
        approvalPassRate * 10 +
        (1 - overduePenalty) * 20);
    return {
        taskScore: Math.round(taskScore),
        breakdown: {
            assigned: assignedCount,
            completed: completedCount,
            onTime: onTimeCount,
            early: earlyCount,
            lateCompleted: lateCompletedCount,
            overdueOpen: overdueOpenCount,
            completionRate: round1(completionRate * 100),
            onTimeRate: round1(onTimeRate * 100),
            earlyRate: round1(earlyRate * 100),
            overduePenaltyRate: round1(overduePenalty * 100),
            avgCycleTimeDays,
            avgDelayDays,
            approvalPassRate: round1(approvalPassRate * 100),
            projectCompletedRate: round1(projectCompletedRate * 100),
            urgentOverdueRate: round1(urgentOverdueRate * 100),
        },
    };
}
function computeAttendanceMetrics(records, start, end, workWeek) {
    const workingDays = Math.max(1, countWeekdaysBetween(start, end, workWeek));
    const presentDays = records.filter((r) => ['PRESENT', 'LATE', 'HALFDAY'].includes(String(r.status))).length;
    const lateDays = records.filter((r) => String(r.status) === 'LATE').length;
    const absentDays = Math.max(0, workingDays - presentDays);
    const rejectedPunches = records.filter((r) => String(r.punchStatus) === 'REJECTED').length;
    const durations = records
        .filter((r) => r.checkInTime && r.checkOutTime)
        .map((r) => (new Date(r.checkOutTime).getTime() - new Date(r.checkInTime).getTime()) / 60000);
    const avgDurationMinutes = durations.length
        ? Math.round(durations.reduce((sum, v) => sum + v, 0) / durations.length)
        : 0;
    const attendanceRate = presentDays / workingDays;
    const punctualityRate = presentDays ? 1 - lateDays / presentDays : 1;
    const reliabilityRate = presentDays ? 1 - rejectedPunches / presentDays : 1;
    const attendanceScore = clamp(0, 100, attendanceRate * 50 + punctualityRate * 30 + reliabilityRate * 20);
    return {
        attendanceScore: Math.round(attendanceScore),
        breakdown: {
            workingDays,
            presentDays,
            lateDays,
            absentDays,
            rejectedPunches,
            avgDurationMinutes,
            attendanceRate: round1(attendanceRate * 100),
            punctualityRate: round1(punctualityRate * 100),
        },
    };
}
function computeLeaveMetrics(leaves) {
    const totalRequests = leaves.length;
    const approvedDays = leaves
        .filter((l) => String(l.status) === 'APPROVED')
        .reduce((sum, l) => {
        const start = new Date(l.startDate);
        const end = new Date(l.endDate);
        return sum + Math.max(1, Math.ceil(daysBetween(start, end)) + 1);
    }, 0);
    const rejectedCount = leaves.filter((l) => String(l.status) === 'REJECTED').length;
    const pendingCount = leaves.filter((l) => String(l.status) === 'PENDING').length;
    const unplannedSickDays = leaves
        .filter((l) => String(l.type) === 'SICK' && String(l.status) === 'APPROVED')
        .filter((l) => daysBetween(new Date(l.appliedAt || l.createdAt), new Date(l.startDate)) < 2)
        .reduce((sum, l) => {
        const start = new Date(l.startDate);
        const end = new Date(l.endDate);
        return sum + Math.max(1, Math.ceil(daysBetween(start, end)) + 1);
    }, 0);
    const planningScore = 1 - Math.min(1, rejectedCount / Math.max(totalRequests, 1));
    const stabilityScore = 1 - Math.min(1, unplannedSickDays / 10);
    const leaveScore = clamp(0, 100, planningScore * 60 + stabilityScore * 40);
    return {
        leaveScore: Math.round(leaveScore),
        breakdown: {
            totalRequests,
            approvedDays,
            rejectedCount,
            pendingCount,
            unplannedSickDays,
            planningScore: round1(planningScore * 100),
            stabilityScore: round1(stabilityScore * 100),
        },
    };
}
function buildInsights(breakdown) {
    const strengths = [];
    const weaknesses = [];
    const recommendations = [];
    if (breakdown.task?.onTimeRate >= 85) {
        strengths.push(`${breakdown.task.onTimeRate}% on-time task delivery`);
    }
    if (breakdown.task?.completionRate >= 80) {
        strengths.push(`Strong completion rate at ${breakdown.task.completionRate}%`);
    }
    if (breakdown.attendance?.punctualityRate >= 90) {
        strengths.push(`Excellent punctuality (${breakdown.attendance.punctualityRate}%)`);
    }
    if (breakdown.task?.overdueOpen > 0) {
        weaknesses.push(`${breakdown.task.overdueOpen} overdue task(s) still open`);
        recommendations.push('Close overdue tasks within 48 hours or renegotiate deadlines');
    }
    if (breakdown.task?.onTimeRate < 70) {
        weaknesses.push(`On-time delivery below target (${breakdown.task.onTimeRate}%)`);
        recommendations.push('Review task planning and prioritize due dates');
    }
    if (breakdown.attendance?.lateDays > 3) {
        weaknesses.push(`${breakdown.attendance.lateDays} late attendance marks`);
        recommendations.push('Improve check-in punctuality during the next cycle');
    }
    if (breakdown.leave?.rejectedCount > 0) {
        weaknesses.push(`${breakdown.leave.rejectedCount} rejected leave request(s)`);
        recommendations.push('Submit leave requests earlier with complete details');
    }
    if (strengths.length === 0)
        strengths.push('Consistent participation across tracked activities');
    if (weaknesses.length === 0)
        weaknesses.push('No major performance risks detected this cycle');
    if (recommendations.length === 0)
        recommendations.push('Maintain current delivery and attendance standards');
    return { strengths, weaknesses, recommendations };
}
function computeFinalScore(taskScore, attendanceScore, leaveScore, managerScore, includeManager) {
    if (!includeManager || managerScore <= 0) {
        return Math.round(taskScore * 0.5 + attendanceScore * 0.25 + leaveScore * 0.25);
    }
    return Math.round(taskScore * exports.SCORE_WEIGHTS.task +
        attendanceScore * exports.SCORE_WEIGHTS.attendance +
        leaveScore * exports.SCORE_WEIGHTS.leave +
        managerScore * exports.SCORE_WEIGHTS.manager);
}
class PerformanceCalculator {
    static async compute(employeeMongoId, cycle, cycleType, managerScore = 0) {
        const { start, end } = getCycleDateRange(cycle, cycleType);
        const now = new Date();
        const allTasks = await prisma_1.default.task.findMany({
            where: {
                createdAt: { gte: start, lte: end },
                OR: [{ assignedTo: employeeMongoId }, { assigneeIds: { has: employeeMongoId } }],
            },
        });
        const tasks = allTasks.filter((t) => taskAssignedToEmployee(t, employeeMongoId));
        const attendanceRecords = await prisma_1.default.attendance.findMany({
            where: {
                employeeId: employeeMongoId,
                date: { gte: start, lte: end },
            },
        });
        const leaves = await prisma_1.default.leave.findMany({
            where: {
                employeeId: employeeMongoId,
                appliedAt: { gte: start, lte: end },
            },
        });
        const emp = await prisma_1.default.employee.findUnique({
            where: { id: employeeMongoId },
            select: { tenantId: true },
        });
        const rules = emp?.tenantId ? await policy_service_1.PolicyService.getActiveRules(emp.tenantId) : null;
        const taskMetrics = computeTaskMetrics(tasks, now);
        const attendanceMetrics = computeAttendanceMetrics(attendanceRecords, start, end, rules?.workWeek);
        const leaveMetrics = computeLeaveMetrics(leaves);
        const breakdown = {
            task: taskMetrics.breakdown,
            attendance: attendanceMetrics.breakdown,
            leave: leaveMetrics.breakdown,
            weights: exports.SCORE_WEIGHTS,
            cycleWindow: { start: start.toISOString(), end: end.toISOString() },
            provisionalScore: computeFinalScore(taskMetrics.taskScore, attendanceMetrics.attendanceScore, leaveMetrics.leaveScore, 0, false),
        };
        const includeManager = managerScore > 0;
        const finalScore = computeFinalScore(taskMetrics.taskScore, attendanceMetrics.attendanceScore, leaveMetrics.leaveScore, managerScore, includeManager);
        const insights = buildInsights(breakdown);
        return {
            taskScore: taskMetrics.taskScore,
            attendanceScore: attendanceMetrics.attendanceScore,
            leaveScore: leaveMetrics.leaveScore,
            managerScore,
            finalScore,
            category: categoryFromScore(includeManager ? finalScore : breakdown.provisionalScore),
            breakdown,
            insights,
        };
    }
    static async computeTeamAnalytics(cycle, cycleType, employeeIds) {
        const employees = await prisma_1.default.employee.findMany({
            where: {
                status: 'ACTIVE',
                ...(employeeIds ? { id: { in: employeeIds } } : { id: { in: [] } }),
            },
            select: { id: true, employeeId: true, firstName: true, lastName: true },
        });
        const results = [];
        for (const emp of employees) {
            const metrics = await this.compute(emp.id, cycle, cycleType);
            results.push({
                employeeId: emp.employeeId,
                employeeMongoId: emp.id,
                name: `${emp.firstName} ${emp.lastName}`,
                ...metrics,
            });
        }
        const avgFinalScore = results.length
            ? Math.round(results.reduce((sum, r) => sum + (r.breakdown?.provisionalScore || r.finalScore), 0) / results.length)
            : 0;
        const avgOnTimeRate = results.length
            ? round1(results.reduce((sum, r) => sum + (r.breakdown?.task?.onTimeRate || 0), 0) / results.length)
            : 0;
        const totalOverdueOpen = results.reduce((sum, r) => sum + (r.breakdown?.task?.overdueOpen || 0), 0);
        const atRisk = results.filter((r) => (r.breakdown?.provisionalScore || r.finalScore) < 60).length;
        return {
            cycle,
            cycleType,
            summary: {
                employeeCount: results.length,
                avgFinalScore,
                avgOnTimeRate,
                totalOverdueOpen,
                atRiskCount: atRisk,
            },
            employees: results,
        };
    }
}
exports.PerformanceCalculator = PerformanceCalculator;
//# sourceMappingURL=performanceCalculator.js.map