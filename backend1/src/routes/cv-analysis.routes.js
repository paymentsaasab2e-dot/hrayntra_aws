const { Router } = require('express');
const { analyzeCV, getCvAnalysis } = require('../controllers/cv-analysis.controller');

const router = Router();

// Analyze CV
router.post('/analyze', analyzeCV);

// Get CV Analysis
router.get('/:candidateId', getCvAnalysis);

module.exports = router;
