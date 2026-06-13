/** Unwrap entity from apiFetch `{ success, data }` or nested `{ data: { data } }` shapes. */
export function unwrapApiEntity<T extends { id?: string }>(res: unknown): T | null {
  if (!res || typeof res !== 'object') return null;
  const root = res as Record<string, unknown>;
  if (typeof root.id === 'string') return root as T;

  const data = root.data;
  if (!data || typeof data !== 'object') return null;

  const row = data as Record<string, unknown>;
  if (typeof row.id === 'string') return data as T;

  const nested = row.data;
  if (nested && typeof nested === 'object' && typeof (nested as { id?: string }).id === 'string') {
    return nested as T;
  }

  return null;
}

export function unwrapApiList<T>(res: unknown): T[] {
  if (!res) return [];
  if (Array.isArray(res)) return res as T[];
  if (typeof res !== 'object') return [];
  const root = res as Record<string, unknown>;
  if (Array.isArray(root.data)) return root.data as T[];
  const nested = root.data;
  if (nested && typeof nested === 'object' && Array.isArray((nested as { data?: unknown }).data)) {
    return (nested as { data: T[] }).data;
  }
  return [];
}
