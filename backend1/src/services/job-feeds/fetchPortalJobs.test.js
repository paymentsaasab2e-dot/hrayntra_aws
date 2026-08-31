const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { fetchAllPortalJobs, BATCH_SIZE } = require('./fetchPortalJobs');

describe('portal job loader', () => {
  it('pages through Prisma findMany instead of a hard 2000 cap', async () => {
    const pages = [
      Array.from({ length: BATCH_SIZE }, (_, i) => ({ id: `a${i}`, title: 'A' })),
      Array.from({ length: BATCH_SIZE }, (_, i) => ({ id: `b${i}`, title: 'B' })),
      Array.from({ length: 17 }, (_, i) => ({ id: `c${i}`, title: 'C' })),
    ];
    let calls = 0;
    const prisma = {
      job: {
        findMany: async () => {
          const page = pages[calls] || [];
          calls += 1;
          return page;
        },
      },
    };
    const jobs = await fetchAllPortalJobs(prisma);
    assert.equal(jobs.length, BATCH_SIZE * 2 + 17);
    assert.equal(calls, 3);
  });

  it('throws when the database client cannot list jobs', async () => {
    await assert.rejects(() => fetchAllPortalJobs(null), /unavailable/i);
    await assert.rejects(() => fetchAllPortalJobs({}), /cannot list jobs/i);
  });
});
