import { MongoClient, ObjectId } from 'mongodb';
import { env } from '../../config/env.js';

const EMPLOYER_DEMO_COLLECTION = 'employer_demo_requests';
const HQ_DEMO_COLLECTION = 'hq_employer_demo_requests';
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

let portalClient = null;
let hqClient = null;

function portalDatabaseUrl() {
  return String(env.JOB_PORTAL_DATABASE_URL || env.DATABASE_URL || '').trim();
}

function hqDatabaseUrl() {
  return String(env.HEADQUARTERS_DATABASE_URL || '').trim();
}

function databaseNameFromUrl(url, fallback) {
  if (!url) return fallback;
  try {
    return new URL(url).pathname.replace(/^\//, '') || fallback;
  } catch {
    return fallback;
  }
}

function portalDbName() {
  return databaseNameFromUrl(portalDatabaseUrl(), 'jobportal');
}

function hqDbName() {
  return databaseNameFromUrl(hqDatabaseUrl(), 'headquarters');
}

async function getPortalCollection() {
  const url = portalDatabaseUrl();
  if (!url) return null;
  if (!portalClient) {
    portalClient = new MongoClient(url);
    await portalClient.connect();
  }
  return portalClient.db().collection(EMPLOYER_DEMO_COLLECTION);
}

async function getHqCollection() {
  const url = hqDatabaseUrl();
  if (!url) {
    throw new Error('HEADQUARTERS_DATABASE_URL is not configured');
  }
  if (!hqClient) {
    hqClient = new MongoClient(url);
    await hqClient.connect();
  }
  return hqClient.db().collection(HQ_DEMO_COLLECTION);
}

async function syncPortalDemosIntoHq() {
  const portal = await getPortalCollection();
  if (!portal) return;
  const hq = await getHqCollection();
  const docs = await portal.find({}).sort({ createdAt: -1 }).limit(500).toArray();
  if (!docs.length) return;
  const deletedHq = await hq.find({ isDeleted: true }, { projection: { _id: 1 } }).toArray();
  const deletedIds = new Set(deletedHq.map((d) => String(d._id)));
  const now = new Date();
  const ops = docs
    .filter((doc) => !deletedIds.has(String(doc._id)))
    .map((doc) => ({
      replaceOne: {
        filter: { _id: doc._id },
        replacement: { ...doc, mirroredFrom: 'job_portal', mirroredAt: now },
        upsert: true,
      },
    }));
  if (!ops.length) return;
  await hq.bulkWrite(ops, { ordered: false });
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
    isDeleted: Boolean(doc.isDeleted),
    deletedAt: doc.deletedAt
      ? doc.deletedAt instanceof Date
        ? doc.deletedAt.toISOString()
        : String(doc.deletedAt)
      : null,
    deletedBy: String(doc.deletedBy || ''),
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

function dualWriteDemoCollection(portalCol, hqCol) {
  return {
    find: (...args) => (portalCol || hqCol).find(...args),
    findOne: async (...args) => {
      const fromPortal = portalCol ? await portalCol.findOne(...args) : null;
      if (fromPortal) return fromPortal;
      return hqCol.findOne(...args);
    },
    updateOne: async (filter, update, options) => {
      const hqResult = await hqCol.updateOne(filter, update, { ...(options || {}), upsert: true });
      if (portalCol) {
        try {
          await portalCol.updateOne(filter, update, options);
        } catch (error) {
          console.warn('[hq-demos] portal update skipped:', error?.message || error);
        }
      }
      return hqResult;
    },
    deleteOne: async (filter) => {
      const hqResult = await hqCol.deleteOne(filter);
      if (portalCol) {
        try {
          await portalCol.deleteOne(filter);
        } catch (error) {
          console.warn('[hq-demos] portal delete skipped:', error?.message || error);
        }
      }
      return hqResult;
    },
  };
}

export const hqDemosService = {
  async getRawCollection() {
    try {
      await syncPortalDemosIntoHq();
    } catch (error) {
      console.warn('[hq-demos] portal sync skipped:', error?.message || error);
    }
    const hq = await getHqCollection();
    const portal = await getPortalCollection().catch(() => null);
    return dualWriteDemoCollection(portal, hq);
  },

  async listDemoRequests() {
    try {
      await syncPortalDemosIntoHq();
    } catch (error) {
      console.warn('[hq-demos] portal sync skipped:', error?.message || error);
    }

    const collection = await getHqCollection();
    const docs = await collection
      .find({ isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(500)
      .toArray();
    const demos = docs.map(toDemoRow);
    return {
      demos,
      stats: computeStats(demos),
      storage: {
        engine: 'mongodb',
        database: hqDbName(),
        collection: HQ_DEMO_COLLECTION,
        mirroredFrom: {
          database: portalDbName(),
          collection: EMPLOYER_DEMO_COLLECTION,
        },
      },
    };
  },

  async deleteDemoRequest(id) {
    if (!ObjectId.isValid(id)) {
      throw new Error('Invalid demo request id');
    }

    const objectId = new ObjectId(id);
    const hq = await getHqCollection();
    const hqResult = await hq.deleteOne({ _id: objectId });

    let portalDeleted = 0;
    try {
      const portal = await getPortalCollection();
      if (portal) {
        const portalResult = await portal.deleteOne({ _id: objectId });
        portalDeleted = portalResult.deletedCount || 0;
      }
    } catch (error) {
      console.warn('[hq-demos] portal delete skipped:', error?.message || error);
    }

    if (!hqResult.deletedCount && !portalDeleted) {
      throw new Error('Demo request not found');
    }

    return {
      deleted: true,
      id,
      storage: {
        engine: 'mongodb',
        database: hqDbName(),
        collection: HQ_DEMO_COLLECTION,
      },
    };
  },

  async listDeletedDemoRequests() {
    const collection = await getHqCollection();
    const docs = await collection
      .find({ isDeleted: true })
      .sort({ deletedAt: -1, createdAt: -1 })
      .limit(500)
      .toArray();
    return docs.map(toDemoRow);
  },

  async softDeleteDemoByEmail(email, actor = {}) {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized) return { deleted: false };
    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter = {
      email: { $regex: `^${escaped}$`, $options: 'i' },
      isDeleted: { $ne: true },
    };
    const now = new Date();
    const update = {
      $set: {
        isDeleted: true,
        deletedAt: now,
        deletedBy: String(actor?.email || actor?.name || '').trim(),
        updatedAt: now,
      },
    };
    const hq = await getHqCollection();
    const hqResult = await hq.updateMany(filter, update);
    try {
      const portal = await getPortalCollection();
      if (portal) await portal.updateMany(filter, update);
    } catch (error) {
      console.warn('[hq-demos] portal soft-delete skipped:', error?.message || error);
    }
    return { deleted: (hqResult.modifiedCount || 0) > 0, email: normalized };
  },

  async restoreDemoByEmail(email) {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized) return { restored: false };
    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter = {
      email: { $regex: `^${escaped}$`, $options: 'i' },
      isDeleted: true,
    };
    const now = new Date();
    const update = {
      $set: { updatedAt: now },
      $unset: { isDeleted: '', deletedAt: '', deletedBy: '' },
    };
    const hq = await getHqCollection();
    const hqResult = await hq.updateMany(filter, update);
    try {
      const portal = await getPortalCollection();
      if (portal) await portal.updateMany(filter, update);
    } catch (error) {
      console.warn('[hq-demos] portal restore skipped:', error?.message || error);
    }
    return { restored: (hqResult.modifiedCount || 0) > 0, email: normalized };
  },

  async purgeDemoByEmail(email) {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized) return { purged: false };
    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter = { email: { $regex: `^${escaped}$`, $options: 'i' } };
    const hq = await getHqCollection();
    const hqResult = await hq.deleteMany(filter);
    let portalDeleted = 0;
    try {
      const portal = await getPortalCollection();
      if (portal) {
        const portalResult = await portal.deleteMany(filter);
        portalDeleted = portalResult.deletedCount || 0;
      }
    } catch (error) {
      console.warn('[hq-demos] portal purge skipped:', error?.message || error);
    }
    return {
      purged: (hqResult.deletedCount || 0) > 0 || portalDeleted > 0,
      email: normalized,
    };
  },
};
