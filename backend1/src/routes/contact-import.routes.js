const { Router } = require('express');
const { protect } = require('../middleware/auth.middleware');
const multer = require('multer');
const { previewContactImport, importContacts } = require('../controllers/contact-import.controller');

const router = Router();
router.use(protect);
const upload = multer({ storage: multer.memoryStorage() });

router.post('/preview', upload.single('file'), previewContactImport);
router.post('/', importContacts);

module.exports = router;
