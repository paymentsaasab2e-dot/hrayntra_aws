const { prisma } = require('../../lib/prisma');
const { generateInterviewQuestions, scoreInterviewAnswer, scoreAllSessionAnswers, getCompanyResearchData } = require('./ai.lms.service');

const SUPPORTED_COMPANIES = [
  { slug: 'google', name: 'Google' },
  { slug: 'amazon', name: 'Amazon' },
  { slug: 'microsoft', name: 'Microsoft' },
  { slug: 'meta', name: 'Meta' },
  { slug: 'apple', name: 'Apple' },
  { slug: 'startups-general', name: 'General Startup' }
];

const SUPPORTED_CATEGORIES = ['frontend', 'backend', 'system-design', 'behavioral', 'data-structures'];

async function fetchDashboardData(userId) {
  const recentSessions = await prisma.lmsInterviewPrepSession.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const savedSets = await prisma.lmsInterviewSet.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  });

  const totalSessions = await prisma.lmsInterviewPrepSession.count({ where: { userId } });

  const scoredSessions = recentSessions.filter(
    (s) => s.finalScore != null && Number.isFinite(Number(s.finalScore)),
  );

  const toPercent = (raw) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    // AI scores are typically 0–10; older rows may already be 0–100.
    if (n <= 10) return Math.round(Math.min(100, Math.max(0, n * 10)));
    return Math.round(Math.min(100, Math.max(0, n)));
  };

  const bucketKey = (category) => {
    const c = String(category || '').toLowerCase();
    if (c.includes('behavior') || c.includes('hr')) return 'behavioral';
    if (c.includes('system')) return 'systemDesign';
    if (c.includes('comm')) return 'communication';
    return 'technical';
  };

  const buckets = {
    technical: [],
    behavioral: [],
    systemDesign: [],
    communication: [],
  };
  for (const session of scoredSessions) {
    const pct = toPercent(session.finalScore);
    if (pct == null) continue;
    buckets[bucketKey(session.category)].push(pct);
  }

  const avg = (arr) =>
    arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

  const categoryScores = {
    technical: avg(buckets.technical),
    behavioral: avg(buckets.behavioral),
    systemDesign: avg(buckets.systemDesign),
    communication: avg(buckets.communication),
  };

  const overallParts = Object.values(categoryScores).filter((v) => v != null);
  const overallFromCategories = overallParts.length
    ? Math.round(overallParts.reduce((a, b) => a + b, 0) / overallParts.length)
    : null;
  const overallFromSessions = scoredSessions.length
    ? Math.round(
        scoredSessions.reduce((acc, s) => acc + (toPercent(s.finalScore) || 0), 0) /
          scoredSessions.length,
      )
    : null;
  const overall = overallFromCategories ?? overallFromSessions;

  const weakest =
    Object.entries(categoryScores)
      .filter(([, v]) => v != null)
      .sort((a, b) => a[1] - b[1])[0] || null;

  const nextActionByWeakness = {
    technical: 'Practice a technical mock interview',
    behavioral: 'Practice a behavioral interview',
    systemDesign: 'Practice a system design interview',
    communication: 'Practice communication-focused answers',
  };

  const avgFinalScore = scoredSessions.length
    ? Number(
        (
          scoredSessions.reduce((acc, s) => acc + Number(s.finalScore), 0) /
          scoredSessions.length
        ).toFixed(1),
      )
    : 0;
  const lastSessionDate = scoredSessions.length
    ? scoredSessions.sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt))[0]
        .completedAt
    : null;

  return {
    recentSessions,
    savedSets,
    readinessSummary: {
      totalSessions,
      scoredSessions: scoredSessions.length,
      avgFinalScore,
      readinessPercent: overall,
      scores: {
        overall,
        technical: categoryScores.technical,
        behavioral: categoryScores.behavioral,
        systemDesign: categoryScores.systemDesign,
        communication: categoryScores.communication,
      },
      lastSessionDate,
      suggestedNextAction: scoredSessions.length
        ? weakest
          ? nextActionByWeakness[weakest[0]] || 'Take another mock session'
          : 'Take another mock session'
        : 'Start your first mock interview',
      suggestedNextRoute: '/lms/interview-prep',
    },
    supportedCompanies: SUPPORTED_COMPANIES,
  };
}

