const express = require('express');
const { getResumePreview } = require('../controllers/resumePreview.controller');

const router = express.Router();

/** GET /api/resume-preview?url=... — server-side DOCX → HTML for profile preview */
router.get('/', getResumePreview);

module.exports = router;
