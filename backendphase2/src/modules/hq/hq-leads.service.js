import { MongoClient, ObjectId } from 'mongodb';
import { env } from '../../config/env.js';
import { hqCompaniesService } from './hq-companies.service.js';
import {
  findFollowUpIndex,
  findNextPendingFollowUpIndex,
  isNextFollowUpToken,
  recomputeNextFollowUpAt,
  withFollowUpIds,
} from './hq-follow-up.helpers.js';

const HQ_CRM_LEADS_COLLECTION = 'hq_crm_leads';
const HQ_CRM_TEAM_MEMBERS_COLLECTION = 'hq_crm_team_members';
const VALID_STAGES = ['new', 'demo', 'trial', 'contacted', 'qualified', 'converted', 'lost'];
const FOLLOW_UP_TYPES = ['Call', 'Email', 'Meeting', 'WhatsApp', 'Other'];
const HQ_PRODUCT_LINES = ['crm', 'recruitment'];

function parseHqProductLines(data) {
  const fromArray = Array.isArray(data?.hqProductLines)
    ? data.hqProductLines
    : Array.isArray(data?.hqProductLine)
      ? data.hqProductLine
      : String(data?.hqProductLine || '')
          .split(/[,|]/)
          .map((item) => String(item || '').trim());
  const lines = [...new Set(
    fromArray
      .map((item) => String(item || '').trim().toLowerCase())
      .filter((item) => HQ_PRODUCT_LINES.includes(item))
  )];
  if (lines.length) return lines;
  const modules = Array.isArray(data?.interestedModules)
    ? data.interestedModules.map((item) => String(item).toLowerCase())
    : [];
  const fromModules = [];
  if (modules.includes('crm')) fromModules.push('crm');
  if (modules.includes('recruitment')) fromModules.push('recruitment');
  return fromModules;
}
const EMPLOYER_DEMO_LEAD_SOURCE = 'Website form fill up';

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
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function toIsoDateOrNull(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function withNextFollowUpAtWrite(baseSet, nextFollowUpAt) {
  if (nextFollowUpAt) {
    return { $set: { ...baseSet, nextFollowUpAt } };
  }
  return { $set: baseSet, $unset: { nextFollowUpAt: '' } };
}

function normalizeStage(stage, convertedToCompanyId) {
  if (convertedToCompanyId) return 'converted';
  const legacyMap = {
    demo_scheduled: 'demo',
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
  const nextFollowUpAt = toIsoDateOrNull(doc.nextFollowUpAt);
  const nextFollowUp =
    stage === 'converted' || stage === 'lost' || !nextFollowUpAt
      ? ''
      : formatFollowUpDate(doc.nextFollowUpAt);

  return {
    id: doc._id.toString(),
    name: doc.contactName || doc.contactPerson || doc.directorName || '',
    company: doc.companyName,
    industry: doc.industry || '',
    score: doc.score || 'Cold',
    users: doc.expectedUsers ?? 0,
    owner: doc.leadOwner || '',
    stage,
    nextFollowUp,
    nextFollowUpAt,
    email: doc.email || '',
    phone: doc.phone || '',
    country: doc.country || '',
    state: doc.state || '',
    city: doc.city || '',
    estimatedDealValue: doc.estimatedDealValue ?? 0,
    leadSource: doc.leadSource || doc.source || '',
    leadSourceDetail: doc.leadSourceDetail || '',
    interestedModules: doc.interestedModules || [],
    initialNotes: doc.initialNotes || doc.notes || '',
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : null,
    followUps: mapFollowUps(doc.followUps),
    remarks: mapRemarks(doc.remarks),
    convertedToCompanyId: doc.convertedToCompanyId || null,
    contactPerson: doc.contactPerson || doc.contactName || doc.directorName || '',
    directorName: doc.directorName || doc.contactPerson || doc.contactName || '',
    directorSalutation: doc.directorSalutation || null,
    emails: Array.isArray(doc.emails) ? doc.emails : doc.email ? [doc.email] : [],
    phones: Array.isArray(doc.phones) ? doc.phones : doc.phone ? [doc.phone] : [],
    type: doc.type || 'Company',
    source: doc.source || doc.leadSource || null,
    status: doc.status || HQ_LEAD_STAGE_LABELS[stage] || 'New',
    priority: doc.priority || 'Medium',
    website: doc.website || null,
    companyLinks: Array.isArray(doc.companyLinks) ? doc.companyLinks : [],
    linkedIn: doc.linkedIn || null,
    location: doc.location || null,
    designation: doc.designation || null,
    latitude: typeof doc.latitude === 'number' ? doc.latitude : null,
    longitude: typeof doc.longitude === 'number' ? doc.longitude : null,
    campaignName: doc.campaignName || null,
    campaignLink: doc.campaignLink || null,
    referralName: doc.referralName || null,
    sourceWebsiteUrl: doc.sourceWebsiteUrl || null,
    sourceLinkedInUrl: doc.sourceLinkedInUrl || null,
    sourceEmail: doc.sourceEmail || null,
    teamMemberDesignation: doc.teamMemberDesignation || null,
    teamMemberEmail: doc.teamMemberEmail || null,
    teamMemberPhone: doc.teamMemberPhone || null,
    otherDetails: Array.isArray(doc.otherDetails) ? doc.otherDetails : [],
    interestedNeeds: doc.interestedNeeds || null,
    servicesNeeded: doc.servicesNeeded || null,
    expectedBusinessValue: doc.expectedBusinessValue || null,
    notes: doc.notes || doc.initialNotes || null,
    assignedToId: doc.assignedToId || null,
    assignedToIds: Array.isArray(doc.assignedToIds) ? doc.assignedToIds : [],
    assignedToUsers: Array.isArray(doc.assignedToUsers) ? doc.assignedToUsers : [],
    formSchema: doc.formSchema || null,
    hqProductLine: Array.isArray(doc.hqProductLines) && doc.hqProductLines.length
      ? doc.hqProductLines.join(',')
      : doc.hqProductLine || null,
    hqProductLines: Array.isArray(doc.hqProductLines)
      ? doc.hqProductLines
      : parseHqProductLines({ hqProductLine: doc.hqProductLine, interestedModules: doc.interestedModules }),
    employerDemoRequestId: doc.employerDemoRequestId || null,
    preferredDemoDate: doc.preferredDemoDate || null,
    preferredDemoTime: doc.preferredDemoTime || null,
  };
}

function mapFollowUps(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      id: String(item?.id || item?._id || ''),
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

function parseOptionalNextFollowUpAt(raw) {
  const value = String(raw || '').trim();
  if (!value || value === '—' || value === '-' || value.toLowerCase() === 'n/a') return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) {
    throw new Error('Invalid next follow-up date and time');
  }
  return dt;
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
  return 50;
}

function parseDemoSlotFromOutcome(outcome) {
  const tagged = String(outcome || '').match(/\[demo-slot:([^|\]\s]+)\|([^\]]+)\]/i);
  if (tagged) {
    return { date: String(tagged[1] || '').trim(), time: String(tagged[2] || '').trim() };
  }
  return null;
}

