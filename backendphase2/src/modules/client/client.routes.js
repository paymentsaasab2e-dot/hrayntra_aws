import express from 'express';
import multer from 'multer';
import { clientController } from './client.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireAnyPermission } from '../../middleware/permission.middleware.js';

const router = express.Router();
const importUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/** CRM Clients module only — never grant via recruitment_* alone. */
const CRM_VIEW_PERMS = [
  'clients_read',
  'clients_create',
  'clients_update',
  'clients_delete',
  'view_all_clients',
  'clients_handoff',
];
const CRM_CREATE_PERMS = ['clients_create'];
const CRM_UPDATE_PERMS = ['clients_update'];
const CRM_DELETE_PERMS = ['clients_delete'];

/** Recruitment Clients module only — independent of CRM Clients. */
const RECRUITMENT_VIEW_PERMS = [
  'recruitment_clients_read',
  'recruitment_clients_create',
  'recruitment_clients_update',
  'recruitment_clients_delete',
  'view_all_recruitment_clients',
];
const RECRUITMENT_CREATE_PERMS = ['recruitment_clients_create'];
const RECRUITMENT_UPDATE_PERMS = ['recruitment_clients_update'];
const RECRUITMENT_DELETE_PERMS = ['recruitment_clients_delete'];

/** Shared endpoints that may touch either type (type-checked in the service). */
const ANY_VIEW_PERMS = [...CRM_VIEW_PERMS, ...RECRUITMENT_VIEW_PERMS];
const ANY_CREATE_PERMS = [...CRM_CREATE_PERMS, ...RECRUITMENT_CREATE_PERMS];
const ANY_UPDATE_PERMS = [...CRM_UPDATE_PERMS, ...RECRUITMENT_UPDATE_PERMS];
const ANY_DELETE_PERMS = [...CRM_DELETE_PERMS, ...RECRUITMENT_DELETE_PERMS];
const ANY_WRITE_PERMS = [...ANY_CREATE_PERMS, ...ANY_UPDATE_PERMS];

function isRecruitmentRequest(req) {
  const queryFlag = String(req.query?.recruitmentEnabled || '').toLowerCase() === 'true';
  const bodyFlag =
    req.body?.recruitmentEnabled === true ||
    String(req.body?.recruitmentEnabled || '').toLowerCase() === 'true';
  return queryFlag || bodyFlag;
}

function requireClientsListAccess(req, res, next) {
  const names = isRecruitmentRequest(req) ? RECRUITMENT_VIEW_PERMS : CRM_VIEW_PERMS;
  return requireAnyPermission(names)(req, res, next);
}

function requireClientsCreateAccess(req, res, next) {
  const names = isRecruitmentRequest(req) ? RECRUITMENT_CREATE_PERMS : CRM_CREATE_PERMS;
  return requireAnyPermission(names)(req, res, next);
}

function requireClientsMetricsAccess(req, res, next) {
  const names = isRecruitmentRequest(req) ? RECRUITMENT_VIEW_PERMS : CRM_VIEW_PERMS;
  return requireAnyPermission(names)(req, res, next);
}

router.use(authMiddleware);

router.get('/assignable-members', requireAnyPermission(ANY_WRITE_PERMS), clientController.getAssignableMembers);
router.get(
  '/recruitment-forward-targets',
  requireAnyPermission([...CRM_UPDATE_PERMS, ...CRM_CREATE_PERMS, 'jobs_create', 'create_job']),
  clientController.listRecruitmentForwardTargets,
);
router.get('/', requireClientsListAccess, clientController.getAll);
router.get('/metrics', requireClientsMetricsAccess, clientController.getMetrics);
// Recycle Bin endpoints — registered BEFORE the `/:id` routes so '/trash' isn't read as an id.
router.get('/trash', requireAnyPermission([...ANY_VIEW_PERMS, ...ANY_DELETE_PERMS]), clientController.listTrash);
router.post('/trash/bulk-purge', requireAnyPermission(ANY_DELETE_PERMS), clientController.bulkPurge);
router.post('/:id/restore', requireAnyPermission(ANY_WRITE_PERMS), clientController.restore);
router.delete('/:id/purge', requireAnyPermission(ANY_DELETE_PERMS), clientController.purge);
router.post('/import/preview', requireClientsCreateAccess, importUpload.single('file'), clientController.previewImport);
router.post('/import/check-duplicates', requireClientsCreateAccess, clientController.checkImportDuplicates);
router.post('/import', requireClientsCreateAccess, clientController.importClients);
router.get('/:id', requireAnyPermission(ANY_VIEW_PERMS), clientController.getById);
router.get('/:clientId/activities', requireAnyPermission(ANY_VIEW_PERMS), clientController.getActivities);
router.post('/', requireClientsCreateAccess, clientController.create);
router.patch('/:id', requireAnyPermission(ANY_UPDATE_PERMS), clientController.update);
router.post(
  '/:id/send-to-recruitment',
  requireAnyPermission([...CRM_UPDATE_PERMS, ...CRM_CREATE_PERMS, 'jobs_create', 'create_job']),
  clientController.sendToRecruitment,
);
router.delete('/:id', requireAnyPermission(ANY_DELETE_PERMS), clientController.delete);

// Notes routes
router.get('/:clientId/notes', requireAnyPermission(ANY_VIEW_PERMS), clientController.getNotes);
router.post('/:clientId/notes', requireAnyPermission(ANY_UPDATE_PERMS), clientController.createNote);
router.patch('/:clientId/notes/:noteId', requireAnyPermission(ANY_UPDATE_PERMS), clientController.updateNote);
router.delete('/:clientId/notes/:noteId', requireAnyPermission(ANY_DELETE_PERMS), clientController.deleteNote);

// Files routes
router.get('/:clientId/files', requireAnyPermission(ANY_VIEW_PERMS), clientController.getFiles);
router.post('/:clientId/files', requireAnyPermission(ANY_UPDATE_PERMS), clientController.createFile);
router.delete('/:clientId/files/:fileId', requireAnyPermission(ANY_DELETE_PERMS), clientController.deleteFile);

export default router;
