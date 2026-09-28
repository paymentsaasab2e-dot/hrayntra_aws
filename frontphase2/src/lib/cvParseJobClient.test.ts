import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { waitForCvParseJob } from './cvParseJobClient.ts';

describe('waitForCvParseJob', () => {
  it('returns extracted fields when status becomes done', async () => {
    const calls = { n: 0 };
    const data = await waitForCvParseJob('cvj_1', {
      intervalMs: 0,
      getJob: async () => {
        calls.n += 1;
        if (calls.n < 2) return { status: 'queued' };
        return { status: 'done', data: { firstName: 'Ada' } };
      },
      wait: async () => {},
    });
    assert.equal(data.firstName, 'Ada');
    assert.equal(calls.n, 2);
  });

  it('does not time out while the job waits on the duplicate popup', async () => {
    let clock = 1_000_000;
    const calls = { n: 0 };
    const data = await waitForCvParseJob('cvj_1', {
      intervalMs: 0,
      now: () => (clock += 60_000), // +1 minute per poll
      getJob: async () => {
        calls.n += 1;
        // 5 minutes of waiting_user — well past the default 3-minute timeout.
        if (calls.n < 6) return { status: 'waiting_user' };
        return { status: 'done', data: { firstName: 'Ada' } };
      },
      wait: async () => {},
    });
    assert.equal(data.firstName, 'Ada');
    assert.equal(calls.n, 6);
  });

  it('still errors past the 30-minute hard cap in waiting_user', async () => {
    let clock = 1_000_000;
    await assert.rejects(
      () =>
        waitForCvParseJob('cvj_1', {
          intervalMs: 0,
          now: () => (clock += 5 * 60_000), // +5 minutes per poll
          getJob: async () => ({ status: 'waiting_user' }),
          wait: async () => {},
        }),
      /timed out/,
    );
  });

  it('throws the job error message', async () => {
    await assert.rejects(
      () =>
        waitForCvParseJob('cvj_1', {
          getJob: async () => ({ status: 'error', error: 'Invalid CV file' }),
          wait: async () => {},
        }),
      /Invalid CV file/,
    );
  });
});
