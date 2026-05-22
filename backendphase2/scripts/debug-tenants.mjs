import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const hq = new PrismaClient({
  datasources: { db: { url: process.env.HEADQUARTERS_DATABASE_URL } },
});

const orgs = await hq.organization.findMany({
  select: { id: true, name: true, tenantDbName: true },
  take: 50,
}).catch(async () => {
  // fallback: list collections via raw if model differs
  return [];
});

console.log('orgs', JSON.stringify(orgs, null, 2));

const base = process.env.DATABASE_URL;
for (const org of orgs) {
  const db = String(org.tenantDbName || '').trim();
  if (!db) continue;
  const url = base.replace(/\/[^/?]+(\?|$)/, `/${db}$1`);
  const p = new PrismaClient({ datasources: { db: { url } } });
  try {
    const count = await p.candidate.count({ where: { isDeleted: { not: true } } });
    const sample = await p.candidate.findMany({
      where: { isDeleted: { not: true } },
      select: { id: true, firstName: true, lastName: true, email: true, source: true },
      take: 5,
    });
    console.log(`\n${db}: count=${count}`, JSON.stringify(sample));
  } catch (e) {
    console.log(`\n${db}: error`, e.message);
  }
  await p.$disconnect();
}

await hq.$disconnect();
