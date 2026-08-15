/**
 * Fast in-tab page cache: memory first, sessionStorage for hard refresh.
 * Sync reads so useState initializers can paint immediately.
 */

export type SessionCacheRecord<T> = {
  data: T;
  updatedAt: number;
};

export function createSessionCache<T>(opts: {
  prefix: string;
  staleMs: number;
  isValid: (value: unknown) => value is T;
}) {
  const memory = new Map<string, SessionCacheRecord<T>>();
  const { prefix, staleMs, isValid } = opts;

  function storageKey(key: string) {
    return `${prefix}${key}`;
  }

  function read(key: string): SessionCacheRecord<T> | null {
    const id = String(key || '').trim();
    if (!id) return null;
    const fromMem = memory.get(id);
    if (fromMem) return fromMem;
    if (typeof window === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem(storageKey(id));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as SessionCacheRecord<T>;
      if (!parsed || typeof parsed.updatedAt !== 'number' || !isValid(parsed.data)) return null;
      memory.set(id, parsed);
      return parsed;
    } catch {
      return null;
    }
  }

  function write(key: string, data: T): void {
    const id = String(key || '').trim();
    if (!id) return;
    const next: SessionCacheRecord<T> = { data, updatedAt: Date.now() };
    memory.set(id, next);
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(storageKey(id), JSON.stringify(next));
    } catch {
      /* quota / private mode */
    }
  }

  function isFresh(entry: SessionCacheRecord<T> | null, maxAgeMs = staleMs): boolean {
    if (!entry) return false;
    return Date.now() - entry.updatedAt < maxAgeMs;
  }

  function clear(key?: string): void {
    if (key) {
      const id = String(key).trim();
      memory.delete(id);
      if (typeof window === 'undefined') return;
      try {
        sessionStorage.removeItem(storageKey(id));
      } catch {
        /* ignore */
      }
      return;
    }
    memory.clear();
    if (typeof window === 'undefined') return;
    try {
      const keys: string[] = [];
      for (let i = 0; i < sessionStorage.length; i += 1) {
        const k = sessionStorage.key(i);
        if (k?.startsWith(prefix)) keys.push(k);
      }
      keys.forEach((k) => sessionStorage.removeItem(k));
    } catch {
      /* ignore */
    }
  }

  return { read, write, isFresh, clear, staleMs };
}

export function clearSessionStorageByPrefixes(prefixes: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const k = sessionStorage.key(i);
      if (k && prefixes.some((p) => k.startsWith(p))) keys.push(k);
    }
    keys.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
