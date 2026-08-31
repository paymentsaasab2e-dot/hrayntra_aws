import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  alreadyOptedIntoExternalFeeds,
  feedSkipReason,
  mergeFeedDistributionPlatforms,
} from './hq-portal-feed-push.util.js';

describe('hq portal feed push helpers', () => {
  it('merges Adzuna and Careerjet onto existing platforms without dropping other keys', () => {
    const merged = mergeFeedDistributionPlatforms({ hryantra: true, naukri: false });
    assert.equal(merged.hryantra, true);
    assert.equal(merged.naukri, false);
    assert.equal(merged.adzuna, true);
    assert.equal(merged.careerjet, true);
  });

  it('treats missing platforms as not opted in', () => {
    assert.equal(alreadyOptedIntoExternalFeeds({ publishToAdzuna: true }), false);
    assert.equal(
      alreadyOptedIntoExternalFeeds({
        publishToAdzuna: true,
        publishToCareerjet: true,
        distributionPlatforms: { adzuna: true, careerjet: true },
      }),
      true,
    );
  });

  it('skips draft, deleted, expired, and internal jobs', () => {
    assert.equal(feedSkipReason({ status: 'DRAFT' }), 'draft');
    assert.equal(feedSkipReason({ status: 'OPEN', isDeleted: true }), 'deleted');
    assert.equal(
      feedSkipReason({ status: 'OPEN', expectedClosureDate: new Date('2000-01-01') }),
      'expired',
    );
    assert.equal(feedSkipReason({ status: 'OPEN', visibility: 'Internal' }), 'not_public');
    assert.equal(feedSkipReason({ status: 'OPEN' }), null);
  });
});
