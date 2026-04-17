const { Router } = require('express');
const {
  getResumeJSON,
  updateResumeJSON,
  improveTextWithAI,
  getResumeVersions,
  restoreResumeVersion,
} = require('../controllers/resume-editor.controller');

const router = Router();

// Get resume JSON for editing
router.get('/:candidateId', getResumeJSON);

// Update resume JSON
router.post('/:candidateId', updateResumeJSON);

// Improve text with AI
router.post('/improve-text', improveTextWithAI);

// Get resume versions
router.get('/versions/:candidateId', getResumeVersions);

// Restore resume version
router.post('/restore-version/:versionId', restoreResumeVersion);

module.exports = router;
