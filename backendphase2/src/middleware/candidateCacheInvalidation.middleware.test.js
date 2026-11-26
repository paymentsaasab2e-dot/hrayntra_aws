import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { EventEmitter } from 'node:events';

process.env.CANDIDATE_ORG_CACHE_ENABLED = '1';

let mw;
let l1;
let versions;
let prisma;
let keys;
before(async () => {
  mw = await import('./candidateCacheInvalidation.middleware.js');
  l1 = await import('../services/candidateRetrieval/l1Cache.js');
  versions = await import('../services/candidateRetrieval/versionStore.js');
  prisma = await import('../config/prisma.js');
  keys = await import('../services/candidateRetrieval/cacheKeys.js');
});

describe('classifyCandidateMutation', () => {
  it('flags candidate-affecting writes', () => {
    const yes = [
      ['POST', '/api/v1/candidates'],
      ['POST', '/api/v1/candidates/bulk-cv/upload'],
      ['PATCH', '/api/v1/candidates/abc'],
      ['DELETE', '/api/v1/candidates/abc?x=1'],
      ['POST', '/api/v1/candidates/abc/restore'],
      ['PUT', '/api/v1/jobs/j1'],
      ['POST', '/api/v1/matches/submit-to-client'],
      ['PATCH', '/api/v1/pipeline/move'],
      ['POST', '/api/v1/placements'],
      ['PUT', '/api/v1/roles/r1'],
      ['POST', '/api/v1/internal/portal-sync/application'],
      ['PUT', '/api/v1/settings/org/recruitment-mode'],
    ];
    for (const [m, p] of yes) {
      assert.ok(mw.classifyCandidateMutation(m, p), `${m} ${p} should invalidate`);
    }
  });

  it('ignores reads and read-only POSTs', () => {
    const no = [
      ['GET', '/api/v1/candidates'],
      ['HEAD', '/api/v1/candidates'],
      ['POST', '/api/v1/candidates/parse-resume'],
      ['POST', '/api/v1/candidates/abc/notes'],
      ['POST', '/api/v1/candidates/abc/interviews/meeting-link'],
      ['POST', '/api/v1/jobs/j1/notes'],
      ['POST', '/api/v1/candidate-performance/run-test'],
      ['POST', '/api/v1/auth/login'],
      ['PATCH', '/api/v1/settings/org/theme'],
    ];
    for (const [m, p] of no) {
      assert.strictEqual(mw.classifyCandidateMutation(m, p), null, `${m} ${p} should NOT invalidate`);
    }
  });

  it('does not match look-alike prefixes', () => {
    assert.strictEqual(mw.classifyCandidateMutation('POST', '/api/v1/candidates-export-x'), null);
  });
});

function fakeRes(status) {
  const res = new EventEmitter();
  res.statusCode = status;
  res.endObserver = null;
  res.end = function end() {
    if (res.endObserver) res.endObserver();
    queueMicrotask(() => res.emit('finish'));
  };
  return res;
}

const tick = () => new Promise((r) => setTimeout(r, 25));

describe('candidateCacheInvalidationMiddleware', () => {
  it('clears ONLY this org, before the response is flushed, after a successful write', async () => {
    const tenant = 'org_mw_a';
    const other = 'org_mw_b';
    const keyA = `${keys.orgCachePrefix(tenant)}k1`;
    const keyB = `${keys.orgCachePrefix(other)}k1`;
    l1.l1Set(keyA, { v: 1 }, 60_000);
    l1.l1Set(keyB, { v: 1 }, 60_000);
    const v0 = await versions.getOrgCandidateVersion(tenant);

    const req = { method: 'PATCH', originalUrl: '/api/v1/candidates/c1', headers: {}, query: {}, body: {} };
    const res = fakeRes(200);
    let presentAtFlush = null;
    res.endObserver = () => {
      presentAtFlush = l1.l1GetEntry(keyA);
    };

    await prisma.runWithTenantContext(tenant, async () => {
      await new Promise((resolve) => {
        mw.candidateCacheInvalidationMiddleware(req, res, () => {
          res.end();
          resolve();
        });
      });
    });
    await tick();

    assert.strictEqual(presentAtFlush, null, 'entry must already be gone when the response is sent');
    assert.ok(l1.l1GetEntry(keyB), 'other organization keeps its cache');
    assert.ok((await versions.getOrgCandidateVersion(tenant)) > v0, 'version rotated');
  });

  it('does nothing when the write fails (status >= 400)', async () => {
    const tenant = 'org_mw_c';
    const key = `${keys.orgCachePrefix(tenant)}k1`;
    l1.l1Set(key, { v: 1 }, 60_000);
    const v0 = await versions.getOrgCandidateVersion(tenant);

    const req = { method: 'POST', originalUrl: '/api/v1/candidates', headers: {}, query: {}, body: {} };
    const res = fakeRes(422);
    await prisma.runWithTenantContext(tenant, async () => {
      await new Promise((resolve) => {
        mw.candidateCacheInvalidationMiddleware(req, res, () => {
          res.end();
          resolve();
        });
      });
    });
    await tick();

    assert.ok(l1.l1GetEntry(key), 'cache kept');
    assert.strictEqual(await versions.getOrgCandidateVersion(tenant), v0);
  });

  it('does nothing for reads', async () => {
    const tenant = 'org_mw_d';
    const key = `${keys.orgCachePrefix(tenant)}k1`;
    l1.l1Set(key, { v: 1 }, 60_000);
    const req = { method: 'GET', originalUrl: '/api/v1/candidates', headers: {}, query: {} };
    const res = fakeRes(200);
    await prisma.runWithTenantContext(tenant, async () => {
      await new Promise((resolve) => {
        mw.candidateCacheInvalidationMiddleware(req, res, () => {
          res.end();
          resolve();
        });
      });
    });
    await tick();
    assert.ok(l1.l1GetEntry(key));
  });
});
