'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateFreshnessScore,
  calculateRankingScore,
  combineMatchAccuracy,
  RELEVANCE_FLOOR,
} = require('./job-matching-pipeline-phase1.service');

describe('Phase1 matching ranking + freshness', () => {
  it('Test 1 — newer slightly lower match ranks above older higher match', () => {
    const now = Date.now();
    const jobAMatch = 80;
    const jobBMatch = 75;
    const freshnessA = calculateFreshnessScore(new Date(now - 30 * 24 * 60 * 60 * 1000), { now });
    const freshnessB = calculateFreshnessScore(new Date(now - 2 * 24 * 60 * 60 * 1000), { now });
    const rankA = calculateRankingScore(jobAMatch, freshnessA);
    const rankB = calculateRankingScore(jobBMatch, freshnessB);

    assert.equal(jobAMatch, 80);
    assert.equal(jobBMatch, 75);
    assert.ok(freshnessB > freshnessA);
    assert.ok(rankB > rankA, `expected B (${rankB}) > A (${rankA})`);
  });

  it('Test 2 — strong old job stays above poor new job (relevance floor)', () => {
    const now = Date.now();
    const freshnessA = calculateFreshnessScore(new Date(now - 30 * 24 * 60 * 60 * 1000), { now });
    const freshnessB = calculateFreshnessScore(new Date(now), { now });
    const rankA = calculateRankingScore(90, freshnessA);
    const rankB = calculateRankingScore(45, freshnessB);

    assert.ok(45 < RELEVANCE_FLOOR);
    assert.equal(rankB, 45);
    assert.ok(rankA > rankB);
  });

  it('Test 3 — same match prefers fresher job', () => {
    const now = Date.now();
    const freshnessA = calculateFreshnessScore(new Date(now - 10 * 24 * 60 * 60 * 1000), { now });
    const freshnessB = calculateFreshnessScore(new Date(now - 2 * 24 * 60 * 60 * 1000), { now });
    const rankA = calculateRankingScore(80, freshnessA);
    const rankB = calculateRankingScore(80, freshnessB);
    assert.ok(rankB > rankA);
  });

  it('Test 4 — same match + same freshness is stable numeric', () => {
    const freshness = calculateFreshnessScore(new Date('2026-01-01T00:00:00.000Z'), {
      now: new Date('2026-01-11T00:00:00.000Z').getTime(),
    });
    const a = calculateRankingScore(80, freshness);
    const b = calculateRankingScore(80, freshness);
    assert.equal(a, b);
  });

  it('Test 5 — AI unavailable falls back to rule score', () => {
    const accuracy = combineMatchAccuracy(72, null);
    assert.equal(accuracy, 72);
  });

  it('Test 6 — AI blend uses 70/30 without changing inputs', () => {
    const accuracy = combineMatchAccuracy(80, 70);
    assert.equal(accuracy, 77);
  });

  it('Test 7 — hard required-skill miss caps match accuracy', () => {
    const accuracy = combineMatchAccuracy(90, 95, { hardSkillMiss: true });
    assert.ok(accuracy <= 45);
  });

  it('Test 8 — freshness does not change match accuracy', () => {
    const match = combineMatchAccuracy(75, null);
    const freshness = calculateFreshnessScore(new Date());
    const ranking = calculateRankingScore(match, freshness);
    assert.equal(match, 75);
    assert.notEqual(ranking, freshness);
  });

  it('freshness decays gradually (~30 day tau)', () => {
    const now = Date.now();
    const today = calculateFreshnessScore(new Date(now), { now });
    const day30 = calculateFreshnessScore(new Date(now - 30 * 24 * 60 * 60 * 1000), { now });
    assert.ok(today > 99);
    assert.ok(day30 > 35 && day30 < 40);
  });
});
