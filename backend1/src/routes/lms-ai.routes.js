const { Router } = require('express');
const { generateQuestions, evaluateAnswer, getSkillAnalytics, generateInterviewReport } = require('../controllers/lms-ai.controller');

const router = Router();

router.post('/generate-questions', generateQuestions);
router.post('/evaluate-answer',    evaluateAnswer);
router.get('/analytics/:candidateId', getSkillAnalytics);
router.post('/generate-report',    generateInterviewReport);

module.exports = router;
