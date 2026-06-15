const { Router } = require('express');
const {
  getQuizzes,
  getCompletedQuizzes,
  getRecommendedQuiz,
  getAnalytics,
  getQuizDetail,
  submitAttempt,
  getAttemptResult,
  getTopicSuggestions,
  generateQuizzes,
} = require('../controllers/quizzes.controller');
const { validateAttempt, validateGenerate } = require('../validators/quizzes.validator');

const router = Router();

router.get('/topic-suggestions', getTopicSuggestions);
router.post('/generate', validateGenerate, generateQuizzes);
router.get('/completed', getCompletedQuizzes);
router.get('/', getQuizzes);
router.get('/recommended', getRecommendedQuiz);
router.get('/analytics', getAnalytics);
router.get('/:quizId', getQuizDetail);
router.post('/:quizId/attempt', validateAttempt, submitAttempt);
router.get('/:quizId/result/:attemptId', getAttemptResult);

module.exports = router;
