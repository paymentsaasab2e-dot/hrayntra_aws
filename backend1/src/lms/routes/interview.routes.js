const { Router } = require('express');
const {
  getInterviewDashboard, getQuestionBank, requestGenerateSet,
  saveSet, getSetDetail, saveSetAnswer, requestSetFeedback,
  startMockSession, answerMockSessionQuestion, finishMockSession,
  getMockSessionResult, getCompanyResearch
} = require('../controllers/interview.controller');
const {
  validateGenerateSet, validateCreateSet, validateAnswerSet,
  validateFeedbackSet, validateStartMock, validateAnswerMock
} = require('../validators/interview.validator');

const router = Router();

router.get('/', getInterviewDashboard);
router.get('/question-bank/:category', getQuestionBank);
router.post('/generate-set', validateGenerateSet, requestGenerateSet);
router.post('/sets', validateCreateSet, saveSet);
router.get('/sets/:setId', getSetDetail);
router.put('/sets/:setId/answer', validateAnswerSet, saveSetAnswer);
router.post('/sets/:setId/ai-feedback', validateFeedbackSet, requestSetFeedback);
router.post('/mock-session/start', validateStartMock, startMockSession);
router.put('/mock-session/:sessionId/answer', validateAnswerMock, answerMockSessionQuestion);
router.post('/mock-session/:sessionId/finish', finishMockSession);
router.get('/mock-session/:sessionId/result', getMockSessionResult);
router.get('/company/:slug', getCompanyResearch);

module.exports = router;
