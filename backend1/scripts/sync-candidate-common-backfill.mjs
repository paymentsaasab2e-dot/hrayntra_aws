/**
 * Backfill candidatecommon DB from all verified Phase 1 candidates.
 * Usage (from backend1): node scripts/sync-candidate-common-backfill.mjs
 */
import { PrismaClient } from '@prisma/client';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { syncCandidateToCommon } = require('../src/services/candidateCommonSync.service.js');

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function main() {
  const batchSize = Number(process.env.COMMON_BACKFILL_BATCH || 50) || 50;
  let skip = 0;
  let total = 0;
  let ok = 0;

  console.log('[backfill] Starting candidatecommon sync…');

  for (;;) {
    const rows = await prisma.candidate.findMany({
      where: { isVerified: true },
      select: { id: true },
      take: batchSize,
      skip,
      orderBy: { id: 'asc' },
    });
    if (!rows.length) break;

    for (const row of rows) {
      total += 1;
      const result = await syncCandidateToCommon(row.id);
      if (result) ok += 1;
    }

    console.log(`[backfill] batch skip=${skip} processed=${total} synced=${ok}`);
    skip += rows.length;
    if (rows.length < batchSize) break;
  }

  console.log(`[backfill] Done. processed=${total} synced=${ok}`);
}

main()
  .catch((err) => {
    console.error('[backfill] failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
