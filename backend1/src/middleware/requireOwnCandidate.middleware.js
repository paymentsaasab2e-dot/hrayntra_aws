/**
 * Ensure JWT candidate owns the target candidate resource (IDOR guard).
 * Accepts :candidateId, :id, body.candidateId.
 * System-admin key (x-internal-admin-key) may bypass for HQ tooling.
 */
const { isAuthorizedForSystemAdmin } = require('./system-admin.middleware');

function resolveSessionCandidateId(req) {
  return String(req.user?.candidateId || req.user?.id || '').trim();
}

function resolveTargetCandidateId(req) {
  return String(
    req.params?.candidateId ||
      req.params?.id ||
      req.body?.candidateId ||
      req.query?.candidateId ||
      ''
  ).trim();
}

function requireOwnCandidate(req, res, next) {
  if (isAuthorizedForSystemAdmin(req)) {
    return next();
  }

  const sessionId = resolveSessionCandidateId(req);
  if (!sessionId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const target = resolveTargetCandidateId(req);
  if (target && target !== sessionId) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: candidate mismatch',
    });
  }

  if (!req.body) req.body = {};
  if (!req.body.candidateId) req.body.candidateId = sessionId;
  if (req.params) {
    if (req.params.candidateId !== undefined && !req.params.candidateId) {
      req.params.candidateId = sessionId;
    }
    if (req.params.id !== undefined && !req.params.id) {
      req.params.id = sessionId;
    }
  }
  return next();
}

module.exports = {
  requireOwnCandidate,
  resolveSessionCandidateId,
  resolveTargetCandidateId,
};
