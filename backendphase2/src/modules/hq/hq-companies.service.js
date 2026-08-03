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
    contact: doc.primaryContactName || doc.directorName || '',
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
    state: doc.state || '',
    city: doc.city || '',
    estimatedDealValue: doc.estimatedDealValue ?? 0,
    pricePerUser: doc.pricePerUser ?? null,
    billingCycle: doc.billingCycle || null,
    finalPrice: doc.finalPrice ?? doc.estimatedDealValue ?? 0,
    companySource: doc.companySource || '',
    interestedModules: doc.interestedModules || [],
    initialNotes: doc.initialNotes || '',
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : null,
    followUps: mapFollowUps(doc.followUps),
    remarks: mapRemarks(doc.remarks),
    directorName: doc.directorName || doc.primaryContactName || '',
    directorSalutation: doc.directorSalutation || null,
    emails: Array.isArray(doc.emails) ? doc.emails : doc.email ? [doc.email] : [],
    phones: Array.isArray(doc.phones) ? doc.phones : doc.phone ? [doc.phone] : [],
    companySize: doc.companySize || '',
    location: doc.location || '',
    hiringLocations: doc.hiringLocations || '',
    servicesNeeded: doc.servicesNeeded || '',
    expectedBusinessValue: doc.expectedBusinessValue || String(doc.estimatedDealValue || ''),
    linkedin: doc.linkedin || '',
    timezone: doc.timezone || '',
    priority: doc.priority || '',
    sla: doc.sla || '',
    leadStatus: doc.leadStatus || '',
    latitude: typeof doc.latitude === 'number' ? doc.latitude : null,
    longitude: typeof doc.longitude === 'number' ? doc.longitude : null,
    teamMemberDesignation: doc.teamMemberDesignation || null,
    teamMemberEmail: doc.teamMemberEmail || null,
    teamMemberPhone: doc.teamMemberPhone || null,
    otherDetails: Array.isArray(doc.otherDetails) ? doc.otherDetails : [],
    assignedToId: doc.assignedToId || null,
    formSchema: doc.formSchema || null,
    convertedFromLeadId: doc.convertedFromLeadId ? String(doc.convertedFromLeadId) : null,
    companyTag: doc.companyTag || null,
    hqProductLine: doc.hqProductLine || null,
    tenantDbName: doc.tenantDbName || null,
    tenantAdminEmail: doc.tenantAdminEmail || null,
    tenantProvisionedAt:
      doc.tenantProvisionedAt instanceof Date ? doc.tenantProvisionedAt.toISOString() : null,
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

function parseOptionalNextFollowUpAt(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) throw new Error('Invalid next follow-up date and time');
  return dt;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
}

function primaryFromList(list, fallback) {
  if (Array.isArray(list)) {
    for (const item of list) {
      const text = String(item ?? '').trim();
      if (text) return text;
    }
  }
  return String(fallback || '').trim();
}

