const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const courses = await prisma.lmsCourse.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log('--- RECENT COURSES ---');
  console.log(JSON.stringify(courses, null, 2));

  const quizzes = await prisma.lmsQuiz.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log('--- RECENT QUIZZES ---');
  console.log(JSON.stringify(quizzes, null, 2));
  
  await prisma.$disconnect();
}

check();
