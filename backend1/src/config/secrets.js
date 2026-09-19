/**
 * Fail-closed secret resolution for Phase 1.
 * Never return production-usable hardcoded fallbacks.
 */

function isProduction() {
  return String(process.env.NODE_ENV || '').toLowerCase() === 'production';
}

function requireJwtSecret() {
  const secret = String(process.env.JWT_SECRET || '').trim();
  if (!secret) {
    throw new Error(
      'JWT_SECRET environment variable is required. Refusing to use a hardcoded fallback.'
    );
  }
  return secret;
}

/**
 * Phase1↔Phase2 sync secret.
 * Production: must be set.
 * Non-production: must be set unless ALLOW_INSECURE_DEV_SECRETS=true (local only).
 */
function requirePhase2PortalSyncSecret() {
  const configured = String(process.env.PHASE2_PORTAL_SYNC_SECRET || '').trim();
  if (configured) return configured;
  if (isProduction()) {
    throw new Error(
      'PHASE2_PORTAL_SYNC_SECRET is required in production. Refusing hardcoded fallback.'
    );
  }
  if (String(process.env.ALLOW_INSECURE_DEV_SECRETS || '').toLowerCase() === 'true') {
    console.warn(
      '[secrets] PHASE2_PORTAL_SYNC_SECRET unset — ALLOW_INSECURE_DEV_SECRETS=true; sync disabled until configured.'
    );
    return '';
  }
  throw new Error(
    'PHASE2_PORTAL_SYNC_SECRET is required. Set it in .env or ALLOW_INSECURE_DEV_SECRETS=true for local-only skip.'
  );
}

function getPhase2PortalSyncSecretOrEmpty() {
  try {
    return requirePhase2PortalSyncSecret();
  } catch {
    return String(process.env.PHASE2_PORTAL_SYNC_SECRET || '').trim();
  }
}

module.exports = {
  isProduction,
  requireJwtSecret,
  requirePhase2PortalSyncSecret,
  getPhase2PortalSyncSecretOrEmpty,
};
