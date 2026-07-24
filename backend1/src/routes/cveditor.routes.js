const { Router } = require('express');
const {
  getResumeHTML,
  saveResumeHTML,
  improveTextWithAI,
  exportResumePDF,
} = require('../controllers/cveditor.controller');
const { protect } = require('../middleware/auth.middleware');
const { requireTokens } = require('../middleware/requireTokens.middleware');

const router = Router();

// Get resume HTML for CV editor
router.get('/resume/:candidateId', getResumeHTML);

// Save resume HTML
router.post('/save', saveResumeHTML);

// Improve text with AI (costs tokens)
router.post('/ai-improve', protect, requireTokens('cveditor.ai-improve'), improveTextWithAI);

// Export resume as PDF
router.post('/export', exportResumePDF);

module.exports = router;
