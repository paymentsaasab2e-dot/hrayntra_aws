const express = require('express');
const router = express.Router();
const jobController = require('../controllers/job.controller');

// Adzuna / Careerjet XML feeds (must be before /:jobId)
router.get('/adzuna.xml', jobController.getAdzunaFeed);
router.get('/adzuna/status', jobController.getAdzunaStatus);
router.get('/careerjet.xml', jobController.getCareerjetFeed);

// Get personalized job matches
router.get('/personalized', jobController.getPersonalizedJobs);

// Get location recommendations
router.get('/location-recommend', jobController.recommendLocations);

// Get job recommendations (autocomplete)
router.get('/recommend', jobController.recommendJobs);

// Get all jobs
router.get('/', jobController.getAllJobs);

// Phase 2 CRM calls this after mirroring job edits to the portal DB.
router.post('/cache/invalidate', jobController.invalidateJobsCache);

// Seed sample jobs (for testing)
router.post('/seed', jobController.seedSampleJobs);

// Bulk delete jobs
router.delete('/bulk-delete', jobController.bulkDeleteJobs);

// Pre-screen assessments mirrored from Phase 2 CRM
router.get('/:jobId/pre-screen-assessments', jobController.getJobPreScreenAssessments);

// Get job by ID
router.get('/:jobId', jobController.getJobById);

// Delete a single job
router.delete('/:jobId', jobController.deleteJob);

module.exports = router;
