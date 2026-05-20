import fs from 'fs';
import path from 'path';

/** @type {Map<string, { userId: string, sessionId: string, dir: string, files: Map<string, { path: string, originalname: string, mimetype: string, size: number }> }>} */
const sessions = new Map();

function sessionKey(userId, sessionId) {
  return `${userId}::${sessionId}`;
}

export function registerBulkCvZipSession(userId, sessionId, dir, fileEntries) {
  const key = sessionKey(userId, sessionId);
  const files = new Map();
  for (const entry of fileEntries) {
    files.set(entry.storedFileId, {
      path: entry.path,
      originalname: entry.originalname,
      mimetype: entry.mimetype,
      size: entry.size,
    });
  }
  sessions.set(key, { userId, sessionId, dir, files });
  return files.size;
}

export function getBulkCvStoredFile(userId, sessionId, storedFileId) {
  const key = sessionKey(userId, sessionId);
  const session = sessions.get(key);
  if (!session) return null;
  return session.files.get(String(storedFileId)) || null;
}

export function removeBulkCvStoredFile(userId, sessionId, storedFileId) {
  const key = sessionKey(userId, sessionId);
  const session = sessions.get(key);
  if (!session) return;
  const meta = session.files.get(String(storedFileId));
  if (meta?.path && fs.existsSync(meta.path)) {
    try {
      fs.unlinkSync(meta.path);
    } catch {
      /* ignore */
    }
  }
  session.files.delete(String(storedFileId));
}

export function releaseBulkCvZipSession(userId, sessionId) {
  const key = sessionKey(userId, sessionId);
  const session = sessions.get(key);
  if (!session) return;
  for (const meta of session.files.values()) {
    if (meta.path && fs.existsSync(meta.path)) {
      try {
        fs.unlinkSync(meta.path);
      } catch {
        /* ignore */
      }
    }
  }
  if (session.dir && fs.existsSync(session.dir)) {
    try {
      fs.rmSync(session.dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
  sessions.delete(key);
}
