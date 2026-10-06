/** Hard caps for queries that grow with tenant data. Never unbounded findMany. */

export function clampEnvInt(name, fallback, hardMax) {
  const raw = Number(process.env[name]);
  const n = Number.isFinite(raw) && raw > 0 ? raw : fallback;
  return Math.min(hardMax, Math.max(1, n));
}

/** AI match / discovery pool — not the whole tenant. */
export function matchTenantPoolMax() {
  return clampEnvInt('MATCH_TENANT_POOL_MAX', 500, 2000);
}

export function matchPortalPoolMax() {
  return clampEnvInt('MATCH_PORTAL_POOL_MAX', 500, 2000);
}

export function matchCommonPoolMax() {
  return clampEnvInt('MATCH_COMMON_POOL_MAX', 500, 2000);
}

/** Applied/assigned pool for one job — a hot job can have tens of thousands. */
export function matchAppliedPoolMax() {
  return clampEnvInt('MATCH_APPLIED_POOL_MAX', 500, 2000);
}

/** Max ids per `id: { in: [...] }` hydrate query. */
export const ID_IN_CHUNK_SIZE = 500;
