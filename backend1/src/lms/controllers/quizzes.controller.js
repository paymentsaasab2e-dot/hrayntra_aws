const quizzesService = require('../services/quizzes.service');
const { sendSuccess, sendError, sendNotFound } = require('../lms.response.helper');

async function getQuizzes(req, res) {
  try {
    const filters = req.query;
    const quizzes = await quizzesService.fetchQuizzes(req.user.id, filters);
    return sendSuccess(res, quizzes);
  } catch (error) {
    return sendError(res, error);
  }
}

async function getRecommendedQuiz(req, res) {
  try {
    const quiz = await quizzesService.fetchRecommendedQuiz(req.user.id);
    if (!quiz) return sendNotFound(res, 'No precise recommended quiz found. Take some quizzes to track gaps.');
    return sendSuccess(res, quiz);
  } catch (error) {
    return sendError(res, error);
  }
}

async function getAnalytics(req, res) {
  try {
    const analytics = await quizzesService.fetchAnalytics(req.user.id);
    return sendSuccess(res, analytics);
  } catch (error) {
    return sendError(res, error);
  }
}

async function getQuizDetail(req, res) {
  try {
    const quiz = await quizzesService.fetchQuizDetail(req.user.id, req.params.quizId);
    if (!quiz) return sendNotFound(res, 'Quiz not found');
    return sendSuccess(res, quiz);
  } catch (error) {
    return sendError(res, error);
  }
}

async function submitAttempt(req, res) {
  try {
    const attempt = await quizzesService.scoreAttempt(req.user.id, req.params.quizId, req.body);
    return sendSuccess(res, attempt, 'Quiz submitted successfully');
  } catch (error) {
    return sendError(res, error);
  }
}

async function getAttemptResult(req, res) {
  try {
    const result = await quizzesService.fetchAttemptResult(req.user.id, req.params.quizId, req.params.attemptId);
    if (!result) return sendNotFound(res, 'Attempt not found');
    return sendSuccess(res, result);
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = { getQuizzes, getRecommendedQuiz, getAnalytics, getQuizDetail, submitAttempt, getAttemptResult };
