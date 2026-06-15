const { prisma } = require('../../lib/prisma');
const aiLmsService = require('./ai.lms.service');

async function checkCareerPathAdvancement(userId, quizId, score) {
  if (score < 80) return;

  const careerPath = await prisma.lmsCareerPath.findUnique({ where: { userId } });
  if (!careerPath) return;

  const roadmapItems = careerPath.roadmapItems || [];
  let updated = false;

  const newItems = roadmapItems.map(item => {
    if (item.targetType === 'quiz' && item.targetId === quizId && item.status !== 'completed') {
      updated = true;
      return { ...item, status: 'completed', completedAt: new Date().toISOString() };
    }
    return item;
  });

  if (updated) {
    await prisma.lmsCareerPath.update({
      where: { userId },
      data: { roadmapItems: newItems }
    });
  }
}

function computeMasteryLevel(bestScore) {
  if (bestScore === undefined || bestScore === null) return 'none';
  if (bestScore >= 85) return 'mastered';
  if (bestScore >= 70) return 'proficient';
  return 'learning';
}

async function fetchQuizzes(userId, filters) {
  const { category, skill, difficulty, search } = filters;
  const where = { isPublished: true };

  if (search) {
    where.title = { contains: search, mode: 'insensitive' };
  }
  if (category) where.category = category;
  if (skill) where.skillTags = { has: skill };
  if (difficulty) where.difficulty = difficulty;

  const quizzes = await prisma.lmsQuiz.findMany({
    where,
    include: {
      attempts: {
        where: { userId },
        orderBy: { score: 'desc' }
      }
    }
  });

  return quizzes.map(q => {
    const attempts = q.attempts;
    const bestAttempt = attempts[0];
    const latestAttempt = attempts.reduce((latest, current) => {
      if (!latest) return current;
      return new Date(current.completedAt) > new Date(latest.completedAt) ? current : latest;
    }, null);
    const { questions, ...quizInfo } = q;
    return {
      ...quizInfo,
      questionsCount: Array.isArray(questions) ? questions.length : 0,
      bestScore: bestAttempt ? bestAttempt.score : null,
      latestScore: latestAttempt ? latestAttempt.score : null,
      attemptCount: attempts.length,
      lastAttemptedDate: latestAttempt ? latestAttempt.completedAt : null,
      lastAttemptId: latestAttempt ? latestAttempt.id : null,
      masteryLevel: computeMasteryLevel(bestAttempt ? bestAttempt.score : null)
    };
  });
}

async function fetchCompletedQuizzes(userId) {
  const attempts = await prisma.lmsQuizAttempt.findMany({
    where: { userId },
    include: { quiz: true },
    orderBy: { completedAt: 'desc' },
  });

  const byQuizId = new Map();

  for (const attempt of attempts) {
    const quiz = attempt.quiz;
    if (!quiz) continue;

    const score = Math.round(attempt.score);
    const existing = byQuizId.get(quiz.id);

    if (!existing) {
      const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
      byQuizId.set(quiz.id, {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        category: quiz.category,
        skillTags: quiz.skillTags,
        difficulty: quiz.difficulty,
        estimatedMinutes: quiz.estimatedMinutes,
        questionsCount: questions.length,
        bestScore: score,
        latestScore: score,
        attemptCount: 1,
        lastAttemptedDate: attempt.completedAt,
        lastAttemptId: attempt.id,
        masteryLevel: computeMasteryLevel(score),
      });
      continue;
    }

    existing.attemptCount += 1;
    existing.bestScore = Math.max(existing.bestScore, score);
    if (new Date(attempt.completedAt) > new Date(existing.lastAttemptedDate)) {
      existing.latestScore = score;
      existing.lastAttemptedDate = attempt.completedAt;
      existing.lastAttemptId = attempt.id;
      existing.masteryLevel = computeMasteryLevel(existing.bestScore);
    }
  }

  return Array.from(byQuizId.values()).sort(
    (a, b) => new Date(b.lastAttemptedDate).getTime() - new Date(a.lastAttemptedDate).getTime()
  );
}

async function fetchRecommendedQuiz(userId) {
  const analytics = await fetchAnalytics(userId);
  if (!analytics.weakSkills.length) return null;

  const weakestSkill = analytics.weakSkills[0]; // Ordered by lowest avg score
  const candidateQuizzes = await prisma.lmsQuiz.findMany({
    where: {
      isPublished: true,
      skillTags: { has: weakestSkill }
    },
    include: {
      attempts: {
        where: { userId },
        orderBy: { score: 'desc' }
      }
    }
  });

  // Find the first quiz where the user hasn't yet scored > 80
  const recommended = candidateQuizzes.find(q => {
    const bestAttempt = q.attempts[0];
    return !bestAttempt || bestAttempt.score < 80;
  });

  if (recommended) {
    const { questions, attempts, ...rest } = recommended;
    return {
      ...rest,
      reason: `Recommended based on finding gaps in: ${weakestSkill}`
    };
  }
  return null;
}

