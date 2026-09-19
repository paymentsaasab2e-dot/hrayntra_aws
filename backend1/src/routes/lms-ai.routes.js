const { Router } = require('express');
const { protect } = require('../middleware/auth.middleware');
const { generateQuestions, evaluateAnswer, getSkillAnalytics, generateInterviewReport } = require('../controllers/lms-ai.controller');

const router = Router();
router.use(protect);

router.post('/generate-questions', generateQuestions);
router.post('/evaluate-answer',    evaluateAnswer);
router.get('/analytics/:candidateId', getSkillAnalytics);
router.post('/generate-report',    generateInterviewReport);

module.exports = router;
