import { MongoClient, ObjectId } from 'mongodb';
import { env } from '../../config/env.js';

const HQ_SUPPORT_TICKETS_COLLECTION = 'hq_support_tickets';
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const VALID_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const VALID_CATEGORIES = ['general', 'billing', 'technical', 'account', 'feature'];

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
  const collection = db.collection(HQ_SUPPORT_TICKETS_COLLECTION);
  if (!indexesEnsured) {
    await collection.createIndexes([
      { key: { createdAt: -1 } },
      { key: { status: 1, createdAt: -1 } },
      { key: { tenantDbName: 1, createdAt: -1 } },
      { key: { raisedByUserId: 1, createdAt: -1 } },
    ]);
    indexesEnsured = true;
  }
  return collection;
}

function normalizePriority(value) {
  const priority = String(value || 'medium').trim().toLowerCase();
  return VALID_PRIORITIES.includes(priority) ? priority : 'medium';
}

function normalizeStatus(value) {
  const status = String(value || 'open').trim().toLowerCase();
  return VALID_STATUSES.includes(status) ? status : 'open';
}

function normalizeCategory(value) {
  const category = String(value || 'general').trim().toLowerCase();
  return VALID_CATEGORIES.includes(category) ? category : 'general';
}

function mapTicket(doc) {
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    subject: doc.subject || '',
    description: doc.description || '',
    priority: normalizePriority(doc.priority),
    status: normalizeStatus(doc.status),
    category: normalizeCategory(doc.category),
    tenantDbName: doc.tenantDbName || '',
    organizationName: doc.organizationName || '',
    raisedByUserId: doc.raisedByUserId || '',
    raisedByName: doc.raisedByName || '',
    raisedByEmail: doc.raisedByEmail || '',
    hqNotes: doc.hqNotes || '',
    createdAt:
      doc.createdAt instanceof Date
        ? doc.createdAt.toISOString()
        : doc.createdAt
          ? new Date(doc.createdAt).toISOString()
          : null,
    updatedAt:
      doc.updatedAt instanceof Date
        ? doc.updatedAt.toISOString()
        : doc.updatedAt
          ? new Date(doc.updatedAt).toISOString()
          : null,
  };
}

function buildStats(tickets) {
  return {
    total: tickets.length,
    open: tickets.filter((t) => t.status === 'open').length,
    inProgress: tickets.filter((t) => t.status === 'in_progress').length,
    resolved: tickets.filter((t) => t.status === 'resolved').length,
    closed: tickets.filter((t) => t.status === 'closed').length,
    highPriority: tickets.filter((t) => t.priority === 'high' || t.priority === 'urgent').length,
  };
}

export const hqTicketsService = {
  async createTicket(data, actor = {}) {
    const subject = String(data?.subject || '').trim();
    const description = String(data?.description || '').trim();
    if (!subject) throw new Error('Subject is required');
    if (!description) throw new Error('Description is required');

    const now = new Date();
    const doc = {
      subject: subject.slice(0, 200),
      description: description.slice(0, 5000),
      priority: normalizePriority(data?.priority),
      status: 'open',
      category: normalizeCategory(data?.category),
      tenantDbName: String(data?.tenantDbName || actor?.tenantDbName || '').trim(),
      organizationName: String(data?.organizationName || '').trim(),
      raisedByUserId: String(actor?.id || data?.raisedByUserId || '').trim(),
      raisedByName: String(actor?.name || data?.raisedByName || '').trim(),
      raisedByEmail: String(actor?.email || data?.raisedByEmail || '').trim().toLowerCase(),
      hqNotes: '',
      createdAt: now,
      updatedAt: now,
    };

    const collection = await getCollection();
    const result = await collection.insertOne(doc);
    return mapTicket({ ...doc, _id: result.insertedId });
  },

  async listTickets(filters = {}) {
    const collection = await getCollection();
    const query = {};
    if (filters.status) query.status = normalizeStatus(filters.status);
    if (filters.priority) query.priority = normalizePriority(filters.priority);
    if (filters.tenantDbName) query.tenantDbName = String(filters.tenantDbName).trim();
    if (filters.raisedByUserId) query.raisedByUserId = String(filters.raisedByUserId).trim();

    const docs = await collection.find(query).sort({ createdAt: -1 }).limit(500).toArray();
    const tickets = docs.map(mapTicket).filter(Boolean);
    return {
      tickets,
      stats: buildStats(tickets),
    };
  },

  async listTicketsForUser(userId) {
    if (!userId) return { tickets: [], stats: buildStats([]) };
    return this.listTickets({ raisedByUserId: userId });
  },

  async updateTicket(id, data = {}, actor = {}) {
    if (!ObjectId.isValid(id)) throw new Error('Invalid ticket id');
    const collection = await getCollection();
    const update = { updatedAt: new Date() };

    if (data.status !== undefined) update.status = normalizeStatus(data.status);
    if (data.priority !== undefined) update.priority = normalizePriority(data.priority);
    if (data.hqNotes !== undefined) update.hqNotes = String(data.hqNotes || '').trim().slice(0, 2000);
    if (data.category !== undefined) update.category = normalizeCategory(data.category);

    update.updatedByEmail = String(actor?.email || '').trim().toLowerCase() || null;

    const doc = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: update },
      { returnDocument: 'after' },
    );

    if (!doc) throw new Error('Ticket not found');
    return mapTicket(doc);
  },

  async getTicket(id) {
    if (!ObjectId.isValid(id)) throw new Error('Invalid ticket id');
    const collection = await getCollection();
    const doc = await collection.findOne({ _id: new ObjectId(id) });
    if (!doc) throw new Error('Ticket not found');
    return mapTicket(doc);
  },
};
