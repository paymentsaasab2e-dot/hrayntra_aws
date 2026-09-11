import express from 'express';
import { teamController } from './team.controller.js';
import { teamMemberController } from './teamMember.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireAnyPermission, requirePermission } from '../../middleware/permission.middleware.js';

const router = express.Router();

router.use(authMiddleware);

// Sales / named groups — must be registered BEFORE /:id member routes.
router.get(
  '/groups',
  requireAnyPermission(['edit_team_member', 'add_team_member', 'view_team', 'assign_roles']),
  teamController.getAll,
);
router.get(
  '/groups/sales-candidates',
  requireAnyPermission(['edit_team_member', 'add_team_member', 'view_team']),
  teamController.salesCandidates,
);
router.get(
  '/groups/:id',
  requireAnyPermission(['edit_team_member', 'add_team_member', 'view_team', 'assign_roles']),
  teamController.getById,
);
router.post(
  '/groups',
  requireAnyPermission(['edit_team_member', 'add_team_member']),
  teamController.create,
);
router.patch(
  '/groups/:id',
  requireAnyPermission(['edit_team_member', 'add_team_member']),
  teamController.update,
);
router.post(
  '/groups/:id/members',
  requireAnyPermission(['edit_team_member', 'add_team_member']),
  teamController.addMember,
);
router.delete(
  '/groups/:id/members/:userId',
  requireAnyPermission(['edit_team_member', 'add_team_member']),
  teamController.removeMember,
);
router.delete(
  '/groups/:id',
  requireAnyPermission(['edit_team_member', 'add_team_member']),
  teamController.delete,
);

// Team Member routes (individual users as team members)
router.get('/', teamMemberController.getAll);
router.get('/:id', teamMemberController.getById);
router.post('/', requireAnyPermission(['add_team_member']), teamMemberController.create);
router.patch('/:id', requireAnyPermission(['edit_team_member']), teamMemberController.update);
router.delete('/:id', requireAnyPermission(['edit_team_member']), teamMemberController.delete);
router.post('/:id/credentials', requirePermission('generate_credentials'), teamMemberController.generateCredentials);
router.post('/:id/reset-password', requirePermission('generate_credentials'), teamMemberController.resetPassword);
router.post('/:id/set-password', teamMemberController.setPassword);
router.post('/:id/impersonate', teamMemberController.impersonate);
router.post('/:id/resend-invite', requirePermission('generate_credentials'), teamMemberController.resendInvite);
router.post('/:id/lock', requirePermission('add_team_member'), teamMemberController.lockAccount);
router.post('/:id/unlock', requirePermission('add_team_member'), teamMemberController.unlockAccount);
router.get('/:id/login-history', requirePermission('add_team_member'), teamMemberController.getLoginHistory);
router.get('/:id/activity', teamMemberController.getActivity);
router.get('/:id/targets', requirePermission('manage_targets'), teamMemberController.getTargets);
router.post('/:id/targets', requirePermission('manage_targets'), teamMemberController.saveTargets);
router.get(
  '/:id/permissions',
  requireAnyPermission(['edit_team_member', 'add_team_member', 'view_team']),
  teamMemberController.getPermissions,
);
router.put(
  '/:id/permissions',
  requireAnyPermission(['edit_team_member', 'add_team_member']),
  teamMemberController.savePermissions,
);

export default router;
