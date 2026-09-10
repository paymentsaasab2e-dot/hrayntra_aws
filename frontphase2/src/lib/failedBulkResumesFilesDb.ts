/**
 * IndexedDB blob store for failed Bulk CV files so users can Retry without re-uploading.
 */

const DB_NAME = 'hrayntra-failed-bulk-resumes';
const DB_VERSION = 1;
const STORE = 'files';

type StoredFileRow = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  blob: Blob;
  savedAt: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
  });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB request failed'));
  });
}

export async function putFailedBulkResumeFile(
  id: string,
  file: Blob,
  fileName: string,
  mimeType?: string,
): Promise<boolean> {
  try {
    const db = await openDb();
    try {
      const row: StoredFileRow = {
        id,
        fileName: String(fileName || 'resume').trim() || 'resume',
        mimeType: mimeType || (file as File).type || 'application/octet-stream',
        size: file.size,
        blob: file,
        savedAt: new Date().toISOString(),
      };
      const tx = db.transaction(STORE, 'readwrite');
      await reqToPromise(tx.objectStore(STORE).put(row));
      return true;
    } finally {
      db.close();
    }
  } catch {
    return false;
  }
}

export async function getFailedBulkResumeFile(id: string): Promise<File | null> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE, 'readonly');
      const row = (await reqToPromise(tx.objectStore(STORE).get(id))) as StoredFileRow | undefined;
      if (!row?.blob) return null;
      return new File([row.blob], row.fileName || 'resume', {
        type: row.mimeType || 'application/octet-stream',
      });
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

export async function deleteFailedBulkResumeFile(id: string): Promise<void> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE, 'readwrite');
      await reqToPromise(tx.objectStore(STORE).delete(id));
    } finally {
      db.close();
    }
  } catch {
    /* ignore */
  }
}

export async function deleteFailedBulkResumeFiles(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => deleteFailedBulkResumeFile(id)));
}
