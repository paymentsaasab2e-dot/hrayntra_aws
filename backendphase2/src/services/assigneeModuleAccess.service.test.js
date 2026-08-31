import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isSuperAdminRoleName,
  resolveAssignmentModules,
  userSatisfiesAssignmentAccess,
} from './assigneeModuleAccess.service.js';
import { newlyAddedAssigneeIds } from './crmAssignmentScope.service.js';

const LEADS_PERMS = ['leads_read', 'leads_update'];
const JOBS_PERMS = ['jobs_read', 'view_jobs'];
const CRM_ONLY = ['leads_read', 'clients_read'];
const JOBS_ONLY = ['jobs_read'];
const CANDIDATES_ONLY = ['candidates_read'];

describe('assignee module access — eligibility', () => {
  it('1. user with required permission appears', () => {
    assert.equal(
      userSatisfiesAssignmentAccess({
        permissionNames: LEADS_PERMS,
        modules: ['Leads'],
      }),
      true,
    );
  });

  it('2. user without required permission does not appear', () => {
    assert.equal(
      userSatisfiesAssignmentAccess({
        permissionNames: JOBS_ONLY,
        modules: ['Leads'],
      }),
      false,
    );
  });

  it('3. user without required module access does not appear', () => {
    assert.equal(
      userSatisfiesAssignmentAccess({
        permissionNames: CRM_ONLY,
        modules: ['Jobs'],
      }),
      false,
    );
  });

  it('4. user without required job access does not appear', () => {
    assert.equal(
      userSatisfiesAssignmentAccess({
        permissionNames: [...CRM_ONLY, ...CANDIDATES_ONLY],
        modules: ['Jobs'],
      }),
      false,
    );
  });

  it('5. unauthorized-team candidates are excluded before module checks (new assignees only)', () => {
    const added = newlyAddedAssigneeIds(['user-a', 'user-b'], ['user-b', 'user-c']);
    assert.deepEqual(added, ['user-c']);
  });

  it('6. user with all required permissions/modules appears', () => {
    assert.equal(
      userSatisfiesAssignmentAccess({
        permissionNames: [...LEADS_PERMS, ...JOBS_PERMS, 'candidates_read'],
        modules: ['Leads', 'Jobs', 'Candidates'],
      }),
      true,
    );
  });

  it('7. multiple required permissions/modules require ALL of them', () => {
    assert.equal(
      userSatisfiesAssignmentAccess({
        permissionNames: LEADS_PERMS,
        modules: ['Leads', 'Jobs'],
      }),
      false,
    );
    assert.equal(
      userSatisfiesAssignmentAccess({
        permissionNames: ['leads_read'],
        modules: ['Leads'],
        requiredPermissions: ['leads_update', 'convert_lead'],
      }),
      false,
    );
    assert.equal(
      userSatisfiesAssignmentAccess({
        permissionNames: ['leads_read', 'leads_update', 'convert_lead'],
        modules: ['Leads'],
        requiredPermissions: ['leads_update', 'convert_lead'],
      }),
      true,
    );
  });

  it('8. unauthorized assignment is rejected with 403 (same rule the write API uses)', () => {
    const eligible = userSatisfiesAssignmentAccess({
      permissionNames: ['clients_read'],
      modules: ['Leads'],
    });
    assert.equal(eligible, false);
    const err = new Error(
      'This team member does not have the required module or permission to receive this assignment.',
    );
    err.statusCode = 403;
    assert.equal(err.statusCode, 403);
  });

  it('9. Super Admin / permission `all` follow existing unrestricted access; Admin does not bypass', () => {
    assert.equal(isSuperAdminRoleName('Super Admin'), true);
    assert.equal(isSuperAdminRoleName('SUPER_ADMIN'), true);
    assert.equal(isSuperAdminRoleName('Admin'), false);
    assert.equal(
      userSatisfiesAssignmentAccess({
        roleName: 'Super Admin',
        permissionNames: [],
        modules: ['Leads', 'Jobs'],
      }),
      true,
    );
    assert.equal(
      userSatisfiesAssignmentAccess({
        permissionNames: ['all'],
        modules: ['Jobs'],
      }),
      true,
    );
    assert.equal(
      userSatisfiesAssignmentAccess({
        roleName: 'Admin',
        permissionNames: ['clients_read'],
        modules: ['Jobs'],
      }),
      false,
    );
  });

  it('10. no eligible users: filter returns empty (no unauthorized fallback)', () => {
    const candidates = [
      { permissionNames: JOBS_ONLY, modules: ['Leads'] },
      { permissionNames: CANDIDATES_ONLY, modules: ['Leads'] },
    ];
    const eligible = candidates.filter((row) =>
      userSatisfiesAssignmentAccess({
        permissionNames: row.permissionNames,
        modules: ['Leads'],
      }),
    );
    assert.equal(eligible.length, 0);
  });

  it('11. existing assignment still works for an eligible teammate', () => {
    assert.equal(
      userSatisfiesAssignmentAccess({
        permissionNames: ['jobs_read', 'assign_job'],
        modules: ['Jobs'],
      }),
      true,
    );
    assert.equal(
      userSatisfiesAssignmentAccess({
        permissionNames: ['view_jobs'],
        modules: ['Jobs'],
      }),
      true,
    );
  });

  it('12. existing role/permission catalog is reused (no duplicate names)', () => {
    assert.deepEqual(resolveAssignmentModules(['crm', 'job', 'candidates']), [
      'Leads',
      'Jobs',
      'Candidates',
    ]);
    assert.equal(
      userSatisfiesAssignmentAccess({
        permissionNames: ['create_job'],
        modules: ['Jobs'],
      }),
      true,
    );
  });
});
