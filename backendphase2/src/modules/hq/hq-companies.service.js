import { MongoClient, ObjectId } from 'mongodb';
import { env } from '../../config/env.js';
import { findFollowUpIndex, recomputeNextFollowUpAt } from './hq-follow-up.helpers.js';

const HQ_CRM_COMPANIES_COLLECTION = 'hq_crm_companies';
const VALID_STATUSES = ['active', 'inactive', 'on_hold', 'closed'];
const FOLLOW_UP_TYPES = ['Call', 'Email', 'Meeting', 'WhatsApp', 'Other'];

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

function inferScore(dealValue, users) {
  if (dealValue >= 10000 || users >= 300) return 'Hot';
  if (dealValue >= 3000 || users >= 80) return 'Warm';
  return 'Cold';
}

function formatFollowUpDate(date) {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function mapFollowUps(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      id: String(item?.id || ''),
      type: String(item?.type || 'Call'),
      scheduledAt:
        item?.scheduledAt instanceof Date
          ? item.scheduledAt.toISOString()
          : item?.scheduledAt
            ? new Date(item.scheduledAt).toISOString()
            : null,
      notes: String(item?.notes || ''),
      status: String(item?.status || 'scheduled'),
      createdAt:
        item?.createdAt instanceof Date
          ? item.createdAt.toISOString()
          : item?.createdAt
            ? new Date(item.createdAt).toISOString()
            : null,
      createdByEmail: item?.createdByEmail || null,
      completedAt:
        item?.completedAt instanceof Date
          ? item.completedAt.toISOString()
          : item?.completedAt
            ? new Date(item.completedAt).toISOString()
            : null,
    }))
    .filter((item) => item.id)
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

function mapRemarks(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      id: String(item?.id || ''),
      text: String(item?.text || ''),
      createdAt:
        item?.createdAt instanceof Date
          ? item.createdAt.toISOString()
          : item?.createdAt
            ? new Date(item.createdAt).toISOString()
            : null,
      createdByEmail: item?.createdByEmail || null,
    }))
    .filter((item) => item.id)
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

function normalizeStatus(status) {
  const legacyMap = {
    prospect: 'active',
    qualified: 'active',
    onboarding: 'on_hold',
    customer: 'active',
    churned: 'closed',
  };
  const normalized = legacyMap[status] || status || 'active';
  return VALID_STATUSES.includes(normalized) ? normalized : 'active';
}

function toCompanyRow(doc) {
  const status = normalizeStatus(doc.status);
  const nextFollowUp = status === 'closed' ? '—' : formatFollowUpDate(doc.nextFollowUpAt);

  return {
    id: doc._id.toString(),
    name: doc.companyName,
    contact: doc.primaryContactName || '',
    industry: doc.industry || '',
    score: doc.score || 'Cold',
    users: doc.expectedUsers ?? 0,
    owner: doc.accountOwner || '',
    status,
    nextFollowUp,
    nextFollowUpAt:
      doc.nextFollowUpAt instanceof Date ? doc.nextFollowUpAt.toISOString() : null,
    email: doc.email || '',
    phone: doc.phone || '',
    website: doc.website || '',
    country: doc.country || '',
    estimatedDealValue: doc.estimatedDealValue ?? 0,
    companySource: doc.companySource || '',
    interestedModules: doc.interestedModules || [],
    initialNotes: doc.initialNotes || '',
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : null,
    followUps: mapFollowUps(doc.followUps),
    remarks: mapRemarks(doc.remarks),
  };
}

function computeStats(companies, docs) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const followUpsToday = docs.filter((doc) => {
    if (!doc.nextFollowUpAt) return false;
    if (normalizeStatus(doc.status) === 'closed') return false;
    const dt = new Date(doc.nextFollowUpAt);
    return dt >= today && dt < tomorrow;
  }).length;

  const active = companies.filter((c) => c.status === 'active').length;
  const inactive = companies.filter((c) => c.status === 'inactive').length;
  const onHold = companies.filter((c) => c.status === 'on_hold').length;
  const closed = companies.filter((c) => c.status === 'closed').length;

  return { total: companies.length, active, inactive, onHold, closed, followUpsToday };
}

async function getCollection() {
  const db = await getDb();
  const collection = db.collection(HQ_CRM_COMPANIES_COLLECTION);
  if (!indexesEnsured) {
    try {
      await collection.createIndex({ createdAt: -1 });
      await collection.createIndex({ status: 1 });
      indexesEnsured = true;
    } catch {
      // Best-effort index creation.
    }
  }
  return collection;
}

