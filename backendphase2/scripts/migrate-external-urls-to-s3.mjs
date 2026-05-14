/**
 * Re-upload remote file URLs (e.g. legacy Cloudinary HTTPS URLs) into this app's S3 bucket.
 *
 * Usage (from backendphase2, with AWS_* env set):
 *   node scripts/migrate-external-urls-to-s3.mjs path/to/urls.txt
 *
 * Optional: MIGRATION_S3_TENANT — S3 tenant segment (default _migrations). Objects land under
 * uploads/{phase}/tenants/{MIGRATION_S3_TENANT}/migrated/...
 * urls.txt: one absolute URL per line. Prints CSV: originalUrl,newS3Url
 *
 * Does not modify your database — capture output and run a DB update separately.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { uploadBufferToS3 } = await import('../src/utils/s3.js');

async function migrateOne(sourceUrl) {
  const res = await fetch(sourceUrl, { redirect: 'follow' });
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ext = path.extname(new URL(sourceUrl).pathname) || '.bin';
  const folder = 'migrated';
  const out = await uploadBufferToS3(buf, {
    folder,
    originalFilename: `migrated${ext}`,
    contentType: res.headers.get('content-type') || undefined,
    tenantDbName: process.env.MIGRATION_S3_TENANT || '_migrations',
  });
  return out.secure_url || out.url;
}

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/migrate-external-urls-to-s3.mjs <urls.txt>');
  process.exit(1);
}

const lines = fs
  .readFileSync(file, 'utf8')
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter(Boolean);

for (const line of lines) {
  try {
    const newUrl = await migrateOne(line);
    console.log(`${JSON.stringify(line)},${JSON.stringify(newUrl)}`);
  } catch (e) {
    console.error(`FAIL\t${line}\t${e.message}`);
  }
}
