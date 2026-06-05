import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.resolve(__dirname, '../../uploads');
const zipExtractRoot = path.join(uploadsRoot, 'bulk-zip');

const CV_EXT = new Set(['.pdf', '.doc', '.docx', '.txt', '.png']);

const MIME_BY_EXT = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
  '.png': 'image/png',
};

function shouldSkipZipEntry(entryName) {
  const n = String(entryName || '').replace(/\\/g, '/');
  if (!n || n.endsWith('/')) return true;
  if (n.includes('/__MACOSX/') || n.startsWith('__MACOSX/')) return true;
  if (n.endsWith('.DS_Store')) return true;
  const base = path.basename(n);
  if (base.startsWith('.')) return true;
  const ext = path.extname(base).toLowerCase();
  return !CV_EXT.has(ext);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * Extract a ZIP of CVs for bulk processing (server-stored; client uses storedFileId per file).
 */
export function expandBulkCvZipArchive(zipPath, options = {}) {
  const {
    userId,
    sessionId,
    maxFiles = 2000,
    maxPerFileBytes = 25 * 1024 * 1024,
  } = options;

  if (!zipPath || !fs.existsSync(zipPath)) {
    throw new Error('ZIP file not found');
  }

  const targetDir = path.join(zipExtractRoot, String(userId), String(sessionId));
  ensureDir(targetDir);

  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();

  const fileEntries = [];
  let skipped = 0;

  for (const entry of entries) {
    if (fileEntries.length >= maxFiles) {
      skipped += 1;
      continue;
    }
    if (entry.isDirectory || shouldSkipZipEntry(entry.entryName)) {
      continue;
    }

    const baseName = path.basename(entry.entryName);
    const ext = path.extname(baseName).toLowerCase();
    const uncompressed = entry.header?.size ?? 0;
    if (uncompressed > maxPerFileBytes) {
      skipped += 1;
      continue;
    }

    const storedFileId = `zf-${fileEntries.length}`;
    const safeName = baseName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const outPath = path.join(targetDir, `${storedFileId}_${safeName}`);

    try {
      const data = entry.getData();
      if (!data?.length) {
        skipped += 1;
        continue;
      }
      if (data.length > maxPerFileBytes) {
        skipped += 1;
        continue;
      }
      fs.writeFileSync(outPath, data);
      fileEntries.push({
        storedFileId,
        path: outPath,
        originalname: baseName,
        mimetype: MIME_BY_EXT[ext] || 'application/octet-stream',
        size: data.length,
      });
    } catch {
      skipped += 1;
    }
  }

  if (!fileEntries.length) {
    try {
      fs.rmSync(targetDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    throw new Error('No PDF, DOC, DOCX, TXT, or PNG files found inside the ZIP');
  }

  return { targetDir, fileEntries, skipped, total: fileEntries.length };
}
