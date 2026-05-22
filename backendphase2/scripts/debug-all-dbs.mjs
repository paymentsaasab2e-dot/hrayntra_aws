import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { getCandidateCommonPrismaClient } from '../src/config/prisma.js';

const defaultUrl = process.env.DATABASE_URL;
const hqUrl = process.env.HEADQUARTERS_DATABASE_URL;

async function listCandidates(label, url) {
  const p = new PrismaClient({ datasources: { db: { url } } });
  const rows = await p.candidate.findMany({
    where: { isDeleted: { not: true } },
    select: { id: true, firstName: true, lastName: true, email: true, source: true },
    take: 20,
  });
  console.log(`\n=== ${label} (${rows.length}) ===`);
  console.log(JSON.stringify(rows, null, 2));
  await p.$disconnect();
}

await listCandidates('default jobportal', defaultUrl);

if (hqUrl && hqUrl !== defaultUrl) {
  try {
    await listCandidates('headquarters', hqUrl);
  } catch (e) {
    console.log('hq error', e.message);
  }
}

// rus01 tenant
const rusUrl = defaultUrl.replace(/\/[^/?]+(\?|$)/, '/rus01$1');
await listCandidates('rus01 tenant', rusUrl);

const common = getCandidateCommonPrismaClient();
const commonRows = await common.candidateCommon.findMany({
  select: { candidateId: true, firstName: true, lastName: true, email: true, isVerified: true },
});
console.log('\n=== candidatecommon ===');
console.log(JSON.stringify(commonRows, null, 2));
await common.$disconnect();
