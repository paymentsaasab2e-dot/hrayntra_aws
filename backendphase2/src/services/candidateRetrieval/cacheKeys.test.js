import { describe, it } from 'node:test';
import assert from 'node:assert';
import { buildListCacheKey, buildFilterHash, cacheEnvNamespace } from './cacheKeys.js';

describe('candidateRetrieval cacheKeys', () => {
  it('builds different keys for mine vs all', () => {
    const req = {
      user: { id: 'u1', permissions: ['view_all_candidates'] },
      query: { page: '1', limit: '20' },
      headers: {},
    };
    const a = buildListCacheKey(req, { mine: false, loadCommonPool: true, version: 1 });
    const b = buildListCacheKey(req, { mine: true, loadCommonPool: false, version: 1 });
    assert.notStrictEqual(a.key, b.key);
    assert.strictEqual(a.shareable, true);
    assert.strictEqual(b.shareable, false);
  });

  it('filter hash changes with search', () => {
    const h1 = buildFilterHash({ search: '' });
    const h2 = buildFilterHash({ search: 'sonia' });
    assert.notStrictEqual(h1, h2);
  });

  it('env namespace is non-empty', () => {
    assert.ok(cacheEnvNamespace().length > 0);
  });
});
