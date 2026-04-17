const { Router } = require('express');
const { getAllCandidates, getCandidateById, deleteCandidate } = require('../controllers/candidate.controller');

const router = Router();

// Get all candidates
router.get('/', getAllCandidates);

// Get single candidate
router.get('/:id', getCandidateById);

// Delete candidate
router.delete('/:id', deleteCandidate);

module.exports = router;
