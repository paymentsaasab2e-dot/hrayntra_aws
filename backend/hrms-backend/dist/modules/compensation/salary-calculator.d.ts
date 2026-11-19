export type SalaryComponentSection = 'EARNING' | 'DEDUCTION' | 'EMPLOYER_CONTRIBUTION';
export type SalaryCalcType = 'PERCENT_OF_ANCHOR' | 'PERCENT_OF_COMPONENT' | 'PERCENT_OF_GROSS' | 'FIXED' | 'BALANCE_OF_GROSS';
export type SalaryAnchorType = 'ANNUAL_CTC' | 'MONTHLY_CTC' | 'MONTHLY_GROSS';
export interface SalaryComponentRule {
    code: string;
    name: string;
    section: SalaryComponentSection;
    calcType: SalaryCalcType;
    value: number;
    baseRef?: string | null;
    cap?: number | null;
    order: number;
}
export interface ComputedLine {
    code: string;
    name: string;
    section: SalaryComponentSection;
    annual: number;
    monthly: number;
    calcType: SalaryCalcType;
    value: number;
    baseRef?: string | null;
}
export interface CompensationSnapshot {
    anchorType: SalaryAnchorType;
    anchorValue: number;
    currencyCode: string;
    lines: ComputedLine[];
    totals: {
        annualGross: number;
        monthlyGross: number;
        annualDeductions: number;
        monthlyDeductions: number;
        annualEmployerContributions: number;
        monthlyEmployerContributions: number;
        annualNet: number;
        monthlyNet: number;
        annualCtc: number;
        monthlyCtc: number;
    };
}
export declare function calculateCompensation(input: {
    anchorType: SalaryAnchorType;
    anchorValue: number;
    currencyCode?: string;
    components: SalaryComponentRule[];
    componentOverrides?: Record<string, number>;
}): CompensationSnapshot;
export declare function applyComponentOverrides(components: SalaryComponentRule[], overrides?: Record<string, number> | null): SalaryComponentRule[];
