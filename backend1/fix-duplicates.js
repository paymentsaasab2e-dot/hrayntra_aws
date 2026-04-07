const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Cleaning up duplicate LmsCareerPath entries ---');
  
  // Find all users who have career paths
  const careerPaths = await prisma.lmsCareerPath.findMany({
    select: { id: true, userId: true, createdAt: true }
  });

  const userMap = new Map();
  const toDelete = [];

  for (const path of careerPaths) {
    if (userMap.has(path.userId)) {
      // We found a duplicate! Determine which one to keep (the older or newer one)
      const existing = userMap.get(path.userId);
      if (new Date(path.createdAt) > new Date(existing.createdAt)) {
        toDelete.push(existing.id);
        userMap.set(path.userId, path);
      } else {
        toDelete.push(path.id);
      }
    } else {
      userMap.set(path.userId, path);
    }
  }

  if (toDelete.length > 0) {
    console.log(`Found ${toDelete.length} duplicate entries. Deleting...`);
    await prisma.lmsCareerPath.deleteMany({
      where: {
        id: { in: toDelete }
      }
    });
    console.log('Cleanup complete.');
  } else {
    console.log('No duplicates found.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
