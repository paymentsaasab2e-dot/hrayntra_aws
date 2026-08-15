import express from 'express';
import multer from 'multer';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { companyPageController } from './company-page.controller.js';
import {
  COMPANY_LOGO_MAX_BYTES,
  COMPANY_POST_MEDIA_MAX_BYTES,
  companyLogoMulterFilter,
  companyPostMediaMulterFilter,
} from './company-page-logo.service.js';

const router = express.Router();

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: COMPANY_LOGO_MAX_BYTES, files: 1 },
  fileFilter: companyLogoMulterFilter,
});

const postMediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: COMPANY_POST_MEDIA_MAX_BYTES, files: 1 },
  fileFilter: companyPostMediaMulterFilter,
});

router.use(authMiddleware);

router.get('/', companyPageController.get);
router.put('/', companyPageController.upsert);
router.post('/logo', logoUpload.single('file'), companyPageController.uploadLogo);
router.post('/posts/media', postMediaUpload.single('file'), companyPageController.uploadPostMedia);
router.post('/posts', companyPageController.createPost);
router.delete('/posts/:postId', companyPageController.deletePost);
router.post('/resync', companyPageController.resync);

export default router;
