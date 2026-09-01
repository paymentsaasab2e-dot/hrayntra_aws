import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assignmentRoleNameOf,
  filterCompanyOptionsByEligibleUnits,
  filterUsersByAssignableCompany,
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

  it('13. Select Company hides companies with no eligible assignees', () => {
    const companies = [
      { id: 'co-jobs', name: 'Jobs Co' },
      { id: 'co-leads', name: 'Leads Co' },
      { id: 'co-empty', name: 'Empty Co' },
    ];
    const orgUnits = [
      { id: 'co-jobs', parentId: null },
      { id: 'site-jobs', parentId: 'co-jobs' },
      { id: 'co-leads', parentId: null },
      { id: 'co-empty', parentId: null },
    ];
    const visible = filterCompanyOptionsByEligibleUnits(
      companies,
      ['site-jobs'],
      orgUnits,
    );
    assert.deepEqual(
      visible.map((row) => row.id),
      ['co-jobs'],
    );
  });

  it('14. no eligible units: company dropdown is empty', () => {
    const visible = filterCompanyOptionsByEligibleUnits(
      [{ id: 'co-a', name: 'A' }],
      [],
      [{ id: 'co-a', parentId: null }],
    );
    assert.deepEqual(visible, []);
  });

  it('15. legacy Prisma Role enum SUPER_ADMIN does not count as assignment Super Admin', () => {
    assert.equal(assignmentRoleNameOf({ role: 'SUPER_ADMIN' }), '');
    assert.equal(
      assignmentRoleNameOf({ role: 'SUPER_ADMIN', systemRole: { roleName: 'Recruiter' } }),
      'Recruiter',
    );
    assert.equal(
      userSatisfiesAssignmentAccess({
        permissionNames: [],
        roleName: assignmentRoleNameOf({ role: 'SUPER_ADMIN' }),
        modules: ['Jobs'],
      }),
      false,
    );
  });

  it('16. Jobs module on the role grants Jobs assignment even with custom permission names', () => {
    assert.equal(
      userSatisfiesAssignmentAccess({
        permissionNames: ['custom_jobs_access'],
        permissionModules: ['Jobs'],
        modules: ['Jobs'],
      }),
      true,
    );
    assert.equal(
      userSatisfiesAssignmentAccess({
        permissionNames: ['leads_read'],
        permissionModules: ['Leads'],
        modules: ['Jobs'],
      }),
      false,
    );
  });

  it('17. Recruiter role tab includes Jobs so recruiters appear in job assign lists', () => {
    assert.equal(
      userSatisfiesAssignmentAccess({
        permissionNames: ['jobs_read', 'candidates_read'],
        roleName: 'Recruiter',
        modules: ['Jobs'],
      }),
      true,
    );
    assert.equal(
      userSatisfiesAssignmentAccess({
        permissionNames: ['leads_read', 'clients_read'],
        roleName: 'Account Manager',
        modules: ['Jobs'],
      }),
      false,
    );
  });

  it('18. missing Delete job does not hide someone who has the other Jobs tab ticks', () => {
    assert.equal(
      userSatisfiesAssignmentAccess({
        permissionNames: [
          'jobs_create',
          'jobs_read',
          'jobs_update',
          'assign_job',
          'view_all_jobs',
          'publish_job',
        ],
        modules: ['Jobs'],
      }),
      true,
    );
    assert.equal(
      userSatisfiesAssignmentAccess({
        permissionNames: ['JOBS_READ'],
        modules: ['Jobs'],
      }),
      true,
    );
  });

  it('19. role catalog module Jobs matches even when DB stores a different module label', () => {
    assert.equal(
      userSatisfiesAssignmentAccess({
        permissionNames: ['jobs_read'],
        permissionModules: ['Recruitment'],
        modules: ['Jobs'],
      }),
      true,
    );
    assert.equal(
      userSatisfiesAssignmentAccess({
        permissionNames: ['create_job'],
        permissionModules: ['job'],
        modules: ['Jobs'],
      }),
      true,
    );
  });

  it('20. people list uses the same company walk as Select Company', () => {
    const orgUnits = [
      { id: 'india', parentId: 'hq' },
      { id: 'india-site', parentId: 'india' },
      { id: 'rayno', parentId: 'hq' },
    ];
    const users = [
      { id: 'u-india', orgUnitId: 'india' },
      { id: 'u-site', orgUnitId: 'india-site' },
      { id: 'u-rayno', orgUnitId: 'rayno' },
      { id: 'u-none', orgUnitId: null },
    ];
    assert.deepEqual(
      filterUsersByAssignableCompany(users, 'india', orgUnits).map((row) => row.id),
      ['u-india', 'u-site'],
    );
    assert.deepEqual(
      filterUsersByAssignableCompany(users, 'rayno', orgUnits).map((row) => row.id),
      ['u-rayno'],
    );
  });
});
