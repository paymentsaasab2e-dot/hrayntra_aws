const { prisma } = require('../../lib/prisma');
const aiLmsService = require('./ai.lms.service');

/**
 * The LMS Orchestrator is responsible for generating the entire domain data
 * (Courses, Quizzes, Events, etc.) based on the user's career goal.
 */
async function orchestrateLmsForGoal(userId, targetRole) {
  console.log(`[ORCHESTRATOR] Orchestrating LMS for user ${userId} with goal: ${targetRole}`);

  try {
    // 1. Try to get AI-generated plan
    const aiPlan = await aiLmsService.generateOrchestrationPlan(targetRole);
    
    if (aiPlan) {
      // Use AI-generated courses
      for (const idea of aiPlan.courses) {
        const c = await prisma.lmsCourse.create({
          data: {
            title: idea.title,
            description: idea.description,
            category: idea.category,
            level: idea.level,
            estimatedHours: idea.hours,
            isPublished: true,
            tags: [targetRole]
          }
        });
        
        if (idea.lessons && idea.lessons.length > 0) {
          await prisma.lmsLesson.createMany({
            data: idea.lessons.map((l, i) => ({
              courseId: c.id,
              title: l,
              description: `Dive deep into ${l}`,
              order: i + 1,
              type: 'reading',
              durationMinutes: 15
            }))
          });
        }
      }

      // Use AI-generated quizzes
      for (const idea of aiPlan.quizzes) {
        await prisma.lmsQuiz.create({
          data: {
            title: idea.title,
            description: idea.description,
            category: idea.category,
            skillTags: idea.skills,
            difficulty: 'Intermediate',
            estimatedMinutes: idea.minutes,
            isPublished: true,
            questions: idea.questions
          }
        });
      }

      // Use AI-generated events
      for (const idea of aiPlan.events) {
        await prisma.lmsEvent.create({
          data: {
            title: idea.title,
            description: idea.description,
            type: idea.type,
            scheduledAt: new Date(Date.now() + 86400000 * idea.daysFromNow),
            mode: 'ONLINE',
            isPublished: true,
            tags: [targetRole]
          }
        });
      }

      // Use AI-generated interview prep
      if (aiPlan.interviewQuestions) {
        await prisma.lmsInterviewPrepSession.create({
          data: {
            userId,
            sessionType: 'MOCK',
            category: targetRole,
            questions: aiPlan.interviewQuestions
          }
        });
      }
    } else {
      // SLOW-FALLBACK: Use hardcoded role-aware logic if AI fails (already implemented in previous step roughly)
      // We'll keep a minimal version here as a last resort
      const c = await prisma.lmsCourse.create({
        data: {
          title: `${targetRole} Essentials`,
          description: `Practical guide for ${targetRole}.`,
          category: 'Core',
          level: 'Beginner',
          isPublished: true
        }
      });
    }

    // Always create a welcome note
    await prisma.lmsNote.create({
      data: {
        userId,
        title: `Your ${targetRole} Mission Started`,
        body: `We have tailored the LMS strictly for your ambition as a ${targetRole}. Courses and interviews are ready.`,
        type: 'General',
        tags: [targetRole]
      }
    });

    return true;
  } catch (error) {
    console.error('[ORCHESTRATOR] Orchestration failed', error);
    return false;
  }
}

module.exports = {
  orchestrateLmsForGoal
};