async function fetchQuestionBank(category) {
  if (!SUPPORTED_CATEGORIES.includes(category)) return null;

  const relatedQuizzes = await prisma.lmsQuiz.findMany({ where: { category, isPublished: true }, take: 3 });
  const relatedCourses = await prisma.lmsCourse.findMany({ where: { category, isPublished: true }, take: 3 });

  // Returning static placeholders since question bank is requested. In real app, could be fetched from DB.
  return {
    category,
    questions: [
      { id: 'q1', text: `Sample ${category} question 1.` },
      { id: 'q2', text: `Sample ${category} question 2.` }
    ],
    relatedQuizzes,
    relatedCourses
  };
}

async function generateQuestions(topic, role, count, difficulty) {
  return generateInterviewQuestions(topic, role, count, difficulty);
}

async function createSet(userId, payload) {
  const { title, sourceContext, questions } = payload;
  return prisma.lmsInterviewSet.create({
    data: {
      userId,
      title,
      sourceContext,
      questions,
      savedAnswers: {}
    }
  });
}

async function fetchSet(userId, setId) {
  return prisma.lmsInterviewSet.findFirst({
    where: { id: setId, userId }
  });
}

async function updateSetAnswer(userId, setId, questionId, answer) {
  const set = await fetchSet(userId, setId);
  if (!set) return null;

  const updatedAnswers = { ...set.savedAnswers, [questionId]: answer };

  return prisma.lmsInterviewSet.update({
    where: { id: setId },
    data: { savedAnswers: updatedAnswers }
  });
}

async function getAiFeedback(question, answer) {
  return scoreInterviewAnswer(question, answer);
}

async function startMock(userId, category, questionCount) {
  const questions = await generateInterviewQuestions(category, 'Software Engineer', questionCount, 'intermediate');
  
  // Format questions directly
  const formatted = questions.map(q => ({
    id: q.id || `q_${Date.now()}_${Math.random()}`,
    text: q.text,
    userAnswer: null,
    aiFeedback: null
  }));

  return prisma.lmsInterviewPrepSession.create({
    data: {
      userId,
      sessionType: 'mock',
      category,
      questions: formatted
    }
  });
}

async function answerMockQuestion(userId, sessionId, questionId, answer) {
  const session = await prisma.lmsInterviewPrepSession.findFirst({ where: { id: sessionId, userId } });
  if (!session) return null;

  const questions = (session.questions || []).map(q => {
    if (q.id === questionId) {
      return { ...q, userAnswer: answer };
    }
    return q;
  });

  return prisma.lmsInterviewPrepSession.update({
    where: { id: sessionId },
    data: { questions }
  });
}

async function finishMockSession(userId, sessionId) {
  const session = await prisma.lmsInterviewPrepSession.findFirst({ where: { id: sessionId, userId } });
  if (!session) return null;

  const evaluationInfo = await scoreAllSessionAnswers(session.questions);
  
  const updatedQuestions = (session.questions || []).map(q => {
    const fb = evaluationInfo.feedback[q.id];
    if (fb) {
      return { ...q, aiFeedback: fb };
    }
    return q;
  });

  return prisma.lmsInterviewPrepSession.update({
    where: { id: sessionId },
    data: {
      completedAt: new Date(),
      finalScore: evaluationInfo.overallScore,
      questions: updatedQuestions
    }
  });
}

async function fetchMockResult(userId, sessionId) {
  return prisma.lmsInterviewPrepSession.findFirst({
    where: { id: sessionId, userId }
  });
}

async function fetchCompanyResearch(slug) {
  const company = SUPPORTED_COMPANIES.find(c => c.slug === slug);
  if (!company) return null;

  return getCompanyResearchData(company.name);
}

module.exports = {
  fetchDashboardData,
  fetchQuestionBank,
  generateQuestions,
  createSet,
  fetchSet,
  updateSetAnswer,
  getAiFeedback,
  startMock,
  answerMockQuestion,
  finishMockSession,
  fetchMockResult,
  fetchCompanyResearch
};
