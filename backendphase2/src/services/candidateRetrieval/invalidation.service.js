/**
 * Cache invalidation for candidate lifecycle events.
 */

import { bumpOrgCandidateVersion, resolveTenantId } from './versionStore.js';
import { l1DeleteByPrefix } from './l1Cache.js';
import { l2DeleteByPattern, l2Available } from './l2Cache.js';
import { orgCachePrefix, isCandidateOrgCacheEnabled } from './cacheKeys.js';

export async function invalidateOrgCandidateCaches(reason = 'mutation', tenantId) {
  if (!isCandidateOrgCacheEnabled()) {
    // Still bump version so keys rotate when flag is turned on later.
    return bumpOrgCandidateVersion(tenantId, reason);
  }
  const tid = resolveTenantId(tenantId);
  const version = await bumpOrgCandidateVersion(tid, reason);
  const prefix = orgCachePrefix(tid);
  l1DeleteByPrefix(prefix);
  if (l2Available()) {
    await l2DeleteByPattern(`${prefix}*`);
  }
  return version;
}
