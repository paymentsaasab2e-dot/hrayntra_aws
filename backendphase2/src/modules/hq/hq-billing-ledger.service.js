import { MongoClient } from 'mongodb';
import { env } from '../../config/env.js';

const COLLECTION = 'hq_tenant_billing_transactions';

let hqClient = null;

async function getCollection() {
  const url = String(env.HEADQUARTERS_DATABASE_URL || '').trim();
  if (!url) return null;
  if (!hqClient) {
    hqClient = new MongoClient(url);
    await hqClient.connect();
  }
  return hqClient.db().collection(COLLECTION);
}

function toIso(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export async function appendTenantBillingTransaction(entry) {
  const collection = await getCollection();
  if (!collection) return null;

  const doc = {
    tenantDbName: String(entry.tenantDbName || '').trim(),
    tenantEmail: String(entry.tenantEmail || '').trim().toLowerCase(),
    type: String(entry.type || 'COIN_SPEND').trim().toUpperCase(),
    amount: Math.max(0, Math.floor(Number(entry.amount) || 0)),
    balanceAfter: Math.max(0, Math.floor(Number(entry.balanceAfter) || 0)),
    unit: entry.unit === 'INR' ? 'INR' : 'coins',
    reference: String(entry.reference || '').trim(),
    description: String(entry.description || '').trim(),
    featureId: String(entry.featureId || '').trim(),
    packId: String(entry.packId || '').trim(),
    actorEmail: String(entry.actorEmail || '').trim().toLowerCase(),
    createdAt: new Date(),
  };

  if (!doc.tenantDbName && !doc.tenantEmail) return null;
  const result = await collection.insertOne(doc);
  return { id: String(result.insertedId), ...doc, createdAt: toIso(doc.createdAt) };
}

export async function listTenantBillingTransactions({ tenantDbName, tenantEmail, limit = 500 } = {}) {
  const collection = await getCollection();
  if (!collection) return [];

  const filters = [];
  const dbName = String(tenantDbName || '').trim();
  const email = String(tenantEmail || '').trim().toLowerCase();
  if (dbName) filters.push({ tenantDbName: dbName });
  if (email) filters.push({ tenantEmail: email });
  if (!filters.length) return [];

  const rows = await collection
    .find({ $or: filters })
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(Number(limit) || 500, 1), 1000))
    .toArray();

  return rows.map((row) => ({
    id: String(row._id),
    tenantDbName: row.tenantDbName || '',
    tenantEmail: row.tenantEmail || '',
    type: row.type || 'COIN_SPEND',
    amount: Number(row.amount) || 0,
    balanceAfter: Number(row.balanceAfter) || 0,
    unit: row.unit || 'coins',
    reference: row.reference || '',
    description: row.description || '',
    featureId: row.featureId || '',
    packId: row.packId || '',
    actorEmail: row.actorEmail || '',
    occurredAt: toIso(row.createdAt),
  }));
}

export async function listAllTenantBillingTransactions({ limit = 500 } = {}) {
  const collection = await getCollection();
  if (!collection) return [];

  const rows = await collection
    .find({})
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(Number(limit) || 500, 1), 1000))
    .toArray();

  return rows.map((row) => ({
    id: String(row._id),
    tenantDbName: row.tenantDbName || '',
    tenantEmail: row.tenantEmail || '',
    type: row.type || 'COIN_SPEND',
    amount: Number(row.amount) || 0,
    balanceAfter: Number(row.balanceAfter) || 0,
    unit: row.unit || 'coins',
    reference: row.reference || '',
    description: row.description || '',
    featureId: row.featureId || '',
    packId: row.packId || '',
    actorEmail: row.actorEmail || '',
    occurredAt: toIso(row.createdAt),
  }));
}
