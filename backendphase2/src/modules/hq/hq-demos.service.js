import { MongoClient } from 'mongodb';
import { env } from '../../config/env.js';

const EMPLOYER_DEMO_COLLECTION = 'employer_demo_requests';

let cachedClient = null;

function portalDatabaseUrl() {
  return String(env.JOB_PORTAL_DATABASE_URL || env.DATABASE_URL || '').trim();
}

function portalDbName() {
  const url = portalDatabaseUrl();
  if (!url) return 'jobportal';
  try {
    return new URL(url).pathname.replace(/^\//, '') || 'jobportal';
  } catch {
    return 'jobportal';
  }
}

async function getCollection() {
  const url = portalDatabaseUrl();
  if (!url) {
    throw new Error('JOB_PORTAL_DATABASE_URL is not configured');
  }

  if (!cachedClient) {
    cachedClient = new MongoClient(url);
    await cachedClient.connect();
  }

  return cachedClient.db().collection(EMPLOYER_DEMO_COLLECTION);
}

function formatDate(value) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function toDemoRow(doc) {
  const status = String(doc.otpStatus || 'PENDING').toUpperCase();
  return {
    id: doc._id.toString(),
    fullName: doc.fullName || '—',
    email: doc.email || '',
    organizationName: doc.organizationName || '—',
    countryCode: doc.countryCode || '',
    dialCode: doc.dialCode || '',
    phoneNumber: doc.phoneNumber || '',
    companySize: doc.companySize || '—',
    outcome: doc.outcome || '',
    status,
    emailVerifiedAt:
      doc.emailVerifiedAt instanceof Date
        ? doc.emailVerifiedAt.toISOString()
        : doc.emailVerifiedAt || null,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt || null,
    submittedAt: formatDate(doc.emailVerifiedAt || doc.createdAt),
  };
}

function computeStats(rows) {
  const verified = rows.filter((row) => row.status === 'VERIFIED').length;
  const pending = rows.filter((row) => row.status === 'PENDING').length;
  const expired = rows.filter((row) => row.status === 'EXPIRED').length;
  return {
    total: rows.length,
    verified,
    pending,
    expired,
  };
}

export const hqDemosService = {
  async listDemoRequests() {
    const collection = await getCollection();
    const docs = await collection.find({}).sort({ createdAt: -1 }).limit(500).toArray();
    const demos = docs.map(toDemoRow);
    return {
      demos,
      stats: computeStats(demos),
      storage: {
        engine: 'mongodb',
        database: portalDbName(),
        collection: EMPLOYER_DEMO_COLLECTION,
      },
    };
  },
};
