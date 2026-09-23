const fs = require('fs');
const path = require('path');
const { requireLmsAuth } = require('../lms/middleware/lms.auth.middleware');

/** Only this folder is readable, and only with a candidate LMS token. */
const PRIVATE_UPLOAD_DIRS = new Set(['lms-assignments']);

function firstSegment(urlPath) {
  let decoded = String(urlPath || '');
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    return null;
  }
  if (decoded.includes('\0') || decoded.includes('..')) return null;
  const parts = decoded.split('/').filter(Boolean);
  return parts[0] || '';
}

function safeAbsolute(uploadsRoot, urlPath) {
  let decoded = String(urlPath || '');
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    return null;
  }
  if (decoded.includes('\0') || decoded.includes('..')) return null;
  const rel = decoded.replace(/^[/\\]+/, '');
  if (!rel) return null;
  const root = path.resolve(uploadsRoot);
  const abs = path.resolve(root, rel);
  if (abs !== root && !abs.startsWith(root + path.sep)) return null;
  return abs;
}

function createUploadsStatic(uploadsRoot) {
  const root = path.resolve(uploadsRoot);

  return function uploadsStatic(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    const top = firstSegment(req.path);
    if (!top || !PRIVATE_UPLOAD_DIRS.has(top)) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    return requireLmsAuth(req, res, () => {
      const abs = safeAbsolute(root, req.path);
      if (!abs || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
        return res.status(404).json({ success: false, message: 'Not found' });
      }
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.sendFile(abs);
    });
  };
}

module.exports = { createUploadsStatic };
