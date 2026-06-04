import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import path from 'path';
import { env } from '../config/env.js';

let _client = null;

export function ensureS3Configured() {
  const missing = [];
  if (!env.AWS_ACCESS_KEY_ID) missing.push('AWS_ACCESS_KEY_ID');
  if (!env.AWS_SECRET_ACCESS_KEY) missing.push('AWS_SECRET_ACCESS_KEY');
  if (!env.AWS_REGION) missing.push('AWS_REGION');
  if (!env.AWS_BUCKET_NAME) missing.push('AWS_BUCKET_NAME');
  if (missing.length) {
    throw new Error(`S3 is not configured. Set ${missing.join(', ')} in environment.`);
  }
}

export function getS3Client() {
  ensureS3Configured();
  if (!_client) {
    _client = new S3Client({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return _client;
}

export function getS3Bucket() {
  return String(env.AWS_BUCKET_NAME || '').trim();
}

/**
 * Virtual-hosted–style public URL (HTTPS). Requires bucket policy or object ACL for read access.
 */
export function publicUrlForS3Key(key) {
  const bucket = getS3Bucket();
  const region = String(env.AWS_REGION || '').trim();
  const safeKey = String(key || '')
    .split('/')
    .map((s) => encodeURIComponent(s))
    .join('/');
  if (env.AWS_S3_PUBLIC_BASE_URL) {
    const base = String(env.AWS_S3_PUBLIC_BASE_URL).replace(/\/+$/, '');
    return `${base}/${safeKey}`;
  }
  if (region === 'us-east-1') {
    return `https://${bucket}.s3.amazonaws.com/${safeKey}`;
  }
  return `https://${bucket}.s3.${region}.amazonaws.com/${safeKey}`;
}

function sanitizeKeySegment(input) {
  return String(input || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function getS3AppFolder() {
  const raw = String(env.AWS_S3_APP_FOLDER || 'phase2').trim();
  const seg = raw.replace(/[^a-zA-Z0-9._-]/g, '_');
  return seg || 'phase2';
}

/**
 * Maps MIME + filename to a sensible Content-Type (replaces legacy Cloudinary "resource type" split).
 */
export function uploadContentTypeForFile(mimetype = '', originalFilename = '') {
  const mime = String(mimetype || '').trim();
  if (mime) return mime;
  const ext = path.extname(originalFilename || '').toLowerCase();
  const map = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt': 'text/plain',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  };
  return map[ext] || 'application/octet-stream';
}

/** @deprecated use uploadContentTypeForFile — kept for gradual import renames */
export const cloudinaryResourceTypeForFile = uploadContentTypeForFile;

function buildObjectKey({ folder, publicId, originalFilename, tenantDbName }) {
  const appFolder = getS3AppFolder();
  const tenantSeg = sanitizeKeySegment(String(tenantDbName || 'default').trim()) || 'default';
  const tenantPrefix = `tenants/${tenantSeg}`;
  const safeFolder = String(folder || 'jobportal')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\\/g, '/');
  if (publicId) {
    const safeId = String(publicId)
      .replace(/\\/g, '/')
      .split('/')
      .map((p) => sanitizeKeySegment(p))
      .join('/');
    return `uploads/${appFolder}/${tenantPrefix}/${safeFolder}/${safeId}`;
  }
  const name = sanitizeKeySegment(path.basename(originalFilename || 'file'));
  return `uploads/${appFolder}/${tenantPrefix}/${safeFolder}/${Date.now()}_${randomUUID().slice(0, 8)}_${name}`;
}

/**
 * Upload a buffer to S3. Returns Cloudinary-shaped fields for drop-in compatibility.
 * @returns {Promise<{ url: string, secure_url: string, key: string, bucket: string, etag?: string }>}
 */
export async function uploadBufferToS3(
  buffer,
  {
    folder = 'jobportal',
    publicId,
    originalFilename = 'file',
    contentType,
    resourceType,
    cacheControl = 'public, max-age=31536000, immutable',
    /** Multi-tenant CRM: objects live under uploads/{phase}/tenants/{tenant}/… */
    tenantDbName,
  } = {}
) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('No file buffer provided for S3 upload');
  }
  const client = getS3Client();
  const bucket = getS3Bucket();
  const Key = buildObjectKey({ folder, publicId, originalFilename, tenantDbName });
  const resolvedContentType =
    contentType ||
    (resourceType === 'image' ? 'image/png' : '') ||
    uploadContentTypeForFile(undefined, originalFilename);

  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key,
    Body: buffer,
    ContentType: resolvedContentType,
    ...(cacheControl ? { CacheControl: cacheControl } : {}),
    ...(env.AWS_S3_UPLOAD_ACL && env.AWS_S3_UPLOAD_ACL !== 'none'
      ? { ACL: env.AWS_S3_UPLOAD_ACL }
      : {}),
  });

  const out = await client.send(cmd);
  const url = publicUrlForS3Key(Key);
  return {
    key: Key,
    bucket,
    etag: out.ETag,
    url,
    secure_url: url,
  };
}

