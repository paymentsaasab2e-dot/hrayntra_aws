import express from 'express';
import { teamController } from './team.controller.js';
import { teamMemberController } from './teamMember.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/permission.middleware.js';

const router = express.Router();

router.use(authMiddleware);

// Team Member routes (individual users as team members)
// Viewing team members - allow all authenticated users (or require view_team_members if it exists)
// For now, we'll allow authenticated users to view, but require permissions for modifications
router.get('/', teamMemberController.getAll);
router.get('/:id', teamMemberController.getById);
router.post('/', requirePermission('add_team_member'), teamMemberController.create);
router.patch('/:id', requirePermission('edit_team_member'), teamMemberController.update);
router.delete('/:id', requirePermission('edit_team_member'), teamMemberController.delete);
router.post('/:id/credentials', requirePermission('generate_credentials'), teamMemberController.generateCredentials);
router.post('/:id/reset-password', requirePermission('generate_credentials'), teamMemberController.resetPassword);
router.post('/:id/resend-invite', requirePermission('generate_credentials'), teamMemberController.resendInvite);
router.post('/:id/lock', requirePermission('add_team_member'), teamMemberController.lockAccount);
router.post('/:id/unlock', requirePermission('add_team_member'), teamMemberController.unlockAccount);
router.get('/:id/login-history', requirePermission('add_team_member'), teamMemberController.getLoginHistory);
router.get('/:id/activity', teamMemberController.getActivity);

// Legacy Team routes (for team groups - keeping for backward compatibility)
router.get('/groups', teamController.getAll);
router.get('/groups/:id', teamController.getById);
router.post('/groups', teamController.create);
router.patch('/groups/:id', teamController.update);
router.post('/groups/:id/members', teamController.addMember);
router.delete('/groups/:id/members/:userId', teamController.removeMember);
router.delete('/groups/:id', teamController.delete);

export default router;
