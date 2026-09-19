import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidTenantDbName } from '../utils/tenantDbName.util.js';

test('tenant db name validation rejects reserved and unsafe names', () => {
  assert.equal(isValidTenantDbName('acme_corp'), true);
  assert.equal(isValidTenantDbName('tenant-01'), true);
  assert.equal(isValidTenantDbName('admin'), false);
  assert.equal(isValidTenantDbName('../etc'), false);
  assert.equal(isValidTenantDbName(''), false);
  assert.equal(isValidTenantDbName('has spaces'), false);
});
