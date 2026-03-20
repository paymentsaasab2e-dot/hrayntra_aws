const { Router } = require('express');
const {
  createApplication,
  getApplications,
  checkApplication,
} = require('../controllers/application.controller');

const router = Router();

// Create a new application
router.post('/', createApplication);

// Specific paths must be registered before /:candidateId (otherwise "check" is treated as candidateId)
router.get('/check/:candidateId/:jobId', checkApplication);

// Get all applications for a candidate
router.get('/:candidateId', getApplications);

module.exports = router;
