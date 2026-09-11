import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$runCommandRaw({ listCollections: 1, nameOnly: true });
  const names = (result.cursor?.firstBatch || []).map((c) => c.name).sort();
  console.log('COUNT', names.length);
  for (const n of names) console.log(n);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
