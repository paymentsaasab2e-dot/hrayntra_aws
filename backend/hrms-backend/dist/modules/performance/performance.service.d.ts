import { OrgScopeContext } from '../../shared/org/org-scope.service';
import { type CycleType } from './performanceCalculator';
export declare class PerformanceService {
    static resolveEmployeeId(employeeId: string, scope?: OrgScopeContext): Promise<string>;
    static getAll(scope: OrgScopeContext, filters?: any): Promise<({
        employee: {
            employeeId: string;
            firstName: string;
            lastName: string;
            designation: string;
            department: string;
        };
    } & {
        id: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        employeeId: string;
        cycle: string;
        cycleType: string;
        metrics: {
            taskScore: number;
            attendanceScore: number;
            leaveScore: number;
            managerScore: number;
            finalScore: number;
            category: string;
            breakdown: import("@prisma/client/runtime/library").JsonValue | null;
        };
        insights: {
            strengths: string[];
            weaknesses: string[];
            recommendations: string[];
        };
        selfAssessment: {
            submittedAt: string;
            rating: number;
            comments: string;
        } | null;
        managerAssessment: {
            submittedAt: string;
            managerId: string;
            rating: number;
            feedback: string;
        } | null;
    })[]>;
    static getById(scope: OrgScopeContext, id: string): Promise<({
        employee: {
            id: string;
            status: import(".prisma/client").$Enums.EmployeeStatus;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            tenantId: string | null;
            orgUnitId: string | null;
            employeeId: string;
            firstName: string;
            lastName: string;
            userId: string | null;
            phone: string | null;
            designation: string;
            department: string;
            joiningDate: Date;
            locationId: string | null;
            reportsToUserId: string | null;
            totalLeaves: number;
            probationEndDate: Date | null;
        };
    } & {
        id: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        employeeId: string;
        cycle: string;
        cycleType: string;
        metrics: {
            taskScore: number;
            attendanceScore: number;
            leaveScore: number;
            managerScore: number;
            finalScore: number;
            category: string;
            breakdown: import("@prisma/client/runtime/library").JsonValue | null;
        };
        insights: {
            strengths: string[];
            weaknesses: string[];
            recommendations: string[];
        };
        selfAssessment: {
            submittedAt: string;
            rating: number;
            comments: string;
        } | null;
        managerAssessment: {
            submittedAt: string;
            managerId: string;
            rating: number;
            feedback: string;
        } | null;
    }) | null>;
    static getByEmployee(scope: OrgScopeContext, employeeId: string): Promise<{
        id: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        employeeId: string;
        cycle: string;
        cycleType: string;
        metrics: {
            taskScore: number;
            attendanceScore: number;
            leaveScore: number;
            managerScore: number;
            finalScore: number;
            category: string;
            breakdown: import("@prisma/client/runtime/library").JsonValue | null;
        };
        insights: {
            strengths: string[];
            weaknesses: string[];
            recommendations: string[];
        };
        selfAssessment: {
            submittedAt: string;
            rating: number;
            comments: string;
        } | null;
        managerAssessment: {
            submittedAt: string;
            managerId: string;
            rating: number;
            feedback: string;
        } | null;
    }[]>;
    static computeForEmployee(scope: OrgScopeContext, employeeId: string, cycle: string, cycleType: CycleType, managerScore?: number): Promise<{
        taskScore: number;
        attendanceScore: number;
        leaveScore: number;
        managerScore: number;
        finalScore: number;
        category: string;
        breakdown: {
            task: {
                assigned: number;
                completed: number;
                onTime: number;
                early: number;
                lateCompleted: number;
                overdueOpen: number;
                completionRate: number;
                onTimeRate: number;
                earlyRate: number;
                overduePenaltyRate: number;
                avgCycleTimeDays: number;
                avgDelayDays: number;
                approvalPassRate: number;
                projectCompletedRate: number;
                urgentOverdueRate: number;
            };
            attendance: {
                workingDays: number;
                presentDays: number;
                lateDays: number;
                absentDays: number;
                rejectedPunches: number;
                avgDurationMinutes: number;
                attendanceRate: number;
                punctualityRate: number;
            };
            leave: {
                totalRequests: number;
                approvedDays: any;
                rejectedCount: number;
                pendingCount: number;
                unplannedSickDays: any;
                planningScore: number;
                stabilityScore: number;
            };
            weights: {
                readonly task: 0.4;
                readonly attendance: 0.2;
                readonly leave: 0.2;
                readonly manager: 0.2;
            };
            cycleWindow: {
                start: string;
                end: string;
            };
            provisionalScore: number;
        };
        insights: {
            strengths: string[];
            weaknesses: string[];
            recommendations: string[];
        };
    }>;
    static computeTeamAnalytics(scope: OrgScopeContext, cycle: string, cycleType: CycleType): Promise<{
        cycle: string;
        cycleType: CycleType;
        summary: {
            employeeCount: number;
            avgFinalScore: number;
            avgOnTimeRate: number;
            totalOverdueOpen: number;
            atRiskCount: number;
        };
        employees: {
            taskScore: number;
            attendanceScore: number;
            leaveScore: number;
            managerScore: number;
            finalScore: number;
            category: string;
            breakdown: {
                task: {
                    assigned: number;
                    completed: number;
                    onTime: number;
                    early: number;
                    lateCompleted: number;
                    overdueOpen: number;
                    completionRate: number;
                    onTimeRate: number;
                    earlyRate: number;
                    overduePenaltyRate: number;
                    avgCycleTimeDays: number;
                    avgDelayDays: number;
                    approvalPassRate: number;
                    projectCompletedRate: number;
                    urgentOverdueRate: number;
                };
                attendance: {
                    workingDays: number;
                    presentDays: number;
                    lateDays: number;
                    absentDays: number;
                    rejectedPunches: number;
                    avgDurationMinutes: number;
                    attendanceRate: number;
                    punctualityRate: number;
                };
                leave: {
                    totalRequests: number;
                    approvedDays: any;
                    rejectedCount: number;
                    pendingCount: number;
                    unplannedSickDays: any;
                    planningScore: number;
                    stabilityScore: number;
                };
                weights: {
                    readonly task: 0.4;
                    readonly attendance: 0.2;
                    readonly leave: 0.2;
                    readonly manager: 0.2;
                };
                cycleWindow: {
                    start: string;
                    end: string;
                };
                provisionalScore: number;
            };
            insights: {
                strengths: string[];
                weaknesses: string[];
                recommendations: string[];
            };
            employeeId: string;
            employeeMongoId: string;
            name: string;
        }[];
    }>;
    static refreshReview(scope: OrgScopeContext, id: string): Promise<{
        employee: {
            id: string;
            status: import(".prisma/client").$Enums.EmployeeStatus;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            tenantId: string | null;
            orgUnitId: string | null;
            employeeId: string;
            firstName: string;
            lastName: string;
            userId: string | null;
            phone: string | null;
            designation: string;
            department: string;
            joiningDate: Date;
            locationId: string | null;
            reportsToUserId: string | null;
            totalLeaves: number;
            probationEndDate: Date | null;
        };
    } & {
        id: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        employeeId: string;
        cycle: string;
        cycleType: string;
        metrics: {
            taskScore: number;
            attendanceScore: number;
            leaveScore: number;
            managerScore: number;
            finalScore: number;
            category: string;
            breakdown: import("@prisma/client/runtime/library").JsonValue | null;
        };
        insights: {
            strengths: string[];
            weaknesses: string[];
            recommendations: string[];
        };
        selfAssessment: {
            submittedAt: string;
            rating: number;
            comments: string;
        } | null;
        managerAssessment: {
            submittedAt: string;
            managerId: string;
            rating: number;
            feedback: string;
        } | null;
    }>;
    static create(scope: OrgScopeContext, data: any): Promise<{
        employee: {
            employeeId: string;
            firstName: string;
            lastName: string;
            designation: string;
            department: string;
        };
    } & {
        id: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        employeeId: string;
        cycle: string;
        cycleType: string;
        metrics: {
            taskScore: number;
            attendanceScore: number;
            leaveScore: number;
            managerScore: number;
            finalScore: number;
            category: string;
            breakdown: import("@prisma/client/runtime/library").JsonValue | null;
        };
        insights: {
            strengths: string[];
            weaknesses: string[];
            recommendations: string[];
        };
        selfAssessment: {
            submittedAt: string;
            rating: number;
            comments: string;
        } | null;
        managerAssessment: {
            submittedAt: string;
            managerId: string;
            rating: number;
            feedback: string;
        } | null;
    }>;
    static update(scope: OrgScopeContext, id: string, data: any): Promise<{
        id: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        employeeId: string;
        cycle: string;
        cycleType: string;
        metrics: {
            taskScore: number;
            attendanceScore: number;
            leaveScore: number;
            managerScore: number;
            finalScore: number;
            category: string;
            breakdown: import("@prisma/client/runtime/library").JsonValue | null;
        };
        insights: {
            strengths: string[];
            weaknesses: string[];
            recommendations: string[];
        };
        selfAssessment: {
            submittedAt: string;
            rating: number;
            comments: string;
        } | null;
        managerAssessment: {
            submittedAt: string;
            managerId: string;
            rating: number;
            feedback: string;
        } | null;
    }>;
    static submitSelfReview(scope: OrgScopeContext, id: string, data: any): Promise<{
        id: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        employeeId: string;
        cycle: string;
        cycleType: string;
        metrics: {
            taskScore: number;
            attendanceScore: number;
            leaveScore: number;
            managerScore: number;
            finalScore: number;
            category: string;
            breakdown: import("@prisma/client/runtime/library").JsonValue | null;
        };
        insights: {
            strengths: string[];
            weaknesses: string[];
            recommendations: string[];
        };
        selfAssessment: {
            submittedAt: string;
            rating: number;
            comments: string;
        } | null;
        managerAssessment: {
            submittedAt: string;
            managerId: string;
            rating: number;
            feedback: string;
        } | null;
    }>;
    static submitManagerReview(scope: OrgScopeContext, id: string, data: any): Promise<{
        employee: {
            id: string;
            status: import(".prisma/client").$Enums.EmployeeStatus;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            tenantId: string | null;
            orgUnitId: string | null;
            employeeId: string;
            firstName: string;
            lastName: string;
            userId: string | null;
            phone: string | null;
            designation: string;
            department: string;
            joiningDate: Date;
            locationId: string | null;
            reportsToUserId: string | null;
            totalLeaves: number;
            probationEndDate: Date | null;
        };
    } & {
        id: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        employeeId: string;
        cycle: string;
        cycleType: string;
        metrics: {
            taskScore: number;
            attendanceScore: number;
            leaveScore: number;
            managerScore: number;
            finalScore: number;
            category: string;
            breakdown: import("@prisma/client/runtime/library").JsonValue | null;
        };
        insights: {
            strengths: string[];
            weaknesses: string[];
            recommendations: string[];
        };
        selfAssessment: {
            submittedAt: string;
            rating: number;
            comments: string;
        } | null;
        managerAssessment: {
            submittedAt: string;
            managerId: string;
            rating: number;
            feedback: string;
        } | null;
    }>;
    static delete(scope: OrgScopeContext, id: string): Promise<{
        id: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        employeeId: string;
        cycle: string;
        cycleType: string;
        metrics: {
            taskScore: number;
            attendanceScore: number;
            leaveScore: number;
            managerScore: number;
            finalScore: number;
            category: string;
            breakdown: import("@prisma/client/runtime/library").JsonValue | null;
        };
        insights: {
            strengths: string[];
            weaknesses: string[];
            recommendations: string[];
        };
        selfAssessment: {
            submittedAt: string;
            rating: number;
            comments: string;
        } | null;
        managerAssessment: {
            submittedAt: string;
            managerId: string;
            rating: number;
            feedback: string;
        } | null;
    }>;
}
