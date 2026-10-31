import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_JOB_PUBLISH_MONTHLY_LIMIT,
  JOB_PUBLISH_QUOTA_CODE,
  JOB_PUBLISH_QUOTA_HTTP_STATUS,
  buildJobPublishQuotaError,
  jobPublishMonthWindow,
  resolveJobPublishCharge,
  resolveJobPublishMonthlyLimit,
} from './jobPublishQuota.service.js';

describe('job publish quota helpers', () => {
  it('defaults to 10 free publishes per month', () => {
    assert.equal(resolveJobPublishMonthlyLimit(''), DEFAULT_JOB_PUBLISH_MONTHLY_LIMIT);
    assert.equal(resolveJobPublishMonthlyLimit(undefined), 10);
    assert.equal(resolveJobPublishMonthlyLimit('not-a-number'), 10);
    assert.equal(resolveJobPublishMonthlyLimit('25'), 25);
    assert.equal(resolveJobPublishMonthlyLimit('7.9'), 7);
  });

  it('treats a non-positive limit as unlimited (premium)', () => {
    assert.ok(resolveJobPublishMonthlyLimit('0') <= 0);
    assert.ok(resolveJobPublishMonthlyLimit('-1') <= 0);
  });

  it('builds the calendar-month window (server-local)', () => {
    const { monthKey, windowStart, windowEnd } = jobPublishMonthWindow(new Date(2026, 9, 31, 23, 59));
    assert.equal(monthKey, '2026-10');
    assert.equal(windowStart.getTime(), new Date(2026, 9, 1).getTime());
    assert.equal(windowEnd.getTime(), new Date(2026, 10, 1).getTime());
  });

  it('rolls the window across year boundaries', () => {
    const { monthKey, windowStart, windowEnd } = jobPublishMonthWindow(new Date(2026, 11, 15));
    assert.equal(monthKey, '2026-12');
    assert.equal(windowStart.getTime(), new Date(2026, 11, 1).getTime());
    assert.equal(windowEnd.getTime(), new Date(2027, 0, 1).getTime());
  });

  it('charges only the first publish — draft, edits, and re-opens stay free', () => {
    // Not a publish at all.
    assert.equal(
      resolveJobPublishCharge({ existingStatus: 'DRAFT', requestedStatus: 'ON_HOLD' }),
      'none',
    );
    assert.equal(
      resolveJobPublishCharge({ existingStatus: 'DRAFT', requestedStatus: 'CLOSED' }),
      'none',
    );
    // Edit while live — never a new publish.
    assert.equal(
      resolveJobPublishCharge({ existingStatus: 'OPEN', requestedStatus: 'OPEN' }),
      'none',
    );
    // First publish consumes a slot.
    assert.equal(
      resolveJobPublishCharge({ existingStatus: 'DRAFT', requestedStatus: 'OPEN' }),
      'first-publish',
    );
    // Re-open after close — the slot was already consumed, no double charge.
    assert.equal(
      resolveJobPublishCharge({
        existingStatus: 'CLOSED',
        firstPublishedAt: new Date(2026, 8, 3),
        requestedStatus: 'OPEN',
      }),
      'republish',
    );
    assert.equal(
      resolveJobPublishCharge({
        existingStatus: 'ON_HOLD',
        firstPublishedAt: new Date(2026, 9, 3),
        requestedStatus: 'OPEN',
      }),
      'republish',
    );
    // Legacy row never stamped — its tracked first publish counts now.
    assert.equal(
      resolveJobPublishCharge({ existingStatus: 'ON_HOLD', requestedStatus: 'OPEN' }),
      'first-publish',
    );
    // Label-driven publish ("Active" maps to OPEN before reaching the service).
    assert.equal(
      resolveJobPublishCharge({ existingStatus: 'draft', requestedStatus: 'open' }),
      'first-publish',
    );
  });

  it('builds the Premium-modal payload on the 402 error', () => {
    const quota = {
      used: 10,
      limit: 10,
      remaining: 0,
      warnAt: 8,
      monthKey: '2026-10',
      monthLabel: 'October 2026',
      windowStart: new Date(2026, 9, 1),
      windowEnd: new Date(2026, 10, 1),
    };
    const error = buildJobPublishQuotaError(quota, { jobId: 'abc123', draftSaved: true });
    assert.equal(error.statusCode, JOB_PUBLISH_QUOTA_HTTP_STATUS);
    assert.equal(error.code, JOB_PUBLISH_QUOTA_CODE);
    assert.equal(error.meta.jobId, 'abc123');
    assert.equal(error.meta.draftSaved, true);
    assert.equal(error.meta.quota.used, 10);
    assert.equal(error.meta.quota.limit, 10);
    assert.equal(error.meta.quota.remaining, 0);
    assert.equal(error.meta.quota.upgradeRequired, true);
    assert.equal(error.meta.quota.monthKey, '2026-10');
    assert.match(error.message, /October 2026/);
    assert.match(error.message, /saved as a draft/i);
  });
});
