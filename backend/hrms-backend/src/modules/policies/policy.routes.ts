import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { authMiddleware, authorize } from '../../shared/middleware/auth';
import { PolicyController } from './policy.controller';
import { resolveTenantId } from '../../shared/tenant/resolve-tenant';

const router = Router();

const uploadRoot = path.join(process.cwd(), 'uploads', 'policies');

const storage = multer.diskStorage({
  destination: async (req, _file, cb) => {
    try {
      const user = (req as any).user;
      const tenantId = (await resolveTenantId(user)) || 'default';
      const dir = path.join(uploadRoot, tenantId);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    } catch (err: any) {
      cb(err, uploadRoot);
    }
  },
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (allowed.includes(file.mimetype) || file.originalname.endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, Word, or text files are allowed'));
    }
  },
});

router.use(authMiddleware);

router.get('/active', PolicyController.getActive);
router.patch('/active', authorize(['ADMIN', 'HR']), PolicyController.updateActive);
router.get('/', authorize(['ADMIN', 'HR']), PolicyController.list);
router.get('/:id', authorize(['ADMIN', 'HR']), PolicyController.getById);
router.post('/upload', authorize(['ADMIN', 'HR']), upload.single('file'), PolicyController.upload);
router.post('/', authorize(['ADMIN', 'HR']), PolicyController.createManual);
router.patch('/:id/rules', authorize(['ADMIN', 'HR']), PolicyController.updateRules);
router.post('/:id/publish', authorize(['ADMIN', 'HR']), PolicyController.publish);
router.post('/versions/:versionId/acknowledge', PolicyController.acknowledge);

export default router;
