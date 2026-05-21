/**
 * One-off: clear email on soft-deleted candidates so bulk CV re-import is not blocked.
 * Preserves the previous address in extraData.preRecycleBinEmail for Recycle Bin restore.
 *
 * Usage (from backendphase2): node scripts/release-deleted-candidate-emails.js
 */
import { prisma } from '../src/config/prisma.js';

async function main() {
  const rows = await prisma.candidate.findMany({
    where: {
      isDeleted: true,
      email: { not: null },
      NOT: { email: '' },
    },
    select: { id: true, email: true, extraData: true },
  });

  let updated = 0;
  for (const row of rows) {
    const priorExtra =
      row.extraData && typeof row.extraData === 'object' && !Array.isArray(row.extraData)
        ? row.extraData
        : {};
    await prisma.candidate.update({
      where: { id: row.id },
      data: {
        email: null,
        extraData: {
          ...priorExtra,
          preRecycleBinEmail: String(row.email).trim(),
        },
      },
    });
    updated += 1;
  }

  console.log(`Released email on ${updated} soft-deleted candidate(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
