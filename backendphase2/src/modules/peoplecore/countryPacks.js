/**
 * Country packs for Phase 3/4 PeopleCore + PayFlow.
 * Same HRMS modules everywhere. India and Cameroon are certified packs.
 * Every other ISO country gets a generic pack: HR works, payroll is not certified.
 * Never fall back to India PF/ESI/PAN on a non-India pack.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const countryCatalog = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'countryCatalog.json'), 'utf8'),
);

export const PAYROLL_CAPABILITY = {
  UNAVAILABLE: 'unavailable',
  EXPORT: 'export',
  CALCULATE: 'calculate',
};

export const ENGAGEMENT_TYPES = [
  'EMPLOYEE',
  'INTERN',
  'CONTRACTOR',
  'CONSULTANT',
  'TRAINEE',
];

export const EMPLOYEE_STATUSES = [
  'PREBOARDING',
  'READY',
  'JOINED',
  'ACTIVE',
  'DEFERRED',
  'NO_SHOW',
  'EXITED',
];

export const COUNTRY_PACKS = {
  CM: {
    iso: 'CM',
    name: 'Cameroon',
    currency: 'XAF',
    timezone: 'Africa/Douala',
    locale: 'fr-CM',
    dateFormat: 'DD/MM/YYYY',
    payrollCapability: PAYROLL_CAPABILITY.EXPORT,
    payrollNote:
      'Cameroon pack is payroll export-only. Phase 3 does not calculate CNPS or print payslips.',
    identityFields: [
      { id: 'niu', label: 'NIU', required: false },
      { id: 'cnpsNumber', label: 'CNPS number', required: false },
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
      { id: 'maternity', code: 'MATERNITE', label: 'Maternité (Code du travail)', paid: true },
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
    inspectorReports: ['attendance_register', 'leave_ledger', 'joiners_leavers'],
    neverFallbackTo: ['IN-PF', 'IN-ESI', 'IN-PT', 'IN-PAN', 'IN-CL', 'IN-SL', 'IN-EL'],
  },
  IN: {
    iso: 'IN',
    name: 'India',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    locale: 'en-IN',
    dateFormat: 'DD/MM/YYYY',
    payrollCapability: PAYROLL_CAPABILITY.CALCULATE,
    payrollNote:
      'India pack will calculate PF/ESI in Phase 4 PayFlow. Phase 3 stores CTC structure only and does not print payslips until a period is locked.',
    identityFields: [
      { id: 'pan', label: 'PAN', required: false },
      { id: 'aadhaar', label: 'Aadhaar', required: false },
      { id: 'uan', label: 'UAN', required: false },
      { id: 'pfNumber', label: 'PF number', required: false },
      { id: 'esiNumber', label: 'ESI number', required: false },
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
    inspectorReports: ['attendance_register', 'wage_register', 'leave_ledger', 'joiners_leavers'],
    neverFallbackTo: [],
  },
  US: {
    iso: 'US',
    name: 'United States',
    currency: 'USD',
    timezone: 'America/New_York',
    locale: 'en-US',
    dateFormat: 'MM/DD/YYYY',
    payrollCapability: PAYROLL_CAPABILITY.UNAVAILABLE,
    payrollNote:
      'US pack is a PTO bank (paid time off, sick, unpaid). Payroll is not certified. Pay is not calculated.',
    identityFields: [{ id: 'ssnLast4', label: 'SSN last 4', required: false }],
    companyIdentifierFields: [{ id: 'ein', label: 'EIN' }],
    bankFields: [
      { id: 'routingNumber', label: 'Routing number' },
      { id: 'accountNumber', label: 'Account number' },
      { id: 'accountName', label: 'Account name' },
    ],
    leaveTypes: [
      { id: 'pto', code: 'PTO', label: 'Paid time off', paid: true, annualDays: 15 },
      { id: 'sick', code: 'SICK', label: 'Sick leave', paid: true, annualDays: 5 },
      { id: 'unpaid', code: 'UNPAID', label: 'Unpaid leave', paid: false, annualDays: 0 },
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
    inspectorReports: ['attendance_register', 'leave_ledger', 'joiners_leavers'],
    neverFallbackTo: ['IN-PF', 'IN-ESI', 'IN-PT', 'IN-PAN', 'IN-CL', 'IN-SL', 'IN-EL'],
  },
};

const INDIA_FIELD_BAN = ['IN-PF', 'IN-ESI', 'IN-PT', 'IN-PAN', 'IN-CL', 'IN-SL', 'IN-EL'];

function genericPack(iso, meta) {
  return {
    iso,
    name: meta.name,
    currency: meta.currency,
    timezone: meta.timezone,
    locale: meta.locale,
    dateFormat: 'DD/MM/YYYY',
    payrollCapability: PAYROLL_CAPABILITY.UNAVAILABLE,
    payrollNote: `Payroll is not certified for ${meta.name}. Hire, attendance, leave, and exit work. Pay is not calculated.`,
    identityFields: [{ id: 'nationalId', label: 'National ID', required: false }],
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
    inspectorReports: ['attendance_register', 'leave_ledger', 'joiners_leavers'],
    neverFallbackTo: INDIA_FIELD_BAN,
  };
}

export function listCountryPacks() {
  const rest = Object.keys(countryCatalog)
    .filter((iso) => iso !== 'CM' && iso !== 'IN' && iso !== 'US')
    .map((iso) => getCountryPack(iso))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [COUNTRY_PACKS.CM, COUNTRY_PACKS.IN, COUNTRY_PACKS.US, ...rest];
}

export function getCountryPack(iso) {
  const key = String(iso || '').trim().toUpperCase();
  if (!key) return null;
  if (COUNTRY_PACKS[key]) return COUNTRY_PACKS[key];
  const meta = countryCatalog[key];
  if (!meta) return null;
  return genericPack(key, meta);
}

export function timezoneForCountry(iso) {
  return getCountryPack(iso)?.timezone || 'UTC';
}

export function assertKnownCountry(iso) {
  const pack = getCountryPack(iso);
  if (!pack) {
    const err = new Error(`Unknown country code: ${iso || '(empty)'}. Use an ISO code such as NG, FR, IN, or CM.`);
    err.statusCode = 400;
    err.code = 'UNKNOWN_COUNTRY_PACK';
    throw err;
  }
  return pack;
}

export function settingsFromPack(pack) {
  return {
    legalEmployerCountry: pack.iso,
    payrollCapability: pack.payrollCapability,
    timezone: pack.timezone,
    currency: pack.currency,
    locale: pack.locale,
    hrEnabled: true,
  };
}

export function holidaysForYear(pack, year) {
  const y = Number(year) || new Date().getFullYear();
  return (pack.holidays || []).map((row) => ({
    date: `${y}-${row.date}`,
    name: row.name,
  }));
}

export function assertNoIndiaFallback(pack, fields = {}) {
  if (pack.iso === 'IN') return;
  const banned = ['pan', 'tan', 'gstin', 'uan', 'pfNumber', 'esiNumber', 'aadhaar', 'ifsc', 'pfEstablishment', 'esiEstablishment'];
  const hits = banned.filter((key) => fields[key] != null && String(fields[key]).trim() !== '');
  if (hits.length) {
    const err = new Error(
      `${pack.name} must not store India statutory fields (${hits.join(', ')}).`,
    );
    err.statusCode = 400;
    err.code = 'INDIA_FIELD_ON_FOREIGN_PACK';
    throw err;
  }
}
