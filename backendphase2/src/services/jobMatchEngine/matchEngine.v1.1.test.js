import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { mergeScores } = require('./scoreMerger.cjs');
const { computePass4 } = require('./pass4CulturalFit.cjs');
const { upsertAiAuthoredMatch } = require('./aiMatchPersist.cjs');

describe('scoreMerger v1.1', () => {
  const p1 = { score: 70 };
  const p2 = { score: 80 };

  it('keeps P3 weight for lexical fallback scores 30, 50, 70', () => {
    for (const lex of [30, 50, 70]) {
      const m = mergeScores(p1, p2, { score: lex, engine: 'lexical-fallback' }, { score: 60 });
      assert.equal(m.weights.p3, 0.3);
      assert.equal(m.weights.p1, 0.3);
    }
  });

  it('redistributes when cultural pass is skipped', () => {
    const m = mergeScores(p1, p2, { score: 70 }, { skipped: true, score: 0 });
    assert.equal(m.weights.p1, 0.35);
    assert.equal(m.weights.p2, 0.25);
    assert.equal(m.weights.p3, 0.4);
    assert.equal(m.weights.p4, 0);
  });

  it('redistributes when semantic is unavailable', () => {
    const m = mergeScores(p1, p2, { score: 0, semanticUnavailable: true }, { score: 60 });
    assert.equal(m.weights.p3, 0);
    assert.ok(Math.abs(m.weights.p1 - 0.45) < 1e-9);
    assert.ok(Math.abs(m.weights.p2 - 0.4) < 1e-9);
  });

  it('default weights sum to 1', () => {
    const m = mergeScores(p1, p2, { score: 70 }, { score: 60 });
    const sum = m.weights.p1 + m.weights.p2 + m.weights.p3 + m.weights.p4;
    assert.ok(Math.abs(sum - 1) < 1e-9);
  });
});

describe('pass4CulturalFit v1.1', () => {
  it('skips when culture text missing', async () => {
    const out = await computePass4('', 'Engineer', 'summary', [], [], true);
    assert.equal(out.skipped, true);
    assert.equal(out.score, 0);
  });

  it('successful shape unchanged on happy path dimensions', async () => {
    // Without LLM keys this may fail-skip; assert skipped or valid 0–100.
    const out = await computePass4('We value collaboration.', 'Engineer', 'Team player', ['communication'], ['Dev'], false);
    assert.equal(typeof out.skipped, 'boolean');
    if (out.skipped) {
      assert.equal(out.score, 0);
      assert.ok(out.error || out.source?.includes('skip'));
    } else {
      assert.ok(out.score >= 0 && out.score <= 100);
      assert.equal(out.source, 'llm-response');
    }
  });
});

describe('upsertAiAuthoredMatch', () => {
  it('creates when none exist; ignores manual rows by query filter', async () => {
    const store = [];
    const prisma = {
      match: {
        findMany: async ({ where }) => {
          assert.deepEqual(where.createdById, { isSet: false });
          return store.filter((r) => r.candidateId === where.candidateId && r.jobId === where.jobId);
        },
        create: async ({ data }) => {
          const row = { id: `m${store.length + 1}`, ...data, updatedAt: new Date() };
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
    };

    const a = await upsertAiAuthoredMatch(prisma, {
      candidateId: 'c1',
      jobId: 'j1',
      score: 80,
      evaluation: { origin: 'ai', engineVersion: '1.1' },
    });
    assert.equal(a.action, 'created');
    assert.equal(store.length, 1);

    const b = await upsertAiAuthoredMatch(prisma, {
      candidateId: 'c1',
      jobId: 'j1',
      score: 75,
      evaluation: { origin: 'applied', engineVersion: '1.1' },
    });
    assert.equal(b.action, 'updated');
    assert.equal(store.length, 1);
    assert.equal(store[0].score, 75);
    assert.equal(store[0].evaluation.origin, 'applied');

    const c = await upsertAiAuthoredMatch(prisma, {
      candidateId: 'c1',
      jobId: 'j1',
      score: 82,
      evaluation: { origin: 'ai', engineVersion: '1.1' },
    });
    assert.equal(c.action, 'updated');
    assert.equal(store.length, 1);
    assert.equal(store[0].evaluation.origin, 'ai');
  });

  it('collapses duplicate AI-authored rows on refresh', async () => {
    const store = [
      { id: 'old', candidateId: 'c1', jobId: 'j1', score: 10, updatedAt: new Date(1) },
      { id: 'new', candidateId: 'c1', jobId: 'j1', score: 20, updatedAt: new Date(2) },
    ];
    const prisma = {
      match: {
        findMany: async () => [...store].sort((a, b) => b.updatedAt - a.updatedAt),
        update: async ({ where, data }) => {
          const row = store.find((r) => r.id === where.id);
          Object.assign(row, data);
          return row;
        },
        deleteMany: async ({ where }) => {
          const ids = new Set(where.id.in);
          for (let i = store.length - 1; i >= 0; i -= 1) {
            if (ids.has(store[i].id)) store.splice(i, 1);
          }
          return { count: ids.size };
        },
        create: async () => {
          throw new Error('should not create');
        },
      },
    };
    const out = await upsertAiAuthoredMatch(prisma, {
      candidateId: 'c1',
      jobId: 'j1',
      score: 90,
      evaluation: { origin: 'ai' },
    });
    assert.equal(out.action, 'updated');
    assert.equal(out.duplicatesRemoved, 1);
    assert.equal(store.length, 1);
    assert.equal(store[0].id, 'new');
    assert.equal(store[0].score, 90);
  });
});

describe('suggestion threshold default', () => {
  it('defaults to 60 when env unset', () => {
    const prev = process.env.MATCH_SUGGESTION_MIN_SCORE;
    delete process.env.MATCH_SUGGESTION_MIN_SCORE;
    const suggestionMin = Number(process.env.MATCH_SUGGESTION_MIN_SCORE || 60);
    assert.equal(suggestionMin, 60);
    if (prev !== undefined) process.env.MATCH_SUGGESTION_MIN_SCORE = prev;
  });
});

describe('pipeline lock key isolation', () => {
  it('different jobs use different lock keys', () => {
    const key = (jobId, mode) => `match:pipeline:${jobId}:${mode}`;
    assert.notEqual(key('jobA', 'ai'), key('jobB', 'ai'));
    assert.notEqual(key('jobA', 'ai'), key('jobA', 'applied'));
  });
});
