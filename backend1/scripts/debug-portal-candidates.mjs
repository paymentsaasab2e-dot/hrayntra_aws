import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const rows = await prisma.candidate.findMany({
  select: { id: true, firstName: true, lastName: true, email: true, isVerified: true },
  orderBy: { createdAt: 'desc' },
});

console.log('jobportal candidates', rows.length);
console.log(JSON.stringify(rows, null, 2));

await prisma.$disconnect();
