const { Router } = require('express');
const { protect } = require('../middleware/auth.middleware');
const { analyzeCV, getCvAnalysis } = require('../controllers/cv-analysis.controller');

const router = Router();
router.use(protect);

// Analyze CV
router.post('/analyze', analyzeCV);

// Get CV Analysis
router.get('/:candidateId', getCvAnalysis);

module.exports = router;
