const express = require('express');
const { getDocumentDownload } = require('../controllers/documentDownload.controller');

const router = express.Router();

/** GET /api/document-download?url=...&filename=... */
router.get('/', getDocumentDownload);

module.exports = router;
