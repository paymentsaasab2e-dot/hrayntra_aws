const { Router } = require('express');
const { protect } = require('../middleware/auth.middleware');
const { requireOwnCandidate } = require('../middleware/requireOwnCandidate.middleware');
const { requireSystemAdmin } = require('../middleware/system-admin.middleware');
const {
  getAllCandidates,
  getCandidateById,
  getCandidateDeletePreview,
  getCandidatesDeletePreview,
  deleteCandidate,
  bulkDeleteCandidates,
} = require('../controllers/candidate.controller');

const router = Router();

// Listing / bulk delete are administrative
router.get('/', requireSystemAdmin, getAllCandidates);
router.delete('/bulk-delete', requireSystemAdmin, bulkDeleteCandidates);
router.post('/delete-preview', requireSystemAdmin, getCandidatesDeletePreview);

// Self-service (or admin via x-internal-admin-key bypass in requireOwnCandidate)
router.get('/:id/delete-preview', protect, requireOwnCandidate, getCandidateDeletePreview);
router.get('/:id', protect, requireOwnCandidate, getCandidateById);
router.delete('/:id', protect, requireOwnCandidate, deleteCandidate);

module.exports = router;
