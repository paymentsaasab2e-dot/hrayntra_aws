const { prisma } = require('../lib/prisma');

const DEFAULT_TTL_HOURS = 24;
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

let timer = null;

function getCutoff() {
  const ttlHours = Number(process.env.INCOMPLETE_ACCOUNT_TTL_HOURS) || DEFAULT_TTL_HOURS;
  return new Date(Date.now() - ttlHours * 60 * 60 * 1000);
}

async function cleanupIncompleteAccounts() {
  const cutoff = getCutoff();
  try {
    const staleCandidates = await prisma.candidate.findMany({
      where: {
        isVerified: false,
        createdAt: { lt: cutoff },
      },
      select: { id: true },
      take: 500,
    });

    const ids = staleCandidates.map((c) => c.id);
    if (ids.length === 0) return { removed: 0 };

    await prisma.$transaction(async (tx) => {
      await tx.otpVerification.deleteMany({
        where: { candidateId: { in: ids } },
      });
      await tx.candidate.deleteMany({
        where: { id: { in: ids } },
      });
    });

    console.log(`[incomplete-cleanup] removed ${ids.length} stale unverified candidate(s)`);
    return { removed: ids.length };
  } catch (error) {
    console.error('[incomplete-cleanup] failed:', error?.message || error);
    return { removed: 0, error: error?.message };
  }
}

function startIncompleteAccountCleanup() {
  if (timer) return;

  // Run once shortly after startup, then on the interval.
  setTimeout(() => void cleanupIncompleteAccounts(), 60 * 1000);
  timer = setInterval(() => void cleanupIncompleteAccounts(), CLEANUP_INTERVAL_MS);

  console.log('[incomplete-cleanup] scheduler started');
}

function stopIncompleteAccountCleanup() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = {
  startIncompleteAccountCleanup,
  stopIncompleteAccountCleanup,
  cleanupIncompleteAccounts,
};
