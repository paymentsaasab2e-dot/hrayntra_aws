import express from 'express';
import multer from 'multer';
import { authMiddleware as authenticate } from '../middleware/auth.middleware.js';
import { requireCoins } from '../middleware/requireCoins.middleware.js';
import {
  handleAriaMessage,
  handleAriaUndo,
} from '../controllers/ariaController.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(csv|xlsx|xls)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are allowed'));
    }
  },
});

router.post('/', authenticate, upload.single('file'), requireCoins('ai.aria_leads'), handleAriaMessage);
router.post('/undo', authenticate, handleAriaUndo);

export default router;
