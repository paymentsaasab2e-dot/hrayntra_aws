const interviewService = require('../services/interview.service');
const { sendSuccess, sendError, sendNotFound } = require('../lms.response.helper');

async function getInterviewDashboard(req, res) {
  try {
    const data = await interviewService.fetchDashboardData(req.user.id);
    return sendSuccess(res, data);
  } catch (error) {
    return sendError(res, error);
  }
}

async function getQuestionBank(req, res) {
  try {
    const data = await interviewService.fetchQuestionBank(req.params.category);
    if (!data) return sendNotFound(res, 'Unsupported category');
    return sendSuccess(res, data);
  } catch (error) {
    return sendError(res, error);
  }
}

async function requestGenerateSet(req, res) {
  try {
    const { topic, role, count, difficulty } = req.body;
    const questions = await interviewService.generateQuestions(topic, role, count, difficulty);
    return sendSuccess(res, { questions });
  } catch (error) {
    return sendError(res, error);
  }
}

async function saveSet(req, res) {
  try {
    const set = await interviewService.createSet(req.user.id, req.body);
    return sendSuccess(res, set);
  } catch (error) {
    return sendError(res, error);
  }
}

async function getSetDetail(req, res) {
  try {
    const set = await interviewService.fetchSet(req.user.id, req.params.setId);
    if (!set) return sendNotFound(res, 'Set not found');
    return sendSuccess(res, set);
  } catch (error) {
    return sendError(res, error);
  }
}

async function saveSetAnswer(req, res) {
  try {
    const { questionId, answer } = req.body;
    const updatedSet = await interviewService.updateSetAnswer(req.user.id, req.params.setId, questionId, answer);
    if (!updatedSet) return sendNotFound(res, 'Set not found');
    return sendSuccess(res, updatedSet);
  } catch (error) {
    return sendError(res, error);
  }
}

async function requestSetFeedback(req, res) {
  try {
    const { questionId, answer, question } = req.body;
    const feedback = await interviewService.getAiFeedback(question, answer);
    return sendSuccess(res, feedback);
  } catch (error) {
    return sendError(res, error);
  }
}

async function startMockSession(req, res) {
  try {
    const { category, questionCount } = req.body;
    const session = await interviewService.startMock(req.user.id, category, questionCount);
    return sendSuccess(res, session);
  } catch (error) {
    return sendError(res, error);
  }
}

async function answerMockSessionQuestion(req, res) {
  try {
    const { questionId, answer } = req.body;
    const session = await interviewService.answerMockQuestion(req.user.id, req.params.sessionId, questionId, answer);
    if (!session) return sendNotFound(res, 'Session not found');
    return sendSuccess(res, session);
  } catch (error) {
    return sendError(res, error);
  }
}

async function finishMockSession(req, res) {
  try {
    const session = await interviewService.finishMockSession(req.user.id, req.params.sessionId);
    if (!session) return sendNotFound(res, 'Session not found');
    return sendSuccess(res, session);
  } catch (error) {
    return sendError(res, error);
  }
}

async function getMockSessionResult(req, res) {
  try {
    const session = await interviewService.fetchMockResult(req.user.id, req.params.sessionId);
    if (!session) return sendNotFound(res, 'Session not found');
    return sendSuccess(res, session);
  } catch (error) {
    return sendError(res, error);
  }
}

async function getCompanyResearch(req, res) {
  try {
    const research = await interviewService.fetchCompanyResearch(req.params.slug);
    if (!research) return sendNotFound(res, 'Company research profile not supported.');
    return sendSuccess(res, research);
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = {
  getInterviewDashboard, getQuestionBank, requestGenerateSet,
  saveSet, getSetDetail, saveSetAnswer, requestSetFeedback,
  startMockSession, answerMockSessionQuestion, finishMockSession,
  getMockSessionResult, getCompanyResearch
};
