import test from 'node:test';
import assert from 'node:assert/strict';
import { candidateDetailInclude, getCandidateDetailsById } from './candidate-details.service.js';

test('candidate-details.service', async (t) => {
  await t.test('exports valid candidateDetailInclude configuration', () => {
    assert.ok(candidateDetailInclude);
    assert.ok(candidateDetailInclude.assignedTo);
    assert.ok(candidateDetailInclude.interviews);
    assert.ok(candidateDetailInclude.pipelineEntries);
    assert.ok(candidateDetailInclude.applications);
  });

  await t.test('getCandidateDetailsById returns null gracefully if candidate is missing (arbitrary ID)', async () => {
    const result = await getCandidateDetailsById('non-existent-candidate-id-999999');
    assert.strictEqual(result, null);
  });

  await t.test('getCandidateDetailsById returns null gracefully if candidate is missing (valid 24-char ObjectID)', async () => {
    const result = await getCandidateDetailsById('507f1f77bcf86cd799439011');
    assert.strictEqual(result, null);
  });
});
