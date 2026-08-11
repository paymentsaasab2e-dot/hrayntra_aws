import { MongoClient, ObjectId } from 'mongodb';
import { env } from '../../config/env.js';

const EMPLOYER_DEMO_COLLECTION = 'employer_demo_requests';
const TRIAL_PACKAGE_DAYS = 5;

function isoDateFrom(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function inferTrialStartsAt(doc) {
  return (
    String(doc.trialStartsAt || '').trim() ||
    String(doc.planStartDate || '').trim() ||
    isoDateFrom(doc.emailVerifiedAt) ||
    isoDateFrom(doc.createdAt) ||
    null
  );
}

function inferTrialEndsAt(doc, start) {
  const stored = String(doc.trialEndsAt || '').trim();
  if (stored) return stored;
  if (!start) return null;
  const d = new Date(`${start}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + TRIAL_PACKAGE_DAYS);
  return d.toISOString().slice(0, 10);
}

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

function parsePurchaseOutcome(outcome) {
  const match = String(outcome || '').match(/\[package:([^;\]]+);cycle:([^\]]+)\]/i);
  if (!match) return null;
  return {
    packageSlug: String(match[1] || '').trim().toLowerCase(),
    billingCycle: String(match[2] || 'monthly').trim().toLowerCase() === 'annual' ? 'annual' : 'monthly',
  };
}

function normalizeRequestKind(raw) {
  const kind = String(raw || 'demo').toLowerCase();
  if (kind === 'trial') return 'trial';
  if (kind === 'purchase') return 'purchase';
  return 'demo';
}

function inferPackageLabel(outcome, purchaseMeta) {
  const paidMatch = String(outcome || '').match(/Paid signup — ([^(]+)/i);
  if (paidMatch) return String(paidMatch[1] || '').trim();
  if (purchaseMeta?.packageSlug) {
    return purchaseMeta.packageSlug.charAt(0).toUpperCase() + purchaseMeta.packageSlug.slice(1);
  }
  return '';
}

function formatDate(value) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function toDemoRow(doc) {
  const status = String(doc.otpStatus || 'PENDING').toUpperCase();
  const requestKind = normalizeRequestKind(doc.requestKind);
  const purchaseMeta = requestKind === 'purchase' ? parsePurchaseOutcome(doc.outcome) : null;
  const packageName = requestKind === 'purchase' ? inferPackageLabel(doc.outcome, purchaseMeta) : '';
  const trialStartsAt = inferTrialStartsAt(doc);
  const trialEndsAt = inferTrialEndsAt(doc, trialStartsAt);
  return {
    id: doc._id.toString(),
    fullName: doc.fullName || '—',
    email: doc.email || '',
    organizationName: doc.organizationName || '—',
    organizationType: String(doc.organizationType || 'agency').toLowerCase() === 'standalone' ? 'standalone' : 'agency',
    countryCode: doc.countryCode || '',
    dialCode: doc.dialCode || '',
    phoneNumber: doc.phoneNumber || '',
    companySize: doc.companySize || '—',
    outcome: doc.outcome || '',
    requestKind,
    packageSlug: purchaseMeta?.packageSlug || '',
    packageName,
    billingCycle: purchaseMeta?.billingCycle || '',
    trialProvisioned: Boolean(doc.trialProvisioned),
    trialTenantDbName: doc.trialTenantDbName || '',
    trialLoginId: doc.trialLoginId || '',
    trialDays: Number(doc.trialDays) || null,
    trialStartsAt,
    trialEndsAt,
    trialLoginUrl: doc.trialLoginUrl || '',
    credentialsSentAt: doc.credentialsSentAt
      ? doc.credentialsSentAt instanceof Date
        ? doc.credentialsSentAt.toISOString()
        : String(doc.credentialsSentAt)
      : null,
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
  const trials = rows.filter((row) => row.requestKind === 'trial').length;
  const trialsLive = rows.filter((row) => row.requestKind === 'trial' && row.trialProvisioned).length;
  const purchases = rows.filter((row) => row.requestKind === 'purchase').length;
  const purchasesLive = rows.filter((row) => row.requestKind === 'purchase' && row.trialProvisioned).length;
  return {
    total: rows.length,
    verified,
    pending,
    expired,
    trials,
    trialsLive,
    purchases,
    purchasesLive,
  };
}

export const hqDemosService = {
  async getRawCollection() {
    return getCollection();
  },

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

  async deleteDemoRequest(id) {
    if (!ObjectId.isValid(id)) {
      throw new Error('Invalid demo request id');
    }

    const collection = await getCollection();
    const objectId = new ObjectId(id);
    const result = await collection.deleteOne({ _id: objectId });
    if (!result.deletedCount) {
      throw new Error('Demo request not found');
    }

    return {
      deleted: true,
      id,
      storage: {
        engine: 'mongodb',
        database: portalDbName(),
        collection: EMPLOYER_DEMO_COLLECTION,
      },
    };
  },
};
