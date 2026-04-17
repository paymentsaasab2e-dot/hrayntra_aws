const { Router } = require('express');
const { getQuizzes, getRecommendedQuiz, getAnalytics, getQuizDetail, submitAttempt, getAttemptResult } = require('../controllers/quizzes.controller');
const { validateAttempt } = require('../validators/quizzes.validator');

const router = Router();

router.get('/', getQuizzes);
router.get('/recommended', getRecommendedQuiz);
router.get('/analytics', getAnalytics);
router.get('/:quizId', getQuizDetail);
router.post('/:quizId/attempt', validateAttempt, submitAttempt);
router.get('/:quizId/result/:attemptId', getAttemptResult);

module.exports = router;
