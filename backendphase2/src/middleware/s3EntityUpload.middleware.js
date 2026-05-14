import multer from 'multer';
import multerS3 from 'multer-s3';
import { env } from '../config/env.js';
import { getActiveTenantDbName } from '../config/prisma.js';
import {
  ensureS3Configured,
  getS3AppFolder,
  getS3Bucket,
  getS3Client,
  uploadContentTypeForFile,
} from '../utils/s3.js';

function sanitizeTenantSegment(input) {
  const seg = String(input || 'default')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_');
  return seg || 'default';
}

/** Tenant DB name from ALS (tenantContextMiddleware), JWT, or header — never empty. */
function resolveTenantSegment(req) {
  const fromStore = String(getActiveTenantDbName() || '').trim();
  const fromReq = String(
    req.user?.tenantDbName || req.headers['x-tenant-db-name'] || ''
  ).trim();
  return sanitizeTenantSegment(fromStore || fromReq || 'default');
}

function entitySubDir(entityType) {
  const t = String(entityType || '').toLowerCase();
  if (t === 'lead') return 'leads';
  if (t === 'client') return 'clients';
  if (t === 'candidate') return 'candidates';
  if (t === 'interview') return 'interviews';
  if (t === 'user') return 'users';
  return 'jobs';
}

function buildS3Storage() {
  ensureS3Configured();
  const storageOpts = {
    s3: getS3Client(),
    bucket: getS3Bucket(),
    contentType: (req, file, cb) => {
      cb(null, uploadContentTypeForFile(file.mimetype, file.originalname));
    },
    metadata: (req, file, cb) => {
      cb(null, { fieldName: file.fieldname });
    },
    key: (req, file, cb) => {
      try {
        const entityType = String(req.body?.entityType || 'misc');
        const entityId = String(req.body?.entityId || 'unknown');
        const subDir = entitySubDir(entityType);
        const safe = String(file.originalname || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
        const tenant = resolveTenantSegment(req);
        const phase = getS3AppFolder();
        cb(
          null,
          `uploads/${phase}/tenants/${tenant}/jobportal/${subDir}/${entityId}/${Date.now()}_${safe}`
        );
      } catch (err) {
        cb(err);
      }
    },
  };
  if (env.AWS_S3_UPLOAD_ACL && env.AWS_S3_UPLOAD_ACL !== 'none') {
    storageOpts.acl = env.AWS_S3_UPLOAD_ACL;
  }
  return multerS3(storageOpts);
}

/**
 * POST /api/v1/files — multipart field `file` + body entityType, entityId, fileType.
 * Streams to S3: uploads/{phase}/tenants/{tenantDbName}/jobportal/{entity}/...
 */
export const uploadSingleEntityFileS3 = multer({
  storage: buildS3Storage(),
  limits: { fileSize: 10 * 1024 * 1024 },
}).single('file');