function getStorageInfo() {
  const url = env.HEADQUARTERS_DATABASE_URL || '';
  let databaseName = 'headquarters';
  try {
    if (url) databaseName = new URL(url).pathname.replace(/^\//, '') || databaseName;
  } catch {
    // Keep default.
  }
  return {
    engine: 'MongoDB',
    database: databaseName,
    collection: HQ_CRM_COMPANIES_COLLECTION,
  };
}

function parseNextFollowUpAt(raw) {
  const value = String(raw || '').trim();
  if (!value) throw new Error('Next follow-up date and time is required');
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) throw new Error('Invalid next follow-up date and time');
  return dt;
}

function parseCompanyInput(data) {
  const companyName = String(data?.companyName || '').trim();
  const primaryContactName = String(data?.primaryContactName || '').trim();
  const email = String(data?.email || '').trim().toLowerCase();
  const industry = String(data?.industry || '').trim();
  const country = String(data?.country || '').trim();
  const accountOwner = String(data?.accountOwner || '').trim();
  const companySource = String(data?.companySource || '').trim();
  const expectedUsers = Number(data?.expectedUsers) || 0;
  const estimatedDealValue = Number(data?.estimatedDealValue) || 0;
  const interestedModules = Array.isArray(data?.interestedModules)
    ? data.interestedModules.map((item) => String(item).trim()).filter(Boolean)
    : [];

  if (!companyName || !primaryContactName || !email) {
    throw new Error('Company name, primary contact, and email are required');
  }
  if (!industry || !country || !expectedUsers || !estimatedDealValue) {
    throw new Error('Industry, country, expected users, and deal value are required');
  }
  if (!accountOwner || !companySource) {
    throw new Error('Account owner and company source are required');
  }
  if (interestedModules.length === 0) {
    throw new Error('Select at least one interested module');
  }

  const status = normalizeStatus(String(data?.status || 'active').trim());
  if (!VALID_STATUSES.includes(status)) {
    throw new Error('Invalid company status');
  }

  return {
    companyName,
    primaryContactName,
    email,
    phone: String(data?.phone || '').trim(),
    website: String(data?.website || '').trim(),
    industry,
    country,
    expectedUsers,
    estimatedDealValue,
    accountOwner,
    companySource,
    interestedModules,
    initialNotes: String(data?.initialNotes || '').trim(),
    status,
    score: inferScore(estimatedDealValue, expectedUsers),
    nextFollowUpAt: parseNextFollowUpAt(data?.nextFollowUpAt),
  };
}

