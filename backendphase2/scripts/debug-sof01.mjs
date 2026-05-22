import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { runWithTenantContext, prisma } from '../src/config/prisma.js';

const base = process.env.DATABASE_URL;
const url = base.replace(/\/[^/?]+(\?|$)/, '/sof01$1');

const p = new PrismaClient({ datasources: { db: { url } } });
const rows = await p.candidate.findMany({
  select: { id: true, firstName: true, lastName: true, email: true, isDeleted: true, source: true },
  take: 20,
});
console.log('sof01 all candidates', rows.length);
console.log(JSON.stringify(rows, null, 2));

const rushabh = await p.candidate.findUnique({
  where: { id: 'b1c869d84e75048c5c61c5e3' },
  select: { id: true, isDeleted: true, source: true, email: true },
});
console.log('\nsof01 rushabh tombstone', rushabh);

const named = await p.candidate.findMany({
  where: {
    isDeleted: { not: true },
    OR: [
      { firstName: { contains: 'Rajesh' } },
      { firstName: { contains: 'Himanshu' } },
      { lastName: { contains: 'Desai' } },
      { lastName: { contains: 'Ghode' } },
    ],
  },
  select: { id: true, firstName: true, lastName: true, email: true, source: true },
});
console.log('\nsof01 Rajesh/Himanshu', JSON.stringify(named, null, 2));

await p.$disconnect();
