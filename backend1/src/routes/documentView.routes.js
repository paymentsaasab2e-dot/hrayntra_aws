const { protect } = require('../middleware/auth.middleware');
const express = require('express');
const { getDocumentView } = require('../controllers/documentDownload.controller');

const router = express.Router();
router.use(protect);

/** GET /api/document-view?url=...&filename=... */
router.get('/', getDocumentView);

module.exports = router;
