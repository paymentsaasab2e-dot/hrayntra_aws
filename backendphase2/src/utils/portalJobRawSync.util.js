const PORTAL_JOBS_COLLECTION = 'jobs';
const PORTAL_JOB_UPDATE_CHUNK_SIZE = 6;

const OBJECT_ID_FIELDS = new Set([
  'clientId',
  'assignedToId',
  'createdById',
  'hiringManagerId',
  'managerId',
]);

const DATE_FIELDS = new Set([
  'postedDate',
  'expectedClosureDate',
  'createdAt',
  'updatedAt',
]);

function isObjectIdHex(value) {
  return typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value.trim());
}

function toMongoValue(value, fieldName) {
  if (value === undefined) return undefined;
  if (value === null) return null;

  if (OBJECT_ID_FIELDS.has(fieldName)) {
    const str = String(value).trim();
    return isObjectIdHex(str) ? { $oid: str } : null;
  }

  if (DATE_FIELDS.has(fieldName) || value instanceof Date) {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return { $date: d.toISOString() };
  }

  return value;
}

function serializePortalJobFields(data) {
  const out = {};
  for (const [key, value] of Object.entries(data)) {
    const serialized = toMongoValue(value, key);
    if (serialized !== undefined) {
      out[key] = serialized;
    }
  }
  return out;
}

function chunkRecord(record, chunkSize) {
  const entries = Object.entries(record).filter(([, value]) => value !== undefined);
  const chunks = [];
  for (let i = 0; i < entries.length; i += chunkSize) {
    chunks.push(Object.fromEntries(entries.slice(i, i + chunkSize)));
  }
  return chunks;
}

/**
 * Upsert a portal job via MongoDB update + $set (bypasses Prisma aggregation pipelines).
 * Atlas rejects Prisma update/upsert when the generated pipeline exceeds 50 stages.
 */
export async function upsertPortalJobRaw(portalPrisma, jobId, jobData) {
  if (!portalPrisma?.$runCommandRaw) {
    throw new Error('Portal Prisma client does not support $runCommandRaw');
  }

  const idStr = String(jobId || '').trim();
  if (!isObjectIdHex(idStr)) {
    throw new Error(`Invalid portal job id: ${jobId}`);
  }

  const now = new Date().toISOString();
  const setDoc = serializePortalJobFields({
    ...jobData,
    updatedAt: jobData.updatedAt || now,
  });

  const result = await portalPrisma.$runCommandRaw({
    update: PORTAL_JOBS_COLLECTION,
    updates: [
      {
        q: { _id: { $oid: idStr } },
        u: {
          $set: setDoc,
          $setOnInsert: {
            createdAt: jobData.createdAt
              ? toMongoValue(jobData.createdAt, 'createdAt')
              : { $date: now },
          },
        },
        upsert: true,
      },
    ],
  });

  const writeError = result?.writeErrors?.[0];
  if (writeError) {
    throw new Error(writeError.errmsg || writeError.err || 'Portal job raw upsert failed');
  }

  return result;
}

/** Fallback when raw Mongo upsert is unavailable — split into small Prisma updates. */
export async function upsertPortalJobChunked(portalPrisma, jobId, jobData) {
  const exists = await portalPrisma.job.findUnique({
    where: { id: jobId },
    select: { id: true },
  });

  if (!exists) {
    const { title, type, status, tenantDbName, ...rest } = jobData;
    await portalPrisma.job.create({
      data: {
        id: jobId,
        title: title || 'Untitled',
        type: type || 'FULL_TIME',
        status: status || 'OPEN',
        tenantDbName: tenantDbName || null,
      },
    });
    for (const chunk of chunkRecord(rest, PORTAL_JOB_UPDATE_CHUNK_SIZE)) {
      if (Object.keys(chunk).length) {
        await portalPrisma.job.update({ where: { id: jobId }, data: chunk });
      }
    }
    return;
  }

  for (const chunk of chunkRecord(jobData, PORTAL_JOB_UPDATE_CHUNK_SIZE)) {
    if (Object.keys(chunk).length) {
      await portalPrisma.job.update({ where: { id: jobId }, data: chunk });
    }
  }
}

export async function upsertPortalJobDocument(portalPrisma, jobId, jobData) {
  try {
    await upsertPortalJobRaw(portalPrisma, jobId, jobData);
  } catch (rawError) {
    console.warn(
      `[portalJobRawSync] raw upsert failed for job ${jobId}, falling back to chunked Prisma update:`,
      rawError?.message || rawError,
    );
    await upsertPortalJobChunked(portalPrisma, jobId, jobData);
  }
}
