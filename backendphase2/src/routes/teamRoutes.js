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
  impersonateTeamMember,
} from '../controllers/teamController.js';

const router = express.Router();

/** Lets CRM users (Sales, HR, etc.) load the tenant member list for Assigned-to pickers — not only Team admins. */
const PERMISSIONS_TEAM_DIRECTORY_READ = [
  'add_team_member',
  'edit_team_member',
  'assign_roles',
  'clients_read',
  'recruitment_clients_read',
  'recruitment_clients_create',
  'recruitment_clients_update',
  'clients_update',
  'leads_read',
  'leads_update',
  'jobs_read',
  'jobs_update',
  'assign_job',
  'view_jobs',
  'create_job',
  'edit_job',
  'candidates_read',
  'candidates_update',
  'view_assigned_candidates',
  'view_all_candidates',
  'interviews_read',
  'interviews_update',
  'placements_read',
  'placements_update',
  'requests_read',
  'requests_create',
  'view_all_requests',
];

// Apply auth middleware to all routes
router.use(authMiddleware);

// Tenant member list for assignment pickers — Super Admin / HQ can assign across companies.
router.get('/assignable', (req, res) => {
  req.teamListMode = 'assignable';
  return getAllTeamMembers(req, res);
});

// Team member routes (admin / CRM screens that read full directory with explicit permissions)
router.get('/', requireAnyPermission(PERMISSIONS_TEAM_DIRECTORY_READ), getAllTeamMembers);
router.post('/', requirePermission('add_team_member'), createTeamMember);
router.get('/:id', requireAnyPermission(PERMISSIONS_TEAM_DIRECTORY_READ), getTeamMemberById);
router.patch('/:id', requirePermission('edit_team_member'), updateTeamMember);
router.delete('/:id', requirePermission('edit_team_member'), deleteTeamMember);
router.post('/:id/deactivate', requirePermission('edit_team_member'), deactivateTeamMember);
router.post('/:id/activate', requirePermission('edit_team_member'), activateTeamMember);
router.post('/:id/credentials', requirePermission('generate_credentials'), generateMemberCredentials);
router.post('/:id/reset-password', requirePermission('generate_credentials'), resetMemberPassword);
router.post('/:id/resend-invite', requirePermission('generate_credentials'), resendMemberInvite);
router.post('/:id/lock', requirePermission('add_team_member'), lockMemberAccount);
router.post('/:id/unlock', requirePermission('add_team_member'), unlockMemberAccount);
router.post('/:id/impersonate', impersonateTeamMember);
router.get('/:id/login-history', requirePermission('add_team_member'), getMemberLoginHistory);
router.get('/:id/activity', requireAnyPermission(['add_team_member', 'edit_team_member', 'assign_roles']), getMemberActivity);
router.get('/:id/targets', requirePermission('manage_targets'), getMemberTargets);
router.post('/:id/targets', requirePermission('manage_targets'), saveMemberTargets);

export default router;
