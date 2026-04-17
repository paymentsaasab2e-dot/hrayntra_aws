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
    take: 5
  });

  const savedSets = await prisma.lmsInterviewSet.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' }
  });

  const totalSessions = await prisma.lmsInterviewPrepSession.count({ where: { userId } });
  
  const scoredSessions = await prisma.lmsInterviewPrepSession.findMany({
    where: { userId, finalScore: { not: null } }
  });
  
  const avgFinalScore = scoredSessions.length ? (scoredSessions.reduce((acc, s) => acc + s.finalScore, 0) / scoredSessions.length).toFixed(1) : 0;
  const lastSessionDate = scoredSessions.length ? scoredSessions.sort((a,b) => b.completedAt - a.completedAt)[0].completedAt : null;

  return {
    recentSessions,
    savedSets,
    readinessSummary: {
      totalSessions,
      avgFinalScore: parseFloat(avgFinalScore),
      lastSessionDate,
      suggestedNextAction: 'Take a Mock Session',
      suggestedNextRoute: '/lms/interview-prep/mock'
    },
    supportedCompanies: SUPPORTED_COMPANIES
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
