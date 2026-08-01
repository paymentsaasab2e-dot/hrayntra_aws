/**
 * Gate for system audit + admin tooling.
 * Header: x-internal-admin-key
 * Env: INTERVIEW_ADMIN_KEY || INTERNAL_API_KEY || SYSTEM_AUDIT_ADMIN_KEY
 *
 * In non-production, open if no key is configured (same pattern as interviewer admin).
 */

const INTERNAL_ADMIN_KEY =
  process.env.SYSTEM_AUDIT_ADMIN_KEY ||
  process.env.INTERVIEW_ADMIN_KEY ||
  process.env.INTERNAL_API_KEY ||
  '';

function isAuthorizedForSystemAdmin(req) {
  if (process.env.NODE_ENV !== 'production' && !INTERNAL_ADMIN_KEY) return true;
  const incoming = String(req.headers['x-internal-admin-key'] || '').trim();
  return Boolean(INTERNAL_ADMIN_KEY) && incoming === INTERNAL_ADMIN_KEY;
}

function requireSystemAdmin(req, res, next) {
  if (!isAuthorizedForSystemAdmin(req)) {
    return res.status(403).json({
      success: false,
      message: 'Admin authorization required (x-internal-admin-key)',
    });
  }
  return next();
}

module.exports = {
  INTERNAL_ADMIN_KEY,
  isAuthorizedForSystemAdmin,
  requireSystemAdmin,
};
