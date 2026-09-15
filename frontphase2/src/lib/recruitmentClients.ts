/** CRM clients forwarded into Recruitment (jobs are created under these). */

export function isRecruitmentClient(client: {
  recruitmentEnabled?: boolean | null;
}): boolean {
  return client.recruitmentEnabled === true;
}

/**
 * Add Job / AI wizard / recruitment filters: only Recruitment Clients.
 * Callers may still inject workspace/own-company or `includeIds` for the current selection.
 */
export function filterClientsForAddJob<T extends { id: string; recruitmentEnabled?: boolean | null }>(
  clients: T[],
  options?: { includeIds?: Array<string | null | undefined> },
): T[] {
  const includeIds = new Set(
    (options?.includeIds || []).filter((id): id is string => Boolean(id && String(id).trim())),
  );
  const pool = clients.filter(isRecruitmentClient);
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
