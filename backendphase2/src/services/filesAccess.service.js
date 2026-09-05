import { prisma } from '../config/prisma.js';
import { hasAnyPermission, hasPermission } from '../utils/permissionScope.js';
import { isSuperAdminUser } from '../utils/superAdminScope.js';
import { assertCanViewMemberActivity } from './activityVisibility.service.js';
import { jobService } from '../modules/job/job.service.js';
import { leadService } from '../modules/lead/lead.service.js';
import { clientService } from '../modules/client/client.service.js';
import { candidateService } from '../modules/candidate/candidate.service.js';
import { interviewService } from '../services/interview.service.js';

const ENTITY_READ_PERMISSIONS = {
  job: ['jobs_read', 'view_jobs', 'view_all_jobs', 'jobs_create', 'jobs_update'],
  lead: ['leads_read', 'leads_create', 'leads_update', 'view_all_leads'],
  client: [
    'clients_read', 'recruitment_clients_read', 'recruitment_clients_create', 'recruitment_clients_update',
    'view_all_recruitment_clients', 'clients_create', 'clients_update', 'view_all_clients', 'clients_handoff',
  ],
  candidate: ['candidates_read', 'view_all_candidates', 'view_assigned_candidates'],
  interview: ['interviews_read', 'interviews_create', 'interviews_update'],
  user: ['view_team', 'edit_team_member', 'add_team_member', 'view_team_activity'],
};

const ENTITY_WRITE_PERMISSIONS = {
  job: ['jobs_create', 'jobs_update', 'create_job', 'edit_job'],
  lead: ['leads_create', 'leads_update'],
  client: ['clients_create', 'clients_update', 'recruitment_clients_create', 'recruitment_clients_update'],
  candidate: ['candidates_create', 'candidates_update', 'add_candidate', 'edit_candidate'],
  interview: ['interviews_create', 'interviews_update'],
  user: ['edit_team_member', 'add_team_member'],
};

function assertModulePermission(req, entityType, mode = 'read') {
  if (isSuperAdminUser(req) || hasPermission(req, 'all')) return;
  const map = mode === 'write' ? ENTITY_WRITE_PERMISSIONS : ENTITY_READ_PERMISSIONS;
  const required = map[entityType];
  if (!required?.length) {
    throw new Error(`Unsupported entityType: ${entityType}`);
  }
  if (!hasAnyPermission(req, required)) {
    throw new Error(`You do not have permission to access ${entityType} files`);
  }
}

export async function assertCanAccessEntityFiles(req, entityType, entityId, { write = false } = {}) {
  const type = String(entityType || '').trim().toLowerCase();
  const id = String(entityId || '').trim();
  if (!type || !id) {
    throw new Error('entityType and entityId are required');
  }

  assertModulePermission(req, type, write ? 'write' : 'read');

  if (type === 'user') {
    if (id === req.user?.id) return;
    await assertCanViewMemberActivity(req.user?.id, id);
    return;
  }

  let record = null;
  switch (type) {
    case 'job':
      record = await jobService.getById(id, req);
      break;
    case 'lead':
      record = await leadService.getById(id, req);
      break;
    case 'client':
      record = await clientService.getById(id, req);
      break;
    case 'candidate':
      record = await candidateService.getById(id, req);
      break;
    case 'interview':
      record = await interviewService.getById(id, req);
      break;
    default:
      throw new Error(`Unsupported entityType: ${type}`);
  }

  if (!record) {
    throw new Error('Entity not found or access denied');
  }
}