/** Alias for existing call sites */
export const uploadBufferToCloudinary = uploadBufferToS3;

/**
 * Delete object when URL belongs to our bucket (virtual-hosted or path-style, or custom public base).
 */
export async function deleteS3ObjectByUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') return;
  const parsed = parseOurS3Url(urlString);
  if (!parsed) return;
  try {
    const client = getS3Client();
    await client.send(new DeleteObjectCommand({ Bucket: parsed.bucket, Key: parsed.key }));
  } catch {
    /* ignore */
  }
}

/** @deprecated */
export const destroyByCloudinaryUrl = deleteS3ObjectByUrl;

/**
 * Parse URLs for this deployment's bucket.
 */
export function parseOurS3Url(urlString) {
  const bucket = getS3Bucket();
  if (!bucket) return null;
  try {
    const u = new URL(urlString);
    const region = String(env.AWS_REGION || '').trim();

    if (env.AWS_S3_PUBLIC_BASE_URL) {
      const base = new URL(env.AWS_S3_PUBLIC_BASE_URL);
      if (u.origin === base.origin) {
        const basePath = (base.pathname || '/').replace(/\/+$/, '');
        let p = u.pathname || '/';
        if (basePath && basePath !== '/' && p.startsWith(basePath)) {
          p = p.slice(basePath.length) || '/';
        }
        const key = p.replace(/^\/+/, '');
        if (key) return { bucket, key: decodeURIComponent(key.replace(/\+/g, ' ')) };
      }
    }

    if (u.hostname === `${bucket}.s3.${region}.amazonaws.com`) {
      const key = (u.pathname || '').replace(/^\/+/, '');
      if (key) return { bucket, key: decodeURIComponent(key) };
    }
    if (region === 'us-east-1' && u.hostname === `${bucket}.s3.amazonaws.com`) {
      const key = (u.pathname || '').replace(/^\/+/, '');
      if (key) return { bucket, key: decodeURIComponent(key) };
    }

    const pathHosts = new Set([`s3.${region}.amazonaws.com`, `s3.dualstack.${region}.amazonaws.com`]);
    if (pathHosts.has(u.hostname)) {
      const parts = (u.pathname || '').replace(/^\/+/, '').split('/');
      if (parts[0] === bucket && parts.length > 1) {
        return { bucket, key: parts.slice(1).join('/') };
      }
    }
  } catch {
    return null;
  }
  return null;
}

function isExtensionlessResumeStorageKey(keyOrPath) {
  const lower = String(keyOrPath || '').toLowerCase();
  return (
    lower.includes('apply-resumes') ||
    lower.includes('/resumes/') ||
    lower.includes('/cv-files/') ||
    lower.includes('jobportal/apply-resumes') ||
    /\/candidates\/[^/]+\/resumes\//i.test(lower) ||
    /\/candidates\/[^/]+\/jobportal\/cv-files\//i.test(lower) ||
    /uploads\/phase1\/candidates\/[^/]+\//i.test(lower)
  );
}

export function isOurS3PdfUrl(urlString) {
  try {
    const u = new URL(urlString);
    if (u.protocol !== 'https:') return false;
    const parsed = parseOurS3Url(urlString);
    if (!parsed) return false;
    if (/\.pdf($|[?#])/i.test(u.pathname)) return true;
    if (/\.(docx|doc)($|[?#])/i.test(u.pathname)) return false;
    return isExtensionlessResumeStorageKey(parsed.key);
  } catch {
    return false;
  }
}

/**
 * Stream or buffer fetch for server-side PDF proxy (private buckets).
 */
export async function getS3ObjectBodyBuffer(key) {
  const client = getS3Client();
  const out = await client.send(
    new GetObjectCommand({ Bucket: getS3Bucket(), Key: key })
  );
  const chunks = [];
  for await (const chunk of out.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
