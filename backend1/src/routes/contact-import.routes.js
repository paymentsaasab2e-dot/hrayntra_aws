const { Router } = require('express');
const multer = require('multer');
const { previewContactImport, importContacts } = require('../controllers/contact-import.controller');

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/preview', upload.single('file'), previewContactImport);
router.post('/', importContacts);

module.exports = router;
