import { prisma } from '../config/prisma.js';

function normalizeEmail(email = '') {
  return String(email || '').trim().toLowerCase();
}

function escapeReg(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripCopySuffix(lastName) {
  return String(lastName || '').replace(/\s+copy\s+\d+$/i, '').trim();
}

const notDeletedClause = {
  OR: [{ isDeleted: false }, { isDeleted: null }],
};

/**
 * @returns {Promise<{ match: 'email' | 'name', candidate: object } | null>}
 */
export async function findExistingCandidateDuplicate({ email, firstName, lastName }) {
  const fn = String(firstName || '').trim();
  const ln = String(lastName || '').trim();
  const em = normalizeEmail(email);

  const select = {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    designation: true,
    currentTitle: true,
    createdAt: true,
  };

  if (em) {
    const byEmail = await prisma.candidate.findFirst({
      where: {
        AND: [notDeletedClause, { email: { equals: em, mode: 'insensitive' } }],
      },
      select,
    });
    if (byEmail) {
      console.log('[bulk-cv] duplicate FOUND by email', { existingId: byEmail.id, email: em });
      return { match: 'email', candidate: byEmail };
    }
  }

  if (fn && ln) {
    const byName = await prisma.candidate.findFirst({
      where: {
        AND: [
          notDeletedClause,
          { firstName: { equals: fn, mode: 'insensitive' } },
          { lastName: { equals: ln, mode: 'insensitive' } },
        ],
      },
      select,
    });
    if (byName) {
      console.log('[bulk-cv] duplicate FOUND by name', {
        existingId: byName.id,
        name: `${byName.firstName} ${byName.lastName}`,
      });
      return { match: 'name', candidate: byName };
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
        notDeletedClause,
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
  const norm = normalizeEmail(email);
  if (!norm || !norm.includes('@')) {
    const fallback = `bulkcv-${Date.now().toString(36)}@noemail.hrayntra.local`;
    console.log('[bulk-cv] synthetic email (no valid base)', fallback);
    return fallback;
  }
  const [local, domain] = norm.split('@');
  if (!domain) {
    const fallback = `bulkcv-${Date.now().toString(36)}@noemail.hrayntra.local`;
    return fallback;
  }

  for (let n = 1; n <= 80; n += 1) {
    const candidateEmail =
      n === 1 ? `${local}+bulkcv@${domain}` : `${local}+bulkcv${n}@${domain}`;
    const exists = await prisma.candidate.findFirst({
      where: { email: { equals: candidateEmail, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!exists) {
      console.log('[bulk-cv] assign unique email variant', candidateEmail);
      return candidateEmail;
    }
  }

  const fallback = `bulkcv-${Date.now().toString(36)}@noemail.hrayntra.local`;
  console.log('[bulk-cv] synthetic email (variants exhausted)', fallback);
  return fallback;
}
