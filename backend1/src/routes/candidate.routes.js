const { Router } = require('express');
const {
  getAllCandidates,
  getCandidateById,
  getCandidateDeletePreview,
  getCandidatesDeletePreview,
  deleteCandidate,
  bulkDeleteCandidates,
} = require('../controllers/candidate.controller');

const router = Router();

// Get all candidates
router.get('/', getAllCandidates);

// Bulk delete (must be registered before /:id)
router.delete('/bulk-delete', bulkDeleteCandidates);

// Delete preview (full Phase 1 + common DB) — before /:id
router.post('/delete-preview', getCandidatesDeletePreview);
router.get('/:id/delete-preview', getCandidateDeletePreview);

// Get single candidate
router.get('/:id', getCandidateById);

// Delete candidate
router.delete('/:id', deleteCandidate);

module.exports = router;
