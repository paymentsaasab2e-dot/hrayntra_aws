function isLocalDevBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
}

export type BulkCvApiNode = {
  index: number;
  apiBase: string;
  socketOrigin: string;
};

function normalizeApiBase(url: string): string {
  return String(url || '').trim().replace(/\/$/, '');
}

/** Strip `/api/v1` for Socket.IO origin. */
export function apiBaseToSocketOrigin(apiBase: string): string {
  return normalizeApiBase(apiBase).replace(/\/api\/v1$/i, '');
}

function resolvePrimaryDirectApiBase(): string {
  if (isLocalDevBrowser()) return 'http://127.0.0.1:5001/api/v1';
  const publicApi = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (publicApi) return normalizeApiBase(publicApi);
  return 'https://api2.hryantra.com/api/v1';
}

/**
 * Bulk CV API pool — comma-separated in `NEXT_PUBLIC_BULK_CV_API_URLS`.
 * Each node must share the same tenant databases. ZIP extracts are pinned to one node.
 */
export function resolveBulkCvApiPool(): BulkCvApiNode[] {
  const rawList = process.env.NEXT_PUBLIC_BULK_CV_API_URLS?.trim();
  const fromEnv = rawList
    ? rawList
        .split(',')
        .map((part) => normalizeApiBase(part))
        .filter(Boolean)
    : [];

  const candidates = [...fromEnv, resolvePrimaryDirectApiBase()];
  const seen = new Set<string>();
  const nodes: BulkCvApiNode[] = [];

  for (const apiBase of candidates) {
    const key = apiBase.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    nodes.push({
      index: nodes.length,
      apiBase,
      socketOrigin: apiBaseToSocketOrigin(apiBase),
    });
  }

  return nodes.length ? nodes : [{ index: 0, apiBase: resolvePrimaryDirectApiBase(), socketOrigin: apiBaseToSocketOrigin(resolvePrimaryDirectApiBase()) }];
}

/** Node that receives ZIP expand / stored-file processing for a session. */
export function pickBulkCvZipNode(): BulkCvApiNode {
  return resolveBulkCvApiPool()[0];
}

export function getBulkCvApiNode(index: number): BulkCvApiNode {
  const pool = resolveBulkCvApiPool();
  return pool[index] ?? pool[0];
}

/** Route local CV files across the pool; ZIP stored files stay on the pinned node. */
export function pickBulkCvNodeForWorkItem(options: {
  fileIndex: number;
  workerSlot?: number;
  zipPinnedNodeIndex: number | null;
  isStoredZipFile: boolean;
}): BulkCvApiNode {
  const pool = resolveBulkCvApiPool();
  if (options.isStoredZipFile) {
    const pinned =
      options.zipPinnedNodeIndex != null ? pool[options.zipPinnedNodeIndex] : pool[0];
    return pinned ?? pool[0];
  }
  const slot = options.workerSlot ?? options.fileIndex;
  return pool[Math.abs(slot) % pool.length];
}

/** Next node for retry after a network error (local files only). */
export function pickAlternateBulkCvNode(currentIndex: number, fileIndex: number): BulkCvApiNode {
  const pool = resolveBulkCvApiPool();
  if (pool.length <= 1) return pool[0];
  return pool[(currentIndex + 1 + Math.abs(fileIndex)) % pool.length];
}

export function bulkCvPoolSize(): number {
  return resolveBulkCvApiPool().length;
}
