import type { BackendClient, BackendJob } from './api';
import { dedupeByCompanyName } from './companyNameKey';

/** Unwrap paginated list responses from apiFetch (`{ success, data: { data, pagination } }`). */
export function parseJobsListFromResponse(res: { data?: unknown }): BackendJob[] {
  const payload = res?.data;
  if (Array.isArray(payload)) return payload as BackendJob[];
  if (payload && typeof payload === 'object') {
    const inner = payload as { data?: BackendJob[]; items?: BackendJob[] };
    if (Array.isArray(inner.data)) return inner.data;
    if (Array.isArray(inner.items)) return inner.items;
  }
  return [];
}

export function parseClientsListFromResponse(res: { data?: unknown }): BackendClient[] {
  const payload = res?.data;
  let clients: BackendClient[] = [];
  if (Array.isArray(payload)) clients = payload as BackendClient[];
  else if (payload && typeof payload === 'object') {
    const inner = payload as { data?: BackendClient[]; items?: BackendClient[] };
    if (Array.isArray(inner.data)) clients = inner.data;
    else if (Array.isArray(inner.items)) clients = inner.items;
  }
  return dedupeByCompanyName(clients, (client) => client.companyName);
}
