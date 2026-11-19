import { SalaryComponentRule } from './salary-calculator';
export interface DefaultProfileSeed {
    name: string;
    country: string;
    region?: string;
    city?: string;
    locality?: string;
    currencyCode: string;
    anchorType: 'ANNUAL_CTC' | 'MONTHLY_CTC' | 'MONTHLY_GROSS';
    isDefault?: boolean;
    components: SalaryComponentRule[];
}
export declare const DEFAULT_COMPLIANCE_PROFILES: DefaultProfileSeed[];
