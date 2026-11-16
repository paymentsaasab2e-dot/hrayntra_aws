import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertKnownCountry, assertNoIndiaFallback, getCountryPack, listCountryPacks, timezoneForCountry } from './countryPacks.js';

describe('PeopleCore country packs', () => {
  it('keeps Cameroon and India as the certified packs and opens every other ISO country', () => {
    const packs = listCountryPacks();
    assert.equal(packs[0].iso, 'CM');
    assert.equal(packs[1].iso, 'IN');
    assert.ok(packs.length > 200);
    assert.ok(packs.some((p) => p.iso === 'NG'));
    assert.ok(packs.some((p) => p.iso === 'FR'));
  });

  it('Cameroon never falls back to India PF/ESI and does not calculate payroll', () => {
    const cm = getCountryPack('CM');
    assert.equal(cm.payrollCapability, 'export');
    assert.equal(cm.timezone, 'Africa/Douala');
    assert.ok(cm.neverFallbackTo.includes('IN-PF'));
    assert.ok(cm.identityFields.some((f) => f.id === 'niu'));
    assert.equal(cm.identityFields.some((f) => f.id === 'pan'), false);
    assert.equal(cm.leaveTypes.some((t) => t.code === 'CL'), false);
    assert.ok(cm.leaveTypes.some((t) => t.code === 'CONGE_ANNUEL'));
  });

  it('a third country can hire on a generic pack and does not calculate pay', () => {
    const ng = assertKnownCountry('NG');
    assert.equal(ng.name, 'Nigeria');
    assert.equal(ng.currency, 'NGN');
    assert.equal(ng.timezone, 'Africa/Lagos');
    assert.equal(ng.payrollCapability, 'unavailable');
    assert.deepEqual(ng.leaveTypes.map((t) => t.code), ['ANNUAL', 'SICK', 'UNPAID']);
    assert.deepEqual(ng.letterTypes.map((t) => t.id), ['offer', 'employment_certificate', 'exit_letter']);
    assert.equal(ng.identityFields.some((f) => f.id === 'pan'), false);
    assert.equal(ng.identityFields.some((f) => f.id === 'cnpsNumber'), false);
    assert.throws(() => assertNoIndiaFallback(ng, { pan: 'ABCDE1234F' }), /India statutory/);
    assert.equal(timezoneForCountry('NG'), 'Africa/Lagos');
    assert.equal(timezoneForCountry('FR'), 'Europe/Paris');
    assert.notEqual(timezoneForCountry('NG'), 'Asia/Kolkata');
    const us = assertKnownCountry('US');
    assert.equal(us.payrollCapability, 'unavailable');
    assert.equal(us.timezone, 'America/New_York');
    assert.ok(us.leaveTypes.some((t) => t.code === 'PTO'));
    assert.equal(us.leaveTypes.some((t) => t.code === 'CL'), false);
  });

  it('rejects a code that is not a country', () => {
    assert.throws(() => assertKnownCountry('XX'), /Unknown country code/);
  });
});
