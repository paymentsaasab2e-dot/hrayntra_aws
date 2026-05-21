import { prisma } from '../config/prisma.js';

/** Active candidates only — matches Candidates list (`isDeleted: { not: true }`). */
export const activeCandidateClause = { isDeleted: { not: true } };

/** @deprecated Use activeCandidateClause */
export const notDeletedClause = activeCandidateClause;

function isPhase1CandidateSource(source) {
  return String(source || '').trim().toLowerCase() === 'phase1';
}

function candidateHasRealJobLinkFromRow(row) {
  if (!row) return false;
  const assigned = Array.isArray(row.assignedJobs) ? row.assignedJobs : [];
  if (assigned.some((id) => String(id || '').trim())) return true;
  if (row._count?.applications > 0) return true;
  if (row._count?.pipelineEntries > 0) return true;
  return false;
}

/**
 * CRM list hides phase1 snapshot rows with no job link. Those must not block bulk CV re-import
 * when the user has cleared the visible Candidates page.
 */
export function shouldTreatAsActiveDuplicate(existing) {
  if (!existing) return false;
  if (isPhase1CandidateSource(existing.source) && !candidateHasRealJobLinkFromRow(existing)) {
    return false;
  }
  const hasIdentity =
    Boolean(String(existing.firstName || '').trim()) ||
    Boolean(String(existing.lastName || '').trim()) ||
    Boolean(String(existing.email || '').trim());
  if (!hasIdentity && !candidateHasRealJobLinkFromRow(existing)) {
    return false;
  }
  return true;
}

/**
 * Normalize email for duplicate comparison: trim, lowercase, remove all whitespace.
 * @param {unknown} email
 * @returns {string} Normalized email or empty string if missing/invalid.
 */
export function normalizeCandidateEmailForDuplicate(email = '') {
  if (email === undefined || email === null) return '';
  const normalized = String(email).trim().toLowerCase().replace(/\s+/g, '');
  if (!normalized || !normalized.includes('@')) return '';
  return normalized;
}

/**
 * True when two emails are the same full address (case-insensitive, no extra spaces).
 * @param {unknown} a
 * @param {unknown} b
 */
export function candidateEmailsAreDuplicate(a, b) {
  const left = normalizeCandidateEmailForDuplicate(a);
  const right = normalizeCandidateEmailForDuplicate(b);
  if (!left || !right) return false;
  return left === right;
}

function escapeReg(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripCopySuffix(lastName) {
  return String(lastName || '').replace(/\s+copy\s+\d+$/i, '').trim();
}

const duplicateSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  designation: true,
  currentTitle: true,
  createdAt: true,
  source: true,
  assignedJobs: true,
  _count: {
    select: {
      applications: true,
      pipelineEntries: true,
    },
  },
};

function duplicateCandidateResult(candidate) {
  if (!shouldTreatAsActiveDuplicate(candidate)) {
    return null;
  }
  return { match: 'email', candidate };
}

/**
 * Duplicate detection: email only (names are ignored).
 * Compares the full normalized address one-by-one against active, visible CRM candidates.
 *
 * @returns {Promise<{ match: 'email', candidate: object } | null>}
 */
export async function findExistingCandidateDuplicate({ email, firstName: _firstName, lastName: _lastName }) {
  const normalizedIncoming = normalizeCandidateEmailForDuplicate(email);
  if (!normalizedIncoming) {
    return null;
  }

  // Fast path: exact match when DB email is already normalized
  const byEmail = await prisma.candidate.findFirst({
    where: {
      AND: [
        activeCandidateClause,
        { email: { equals: normalizedIncoming, mode: 'insensitive' } },
      ],
    },
    select: duplicateSelect,
  });
  if (byEmail && candidateEmailsAreDuplicate(normalizedIncoming, byEmail.email)) {
    const result = duplicateCandidateResult(byEmail);
    if (result) {
      console.log('[bulk-cv] duplicate FOUND by email', {
        existingId: byEmail.id,
        email: normalizedIncoming,
      });
      return result;
    }
  }

  // One-by-one: catch stored emails with spaces/casing Prisma equality may miss
  const withEmail = await prisma.candidate.findMany({
    where: {
      AND: [
        activeCandidateClause,
        { email: { not: null } },
        { email: { not: '' } },
      ],
    },
    select: duplicateSelect,
  });

  for (const candidate of withEmail) {
    if (candidateEmailsAreDuplicate(normalizedIncoming, candidate.email)) {
      const result = duplicateCandidateResult(candidate);
      if (result) {
        console.log('[bulk-cv] duplicate FOUND by email (normalized scan)', {
          existingId: candidate.id,
          email: normalizedIncoming,
          stored: candidate.email,
        });
        return result;
      }
    }
  }

  return null;
}

/**
 * Next "Lastname copy N" for create_anyway (N increments across existing rows with same first name + base last).
 */
export async function nextCopyLastNameForBulk(firstName, currentLastName) {
  const fn = String(firstName || '').trim();
  const base = stripCopySuffix(currentLastName);
  if (!fn || !base) return String(currentLastName || '').trim() || 'Candidate';

  const rows = await prisma.candidate.findMany({
    where: {
      AND: [
        activeCandidateClause,
        { firstName: { equals: fn, mode: 'insensitive' } },
        {
          OR: [
            { lastName: { equals: base, mode: 'insensitive' } },
            { lastName: { startsWith: `${base} copy `, mode: 'insensitive' } },
          ],
        },
      ],
    },
    select: { lastName: true },
  });

  let maxN = 0;
  const reExact = new RegExp(`^${escapeReg(base)}$`, 'i');
  const reCopy = new RegExp(`^${escapeReg(base)}\\s+copy\\s+(\\d+)$`, 'i');
  for (const r of rows) {
    const ln = String(r.lastName || '');
    if (reExact.test(ln)) maxN = Math.max(maxN, 0);
    const m = ln.match(reCopy);
    if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
  }

  const next = `${base} copy ${maxN + 1}`;
  console.log('[bulk-cv] assign copy lastName', { firstName: fn, next });
  return next;
}

/**
 * When duplicate matched by email, ensure a unique mailbox so create can succeed.
 */
export async function nextUniqueEmailVariant(email) {
  const norm = normalizeCandidateEmailForDuplicate(email);
  if (!norm || !norm.includes('@')) {
    return null;
  }
  const [local, domain] = norm.split('@');
  if (!local || !domain) {
    return null;
  }

  for (let n = 1; n <= 80; n += 1) {
    const candidateEmail =
      n === 1 ? `${local}+bulkcv@${domain}` : `${local}+bulkcv${n}@${domain}`;
    const exists = await prisma.candidate.findFirst({
      where: {
        AND: [
          activeCandidateClause,
          { email: { equals: candidateEmail, mode: 'insensitive' } },
        ],
      },
      select: { id: true, email: true },
    });
    if (!exists || !candidateEmailsAreDuplicate(candidateEmail, exists.email)) {
      console.log('[bulk-cv] assign unique email variant', candidateEmail);
      return candidateEmail;
    }
  }

  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const stampEmail = `${local}+bulkcv${stamp}@${domain}`;
  const stampExists = await prisma.candidate.findFirst({
    where: {
      AND: [
        activeCandidateClause,
        { email: { equals: stampEmail, mode: 'insensitive' } },
      ],
    },
    select: { id: true, email: true },
  });
  if (!stampExists || !candidateEmailsAreDuplicate(stampEmail, stampExists.email)) {
    console.log('[bulk-cv] assign unique email stamp variant', stampEmail);
    return stampEmail;
  }
  console.warn('[bulk-cv] could not assign unique email variant');
  return null;
}
