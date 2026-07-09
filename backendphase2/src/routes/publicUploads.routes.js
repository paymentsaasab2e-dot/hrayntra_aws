import { Router } from 'express';
import { getPublicUpload } from '../controllers/publicUploads.controller.js';

const router = Router();

function withUploadSubdir(subdir) {
  return (req, _res, next) => {
    req.uploadSubdir = subdir;
    next();
  };
}

/** GET /api/v1/public/uploads/placements/:filename — candidate offer letters */
router.get('/placements/:filename', withUploadSubdir('placements'), getPublicUpload);
/** GET /api/v1/public/uploads/interview-client-review/:filename — client-review PDFs */
router.get(
  '/interview-client-review/:filename',
  withUploadSubdir('interview-client-review'),
  getPublicUpload,
);

export default router;
