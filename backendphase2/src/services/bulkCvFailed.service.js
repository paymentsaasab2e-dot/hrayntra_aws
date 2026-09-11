import fs from 'fs';
import { prisma, getActiveTenantDbName } from '../config/prisma.js';
import {
  deleteS3ObjectByUrl,
  getS3ObjectBodyBuffer,
  uploadBufferToCloudinary,
  uploadContentTypeForFile,
} from '../utils/s3.js';

function publicRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    fileName: row.fileName,
    reason: row.reason,
    fileUrl: row.fileUrl,
    mimeType: row.mimeType || null,
    sizeBytes: row.sizeBytes ?? null,
    status: row.status,
    failedAt: row.failedAt,
    hasFile: Boolean(row.fileUrl || row.s3Key),
  };
}

async function readUploadBuffer(file) {
  if (file?.buffer && Buffer.isBuffer(file.buffer)) return file.buffer;
  if (file?.path && fs.existsSync(file.path)) {
    return fs.readFileSync(file.path);
  }
  throw new Error('No file data to store');
}

/**
 * Persist one failed bulk CV to S3 + FailedBulkResume collection.
 */
export async function saveFailedBulkResume({
  userId,
  orgUnitId,
  file,
  reason,
  tenantDbName,
}) {
  if (!userId) throw new Error('userId required');
  if (!file) throw new Error('file required');

  const buffer = await readUploadBuffer(file);
  const fileName = String(file.originalname || file.name || 'resume').trim() || 'resume';
  const mimeType =
    uploadContentTypeForFile(file.mimetype || file.type, fileName) || 'application/octet-stream';
  const tenant =
    String(tenantDbName || getActiveTenantDbName() || 'default').trim() || 'default';

  const upload = await uploadBufferToCloudinary(buffer, {
    folder: `jobportal/bulk-cv-failed/${userId}`,
    contentType: mimeType,
    originalFilename: fileName,
    tenantDbName: tenant,
  });

  const fileUrl = upload?.secure_url || upload?.url;
  if (!fileUrl) throw new Error('Failed to store resume on server');

  const row = await prisma.failedBulkResume.create({
    data: {
      userId: String(userId),
      orgUnitId: orgUnitId ? String(orgUnitId) : undefined,
      fileName,
      reason: String(reason || 'Unknown error').trim() || 'Unknown error',
      fileUrl,
      s3Key: upload?.key || null,
      mimeType,
      sizeBytes: buffer.length,
      status: 'active',
      failedAt: new Date(),
    },
  });

  return publicRow(row);
}

export async function listFailedBulkResumes(userId, { status = 'active', limit = 500 } = {}) {
  const rows = await prisma.failedBulkResume.findMany({
    where: {
      userId: String(userId),
      status: String(status || 'active'),
    },
    orderBy: { failedAt: 'desc' },
    take: Math.min(2000, Math.max(1, Number(limit) || 500)),
  });
  return rows.map(publicRow);
}

export async function getFailedBulkResumeForUser(userId, id) {
  if (!userId || !id) return null;
  return prisma.failedBulkResume.findFirst({
    where: { id: String(id), userId: String(userId) },
  });
}

export async function getFailedBulkResumeFileBuffer(row) {
  if (!row) throw new Error('Record not found');
  if (row.s3Key) {
    return {
      buffer: await getS3ObjectBodyBuffer(row.s3Key),
      fileName: row.fileName || 'resume',
      mimeType: row.mimeType || 'application/octet-stream',
    };
  }
  if (row.fileUrl) {
    const res = await fetch(row.fileUrl);
    if (!res.ok) throw new Error('Could not download stored resume');
    const ab = await res.arrayBuffer();
    return {
      buffer: Buffer.from(ab),
      fileName: row.fileName || 'resume',
      mimeType: row.mimeType || res.headers.get('content-type') || 'application/octet-stream',
    };
  }
  throw new Error('No file stored for this failed resume');
}

export async function trashFailedBulkResumes(userId, ids) {
  const idList = (ids || []).map((id) => String(id || '').trim()).filter(Boolean);
  if (!idList.length) return { count: 0 };
  const result = await prisma.failedBulkResume.updateMany({
    where: { userId: String(userId), id: { in: idList }, status: 'active' },
    data: { status: 'trash', trashedAt: new Date() },
  });
  return { count: result.count };
}

export async function resolveFailedBulkResumes(userId, ids) {
  const idList = (ids || []).map((id) => String(id || '').trim()).filter(Boolean);
  if (!idList.length) return { count: 0 };
  const rows = await prisma.failedBulkResume.findMany({
    where: { userId: String(userId), id: { in: idList } },
  });
  const result = await prisma.failedBulkResume.updateMany({
    where: { userId: String(userId), id: { in: idList } },
    data: { status: 'resolved', resolvedAt: new Date() },
  });
  for (const row of rows) {
    if (row.fileUrl) {
      try {
        await deleteS3ObjectByUrl(row.fileUrl);
      } catch {
        /* ignore */
      }
    }
  }
  return { count: result.count };
}

export async function countActiveFailedBulkResumes(userId) {
  return prisma.failedBulkResume.count({
    where: { userId: String(userId), status: 'active' },
  });
}
