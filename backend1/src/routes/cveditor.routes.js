const { Router } = require('express');
const {
  getResumeHTML,
  saveResumeHTML,
  improveTextWithAI,
  exportResumePDF,
} = require('../controllers/cveditor.controller');
const { protect } = require('../middleware/auth.middleware');
const { requireOwnCandidate } = require('../middleware/requireOwnCandidate.middleware');
const { requireTokens } = require('../middleware/requireTokens.middleware');

const router = Router();
router.use(protect);

router.get('/resume/:candidateId', requireOwnCandidate, getResumeHTML);
router.post('/save', saveResumeHTML);
router.post('/ai-improve', requireTokens('cveditor.ai-improve'), improveTextWithAI);
router.post('/export', exportResumePDF);

module.exports = router;
