import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { env, normalizePublicUrl } from '../config/env.js';
import { getActiveTenantDbName } from '../config/prisma.js';
import {
  ensureS3Configured,
  getS3AppFolder,
  getS3Bucket,
  getS3Client,
  getS3ObjectBodyBuffer,
} from './s3.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const ALLOWED_SUBDIRS = new Set(['placements', 'interview-client-review']);

function sanitizeFilename(name) {
  const base = path.basename(String(name || '').trim());
  if (!base || base === '.' || base === '..') return '';
  if (!/^[a-zA-Z0-9._-]+$/.test(base)) return '';
  return base;
}

function sanitizeTenantSegment(input) {
  const seg = String(input || 'default')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_');
  return seg || 'default';
}

export function isS3Configured() {
  return Boolean(
    env.AWS_ACCESS_KEY_ID &&
      env.AWS_SECRET_ACCESS_KEY &&
      env.AWS_REGION &&
      env.AWS_BUCKET_NAME,
  );
}

export function normalizeRelativeUploadPath(value) {
  const raw = String(value || '').trim().replace(/\\/g, '/');
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      const pathname = new URL(raw).pathname || '';
      return pathname.startsWith('/uploads/') ? pathname : '';
    } catch {
      return '';
    }
  }
  if (raw.startsWith('/uploads/')) return raw;
  if (raw.startsWith('uploads/')) return `/${raw}`;
  return '';
}

/**
 * Public URL candidates can open in production. Bare `/uploads/...` static
 * paths are unreliable on serverless hosts — route through the public API.
 */
export function buildPublicUploadsAccessUrl(relativePath) {
  const rel = normalizeRelativeUploadPath(relativePath);
  if (!rel) return null;
  const subPath = rel.replace(/^\/uploads\//, '');
  const [subdir] = subPath.split('/');
  if (!ALLOWED_SUBDIRS.has(subdir)) return null;
  const base = String(
    process.env.BACKEND_PUBLIC_URL ||
      process.env.PUBLIC_BACKEND_URL ||
      env.BACKEND_PUBLIC_URL ||
      `http://localhost:${process.env.PORT || '5001'}`,
  ).replace(/\/+$/, '');
  return `${base}/api/v1/public/uploads/${subPath}`;
}

export function resolveStoredUploadAccessUrl(storedUrl) {
  const rel = normalizeRelativeUploadPath(storedUrl);
  if (rel) return buildPublicUploadsAccessUrl(rel) || rel;
  return String(storedUrl || '').trim();
}

function resolveLocalUploadPath(subdir, filename) {
  if (!ALLOWED_SUBDIRS.has(subdir)) return null;
  const safeName = sanitizeFilename(filename);
  if (!safeName) return null;
  return path.join(projectRoot, 'uploads', subdir, safeName);
}

function buildS3KeyCandidates(subdir, filename, tenantDbName) {
  const safeName = sanitizeFilename(filename);
  if (!safeName || !ALLOWED_SUBDIRS.has(subdir)) return [];

  const phase = getS3AppFolder();
  const tenants = [
    sanitizeTenantSegment(tenantDbName),
    'default',
    'gho01',
    'rus01',
  ].filter((value, index, arr) => value && arr.indexOf(value) === index);

  const keys = [];
  for (const tenant of tenants) {
    keys.push(`uploads/${phase}/tenants/${tenant}/${subdir}/${safeName}`);
    keys.push(`uploads/${phase}/tenants/${tenant}/jobportal/${subdir}/${safeName}`);
  }
  keys.push(`uploads/${subdir}/${safeName}`);
  return keys;
}

async function readFromS3Candidates(keys) {
  if (!isS3Configured()) return null;
  for (const key of keys) {
    try {
      const buffer = await getS3ObjectBodyBuffer(key);
      if (buffer?.length) return { buffer, key };
    } catch {
      /* try next key */
    }
  }
  return null;
}

export async function loadPublicUpload({ subdir, filename, tenantDbName }) {
  const localPath = resolveLocalUploadPath(subdir, filename);
  if (localPath && fs.existsSync(localPath)) {
    return {
      buffer: fs.readFileSync(localPath),
      source: 'local',
      filename: sanitizeFilename(filename),
    };
  }

  const s3Result = await readFromS3Candidates(
    buildS3KeyCandidates(subdir, filename, tenantDbName),
  );
  if (s3Result?.buffer?.length) {
    return {
      buffer: s3Result.buffer,
      source: 's3',
      filename: sanitizeFilename(filename),
      key: s3Result.key,
    };
  }

  return null;
}

export async function mirrorLocalUploadToS3({
  localPath,
  subdir,
  originalFilename,
  tenantDbName,
  contentType = 'application/pdf',
}) {
  if (!localPath || !fs.existsSync(localPath) || !isS3Configured()) return null;
  try {
    ensureS3Configured();
    const filename = path.basename(localPath);
    const safeName = sanitizeFilename(filename);
    if (!safeName || !ALLOWED_SUBDIRS.has(subdir)) return null;

    const tenant = sanitizeTenantSegment(
      tenantDbName || getActiveTenantDbName() || 'default',
    );
    const phase = getS3AppFolder();
    const key = `uploads/${phase}/tenants/${tenant}/${subdir}/${safeName}`;
    const buffer = fs.readFileSync(localPath);
    const client = getS3Client();
    const put = {
      Bucket: getS3Bucket(),
      Key: key,
      Body: buffer,
      ContentType: contentType || 'application/pdf',
    };
    if (env.AWS_S3_UPLOAD_ACL && env.AWS_S3_UPLOAD_ACL !== 'none') {
      put.ACL = env.AWS_S3_UPLOAD_ACL;
    }
    await client.send(new PutObjectCommand(put));
    return { key, filename: safeName };
  } catch (err) {
    console.warn('[public-uploads] S3 mirror failed:', err?.message || err);
    return null;
  }
}

export function contentTypeForPublicUpload(filename) {
  const ext = path.extname(String(filename || '')).toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  return 'application/octet-stream';
}

export function isLoopbackUploadUrl(url) {
  try {
    const host = new URL(normalizePublicUrl(url)).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return false;
  }
}
