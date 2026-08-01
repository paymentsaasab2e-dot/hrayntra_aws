/**
 * HQ ↔ HRYantra verified chat (per candidate).
 * Durable file store + optional notification fan-out.
 */

const fs = require('fs');
const path = require('path');
const { prisma } = require('../lib/prisma');

const DATA_DIR = path.join(__dirname, '../../data');
const FILE_PATH = path.join(DATA_DIR, 'hq-hryantra-chats.json');
const SYSTEM_SENDER = 'hryantra_verified';

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadStore() {
  try {
    ensureDataDir();
    if (!fs.existsSync(FILE_PATH)) return { threads: {} };
    const parsed = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
    return parsed && typeof parsed === 'object' ? { threads: parsed.threads || {} } : { threads: {} };
  } catch {
    return { threads: {} };
  }
}

function saveStore(store) {
  ensureDataDir();
  fs.writeFileSync(FILE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

function uid(prefix = 'hrym') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function threadIdForUser(userId) {
  return `hry_verified_${userId}`;
}

function ensureThread(store, userId) {
  const id = threadIdForUser(userId);
  if (store.threads[id]) return store.threads[id];
  const now = new Date().toISOString();
  const thread = {
    id,
    userId,
    title: 'HRYantra',
    verified: true,
    unreadForUser: 0,
    unreadForHq: 0,
    messages: [
      {
        id: uid('hrym'),
        senderId: SYSTEM_SENDER,
        senderRole: 'system',
        text:
          'Welcome to HRYantra Verified Chat. Official tips and HQ updates appear here.',
        createdAt: now,
        actionUrl: null,
        hqMeta: { source: 'system.welcome' },
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
  store.threads[id] = thread;
  return thread;
}

function publicThread(thread, { includeMessages = true, messageLimit = 200 } = {}) {
  if (!thread) return null;
  const messages = includeMessages
    ? (thread.messages || []).slice(-messageLimit)
    : undefined;
  return {
    id: thread.id,
    userId: thread.userId,
    title: thread.title,
    verified: true,
    unreadForUser: thread.unreadForUser || 0,
    unreadForHq: thread.unreadForHq || 0,
    messageCount: (thread.messages || []).length,
    lastMessage: (thread.messages || [])[(thread.messages || []).length - 1] || null,
    updatedAt: thread.updatedAt,
    createdAt: thread.createdAt,
    ...(includeMessages ? { messages } : {}),
  };
}

async function fanOutNotification(userId, text, actionUrl, messageId) {
  try {
    if (!prisma?.notification?.create) return;
    const preview = String(text || '').trim().slice(0, 180);
    await prisma.notification.create({
      data: {
        candidateId: userId,
        type: 'system',
        title: 'New message from HRYantra',
        description: preview,
        actionButton: 'Open chat',
        actionPath: '/community',
        metadata: {
          kind: 'hryantra_chat',
          channel: 'alert',
          chatId: threadIdForUser(userId),
          messageId,
          actionUrl: actionUrl || null,
        },
        isRead: false,
      },
    });
  } catch (err) {
    console.warn('[hq-chat] notification fan-out skipped:', err.message);
  }
}

/**
 * HQ (or system) sends a message as HRYantra to a user.
 */
async function sendAsHryantra({
  userId,
  text,
  actionUrl,
  hqMeta,
  notifyUser = true,
  senderRole = 'hq',
}) {
  const trimmed = String(text || '').trim();
  if (!userId) return { ok: false, error: 'userId required' };
  if (!trimmed) return { ok: false, error: 'text required' };

  const store = loadStore();
  const thread = ensureThread(store, userId);
  const msg = {
    id: uid('hrym'),
    senderId: SYSTEM_SENDER,
    senderRole,
    text: trimmed.slice(0, 4000),
    createdAt: new Date().toISOString(),
    actionUrl: actionUrl || null,
    hqMeta: hqMeta && typeof hqMeta === 'object' ? hqMeta : { source: 'hq' },
  };
  thread.messages = [...(thread.messages || []), msg];
  thread.updatedAt = msg.createdAt;
  thread.unreadForUser = (thread.unreadForUser || 0) + 1;
  store.threads[thread.id] = thread;
  saveStore(store);

  if (notifyUser) {
    await fanOutNotification(userId, msg.text, actionUrl, msg.id);
  }

  return { ok: true, thread: publicThread(thread), message: msg };
}

/** User reply synced up for HQ visibility. */
function ingestUserReply({ userId, text, mediaUrl, mediaType, clientMessageId }) {
  const trimmed = String(text || '').trim();
  if (!userId) return { ok: false, error: 'userId required' };
  if (!trimmed && !mediaUrl) return { ok: false, error: 'text or media required' };

  const store = loadStore();
  const thread = ensureThread(store, userId);

  if (clientMessageId && (thread.messages || []).some((m) => m.id === clientMessageId || m.clientMessageId === clientMessageId)) {
    return { ok: true, thread: publicThread(thread), duplicate: true };
  }

  const msg = {
    id: clientMessageId || uid('hrym'),
    clientMessageId: clientMessageId || null,
    senderId: userId,
    senderRole: 'user',
    text: (trimmed || (mediaType === 'voice' ? 'Voice note' : mediaType === 'image' ? 'Image' : '')).slice(0, 2000),
    createdAt: new Date().toISOString(),
    mediaUrl: mediaUrl || null,
    mediaType: mediaType || null,
    actionUrl: null,
    hqMeta: null,
  };
  thread.messages = [...(thread.messages || []), msg];
  thread.updatedAt = msg.createdAt;
  thread.unreadForHq = (thread.unreadForHq || 0) + 1;
  store.threads[thread.id] = thread;
  saveStore(store);
  return { ok: true, thread: publicThread(thread), message: msg };
}

function getThread(userId, options) {
  if (!userId) return null;
  const store = loadStore();
  const thread = store.threads[threadIdForUser(userId)] || ensureThread(store, userId);
  saveStore(store);
  return publicThread(thread, options);
}

function listInbox({ limit = 50, q } = {}) {
  const store = loadStore();
  let rows = Object.values(store.threads || {}).map((t) => publicThread(t, { includeMessages: false }));
  rows.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  if (q) {
    const needle = String(q).toLowerCase();
    rows = rows.filter(
      (r) =>
        r.userId?.toLowerCase().includes(needle) ||
        r.lastMessage?.text?.toLowerCase().includes(needle),
    );
  }
  return rows.slice(0, Math.min(200, Math.max(1, Number(limit) || 50)));
}

/** Messages for the app client to pull (HQ → user) since a timestamp. */
function pendingForUser(userId, sinceIso) {
  const store = loadStore();
  const thread = store.threads[threadIdForUser(userId)];
  if (!thread) {
    return { messages: [], unreadForUser: 0, threadId: threadIdForUser(userId) };
  }
  const since = sinceIso ? new Date(sinceIso).getTime() : 0;
  const messages = (thread.messages || []).filter((m) => {
    if (m.senderId !== SYSTEM_SENDER) return false;
    const t = new Date(m.createdAt).getTime();
    return !Number.isNaN(t) && t > since;
  });
  return {
    threadId: thread.id,
    unreadForUser: thread.unreadForUser || 0,
    messages,
    updatedAt: thread.updatedAt,
  };
}

function markReadByUser(userId) {
  const store = loadStore();
  const thread = store.threads[threadIdForUser(userId)];
  if (!thread) return { ok: false, error: 'Thread not found' };
  thread.unreadForUser = 0;
  store.threads[thread.id] = thread;
  saveStore(store);
  return { ok: true, thread: publicThread(thread, { includeMessages: false }) };
}

function markReadByHq(userId) {
  const store = loadStore();
  const thread = store.threads[threadIdForUser(userId)];
  if (!thread) return { ok: false, error: 'Thread not found' };
  thread.unreadForHq = 0;
  store.threads[thread.id] = thread;
  saveStore(store);
  return { ok: true, thread: publicThread(thread, { includeMessages: false }) };
}

module.exports = {
  SYSTEM_SENDER,
  threadIdForUser,
  sendAsHryantra,
  ingestUserReply,
  getThread,
  listInbox,
  pendingForUser,
  markReadByUser,
  markReadByHq,
};
