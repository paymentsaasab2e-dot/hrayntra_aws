import catalog from './countryCatalog.json';

export type PeopleCorePayrollCapability = 'unavailable' | 'export' | 'calculate';

export type FieldSpec = { id: string; label: string; required?: boolean };

export type CountryPack = {
  iso: string;
  name: string;
  currency: string;
  timezone: string;
  locale: string;
  dateFormat: string;
  payrollCapability: PeopleCorePayrollCapability;
  payrollNote: string;
  identityFields: FieldSpec[];
  companyIdentifierFields: FieldSpec[];
  bankFields: FieldSpec[];
  leaveTypes: Array<{ id: string; code: string; label: string; paid: boolean }>;
  holidays: Array<{ date: string; name: string }>;
  onboardingItems: Array<{ id: string; label: string }>;
  letterTypes: Array<{ id: string; label: string }>;
  neverFallbackTo: string[];
};

export const COUNTRY_PACKS: Record<string, CountryPack> = {
  CM: {
    iso: 'CM',
    name: 'Cameroon',
    currency: 'XAF',
    timezone: 'Africa/Douala',
    locale: 'fr-CM',
    dateFormat: 'DD/MM/YYYY',
    payrollCapability: 'export',
    payrollNote: 'Cameroon pack is payroll export-only. No CNPS calculation or payslips until a local engine is certified.',
    identityFields: [
      { id: 'niu', label: 'NIU' },
      { id: 'cnpsNumber', label: 'CNPS number' },
    ],
    companyIdentifierFields: [
      { id: 'niu', label: 'NIU (employeur)' },
      { id: 'cnpsEmployerNumber', label: 'N° CNPS employeur' },
      { id: 'tradeRegister', label: 'Registre du commerce' },
    ],
    bankFields: [
      { id: 'rib', label: 'RIB' },
      { id: 'bankName', label: 'Banque' },
      { id: 'accountName', label: 'Titulaire' },
    ],
    leaveTypes: [
      { id: 'annual', code: 'CONGE_ANNUEL', label: 'Congé annuel', paid: true },
      { id: 'sick', code: 'MALADIE', label: 'Maladie', paid: true },
      { id: 'maternity', code: 'MATERNITE', label: 'Maternité', paid: true },
      { id: 'unpaid', code: 'SANS_SOLDE', label: 'Sans solde', paid: false },
    ],
    holidays: [
      { date: '01-01', name: "Jour de l'An" },
      { date: '05-01', name: 'Fête du Travail' },
      { date: '05-20', name: 'Fête Nationale' },
      { date: '08-15', name: 'Assomption' },
      { date: '12-25', name: 'Noël' },
    ],
    onboardingItems: [
      { id: 'contrat', label: 'Contrat de travail signé' },
      { id: 'cnps_file', label: 'Dossier CNPS' },
      { id: 'id_copy', label: "Copie de pièce d'identité" },
    ],
    letterTypes: [
      { id: 'contrat_de_travail', label: 'Contrat de travail' },
      { id: 'avenant', label: 'Avenant' },
      { id: 'certificat_de_travail', label: 'Certificat de travail' },
    ],
    neverFallbackTo: ['IN-PF', 'IN-ESI', 'IN-PT', 'IN-PAN', 'IN-CL'],
  },
  IN: {
    iso: 'IN',
    name: 'India',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    locale: 'en-IN',
    dateFormat: 'DD/MM/YYYY',
    payrollCapability: 'calculate',
    payrollNote: 'India pack calculates PF/ESI in Phase 4 after attendance lock. Phase 3 stores CTC only.',
    identityFields: [
      { id: 'pan', label: 'PAN' },
      { id: 'aadhaar', label: 'Aadhaar' },
      { id: 'uan', label: 'UAN' },
      { id: 'pfNumber', label: 'PF number' },
      { id: 'esiNumber', label: 'ESI number' },
    ],
    companyIdentifierFields: [
      { id: 'pan', label: 'PAN' },
      { id: 'tan', label: 'TAN' },
      { id: 'gstin', label: 'GSTIN' },
      { id: 'pfEstablishment', label: 'PF establishment' },
      { id: 'esiEstablishment', label: 'ESI establishment' },
    ],
    bankFields: [
      { id: 'ifsc', label: 'IFSC' },
      { id: 'accountNumber', label: 'Account number' },
      { id: 'accountName', label: 'Account name' },
      { id: 'bankName', label: 'Bank' },
    ],
    leaveTypes: [
      { id: 'cl', code: 'CL', label: 'Casual leave', paid: true },
      { id: 'sl', code: 'SL', label: 'Sick leave', paid: true },
      { id: 'el', code: 'EL', label: 'Earned leave', paid: true },
      { id: 'maternity', code: 'MATERNITY', label: 'Maternity', paid: true },
      { id: 'paternity', code: 'PATERNITY', label: 'Paternity', paid: true },
      { id: 'lop', code: 'LOP', label: 'Loss of pay', paid: false },
    ],
    holidays: [
      { date: '01-26', name: 'Republic Day' },
      { date: '08-15', name: 'Independence Day' },
      { date: '10-02', name: 'Gandhi Jayanti' },
    ],
    onboardingItems: [
      { id: 'pan_copy', label: 'PAN copy' },
      { id: 'aadhaar_copy', label: 'Aadhaar copy' },
      { id: 'bank_proof', label: 'Bank proof' },
      { id: 'photo', label: 'Photograph' },
    ],
    letterTypes: [
      { id: 'offer', label: 'Offer' },
      { id: 'appointment', label: 'Appointment' },
      { id: 'confirmation', label: 'Confirmation' },
      { id: 'relieving', label: 'Relieving' },
      { id: 'experience', label: 'Experience' },
      { id: 'increment', label: 'Increment' },
    ],
    neverFallbackTo: [],
  },
  US: {
    iso: 'US',
    name: 'United States',
    currency: 'USD',
    timezone: 'America/New_York',
    locale: 'en-US',
    dateFormat: 'MM/DD/YYYY',
    payrollCapability: 'unavailable',
    payrollNote: 'US pack is a PTO bank (paid time off, sick, unpaid). Payroll is not certified. Pay is not calculated.',
    identityFields: [{ id: 'ssnLast4', label: 'SSN last 4' }],
    companyIdentifierFields: [{ id: 'ein', label: 'EIN' }],
    bankFields: [
      { id: 'routingNumber', label: 'Routing number' },
      { id: 'accountNumber', label: 'Account number' },
      { id: 'accountName', label: 'Account name' },
    ],
    leaveTypes: [
      { id: 'pto', code: 'PTO', label: 'Paid time off', paid: true },
      { id: 'sick', code: 'SICK', label: 'Sick leave', paid: true },
      { id: 'unpaid', code: 'UNPAID', label: 'Unpaid leave', paid: false },
    ],
    holidays: [
      { date: '01-01', name: "New Year's Day" },
      { date: '07-04', name: 'Independence Day' },
      { date: '12-25', name: 'Christmas Day' },
    ],
    onboardingItems: [
      { id: 'i9', label: 'I-9 eligibility' },
      { id: 'w4', label: 'W-4' },
      { id: 'bank_proof', label: 'Bank details' },
    ],
    letterTypes: [
      { id: 'offer', label: 'Offer' },
      { id: 'employment_certificate', label: 'Employment certificate' },
      { id: 'exit_letter', label: 'Exit letter' },
    ],
    neverFallbackTo: ['IN-PF', 'IN-ESI', 'IN-PT', 'IN-PAN', 'IN-CL', 'IN-SL', 'IN-EL'],
  },
};

