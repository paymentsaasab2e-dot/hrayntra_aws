import { describe, it } from 'node:test';
import assert from 'node:assert';
import { runWithTenantContext } from '../../config/prisma.js';
import {
  buildListCacheKey,
  buildFilterHash,
  buildPermScope,
  cacheEnvNamespace,
  orgCachePrefix,
  stripKeyVersion,
} from './cacheKeys.js';

const mkReq = (over = {}) => ({
  user: { id: 'u1', role: 'RECRUITER' },
  userWithPermissions: { permissions: ['view_all_candidates'] },
  query: { page: '1', limit: '20' },
  headers: {},
  ...over,
});

const keyOf = (req, opts = { mine: false, loadCommonPool: false, version: 1 }) =>
  runWithTenantContext('org_a', () => buildListCacheKey(req, opts));

describe('candidateRetrieval cacheKeys', () => {
  it('builds different keys for mine vs all and never shares Mine', () => {
    const req = mkReq();
    const a = keyOf(req, { mine: false, loadCommonPool: true, version: 1 });
    const b = keyOf(req, { mine: true, loadCommonPool: false, version: 1 });
    assert.notStrictEqual(a.key, b.key);
    assert.strictEqual(b.shareable, false);
  });

  it('only a full-access Super Admin may share an "All" entry', () => {
    const regular = keyOf(mkReq());
    assert.strictEqual(regular.shareable, false);
    const admin = keyOf(mkReq({ user: { id: 'adm', role: 'SUPER_ADMIN' }, userWithPermissions: { permissions: ['all'], isSuperAdmin: true } }));
    assert.strictEqual(admin.shareable, true);
  });

  it('REGRESSION: two users with identical permissions never collide', () => {
    const u1 = keyOf(mkReq({ user: { id: 'user-1', role: 'RECRUITER' } }));
    const u2 = keyOf(mkReq({ user: { id: 'user-2', role: 'RECRUITER' } }));
    assert.notStrictEqual(u1.key, u2.key);
  });

  it('REGRESSION: permissions are read from userWithPermissions (req.user has none)', () => {
    const viewAll = keyOf(mkReq({ userWithPermissions: { permissions: ['view_all_candidates'] } }));
    const assigned = keyOf(mkReq({ userWithPermissions: { permissions: ['view_assigned_candidates'] } }));
    assert.notStrictEqual(viewAll.key, assigned.key);
  });

  it('org unit / side headers change the key (visibility depends on them)', () => {
    const base = keyOf(mkReq());
    const unit = keyOf(mkReq({ headers: { 'x-org-unit-id': 'unit-9' } }));
    const side = keyOf(mkReq({ headers: { 'x-org-side': 'client' } }));
    assert.notStrictEqual(base.key, unit.key);
    assert.notStrictEqual(base.key, side.key);
  });

  it('different organizations never share a prefix or key', () => {
    const req = mkReq();
    const a = runWithTenantContext('org_a', () => buildListCacheKey(req, { mine: false, loadCommonPool: false, version: 1 }));
    const b = runWithTenantContext('org_b', () => buildListCacheKey(req, { mine: false, loadCommonPool: false, version: 1 }));
    assert.notStrictEqual(a.key, b.key);
    assert.ok(a.key.startsWith(orgCachePrefix('org_a')));
    assert.ok(!a.key.startsWith(orgCachePrefix('org_b')));
  });

  it('common-pool visibility and filters produce separate entries', () => {
    const req = mkReq();
    const priv = keyOf(req, { mine: false, loadCommonPool: false, version: 1 });
    const combined = keyOf(req, { mine: false, loadCommonPool: true, version: 1 });
    assert.notStrictEqual(priv.key, combined.key);
    const filtered = keyOf(mkReq({ query: { page: '1', limit: '20', search: 'sonia' } }));
    assert.notStrictEqual(priv.key, filtered.key);
  });

  it('a version bump changes the key; stripKeyVersion removes only the version', () => {
    const v1 = keyOf(mkReq(), { mine: false, loadCommonPool: false, version: 1 });
    const v2 = keyOf(mkReq(), { mine: false, loadCommonPool: false, version: 2 });
    assert.notStrictEqual(v1.key, v2.key);
    assert.strictEqual(stripKeyVersion(v1.key), stripKeyVersion(v2.key));
  });

  it('over-large limits clamp to one key (limit=500 equals limit=100)', () => {
    const a = keyOf(mkReq({ query: { page: '1', limit: '500' } }));
    const b = keyOf(mkReq({ query: { page: '1', limit: '100' } }));
    assert.strictEqual(a.key, b.key);
  });

  it('filter hash changes with search', () => {
    assert.notStrictEqual(buildFilterHash({ search: '' }), buildFilterHash({ search: 'sonia' }));
  });

  it('Mine scope is per user', () => {
    const a = runWithTenantContext('org_a', () => buildPermScope(mkReq({ user: { id: 'a' } }), { mine: true }));
    const b = runWithTenantContext('org_a', () => buildPermScope(mkReq({ user: { id: 'b' } }), { mine: true }));
    assert.notStrictEqual(a, b);
  });

  it('env namespace is non-empty', () => {
    assert.ok(cacheEnvNamespace().length > 0);
  });
});
