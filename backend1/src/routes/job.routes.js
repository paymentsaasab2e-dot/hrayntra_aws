const express = require('express');
const router = express.Router();
const jobController = require('../controllers/job.controller');

// Get personalized job matches
router.get('/personalized', jobController.getPersonalizedJobs);

// Get location recommendations
router.get('/location-recommend', jobController.recommendLocations);

// Get job recommendations (autocomplete)
router.get('/recommend', jobController.recommendJobs);

// Get all jobs
router.get('/', jobController.getAllJobs);

// Seed sample jobs (for testing)
router.post('/seed', jobController.seedSampleJobs);

// Bulk delete jobs
router.delete('/bulk-delete', jobController.bulkDeleteJobs);

// Get job by ID
router.get('/:jobId', jobController.getJobById);

// Delete a single job
router.delete('/:jobId', jobController.deleteJob);

module.exports = router;
