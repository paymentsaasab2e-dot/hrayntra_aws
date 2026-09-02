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

  it('parses made-this-day contracts, % of CTC, and one-year validity', () => {
    const text = `
This Agreement is made this 15th day of January 2025 between SAASA and the Client.
Professional fee of 8.5% of the annual CTC of the candidate.
The agreement shall remain valid for a period of one (1) year.
Payment is payable within 30 days from the date of joining.
Replacement guarantee of 90 days from joining.
`;
    const { terms } = parseAgreementTermsFromText(text);
    assert.equal(terms.agreementContractStartDate, '2025-01-15');
    assert.equal(terms.agreementServiceChargePercent, '8.5');
    assert.equal(terms.agreementContractEndDate, '2026-01-15');
    assert.equal(terms.agreementFreeReplacementValue, '90');
    assert.equal(terms.agreementFreeReplacementUnit, 'DAYS');
    assert.match(String(terms.agreementTimePeriod), /joining/i);
  });

  it('parses month-name and ISO dates', () => {
    assert.equal(toIsoDate('15th January 2025'), '2025-01-15');
    assert.equal(toIsoDate('January 15, 2025'), '2025-01-15');
    assert.equal(toIsoDate('2025-01-15T00:00:00.000Z'), '2025-01-15');
    assert.equal(toIsoDate('15/01/2025'), '2025-01-15');
    assert.equal(toIsoDate('15th day of January 2025'), '2025-01-15');
  });

  it('fills all-levels fee, 12-month dates, payment terms, and 3-month replacement', () => {
    const text = `
TERMS OF ENGAGEMENT
1. PROFESSIONAL FEES:
Our service charges are 8.33% on net monthly salary of selected candidate for all levels. The Fee shall be exclusive of all applicable taxes, if any.

2. PAYMENT TERMS:
Professional fee is payable within 30 days from the date of joining by the candidate.

5. REPLACEMENT:
In the unlikely event of the appointed person leaving within 3 months of joining, we shall re-conduct the search for the same position free of cost.

11. ARBITRATION:
The Arbitration process shall be presided over by 2 persons each from the parties to this agreement, who shall be of Senior executive rank within the organization.

12. Validity:
The contract will be valid for a period of 12 months from the date of entering the contract.
`;
    const { terms } = parseAgreementTermsFromText(text);
    const today = new Date();
    const start = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const endDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    endDate.setUTCMonth(endDate.getUTCMonth() + 12);
    const end = endDate.toISOString().slice(0, 10);

    assert.equal(terms.agreementLevel, 'All levels');
    assert.equal(terms.agreementServiceChargePercent, '8.33');
    assert.equal(terms.agreementContractStartDate, start);
    assert.equal(terms.agreementContractEndDate, end);
    assert.match(String(terms.agreementTimePeriod), /within 30 days from the date of joining/i);
    assert.equal(terms.agreementAdvancePaymentPercent, '');
    assert.equal(terms.agreementFreeReplacementValue, '3');
    assert.equal(terms.agreementFreeReplacementUnit, 'MONTHS');
  });

  it('does not treat arbitration senior executive as the agreement level', () => {
    const text = `
Professional fee of 10% of CTC.
The Arbitration process shall be presided over by 2 persons of Senior executive rank.
`;
    const { terms } = parseAgreementTermsFromText(text);
    assert.notEqual(terms.agreementLevel, 'Executive');
    assert.equal(terms.agreementServiceChargePercent, '10');
  });
});
