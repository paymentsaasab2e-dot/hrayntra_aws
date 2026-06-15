import express from 'express';
import { jobController } from './job.controller.js';
import { jobPublicApplyController } from './jobPublicApply.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { publicApplyTenantMiddleware } from '../../middleware/tenant-context.middleware.js';
import { uploadSingleJobFile, uploadJobJdFile, publicApplyUpload } from '../../utils/upload.middleware.js';
import { requireAnyPermission } from '../../middleware/permission.middleware.js';

const router = express.Router();

router.get('/public-feed', jobController.getPublicFeed);
router.get('/public/apply/:token', jobPublicApplyController.getPublicApplyPage);
router.post(
  '/public/apply/:token/submit',
  publicApplyUpload,
  publicApplyTenantMiddleware,
  jobPublicApplyController.submitPublicApply
);

router.use(authMiddleware);

router.get('/application-form-templates', requireAnyPermission(['jobs_read', 'view_jobs', 'jobs_create', 'create_job']), jobPublicApplyController.listTemplates);
router.post('/application-form-templates', requireAnyPermission(['jobs_create', 'create_job', 'jobs_update', 'edit_job']), jobPublicApplyController.createTemplate);
router.patch('/application-form-templates/:id', requireAnyPermission(['jobs_update', 'edit_job', 'jobs_create', 'create_job']), jobPublicApplyController.updateTemplate);
router.delete('/application-form-templates/:id', requireAnyPermission(['jobs_delete', 'delete_job', 'jobs_update', 'edit_job']), jobPublicApplyController.deleteTemplate);
router.get('/:jobId/apply-link', requireAnyPermission(['jobs_read', 'view_jobs']), jobPublicApplyController.getApplyLink);

router.post(
  '/process-jd-file',
  requireAnyPermission(['jobs_create', 'create_job']),
  uploadJobJdFile,
  jobController.processJdFile
);

router.get('/', requireAnyPermission(['jobs_read', 'view_jobs']), jobController.getAll);
router.get('/metrics', requireAnyPermission(['jobs_read', 'view_jobs']), jobController.getMetrics);
// Recycle Bin endpoints — registered BEFORE the `/:id` routes so '/trash' isn't read as an id.
router.get('/trash', requireAnyPermission(['jobs_read', 'view_jobs', 'jobs_delete', 'delete_job']), jobController.listTrash);
router.post('/trash/bulk-purge', requireAnyPermission(['jobs_delete', 'delete_job']), jobController.bulkPurge);
router.post('/:id/restore', requireAnyPermission(['jobs_update', 'edit_job', 'jobs_create', 'create_job']), jobController.restore);
router.delete('/:id/purge', requireAnyPermission(['jobs_delete', 'delete_job']), jobController.purge);
router.get('/:id', requireAnyPermission(['jobs_read', 'view_jobs']), jobController.getById);
router.post('/', requireAnyPermission(['jobs_create', 'create_job']), jobController.create);
router.patch('/:id', requireAnyPermission(['jobs_update', 'edit_job', 'assign_job']), jobController.update);
router.delete('/:id', requireAnyPermission(['jobs_delete', 'delete_job']), jobController.delete);

// Notes routes
router.get('/:jobId/notes', requireAnyPermission(['jobs_read', 'view_jobs']), jobController.getNotes);
router.get('/:jobId/activities', requireAnyPermission(['jobs_read', 'view_jobs']), jobController.getActivities);
router.post('/:jobId/notes', requireAnyPermission(['jobs_update', 'edit_job']), jobController.createNote);
router.patch('/:jobId/notes/:noteId', requireAnyPermission(['jobs_update', 'edit_job']), jobController.updateNote);
router.delete('/:jobId/notes/:noteId', requireAnyPermission(['jobs_delete', 'delete_job']), jobController.deleteNote);

// Files routes
router.get('/:jobId/files', requireAnyPermission(['jobs_read', 'view_jobs']), jobController.getFiles);
router.post('/:jobId/files', requireAnyPermission(['jobs_update', 'edit_job']), uploadSingleJobFile, jobController.createFile);
router.delete('/:jobId/files/:fileId', requireAnyPermission(['jobs_delete', 'delete_job']), jobController.deleteFile);

export default router;
