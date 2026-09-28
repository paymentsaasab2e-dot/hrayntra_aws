import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

process.env.HEADQUARTERS_DATABASE_URL = process.env.HEADQUARTERS_DATABASE_URL || 'mongodb://localhost:27017/test';
process.env.DATABASE_URL = process.env.DATABASE_URL || '';

describe('ensureCandidateMaterializedForMatch personId dedup', () => {
  async function loadModule() {
    const { ensureCandidateMaterializedForMatch } = await import('./candidate.service.js');
    const prismaMod = await import('../../config/prisma.js');
    return { ensureCandidateMaterializedForMatch, prisma: prismaMod.prisma, runWithTenantContext: prismaMod.runWithTenantContext };
  }

  it('existing personId returns existing id and does not create', async () => {
    const { ensureCandidateMaterializedForMatch, prisma, runWithTenantContext } = await loadModule();

    const result = await runWithTenantContext('test', async () => {
      const candidateModel = prisma.candidate;
      candidateModel.findUnique = async () => null;
      candidateModel.findFirst = async () => ({ id: 'existing-crm-id', assignedJobs: ['job-1'] });
      candidateModel.update = async () => ({ id: 'existing-crm-id' });
      candidateModel.create = async () => { throw new Error('create should not be called'); };

      return ensureCandidateMaterializedForMatch({
        id: 'portal-2',
        personId: 'person-1',
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.com',
        assignedJobs: ['job-2'],
        source: 'Job portal',
      }, { matchingJobId: 'job-2' });
    });

    assert.deepEqual(result, { id: 'existing-crm-id', materialized: true });
  });

  it('missing personId creates candidate with personId on the new row', async () => {
    const { ensureCandidateMaterializedForMatch, prisma, runWithTenantContext } = await loadModule();

    const result = await runWithTenantContext('test', async () => {
      const candidateModel = prisma.candidate;
      candidateModel.findUnique = async () => null;
      candidateModel.findFirst = async () => null;
      candidateModel.update = async () => { throw new Error('update should not be called'); };
      candidateModel.create = async (args) => ({ id: 'new-crm-id', personId: args?.data?.personId });

      return ensureCandidateMaterializedForMatch({
        id: 'portal-1',
        personId: 'person-1',
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.com',
        assignedJobs: [],
        source: 'phase1',
      }, {});
    });

    assert.deepEqual(result, { id: 'new-crm-id', materialized: true });
  });
});