function demoSlotToDate(dateIso, timeLabel) {
  if (!dateIso) return null;
  const match = String(timeLabel || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  let hours = 9;
  let minutes = 0;
  if (match) {
    hours = Number(match[1]);
    minutes = Number(match[2]);
    const meridiem = String(match[3] || '').toUpperCase();
    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
  }
  const [y, m, d] = String(dateIso).split('-').map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d, hours, minutes, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function buildEmployerDemoLeadFields(demo) {
  const requestId = String(demo?.requestId || '').trim();
  const contactName = String(demo?.fullName || '').trim();
  const companyName = String(demo?.organizationName || '').trim();
  const email = String(demo?.email || '').trim().toLowerCase();
  const dialCode = String(demo?.dialCode || '').trim();
  const phoneNumber = String(demo?.phoneNumber || '').trim();
  const phone = [dialCode, phoneNumber].filter(Boolean).join(' ');
  const country = String(demo?.countryCode || '').trim();
  const companySize = String(demo?.companySize || '').trim();
  const outcome = String(demo?.outcome || '').trim();
  const requestKind = String(demo?.requestKind || 'demo').toLowerCase();
  const isPurchase = requestKind === 'purchase';
  const isTrial = requestKind === 'trial';
  const emailVerified = Boolean(demo?.emailVerified);
  const slot = parseDemoSlotFromOutcome(outcome);
  const scheduledAt = slot ? demoSlotToDate(slot.date, slot.time) : null;
  const expectedUsers = companySizeToExpectedUsers(companySize);
  const estimatedDealValue = Math.max(expectedUsers * 25, 500);

  const initialNotes = [
    slot?.date && slot?.time ? `Booked demo: ${slot.date} at ${slot.time}` : '',
    outcome ? `Outcome: ${outcome}` : '',
    companySize ? `Company size: ${companySize}` : '',
    demo?.organizationType
      ? `Workspace type: ${
          String(demo.organizationType).toLowerCase() === 'standalone' ? 'Standalone' : 'Agency'
        }`
      : '',
    requestKind ? `Request kind: ${requestKind}` : '',
    emailVerified ? 'Email verified: yes' : 'Email verified: pending',
    requestId ? `Employer demo request: ${requestId}` : '',
    isPurchase ? 'Source: Employer landing page — paid plan signup' : '',
  ]
    .filter(Boolean)
    .join('\n');

  let stage = 'new';
  if (isPurchase) stage = 'demo';
  else if (requestKind === 'demo' || (slot?.date && slot?.time)) stage = 'demo';
  else if (isTrial) stage = 'new';

  const nextFollowUpAt =
    scheduledAt ||
    (() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d;
    })();

  return {
    contactName,
    companyName,
    email,
    phone,
    industry: 'Employer / HR Tech',
    country,
    expectedUsers,
    estimatedDealValue,
    leadSource: EMPLOYER_DEMO_LEAD_SOURCE,
    leadSourceDetail: isPurchase
      ? 'Employer landing page — paid plan'
      : isTrial
        ? 'Employer try-free form'
        : slot?.date
          ? 'Employer request demo — scheduled'
          : 'Employer request demo form',
    interestedModules: ['Recruitment'],
    initialNotes,
    stage,
    score: inferScore(estimatedDealValue, expectedUsers),
    nextFollowUpAt,
    employerDemoRequestId: requestId || null,
    preferredDemoDate: slot?.date || null,
    preferredDemoTime: slot?.time || null,
  };
}

const HQ_LEAD_STAGE_LABELS = {
  new: 'New',
  demo: 'Demo',
  trial: 'Trial',
  contacted: 'Contacted',
  qualified: 'Qualified',
  converted: 'Converted',
  lost: 'Lost',
};

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

/**
 * Resolve HQ team assignees from headquarters Mongo (never tenant users).
 * Stores ids + display snapshot so list/detail work without a join.
 */
async function resolveHqAssignees(data) {
  const rawIds = [
    ...(Array.isArray(data?.assignedToIds) ? data.assignedToIds : []),
    data?.assignedToId,
  ]
    .map((id) => String(id || '').trim())
    .filter(Boolean);
  const ids = [...new Set(rawIds)];
  const fallbackName = firstNonEmpty(data?.assignedToName, data?.leadOwner);

  if (!ids.length) {
    return {
      assignedToId: null,
      assignedToIds: [],
      assignedToUsers: [],
      leadOwner: fallbackName || '',
    };
  }

  const db = await getDb();
  const collection = db.collection(HQ_CRM_TEAM_MEMBERS_COLLECTION);
  const objectIds = ids.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
  const docs =
    objectIds.length > 0
      ? await collection.find({ _id: { $in: objectIds } }).toArray()
      : [];
  const byId = new Map(docs.map((doc) => [doc._id.toString(), doc]));

  const assignedToUsers = ids.map((id) => {
    const doc = byId.get(id);
    if (!doc) {
      return {
        id,
        name: fallbackName || 'HQ Member',
        email: '',
        role: '',
        roleId: null,
      };
    }
    const name =
      String(doc.name || '').trim() ||
      [doc.firstName, doc.lastName].filter(Boolean).join(' ').trim() ||
      String(doc.email || '').trim() ||
      'HQ Member';
    return {
      id,
      name,
      email: doc.email || '',
      role: doc.role || '',
      roleId: doc.roleId ? String(doc.roleId) : null,
    };
  });

  return {
    assignedToId: ids[0],
    assignedToIds: ids,
    assignedToUsers,
    leadOwner: assignedToUsers.map((u) => u.name).filter(Boolean).join(', ') || fallbackName || '',
  };
}

function mapPhase2StatusToStage(status) {
  const s = String(status || '').trim().toLowerCase();
  if (!s) return 'new';
  if (s.includes('convert') || s.includes('won') || s === 'client') return 'converted';
  if (s.includes('lost') || s.includes('reject')) return 'lost';
  if (s.includes('demo')) return 'demo';
  if (s.includes('trial')) return 'trial';
  if (s.includes('qualif') || s.includes('propos') || s.includes('negot')) return 'qualified';
  if (s.includes('contact') || s.includes('progress') || s.includes('follow')) return 'contacted';
  return 'new';
}

function mapSourceDetail(data) {
  const source = String(data?.source || data?.leadSource || '').trim();
  if (data?.leadSourceDetail) return String(data.leadSourceDetail).trim();
  if (source === 'Website') return String(data?.sourceWebsiteUrl || '').trim();
  if (source === 'LinkedIn') return String(data?.sourceLinkedInUrl || '').trim();
  if (source === 'Email') return String(data?.sourceEmail || '').trim();
  if (source === 'Referral') return String(data?.referralName || '').trim();
  if (source === 'Campaign') {
    return [data?.campaignName, data?.campaignLink].filter(Boolean).map(String).join(' — ').trim();
  }
  return '';
}

function parseMoneyLike(value) {
  if (value == null) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const cleaned = String(value).replace(/[^0-9.\-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Accepts both legacy HQ create payload and Phase 2 CreateLeadData.
 * Stores Phase 2 fields in headquarters Mongo so HQ Add Lead matches /leads.
 */
function parseLeadInput(data) {
  const isPhase2Shape = Boolean(
    data?.contactPerson ||
      data?.directorName ||
      data?.source ||
      data?.status ||
      data?.emails ||
      data?.phones ||
      data?.state ||
      data?.followUpSchedule,
  );

  const contactName = firstNonEmpty(data?.contactName, data?.contactPerson, data?.directorName);
  const companyName = String(data?.companyName || '').trim();
  const email = primaryFromList(data?.emails, data?.email).toLowerCase();
  const phone = primaryFromList(data?.phones, data?.phone);
  const industry = firstNonEmpty(data?.industry, data?.sector);
  const country = String(data?.country || '').trim();
  const state = String(data?.state || '').trim();
  const city = String(data?.city || '').trim();
  const leadSource = firstNonEmpty(data?.leadSource, data?.source) || 'Website';
  const leadSourceDetail = mapSourceDetail(data);
  const expectedUsers =
    Number(data?.expectedUsers) || companySizeToExpectedUsers(data?.companySize) || 0;
  const estimatedDealValue =
    Number(data?.estimatedDealValue) ||
    parseMoneyLike(data?.expectedBusinessValue) ||
    parseMoneyLike(data?.notes) ||
    0;
  const interestedModules = Array.isArray(data?.interestedModules)
    ? data.interestedModules.map((item) => String(item).trim()).filter(Boolean)
    : String(data?.interestedNeeds || data?.servicesNeeded || '')
        .split(/[,|\n]/)
        .map((item) => item.trim())
        .filter(Boolean);

  if (!contactName || !companyName) {
    throw new Error('Contact name and company name are required');
  }
  if (!country) {
    throw new Error('Country is required');
  }
  if (isPhase2Shape && !state) {
    throw new Error('State is required');
  }
  if (!email && !phone) {
    throw new Error('Email or phone is required');
  }

  // Legacy HQ modal still sends stage + stricter commercial fields
  if (!isPhase2Shape) {
    if (!industry || !expectedUsers || !estimatedDealValue) {
      throw new Error('Industry, expected users, and deal value are required');
    }
    if (!leadSource) {
      throw new Error('Lead source is required');
    }
    if (interestedModules.length === 0) {
      throw new Error('Select at least one interested module');
    }
  }

  const stage = isPhase2Shape
    ? mapPhase2StatusToStage(data?.status || data?.stage)
    : normalizeStage(String(data?.stage || 'new').trim(), null);
  if (!VALID_STAGES.includes(stage)) {
    throw new Error('Invalid lead stage');
  }

  const nextFollowUpAt = parseOptionalNextFollowUpAt(
    data?.nextFollowUpAt || data?.nextFollowUp || null,
  );

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
    contactName,
    companyName,
    email,
    phone,
    industry,
    country,
    state,
    city,
    expectedUsers,
    estimatedDealValue,
    leadOwner: firstNonEmpty(data?.leadOwner, data?.assignedToName, data?.assignedToId),
    leadSource,
    leadSourceDetail,
    interestedModules,
    initialNotes: firstNonEmpty(
      data?.initialNotes,
      data?.interestedNeeds,
      data?.servicesNeeded,
      data?.notes,
    ),
    stage,
    score: data?.score || inferScore(estimatedDealValue, expectedUsers),
    nextFollowUpAt,
    contactPerson: contactName,
    directorName: contactName,
    directorSalutation: String(data?.directorSalutation || '').trim() || null,
    emails,
    phones,
    type: data?.type || 'Company',
    source: leadSource,
    status: firstNonEmpty(data?.status, HQ_LEAD_STAGE_LABELS[stage], stage),
    priority: data?.priority || 'Medium',
    website: String(data?.website || '').trim() || null,
    companyLinks: Array.isArray(data?.companyLinks) ? data.companyLinks : [],
    linkedIn: String(data?.linkedIn || '').trim() || null,
    location: String(data?.location || '').trim() || null,
    designation: String(data?.designation || '').trim() || null,
    latitude: typeof data?.latitude === 'number' ? data.latitude : null,
    longitude: typeof data?.longitude === 'number' ? data.longitude : null,
    campaignName: String(data?.campaignName || '').trim() || null,
    campaignLink: String(data?.campaignLink || '').trim() || null,
    referralName: String(data?.referralName || '').trim() || null,
    sourceWebsiteUrl: String(data?.sourceWebsiteUrl || '').trim() || null,
    sourceLinkedInUrl: String(data?.sourceLinkedInUrl || '').trim() || null,
    sourceEmail: String(data?.sourceEmail || '').trim() || null,
    teamMemberDesignation: String(data?.teamMemberDesignation || '').trim() || null,
    teamMemberEmail: String(data?.teamMemberEmail || '').trim() || null,
    teamMemberPhone: String(data?.teamMemberPhone || '').trim() || null,
    otherDetails: Array.isArray(data?.otherDetails) ? data.otherDetails : [],
    interestedNeeds: String(data?.interestedNeeds || data?.servicesNeeded || '').trim() || null,
    servicesNeeded: String(data?.servicesNeeded || data?.interestedNeeds || '').trim() || null,
    expectedBusinessValue: String(data?.expectedBusinessValue || data?.notes || '').trim() || null,
    notes: String(data?.notes || '').trim() || null,
    followUpSchedule: data?.followUpSchedule || null,
    assignedToId: data?.assignedToId || null,
    assignedToIds: Array.isArray(data?.assignedToIds) ? data.assignedToIds : [],
    formSchema: isPhase2Shape ? 'phase2' : 'hq-legacy',
    hqProductLines: parseHqProductLines(data),
    hqProductLine: (() => {
      const lines = parseHqProductLines(data);
      if (!lines.length) return null;
      return lines.join(',');
    })(),
  };
}

export const hqLeadsService = {
  getStorageInfo,
  toLeadRow,

  async getLeadDocument(id) {
    if (!ObjectId.isValid(id)) {
      const err = new Error('Invalid lead id');
      err.statusCode = 400;
      throw err;
    }
    const collection = await getCollection();
    const doc = await collection.findOne({ _id: new ObjectId(id) });
    if (!doc) {
      const err = new Error('Lead not found');
      err.statusCode = 404;
      throw err;
    }
    return doc;
  },

  async markTrialGranted(id, data, reqUser) {
    const collection = await getCollection();
    const objectId = new ObjectId(id);
    const existing = await collection.findOne({ _id: objectId });
    if (!existing) {
      const err = new Error('Lead not found');
      err.statusCode = 404;
      throw err;
    }
    const note = String(data?.note || '').trim();
    const remarks = Array.isArray(existing.remarks) ? [...existing.remarks] : [];
    if (note) {
      remarks.push({
        id: new ObjectId().toString(),
        text: note,
        createdAt: new Date(),
        createdByEmail: reqUser?.email || null,
      });
    }
    await collection.updateOne(
      { _id: objectId },
      {
        $set: {
          stage: 'trial',
          status: 'Trial',
          trialDays: data?.trialDays || null,
          trialStartsAt: data?.trialStartsAt || null,
          trialEndsAt: data?.trialEndsAt || null,
          trialLoginId: data?.trialLoginId || null,
          trialLoginUrl: data?.trialLoginUrl || null,
          trialTenantDbName: data?.trialTenantDbName || null,
          trialEmail: data?.trialEmail || null,
          trialGrantedAt: new Date(),
          remarks,
          updatedAt: new Date(),
          updatedByEmail: reqUser?.email || null,
        },
      },
    );
    const updated = await collection.findOne({ _id: objectId });
    return {
      lead: toLeadRow(updated),
      storage: getStorageInfo(),
    };
  },

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

  async createLeadFromEmployerDemoRequest(demo) {
    const fields = buildEmployerDemoLeadFields(demo);
    const { contactName, companyName, email, employerDemoRequestId: requestId } = fields;

    if (!contactName || !companyName || !email) {
      throw new Error('Demo request is missing contact name, company name, or email');
    }

    const collection = await getCollection();

    if (requestId) {
      const existing = await collection.findOne({ employerDemoRequestId: requestId });
      if (existing) {
        await collection.updateOne(
          { _id: existing._id },
          {
            $set: {
              ...fields,
              leadOwner: existing.leadOwner || '',
              followUps: existing.followUps || [],
              remarks: existing.remarks || [],
              createdAt: existing.createdAt || new Date(),
              createdByEmail: existing.createdByEmail || null,
              updatedAt: new Date(),
            },
          },
        );
        const updated = await collection.findOne({ _id: existing._id });
        return {
          lead: toLeadRow(updated),
          created: false,
          storage: getStorageInfo(),
        };
      }
    }

    const doc = {
      ...fields,
      leadOwner: '',
      followUps: [],
      remarks: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      createdByEmail: null,
    };

    const result = await collection.insertOne(doc);
    const inserted = await collection.findOne({ _id: result.insertedId });

    return {
      lead: toLeadRow(inserted),
      created: true,
      storage: getStorageInfo(),
    };
  },

  async createLead(data, reqUser) {
    const parsed = parseLeadInput({ ...data, stage: data?.stage || 'new' });
    const assignees = await resolveHqAssignees({
      ...data,
      assignedToId: parsed.assignedToId,
      assignedToIds: parsed.assignedToIds,
      assignedToName: data?.assignedToName,
      leadOwner: parsed.leadOwner,
    });

    const doc = {
      ...parsed,
      ...assignees,
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

    // Status/stage inline updates (from HQ leads table) often send only a partial payload.
    // `parseLeadInput` enforces required fields for the "phase2 shape", so we merge the
    // existing document to keep those validations satisfied.
    const parsed = parseLeadInput({ ...existing, ...data, stage: data?.stage || existing.stage || 'new' });
    const assignees = await resolveHqAssignees({
      assignedToId:
        data?.assignedToId !== undefined ? data.assignedToId : existing.assignedToId,
      assignedToIds:
        data?.assignedToIds !== undefined ? data.assignedToIds : existing.assignedToIds,
      assignedToName: data?.assignedToName,
      leadOwner: data?.leadOwner ?? parsed.leadOwner ?? existing.leadOwner,
    });

    const { stage: _ignoredStage, ...rest } = parsed;
    await collection.updateOne(
      { _id: objectId },
      {
        $set: {
          ...rest,
          ...assignees,
          stage: parsed.stage,
          updatedAt: new Date(),
          updatedByEmail: reqUser?.email || null,
        },
      },
    );

    const updated = await collection.findOne({ _id: objectId });
    return {
      lead: toLeadRow(updated),
      storage: getStorageInfo(),
    };
  },

  async deleteLead(id) {
    if (!ObjectId.isValid(id)) {
      throw new Error('Invalid lead id');
    }

    const collection = await getCollection();
    const objectId = new ObjectId(id);
    const result = await collection.deleteOne({ _id: objectId });
    if (!result.deletedCount) {
      throw new Error('Lead not found');
    }

    return {
      deleted: true,
      id,
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

  async updateFollowUp(id, followUpId, data, reqUser) {
    if (!ObjectId.isValid(id)) throw new Error('Invalid lead id');
    const collection = await getCollection();
    const objectId = new ObjectId(id);
    const existing = await collection.findOne({ _id: objectId });
    if (!existing) throw new Error('Lead not found');

    const followUps = withFollowUpIds(Array.isArray(existing.followUps) ? [...existing.followUps] : []);
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
      withNextFollowUpAtWrite(
        {
          followUps,
          updatedAt: new Date(),
          updatedByEmail: reqUser?.email || null,
        },
        nextFollowUpAt
      )
    );

    const updated = await collection.findOne({ _id: objectId });
    return { lead: toLeadRow(updated), storage: getStorageInfo() };
  },

  async completeFollowUp(id, followUpId, reqUser, extra = {}) {
    if (!ObjectId.isValid(id)) throw new Error('Invalid lead id');
    const collection = await getCollection();
    const objectId = new ObjectId(id);
    const existing = await collection.findOne({ _id: objectId });
    if (!existing) throw new Error('Lead not found');

    const remark = String(extra?.notes || extra?.remark || extra?.text || '').trim();
    const followUps = withFollowUpIds(Array.isArray(existing.followUps) ? [...existing.followUps] : []);
    let index = isNextFollowUpToken(followUpId) ? -1 : findFollowUpIndex(followUps, followUpId);
    if (index === -1) {
      index = findNextPendingFollowUpIndex(followUps);
    }
    if (index === -1) {
      const fallbackAt = existing.nextFollowUpAt || extra?.scheduledAt || extra?.scheduled_at;
      if (!fallbackAt) throw new Error('Follow-up not found');
      const type = String(extra?.type || extra?.followUpType || 'Meeting').trim();
      followUps.push({
        id: new ObjectId().toString(),
        type: FOLLOW_UP_TYPES.includes(type) ? type : 'Meeting',
        scheduledAt: fallbackAt instanceof Date ? fallbackAt : new Date(fallbackAt),
        notes: remark,
        status: 'scheduled',
        createdAt: new Date(),
        createdByEmail: reqUser?.email || null,
      });
      index = followUps.length - 1;
    }
    if (String(followUps[index]?.status || '').toLowerCase() === 'completed') {
      throw new Error('Follow-up is already completed');
    }

    followUps[index] = {
      ...followUps[index],
      id: String(followUps[index]?.id || new ObjectId().toString()),
      status: 'completed',
      notes: remark || followUps[index].notes || '',
      completedAt: new Date(),
      completedByEmail: reqUser?.email || null,
      updatedAt: new Date(),
      updatedByEmail: reqUser?.email || null,
    };

    const nextFollowUpAt = recomputeNextFollowUpAt(followUps);
    await collection.updateOne(
      { _id: objectId },
      withNextFollowUpAtWrite(
        {
          followUps,
          updatedAt: new Date(),
          updatedByEmail: reqUser?.email || null,
        },
        nextFollowUpAt
      )
    );

    const updated = await collection.findOne({ _id: objectId });
    return { lead: toLeadRow(updated), storage: getStorageInfo() };
  },

  async deleteFollowUp(id, followUpId, reqUser) {
    if (!ObjectId.isValid(id)) throw new Error('Invalid lead id');
    const collection = await getCollection();
    const objectId = new ObjectId(id);
    const existing = await collection.findOne({ _id: objectId });
    if (!existing) throw new Error('Lead not found');

    const existingFollowUps = withFollowUpIds(Array.isArray(existing.followUps) ? existing.followUps : []);
    const followUps = existingFollowUps.filter((item) => {
      const id = String(item?.id || '');
      const oid = item?._id != null ? String(item._id) : '';
      return id !== String(followUpId || '') && oid !== String(followUpId || '');
    });
    if (followUps.length === existingFollowUps.length) {
      throw new Error('Follow-up not found');
    }

    const nextFollowUpAt = recomputeNextFollowUpAt(followUps);
    await collection.updateOne(
      { _id: objectId },
      withNextFollowUpAtWrite(
        {
          followUps,
          updatedAt: new Date(),
          updatedByEmail: reqUser?.email || null,
        },
        nextFollowUpAt
      )
    );

    const updated = await collection.findOne({ _id: objectId });
    return { lead: toLeadRow(updated), storage: getStorageInfo() };
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
