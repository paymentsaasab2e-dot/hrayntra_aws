import { MongoClient, ObjectId } from 'mongodb';
import { env } from '../../config/env.js';

const HQ_SUPPORT_TICKETS_COLLECTION = 'hq_support_tickets';
const HQ_SUPPORT_TICKET_MESSAGES_COLLECTION = 'hq_support_ticket_messages';
const HQ_COUNTERS_COLLECTION = 'hq_counters';
const TICKET_NUMBER_MIN = 10000;
const TICKET_NUMBER_MAX = 99999;
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const VALID_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const VALID_CATEGORIES = ['general', 'billing', 'technical', 'account', 'feature'];

let cachedClient = null;
let indexesEnsured = false;
let messageIndexesEnsured = false;

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
      { key: { ticketNumber: 1 }, unique: true, sparse: true },
    ]);
    indexesEnsured = true;
  }
  return collection;
}

async function getMessagesCollection() {
  const db = await getDb();
  const collection = db.collection(HQ_SUPPORT_TICKET_MESSAGES_COLLECTION);
  if (!messageIndexesEnsured) {
    await collection.createIndexes([
      { key: { ticketId: 1, createdAt: 1 } },
      { key: { createdAt: -1 } },
    ]);
    messageIndexesEnsured = true;
  }
  return collection;
}

function isFiveDigitTicketId(id) {
  return /^\d{5}$/.test(String(id || '').trim());
}

function isMongoObjectId(id) {
  const value = String(id || '').trim();
  return ObjectId.isValid(value) && String(new ObjectId(value)) === value;
}

function publicTicketId(doc) {
  if (!doc) return '';
  if (isFiveDigitTicketId(doc.ticketNumber)) return String(doc.ticketNumber);
  return doc._id ? doc._id.toString() : '';
}

async function nextTicketNumber() {
  const db = await getDb();
  const counters = db.collection(HQ_COUNTERS_COLLECTION);
  await counters.updateOne(
    { _id: 'support_ticket_number' },
    { $max: { seq: TICKET_NUMBER_MIN - 1 } },
    { upsert: true },
  );
  const result = await counters.findOneAndUpdate(
    { _id: 'support_ticket_number' },
    { $inc: { seq: 1 } },
    { returnDocument: 'after' },
  );
  const seq = Number(result?.seq || result?.value?.seq || 0);
  if (!seq || seq > TICKET_NUMBER_MAX) {
    throw new Error('Ticket ID range exhausted');
  }
  return String(seq).padStart(5, '0');
}

async function findTicketDoc(id) {
  const value = String(id || '').trim();
  if (!value) throw new Error('Invalid ticket id');
  const collection = await getCollection();
  if (isFiveDigitTicketId(value)) {
    const byNumber = await collection.findOne({ ticketNumber: value });
    if (byNumber) return byNumber;
  }
  if (isMongoObjectId(value)) {
    const byOid = await collection.findOne({ _id: new ObjectId(value) });
    if (byOid) return byOid;
  }
  throw new Error('Ticket not found');
}

function mapMessage(doc) {
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    ticketId: doc.ticketId || '',
    senderRole: doc.senderRole === 'hq' ? 'hq' : 'employer',
    senderName: doc.senderName || '',
    senderId: doc.senderId || null,
    body: doc.body || '',
    createdAt:
      doc.createdAt instanceof Date
        ? doc.createdAt.toISOString()
        : doc.createdAt
          ? new Date(doc.createdAt).toISOString()
          : null,
  };
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
  const id = publicTicketId(doc);
  return {
    id,
    ticketNumber: isFiveDigitTicketId(doc.ticketNumber) ? String(doc.ticketNumber) : id,
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
    const collection = await getCollection();
    let lastError = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const ticketNumber = await nextTicketNumber();
      const doc = {
        ticketNumber,
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
      try {
        const result = await collection.insertOne(doc);
        return mapTicket({ ...doc, _id: result.insertedId });
      } catch (error) {
        lastError = error;
        if (error?.code !== 11000) throw error;
      }
    }
    throw lastError || new Error('Unable to generate ticket ID');
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
    const existing = await findTicketDoc(id);
    const collection = await getCollection();
    const update = { updatedAt: new Date() };

    if (data.status !== undefined) update.status = normalizeStatus(data.status);
    if (data.priority !== undefined) update.priority = normalizePriority(data.priority);
    if (data.hqNotes !== undefined) update.hqNotes = String(data.hqNotes || '').trim().slice(0, 2000);
    if (data.category !== undefined) update.category = normalizeCategory(data.category);

    update.updatedByEmail = String(actor?.email || '').trim().toLowerCase() || null;

    const doc = await collection.findOneAndUpdate(
      { _id: existing._id },
      { $set: update },
      { returnDocument: 'after' },
    );

    if (!doc) throw new Error('Ticket not found');
    return mapTicket(doc);
  },

  async getTicket(id) {
    const doc = await findTicketDoc(id);
    return mapTicket(doc);
  },

  async listMessages(ticketId, opts = {}) {
    const ticketDoc = await findTicketDoc(ticketId);
    const ticket = mapTicket(ticketDoc);
    const hq = Boolean(opts.hq);
    const userId = String(opts.userId || '').trim();
    if (!hq && ticket.raisedByUserId && ticket.raisedByUserId !== userId) {
      throw new Error('You can only view messages on your own tickets');
    }

    const publicId = ticket.id;
    const mongoId = ticketDoc._id.toString();
    const collection = await getMessagesCollection();
    const docs = await collection
      .find({ ticketId: { $in: [publicId, mongoId] } })
      .sort({ createdAt: 1 })
      .limit(500)
      .toArray();
    return {
      ticketId: publicId,
      subject: ticket.subject,
      status: ticket.status,
      messages: docs.map(mapMessage).filter(Boolean),
    };
  },

  async addMessage(ticketId, body, actor = {}, opts = {}) {
    const text = String(body || '').trim();
    if (!text) throw new Error('Message body is required');

    const ticketDoc = await findTicketDoc(ticketId);
    const ticket = mapTicket(ticketDoc);
    const hq = Boolean(opts.hq);
    const userId = String(actor?.id || actor?._id || '').trim();
    if (!hq && ticket.raisedByUserId && ticket.raisedByUserId !== userId) {
      throw new Error('You can only reply on your own tickets');
    }
    if (ticket.status === 'closed') {
      throw new Error('Chat is closed for completed tickets');
    }

    const senderRole = hq ? 'hq' : 'employer';
    const senderName =
      String(
        actor?.name ||
          actor?.fullName ||
          (hq ? 'HQ Support' : actor?.email || 'Entrepreneur'),
      ).trim() || (hq ? 'HQ Support' : 'Entrepreneur');

    const now = new Date();
    const doc = {
      ticketId: ticket.id,
      senderRole,
      senderName,
      senderId: userId || null,
      body: text.slice(0, 5000),
      createdAt: now,
    };

    const collection = await getMessagesCollection();
    const result = await collection.insertOne(doc);
    return mapMessage({ ...doc, _id: result.insertedId });
  },
};
