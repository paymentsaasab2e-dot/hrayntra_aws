import { TenantHrRules } from '../policies/policy-rules';
export declare function calculateNoticePeriodDays(rules: TenantHrRules, probationEndDate?: Date | null, asOf?: Date): number;
export declare function addCalendarDays(from: Date, days: number): Date;
export declare function calculateShortfall(expectedLWD: Date, approvedLWD: Date): number;
export declare const DEFAULT_EXIT_CHECKLIST: {
    label: string;
    done: boolean;
}[];
