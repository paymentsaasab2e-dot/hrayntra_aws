import express from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { uploadSingleGenericFile } from '../../utils/upload.middleware.js';
import { filesController } from './files.controller.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', filesController.getByEntity);
router.post('/', uploadSingleGenericFile, filesController.create);
router.delete('/:fileId', filesController.delete);

export default router;
