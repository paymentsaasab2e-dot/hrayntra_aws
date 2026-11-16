import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { eachIsoDate, isWeekendIso, monthDateRange } from './peoplecore.util.js';

describe('PeopleCore date helpers', () => {
  it('monthDateRange covers the calendar month', () => {
    const { start, end } = monthDateRange(2026, 11);
    assert.equal(start, '2026-11-01');
    assert.equal(end, '2026-11-30');
  });

  it('skips Saturday and Sunday', () => {
    const days = eachIsoDate('2026-11-06', '2026-11-09');
    assert.deepEqual(days, ['2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09']);
    assert.equal(isWeekendIso('2026-11-07'), true);
    assert.equal(isWeekendIso('2026-11-08'), true);
    assert.equal(isWeekendIso('2026-11-06'), false);
  });
});
