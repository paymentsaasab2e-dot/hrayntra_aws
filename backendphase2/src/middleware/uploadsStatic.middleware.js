import fs from 'fs';
import path from 'path';
import { verifyAccessTokenDetailed } from '../utils/jwt.js';

/** Marketing and email assets. Everything else under uploads/ needs a CRM access token. */
export const PUBLIC_UPLOAD_DIRS = new Set([
  'email-signatures',
  'export-watermarks',
  'hq-company-logos',
  'portal-events',
  'lms-courses',
  'lms-course-videos',
  'company-logos',
  'company-post-media',
]);

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

function hasCrmAccessToken(req) {
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) return false;
  return verifyAccessTokenDetailed(header.slice(7)).ok;
}

/**
 * Anonymous GET is allowed only for PUBLIC_UPLOAD_DIRS.
 * CVs, temp parses, exports, job/task files, and offer letters require a Bearer access token.
 */
export function createUploadsStatic(uploadsRoot) {
  const root = path.resolve(uploadsRoot);

  return function uploadsStatic(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    const top = firstSegment(req.path);
    if (top == null) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    if (PUBLIC_UPLOAD_DIRS.has(top)) {
      return next();
    }

    if (!hasCrmAccessToken(req)) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const abs = safeAbsolute(root, req.path);
    if (!abs || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    if (abs.toLowerCase().endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
    }
    res.setHeader('Cache-Control', 'private, no-store');
    return res.sendFile(abs);
  };
}
