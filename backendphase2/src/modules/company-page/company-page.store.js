import { MongoClient } from 'mongodb';
import { env } from '../../config/env.js';

const PAGES_COLLECTION = 'tenant_company_pages';
const POSTS_COLLECTION = 'tenant_company_posts';

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
    db
      .collection(PAGES_COLLECTION)
      .createIndexes([
        { key: { tenantDbName: 1 }, unique: true },
        { key: { id: 1 }, unique: true },
        { key: { domainKey: 1 } },
      ])
      .catch(() => undefined),
    db
      .collection(POSTS_COLLECTION)
      .createIndexes([
        { key: { id: 1 }, unique: true },
        { key: { tenantDbName: 1, createdAt: -1 } },
        { key: { companyPageId: 1, createdAt: -1 } },
      ])
      .catch(() => undefined),
  ]);
  indexesEnsured = true;
}

export async function getCompanyPageByTenant(tenantDbName) {
  const db = await getDb();
  await ensureIndexes(db);
  return db.collection(PAGES_COLLECTION).findOne({ tenantDbName: String(tenantDbName) });
}

export async function upsertCompanyPageRecord(page) {
  const db = await getDb();
  await ensureIndexes(db);
  const now = new Date();
  // createdAt must only appear in $setOnInsert — Mongo rejects the same path in $set + $setOnInsert.
  const { createdAt: _ignoreCreatedAt, ...pageWithoutCreatedAt } = page || {};
  const createdAt = page?.createdAt || now.toISOString();
  const doc = {
    ...pageWithoutCreatedAt,
    id: String(page.id),
    tenantDbName: String(page.tenantDbName),
    updatedAt: now.toISOString(),
    mirroredAt: now,
  };
  await db.collection(PAGES_COLLECTION).updateOne(
    { tenantDbName: doc.tenantDbName },
    { $set: doc, $setOnInsert: { createdAt } },
    { upsert: true },
  );
  return db.collection(PAGES_COLLECTION).findOne({ tenantDbName: doc.tenantDbName });
}

export async function updateCompanyPageName(tenantDbName, name) {
  const db = await getDb();
  await ensureIndexes(db);
  const nextName = String(name || '').trim();
  if (!nextName) return null;
  const logoLetter = nextName.slice(0, 1).toUpperCase() || 'C';
  const now = new Date().toISOString();
  await db.collection(PAGES_COLLECTION).updateOne(
    { tenantDbName: String(tenantDbName) },
    { $set: { name: nextName, logoLetter, updatedAt: now, mirroredAt: new Date() } },
  );
  return db.collection(PAGES_COLLECTION).findOne({ tenantDbName: String(tenantDbName) });
}

export async function listCompanyPosts(tenantDbName, { limit = 50 } = {}) {
  const db = await getDb();
  await ensureIndexes(db);
  return db
    .collection(POSTS_COLLECTION)
    .find({ tenantDbName: String(tenantDbName) })
    .sort({ createdAt: -1 })
    .limit(Math.min(100, Math.max(1, Number(limit) || 50)))
    .toArray();
}

export async function insertCompanyPost(post) {
  const db = await getDb();
  await ensureIndexes(db);
  const doc = {
    ...post,
    id: String(post.id),
    tenantDbName: String(post.tenantDbName),
    createdAt: post.createdAt || new Date().toISOString(),
  };
  await db.collection(POSTS_COLLECTION).insertOne(doc);
  return doc;
}

export async function deleteCompanyPost(tenantDbName, postId) {
  const db = await getDb();
  await ensureIndexes(db);
  const result = await db.collection(POSTS_COLLECTION).deleteOne({
    tenantDbName: String(tenantDbName),
    id: String(postId),
  });
  return result.deletedCount > 0;
}
