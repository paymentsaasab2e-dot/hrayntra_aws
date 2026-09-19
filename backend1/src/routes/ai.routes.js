const { Router } = require('express');
const { protect } = require('../middleware/auth.middleware');
const {
  askProfileQuestions,
  suggestJobTitles,
  suggestIndustryDomains,
  suggestInterviewOptions,
  extractProfileData,
  generalChat,
} = require('../controllers/ai.controller');

const router = Router();
router.use(protect);

router.post('/chat', generalChat);
router.post('/profile-questions', askProfileQuestions);
router.post('/job-title-suggestions', suggestJobTitles);
router.post('/industry-domain-suggestions', suggestIndustryDomains);
router.post('/interview-suggestions', suggestInterviewOptions);
router.post('/extract-profile-data', extractProfileData);

module.exports = router;
