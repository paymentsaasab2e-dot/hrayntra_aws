const express = require('express');
const router = express.Router();
const jobController = require('../controllers/job.controller');

// Get all jobs
router.get('/', jobController.getAllJobs);

// Seed sample jobs (for testing)
router.post('/seed', jobController.seedSampleJobs);

// Get job by ID
router.get('/:jobId', jobController.getJobById);

module.exports = router;
