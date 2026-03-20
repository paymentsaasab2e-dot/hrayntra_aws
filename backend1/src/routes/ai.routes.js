const { Router } = require('express');
const { askProfileQuestions, extractProfileData } = require('../controllers/ai.controller');

const router = Router();

router.post('/profile-questions', askProfileQuestions);
router.post('/extract-profile-data', extractProfileData);

module.exports = router;
