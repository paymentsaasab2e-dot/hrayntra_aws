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

export const DEFAULT_COMPLIANCE_PROFILES: DefaultProfileSeed[] = [
  {
    name: 'India — Standard CTC',
    country: 'India',
    currencyCode: 'INR',
    anchorType: 'ANNUAL_CTC',
    isDefault: true,
    components: [
      { code: 'BASIC', name: 'Basic Salary', section: 'EARNING', calcType: 'PERCENT_OF_ANCHOR', value: 40, baseRef: 'ANCHOR', order: 1 },
      { code: 'HRA', name: 'House Rent Allowance', section: 'EARNING', calcType: 'PERCENT_OF_COMPONENT', value: 40, baseRef: 'BASIC', order: 2 },
      { code: 'CONVEYANCE', name: 'Conveyance', section: 'EARNING', calcType: 'FIXED', value: 1600, order: 3 },
      { code: 'SPECIAL', name: 'Special Allowance', section: 'EARNING', calcType: 'BALANCE_OF_GROSS', value: 0, order: 4 },
      { code: 'PF_EE', name: 'Employee PF', section: 'DEDUCTION', calcType: 'PERCENT_OF_COMPONENT', value: 12, baseRef: 'BASIC', cap: 1800, order: 5 },
      { code: 'PF_ER', name: 'Employer PF', section: 'EMPLOYER_CONTRIBUTION', calcType: 'PERCENT_OF_COMPONENT', value: 12, baseRef: 'BASIC', cap: 1800, order: 6 },
      { code: 'ESI_EE', name: 'Employee ESI', section: 'DEDUCTION', calcType: 'PERCENT_OF_GROSS', value: 0.75, order: 7 },
      { code: 'ESI_ER', name: 'Employer ESI', section: 'EMPLOYER_CONTRIBUTION', calcType: 'PERCENT_OF_GROSS', value: 3.25, order: 8 },
      { code: 'TDS', name: 'TDS (estimated)', section: 'DEDUCTION', calcType: 'PERCENT_OF_GROSS', value: 10, order: 9 },
    ],
  },
  {
    name: 'UAE — Standard Package',
    country: 'UAE',
    currencyCode: 'AED',
    anchorType: 'ANNUAL_CTC',
    isDefault: true,
    components: [
      { code: 'BASIC', name: 'Basic Salary', section: 'EARNING', calcType: 'PERCENT_OF_ANCHOR', value: 60, baseRef: 'ANCHOR', order: 1 },
      { code: 'HOUSING', name: 'Housing Allowance', section: 'EARNING', calcType: 'PERCENT_OF_COMPONENT', value: 25, baseRef: 'BASIC', order: 2 },
      { code: 'TRANSPORT', name: 'Transport Allowance', section: 'EARNING', calcType: 'FIXED', value: 500, order: 3 },
      { code: 'SPECIAL', name: 'Other Allowance', section: 'EARNING', calcType: 'BALANCE_OF_GROSS', value: 0, order: 4 },
      { code: 'GPSSA_EE', name: 'GPSSA Employee', section: 'DEDUCTION', calcType: 'PERCENT_OF_COMPONENT', value: 5, baseRef: 'BASIC', order: 5 },
      { code: 'GPSSA_ER', name: 'GPSSA Employer', section: 'EMPLOYER_CONTRIBUTION', calcType: 'PERCENT_OF_COMPONENT', value: 12.5, baseRef: 'BASIC', order: 6 },
    ],
  },
  {
    name: 'USA — Standard Package',
    country: 'USA',
    currencyCode: 'USD',
    anchorType: 'ANNUAL_CTC',
    isDefault: true,
    components: [
      { code: 'BASE', name: 'Base Salary', section: 'EARNING', calcType: 'PERCENT_OF_ANCHOR', value: 85, baseRef: 'ANCHOR', order: 1 },
      { code: 'BONUS', name: 'Variable Pay', section: 'EARNING', calcType: 'PERCENT_OF_ANCHOR', value: 15, baseRef: 'ANCHOR', order: 2 },
      { code: 'FED_TAX', name: 'Federal Tax (est.)', section: 'DEDUCTION', calcType: 'PERCENT_OF_GROSS', value: 12, order: 3 },
      { code: 'STATE_TAX', name: 'State Tax (est.)', section: 'DEDUCTION', calcType: 'PERCENT_OF_GROSS', value: 5, order: 4 },
      { code: '401K_EE', name: '401(k) Employee', section: 'DEDUCTION', calcType: 'PERCENT_OF_GROSS', value: 6, order: 5 },
      { code: '401K_ER', name: '401(k) Employer Match', section: 'EMPLOYER_CONTRIBUTION', calcType: 'PERCENT_OF_GROSS', value: 3, order: 6 },
    ],
  },
];
