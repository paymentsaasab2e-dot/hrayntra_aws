import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../../config/env.js';
import { getActiveTenantDbName } from '../../config/prisma.js';
import {
  ensureS3Configured,
  getS3AppFolder,
  getS3Bucket,
  getS3Client,
} from '../../utils/s3.js';
import {
  buildPublicUploadsAccessUrl,
  isS3Configured,
} from '../../utils/publicUploads.util.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');

const SUBDIR = 'email-signatures';
const MAX_BYTES = 2 * 1024 * 1024;
const IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

function sanitizeFilename(name) {
  const base = path.basename(String(name || 'logo.png').trim());
  return base.replace(/[^a-zA-Z0-9._-]/g, '_') || 'logo.png';
}

function sanitizeTenantSegment(input) {
  const seg = String(input || 'default')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_');
  return seg || 'default';
}

function backendPublicBase() {
  return String(
    env.BACKEND_PUBLIC_URL ||
      process.env.BACKEND_PUBLIC_URL ||
      process.env.PUBLIC_BACKEND_URL ||
      `http://localhost:${process.env.PORT || '5001'}`,
  ).replace(/\/+$/, '');
}

function buildPublicLogoUrl(filename, tenantDbName) {
  const safe = sanitizeFilename(filename);
  const tenant = sanitizeTenantSegment(tenantDbName);
  const base =
    buildPublicUploadsAccessUrl(`/uploads/${SUBDIR}/${safe}`) ||
    `${backendPublicBase()}/api/v1/public/uploads/${SUBDIR}/${encodeURIComponent(safe)}`;
  const url = new URL(base);
  url.searchParams.set('tenantDbName', tenant);
  return url.toString();
}

/**
 * Store signature logo in a path that can be served publicly (no auth)
 * so Gmail/Outlook <img> tags can load it.
 */
export async function storeEmailSignatureLogoFile(file, { tenantDbName, userId } = {}) {
  if (!file?.buffer?.length && !file?.path) {
    const err = new Error('No file provided');
    err.code = 'VALIDATION';
    throw err;
  }

  const size = Number(file.size || file.buffer?.length || 0);
  if (size > MAX_BYTES) {
    const err = new Error('Logo must be under 2 MB');
    err.code = 'VALIDATION';
    throw err;
  }

  const mime = String(file.mimetype || '').toLowerCase();
  if (mime && !IMAGE_MIMES.has(mime)) {
    const err = new Error('Only image files are allowed (PNG, JPG, WEBP, GIF, SVG)');
    err.code = 'VALIDATION';
    throw err;
  }

  const tenant = sanitizeTenantSegment(tenantDbName || getActiveTenantDbName() || 'default');
  const safeName = sanitizeFilename(file.originalname);
  const uid = String(userId || 'user')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 10);
  const storedName = `${Date.now()}_${uid || 'u'}_${randomUUID().slice(0, 8)}_${safeName}`;
  const buffer = file.buffer?.length ? file.buffer : fs.readFileSync(file.path);
  const contentType = mime || 'application/octet-stream';

  if (isS3Configured()) {
    try {
      ensureS3Configured();
      const phase = getS3AppFolder();
      const key = `uploads/${phase}/tenants/${tenant}/${SUBDIR}/${storedName}`;
      const put = {
        Bucket: getS3Bucket(),
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=86400',
      };
      if (env.AWS_S3_UPLOAD_ACL && env.AWS_S3_UPLOAD_ACL !== 'none') {
        put.ACL = env.AWS_S3_UPLOAD_ACL;
      }
      await getS3Client().send(new PutObjectCommand(put));
      return {
        fileUrl: buildPublicLogoUrl(storedName, tenant),
        fileName: safeName,
        key,
      };
    } catch (error) {
      console.warn(
        '[email-signature-logo] S3 upload failed, using local storage:',
        error?.message || error,
      );
    }
  }

  const dir = path.join(projectRoot, 'uploads', SUBDIR);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, storedName), buffer);
  return {
    fileUrl: buildPublicLogoUrl(storedName, tenant),
    fileName: safeName,
  };
}
