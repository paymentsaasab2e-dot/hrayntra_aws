/**
 * HQ Help-page tickets. Phase 1 `/api/hq-tickets` is synced into headquarters Mongo
 * (`hq_help_tickets`) so HQ status updates persist even if Phase 1 JSON is down.
 */

import { MongoClient } from 'mongodb';
import { env } from '../../config/env.js';

const HQ_HELP_TICKETS_COLLECTION = 'hq_help_tickets';
const VALID_STATUSES = new Set(['open', 'in_progress', 'closed']);

let cachedClient = null;
let indexesEnsured = false;

function phase1FrontendBase() {
  return String(
    process.env.PHASE1_FRONTEND_URL ||
      process.env.JOB_PORTAL_FRONTEND_URL ||
      process.env.NEXT_PUBLIC_PHASE1_FRONTEND_URL ||
      'http://localhost:3000',
  )
    .trim()
    .replace(/\/+$/, '');
}

async function getHqDb() {
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
  const db = await getHqDb();
  const collection = db.collection(HQ_HELP_TICKETS_COLLECTION);
  if (!indexesEnsured) {
    await collection.createIndexes([
      { key: { externalId: 1 }, unique: true },
      { key: { createdAt: -1 } },
      { key: { status: 1, createdAt: -1 } },
      { key: { email: 1, createdAt: -1 } },
    ]).catch(() => undefined);
    indexesEnsured = true;
  }
  return collection;
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = json?.error || json?.message || `Phase 1 tickets HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

function toIso(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function unwrapUpdated(result) {
  if (!result) return null;
  if (Object.prototype.hasOwnProperty.call(result, 'value')) return result.value || null;
  if (result.externalId || result._id) return result;
  return null;
}

function mapTicket(doc) {
  if (!doc) return null;
  const status = String(doc.status || 'open').trim().toLowerCase();
  return {
    id: String(doc.externalId || doc.id || doc._id || ''),
    subject: doc.subject || '',
    description: doc.description || '',
    name: doc.name || '',
    email: doc.email || '',
    category: doc.category || '',
    status: VALID_STATUSES.has(status) ? status : 'open',
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
    meta: doc.meta || undefined,
    priority: doc.priority || undefined,
    userId: doc.userId || null,
  };
}

function buildStats(tickets) {
  const list = Array.isArray(tickets) ? tickets : [];
  return {
    total: list.length,
    open: list.filter((t) => t.status === 'open').length,
    inProgress: list.filter((t) => t.status === 'in_progress').length,
    closed: list.filter((t) => t.status === 'closed').length,
  };
}

function ticketPayload(raw) {
  const id = String(raw?.id || raw?._id || '').trim();
  if (!id) return null;
  const status = String(raw.status || 'open').trim().toLowerCase();
  return {
    externalId: id,
    subject: String(raw.subject || '').trim(),
    description: String(raw.description || '').trim(),
    name: String(raw.name || '').trim(),
    email: String(raw.email || '').trim().toLowerCase(),
    category: String(raw.category || '').trim(),
    status: VALID_STATUSES.has(status) ? status : 'open',
    createdAt: raw.createdAt ? new Date(raw.createdAt) : new Date(),
    meta: raw.meta || null,
    priority: raw.priority || null,
    userId: raw.userId || null,
  };
}

async function upsertPhase1Tickets(rawTickets) {
  const collection = await getCollection();
  const payloads = (Array.isArray(rawTickets) ? rawTickets : []).map(ticketPayload).filter(Boolean);
  if (!payloads.length) return;

  const existing = await collection
    .find({ externalId: { $in: payloads.map((row) => row.externalId) } })
    .project({ externalId: 1, hqStatusOverride: 1 })
    .toArray();
  const overrideIds = new Set(existing.filter((row) => row.hqStatusOverride).map((row) => String(row.externalId)));
  const now = new Date();

  await collection.bulkWrite(
    payloads.map((row) => {
      const $set = {
        subject: row.subject,
        description: row.description,
        name: row.name,
        email: row.email,
        category: row.category,
        createdAt: row.createdAt,
        meta: row.meta,
        priority: row.priority,
        userId: row.userId,
        syncedAt: now,
        updatedAt: now,
      };
      if (!overrideIds.has(row.externalId)) $set.status = row.status;
      return {
        updateOne: {
          filter: { externalId: row.externalId },
          update: {
            $set,
            $setOnInsert: {
              externalId: row.externalId,
              hqStatusOverride: false,
              status: row.status,
            },
          },
          upsert: true,
        },
      };
    }),
    { ordered: false },
  );
}

async function syncFromPhase1(filters = {}) {
  const qs = new URLSearchParams();
  if (filters.status && VALID_STATUSES.has(String(filters.status))) {
    qs.set('status', String(filters.status));
  }
  if (filters.email) qs.set('email', String(filters.email).trim().toLowerCase());
  if (filters.id) qs.set('id', String(filters.id).trim());
  const limit = Math.min(200, Math.max(1, Number(filters.limit) || 100));
  qs.set('limit', String(limit));

  const url = `${phase1FrontendBase()}/api/hq-tickets?${qs.toString()}`;
  const json = await fetchJson(url);

  if (filters.id) {
    const one = json?.data || null;
    if (one) await upsertPhase1Tickets([one]);
    return;
  }

  const data = json?.data || {};
  const tickets = Array.isArray(data.tickets) ? data.tickets : [];
  await upsertPhase1Tickets(tickets);
}

export const hqHelpTicketsService = {
  async listTickets(filters = {}) {
    try {
      await syncFromPhase1(filters);
    } catch (error) {
      console.warn('[hq-help-tickets] phase1 sync skipped:', error?.message || error);
    }

    const collection = await getCollection();
    const query = {};
    if (filters.status && VALID_STATUSES.has(String(filters.status))) {
      query.status = String(filters.status);
    }
    if (filters.email) query.email = String(filters.email).trim().toLowerCase();
    if (filters.id) query.externalId = String(filters.id).trim();

    const limit = Math.min(200, Math.max(1, Number(filters.limit) || 100));
    const docs = await collection.find(query).sort({ createdAt: -1 }).limit(limit).toArray();
    const tickets = docs.map(mapTicket).filter((row) => row?.id);

    return {
      tickets,
      stats: buildStats(tickets),
      openCount: tickets.filter((t) => t.status === 'open').length,
      count: tickets.length,
      source: 'headquarters',
      phase1Url: `${phase1FrontendBase()}/api/hq-tickets`,
    };
  },

  async updateTicketStatus(id, status) {
    const ticketId = String(id || '').trim();
    const next = String(status || '').trim().toLowerCase();
    if (!ticketId) throw new Error('Ticket id is required');
    if (!VALID_STATUSES.has(next)) {
      throw new Error('status must be open, in_progress, or closed');
    }

    const collection = await getCollection();
    const now = new Date();
    let doc = unwrapUpdated(
      await collection.findOneAndUpdate(
        { externalId: ticketId },
        {
          $set: {
            status: next,
            hqStatusOverride: true,
            updatedAt: now,
          },
        },
        { returnDocument: 'after' },
      ),
    );

    if (!doc) {
      try {
        await syncFromPhase1({ id: ticketId });
        doc = unwrapUpdated(
          await collection.findOneAndUpdate(
            { externalId: ticketId },
            {
              $set: {
                status: next,
                hqStatusOverride: true,
                updatedAt: now,
              },
            },
            { returnDocument: 'after' },
          ),
        );
      } catch {
        /* fall through */
      }
    }

    if (!doc) {
      await collection.updateOne(
        { externalId: ticketId },
        {
          $set: {
            externalId: ticketId,
            status: next,
            hqStatusOverride: true,
            updatedAt: now,
            syncedAt: now,
          },
          $setOnInsert: {
            subject: '',
            description: '',
            name: '',
            email: '',
            category: '',
            createdAt: now,
          },
        },
        { upsert: true },
      );
      doc = await collection.findOne({ externalId: ticketId });
    }

    try {
      await fetchJson(`${phase1FrontendBase()}/api/hq-tickets`, {
        method: 'PATCH',
        body: JSON.stringify({ id: ticketId, status: next }),
      });
    } catch (error) {
      console.warn('[hq-help-tickets] phase1 status mirror skipped:', error?.message || error);
    }

    return mapTicket(doc);
  },
};
