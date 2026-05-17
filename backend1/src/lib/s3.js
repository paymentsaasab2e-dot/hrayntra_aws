const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { randomUUID } = require('crypto');
const path = require('path');

function ensureS3Configured() {
  const missing = [];
  if (!process.env.AWS_ACCESS_KEY_ID) missing.push('AWS_ACCESS_KEY_ID');
  if (!process.env.AWS_SECRET_ACCESS_KEY) missing.push('AWS_SECRET_ACCESS_KEY');
  if (!process.env.AWS_REGION) missing.push('AWS_REGION');
  if (!process.env.AWS_BUCKET_NAME) missing.push('AWS_BUCKET_NAME');
  if (missing.length) {
    throw new Error(`S3 is not configured. Set ${missing.join(', ')} in environment.`);
  }
}

let _client = null;
function getS3Client() {
  ensureS3Configured();
  if (!_client) {
    _client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return _client;
}

function getS3Bucket() {
  return String(process.env.AWS_BUCKET_NAME || '').trim();
}

function publicUrlForS3Key(key) {
  const bucket = getS3Bucket();
  const region = String(process.env.AWS_REGION || '').trim();
  const safeKey = String(key || '')
    .split('/')
    .map((s) => encodeURIComponent(s))
    .join('/');
  if (process.env.AWS_S3_PUBLIC_BASE_URL) {
    const base = String(process.env.AWS_S3_PUBLIC_BASE_URL).replace(/\/+$/, '');
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

/** Top-level folder under `uploads/` for this app (Phase 1 job portal). Override with AWS_S3_APP_FOLDER. */
function getS3AppFolder() {
  const raw = String(process.env.AWS_S3_APP_FOLDER || 'phase1').trim();
  const seg = raw.replace(/[^a-zA-Z0-9._-]/g, '_');
  return seg || 'phase1';
}

function uploadContentTypeForFile(mimetype, originalFilename) {
  const mime = String(mimetype || '').trim();
  if (mime) return mime;
  const ext = path.extname(originalFilename || '').toLowerCase();
  const map = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt': 'text/plain',
    '.tex': 'application/x-tex',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
  };
  return map[ext] || 'application/octet-stream';
}

function buildObjectKey({ folder, publicId, originalFilename, candidateId }) {
  const appFolder = getS3AppFolder();
  const candidateSeg = candidateId ? sanitizeKeySegment(String(candidateId)) : '';
  const candidatePrefix = candidateSeg ? `candidates/${candidateSeg}` : 'candidates/_unknown';
  const safeFolder = String(folder || 'jobportal')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\\/g, '/');
  if (publicId) {
    const safeId = String(publicId)
      .replace(/\\/g, '/')
      .split('/')
      .map((p) => sanitizeKeySegment(p))
      .join('/');
    return `uploads/${appFolder}/${candidatePrefix}/${safeFolder}/${safeId}`;
  }
  const name = sanitizeKeySegment(path.basename(originalFilename || 'file'));
  return `uploads/${appFolder}/${candidatePrefix}/${safeFolder}/${Date.now()}_${randomUUID().slice(0, 8)}_${name}`;
}

function parseOurS3Url(urlString) {
  const bucket = getS3Bucket();
  if (!bucket) return null;
  try {
    const u = new URL(urlString);
    const region = String(process.env.AWS_REGION || '').trim();
    if (process.env.AWS_S3_PUBLIC_BASE_URL) {
      const base = new URL(process.env.AWS_S3_PUBLIC_BASE_URL);
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

async function uploadBufferToCloudinary({
  buffer,
  folder = 'jobportal',
  publicId,
  resourceType = 'auto',
  originalFilename,
  /** Job portal (Phase 1): every object is stored under uploads/{phase}/candidates/{id}/… */
  candidateId,
}) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('No file buffer provided for S3 upload');
  }
  const client = getS3Client();
  const bucket = getS3Bucket();
  const Key = buildObjectKey({ folder, publicId, originalFilename, candidateId });
  const contentType =
    resourceType === 'image'
      ? 'image/png'
      : uploadContentTypeForFile(undefined, originalFilename || 'file');

  const acl = process.env.AWS_S3_UPLOAD_ACL;
  const out = await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
      ...(acl && acl !== 'none' ? { ACL: acl } : {}),
    })
  );
  const url = publicUrlForS3Key(Key);
  return {
    secure_url: url,
    url,
    key: Key,
    bucket,
    etag: out.ETag,
  };
}

async function getS3ObjectBodyBuffer(key) {
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

async function destroyByCloudinaryUrl(url, resourceType = 'image') {
  void resourceType;
  const parsed = parseOurS3Url(url);
  if (!parsed) return;
  try {
    const client = getS3Client();
    await client.send(new DeleteObjectCommand({ Bucket: parsed.bucket, Key: parsed.key }));
  } catch {
    /* ignore */
  }
}

module.exports = {
  uploadBufferToCloudinary,
  destroyByCloudinaryUrl,
  uploadContentTypeForFile,
  getS3Client,
  getS3Bucket,
  parseOurS3Url,
  getS3ObjectBodyBuffer,
};
