const express = require('express');
const router = express.Router();
const jobController = require('../controllers/job.controller');
const { protect } = require('../middleware/auth.middleware');
const { requireSystemAdmin } = require('../middleware/system-admin.middleware');

// PUBLIC: partner XML feeds / status
router.get('/adzuna.xml', jobController.getAdzunaFeed);
router.get('/adzuna/status', jobController.getAdzunaStatus);
router.get('/careerjet.xml', jobController.getCareerjetFeed);

// SENSITIVE: personalized matches require auth
router.get('/personalized', protect, jobController.getPersonalizedJobs);

// PUBLIC: job browse / autocomplete (intended catalog)
router.get('/location-recommend', jobController.recommendLocations);
router.get('/recommend', jobController.recommendJobs);
router.get('/', jobController.getAllJobs);

// SENSITIVE: mutating / admin — system admin key
router.post('/cache/invalidate', requireSystemAdmin, jobController.invalidateJobsCache);
router.post('/seed', requireSystemAdmin, jobController.seedSampleJobs);
router.delete('/bulk-delete', requireSystemAdmin, jobController.bulkDeleteJobs);

// Pre-screen assessments — auth required (candidate-facing detail)
router.get('/:jobId/pre-screen-assessments', protect, jobController.getJobPreScreenAssessments);

// PUBLIC: single job detail for browsing
router.get('/:jobId', jobController.getJobById);

// SENSITIVE: delete
router.delete('/:jobId', requireSystemAdmin, jobController.deleteJob);

module.exports = router;
