/**
 * PayFlow calculators. India calculates PF/ESI/PT. Cameroon exports without
 * Indian statutory math. Every other country is uncertified: no pay math.
 */
import { getCountryPack } from './countryPacks.js';

export const INDIA_PF_WAGE_CEILING = 15000;
export const INDIA_ESI_GROSS_CEILING = 21000;
export const INDIA_PT_DEFAULT = 200;

export function monthlyFromCtc(compensation) {
  const amount = Number(compensation?.amount);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return compensation?.period === 'MONTHLY' ? amount : amount / 12;
}

export function splitIndiaCtc(monthly) {
  const basic = round2(monthly * 0.5);
  const hra = round2(basic * 0.4);
  const special = round2(Math.max(0, monthly - basic - hra));
  return { basic, hra, special, monthly: round2(monthly) };
}

export function indiaPfEmployee(basic) {
  const wage = Math.min(basic, INDIA_PF_WAGE_CEILING);
  return round2(wage * 0.12);
}

export function indiaEsiEmployee(gross) {
  if (gross > INDIA_ESI_GROSS_CEILING) return 0;
  return round2(gross * 0.0075);
}

export function calculateIndiaPayslip({ compensation, lopDays = 0, previousTds = 0, overtimeHours = 0 }) {
  const monthly = monthlyFromCtc(compensation);
  const parts = splitIndiaCtc(monthly);
  const lop = round2((parts.monthly / 30) * Number(lopDays || 0));
  const gross = round2(Math.max(0, parts.monthly - lop));
  const pf = indiaPfEmployee(parts.basic);
  const esi = indiaEsiEmployee(gross);
  const pt = gross > 0 ? INDIA_PT_DEFAULT : 0;
  const tds = round2(Number(previousTds || 0));
  const otHours = Math.max(0, Number(overtimeHours) || 0);
  const otPay = round2((parts.monthly / 30 / 8) * 1.5 * otHours);
  const net = round2(Math.max(0, gross - pf - esi - pt - tds) + otPay);
  return {
    currency: 'INR',
    exportOnly: false,
    certified: true,
    gross,
    net,
    lines: {
      basic: parts.basic,
      hra: parts.hra,
      special: parts.special,
      lop,
      pfEmployee: pf,
      esiEmployee: esi,
      professionalTax: pt,
      tds,
      overtimeHours: otHours,
      otPay,
    },
    exceptions: buildIndiaExceptions({ compensation, pf, parts, gross }),
  };
}

function buildIndiaExceptions({ compensation, pf, parts, gross }) {
  const exceptions = [];
  if (!compensation?.amount) {
    exceptions.push({ code: 'MISSING_CTC', message: 'No CTC structure on the employee', severity: 'BLOCK' });
  }
  if (parts.basic > INDIA_PF_WAGE_CEILING) {
    exceptions.push({
      code: 'PF_CAP',
      message: `PF-able wage capped at ₹${INDIA_PF_WAGE_CEILING}; employee PF is ₹${pf}`,
      severity: 'WARN',
    });
  }
  if (gross > INDIA_ESI_GROSS_CEILING) {
    exceptions.push({
      code: 'ESI_EXIT',
      message: `Gross ₹${gross} is above ESI ceiling ₹${INDIA_ESI_GROSS_CEILING}; ESI not deducted`,
      severity: 'WARN',
    });
  }
  return exceptions;
}

export function freezeCameroonExport({ compensation, lopDays = 0, overtimeHours = 0 }) {
  const monthly = monthlyFromCtc(compensation);
  return {
    currency: 'XAF',
    exportOnly: true,
    certified: true,
    gross: round2(monthly),
    net: null,
    lines: {
      monthlyGross: round2(monthly),
      lopDays: Number(lopDays || 0),
      overtimeHours: Math.max(0, Number(overtimeHours) || 0),
      provider: 'local-payroll-export',
    },
    exceptions: compensation?.amount
      ? [
          {
            code: 'EXPORT_ONLY',
            message: 'Cameroon payroll pack is export-only. No PF/ESI calculation.',
            severity: 'INFO',
          },
        ]
      : [{ code: 'MISSING_CTC', message: 'No pay package on the employee', severity: 'BLOCK' }],
  };
}

export function indiaAccountsFile(slips = []) {
  const rows = Array.isArray(slips) ? slips : [];
  return {
    notice: 'Worksheet for the accountant. Not a government Form 16 e-file and not a live Tally or SAP posting.',
    form16Worksheet: rows.map((slip) => ({
      employeeId: slip.employeeId,
      gross: slip.gross,
      pf: slip.lines?.pfEmployee ?? null,
      esi: slip.lines?.esiEmployee ?? null,
      tds: slip.lines?.tds ?? null,
      overtimePay: slip.lines?.otPay ?? null,
      net: slip.net,
    })),
    tallyRows: rows.map((slip) => ({
      voucherType: 'Journal',
      ledger: 'Salary payable',
      employeeId: slip.employeeId,
      amount: slip.net,
      currency: 'INR',
    })),
  };
}

export function unavailablePayroll(iso) {
  const pack = getCountryPack(iso);
  const name = pack?.name || iso || 'this country';
  return {
    currency: pack?.currency || null,
    exportOnly: false,
    certified: false,
    gross: null,
    net: null,
    lines: {},
    exceptions: [
      {
        code: 'PAYROLL_NOT_CERTIFIED',
        message: `Payroll is not certified for ${name}. People and attendance still work. Pay is not calculated.`,
        severity: 'INFO',
      },
    ],
  };
}

export function calculateForPack(iso, input) {
  const country = String(iso || '').toUpperCase();
  if (country === 'IN') return calculateIndiaPayslip(input);
  if (country === 'CM') return freezeCameroonExport(input);
  return unavailablePayroll(country);
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}
