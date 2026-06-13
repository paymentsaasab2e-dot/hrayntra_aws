import { MongoClient, ObjectId } from 'mongodb';
import { env } from '../../config/env.js';
import { hqCompaniesService } from './hq-companies.service.js';

const HQ_CRM_LEADS_COLLECTION = 'hq_crm_leads';
const VALID_STAGES = ['new', 'contacted', 'qualified', 'converted', 'lost'];
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
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function normalizeStage(stage, convertedToCompanyId) {
  if (convertedToCompanyId) return 'converted';
  const legacyMap = {
    demo_scheduled: 'qualified',
    proposal_sent: 'qualified',
    negotiation: 'qualified',
    closed_won: 'converted',
    closed_lost: 'lost',
  };
  const normalized = legacyMap[stage] || stage || 'new';
  return VALID_STAGES.includes(normalized) ? normalized : 'new';
}

function toLeadRow(doc) {
  const stage = normalizeStage(doc.stage, doc.convertedToCompanyId);
  const nextFollowUp =
    stage === 'converted' || stage === 'lost'
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
    nextFollowUpAt:
      doc.nextFollowUpAt instanceof Date ? doc.nextFollowUpAt.toISOString() : null,
    email: doc.email || '',
    phone: doc.phone || '',
    country: doc.country || '',
    estimatedDealValue: doc.estimatedDealValue ?? 0,
    leadSource: doc.leadSource || '',
    interestedModules: doc.interestedModules || [],
    initialNotes: doc.initialNotes || '',
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : null,
    followUps: mapFollowUps(doc.followUps),
    remarks: mapRemarks(doc.remarks),
    convertedToCompanyId: doc.convertedToCompanyId || null,
  };
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

function computeStats(leads, docs) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const followUpsToday = docs.filter((doc) => {
    if (!doc.nextFollowUpAt) return false;
    const stage = normalizeStage(doc.stage, doc.convertedToCompanyId);
    if (stage === 'converted' || stage === 'lost') return false;
    const dt = new Date(doc.nextFollowUpAt);
    return dt >= today && dt < tomorrow;
  }).length;

  const newLeads = leads.filter((lead) => lead.stage === 'new').length;
  const converted = leads.filter((lead) => lead.stage === 'converted').length;
  const lost = leads.filter((lead) => lead.stage === 'lost').length;
  const conversionRate = leads.length ? Math.round((converted / leads.length) * 100) : 0;

  return { total: leads.length, newLeads, followUpsToday, converted, lost, conversionRate };
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

function parseNextFollowUpAt(raw) {
  const value = String(raw || '').trim();
  if (!value) {
    throw new Error('Next follow-up date and time is required');
  }
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) {
    throw new Error('Invalid next follow-up date and time');
  }
  return dt;
}

function parseLeadInput(data) {
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

  const stage = normalizeStage(String(data?.stage || 'new').trim(), null);
  if (!VALID_STAGES.includes(stage)) {
    throw new Error('Invalid lead stage');
  }

  return {
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
    stage,
    score: inferScore(estimatedDealValue, expectedUsers),
    nextFollowUpAt: parseNextFollowUpAt(data?.nextFollowUpAt),
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
    const parsed = parseLeadInput({ ...data, stage: data?.stage || 'new' });

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

    return {
      lead: toLeadRow(inserted),
      storage: getStorageInfo(),
    };
  },

  async updateLead(id, data, reqUser) {
    if (!ObjectId.isValid(id)) {
      throw new Error('Invalid lead id');
    }

    const collection = await getCollection();
    const objectId = new ObjectId(id);
    const existing = await collection.findOne({ _id: objectId });
    if (!existing) {
      throw new Error('Lead not found');
    }

    const parsed = parseLeadInput({ ...data, stage: data?.stage || existing.stage || 'new' });

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

    return {
      lead: toLeadRow(updated),
      storage: getStorageInfo(),
    };
  },

  async addFollowUp(id, data, reqUser) {
    if (!ObjectId.isValid(id)) {
      throw new Error('Invalid lead id');
    }

    const type = String(data?.type || 'Call').trim();
    const notes = String(data?.notes || '').trim();
    const scheduledAt = parseNextFollowUpAt(data?.scheduledAt);

    const collection = await getCollection();
    const objectId = new ObjectId(id);
    const existing = await collection.findOne({ _id: objectId });
    if (!existing) {
      throw new Error('Lead not found');
    }

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
    return {
      lead: toLeadRow(updated),
      storage: getStorageInfo(),
    };
  },

  async addRemark(id, data, reqUser) {
    if (!ObjectId.isValid(id)) {
      throw new Error('Invalid lead id');
    }

    const text = String(data?.text || '').trim();
    if (!text) {
      throw new Error('Remark text is required');
    }

    const collection = await getCollection();
    const objectId = new ObjectId(id);
    const existing = await collection.findOne({ _id: objectId });
    if (!existing) {
      throw new Error('Lead not found');
    }

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
        $set: {
          updatedAt: new Date(),
          updatedByEmail: reqUser?.email || null,
        },
      }
    );

    const updated = await collection.findOne({ _id: objectId });
    return {
      lead: toLeadRow(updated),
      storage: getStorageInfo(),
    };
  },

  async convertToCompany(id, reqUser) {
    if (!ObjectId.isValid(id)) {
      throw new Error('Invalid lead id');
    }

    const collection = await getCollection();
    const objectId = new ObjectId(id);
    const lead = await collection.findOne({ _id: objectId });
    if (!lead) {
      throw new Error('Lead not found');
    }

    if (lead.convertedToCompanyId) {
      const company = await hqCompaniesService.getCompanyById(lead.convertedToCompanyId);
      return {
        company,
        lead: toLeadRow(lead),
        alreadyConverted: true,
        storage: getStorageInfo(),
      };
    }

    const { company, alreadyExisted } = await hqCompaniesService.createFromLead(lead, id, reqUser);

    await collection.updateOne(
      { _id: objectId },
      {
        $set: {
          convertedToCompanyId: company.id,
          stage: 'converted',
          updatedAt: new Date(),
          updatedByEmail: reqUser?.email || null,
        },
      }
    );

    const updatedLead = await collection.findOne({ _id: objectId });
    return {
      company,
      lead: toLeadRow(updatedLead),
      alreadyConverted: alreadyExisted,
      storage: getStorageInfo(),
    };
  },
};
