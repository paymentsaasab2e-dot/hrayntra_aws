const { Router } = require('express');
const {
  createApplication,
  getApplications,
  getApplicationById,
  withdrawApplication,
  checkApplication,
  respondToOfferLetter,
} = require('../controllers/application.controller');

const router = Router();

// Create a new application
router.post('/', createApplication);

// Specific paths must be registered before /:candidateId (otherwise "check" is treated as candidateId)
router.get('/check/:candidateId/:jobId', checkApplication);
router.get('/detail/:applicationId', getApplicationById);
router.post('/detail/:applicationId/offer-response', respondToOfferLetter);
router.delete('/detail/:applicationId', withdrawApplication);

// Get all applications for a candidate
router.get('/:candidateId', getApplications);

module.exports = router;
