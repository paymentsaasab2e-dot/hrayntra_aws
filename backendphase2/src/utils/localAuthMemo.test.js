import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  authMemoGet,
  authMemoSet,
  authMemoInvalidateKey,
  authMemoInvalidatePattern,
  authMemoClear,
  authMemoTtlMs,
} from './localAuthMemo.js';

describe('localAuthMemo', () => {
  beforeEach(() => {
    delete process.env.AUTH_LOCAL_CACHE_TTL_SEC;
    authMemoClear();
  });

  it('is OFF by default (never stores or returns anything)', () => {
    assert.strictEqual(authMemoTtlMs(), 0);
    authMemoSet('k', { a: 1 });
    assert.strictEqual(authMemoGet('k'), undefined);
  });

  it('stores when enabled and caps the TTL at 120s', () => {
    process.env.AUTH_LOCAL_CACHE_TTL_SEC = '999';
    assert.strictEqual(authMemoTtlMs(), 120_000);
    authMemoSet('k', { a: 1 });
    assert.deepStrictEqual(authMemoGet('k'), { a: 1 });
  });

  it('invalidating a key also removes its |variants (mirrors deleteCache)', () => {
    process.env.AUTH_LOCAL_CACHE_TTL_SEC = '30';
    authMemoSet('permission:check:t1:u1|user', 1);
    authMemoSet('permission:check:t1:u1|authz', 2);
    authMemoSet('permission:check:t1:u2|authz', 3);
    authMemoInvalidateKey('permission:check:t1:u1');
    assert.strictEqual(authMemoGet('permission:check:t1:u1|user'), undefined);
    assert.strictEqual(authMemoGet('permission:check:t1:u1|authz'), undefined);
    assert.strictEqual(authMemoGet('permission:check:t1:u2|authz'), 3);
  });

  it('pattern invalidation (mirrors deleteCacheByPattern) is tenant-scoped', () => {
    process.env.AUTH_LOCAL_CACHE_TTL_SEC = '30';
    authMemoSet('permission:check:t1:u1|authz', 1);
    authMemoSet('permission:check:t2:u1|authz', 2);
    authMemoInvalidatePattern('permission:check:t1:*');
    assert.strictEqual(authMemoGet('permission:check:t1:u1|authz'), undefined);
    assert.strictEqual(authMemoGet('permission:check:t2:u1|authz'), 2);
  });
});
