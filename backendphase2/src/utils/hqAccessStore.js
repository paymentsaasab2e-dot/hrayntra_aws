import { MongoClient } from 'mongodb';
import { env } from '../config/env.js';

const PASSWORDS = '_hq_user_passwords';
const EVENTS = '_hq_access_events';

let clientPromise = null;
let indexesReady = false;

async function headquartersDb() {
  const url = String(env.HEADQUARTERS_DATABASE_URL || '').trim();
  if (!url) return null;
  if (!clientPromise) {
    const client = new MongoClient(url);
    clientPromise = client.connect().then(() => client);
  }
  const client = await clientPromise;
  const db = client.db();
  if (!indexesReady) {
    indexesReady = true;
    try {
      await db.collection(PASSWORDS).createIndex(
        { tenantDbName: 1, loginId: 1 },
        { sparse: true },
      );
      await db.collection(PASSWORDS).createIndex({ tenantDbName: 1, email: 1 });
      await db.collection(EVENTS).createIndex({ tenantDbName: 1, kind: 1, createdAt: -1 });
    } catch {
      /* indexes are optional */
    }
  }
  return db;
}

function clean(value) {
  return String(value || '').trim();
}

/**
 * Saves the current User ID and password for an HQ operator to read.
 * The login check still uses the bcrypt hash. This copy is only for HQ.
 */
export async function rememberHqUserPassword({
  tenantDbName,
  userId,
  loginId,
  email,
  name,
  password,
} = {}) {
  const plain = String(password ?? '');
  const tenant = clean(tenantDbName);
  const login = clean(loginId);
  const mail = clean(email).toLowerCase();
  if (!plain || (!login && !mail)) return;
  try {
    const db = await headquartersDb();
    if (!db) return;
    const now = new Date();
    const filter = login
      ? { tenantDbName: tenant, loginId: login }
      : { tenantDbName: tenant, email: mail };
    await db.collection(PASSWORDS).updateOne(
      filter,
      {
        $set: {
          tenantDbName: tenant,
          userId: clean(userId),
          loginId: login,
          email: mail,
          name: clean(name),
          password: plain,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
  } catch (error) {
    console.warn('[hq-access] password', error?.message || error);
  }
}

export async function recordHqAccessEvent({
  tenantDbName,
  kind,
  outcome,
  userId,
  loginId,
  email,
  name,
  ipAddress,
  device,
  source,
} = {}) {
  const tenant = clean(tenantDbName);
  const eventKind = clean(kind);
  if (!tenant || !eventKind) return;
  try {
    const db = await headquartersDb();
    if (!db) return;
    await db.collection(EVENTS).insertOne({
      tenantDbName: tenant,
      kind: eventKind,
      outcome: clean(outcome),
      userId: clean(userId),
      loginId: clean(loginId),
      email: clean(email).toLowerCase(),
      name: clean(name),
      ipAddress: clean(ipAddress),
      device: clean(device),
      source: clean(source),
      createdAt: new Date(),
    });
  } catch (error) {
    console.warn('[hq-access] event', error?.message || error);
  }
}

export async function listHqUserPasswords(tenantDbName) {
  const tenant = clean(tenantDbName);
  if (!tenant) return [];
  try {
    const db = await headquartersDb();
    if (!db) return [];
    return db
      .collection(PASSWORDS)
      .find({ tenantDbName: tenant })
      .sort({ updatedAt: -1 })
      .limit(500)
      .toArray();
  } catch (error) {
    console.warn('[hq-access] list passwords', error?.message || error);
    return [];
  }
}

export async function listHqAccessEvents(tenantDbName, kind) {
  const tenant = clean(tenantDbName);
  if (!tenant) return [];
  try {
    const db = await headquartersDb();
    if (!db) return [];
    const filter = { tenantDbName: tenant };
    if (kind) filter.kind = kind;
    return db.collection(EVENTS).find(filter).sort({ createdAt: -1 }).limit(300).toArray();
  } catch (error) {
    console.warn('[hq-access] list events', error?.message || error);
    return [];
  }
}
