import { MongoClient, ObjectId } from 'mongodb';
import { env } from '../../config/env.js';

const HQ_CUSTOM_REPORTS_COLLECTION = 'hq_custom_reports';
const DATASETS = [
  'leads',
  'clients',
  'demos',
  'tenants',
  'tickets',
  'team',
  'candidates',
  'kyc',
  'courses',
  'jobs',
  'events',
  'helpTickets',
  'companies',
];
const METRICS = ['count', 'pipeline'];

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

async function getCollection() {
  const db = await getDb();
  const collection = db.collection(HQ_CUSTOM_REPORTS_COLLECTION);
  if (!indexesEnsured) {
    try {
      await collection.createIndex({ createdAt: -1 });
      await collection.createIndex({ createdByEmail: 1, createdAt: -1 });
      indexesEnsured = true;
    } catch {
      // Best-effort index creation.
    }
  }
  return collection;
}

function toIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function mapReport(doc) {
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    name: doc.name || 'Untitled report',
    dataset: DATASETS.includes(doc.dataset) ? doc.dataset : 'leads',
    groupBy: String(doc.groupBy || 'status').trim() || 'status',
    metric: METRICS.includes(doc.metric) ? doc.metric : 'count',
    dateFrom: doc.dateFrom || '',
    dateTo: doc.dateTo || '',
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
    createdByEmail: doc.createdByEmail || null,
  };
}

function parseInput(data = {}) {
  const name = String(data.name || '').trim();
  if (!name) {
    const err = new Error('Report name is required');
    err.statusCode = 400;
    throw err;
  }
  const dataset = String(data.dataset || 'leads').trim().toLowerCase();
  const metric = String(data.metric || 'count').trim().toLowerCase();
  return {
    name,
    dataset: DATASETS.includes(dataset) ? dataset : 'leads',
    groupBy: String(data.groupBy || 'status').trim() || 'status',
    metric: METRICS.includes(metric) ? metric : 'count',
    dateFrom: String(data.dateFrom || '').trim(),
    dateTo: String(data.dateTo || '').trim(),
  };
}

export const hqReportsService = {
  async listReports() {
    const collection = await getCollection();
    const docs = await collection.find({}).sort({ createdAt: -1 }).limit(100).toArray();
    return { reports: docs.map(mapReport).filter(Boolean) };
  },

  async createReport(data, reqUser) {
    const parsed = parseInput(data);
    const collection = await getCollection();
    const now = new Date();
    const doc = {
      ...parsed,
      createdAt: now,
      updatedAt: now,
      createdByEmail: reqUser?.email || null,
    };
    const result = await collection.insertOne(doc);
    const inserted = await collection.findOne({ _id: result.insertedId });
    return { report: mapReport(inserted) };
  },

  async updateReport(id, data, reqUser) {
    if (!ObjectId.isValid(id)) {
      const err = new Error('Invalid report id');
      err.statusCode = 400;
      throw err;
    }
    const parsed = parseInput(data);
    const collection = await getCollection();
    const objectId = new ObjectId(id);
    const existing = await collection.findOne({ _id: objectId });
    if (!existing) {
      const err = new Error('Report not found');
      err.statusCode = 404;
      throw err;
    }
    await collection.updateOne(
      { _id: objectId },
      {
        $set: {
          ...parsed,
          updatedAt: new Date(),
          updatedByEmail: reqUser?.email || null,
        },
      },
    );
    const updated = await collection.findOne({ _id: objectId });
    return { report: mapReport(updated) };
  },

  async deleteReport(id) {
    if (!ObjectId.isValid(id)) {
      const err = new Error('Invalid report id');
      err.statusCode = 400;
      throw err;
    }
    const collection = await getCollection();
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    if (!result.deletedCount) {
      const err = new Error('Report not found');
      err.statusCode = 404;
      throw err;
    }
    return { deleted: true, id };
  },
};
