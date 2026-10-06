import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { enqueueBulkCvParseJob, enqueueCvParseJob, getCvParseJob } from './cvParseJob.service.js';
import { cvParseJobController } from '../controllers/cvParseJob.controller.js';

const sampleFile = {
  originalname: 'test.pdf',
  mimetype: 'application/pdf',
  size: 12,
  path: null,
  buffer: Buffer.from('resume'),
};

describe('cvParseJob.service', () => {
  it('exports cvParseJobController handlers', () => {
    assert.equal(typeof cvParseJobController.createParseJob, 'function');
    assert.equal(typeof cvParseJobController.getParseJob, 'function');
  });

  it('enqueue returns queued immediately and does not call parse synchronously', async () => {
    let called = false;
    const result = enqueueCvParseJob({
      file: sampleFile,
      tenantDbName: 'tenant-a',
      parseFn: async () => {
        called = true;
        return { firstName: 'A' };
      },
    });
    assert.equal(result.status, 'queued');
    assert.equal(result.jobId.startsWith('cvj_'), true);
    assert.equal(called, false);

    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(called, true);
  });

  it('getJob returns done data after mocked worker completes', async () => {
    const result = enqueueCvParseJob({
      file: sampleFile,
      tenantDbName: 'tenant-a',
      parseFn: async () => ({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        phone: '+91 98765 43210',
      }),
    });

    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    const job = getCvParseJob(result.jobId, 'tenant-a');
    assert.equal(job.status, 'done');
    assert.equal(job.data.firstName, 'Jane');
    assert.equal(job.data.email, 'jane@example.com');
    assert.equal(typeof job.data.resumeSha256, 'string');
    assert.equal(job.data.resumeSha256.length, 64);
  });

  it('getJob returns null for unknown job id', () => {
    assert.equal(getCvParseJob('cvj_does_not_exist', 'tenant-a'), null);
  });

  it('getJob returns null when caller tenant does not match', async () => {
    const result = enqueueCvParseJob({
      file: sampleFile,
      tenantDbName: 'tenant-a',
      parseFn: async () => ({ firstName: 'A' }),
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(getCvParseJob(result.jobId, 'tenant-b'), null);
    assert.ok(getCvParseJob(result.jobId, 'tenant-a'));
  });

  it('bulk enqueue returns queued with fileIndex/sessionId and does not parse synchronously', async () => {
    let called = false;
    const result = enqueueBulkCvParseJob({
      file: sampleFile,
      tenantDbName: 'tenant-a',
      sessionId: 'sess-1',
      fileIndex: 3,
      keepFile: true,
      parseFn: async () => {
        called = true;
        return { normalized: { firstName: 'A' }, fileIndex: 3, tokenUsage: null };
      },
    });
    assert.equal(result.status, 'queued');
    assert.equal(result.fileIndex, 3);
    assert.equal(result.sessionId, 'sess-1');
    assert.equal(result.jobId.startsWith('cvj_'), true);
    assert.equal(called, false);

    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(called, true);

    await new Promise((resolve) => setImmediate(resolve));
    const job = getCvParseJob(result.jobId, 'tenant-a');
    assert.equal(job.status, 'done');
    assert.equal(job.data.normalized.firstName, 'A');
    assert.equal(job.data.fileIndex, 3);
  });

  it('enqueue with empty tenant does not call parseFn', async () => {
    let called = false;
    const result = enqueueCvParseJob({
      file: sampleFile,
      tenantDbName: '',
      parseFn: async () => {
        called = true;
        return { firstName: 'A' };
      },
    });
    assert.equal(result.status, 'error');
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(called, false);
  });
});
