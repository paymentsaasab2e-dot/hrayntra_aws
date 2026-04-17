const memoryStore = new Map();
const undoStore = new Map();
const sessionStore = new Map();

const UNDO_TTL_MS = 10 * 60 * 1000;

export function saveUserMemory(userId, data) {
  const existing = memoryStore.get(userId) || {
    lastActions: [],
    recentEntities: [],
    preferences: {},
    pendingLeadData: null,
    currentSession: null
  };
  const updated = {
    ...existing,
    ...data,
    lastActions: [
      ...(data.lastAction ? [data.lastAction] : []),
      ...(existing.lastActions || [])
    ].slice(0, 10),
    recentEntities: [
      ...(data.addToRecentEntities
        ? [data.addToRecentEntities]
        : []),
      ...(existing.recentEntities || [])
    ].slice(0, 20),
    updatedAt: new Date().toISOString()
  };
  memoryStore.set(userId, updated);
  return updated;
}

export function getUserMemory(userId) {
  return memoryStore.get(userId) || null;
}

export function savePendingLeadData(userId, data) {
  const existing = memoryStore.get(userId) || {};
  memoryStore.set(userId, {
    ...existing,
    pendingLeadData: data,
    updatedAt: new Date().toISOString()
  });
}

export function getPendingLeadData(userId) {
  return memoryStore.get(userId)?.pendingLeadData || null;
}

export function clearPendingLeadData(userId) {
  const existing = memoryStore.get(userId);
  if (existing) {
    existing.pendingLeadData = null;
    memoryStore.set(userId, existing);
  }
}

export function saveUndoRecord(userId, undoPayload) {
  const userUndos = undoStore.get(userId) || [];
  const record = {
    ...undoPayload,
    userId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(
      Date.now() + UNDO_TTL_MS
    ).toISOString(),
    used: false
  };
  userUndos.unshift(record);
  const trimmed = userUndos.slice(0, 10);
  undoStore.set(userId, trimmed);

  setTimeout(() => {
    const current = undoStore.get(userId) || [];
    const filtered = current.filter(
      u => u.actionId !== undoPayload.actionId
    );
    undoStore.set(userId, filtered);
  }, UNDO_TTL_MS);

  return record;
}

export function getUndoRecord(userId, actionId) {
  const userUndos = undoStore.get(userId) || [];
  return userUndos.find(
    u => u.actionId === actionId && !u.used
  ) || null;
}

export function markUndoUsed(userId, actionId) {
  const userUndos = undoStore.get(userId) || [];
  const idx = userUndos.findIndex(
    u => u.actionId === actionId
  );
  if (idx !== -1) {
    userUndos[idx].used = true;
    undoStore.set(userId, userUndos);
  }
}

export function getUndoStack(userId) {
  const now = new Date();
  const userUndos = undoStore.get(userId) || [];
  return userUndos.filter(
    u => !u.used && new Date(u.expiresAt) > now
  );
}

export function saveSession(userId, sessionData) {
  sessionStore.set(userId, {
    ...sessionData,
    updatedAt: new Date().toISOString()
  });
}

export function getSession(userId) {
  return sessionStore.get(userId) || null;
}

export function clearSession(userId) {
  sessionStore.delete(userId);
}
