import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dedupeCandidatesByPerson } from './dedupeCandidatesByPerson.js';

describe('dedupeCandidatesByPerson', () => {
  it('two rows with the same personId collapse to one', () => {
    const rows = [
      { id: 'p1', personId: 'person-abc', email: 'john@example.com' },
      { id: 'p2', personId: 'person-abc', email: 'john@example.com' },
    ];
    const result = dedupeCandidatesByPerson(rows);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'p1');
  });

  it('two rows with the same email but null personId collapse to one', () => {
    const rows = [
      { id: 'e1', personId: null, email: 'Jane@Example.COM' },
      { id: 'e2', personId: null, email: 'jane@example.com' },
    ];
    const result = dedupeCandidatesByPerson(rows);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'e1');
  });

  it('two rows with different emails stay separate', () => {
    const rows = [
      { id: 'a', email: 'alice@example.com' },
      { id: 'b', email: 'bob@example.com' },
    ];
    const result = dedupeCandidatesByPerson(rows);
    assert.equal(result.length, 2);
  });

  it('deleted rows are dropped', () => {
    const rows = [
      { id: 'a', email: 'alice@example.com' },
      { id: 'b', email: 'alice@example.com', isDeleted: true },
    ];
    const result = dedupeCandidatesByPerson(rows);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'a');
  });

  it('prefers a tenant CRM row over a phase1-only row on collision', () => {
    const rows = [
      { id: 'pool', personId: 'p1', email: 'john@example.com', source: 'phase1' },
      { id: 'crm', personId: 'p1', email: 'john@example.com', source: 'Job portal', status: 'ACTIVE', assignedJobs: ['job-1'] },
    ];
    const result = dedupeCandidatesByPerson(rows);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'crm');
  });
});
