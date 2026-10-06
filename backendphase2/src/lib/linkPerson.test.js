import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { linkPersonToTenant } from './linkPerson.js';

describe('linkPersonToTenant', () => {
  it('requires personId', async () => {
    await assert.rejects(() => linkPersonToTenant({}), { statusCode: 400 });
  });

  it('returns existing tenant row and does not create', async () => {
    let materialized = false;
    const result = await linkPersonToTenant(
      { personId: 'person-1', jobId: 'job-9' },
      {
        findExisting: async () => ({ id: 'crm-1', assignedJobs: ['job-1'] }),
        findPurged: async () => null,
        fetchCommon: async () => {
          throw new Error('should not fetch common');
        },
        materialize: async () => {
          materialized = true;
          return { id: 'crm-1' };
        },
      },
    );
    assert.deepEqual(result, { candidateId: 'crm-1', created: false, attached: true });
    assert.equal(materialized, true);
  });

  it('blocks purged personId', async () => {
    await assert.rejects(
      () =>
        linkPersonToTenant(
          { personId: 'person-1' },
          {
            findExisting: async () => null,
            findPurged: async () => ({ candidateId: 'gone' }),
            fetchCommon: async () => ({ id: 'x' }),
            materialize: async () => ({ id: 'x' }),
          },
        ),
      { statusCode: 409 },
    );
  });

  it('creates from common when tenant has no row', async () => {
    const result = await linkPersonToTenant(
      { personId: 'person-1' },
      {
        findExisting: async () => null,
        findPurged: async () => null,
        fetchCommon: async () => ({ id: 'portal-1', personId: 'person-1', email: 'a@b.com' }),
        materialize: async (row) => ({ id: row.id, personId: row.personId }),
      },
    );
    assert.deepEqual(result, { candidateId: 'portal-1', created: true, attached: true });
  });

  it('404 when person is not in tenant or common', async () => {
    await assert.rejects(
      () =>
        linkPersonToTenant(
          { personId: 'person-missing' },
          {
            findExisting: async () => null,
            findPurged: async () => null,
            fetchCommon: async () => null,
            materialize: async () => ({ id: 'nope' }),
          },
        ),
      { statusCode: 404 },
    );
  });
});
