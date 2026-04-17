const { Router } = require('express');
const {
  getResumeHTML,
  saveResumeHTML,
  improveTextWithAI,
  exportResumePDF,
} = require('../controllers/cveditor.controller');

const router = Router();

// Get resume HTML for CV editor
router.get('/resume/:candidateId', getResumeHTML);

// Save resume HTML
router.post('/save', saveResumeHTML);

// Improve text with AI
router.post('/ai-improve', improveTextWithAI);

// Export resume as PDF
router.post('/export', exportResumePDF);

module.exports = router;
