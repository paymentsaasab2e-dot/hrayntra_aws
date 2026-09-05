import express from 'express';
import multer from 'multer';
import { clientController } from './client.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireAnyPermission } from '../../middleware/permission.middleware.js';

const router = express.Router();
const importUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const CLIENT_VIEW_PERMS = [
  'clients_read',
  'recruitment_clients_read',
  'recruitment_clients_create',
  'recruitment_clients_update',
  'recruitment_clients_delete',
  'view_all_recruitment_clients',
];
const CLIENT_CREATE_PERMS = ['clients_create', 'recruitment_clients_create'];
const CLIENT_UPDATE_PERMS = ['clients_update', 'recruitment_clients_update'];
const CLIENT_DELETE_PERMS = ['clients_delete', 'recruitment_clients_delete'];
const CLIENT_WRITE_PERMS = [...CLIENT_CREATE_PERMS, ...CLIENT_UPDATE_PERMS];

function requireClientsListAccess(req, res, next) {
  const recruitmentOnly = String(req.query.recruitmentEnabled || '').toLowerCase() === 'true';
  const names = recruitmentOnly
    ? CLIENT_VIEW_PERMS
    : ['clients_read'];
  return requireAnyPermission(names)(req, res, next);
}

router.use(authMiddleware);

router.get('/assignable-members', requireAnyPermission(CLIENT_WRITE_PERMS), clientController.getAssignableMembers);
router.get(
  '/recruitment-forward-targets',
  requireAnyPermission([...CLIENT_WRITE_PERMS, 'jobs_create', 'create_job']),
  clientController.listRecruitmentForwardTargets,
);
router.get('/', requireClientsListAccess, clientController.getAll);
router.get('/metrics', requireAnyPermission(CLIENT_VIEW_PERMS), clientController.getMetrics);
// Recycle Bin endpoints — registered BEFORE the `/:id` routes so '/trash' isn't read as an id.
router.get('/trash', requireAnyPermission([...CLIENT_VIEW_PERMS, ...CLIENT_DELETE_PERMS]), clientController.listTrash);
router.post('/trash/bulk-purge', requireAnyPermission(CLIENT_DELETE_PERMS), clientController.bulkPurge);
router.post('/:id/restore', requireAnyPermission(CLIENT_WRITE_PERMS), clientController.restore);
router.delete('/:id/purge', requireAnyPermission(CLIENT_DELETE_PERMS), clientController.purge);
router.post('/import/preview', requireAnyPermission(CLIENT_CREATE_PERMS), importUpload.single('file'), clientController.previewImport);
router.post('/import/check-duplicates', requireAnyPermission(CLIENT_CREATE_PERMS), clientController.checkImportDuplicates);
router.post('/import', requireAnyPermission(CLIENT_CREATE_PERMS), clientController.importClients);
router.get('/:id', requireAnyPermission(CLIENT_VIEW_PERMS), clientController.getById);
router.get('/:clientId/activities', requireAnyPermission(CLIENT_VIEW_PERMS), clientController.getActivities);
router.post('/', requireAnyPermission(CLIENT_CREATE_PERMS), clientController.create);
router.patch('/:id', requireAnyPermission(CLIENT_UPDATE_PERMS), clientController.update);
router.post(
  '/:id/send-to-recruitment',
  requireAnyPermission([...CLIENT_WRITE_PERMS, 'jobs_create', 'create_job']),
  clientController.sendToRecruitment,
);
router.delete('/:id', requireAnyPermission(CLIENT_DELETE_PERMS), clientController.delete);

// Notes routes
router.get('/:clientId/notes', requireAnyPermission(CLIENT_VIEW_PERMS), clientController.getNotes);
router.post('/:clientId/notes', requireAnyPermission(CLIENT_UPDATE_PERMS), clientController.createNote);
router.patch('/:clientId/notes/:noteId', requireAnyPermission(CLIENT_UPDATE_PERMS), clientController.updateNote);
router.delete('/:clientId/notes/:noteId', requireAnyPermission(CLIENT_DELETE_PERMS), clientController.deleteNote);

// Files routes
router.get('/:clientId/files', requireAnyPermission(CLIENT_VIEW_PERMS), clientController.getFiles);
router.post('/:clientId/files', requireAnyPermission(CLIENT_UPDATE_PERMS), clientController.createFile);
router.delete('/:clientId/files/:fileId', requireAnyPermission(CLIENT_DELETE_PERMS), clientController.deleteFile);

export default router;
