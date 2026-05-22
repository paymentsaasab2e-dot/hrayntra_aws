import 'dotenv/config';
import {
  getCandidateCommonPrismaClient,
  runWithTenantContext,
  prisma,
} from '../src/config/prisma.js';
import { fetchCandidateCommonForCandidatesList } from '../src/services/candidateCommon/candidateCommonPool.service.js';

const commonPrisma = getCandidateCommonPrismaClient();
console.log('commonPrisma', commonPrisma ? 'ok' : 'MISSING');

if (commonPrisma) {
  const all = await commonPrisma.candidateCommon.findMany({
    select: {
      candidateId: true,
      firstName: true,
      lastName: true,
      email: true,
      isVerified: true,
      source: true,
      syncedAt: true,
    },
  });
  console.log('\n=== candidatecommon (all) ===');
  console.log(JSON.stringify(all, null, 2));
  await commonPrisma.$disconnect();
}

await runWithTenantContext('rus01', async () => {
  const pool = await fetchCandidateCommonForCandidatesList({});
  console.log('\n=== fetchCandidateCommonForCandidatesList ===');
  console.log('count', pool.length);
  console.log(JSON.stringify(pool.map((c) => ({ id: c.id, email: c.email, source: c.source, stage: c.stage })), null, 2));

  const rushabhId = 'b1c869d84e75048c5c61c5e3';
  const tenantRow = await prisma.candidate.findUnique({
    where: { id: rushabhId },
    select: { id: true, email: true, firstName: true, lastName: true, isDeleted: true, source: true, stage: true },
  });
  console.log('\n=== tenant rus01 candidate b1c869... ===');
  console.log(tenantRow);

  const purged = await prisma.purgedCandidateRef
    .findMany({ where: { candidateId: rushabhId }, select: { candidateId: true } })
    .catch(() => []);
  console.log('\n=== purged refs ===', purged);

  const search = await prisma.candidate.findMany({
    where: {
      OR: [
        { email: { contains: 'rushabh' } },
        { firstName: { contains: 'Rushabh' } },
        { email: { contains: 'ghodehimanshu' } },
      ],
    },
    select: { id: true, email: true, firstName: true, lastName: true, isDeleted: true, source: true },
    take: 20,
  });
  console.log('\n=== tenant rushabh/ghode search ===');
  console.log(JSON.stringify(search, null, 2));
});

await prisma.$disconnect();
