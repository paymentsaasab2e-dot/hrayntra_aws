const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  portalCandidateIdentityScore,
  isAbsorbablePortalDuplicate,
  portalLoginEmailWhere,
  pickPrimaryPortalCandidate,
  collapseRowsByPerson,
} = require('./portalCandidateIdentity');

describe('portalCandidateIdentity', () => {
  it('scores a filled profile above an OTP shell', () => {
    const shell = {
      id: 'shell',
      email: 'a@b.com',
      isVerified: false,
    };
    const filled = {
      id: 'filled',
      email: 'a@b.com',
      firstName: 'Rohit',
      lastName: 'Singh',
      personId: 'pid',
      isVerified: true,
      passwordHash: 'x',
      source: 'uat-manual',
    };
    assert.ok(portalCandidateIdentityScore(filled) > portalCandidateIdentityScore(shell));
    assert.equal(isAbsorbablePortalDuplicate(shell), true);
    assert.equal(isAbsorbablePortalDuplicate(filled), false);
    assert.equal(pickPrimaryPortalCandidate([shell, filled]).id, 'filled');
  });

  it('collapses two portal rows with the same email to the richer one', () => {
    const rows = [
      { id: '1', email: 'a@b.com', name: '—', personId: '' },
      { id: '2', email: 'a@b.com', name: 'Rohit Singh', personId: 'pid' },
    ];
    const collapsed = collapseRowsByPerson(rows, {
      personIdOf: (row) => row.personId,
      emailOf: (row) => row.email,
      scoreOf: (row) => (row.personId ? 16 : 0) + (row.name && row.name !== '—' ? 4 : 0),
    });
    assert.equal(collapsed.length, 1);
    assert.equal(collapsed[0].id, '2');
  });

  it('login email where matches candidate email or profile email', () => {
    assert.deepEqual(portalLoginEmailWhere('  rohit.singh.in@hotmail.com '), {
      OR: [
        { email: 'rohit.singh.in@hotmail.com' },
        { profile: { email: 'rohit.singh.in@hotmail.com' } },
      ],
    });
    assert.deepEqual(portalLoginEmailWhere(''), { id: { in: [] } });
  });
});
