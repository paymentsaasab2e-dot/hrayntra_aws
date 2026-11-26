import { describe, it, before } from 'node:test';
import assert from 'node:assert';

process.env.CANDIDATE_ORG_CACHE_L1_MAX = '50'; // minimum allowed count bound

let l1;
before(async () => {
  l1 = await import('./l1Cache.js');
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

describe('l1Cache', () => {
  it('serves fresh, then stale (still servable), then drops', async () => {
    l1.l1Set('t:k1', { a: 1 }, 1000, 600);
    const fresh = l1.l1GetEntry('t:k1');
    assert.ok(fresh?.fresh);
    await sleep(1100);
    const stale = l1.l1GetEntry('t:k1');
    assert.ok(stale && stale.fresh === false, 'expired entry is served stale');
    assert.strictEqual(l1.l1Get('t:k1'), null, 'l1Get returns fresh-only');
    await sleep(600);
    assert.strictEqual(l1.l1GetEntry('t:k1'), null, 'dropped after the stale window');
  });

  it('enforces the entry-count bound with LRU eviction', () => {
    l1.l1Clear();
    for (let i = 0; i < 80; i += 1) l1.l1Set(`t:b${i}`, { i }, 60_000);
    const s = l1.l1Stats();
    assert.ok(s.totalSize <= 50, `size ${s.totalSize} should be <= 50`);
    assert.ok(s.evictions > 0);
    assert.strictEqual(l1.l1Get('t:b0'), null, 'oldest evicted');
    assert.ok(l1.l1Get('t:b79'), 'newest kept');
  });

  it('prefix delete and stats are per organization', () => {
    l1.l1Clear();
    l1.l1Set('candidate:test:orgA:x', { n: 1 }, 60_000);
    l1.l1Set('candidate:test:orgA:y', { n: 2 }, 60_000);
    l1.l1Set('candidate:test:orgB:x', { n: 3 }, 60_000);
    assert.strictEqual(l1.l1Stats('candidate:test:orgA:').size, 2);
    assert.strictEqual(l1.l1Stats('candidate:test:orgB:').size, 1);
    assert.strictEqual(l1.l1DeleteByPrefix('candidate:test:orgA:'), 2);
    assert.strictEqual(l1.l1Stats('candidate:test:orgB:').size, 1, 'other org untouched');
  });
});
