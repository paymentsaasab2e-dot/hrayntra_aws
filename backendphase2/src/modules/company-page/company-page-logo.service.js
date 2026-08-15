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

export const COMPANY_LOGO_MAX_BYTES = 5 * 1024 * 1024;
export const COMPANY_POST_MEDIA_MAX_BYTES = 8 * 1024 * 1024;
const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function sanitizeFilename(name) {
  const base = path.basename(String(name || 'image').trim());
  return base.replace(/[^a-zA-Z0-9._-]/g, '_') || 'image.png';
}

function backendPublicBase() {
  return String(
    env.BACKEND_PUBLIC_URL ||
      process.env.BACKEND_PUBLIC_URL ||
      process.env.PUBLIC_BACKEND_URL ||
      `http://localhost:${process.env.PORT || '5001'}`,
  ).replace(/\/+$/, '');
}

function localUploadsDir(folder) {
  const dir = path.join(projectRoot, 'uploads', folder);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function companyLogoMulterFilter(_req, file, cb) {
  const mime = String(file?.mimetype || '').toLowerCase();
  if (!IMAGE_MIMES.has(mime)) {
    cb(new Error('Only image files are allowed (JPG, PNG, WEBP, GIF)'));
    return;
  }
  cb(null, true);
}

export const companyPostMediaMulterFilter = companyLogoMulterFilter;

async function storeCompanyImageFile(
  file,
  {
    tenantDbName,
    folder = 'company-logos',
    maxBytes = COMPANY_LOGO_MAX_BYTES,
    label = 'Image',
  } = {},
) {
  if (!file?.buffer?.length) {
    const err = new Error('No file provided');
    err.code = 'VALIDATION';
    throw err;
  }
  if (file.size > maxBytes) {
    const err = new Error(`${label} must be ${Math.round(maxBytes / (1024 * 1024))} MB or smaller`);
    err.code = 'VALIDATION';
    throw err;
  }
  const mime = String(file.mimetype || '').toLowerCase();
  if (!IMAGE_MIMES.has(mime)) {
    const err = new Error('Only image files are allowed (JPG, PNG, WEBP, GIF)');
    err.code = 'VALIDATION';
    throw err;
  }

  const safeName = sanitizeFilename(file.originalname);
  const storedName = `${Date.now()}_${randomUUID().slice(0, 8)}_${safeName}`;

  if (isS3Configured()) {
    try {
      const uploaded = await uploadBufferToS3(file.buffer, {
        folder,
        originalFilename: storedName,
        contentType: file.mimetype,
        tenantDbName,
      });
      return {
        url: uploaded.secure_url || uploaded.url,
        name: safeName,
        size: file.size,
      };
    } catch (error) {
      console.warn(
        `[company-page-media] S3 upload failed (${folder}), using local storage:`,
        error?.message || error,
      );
    }
  }

  const dir = localUploadsDir(folder);
  const fullPath = path.join(dir, storedName);
  fs.writeFileSync(fullPath, file.buffer);
  return {
    url: `${backendPublicBase()}/uploads/${folder}/${encodeURIComponent(storedName)}`,
    name: safeName,
    size: file.size,
  };
}

export async function storeCompanyLogoFile(file, { tenantDbName } = {}) {
  const stored = await storeCompanyImageFile(file, {
    tenantDbName,
    folder: 'company-logos',
    maxBytes: COMPANY_LOGO_MAX_BYTES,
    label: 'Logo',
  });
  return {
    logoUrl: stored.url,
    name: stored.name,
    size: stored.size,
  };
}

export async function storeCompanyPostMediaFile(file, { tenantDbName } = {}) {
  const stored = await storeCompanyImageFile(file, {
    tenantDbName,
    folder: 'company-post-media',
    maxBytes: COMPANY_POST_MEDIA_MAX_BYTES,
    label: 'Photo',
  });
  return {
    mediaUrl: stored.url,
    name: stored.name,
    size: stored.size,
  };
}
