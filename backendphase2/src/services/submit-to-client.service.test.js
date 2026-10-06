import test from 'node:test';
import assert from 'node:assert/strict';
import { executeSubmitToClient } from './submit-to-client.service.js';

test('submit-to-client.service', async (t) => {
  await t.test('throws error if recipient emails are empty', async () => {
    const mockHelpers = {
      getInterviewOrThrow: async () => ({ id: 'int-1', clientId: 'cli-1' }),
      getClientRecipients: async () => [],
      isDeliverableEmail: (e) => false,
    };

    await assert.rejects(
      async () => {
        await executeSubmitToClient('int-1', {}, { id: 'u1' }, mockHelpers);
      },
      /No client email found/
    );
  });

  await t.test('executes submission, generates token, and tracks durationMs', async () => {
    const mockInterview = {
      id: '507f1f77bcf86cd799439011',
      candidateId: '507f1f77bcf86cd799439012',
      jobId: '507f1f77bcf86cd799439013',
      clientId: '507f1f77bcf86cd799439014',
      candidate: { id: '507f1f77bcf86cd799439012', name: 'John Doe' },
      job: { title: 'Software Engineer' },
      client: { companyName: 'Acme Corp' },
    };

    const mockHelpers = {
      getInterviewOrThrow: async () => mockInterview,
      getClientRecipients: async () => ['client@acme.test'],
      isDeliverableEmail: (e) => e.includes('@'),
      normalizeSubmissionType: (t) => t || 'INITIAL_REVIEW',
      inferSubmissionType: () => 'INITIAL_REVIEW',
      createClientReviewToken: () => 'valid-mock-token',
      toClientReviewUrl: async () => 'https://review.test/valid-mock-token',
      sendMatchSubmissionEmail: async () => ({ success: true }),
      mapInterviewCandidateForEmail: (c) => ({ id: c.id, name: c.name }),
    };

    const result = await executeSubmitToClient('507f1f77bcf86cd799439011', {
      toEmail: 'client@acme.test',
      submissionType: 'INITIAL_REVIEW',
    }, { id: 'u1', name: 'Recruiter' }, mockHelpers);

    assert.strictEqual(result.success, true);
    assert.deepStrictEqual(result.recipients, ['client@acme.test']);
    assert.strictEqual(result.reviewUrl, 'https://review.test/valid-mock-token');
    assert.strictEqual(typeof result.durationMs, 'number');
    assert.ok(result.durationMs >= 0);
  });
});