async function fetchAnalytics(userId) {
  const attempts = await prisma.lmsQuizAttempt.findMany({
    where: { userId },
    include: { quiz: true },
    orderBy: { completedAt: 'desc' }
  });

  const skillMap = {};
  let totalScore = 0;

  attempts.forEach(attempt => {
    totalScore += attempt.score;
    attempt.quiz.skillTags.forEach(tag => {
      if (!skillMap[tag]) {
        skillMap[tag] = { totalTagScore: 0, tagAttempts: 0 };
      }
      skillMap[tag].totalTagScore += attempt.score;
      skillMap[tag].tagAttempts += 1;
    });
  });

  const masteryByTopic = Object.keys(skillMap).map(tag => {
    const { totalTagScore, tagAttempts } = skillMap[tag];
    return {
      topic: tag,
      slug: tag.toLowerCase(),
      pct: Math.round(totalTagScore / tagAttempts)
    };
  });

  const weakSkills = masteryByTopic.filter(m => m.pct < 65).map(m => m.topic);

  return {
    skillMap: masteryByTopic,
    weakSkills,
    masteryByTopic,
    recentAttempts: attempts.slice(0, 10),
    overallAverageScore: attempts.length ? Math.round(totalScore / attempts.length) : 0
  };
}

async function fetchQuizDetail(userId, quizId) {
  const quiz = await prisma.lmsQuiz.findUnique({
    where: { id: quizId }
  });

  if (!quiz) return null;

  // Mask the correct option index before returning to client
  const maskedQuestions = (Array.isArray(quiz.questions) ? quiz.questions : []).map(q => {
    const { correctOptionIndex, explanation, ...rest } = q;
    return rest;
  });

  return { ...quiz, questions: maskedQuestions };
}

async function scoreAttempt(userId, quizId, payload) {
  const { answerMap, timeTakenSeconds } = payload;
  
  const quiz = await prisma.lmsQuiz.findUnique({
    where: { id: quizId }
  });

  if (!quiz) throw new Error('Quiz not found');

  const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
  let correctCount = 0;
  
  const breakdown = questions.map(q => {
    const chosenIndex = answerMap[q.id];
    const isCorrect = chosenIndex === q.correctOptionIndex;
    if (isCorrect) correctCount++;
    return {
      id: q.id,
      text: q.text,
      chosenIndex,
      correctOptionIndex: q.correctOptionIndex,
      explanation: q.explanation,
      isCorrect
    };
  });

  const totalQuestions = questions.length;
  const score = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

  const attempt = await prisma.lmsQuizAttempt.create({
    data: {
      userId,
      quizId,
      score,
      totalQuestions,
      correctCount,
      answerMap,
      timeTakenSeconds
    }
  });

  await checkCareerPathAdvancement(userId, quizId, score);

  return {
    score,
    correctCount,
    totalQuestions,
    breakdown,
    attemptId: attempt.id
  };
}

async function fetchAttemptResult(userId, quizId, attemptId) {
  const attempt = await prisma.lmsQuizAttempt.findUnique({
    where: { id: attemptId },
    include: { quiz: true }
  });

  if (!attempt || attempt.userId !== userId || attempt.quizId !== quizId) return null;

  const questions = Array.isArray(attempt.quiz.questions) ? attempt.quiz.questions : [];
  
  const breakdown = questions.map(q => {
    const chosenIndex = attempt.answerMap[q.id];
    return {
      id: q.id,
      text: q.text,
      options: q.options,
      chosenIndex,
      correctOptionIndex: q.correctOptionIndex,
      explanation: q.explanation,
      isCorrect: chosenIndex === q.correctOptionIndex
    };
  });

  const { quiz, ...attemptRest } = attempt;

  return {
    ...attemptRest,
    quizTitle: quiz.title,
    breakdown
  };
}

async function suggestQuizTopics(query) {
  if (!query || String(query).trim().length < 2) return [];
  return aiLmsService.generateQuizTopicSuggestions(String(query).trim());
}

function slugifyTopic(topic) {
  return String(topic)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'general';
}

async function generateQuizzesFromTopic(userId, topic) {
  const normalizedTopic = String(topic || '').trim();
  if (normalizedTopic.length < 2) {
    throw new Error('Topic must be at least 2 characters');
  }

  const generated = await aiLmsService.generateQuizzesForTopic(normalizedTopic);
  const skillSlug = slugifyTopic(normalizedTopic);
  const created = [];

  for (const quiz of generated.quizzes.slice(0, 5)) {
    const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
    const row = await prisma.lmsQuiz.create({
      data: {
        title: quiz.title,
        description: quiz.description,
        category: skillSlug,
        skillTags: [skillSlug, normalizedTopic],
        difficulty: quiz.difficulty,
        estimatedMinutes: quiz.estimatedMinutes || 8,
        isPublished: true,
        questions,
      },
    });

    created.push({
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      skillTags: row.skillTags,
      difficulty: row.difficulty,
      estimatedMinutes: row.estimatedMinutes,
      totalQuestions: questions.length,
      questionsCount: questions.length,
      durationMinutes: row.estimatedMinutes,
      skill: skillSlug,
      topic: normalizedTopic,
      isAiGenerated: true,
    });
  }

  return {
    topic: normalizedTopic,
    quizzes: created,
  };
}

module.exports = {
  fetchQuizzes,
  fetchCompletedQuizzes,
  fetchRecommendedQuiz,
  fetchAnalytics,
  fetchQuizDetail,
  scoreAttempt,
  fetchAttemptResult,
  suggestQuizTopics,
  generateQuizzesFromTopic,
};
