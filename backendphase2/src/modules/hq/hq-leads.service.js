import { MongoClient } from 'mongodb';
import { env } from '../../config/env.js';

const HQ_CRM_LEADS_COLLECTION = 'hq_crm_leads';

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
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

function toLeadRow(doc) {
  const stage = doc.stage || 'new';
  const nextFollowUp =
    stage === 'closed_won' || stage === 'closed_lost'
      ? '—'
      : formatFollowUpDate(doc.nextFollowUpAt);

  return {
    id: doc._id.toString(),
    name: doc.contactName,
    company: doc.companyName,
    industry: doc.industry || '',
    score: doc.score || 'Cold',
    users: doc.expectedUsers ?? 0,
    owner: doc.leadOwner || '',
    stage,
    nextFollowUp,
    email: doc.email || '',
    phone: doc.phone || '',
    country: doc.country || '',
    estimatedDealValue: doc.estimatedDealValue ?? 0,
    leadSource: doc.leadSource || '',
    interestedModules: doc.interestedModules || [],
    initialNotes: doc.initialNotes || '',
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : null,
  };
}

function computeStats(leads, docs) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const followUpsToday = docs.filter((doc) => {
    if (!doc.nextFollowUpAt) return false;
    if (doc.stage === 'closed_won' || doc.stage === 'closed_lost') return false;
    const dt = new Date(doc.nextFollowUpAt);
    return dt >= today && dt < tomorrow;
  }).length;

  const newLeads = leads.filter((lead) => lead.stage === 'new').length;
  const won = leads.filter((lead) => lead.stage === 'closed_won').length;
  const lost = leads.filter((lead) => lead.stage === 'closed_lost').length;
  const winRate = leads.length ? Math.round((won / leads.length) * 100) : 0;

  return { total: leads.length, newLeads, followUpsToday, won, lost, winRate };
}

async function getCollection() {
  const db = await getDb();
  const collection = db.collection(HQ_CRM_LEADS_COLLECTION);

  if (!indexesEnsured) {
    try {
      await collection.createIndex({ createdAt: -1 });
      await collection.createIndex({ stage: 1 });
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
    if (url) {
      databaseName = new URL(url).pathname.replace(/^\//, '') || databaseName;
    }
  } catch {
    // Keep default database name.
  }

  return {
    engine: 'MongoDB',
    database: databaseName,
    collection: HQ_CRM_LEADS_COLLECTION,
  };
}

export const hqLeadsService = {
  getStorageInfo,

  async listLeads() {
    const collection = await getCollection();
    const docs = await collection.find({}).sort({ createdAt: -1 }).toArray();
    const leads = docs.map(toLeadRow);

    return {
      leads,
      stats: computeStats(leads, docs),
      storage: getStorageInfo(),
    };
  },

  async createLead(data, reqUser) {
    const contactName = String(data?.contactName || '').trim();
    const companyName = String(data?.companyName || '').trim();
    const email = String(data?.email || '').trim().toLowerCase();
    const industry = String(data?.industry || '').trim();
    const country = String(data?.country || '').trim();
    const leadOwner = String(data?.leadOwner || '').trim();
    const leadSource = String(data?.leadSource || '').trim();
    const expectedUsers = Number(data?.expectedUsers) || 0;
    const estimatedDealValue = Number(data?.estimatedDealValue) || 0;
    const interestedModules = Array.isArray(data?.interestedModules)
      ? data.interestedModules.map((item) => String(item).trim()).filter(Boolean)
      : [];

    if (!contactName || !companyName || !email) {
      throw new Error('Contact name, company name, and email are required');
    }
    if (!industry || !country || !expectedUsers || !estimatedDealValue) {
      throw new Error('Industry, country, expected users, and deal value are required');
    }
    if (!leadOwner || !leadSource) {
      throw new Error('Lead owner and lead source are required');
    }
    if (interestedModules.length === 0) {
      throw new Error('Select at least one interested module');
    }

    const nextFollowUpAt = new Date();
    nextFollowUpAt.setDate(nextFollowUpAt.getDate() + 7);

    const doc = {
      contactName,
      companyName,
      email,
      phone: String(data?.phone || '').trim(),
      industry,
      country,
      expectedUsers,
      estimatedDealValue,
      leadOwner,
      leadSource,
      interestedModules,
      initialNotes: String(data?.initialNotes || '').trim(),
      stage: 'new',
      score: inferScore(estimatedDealValue, expectedUsers),
      nextFollowUpAt,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdByEmail: reqUser?.email || null,
    };

    const collection = await getCollection();
    const result = await collection.insertOne(doc);
    const inserted = await collection.findOne({ _id: result.insertedId });

    return {
      lead: toLeadRow(inserted),
      storage: getStorageInfo(),
    };
  },
};
