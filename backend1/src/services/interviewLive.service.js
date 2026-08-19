const { prisma, retryQuery } = require('../lib/prisma');
const { normalizeRoomId } = require('../utils/interviewSlot.util');

function notesCollection() {
  return 'interview_live_notes';
}

function messagesCollection() {
  return 'interview_live_messages';
}

async function findRequestForLiveRoom(roomId) {
  const normalized = normalizeRoomId(roomId);
  const suffix = normalized.replace(/^hryantra-interview-/, '');
  if (!suffix) return null;

  const or = [{ requestId: suffix }, { requestId: suffix.toUpperCase() }];
  if (/^[a-f0-9]{24}$/i.test(suffix)) {
    or.unshift({ id: suffix });
  }

  return retryQuery(async () =>
    prisma.interviewRequest.findFirst({
      where: { OR: or },
    })
  );
}

function normalizeLiveMessage(row) {
  return {
    id: String(row?.id || ''),
    roomId: String(row?.roomId || ''),
    interviewRequestId: String(row?.interviewRequestId || ''),
    displayName: String(row?.displayName || 'Participant'),
    role: String(row?.role || 'guest'),
    message: String(row?.message || ''),
    createdAt: row?.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
  };
}

async function getLiveBundle(roomId) {
  const request = await findRequestForLiveRoom(roomId);
  const filter = request
    ? { $or: [{ interviewRequestId: request.id }, { roomId: normalizeRoomId(roomId) }] }
    : { roomId: normalizeRoomId(roomId) };

  const [notesRaw, messagesRaw] = await Promise.all([
    retryQuery(async () =>
      prisma.$runCommandRaw({
        find: notesCollection(),
        filter,
        sort: { updatedAt: -1 },
        limit: 1,
      })
    ),
    retryQuery(async () =>
      prisma.$runCommandRaw({
        find: messagesCollection(),
        filter,
        sort: { createdAt: 1 },
        limit: 300,
      })
    ),
  ]);

  const notesRow = Array.isArray(notesRaw?.cursor?.firstBatch) ? notesRaw.cursor.firstBatch[0] : null;
  const messageRows = Array.isArray(messagesRaw?.cursor?.firstBatch) ? messagesRaw.cursor.firstBatch : [];

  return {
    interviewRequestId: request?.id || null,
    requestId: request?.requestId || null,
    notes: String(notesRow?.notes || ''),
    messages: messageRows.map(normalizeLiveMessage),
  };
}

async function saveLiveNotes(roomId, notes) {
  const request = await findRequestForLiveRoom(roomId);
  const now = new Date();
  const normalized = normalizeRoomId(roomId);
  const payload = {
    roomId: normalized,
    interviewRequestId: request?.id || null,
    requestCode: request?.requestId || null,
    notes: String(notes || '').slice(0, 20000),
    updatedAt: now,
  };

  await retryQuery(async () =>
    prisma.$runCommandRaw({
      update: notesCollection(),
      updates: [
        {
          q: request?.id ? { interviewRequestId: request.id } : { roomId: normalized },
          u: { $set: payload },
          upsert: true,
          multi: false,
        },
      ],
    })
  );

  return payload;
}

async function appendLiveMessage(roomId, input) {
  const request = await findRequestForLiveRoom(roomId);
  const row = {
    id: `live_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    roomId: normalizeRoomId(roomId),
    interviewRequestId: request?.id || null,
    displayName: String(input.displayName || 'Participant').trim().slice(0, 80) || 'Participant',
    role: String(input.role || 'guest').trim().toLowerCase() || 'guest',
    message: String(input.message || '').trim().slice(0, 1500),
    createdAt: new Date(),
  };
  if (!row.message) return null;

  await retryQuery(async () =>
    prisma.$runCommandRaw({
      insert: messagesCollection(),
      documents: [row],
    })
  );

  return normalizeLiveMessage(row);
}

async function getLiveBundleByRequestId(interviewRequestId) {
  if (!interviewRequestId) {
    return { notes: '', messages: [] };
  }
  const filter = { interviewRequestId };
  const [notesRaw, messagesRaw] = await Promise.all([
    retryQuery(async () =>
      prisma.$runCommandRaw({
        find: notesCollection(),
        filter,
        sort: { updatedAt: -1 },
        limit: 1,
      })
    ),
    retryQuery(async () =>
      prisma.$runCommandRaw({
        find: messagesCollection(),
        filter,
        sort: { createdAt: 1 },
        limit: 300,
      })
    ),
  ]);
  const notesRow = Array.isArray(notesRaw?.cursor?.firstBatch) ? notesRaw.cursor.firstBatch[0] : null;
  const messageRows = Array.isArray(messagesRaw?.cursor?.firstBatch) ? messagesRaw.cursor.firstBatch : [];
  return {
    notes: String(notesRow?.notes || ''),
    messages: messageRows.map(normalizeLiveMessage),
  };
}

module.exports = {
  findRequestForLiveRoom,
  getLiveBundle,
  saveLiveNotes,
  appendLiveMessage,
  getLiveBundleByRequestId,
};
