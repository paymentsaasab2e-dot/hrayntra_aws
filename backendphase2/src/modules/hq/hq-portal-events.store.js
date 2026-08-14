import { MongoClient } from 'mongodb';
import { env } from '../../config/env.js';

const EVENTS_COLLECTION = 'hq_lms_events';
const REGS_COLLECTION = 'hq_lms_event_registrations';

let cachedClient = null;
let indexesEnsured = false;

async function getDb() {
  if (!env.HEADQUARTERS_DATABASE_URL) {
    throw new Error('HEADQUARTERS_DATABASE_URL is not configured');
  }
  if (!cachedClient) {
    cachedClient = new MongoClient(env.HEADQUARTERS_DATABASE_URL);
    await cachedClient.connect();
  }
  return cachedClient.db();
}

async function ensureIndexes(db) {
  if (indexesEnsured) return;
  await Promise.all([
    db.collection(EVENTS_COLLECTION).createIndexes([
      { key: { id: 1 }, unique: true },
      { key: { createdById: 1, source: 1, scheduledAt: -1 } },
      { key: { source: 1, scheduledAt: -1 } },
    ]).catch(() => undefined),
    db.collection(REGS_COLLECTION).createIndexes([
      { key: { eventId: 1, registeredAt: -1 } },
      { key: { id: 1 }, unique: true, sparse: true },
    ]).catch(() => undefined),
  ]);
  indexesEnsured = true;
}

function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function upsertHqEvent(event) {
  if (!event?.id) return;
  const db = await getDb();
  await ensureIndexes(db);
  const now = new Date();
  await db.collection(EVENTS_COLLECTION).updateOne(
    { id: String(event.id) },
    {
      $set: {
        ...event,
        id: String(event.id),
        scheduledAt: toDate(event.scheduledAt),
        createdAt: toDate(event.createdAt) || now,
        updatedAt: now,
        mirroredAt: now,
      },
    },
    { upsert: true },
  );
}

export async function deleteHqEvent(eventId) {
  if (!eventId) return;
  const db = await getDb();
  await ensureIndexes(db);
  await db.collection(EVENTS_COLLECTION).deleteOne({ id: String(eventId) });
  await db.collection(REGS_COLLECTION).deleteMany({ eventId: String(eventId) });
}

export async function listHqEvents({ createdById, source, tenantDbName } = {}) {
  const db = await getDb();
  await ensureIndexes(db);
  const query = {};
  if (createdById) query.createdById = String(createdById);
  if (source) query.source = String(source);
  if (tenantDbName) query.tenantDbName = String(tenantDbName);
  return db.collection(EVENTS_COLLECTION).find(query).sort({ scheduledAt: -1 }).toArray();
}

export async function upsertHqEventRegistrations(eventId, registrations = []) {
  if (!eventId) return;
  const db = await getDb();
  await ensureIndexes(db);
  const now = new Date();
  const rows = Array.isArray(registrations) ? registrations : [];
  if (!rows.length) {
    await db.collection(REGS_COLLECTION).deleteMany({ eventId: String(eventId) });
    return;
  }
  await db.collection(REGS_COLLECTION).bulkWrite(
    rows.map((row) => ({
      updateOne: {
        filter: { id: String(row.id || `${eventId}:${row.userId || ''}`) },
        update: {
          $set: {
            ...row,
            id: String(row.id || `${eventId}:${row.userId || ''}`),
            eventId: String(eventId),
            registeredAt: toDate(row.registeredAt) || now,
            mirroredAt: now,
          },
        },
        upsert: true,
      },
    })),
    { ordered: false },
  );
}
