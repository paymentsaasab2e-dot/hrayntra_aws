const { prisma } = require('../../lib/prisma');
const aiLmsService = require('./ai.lms.service');

async function fetchDashboardAggregations(userId) {
  // Parallel DB fetches to improve latency

  // 1. Courses progress
  const enrollments = await prisma.lmsEnrollment.findMany({
    where: { userId },
    include: {
      course: {
        include: { lessons: { orderBy: { order: 'asc' } } }
      }
    },
    orderBy: { lastAccessedAt: 'desc' },
    take: 5
  });

  const courseProgress = enrollments.map(e => {
    let nextLessonId = null;
    let nextLessonTitle = null;

    for (const l of e.course.lessons) {
      if (!e.completedLessonIds.includes(l.id)) {
        nextLessonId = l.id;
        nextLessonTitle = l.title;
        break;
      }
    }

    return {
      courseId: e.courseId,
      title: e.course.title,
      thumbnailSrc: e.course.thumbnailUrl,
      progressPercent: e.progressPercent,
      lastAccessedAt: e.lastAccessedAt,
      nextLessonId,
      nextLessonTitle
    };
  });

  // 2. Recent Quiz Attempts
  const recentQuizAttemptsDb = await prisma.lmsQuizAttempt.findMany({
    where: { userId },
    include: { quiz: true },
    orderBy: { completedAt: 'desc' },
    take: 5
  });

  const recentQuizAttempts = recentQuizAttemptsDb.map(a => ({
    quizId: a.quizId,
    quizTitle: a.quiz.title,
    score: a.score,
    completedAt: a.completedAt
  }));

  // 3. Weak skills & Quiz Recommendation
  const attempts = await prisma.lmsQuizAttempt.findMany({
    where: { userId },
    include: { quiz: true }
  });

  const skillMap = {};
  attempts.forEach(a => {
    a.quiz.skillTags.forEach(tag => {
      if (!skillMap[tag]) skillMap[tag] = { score: 0, count: 0 };
      skillMap[tag].score += a.score;
      skillMap[tag].count++;
    });
  });

  const weakSkills = [];
  let weakestSkill = null;
  let lowestScore = 100;

  for (const [tag, data] of Object.entries(skillMap)) {
    const avg = data.score / data.count;
    if (avg < 65) weakSkills.push(tag);
    if (avg < lowestScore) {
      lowestScore = avg;
      weakestSkill = tag;
    }
  }

  let recommendedQuiz = null;
  if (weakestSkill) {
    const potentialQuizzes = await prisma.lmsQuiz.findMany({
      where: { isPublished: true, skillTags: { has: weakestSkill } },
      include: { attempts: { where: { userId }, take: 1, orderBy: { score: 'desc' } } }
    });

    const recommendation = potentialQuizzes.find(q => !q.attempts.length || q.attempts[0].score < 80);
    if (recommendation) {
      const { questions, attempts, ...rest } = recommendation;
      recommendedQuiz = { ...rest, reason: `Recommended to improve your gaps in ${weakestSkill}` };
    }
  }

  // 4. Recommended Course
  let recommendedCourse = null;
  if (weakestSkill) {
    const course = await prisma.lmsCourse.findFirst({
      where: { isPublished: true, tags: { has: weakestSkill } },
      include: { enrollments: { where: { userId } } }
    });
    if (course && (!course.enrollments.length || course.enrollments[0].progressPercent < 100)) {
      recommendedCourse = { id: course.id, title: course.title, thumbnailUrl: course.thumbnailUrl, tags: course.tags };
    }
  }

  // 5. Events
  const registeredEventsDb = await prisma.lmsEventRegistration.findMany({
    where: { userId },
    include: { event: true } // should filter by scheduledAt later to be safe
  });
  
  const registeredEvents = registeredEventsDb.map(r => r.event);

  const registeredEventIds = registeredEvents.map(e => e.id);
  
  const upcomingEvents = await prisma.lmsEvent.findMany({
    where: {
      isPublished: true,
      scheduledAt: { gte: new Date() },
      id: { notIn: registeredEventIds.length ? registeredEventIds : undefined }
    },
    orderBy: { scheduledAt: 'asc' },
    take: 3
  });

  // 6. Recent Note
  const recentNoteRaw = await prisma.lmsNote.findFirst({
    where: { userId },
    orderBy: { updatedAt: 'desc' }
  });
  const recentNote = recentNoteRaw || null;

  // 7. Resume & Career Path
  const resume = await prisma.lmsResumeDraft.findUnique({ where: { userId } });
  const resumeStrength = resume ? resume.strengthScore : null;

  const careerPath = await prisma.lmsCareerPath.findUnique({ where: { userId } });
  let careerPathSummary = { currentPhase: 'foundation', totalRoadmapItems: 0, completedCount: 0, nextItem: null };

  if (careerPath) {
    const items = careerPath.roadmapItems || [];
    const completed = items.filter(i => i.status === 'completed').length;
    const nextItem = items.find(i => i.status === 'in-progress' || i.status === 'planned');
    
    careerPathSummary = {
      currentPhase: careerPath.currentPhase,
      totalRoadmapItems: items.length,
      completedCount: completed,
      nextItem: nextItem ? { title: nextItem.title, route: nextItem.targetRoute, phase: nextItem.phase } : null
    };
  }

  // 8. Interview Readiness
  const scoredSessions = await prisma.lmsInterviewPrepSession.findMany({
    where: { userId, finalScore: { not: null } },
    orderBy: { completedAt: 'desc' }
  });

  const interviewReadiness = {
    completedSessionsCount: scoredSessions.length,
    lastSessionCompletedAt: scoredSessions.length ? scoredSessions[0].completedAt : null,
    suggestedActionLabel: Object.keys(skillMap).length === 0 ? 'Start Learning First' : 'Take a Mock Session',
    suggestedActionRoute: Object.keys(skillMap).length === 0 ? '/lms/courses' : '/lms/interview-prep/mock'
  };

  // 9. Fetch Profile context for AI
  const candidate = await prisma.candidate.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      skills: { include: { skill: true } },
      cvAnalysis: true,
      careerPreferences: true,
      summary: true
    }
  });

  const profileContext = {
    fullName: candidate?.profile?.fullName,
    summary: candidate?.summary?.summaryText,
    skills: candidate?.skills?.map(s => s.skill.name),
    cvScore: candidate?.cvAnalysis?.cvScore,
    experienceLevel: candidate?.cvAnalysis?.experienceLevel,
    targetRoles: candidate?.careerPreferences?.preferredRoles || []
  };

  const userState = {
    weakSkills,
    resumeStrength,
    completedCourses: enrollments.filter(e => e.progressPercent === 100).length,
    recentQuizScores: recentQuizAttempts.map(a => a.score),
    careerPathItemsCount: careerPathSummary.totalRoadmapItems
  };

  const primaryInsightObj = await aiLmsService.generateDashboardInsight(userState, profileContext);
  const personalizedRecs = await aiLmsService.generatePersonalizedRecommendations(profileContext);
  const dailyFocus = await aiLmsService.generateDailyMomentum(userState, profileContext);
  const intelligence = await aiLmsService.generateSharedIntelligence(userState, profileContext);

  return {
    courseProgress,
    recentQuizAttempts,
    weakSkills,
    recommendedQuiz,
    recommendedCourse,
    registeredEvents,
    upcomingEvents,
    recentNote,
    resumeStrength,
    careerPathSummary,
    interviewReadiness,
    primaryInsight: primaryInsightObj.primaryInsight,
    reason: primaryInsightObj.reason,
    ctaRoute: primaryInsightObj.ctaRoute,
    badge: primaryInsightObj.badge,
    personalizedRecs,
    dailyFocus,
    intelligence
  };
}

module.exports = { fetchDashboardAggregations };
