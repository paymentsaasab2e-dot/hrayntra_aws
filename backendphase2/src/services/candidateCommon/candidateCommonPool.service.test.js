import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mapCandidateCommonRowToCandidate } from './candidateCommonPool.service.js';

describe('mapCandidateCommonRowToCandidate', () => {
  it('passes through personId, emailNormalized and phoneE164', () => {
    const row = {
      candidateId: '507f1f77bcf86cd799439011',
      personId: 'person-abc-123',
      emailNormalized: 'john.doe@example.com',
      phoneE164: '+919876543210',
      firstName: 'John',
      lastName: 'Doe',
      email: 'John@Example.COM',
      phone: '+91 98765 43210',
      source: 'phase1',
    };
    const mapped = mapCandidateCommonRowToCandidate(row);
    assert.equal(mapped.id, '507f1f77bcf86cd799439011');
    assert.equal(mapped.personId, 'person-abc-123');
    assert.equal(mapped.emailNormalized, 'john.doe@example.com');
    assert.equal(mapped.phoneE164, '+919876543210');
    assert.equal(mapped.email, 'John@Example.COM');
  });

  it('returns null when candidateId is missing', () => {
    const mapped = mapCandidateCommonRowToCandidate({ personId: 'p' });
    assert.equal(mapped, null);
  });
});
