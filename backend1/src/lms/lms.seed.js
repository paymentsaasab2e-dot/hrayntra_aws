const { prisma } = require('../lib/prisma');

const COURSES = [
  { title: "Frontend Masterclass 2024", category: "frontend", level: "intermediate", estimatedHours: 12, tags: ["frontend", "react", "css"] },
  { title: "Backend Scalability via Node.js", category: "backend", level: "advanced", estimatedHours: 8, tags: ["backend", "node", "architecture"] },
  { title: "System Design for Real", category: "system design", level: "advanced", estimatedHours: 15, tags: ["system-design", "architecture", "scaling"] },
  { title: "Cracking Behavioral Interviews", category: "behavioral", level: "beginner", estimatedHours: 5, tags: ["behavioral", "soft-skills", "star-method"] },
  { title: "Data Structures Crash Course", category: "data structures", level: "intermediate", estimatedHours: 20, tags: ["data-structures", "algorithms", "c++"] },
  { title: "Intro to Product Management", category: "product management", level: "beginner", estimatedHours: 6, tags: ["pm", "product", "agile"] }
];

const QUIZZES = [
  { title: "React Fundamentals Quiz", category: "frontend", difficulty: "beginner", tags: ["frontend", "react"] },
  { title: "Advanced CSS Layouts", category: "frontend", difficulty: "advanced", tags: ["frontend", "css"] },
  { title: "Node.js Event Loop Test", category: "backend", difficulty: "intermediate", tags: ["backend", "node"] },
  { title: "SQL vs NoSQL Showdown", category: "backend", difficulty: "intermediate", tags: ["backend", "database"] },
  { title: "Load Balancing 101", category: "system design", difficulty: "intermediate", tags: ["system-design", "scaling"] },
  { title: "Microservices Architecture Quiz", category: "system design", difficulty: "advanced", tags: ["system-design", "architecture"] },
  { title: "STAR Method Practice Quiz", category: "behavioral", difficulty: "beginner", tags: ["behavioral", "star-method"] },
  { title: "Binary Trees & Graphs", category: "data structures", difficulty: "intermediate", tags: ["data-structures"] },
  { title: "Dynamic Programming Quiz", category: "data structures", difficulty: "advanced", tags: ["algorithms"] },
  { title: "Agile Development Check", category: "product management", difficulty: "beginner", tags: ["pm", "agile"] }
];

const EVENTS = [
  // 2 past events
  { title: "Tech Hiring Trends Q1", type: "webinar", scheduledAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
  { title: "Mock Interview Workshop - Meta", type: "workshop", scheduledAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) },
  // 2 upcoming webinars
  { title: "How to Ace the System Design Round", type: "webinar", scheduledAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) },
  { title: "Frontend Performance Optimization", type: "webinar", scheduledAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) },
  // 2 upcoming workshops
  { title: "Live Behavioral Coaching", type: "workshop", scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
  { title: "LeetCode Grind Session", type: "workshop", scheduledAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
];

async function seed() {
  console.log('Seeding LMS Data...');

  // Seed Courses
  for (const c of COURSES) {
    let course = await prisma.lmsCourse.findFirst({ where: { title: c.title } });
    if (!course) {
      course = await prisma.lmsCourse.create({
        data: {
          title: c.title,
          description: `Comprehensive course on ${c.title}`,
          category: c.category,
          level: c.level,
          estimatedHours: c.estimatedHours,
          tags: c.tags,
          isPublished: true,
          totalLessons: 4
        }
      });
      console.log(`Created course: ${c.title}`);

      // Seed Lessons
      for (let i = 1; i <= 4; i++) {
        await prisma.lmsLesson.create({
          data: {
            courseId: course.id,
            title: `Lesson ${i} for ${c.title}`,
            description: `This is lesson ${i}`,
            order: i,
            durationMinutes: 30,
            type: "video",
            isLocked: i > 1
          }
        });
      }
    }
  }

  // Seed Quizzes
  for (const q of QUIZZES) {
    let quiz = await prisma.lmsQuiz.findFirst({ where: { title: q.title } });
    if (!quiz) {
      await prisma.lmsQuiz.create({
        data: {
          title: q.title,
          description: `Test your knowledge on ${q.title}`,
          category: q.category,
          skillTags: q.tags,
          difficulty: q.difficulty,
          estimatedMinutes: 10,
          isPublished: true,
          questions: [
            { id: "q1", text: "What is the primary advantage?", options: ["A", "B", "C"], correctOptionIndex: 0, explanation: "A is correct." },
            { id: "q2", text: "Which approach is worst?", options: ["X", "Y", "Z"], correctOptionIndex: 2, explanation: "Z is correct." }
          ]
        }
      });
      console.log(`Created quiz: ${q.title}`);
    }
  }

  // Seed Events
  for (const e of EVENTS) {
    let event = await prisma.lmsEvent.findFirst({ where: { title: e.title } });
    if (!event) {
      await prisma.lmsEvent.create({
        data: {
          title: e.title,
          description: `Join us for ${e.title}`,
          type: e.type,
          hostName: "LMS Admin",
          scheduledAt: e.scheduledAt,
          durationMinutes: 60,
          mode: "online",
          isPublished: true,
          tags: e.type === "webinar" ? ["theory", "webinar"] : ["practical", "workshop"]
        }
      });
      console.log(`Created event: ${e.title}`);
    }
  }

  console.log('Seeding complete.');
}

seed()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
