import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseAgreementTermsFromText, toIsoDate } from './parseAgreementTermsFromText.js';

describe('parseAgreementTermsFromText', () => {
  it('extracts level, fees, dates, payment terms, advance, and replacement', () => {
    const text = `
PROFESSIONAL FEES
Service charges will be as below
Entry Level 8.33%
Middle Level 10%
Top Level 12%

This agreement is valid from 01 April 2025 to 31 March 2026.

Payment terms: Payment to be made by the client after the candidate has joined.

Advance payment: 30%

Free replacement within 3 months from the date of joining.
`;
    const { terms, filledCount } = parseAgreementTermsFromText(text);
    assert.equal(terms.agreementLevel, 'Level 2');
    assert.equal(terms.agreementServiceChargePercent, '10');
    assert.equal(terms.agreementContractStartDate, '2025-04-01');
    assert.equal(terms.agreementContractEndDate, '2026-03-31');
    assert.match(String(terms.agreementTimePeriod), /candidate has joined/i);
    assert.equal(terms.agreementAdvancePaymentPercent, '30');
    assert.equal(terms.agreementFreeReplacementValue, '3');
    assert.equal(terms.agreementFreeReplacementUnit, 'MONTHS');
    assert.ok(filledCount >= 7);
  });

  it('parses month-name and ISO dates', () => {
    assert.equal(toIsoDate('15th January 2025'), '2025-01-15');
    assert.equal(toIsoDate('January 15, 2025'), '2025-01-15');
    assert.equal(toIsoDate('2025-01-15T00:00:00.000Z'), '2025-01-15');
    assert.equal(toIsoDate('15/01/2025'), '2025-01-15');
  });
});