export const ENGAGEMENT_TYPES = [
  'EMPLOYEE',
  'INTERN',
  'CONTRACTOR',
  'CONSULTANT',
  'TRAINEE',
] as const;

export const EMPLOYEE_STATUSES = [
  'PREBOARDING',
  'READY',
  'JOINED',
  'ACTIVE',
  'DEFERRED',
  'NO_SHOW',
  'EXITED',
] as const;

export function listCountryPacks(): CountryPack[] {
  const rest = Object.keys(catalog)
    .filter((iso) => iso !== 'CM' && iso !== 'IN' && iso !== 'US')
    .map((iso) => getCountryPack(iso) as CountryPack)
    .sort((a, b) => a.name.localeCompare(b.name));
  return [COUNTRY_PACKS.CM, COUNTRY_PACKS.IN, COUNTRY_PACKS.US, ...rest];
}

function genericPack(iso: string, meta: { name: string; currency: string; timezone: string; locale: string }): CountryPack {
  return {
    iso,
    name: meta.name,
    currency: meta.currency,
    timezone: meta.timezone,
    locale: meta.locale,
    dateFormat: 'DD/MM/YYYY',
    payrollCapability: 'unavailable',
    payrollNote: `Payroll is not certified for ${meta.name}. Hire, attendance, leave, and exit work. Pay is not calculated.`,
    identityFields: [{ id: 'nationalId', label: 'National ID' }],
    companyIdentifierFields: [{ id: 'registrationNumber', label: 'Company registration' }],
    bankFields: [
      { id: 'accountNumber', label: 'Account number' },
      { id: 'bankName', label: 'Bank' },
      { id: 'accountName', label: 'Account name' },
    ],
    leaveTypes: [
      { id: 'annual', code: 'ANNUAL', label: 'Annual leave', paid: true },
      { id: 'sick', code: 'SICK', label: 'Sick leave', paid: true },
      { id: 'unpaid', code: 'UNPAID', label: 'Unpaid leave', paid: false },
    ],
    holidays: [{ date: '01-01', name: "New Year's Day" }],
    onboardingItems: [
      { id: 'contract', label: 'Signed employment contract' },
      { id: 'id_copy', label: 'Identity document' },
      { id: 'bank_proof', label: 'Bank details' },
    ],
    letterTypes: [
      { id: 'offer', label: 'Offer' },
      { id: 'employment_certificate', label: 'Employment certificate' },
      { id: 'exit_letter', label: 'Exit letter' },
    ],
    neverFallbackTo: ['IN-PF', 'IN-ESI', 'IN-PT', 'IN-PAN', 'IN-CL', 'IN-SL', 'IN-EL'],
  };
}

export function getCountryPack(iso?: string | null): CountryPack | null {
  const key = String(iso || '').trim().toUpperCase();
  if (!key) return null;
  if (COUNTRY_PACKS[key]) return COUNTRY_PACKS[key];
  const meta = (catalog as Record<string, { name: string; currency: string; timezone: string; locale: string }>)[key];
  if (!meta) return null;
  return genericPack(key, meta);
}

export function payrollCapabilityLabel(capability?: string | null): string {
  if (capability === 'calculate') return 'Payroll calculated';
  if (capability === 'export') return 'Payroll export only';
  return 'Payroll not certified';
}
