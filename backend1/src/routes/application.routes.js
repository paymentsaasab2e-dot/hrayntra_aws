const { Router } = require('express');
const { protect } = require('../middleware/auth.middleware');
const { requireOwnCandidate } = require('../middleware/requireOwnCandidate.middleware');
const {
  createApplication,
  getApplications,
  getApplicationById,
  withdrawApplication,
  checkApplication,
  respondToOfferLetter,
} = require('../controllers/application.controller');

const router = Router();

router.use(protect);

router.post('/', createApplication);
router.get('/check/:candidateId/:jobId', requireOwnCandidate, checkApplication);
router.get('/detail/:applicationId', getApplicationById);
router.post('/detail/:applicationId/offer-response', respondToOfferLetter);
router.delete('/detail/:applicationId', withdrawApplication);
router.get('/:candidateId', requireOwnCandidate, getApplications);

module.exports = router;
