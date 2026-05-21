/**
 * One-off: convert legacy tombstone rows (isDeleted + empty PII) into full tenant removal.
 * Also hard-purges any soft-deleted row that still has an email (blocks bulk CV duplicate).
 *
 * Usage (from backendphase2): node scripts/migrate-candidate-tombstones-to-hard-purge.js
 */
import { prisma } from '../src/config/prisma.js';
import { permanentDeleteCandidateById } from '../src/services/candidatePermanentDelete.service.js';

async function main() {
  const tombstones = await prisma.candidate.findMany({
    where: { isDeleted: true },
    select: { id: true, email: true, deletedAt: true },
  });

  console.log(`Found ${tombstones.length} deleted/tombstone candidate row(s).`);

  let purged = 0;
  for (const row of tombstones) {
    try {
      await permanentDeleteCandidateById(row.id);
      purged += 1;
      console.log(`  purged ${row.id}${row.email ? ` (had email ${row.email})` : ''}`);
    } catch (err) {
      console.error(`  failed ${row.id}:`, err?.message || err);
    }
  }

  console.log(`Done. Permanently removed ${purged} candidate(s) from tenant DB.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
