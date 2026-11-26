import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  recordPerfSample,
  getPerfCounters,
  listPerfHistory,
  summarizePerf,
  resetPerfCounters,
  clearPerfHistory,
} from './metrics.service.js';

describe('metrics.service (per-organization)', () => {
  it('keeps organizations fully separate', () => {
    recordPerfSample({ tenantId: 'mA', testType: 'list', cacheState: 'L1_HIT', durationMs: 5, mongoOps: 0 });
    recordPerfSample({ tenantId: 'mB', testType: 'list', cacheState: 'MISS', durationMs: 900, mongoOps: 7 });
    assert.strictEqual(getPerfCounters('mA').l1Hits, 1);
    assert.strictEqual(getPerfCounters('mA').misses, 0);
    assert.strictEqual(getPerfCounters('mB').misses, 1);
    assert.strictEqual(listPerfHistory({ tenantId: 'mA' }).length, 1);
  });

  it('splits real Candidates-tab traffic from test-button runs', () => {
    recordPerfSample({ tenantId: 'mC', testType: 'list', cacheState: 'L1_HIT', durationMs: 4, mongoOps: 0 });
    recordPerfSample({ tenantId: 'mC', testType: 'run-test:cached', cacheState: 'MISS', durationMs: 800, mongoOps: 5 });
    const c = getPerfCounters('mC');
    assert.strictEqual(c.requests, 2);
    assert.strictEqual(c.live.requests, 1);
    assert.strictEqual(c.live.l1Hits, 1);
    assert.strictEqual(listPerfHistory({ tenantId: 'mC', source: 'live' }).length, 1);
    assert.strictEqual(listPerfHistory({ tenantId: 'mC', source: 'tests' }).length, 1);
    assert.ok(summarizePerf('mC', { source: 'live' }).L1_HIT);
    assert.ok(!summarizePerf('mC', { source: 'live' }).MISS);
  });

  it('background work never inflates request counters', () => {
    recordPerfSample({ tenantId: 'mD', testType: 'background-refresh', cacheState: 'REFRESH', durationMs: 700, mongoOps: 6 });
    const c = getPerfCounters('mD');
    assert.strictEqual(c.requests, 0);
    assert.strictEqual(c.backgroundRefreshes, 1);
    assert.strictEqual(c.mongoOps, 6);
  });

  it('reset / clear affect only the given organization', () => {
    recordPerfSample({ tenantId: 'mE', testType: 'list', cacheState: 'L1_HIT', durationMs: 3 });
    recordPerfSample({ tenantId: 'mF', testType: 'list', cacheState: 'L1_HIT', durationMs: 3 });
    resetPerfCounters('mE');
    clearPerfHistory('mE');
    assert.strictEqual(getPerfCounters('mE').requests, 0);
    assert.strictEqual(listPerfHistory({ tenantId: 'mE' }).length, 0);
    assert.strictEqual(getPerfCounters('mF').requests, 1);
  });

  it('summaries exclude failed samples', () => {
    recordPerfSample({ tenantId: 'mG', testType: 'list', cacheState: 'MISS', durationMs: 100, error: 'boom' });
    assert.deepStrictEqual(summarizePerf('mG'), {});
  });
});
