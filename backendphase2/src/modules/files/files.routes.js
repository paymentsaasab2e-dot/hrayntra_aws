import express from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { uploadSingleEntityFileS3 } from '../../middleware/s3EntityUpload.middleware.js';
import { filesController } from './files.controller.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', filesController.getByEntity);
router.post('/', uploadSingleEntityFileS3, filesController.create);
router.delete('/:fileId', filesController.delete);

export default router;
