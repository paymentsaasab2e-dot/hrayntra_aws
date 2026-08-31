/** CRM clients forwarded into Recruitment (jobs are created under these). */

export function isRecruitmentClient(client: {
  recruitmentEnabled?: boolean | null;
}): boolean {
  return client.recruitmentEnabled === true;
}

/**
 * Add Job / AI wizard picker: own-company is kept by callers separately.
 * After at least one client is sent to Recruitment, only those clients appear.
 * Until then, all CRM clients stay available so existing tenants are not blocked.
 */
export function filterClientsForAddJob<T extends { id: string; recruitmentEnabled?: boolean | null }>(
  clients: T[],
  options?: { includeIds?: Array<string | null | undefined> },
): T[] {
  const includeIds = new Set(
    (options?.includeIds || []).filter((id): id is string => Boolean(id && String(id).trim())),
  );
  const forwarded = clients.filter(isRecruitmentClient);
  const pool = forwarded.length > 0 ? forwarded : clients;
  if (includeIds.size === 0) return pool;

  const byId = new Map(clients.map((client) => [client.id, client]));
  const out = [...pool];
  includeIds.forEach((id) => {
    const extra = byId.get(id);
    if (extra && !out.some((row) => row.id === extra.id)) {
      out.push(extra);
    }
  });
  return out;
}
