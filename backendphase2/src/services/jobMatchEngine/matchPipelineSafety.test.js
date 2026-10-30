import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'module';
import {
  acquirePipelineLock,
  releasePipelineLock,
  pipelineLockKey,
  allowLocalPipelineLock,
  __pipelineLockTest,
} from '../../modules/match/matchPipelineLock.js';

const require = createRequire(import.meta.url);
const { upsertAiAuthoredMatch } = require('./aiMatchPersist.cjs');

function makePrismaStore(initial = []) {
  const store = [...initial];
  return {
    match: {
      findMany: async ({ where }) => {
        assert.deepEqual(where.createdById, { isSet: false });
        return store
          .filter(
            (r) =>
              r.candidateId === where.candidateId &&
              r.jobId === where.jobId &&
              r.createdById == null,
          )
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map((r) => ({ id: r.id }));
      },
      create: async ({ data }) => {
        const row = {
          id: `ai_${store.length + 1}_${Math.random().toString(36).slice(2, 6)}`,
          createdById: null,
          updatedAt: new Date(),
          ...data,
        };
        store.push(row);
        return row;
      },
      update: async ({ where, data }) => {
        const row = store.find((r) => r.id === where.id);
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      },
      deleteMany: async ({ where }) => {
        const ids = new Set(where.id.in);
        for (let i = store.length - 1; i >= 0; i -= 1) {
          if (ids.has(store[i].id)) store.splice(i, 1);
        }
        return { count: ids.size };
      },
    },
    _store: store,
  };
}

describe('AI → Applied → AI persistence', () => {
  it('updates one AI-authored row and flips origin', async () => {
    const prisma = makePrismaStore();
    await upsertAiAuthoredMatch(prisma, {
      candidateId: 'c1',
      jobId: 'j1',
      score: 80,
      evaluation: { origin: 'ai', engineVersion: '1.1' },
    });
    await upsertAiAuthoredMatch(prisma, {
      candidateId: 'c1',
      jobId: 'j1',
      score: 72,
      evaluation: { origin: 'applied', engineVersion: '1.1' },
    });
    await upsertAiAuthoredMatch(prisma, {
      candidateId: 'c1',
      jobId: 'j1',
      score: 85,
      evaluation: { origin: 'ai', engineVersion: '1.1' },
    });
    const aiRows = prisma._store.filter((r) => r.createdById == null);
    assert.equal(aiRows.length, 1);
    assert.equal(aiRows[0].score, 85);
    assert.equal(aiRows[0].evaluation.origin, 'ai');
  });
});

describe('manual match preservation', () => {
  it('never updates or deletes rows with createdById set', async () => {
    const prisma = makePrismaStore([
      {
        id: 'manual1',
        candidateId: 'c1',
        jobId: 'j1',
        score: 40,
        createdById: 'user-1',
        updatedAt: new Date(1),
        evaluation: { origin: 'manual' },
      },
    ]);
    await upsertAiAuthoredMatch(prisma, {
      candidateId: 'c1',
      jobId: 'j1',
      score: 90,
      evaluation: { origin: 'ai' },
    });
    assert.equal(prisma._store.find((r) => r.id === 'manual1').score, 40);
    assert.equal(prisma._store.find((r) => r.id === 'manual1').createdById, 'user-1');
    assert.equal(prisma._store.filter((r) => r.createdById == null).length, 1);
  });
});

