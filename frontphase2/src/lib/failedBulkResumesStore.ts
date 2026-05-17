/**
 * Client-only persistence for bulk CV uploads that did not create a candidate.
 * Active list: shown on Candidates → "Failed resumes". Trashed list: Recycle Bin (local section).
 */

export const FAILED_BULK_RESUMES_CHANGED = 'hrayntra:failed-bulk-resumes-changed';

const KEY_ACTIVE = 'hrayntra:failed-bulk-resumes-active';
const KEY_TRASH = 'hrayntra:failed-bulk-resumes-trash';

export type FailedBulkResumeRecord = {
  id: string;
  fileName: string;
  reason: string;
  failedAt: string;
};

export type TrashedFailedBulkResume = FailedBulkResumeRecord & { trashedAt: string };

function emitChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(FAILED_BULK_RESUMES_CHANGED));
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const v = JSON.parse(raw) as T;
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    emitChanged();
  } catch {
    /* quota / private mode */
  }
}

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getActiveFailedBulkResumes(): FailedBulkResumeRecord[] {
  const rows = readJson<FailedBulkResumeRecord[]>(KEY_ACTIVE, []);
  return Array.isArray(rows) ? rows : [];
}

export function getTrashedFailedBulkResumes(): TrashedFailedBulkResume[] {
  const rows = readJson<TrashedFailedBulkResume[]>(KEY_TRASH, []);
  return Array.isArray(rows) ? rows : [];
}

export function addFailedBulkResumeRecords(
  items: Array<{ fileName: string; reason: string }>
): FailedBulkResumeRecord[] {
  if (!items.length || typeof window === 'undefined') return [];
  const prev = getActiveFailedBulkResumes();
  const now = new Date().toISOString();
  const added: FailedBulkResumeRecord[] = items.map((it) => ({
    id: newId(),
    fileName: String(it.fileName || 'resume').trim() || 'resume',
    reason: String(it.reason || 'Unknown error').trim() || 'Unknown error',
    failedAt: now,
  }));
  writeJson(KEY_ACTIVE, [...added, ...prev]);
  return added;
}

export function removeFailedBulkResumeById(id: string) {
  const prev = getActiveFailedBulkResumes();
  writeJson(
    KEY_ACTIVE,
    prev.filter((r) => r.id !== id)
  );
}

/** Clears active failed rows that match this file name (e.g. after a successful re-upload). */
export function removeFailedBulkResumesByFileName(fileName: string) {
  const name = String(fileName || '').trim();
  if (!name) return;
  const prev = getActiveFailedBulkResumes();
  const next = prev.filter((r) => r.fileName !== name);
  if (next.length === prev.length) return;
  writeJson(KEY_ACTIVE, next);
}

export function moveFailedBulkResumeToTrash(id: string) {
  moveFailedBulkResumesToTrash([id]);
}

/** Move multiple failed resume rows to Recycle Bin (local trash) in one write. */
export function moveFailedBulkResumesToTrash(ids: string[]) {
  const idSet = new Set(ids.map((id) => String(id || '').trim()).filter(Boolean));
  if (!idSet.size) return;

  const active = getActiveFailedBulkResumes();
  const toTrash = active.filter((r) => idSet.has(r.id));
  if (!toTrash.length) return;

  const rest = active.filter((r) => !idSet.has(r.id));
  const trash = getTrashedFailedBulkResumes();
  const trashedAt = new Date().toISOString();
  const trashedRows: TrashedFailedBulkResume[] = toTrash.map((row) => ({ ...row, trashedAt }));

  writeJson(KEY_ACTIVE, rest);
  writeJson(KEY_TRASH, [...trashedRows, ...trash]);
}

export function restoreFailedBulkResumeFromTrash(id: string) {
  const trash = getTrashedFailedBulkResumes();
  const row = trash.find((r) => r.id === id);
  if (!row) return;
  const rest = trash.filter((r) => r.id !== id);
  const { trashedAt: _t, ...activeRow } = row;
  void _t;
  const active = getActiveFailedBulkResumes();
  writeJson(KEY_TRASH, rest);
  writeJson(KEY_ACTIVE, [{ ...activeRow }, ...active]);
}

export function purgeFailedBulkResumeFromTrash(id: string) {
  const trash = getTrashedFailedBulkResumes();
  writeJson(
    KEY_TRASH,
    trash.filter((r) => r.id !== id)
  );
}