function parseMoneyLike(value) {
  if (value == null) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const cleaned = String(value).replace(/[^0-9.\-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function companySizeToExpectedUsers(companySize) {
  const size = String(companySize || '').toLowerCase();
  if (size.includes('1–10') || size.includes('1-10')) return 5;
  if (size.includes('11–50') || size.includes('11-50')) return 30;
  if (size.includes('51–200') || size.includes('51-200')) return 100;
  if (size.includes('201–500') || size.includes('201-500')) return 350;
  if (size.includes('501–1,000') || size.includes('501-1,000') || size.includes('501–1000')) {
    return 750;
  }
  if (size.includes('1,000+') || size.includes('1000+')) return 1500;
  return 0;
}

function mapClientStatusToHq(status, leadStatus) {
  const s = String(status || leadStatus || '').trim().toLowerCase();
  if (!s) return 'active';
  if (s.includes('inactive')) return 'inactive';
  if (s.includes('hold')) return 'on_hold';
  if (s.includes('closed') || s.includes('churn')) return 'closed';
  if (s === 'prospect' || s === 'active' || s.includes('hot') || s.includes('active')) return 'active';
  return normalizeStatus(s);
}

function extractDirectorName(data) {
  const fromField = firstNonEmpty(
    data?.primaryContactName,
    data?.directorName,
    data?.contactPerson,
    data?.contact,
  );
  if (fromField) return fromField;
  if (Array.isArray(data?.otherDetails)) {
    for (const row of data.otherDetails) {
      const label = String(row?.label || '').toLowerCase();
      if (label.includes('director') && row?.value) return String(row.value).trim();
    }
  }
  return '';
}

/**
 * Accepts legacy HQ company payload and Phase 2 CreateClientData.
 */
function parseCompanyInput(data) {
  const isPhase2Shape = Boolean(
    data?.directorName ||
      data?.leadStatus ||
      data?.servicesNeeded ||
      data?.expectedBusinessValue ||
      data?.emails ||
      data?.phones ||
      data?.state ||
      data?.hiringLocations ||
      data?.formSchema === 'phase2',
  );

  const companyName = String(data?.companyName || '').trim();
  const primaryContactName = extractDirectorName(data);
  const email = primaryFromList(data?.emails, data?.email).toLowerCase();
  const phone = primaryFromList(data?.phones, data?.phone);
  const industry = String(data?.industry || '').trim();
  const country = String(data?.country || '').trim();
  const accountOwner = firstNonEmpty(data?.accountOwner, data?.assignedToId, data?.owner) || '';
  const companySource = firstNonEmpty(data?.companySource, data?.source, 'Phase 2 Client Form') || 'Phase 2 Client Form';
  const expectedUsers =
    Number(data?.expectedUsers) || companySizeToExpectedUsers(data?.companySize) || 0;
  const pricePerUser = Math.max(0, Number(data?.pricePerUser) || 0);
  const billingCycleRaw = String(data?.billingCycle || '').trim().toLowerCase();
  const billingCycle =
    billingCycleRaw === 'yearly' || billingCycleRaw === 'annual' ? 'yearly' : billingCycleRaw === 'monthly' ? 'monthly' : null;
  const finalPriceParsed = Number(data?.finalPrice);
  const estimatedDealValue =
    Number(data?.estimatedDealValue) ||
    (Number.isFinite(finalPriceParsed) && finalPriceParsed > 0 ? finalPriceParsed : 0) ||
    (pricePerUser > 0 && expectedUsers > 0 ? Math.round(expectedUsers * pricePerUser * 100) / 100 : 0) ||
    parseMoneyLike(data?.expectedBusinessValue) ||
    0;
  const interestedModules = Array.isArray(data?.interestedModules)
    ? data.interestedModules.map((item) => String(item).trim()).filter(Boolean)
    : String(data?.servicesNeeded || '')
        .split(/[,|\n]/)
        .map((item) => item.trim())
        .filter(Boolean);

  if (!companyName) {
    throw new Error('Company name is required');
  }
  if (!primaryContactName && !email) {
    throw new Error('Primary contact name or email is required');
  }

  if (!isPhase2Shape) {
    if (!primaryContactName || !email) {
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
  }

  const status = isPhase2Shape
    ? mapClientStatusToHq(data?.status, data?.leadStatus)
    : normalizeStatus(String(data?.status || 'active').trim());
  if (!VALID_STATUSES.includes(status)) {
    throw new Error('Invalid company status');
  }

  const nextFollowUpAt = isPhase2Shape
    ? parseOptionalNextFollowUpAt(data?.nextFollowUpAt || data?.nextFollowUpDue || null)
    : parseNextFollowUpAt(data?.nextFollowUpAt);

  const emails = Array.isArray(data?.emails)
    ? data.emails.map((item) => String(item).trim()).filter(Boolean)
    : email
      ? [email]
      : [];
  const phones = Array.isArray(data?.phones)
    ? data.phones.map((item) => String(item).trim()).filter(Boolean)
    : phone
      ? [phone]
      : [];

  return {
    companyName,
    primaryContactName: primaryContactName || email || 'Contact',
    email,
    phone,
    website: String(data?.website || '').trim(),
    industry,
    country,
    state: String(data?.state || '').trim(),
    city: String(data?.city || '').trim(),
    expectedUsers,
    estimatedDealValue,
    pricePerUser: pricePerUser > 0 ? pricePerUser : null,
    billingCycle,
    finalPrice: estimatedDealValue || null,
    accountOwner,
    companySource,
    interestedModules,
    initialNotes: firstNonEmpty(data?.initialNotes, data?.servicesNeeded, data?.notes),
    status,
    score: data?.score || inferScore(estimatedDealValue, expectedUsers),
    nextFollowUpAt,
    // Phase 2 client parity fields
    directorName: primaryContactName || null,
    directorSalutation: String(data?.directorSalutation || '').trim() || null,
    emails,
    phones,
    companySize: String(data?.companySize || '').trim() || null,
    location: String(data?.location || '').trim() || null,
    hiringLocations: String(data?.hiringLocations || '').trim() || null,
    servicesNeeded: String(data?.servicesNeeded || '').trim() || null,
    expectedBusinessValue: String(data?.expectedBusinessValue || '').trim() || null,
    linkedin: String(data?.linkedin || '').trim() || null,
    timezone: String(data?.timezone || '').trim() || null,
    priority: String(data?.priority || '').trim() || null,
    sla: String(data?.sla || '').trim() || null,
    leadStatus: String(data?.leadStatus || '').trim() || null,
    latitude: typeof data?.latitude === 'number' ? data.latitude : null,
    longitude: typeof data?.longitude === 'number' ? data.longitude : null,
    teamMemberDesignation: String(data?.teamMemberDesignation || '').trim() || null,
    teamMemberEmail: String(data?.teamMemberEmail || '').trim() || null,
    teamMemberPhone: String(data?.teamMemberPhone || '').trim() || null,
    otherDetails: Array.isArray(data?.otherDetails) ? data.otherDetails : [],
    assignedToId: data?.assignedToId || null,
    formSchema: isPhase2Shape ? 'phase2' : 'hq-legacy',
    hqProductLine: (() => {
      const raw = String(data?.hqProductLine || '').trim().toLowerCase();
      if (raw === 'crm' || raw === 'recruitment') return raw;
      const modules = Array.isArray(data?.interestedModules)
        ? data.interestedModules.map((m) => String(m).toLowerCase())
        : [];
      if (modules.includes('recruitment')) return 'recruitment';
      if (modules.includes('crm')) return 'crm';
      return null;
    })(),
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

    const isPhase2 =
      leadDoc.formSchema === 'phase2' ||
      Boolean(leadDoc.contactPerson || leadDoc.directorName || leadDoc.source || leadDoc.status);

    const companyName = String(leadDoc.companyName || '').trim();
    const primaryContactName = firstNonEmpty(
      leadDoc.contactName,
      leadDoc.contactPerson,
      leadDoc.directorName,
      leadDoc.primaryContactName,
    );
    const email = primaryFromList(leadDoc.emails, leadDoc.email).toLowerCase();
    const phone = primaryFromList(leadDoc.phones, leadDoc.phone);
    const industry = String(leadDoc.industry || '').trim();
    const country = String(leadDoc.country || '').trim();
    const expectedUsers =
      Number(leadDoc.expectedUsers) || companySizeToExpectedUsers(leadDoc.companySize) || 0;
    const estimatedDealValue =
      Number(leadDoc.estimatedDealValue) ||
      parseMoneyLike(leadDoc.expectedBusinessValue) ||
      0;
    const interestedModules = Array.isArray(leadDoc.interestedModules)
      ? leadDoc.interestedModules.map((item) => String(item).trim()).filter(Boolean)
      : String(leadDoc.interestedNeeds || leadDoc.servicesNeeded || '')
          .split(/[,|\n]/)
          .map((item) => item.trim())
          .filter(Boolean);

    if (!companyName) {
      throw new Error('Lead is missing company name — cannot convert to client/company');
    }
    if (!primaryContactName && !email) {
      throw new Error('Lead needs a contact name or email to convert to client/company');
    }

    // Legacy HQ leads keep stricter commercial checks; Phase 2 CRM leads are looser.
    if (!isPhase2) {
      if (!primaryContactName || !email) {
        throw new Error('Lead is missing required fields to convert to company');
      }
      if (!industry || !country || !expectedUsers || !estimatedDealValue) {
        throw new Error('Lead is missing required fields to convert to company');
      }
      if (!leadDoc.leadOwner || !(leadDoc.leadSource || leadDoc.source)) {
        throw new Error('Lead is missing required fields to convert to company');
      }
      if (interestedModules.length === 0) {
        throw new Error('Lead must have at least one interested module to convert');
      }
    }

    let nextFollowUpAt =
      leadDoc.nextFollowUpAt instanceof Date
        ? leadDoc.nextFollowUpAt
        : leadDoc.nextFollowUpAt
          ? new Date(leadDoc.nextFollowUpAt)
          : null;
    if (!nextFollowUpAt || Number.isNaN(nextFollowUpAt.getTime())) {
      nextFollowUpAt = new Date();
      nextFollowUpAt.setDate(nextFollowUpAt.getDate() + 7);
      nextFollowUpAt.setHours(9, 0, 0, 0);
    }

    const emails = Array.isArray(leadDoc.emails)
      ? leadDoc.emails.map((item) => String(item).trim()).filter(Boolean)
      : email
        ? [email]
        : [];
    const phones = Array.isArray(leadDoc.phones)
      ? leadDoc.phones.map((item) => String(item).trim()).filter(Boolean)
      : phone
        ? [phone]
        : [];

    const doc = {
      companyName,
      primaryContactName: primaryContactName || email || 'Contact',
      email,
      phone,
      website: String(leadDoc.website || '').trim(),
      industry,
      country,
      state: String(leadDoc.state || '').trim(),
      city: String(leadDoc.city || '').trim(),
      expectedUsers,
      estimatedDealValue,
      accountOwner: firstNonEmpty(leadDoc.leadOwner, leadDoc.assignedToId) || '',
      companySource: firstNonEmpty(leadDoc.leadSource, leadDoc.source, 'Converted Lead') || 'Converted Lead',
      interestedModules,
      initialNotes: firstNonEmpty(
        leadDoc.initialNotes,
        leadDoc.notes,
        leadDoc.interestedNeeds,
        leadDoc.servicesNeeded,
      ),
      status: 'active',
      score: leadDoc.score || inferScore(estimatedDealValue, expectedUsers),
      nextFollowUpAt,
      followUps: [],
      remarks: [],
      companyTag: 'converted_lead',
      convertedFromLeadId: leadId,
      // Phase 2 client parity — same record powers /hq/clients and /hq/company
      directorName: primaryContactName || null,
      directorSalutation: leadDoc.directorSalutation || null,
      emails,
      phones,
      companySize: String(leadDoc.companySize || '').trim() || null,
      location: String(leadDoc.location || '').trim() || null,
      hiringLocations: String(leadDoc.hiringLocations || '').trim() || null,
      servicesNeeded: firstNonEmpty(leadDoc.servicesNeeded, leadDoc.interestedNeeds) || null,
      expectedBusinessValue:
        firstNonEmpty(leadDoc.expectedBusinessValue, String(estimatedDealValue || '')) || null,
      linkedin: String(leadDoc.linkedIn || leadDoc.linkedin || '').trim() || null,
      timezone: String(leadDoc.timezone || '').trim() || null,
      priority: String(leadDoc.priority || '').trim() || null,
      sla: null,
      leadStatus: 'Active',
      latitude: typeof leadDoc.latitude === 'number' ? leadDoc.latitude : null,
      longitude: typeof leadDoc.longitude === 'number' ? leadDoc.longitude : null,
      teamMemberDesignation: leadDoc.teamMemberDesignation || null,
      teamMemberEmail: leadDoc.teamMemberEmail || null,
      teamMemberPhone: leadDoc.teamMemberPhone || null,
      otherDetails: Array.isArray(leadDoc.otherDetails) ? leadDoc.otherDetails : [],
      assignedToId: leadDoc.assignedToId || null,
      formSchema: isPhase2 ? 'phase2' : leadDoc.formSchema || 'hq-legacy',
      hqProductLine: (() => {
        const raw = String(leadDoc.hqProductLine || '').trim().toLowerCase();
        if (raw === 'crm' || raw === 'recruitment') return raw;
        if (interestedModules.map((m) => m.toLowerCase()).includes('recruitment')) return 'recruitment';
        if (interestedModules.map((m) => m.toLowerCase()).includes('crm')) return 'crm';
        return null;
      })(),
      createdAt: new Date(),
      updatedAt: new Date(),
      createdByEmail: reqUser?.email || null,
    };

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

  /**
   * Link an HQ company to a provisioned tenant workspace (Lead → Client → Company → Tenant).
   */
  async linkTenant(id, data, reqUser) {
    if (!ObjectId.isValid(id)) throw new Error('Invalid company id');
    const tenantDbName = String(data?.tenantDbName || '').trim();
    if (!tenantDbName) throw new Error('tenantDbName is required');

    const collection = await getCollection();
    const objectId = new ObjectId(id);
    const existing = await collection.findOne({ _id: objectId });
    if (!existing) throw new Error('Company not found');
    if (existing.tenantDbName && existing.tenantDbName !== tenantDbName) {
      throw new Error('This company is already linked to another tenant');
    }

    await collection.updateOne(
      { _id: objectId },
      {
        $set: {
          tenantDbName,
          tenantAdminEmail: String(data?.tenantAdminEmail || '').trim().toLowerCase() || null,
          tenantProvisionedAt: new Date(),
          updatedAt: new Date(),
          updatedByEmail: reqUser?.email || null,
        },
      },
    );
    const updated = await collection.findOne({ _id: objectId });
    return { company: toCompanyRow(updated), storage: getStorageInfo() };
  },

  async deleteCompany(id) {
    if (!ObjectId.isValid(id)) throw new Error('Invalid company id');
    const collection = await getCollection();
    const objectId = new ObjectId(id);
    const result = await collection.deleteOne({ _id: objectId });
    if (!result.deletedCount) throw new Error('Company not found');
    return { deleted: true, id, storage: getStorageInfo() };
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
