import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { clampEnvInt, matchAppliedPoolMax, matchTenantPoolMax, matchPortalPoolMax } from './queryBounds.js';

describe('queryBounds', () => {
  it('clamps fallback and hard max', () => {
    assert.equal(clampEnvInt('HR_YANTRA_MISSING_BOUND', 500, 2000), 500);
  });

  it('match pools stay in a safe window', () => {
    const tenant = matchTenantPoolMax();
    const portal = matchPortalPoolMax();
    const applied = matchAppliedPoolMax();
    assert.ok(tenant >= 1 && tenant <= 2000);
    assert.ok(portal >= 1 && portal <= 2000);
    assert.ok(applied >= 1 && applied <= 2000);
  });
});
