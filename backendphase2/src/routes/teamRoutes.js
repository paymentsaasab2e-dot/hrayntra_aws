import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireAnyPermission, requirePermission } from '../middleware/permission.middleware.js';
import {
  getAllTeamMembers,
  getTeamMemberById,
  createTeamMember,
  updateTeamMember,
  deactivateTeamMember,
  deleteTeamMember,
  activateTeamMember,
  generateMemberCredentials,
  resetMemberPassword,
  resendMemberInvite,
  lockMemberAccount,
  unlockMemberAccount,
  getMemberLoginHistory,
  getMemberActivity,
  getMemberTargets,
  saveMemberTargets,
} from '../controllers/teamController.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Team member routes
router.get('/', requireAnyPermission(['add_team_member', 'edit_team_member', 'assign_roles']), getAllTeamMembers);
router.post('/', requirePermission('add_team_member'), createTeamMember);
router.get('/:id', requireAnyPermission(['add_team_member', 'edit_team_member', 'assign_roles']), getTeamMemberById);
router.patch('/:id', requirePermission('edit_team_member'), updateTeamMember);
router.delete('/:id', requirePermission('edit_team_member'), deleteTeamMember);
router.post('/:id/deactivate', requirePermission('edit_team_member'), deactivateTeamMember);
router.post('/:id/activate', requirePermission('edit_team_member'), activateTeamMember);
router.post('/:id/credentials', requirePermission('generate_credentials'), generateMemberCredentials);
router.post('/:id/reset-password', requirePermission('generate_credentials'), resetMemberPassword);
router.post('/:id/resend-invite', requirePermission('generate_credentials'), resendMemberInvite);
router.post('/:id/lock', requirePermission('add_team_member'), lockMemberAccount);
router.post('/:id/unlock', requirePermission('add_team_member'), unlockMemberAccount);
router.get('/:id/login-history', requirePermission('add_team_member'), getMemberLoginHistory);
router.get('/:id/activity', requireAnyPermission(['add_team_member', 'edit_team_member', 'assign_roles']), getMemberActivity);
router.get('/:id/targets', requirePermission('manage_targets'), getMemberTargets);
router.post('/:id/targets', requirePermission('manage_targets'), saveMemberTargets);

export default router;
