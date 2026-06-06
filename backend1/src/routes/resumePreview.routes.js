const express = require('express');
const { getResumePreview, getResumeDocxBytes } = require('../controllers/resumePreview.controller');

const router = express.Router();

/** GET /api/resume-preview/bytes?url=... — raw DOCX for docx-preview in the browser */
router.get('/bytes', getResumeDocxBytes);

/** GET /api/resume-preview?url=... — client-side Word layout preview */
router.get('/', getResumePreview);

module.exports = router;
