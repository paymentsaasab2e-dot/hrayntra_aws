/**
 * One human = one portal candidate row.
 * OTP hash-id shells must not sit beside a filled account with the same email.
 */

function portalCandidateIdentityScore(row) {
  if (!row) return -1;
  let score = 0;
  if (row.personId) score += 16;
  if (row.passwordHash) score += 8;
  if (row.isVerified) score += 8;
  if (String(row.firstName || '').trim() || String(row.lastName || '').trim()) score += 4;
  if (row.phone || row.whatsappNumber) score += 2;
  if (String(row.source || '').trim()) score += 1;
  return score;
}

/** Unverified OTP shell: no name, no person, no password. Safe to fold into the real account. */
function isAbsorbablePortalDuplicate(row) {
  if (!row) return false;
  return (
    !row.personId &&
    !row.passwordHash &&
    !row.isVerified &&
    !String(row.firstName || '').trim() &&
    !String(row.lastName || '').trim() &&
    !String(row.phone || '').trim()
  );
}

function portalLoginEmailWhere(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return { id: { in: [] } };
  return {
    OR: [{ email: normalized }, { profile: { email: normalized } }],
  };
}

function pickPrimaryPortalCandidate(rows) {
  const list = (Array.isArray(rows) ? rows : []).filter(Boolean);
  if (!list.length) return null;
  return [...list].sort((a, b) => {
    const byScore = portalCandidateIdentityScore(b) - portalCandidateIdentityScore(a);
    if (byScore) return byScore;
    return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
  })[0];
}

function collapseRowsByPerson(rows, { personIdOf, emailOf, scoreOf }) {
  const chosen = [];
  for (const row of rows || []) {
    if (!row) continue;
    const personId = String(personIdOf(row) || '').trim();
    const email = String(emailOf(row) || '').trim().toLowerCase();
    if (!personId && !email && scoreOf(row) <= 0) continue;
    const idx = chosen.findIndex((prev) => {
      const prevPerson = String(personIdOf(prev) || '').trim();
      const prevEmail = String(emailOf(prev) || '').trim().toLowerCase();
      return (personId && prevPerson && personId === prevPerson) || (email && prevEmail && email === prevEmail);
    });
    if (idx < 0) {
      chosen.push(row);
    } else if (scoreOf(row) > scoreOf(chosen[idx])) {
      chosen[idx] = row;
    }
  }
  return chosen;
}

module.exports = {
  portalCandidateIdentityScore,
  isAbsorbablePortalDuplicate,
  portalLoginEmailWhere,
  pickPrimaryPortalCandidate,
  collapseRowsByPerson,
};