export const hqCompaniesService = {
  getStorageInfo,

  async listCompanies() {
    const collection = await getCollection();
    const docs = await collection.find({}).sort({ createdAt: -1 }).toArray();
    const companies = docs.map(toCompanyRow);
    return {
      companies,
      stats: computeStats(companies, docs),
      storage: getStorageInfo(),
    };
  },

  async createCompany(data, reqUser) {
    const parsed = parseCompanyInput({ ...data, status: data?.status || 'active' });
    const doc = {
      ...parsed,
      followUps: [],
      remarks: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      createdByEmail: reqUser?.email || null,
    };
    const collection = await getCollection();
    const result = await collection.insertOne(doc);
    const inserted = await collection.findOne({ _id: result.insertedId });
    return { company: toCompanyRow(inserted), storage: getStorageInfo() };
  },

  async getCompanyById(id) {
    if (!ObjectId.isValid(id)) throw new Error('Invalid company id');
    const collection = await getCollection();
    const doc = await collection.findOne({ _id: new ObjectId(id) });
    if (!doc) throw new Error('Company not found');
    return toCompanyRow(doc);
  },

  async createFromLead(leadDoc, leadId, reqUser) {
    const collection = await getCollection();
    const existing = await collection.findOne({ convertedFromLeadId: leadId });
    if (existing) {
      return { company: toCompanyRow(existing), alreadyExisted: true };
    }

    const nextFollowUpAt =
      leadDoc.nextFollowUpAt instanceof Date
        ? leadDoc.nextFollowUpAt
        : leadDoc.nextFollowUpAt
          ? new Date(leadDoc.nextFollowUpAt)
          : new Date();

    if (Number.isNaN(nextFollowUpAt.getTime())) {
      throw new Error('Lead has an invalid next follow-up date');
    }

    const interestedModules = Array.isArray(leadDoc.interestedModules)
      ? leadDoc.interestedModules.map((item) => String(item).trim()).filter(Boolean)
      : [];

    const doc = {
      companyName: String(leadDoc.companyName || '').trim(),
      primaryContactName: String(leadDoc.contactName || '').trim(),
      email: String(leadDoc.email || '').trim().toLowerCase(),
      phone: String(leadDoc.phone || '').trim(),
      website: '',
      industry: String(leadDoc.industry || '').trim(),
      country: String(leadDoc.country || '').trim(),
      expectedUsers: Number(leadDoc.expectedUsers) || 0,
      estimatedDealValue: Number(leadDoc.estimatedDealValue) || 0,
      accountOwner: String(leadDoc.leadOwner || '').trim(),
      companySource: String(leadDoc.leadSource || '').trim(),
      interestedModules,
      initialNotes: String(leadDoc.initialNotes || '').trim(),
      status: 'active',
      score: leadDoc.score || inferScore(leadDoc.estimatedDealValue ?? 0, leadDoc.expectedUsers ?? 0),
      nextFollowUpAt,
      followUps: [],
      remarks: [],
      companyTag: 'converted_lead',
      convertedFromLeadId: leadId,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdByEmail: reqUser?.email || null,
    };

    if (!doc.companyName || !doc.primaryContactName || !doc.email) {
      throw new Error('Lead is missing required fields to convert to company');
    }
    if (!doc.industry || !doc.country || !doc.expectedUsers || !doc.estimatedDealValue) {
      throw new Error('Lead is missing required fields to convert to company');
    }
    if (!doc.accountOwner || !doc.companySource) {
      throw new Error('Lead is missing required fields to convert to company');
    }
    if (doc.interestedModules.length === 0) {
      throw new Error('Lead must have at least one interested module to convert');
    }

    const result = await collection.insertOne(doc);
    const inserted = await collection.findOne({ _id: result.insertedId });
    return { company: toCompanyRow(inserted), alreadyExisted: false };
  },

  async updateCompany(id, data, reqUser) {
    if (!ObjectId.isValid(id)) throw new Error('Invalid company id');
    const collection = await getCollection();
    const objectId = new ObjectId(id);
    const existing = await collection.findOne({ _id: objectId });
    if (!existing) throw new Error('Company not found');

    const parsed = parseCompanyInput({ ...data, status: data?.status || existing.status || 'active' });
    await collection.updateOne(
      { _id: objectId },
      {
        $set: {
          ...parsed,
          updatedAt: new Date(),
          updatedByEmail: reqUser?.email || null,
        },
      }
    );
    const updated = await collection.findOne({ _id: objectId });
    return { company: toCompanyRow(updated), storage: getStorageInfo() };
  },

  async addFollowUp(id, data, reqUser) {
    if (!ObjectId.isValid(id)) throw new Error('Invalid company id');
    const type = String(data?.type || 'Call').trim();
    const notes = String(data?.notes || '').trim();
    const scheduledAt = parseNextFollowUpAt(data?.scheduledAt);
    const collection = await getCollection();
    const objectId = new ObjectId(id);
    const existing = await collection.findOne({ _id: objectId });
    if (!existing) throw new Error('Company not found');

    const followUp = {
      id: new ObjectId().toString(),
      type: FOLLOW_UP_TYPES.includes(type) ? type : 'Call',
      scheduledAt,
      notes,
      status: 'scheduled',
      createdAt: new Date(),
      createdByEmail: reqUser?.email || null,
    };

    await collection.updateOne(
      { _id: objectId },
      {
        $push: { followUps: followUp },
        $set: {
          nextFollowUpAt: scheduledAt,
          updatedAt: new Date(),
          updatedByEmail: reqUser?.email || null,
        },
      }
    );
    const updated = await collection.findOne({ _id: objectId });
    return { company: toCompanyRow(updated), storage: getStorageInfo() };
  },

  async updateFollowUp(id, followUpId, data, reqUser) {
    if (!ObjectId.isValid(id)) throw new Error('Invalid company id');
    const collection = await getCollection();
    const objectId = new ObjectId(id);
    const existing = await collection.findOne({ _id: objectId });
    if (!existing) throw new Error('Company not found');

    const followUps = Array.isArray(existing.followUps) ? [...existing.followUps] : [];
    const index = findFollowUpIndex(followUps, followUpId);
    if (index === -1) throw new Error('Follow-up not found');

    const current = followUps[index];
    const type = String(data?.type || current.type || 'Call').trim();
    const notes = String(data?.notes ?? current.notes ?? '').trim();
    const scheduledAt = parseNextFollowUpAt(data?.scheduledAt ?? current.scheduledAt);

    followUps[index] = {
      ...current,
      type: FOLLOW_UP_TYPES.includes(type) ? type : 'Call',
      scheduledAt,
      notes,
      updatedAt: new Date(),
      updatedByEmail: reqUser?.email || null,
    };

    const nextFollowUpAt = recomputeNextFollowUpAt(followUps);
    await collection.updateOne(
      { _id: objectId },
      {
        $set: {
          followUps,
          ...(nextFollowUpAt ? { nextFollowUpAt } : {}),
          updatedAt: new Date(),
          updatedByEmail: reqUser?.email || null,
        },
      }
    );

    const updated = await collection.findOne({ _id: objectId });
    return { company: toCompanyRow(updated), storage: getStorageInfo() };
  },

  async completeFollowUp(id, followUpId, reqUser) {
    if (!ObjectId.isValid(id)) throw new Error('Invalid company id');
    const collection = await getCollection();
    const objectId = new ObjectId(id);
    const existing = await collection.findOne({ _id: objectId });
    if (!existing) throw new Error('Company not found');

    const followUps = Array.isArray(existing.followUps) ? [...existing.followUps] : [];
    const index = findFollowUpIndex(followUps, followUpId);
    if (index === -1) throw new Error('Follow-up not found');
    if (String(followUps[index]?.status || '') === 'completed') {
      throw new Error('Follow-up is already completed');
    }

    followUps[index] = {
      ...followUps[index],
      status: 'completed',
      completedAt: new Date(),
      completedByEmail: reqUser?.email || null,
      updatedAt: new Date(),
      updatedByEmail: reqUser?.email || null,
    };

    const nextFollowUpAt = recomputeNextFollowUpAt(followUps);
    await collection.updateOne(
      { _id: objectId },
      {
        $set: {
          followUps,
          ...(nextFollowUpAt ? { nextFollowUpAt } : {}),
          updatedAt: new Date(),
          updatedByEmail: reqUser?.email || null,
        },
      }
    );

    const updated = await collection.findOne({ _id: objectId });
    return { company: toCompanyRow(updated), storage: getStorageInfo() };
  },

  async deleteFollowUp(id, followUpId, reqUser) {
    if (!ObjectId.isValid(id)) throw new Error('Invalid company id');
    const collection = await getCollection();
    const objectId = new ObjectId(id);
    const existing = await collection.findOne({ _id: objectId });
    if (!existing) throw new Error('Company not found');

    const followUps = (Array.isArray(existing.followUps) ? existing.followUps : []).filter(
      (item) => String(item?.id || '') !== String(followUpId || '')
    );
    if (followUps.length === (existing.followUps || []).length) {
      throw new Error('Follow-up not found');
    }

    const nextFollowUpAt = recomputeNextFollowUpAt(followUps);
    await collection.updateOne(
      { _id: objectId },
      {
        $set: {
          followUps,
          ...(nextFollowUpAt ? { nextFollowUpAt } : {}),
          updatedAt: new Date(),
          updatedByEmail: reqUser?.email || null,
        },
      }
    );

    const updated = await collection.findOne({ _id: objectId });
    return { company: toCompanyRow(updated), storage: getStorageInfo() };
  },

  async addRemark(id, data, reqUser) {
    if (!ObjectId.isValid(id)) throw new Error('Invalid company id');
    const text = String(data?.text || '').trim();
    if (!text) throw new Error('Remark text is required');
    const collection = await getCollection();
    const objectId = new ObjectId(id);
    const existing = await collection.findOne({ _id: objectId });
    if (!existing) throw new Error('Company not found');

    const remark = {
      id: new ObjectId().toString(),
      text,
      createdAt: new Date(),
      createdByEmail: reqUser?.email || null,
    };

    await collection.updateOne(
      { _id: objectId },
      {
        $push: { remarks: remark },
        $set: { updatedAt: new Date(), updatedByEmail: reqUser?.email || null },
      }
    );
    const updated = await collection.findOne({ _id: objectId });
    return { company: toCompanyRow(updated), storage: getStorageInfo() };
  },
};
