import express from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { attachUserPermissions, requireAnyPermission } from '../../middleware/permission.middleware.js';
import { orgController } from './org.controller.js';

const router = express.Router();

router.use(authMiddleware, attachUserPermissions);

// Organization is an admin screen: only explicit org-structure permission (or
// Super Admin, handled inside requireAnyPermission) may read it. `view_team` /
// `view_dashboard` used to be enough, which showed the tab to almost everyone.
const orgRead = requireAnyPermission(['org_structure', 'node_org_structure']);
const orgWrite = requireAnyPermission(['org_structure', 'node_org_structure']);

router.get('/', orgRead, orgController.list);
router.get('/tree', orgRead, orgController.tree);
router.get('/transferable-data', orgWrite, orgController.transferableData);
router.post('/transfer-data', orgWrite, orgController.transferData);
router.post('/', orgWrite, orgController.create);
router.post('/assign', orgWrite, orgController.assign);
// Body-based aliases (avoid nested-path 404s behind some proxies).
router.post('/adopt-workspace', orgWrite, orgController.adoptByBody);
router.post('/stamp-untagged', orgWrite, orgController.stampUntaggedByBody);
router.post('/:id/adopt-workspace', orgWrite, orgController.adopt);
router.post('/:id/stamp-untagged', orgWrite, orgController.stampUntagged);
router.patch('/:id', orgWrite, orgController.update);
router.delete('/:id', requireAnyPermission(['org_structure']), orgController.remove);

export default router;
