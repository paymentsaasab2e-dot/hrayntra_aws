import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyRoleCompanyAccess,
  normalizeRoleCompanyAccess,
  resolveAccessForRole,
  accessForAllCompanies,
} from './roleCompanyAccess.service.js';

test('normalizeRoleCompanyAccess drops unknown company ids', () => {
  const next = normalizeRoleCompanyAccess(
    { crm: ['a', 'b', ''], recruitment: ['c', 'a'] },
    ['a', 'c'],
  );
  assert.deepEqual(next.crm, ['a']);
  assert.deepEqual(next.recruitment, ['c', 'a']);
});

test('legacy view_all_companies hydrates every organization until the role is saved again', () => {
  const all = ['org-1', 'org-2'];
  const access = resolveAccessForRole({
    roleId: 'role-1',
    permissionNames: ['switch_companies', 'view_all_companies'],
    stored: {},
    allCompanyIds: all,
  });
  assert.deepEqual(access, accessForAllCompanies(all));
});

test('stored company picks win over the retired view_all_companies tick', () => {
  const access = resolveAccessForRole({
    roleId: 'role-1',
    permissionNames: ['switch_companies', 'view_all_companies'],
    stored: { 'role-1': { crm: ['org-1'], recruitment: [] } },
    allCompanyIds: ['org-1', 'org-2'],
  });
  assert.deepEqual(access, { crm: ['org-1'], recruitment: [] });
});

test('empty access stays empty without the legacy tick', () => {
  assert.deepEqual(
    resolveAccessForRole({
      roleId: 'role-1',
      permissionNames: ['switch_companies'],
      stored: {},
      allCompanyIds: ['org-1'],
    }),
    emptyRoleCompanyAccess(),
  );
});