describe('duplicate prevention', () => {
  it('collapses pre-existing AI-authored duplicates', async () => {
    const prisma = makePrismaStore([
      { id: 'd1', candidateId: 'c1', jobId: 'j1', score: 10, createdById: null, updatedAt: new Date(1) },
      { id: 'd2', candidateId: 'c1', jobId: 'j1', score: 20, createdById: null, updatedAt: new Date(2) },
    ]);
    const out = await upsertAiAuthoredMatch(prisma, {
      candidateId: 'c1',
      jobId: 'j1',
      score: 95,
      evaluation: { origin: 'ai' },
    });
    assert.equal(out.action, 'updated');
    assert.equal(prisma._store.filter((r) => r.createdById == null).length, 1);
  });

  it('collapses race duplicates after concurrent creates', async () => {
    const store = [];
    let createCount = 0;
    const prisma = {
      match: {
        findMany: async ({ where }) =>
          store
            .filter(
              (r) =>
                r.candidateId === where.candidateId &&
                r.jobId === where.jobId &&
                r.createdById == null,
            )
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((r) => ({ id: r.id })),
        create: async ({ data }) => {
          createCount += 1;
          const row = {
            id: `race_${createCount}`,
            createdById: null,
            updatedAt: new Date(createCount),
            ...data,
          };
          store.push(row);
          if (createCount === 1) {
            store.push({
              id: 'race_extra',
              createdById: null,
              updatedAt: new Date(0),
              candidateId: data.candidateId,
              jobId: data.jobId,
              score: 1,
            });
          }
          return row;
        },
        deleteMany: async ({ where }) => {
          const ids = new Set(where.id.in);
          for (let i = store.length - 1; i >= 0; i -= 1) {
            if (ids.has(store[i].id)) store.splice(i, 1);
          }
          return { count: ids.size };
        },
        update: async () => {
          throw new Error('should create then collapse');
        },
      },
    };
    await upsertAiAuthoredMatch(prisma, {
      candidateId: 'c1',
      jobId: 'j1',
      score: 88,
      evaluation: { origin: 'applied' },
    });
    assert.equal(store.filter((r) => r.createdById == null).length, 1);
  });
});

describe('shared job-level pipeline lock', () => {
  const localRedis = {
    hasRedisConfig: () => false,
    acquireLock: async () => ({ ok: false, reason: 'unavailable' }),
    releaseLock: async () => false,
  };

  beforeEach(() => {
    __pipelineLockTest.localPipelineLocks.clear();
    process.env.NODE_ENV = 'test';
    delete process.env.REDIS_URL;
    delete process.env.REDIS_HOST;
  });

  it('blocks concurrent AI/Applied for same job; allows different jobs', async () => {
    assert.equal(pipelineLockKey('jobA'), 'match:pipeline:jobA');
    assert.notEqual(pipelineLockKey('jobA'), pipelineLockKey('jobB'));

    const lockA = await acquirePipelineLock('jobA', localRedis);
    await assert.rejects(() => acquirePipelineLock('jobA', localRedis), (err) => {
      assert.equal(err.statusCode, 409);
      assert.equal(err.code, 'PIPELINE_LOCKED');
      return true;
    });

    const lockB = await acquirePipelineLock('jobB', localRedis);
    assert.ok(lockB.local);
    await releasePipelineLock(lockB, localRedis);
    await releasePipelineLock(lockA, localRedis);
  });

  it('fails with 503 when Redis is configured but unreachable (no local fallback)', async () => {
    const redisDown = {
      hasRedisConfig: () => true,
      acquireLock: async () => ({ ok: false, reason: 'unavailable' }),
      releaseLock: async () => false,
    };
    await assert.rejects(() => acquirePipelineLock('jobX', redisDown), (err) => {
      assert.equal(err.statusCode, 503);
      assert.equal(err.code, 'PIPELINE_LOCK_UNAVAILABLE');
      return true;
    });
    assert.equal(__pipelineLockTest.localPipelineLocks.size, 0);
  });

  it('fails with 409 when Redis lock is held', async () => {
    const redisHeld = {
      hasRedisConfig: () => true,
      acquireLock: async () => ({ ok: false, reason: 'held' }),
      releaseLock: async () => false,
    };
    await assert.rejects(() => acquirePipelineLock('jobZ', redisHeld), (err) => {
      assert.equal(err.statusCode, 409);
      assert.equal(err.code, 'PIPELINE_LOCKED');
      return true;
    });
  });

  it('production without Redis rejects local locking', () => {
    process.env.NODE_ENV = 'production';
    assert.equal(allowLocalPipelineLock(() => false), false);
  });
});
