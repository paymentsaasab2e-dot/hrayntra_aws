export type CycleType = 'monthly' | 'quarterly' | 'annual';
export declare const SCORE_WEIGHTS: {
    readonly task: 0.4;
    readonly attendance: 0.2;
    readonly leave: 0.2;
    readonly manager: 0.2;
};
export declare function getCycleDateRange(cycle: string, cycleType: CycleType): {
    start: Date;
    end: Date;
};
export declare function categoryFromScore(score: number): "Outstanding" | "Exceeds Expectations" | "Meets Expectations" | "Needs Improvement";
export declare function buildInsights(breakdown: any): {
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
};
export declare function computeFinalScore(taskScore: number, attendanceScore: number, leaveScore: number, managerScore: number, includeManager: boolean): number;
export declare class PerformanceCalculator {
    static compute(employeeMongoId: string, cycle: string, cycleType: CycleType, managerScore?: number): Promise<{
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
    static computeTeamAnalytics(cycle: string, cycleType: CycleType, employeeIds?: string[]): Promise<{
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
}
