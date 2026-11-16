import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  INDIA_ESI_GROSS_CEILING,
  INDIA_PF_WAGE_CEILING,
  calculateForPack,
  calculateIndiaPayslip,
  freezeCameroonExport,
  indiaAccountsFile,
} from './payroll.calc.js';
import { assertNoIndiaFallback, getCountryPack } from './countryPacks.js';

describe('PayFlow golden pack', () => {
  it('caps India PF at 15000 wage ceiling', () => {
    const slip = calculateIndiaPayslip({
      compensation: { amount: 1200000, period: 'ANNUAL' },
    });
    assert.equal(slip.exportOnly, false);
    assert.equal(slip.lines.pfEmployee, Math.round(INDIA_PF_WAGE_CEILING * 0.12 * 100) / 100);
    assert.ok(slip.exceptions.some((e) => e.code === 'PF_CAP'));
  });

  it('drops ESI when gross is above 21000', () => {
    const slip = calculateIndiaPayslip({
      compensation: { amount: 600000, period: 'ANNUAL' },
    });
    assert.equal(slip.gross > INDIA_ESI_GROSS_CEILING, true);
    assert.equal(slip.lines.esiEmployee, 0);
  });

  it('Cameroon export never uses PF or ESI', () => {
    const frozen = freezeCameroonExport({
      compensation: { amount: 2400000, period: 'ANNUAL' },
    });
    assert.equal(frozen.exportOnly, true);
    assert.equal(frozen.net, null);
    assert.equal(frozen.lines.pfEmployee, undefined);
    const viaPack = calculateForPack('CM', { compensation: { amount: 1000, period: 'MONTHLY' } });
    assert.equal(viaPack.exportOnly, true);
  });
});

describe('LOP from absences', () => {
  it('India LOP days reduce gross', () => {
    const none = calculateIndiaPayslip({
      compensation: { amount: 30000, period: 'MONTHLY' },
      lopDays: 0,
    });
    const withLop = calculateIndiaPayslip({
      compensation: { amount: 30000, period: 'MONTHLY' },
      lopDays: 2,
    });
    assert.equal(withLop.lines.lop, Math.round((30000 / 30) * 2 * 100) / 100);
    assert.ok(withLop.gross < none.gross);
  });

  it('Cameroon export records lopDays and never fills net', () => {
    const frozen = freezeCameroonExport({
      compensation: { amount: 1000, period: 'MONTHLY' },
      lopDays: 3,
    });
    assert.equal(frozen.lines.lopDays, 3);
    assert.equal(frozen.net, null);
    assert.equal(frozen.exportOnly, true);
  });
});

describe('Cameroon isolation', () => {
  it('leave types are not CL/SL/EL', () => {
    const cm = getCountryPack('CM');
    const codes = cm.leaveTypes.map((t) => t.code);
    assert.equal(codes.includes('CL'), false);
    assert.ok(codes.includes('CONGE_ANNUEL'));
  });

  it('rejects India PAN on Cameroon identifiers', () => {
    const cm = getCountryPack('CM');
    assert.throws(() => assertNoIndiaFallback(cm, { pan: 'ABCDE1234F' }), /India statutory/);
  });
});

describe('Uncertified country payroll', () => {
  it('does not run India or Cameroon math', () => {
    const ng = calculateForPack('NG', { compensation: { amount: 5000000, period: 'ANNUAL' }, lopDays: 2 });
    const fr = calculateForPack('FR', { compensation: { amount: 48000, period: 'ANNUAL' } });
    assert.equal(ng.certified, false);
    assert.equal(ng.net, null);
    assert.equal(ng.gross, null);
    assert.equal(ng.lines.pfEmployee, undefined);
    assert.equal(ng.currency, 'NGN');
    assert.equal(ng.exceptions[0].code, 'PAYROLL_NOT_CERTIFIED');
    assert.equal(fr.currency, 'EUR');
    assert.equal(fr.certified, false);
    assert.throws(() => assertNoIndiaFallback(getCountryPack('FR'), { uan: '100' }), /India statutory/);
  });

  it('adds overtime pay on top of India PF/ESI without using it as PF wage', () => {
    const base = calculateIndiaPayslip({
      compensation: { amount: 30000, period: 'MONTHLY' },
    });
    const withOt = calculateIndiaPayslip({
      compensation: { amount: 30000, period: 'MONTHLY' },
      overtimeHours: 2,
    });
    assert.equal(withOt.lines.overtimeHours, 2);
    assert.ok(withOt.lines.otPay > 0);
    assert.equal(withOt.lines.pfEmployee, base.lines.pfEmployee);
    assert.ok(withOt.net > base.net);
  });

  it('India close file is a worksheet, not an e-file', () => {
    const file = indiaAccountsFile([
      { employeeId: 'e1', gross: 30000, net: 25000, lines: { pfEmployee: 1800, tds: 0, otPay: 100 } },
    ]);
    assert.match(file.notice, /Not a government Form 16/);
    assert.equal(file.form16Worksheet[0].pf, 1800);
    assert.equal(file.tallyRows[0].ledger, 'Salary payable');
    assert.equal(file.tallyRows[0].amount, 25000);
  });
});
