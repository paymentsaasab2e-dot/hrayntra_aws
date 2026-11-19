/**
 * Phase 1 discovery is opt-in. A missing flag must not merge the common pool
 * into the CRM candidate list.
 */
export function parseIncludeCommonPoolQuery(query = {}) {
  const raw = query?.includeCommonPool;
  if (raw === true || raw === 'true' || raw === '1') return true;
  return false;
}
