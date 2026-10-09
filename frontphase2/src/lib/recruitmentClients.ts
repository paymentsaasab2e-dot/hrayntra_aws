import { apiGetClients, type BackendClient } from './api';
import { fetchAllPaginated, totalPagesFromPagination } from './export/fetchAllPaginated';

/** Same definition as Recruitment Clients page (`/client?scope=recruitment`). */
export function isRecruitmentClient(client: {
  recruitmentEnabled?: boolean | null;
  createdInRecruitment?: boolean | null;
}): boolean {
  return client.recruitmentEnabled === true || client.createdInRecruitment === true;
}

function unwrapClientsPayload(responseData: unknown): BackendClient[] {
  if (Array.isArray(responseData)) return responseData as BackendClient[];
  if (responseData && typeof responseData === 'object') {
    const payload = responseData as { data?: unknown; items?: unknown };
    if (Array.isArray(payload.data)) return payload.data as BackendClient[];
    if (Array.isArray(payload.items)) return payload.items as BackendClient[];
  }
  return [];
}

/**
 * Full recruitment client pool for Add Job / AI wizard.
 * Pages through the API because list endpoints cap `limit` (~100).
 */
export async function fetchAllRecruitmentClientsForPicker(): Promise<BackendClient[]> {
  return fetchAllPaginated({
    batchSize: 100,
    fetchPage: async (page, limit) => {
      const response = await apiGetClients({
        recruitmentEnabled: true,
        page,
        limit,
        includeContacts: false,
        includeLeadFields: false,
      });
      const items = unwrapClientsPayload(response.data);
      const pagination =
        response.data && typeof response.data === 'object' && !Array.isArray(response.data)
          ? (response.data as { pagination?: { totalPages?: number; total?: number } }).pagination
          : undefined;
      return {
        items,
        totalPages: totalPagesFromPagination(pagination, items.length, limit),
      };
    },
  });
}

/**
 * Add Job / AI wizard / recruitment filters: same pool as Recruitment Clients.
 * Callers may still inject workspace/own-company or `includeIds` for the current selection.
 *
 * Callers must already request `recruitmentEnabled=true` from the API. That endpoint
 * applies the same OR match as the Clients page (enabled | created-in-recruitment | has
 * jobs). Do not drop rows that are still missing flags before async backfill finishes.
 */
export function filterClientsForAddJob<
  T extends {
    id: string;
    recruitmentEnabled?: boolean | null;
    createdInRecruitment?: boolean | null;
  },
>(clients: T[], options?: { includeIds?: Array<string | null | undefined> }): T[] {
  const includeIds = new Set(
    (options?.includeIds || []).filter((id): id is string => Boolean(id && String(id).trim())),
  );
  // Trust the recruitment-scoped API list so Add Job matches `/client?scope=recruitment`.
  const pool = Array.isArray(clients) ? clients : [];

  if (includeIds.size === 0) return pool;

  const byId = new Map(pool.map((client) => [client.id, client]));
  const out = [...pool];
  includeIds.forEach((id) => {
    const extra = byId.get(id);
    if (extra && !out.some((row) => row.id === extra.id)) {
      out.push(extra);
    }
  });
  return out;
}
