const { protect } = require('../middleware/auth.middleware');
const express = require('express');
const { getDocumentDownload } = require('../controllers/documentDownload.controller');

const router = express.Router();
router.use(protect);

/** GET /api/document-download?url=...&filename=... */
router.get('/', getDocumentDownload);

module.exports = router;
