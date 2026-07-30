import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { env } from '../../config/env.js';
import { uploadBufferToS3 } from '../../utils/s3.js';
import { isS3Configured } from '../../utils/publicUploads.util.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');

export const PORTAL_EVENT_MEDIA_MAX_BYTES = 5 * 1024 * 1024;
export const PORTAL_EVENT_MEDIA_MAX_FILES = 20;

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const VIDEO_MIMES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

function sanitizeFilename(name) {
  const base = path.basename(String(name || 'file').trim());
  return base.replace(/[^a-zA-Z0-9._-]/g, '_') || 'file';
}

function mediaTypeForMime(mimetype = '') {
  const mime = String(mimetype || '').trim().toLowerCase();
  if (IMAGE_MIMES.has(mime)) return 'image';
  if (VIDEO_MIMES.has(mime)) return 'video';
  return null;
}

export function validatePortalEventMediaFile(file) {
  if (!file?.buffer?.length) {
    const err = new Error('No file provided');
    err.code = 'VALIDATION';
    throw err;
  }
  if (file.size > PORTAL_EVENT_MEDIA_MAX_BYTES) {
    const err = new Error('Each file must be 5 MB or smaller');
    err.code = 'VALIDATION';
    throw err;
  }
  const type = mediaTypeForMime(file.mimetype);
  if (!type) {
    const err = new Error('Only images (JPG, PNG, WEBP, GIF) and videos (MP4, WEBM, MOV) are allowed');
    err.code = 'VALIDATION';
    throw err;
  }
  return type;
}

function localUploadsDir() {
  const dir = path.join(projectRoot, 'uploads', 'portal-events');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function backendPublicBase() {
  return String(
    env.BACKEND_PUBLIC_URL ||
      process.env.BACKEND_PUBLIC_URL ||
      process.env.PUBLIC_BACKEND_URL ||
      `http://localhost:${process.env.PORT || '5001'}`,
  ).replace(/\/+$/, '');
}

export async function storePortalEventMediaFile(file, { tenantDbName } = {}) {
  const type = validatePortalEventMediaFile(file);
  const safeName = sanitizeFilename(file.originalname);
  const storedName = `${Date.now()}_${randomUUID().slice(0, 8)}_${safeName}`;

  if (isS3Configured()) {
    try {
      const uploaded = await uploadBufferToS3(file.buffer, {
        folder: 'portal-events',
        originalFilename: storedName,
        contentType: file.mimetype,
        tenantDbName,
      });
      return {
        id: randomUUID(),
        type,
        url: uploaded.secure_url || uploaded.url,
        name: safeName,
        size: file.size,
      };
    } catch (error) {
      console.warn('[portal-events-media] S3 upload failed, using local storage:', error?.message || error);
    }
  }

  const dir = localUploadsDir();
  const fullPath = path.join(dir, storedName);
  fs.writeFileSync(fullPath, file.buffer);
  const url = `${backendPublicBase()}/uploads/portal-events/${encodeURIComponent(storedName)}`;

  return {
    id: randomUUID(),
    type,
    url,
    name: safeName,
    size: file.size,
  };
}

export function normalizePortalEventMedia(media) {
  if (!Array.isArray(media)) return [];
  return media
    .map((item, index) => {
      const type = item?.type === 'video' ? 'video' : item?.type === 'image' ? 'image' : null;
      const url = String(item?.url || '').trim();
      if (!type || !url) return null;
      return {
        id: String(item?.id || `media_${index + 1}`),
        type,
        url,
        name: item?.name ? String(item.name) : undefined,
        size: item?.size != null ? Number(item.size) || undefined : undefined,
      };
    })
    .filter(Boolean)
    .slice(0, PORTAL_EVENT_MEDIA_MAX_FILES);
}

export function portalEventMediaMulterFilter(_req, file, cb) {
  const type = mediaTypeForMime(file.mimetype);
  if (!type) {
    cb(new Error('Only images and videos are allowed'));
    return;
  }
  cb(null, true);
}
