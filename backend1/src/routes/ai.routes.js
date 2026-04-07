const { Router } = require('express');
const {
  askProfileQuestions,
  suggestJobTitles,
  extractProfileData,
  generalChat,
} = require('../controllers/ai.controller');

const router = Router();

router.post('/chat', generalChat);
router.post('/profile-questions', askProfileQuestions);
router.post('/job-title-suggestions', suggestJobTitles);
router.post('/extract-profile-data', extractProfileData);

module.exports = router;
