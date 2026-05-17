const { Router } = require('express');
const {
  getAllCandidates,
  getCandidateById,
  deleteCandidate,
  bulkDeleteCandidates,
} = require('../controllers/candidate.controller');

const router = Router();

// Get all candidates
router.get('/', getAllCandidates);

// Bulk delete (must be registered before /:id)
router.delete('/bulk-delete', bulkDeleteCandidates);

// Get single candidate
router.get('/:id', getCandidateById);

// Delete candidate
router.delete('/:id', deleteCandidate);

module.exports = router;
